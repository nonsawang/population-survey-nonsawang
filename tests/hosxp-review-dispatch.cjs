const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {
  inspectPersonState,
  writeApproved,
  recoverReceipt,
  reconcileStaleProcessing,
  acknowledgeOutcome,
  dispatch,
} = require('../scripts/hosxp-review-writer.cjs');
const { run: runAutoPass } = require('../scripts/hosxp-review-auto.cjs');

(async () => {
  const db = new PGlite();
  try {
    await db.exec(
      'CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE TABLE population(person_id text,cid text,title text,fname text,lname text,moo text,house text,updated_at timestamptz,residency_type text,person_discharge_id integer,status_model_version integer)'
    );
    for (const name of [
      '20260907_hosxp_review.sql',
      '20261019_hosxp_review_snapshot_join.sql',
      '20261022_hosxp_review_dispatch.sql',
      '20261117_hosxp_review_auto_send.sql',
    ]) {
      await db.exec(fs.readFileSync(path.join(__dirname, '../migrations', name), 'utf8'));
    }

    await db.exec(`
      INSERT INTO population VALUES('web','1234567890121','','fixture','','1','1',now(),'3',9,1);
      INSERT INTO hosxp_review_batches VALUES('test','test',now(),1,now());
      INSERT INTO hosxp_review_snapshot VALUES('test','1','1234567890121','1','9','2026-01-01 00:00:00');
      INSERT INTO hosxp_review_approvals(population_id,target_person_id,batch_id,fingerprint,old_values,changes,approved_by)
      SELECT population_id,target_id,batch_id,fingerprint,
        jsonb_build_object('house_regist_type_id',old_type,'person_discharge_id',old_discharge,'last_update',target_updated_at),
        changes,'fixture'
      FROM hosxp_review_candidates;
    `);
    const id = (await db.query('SELECT id FROM hosxp_review_approvals')).rows[0].id;

    // 1. Source change before claim rejects with REVIEW_CHANGED_REFRESH
    await db.exec("UPDATE population SET residency_type='2'");
    await assert.rejects(db.query('SELECT hosxp_review_claim($1)', [id]), /REVIEW_CHANGED/);
    await db.exec("UPDATE population SET residency_type='3'");

    // 2. Claim sets state='processing' and bumps write_stamp if it collides with old_values.last_update
    const claimed = (
      await db.query("SELECT hosxp_review_claim($1, '2026-01-01 00:00:00') job", [id])
    ).rows[0].job;
    assert.equal(claimed.cid, '1234567890121');
    assert.equal(claimed.state, 'processing');
    assert.equal(claimed.write_stamp, '2026-01-01 00:00:01');
    assert.equal(
      (await db.query('SELECT display_status FROM hosxp_review_candidates')).rows[0].display_status,
      'processing'
    );

    // 3. Second concurrent worker claim on same ID is rejected immediately
    await assert.rejects(db.query('SELECT hosxp_review_claim($1)', [id]), /NOT_APPROVED/);

    // 4. Reconciling an unwritten 'processing' row back to 'approved' allows re-claiming
    await db.query("SELECT hosxp_review_complete($1, 'approved', 'ROLLBACK_RECOVERED')", [id]);
    assert.equal(
      (await db.query('SELECT state, write_stamp, error_code FROM hosxp_review_approvals WHERE id=$1', [id]))
        .rows[0].state,
      'approved'
    );
    const reClaimed = (
      await db.query("SELECT hosxp_review_claim($1, '2026-11-17 15:00:00') job", [id])
    ).rows[0].job;
    assert.equal(reClaimed.state, 'processing');
    assert.equal(reClaimed.write_stamp, '2026-11-17 15:00:00');

    // 5. Complete as 'sent' is idempotent and immutable against conflicting outcomes
    await db.query("SELECT hosxp_review_complete($1, 'sent')", [id]);
    await db.query("SELECT hosxp_review_complete($1, 'sent')", [id]);
    assert.equal(
      (await db.query('SELECT display_status FROM hosxp_review_candidates')).rows[0].display_status,
      'sent'
    );
    await assert.rejects(
      db.query("SELECT hosxp_review_complete($1, 'failed', 'ERR')", [id]),
      /OUTCOME_CONFLICT/
    );

    // 6. Browser roles denied
    for (const role of ['anon', 'authenticated']) {
      await db.exec('SET ROLE ' + role);
      await assert.rejects(db.query('SELECT hosxp_review_claim($1)', [id]), /permission denied/);
      await db.exec('RESET ROLE');
    }

    // 7. Test zero-receipt-table writeApproved, inspectPersonState, recoverReceipt, retry backoff & reconciliation
    let personRow = {
      person_id: 1,
      cid: '1234567890121',
      house_regist_type_id: '1',
      person_discharge_id: '9',
      last_update: '2026-01-01 00:00:00',
    };
    const mockMysql = {
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      execute: async (sql, params) => {
        if (sql.includes('information_schema.TABLES')) {
          return [[{ TABLE_NAME: 'person', ENGINE: 'InnoDB' }]];
        }
        if (sql.startsWith('SELECT person_id,cid')) {
          return [[{ ...personRow }]];
        }
        if (sql.startsWith('UPDATE person SET')) {
          personRow.house_regist_type_id = String(params[0]);
          personRow.last_update = String(params[1]);
          return [{ affectedRows: 1 }];
        }
        throw Error('UNEXPECTED_SQL: ' + sql);
      },
    };

    const sampleJob = {
      id,
      fingerprint: 'a'.repeat(64),
      target_person_id: '1',
      cid: '1234567890121',
      old_values: {
        house_regist_type_id: '1',
        person_discharge_id: '9',
        last_update: '2026-01-01 00:00:00',
      },
      changes: { house_regist_type_id: 3 },
      write_stamp: '2026-11-17 15:00:00',
    };

    assert.equal((await inspectPersonState(mockMysql, sampleJob)).state, 'unwritten');
    await writeApproved(mockMysql, sampleJob, { requireReceiptTable: false });
    assert.equal(personRow.house_regist_type_id, '3');
    assert.equal(personRow.last_update, '2026-11-17 15:00:00');
    assert.equal((await inspectPersonState(mockMysql, sampleJob)).state, 'written');

    // Idempotent replay with same write_stamp does not fail
    const replay = await writeApproved(mockMysql, sampleJob, { requireReceiptTable: false });
    assert.equal(replay.replayed, true);

    // Acknowledge retry backoff succeeds after transient failure
    let attempts = 0;
    const flakyClient = {
      rpc: async () => {
        attempts += 1;
        return attempts < 3 ? { error: { message: 'NETWORK_BLIP' } } : { error: null };
      },
    };
    await acknowledgeOutcome(flakyClient, id, 'sent', { retryDelays: [5, 5, 5] });
    assert.equal(attempts, 3);

    // Zero-table recoverReceipt proves 'sent' via write_stamp
    const rec = await recoverReceipt(
      mockMysql,
      { rpc: async () => ({ error: null }) },
      id,
      sampleJob.fingerprint,
      sampleJob,
      { retryDelays: [1] }
    );
    assert.equal(rec.status, 'sent');

    // If someone else edits HOSxP after write failed to ack, inspectPersonState returns 'ambiguous' -> NEEDS_MANUAL_REVIEW
    personRow.house_regist_type_id = '2';
    personRow.last_update = '2026-11-17 15:05:00';
    assert.equal((await inspectPersonState(mockMysql, sampleJob)).state, 'ambiguous');
    let recordedError = null;
    const ambigRec = await recoverReceipt(
      mockMysql,
      {
        rpc: async (_fn, args) => {
          recordedError = args.p_error_code;
          return { error: null };
        },
      },
      id,
      sampleJob.fingerprint,
      sampleJob,
      { retryDelays: [1] }
    );
    assert.equal(ambigRec.status, 'failed');
    assert.equal(recordedError, 'NEEDS_MANUAL_REVIEW');

    // 8. Dispatch cancels REVIEW_CHANGED_REFRESH item so queue doesn't block
    let cancelledCode = null;
    await assert.rejects(
      dispatch({
        db: mockMysql,
        client: {
          rpc: async (name, args) => {
            if (name === 'hosxp_review_claim') {
              return { error: { message: 'REVIEW_CHANGED_REFRESH' } };
            }
            if (name === 'hosxp_review_complete') {
              cancelledCode = `${args.p_outcome}:${args.p_error_code}`;
              return { error: null };
            }
            return { error: null };
          },
        },
        id,
        enabled: true,
        retryDelays: [1],
      }),
      /REVIEW_CHANGED_REFRESH/
    );
    assert.equal(cancelledCode, 'cancelled:REVIEW_CHANGED_REFRESH');

    console.log(
      'PASS: atomic processing claim, concurrent worker block, write_stamp collision bump, zero-table idempotent write & recover, retry backoff, 3-way reconciliation, and non-blocking queue cancellation'
    );
  } finally {
    await db.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
