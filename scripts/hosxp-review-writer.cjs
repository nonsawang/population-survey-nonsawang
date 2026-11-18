const fail = (code) => {
  throw new Error(code);
};
const norm = (v) => (v == null ? null : String(v));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function formatBangkokStamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || '00';
  const hh = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')} ${hh}:${get('minute')}:${get('second')}`;
}

function validate(job) {
  if (!job || !/^[0-9a-f-]{36}$/i.test(job.id) || !/^[0-9a-f]{64}$/i.test(job.fingerprint))
    fail('INVALID_JOB');
  if (!/^\d+$/.test(job.target_person_id) || !/^\d{13}$/.test(job.cid)) fail('INVALID_IDENTITY');
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(job.cid[i]) * (13 - i);
  if ((11 - (sum % 11)) % 10 !== Number(job.cid[12])) fail('INVALID_CID');
  const keys = Object.keys(job.changes || {});
  if (!keys.length || keys.some((k) => !['house_regist_type_id', 'person_discharge_id'].includes(k)))
    fail('INVALID_CHANGES');
  for (const k of keys)
    if (!(k === 'house_regist_type_id' ? [0, 1, 2, 3, 4] : [1, 2, 3, 9]).includes(job.changes[k]))
      fail('INVALID_CHANGES');
  if (!job.old_values) fail('MISSING_BASELINE');
  if (
    job.write_stamp != null &&
    !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(String(job.write_stamp))
  )
    fail('INVALID_WRITE_STAMP');
  return keys;
}

async function inspectPersonState(db, job) {
  const keys = validate(job);
  const [rows] = await db.execute(
    'SELECT person_id,cid,house_regist_type_id,person_discharge_id,last_update FROM person WHERE person_id=? OR TRIM(cid)=?',
    [job.target_person_id, job.cid]
  );
  if (
    rows.length !== 1 ||
    String(rows[0].person_id) !== job.target_person_id ||
    String(rows[0].cid).trim() !== job.cid
  ) {
    return { state: 'identity_conflict' };
  }
  const r = rows[0];
  if (job.write_stamp && norm(r.last_update) === norm(job.write_stamp)) {
    const changesMatch = keys.every((k) => norm(r[k]) === norm(job.changes[k]));
    const unchangedMatch = ['house_regist_type_id', 'person_discharge_id']
      .filter((k) => !keys.includes(k))
      .every((k) => norm(r[k]) === norm(job.old_values[k]));
    if (changesMatch && unchangedMatch) {
      return { state: 'written' };
    }
  }
  const baselineMatches = ['house_regist_type_id', 'person_discharge_id', 'last_update'].every(
    (k) => norm(r[k]) === norm(job.old_values[k])
  );
  if (baselineMatches) {
    return { state: 'unwritten' };
  }
  return { state: 'ambiguous' };
}

async function writeApproved(db, job, { requireReceiptTable = true } = {}) {
  const keys = validate(job);
  const [engines] = await db.execute(
    "SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('person','survey_person_review_receipts')"
  );
  const personEngine = engines.find((r) => r.TABLE_NAME === 'person');
  const hasReceiptTable = engines.some(
    (r) => r.TABLE_NAME === 'survey_person_review_receipts' && r.ENGINE === 'InnoDB'
  );

  if (!personEngine || personEngine.ENGINE !== 'InnoDB') fail('TRANSACTIONAL_TABLES_REQUIRED');
  if (requireReceiptTable && !hasReceiptTable) fail('TRANSACTIONAL_TABLES_REQUIRED');

  await db.beginTransaction();
  try {
    if (hasReceiptTable) {
      await db.execute(
        'INSERT INTO survey_person_review_receipts(approval_id,fingerprint) VALUES(?,?)',
        [job.id, job.fingerprint]
      );
    }
    const [rows] = await db.execute(
      'SELECT person_id,cid,house_regist_type_id,person_discharge_id,last_update FROM person WHERE person_id=? OR TRIM(cid)=? FOR UPDATE',
      [job.target_person_id, job.cid]
    );
    if (
      rows.length !== 1 ||
      String(rows[0].person_id) !== job.target_person_id ||
      String(rows[0].cid).trim() !== job.cid
    )
      fail('IDENTITY_CONFLICT');

    // Without receipt table, prove idempotency using write_stamp + target field values
    if (!hasReceiptTable && job.write_stamp) {
      const changesMatch = keys.every((k) => norm(rows[0][k]) === norm(job.changes[k]));
      if (changesMatch && norm(rows[0].last_update) === norm(job.write_stamp)) {
        await db.rollback();
        return { written: true, replayed: true };
      }
    }

    for (const k of ['house_regist_type_id', 'person_discharge_id', 'last_update'])
      if (norm(rows[0][k]) !== norm(job.old_values[k])) fail('BASELINE_CHANGED');

    const stampSql = job.write_stamp ? 'last_update=?' : 'last_update=NOW()';
    const stampArgs = job.write_stamp ? [job.write_stamp] : [];
    const [result] = await db.execute(
      'UPDATE person SET ' +
        keys.map((k) => '`' + k + '`=?').join(',') +
        ',' +
        stampSql +
        ' WHERE person_id=?',
      [...keys.map((k) => job.changes[k]), ...stampArgs, job.target_person_id]
    );
    if (result.affectedRows !== 1) fail('UPDATE_COUNT');
    await db.commit();
    return { written: true };
  } catch (e) {
    await db.rollback().catch(() => {});
    throw e;
  }
}

async function tryAcknowledgeOnce(client, id, outcome, errorCode = null) {
  if (typeof client.rpc === 'function') {
    const completeRes = await client.rpc('hosxp_review_complete', {
      p_id: id,
      p_outcome: outcome,
      p_error_code: errorCode,
    });
    if (!completeRes?.error) return true;
    if (['sent', 'failed'].includes(outcome)) {
      const finishRes = await client.rpc('hosxp_review_finish', { p_id: id, p_outcome: outcome });
      if (!finishRes?.error) return true;
    }
  }
  if (typeof client.from === 'function') {
    const payload =
      outcome === 'approved'
        ? { state: 'approved', claimed_at: null, write_stamp: null, error_code: errorCode }
        : { state: outcome, error_code: outcome === 'sent' ? null : errorCode };
    const updateRes = await client.from('hosxp_review_approvals').update(payload).eq('id', id);
    if (!updateRes?.error) return true;
  }
  return false;
}

async function acknowledgeOutcome(
  client,
  id,
  outcome,
  { errorCode = null, retryDelays = [15, 30, 60] } = {}
) {
  if (await tryAcknowledgeOnce(client, id, outcome, errorCode)) return;
  for (const delay of retryDelays) {
    if (delay > 0) await sleep(delay);
    if (await tryAcknowledgeOnce(client, id, outcome, errorCode)) return;
  }
  fail('ACK_PENDING');
}

async function recoverReceipt(db, client, id, fingerprint, job = null, options = {}) {
  const [tables] = await db.execute(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='survey_person_review_receipts'"
  );
  if (tables.some((r) => r.TABLE_NAME === 'survey_person_review_receipts')) {
    const [rows] = await db.execute(
      'SELECT fingerprint FROM survey_person_review_receipts WHERE approval_id=?',
      [id]
    );
    if (rows.length === 1 && rows[0].fingerprint === fingerprint) {
      await acknowledgeOutcome(client, id, 'sent', options);
      return { status: 'sent' };
    }
    if (!job) fail('RECONCILIATION_REQUIRED');
  }

  if (job && job.write_stamp) {
    const check = await inspectPersonState(db, job);
    if (check.state === 'written') {
      await acknowledgeOutcome(client, id, 'sent', options);
      return { status: 'sent' };
    }
    if (check.state === 'unwritten') {
      await acknowledgeOutcome(client, id, 'approved', {
        ...options,
        errorCode: 'RECOVERED_UNWRITTEN',
      });
      return { status: 'approved' };
    }
    await acknowledgeOutcome(client, id, 'failed', {
      ...options,
      errorCode: 'NEEDS_MANUAL_REVIEW',
    });
    return { status: 'failed', reason: 'NEEDS_MANUAL_REVIEW' };
  }

  fail('RECONCILIATION_REQUIRED');
}

async function reconcileStaleProcessing({
  db,
  client,
  staleMinutes = 10,
  retryDelays = [100, 300, 900],
}) {
  const cutoff = new Date(Date.now() - staleMinutes * 60000).toISOString();
  const { data: stuckRows, error } = await client
    .from('hosxp_review_approvals')
    .select('*')
    .eq('state', 'processing')
    .lt('claimed_at', cutoff)
    .order('claimed_at')
    .limit(25);
  if (error || !Array.isArray(stuckRows) || !stuckRows.length) {
    return { sent: 0, requeued: 0, failed: 0 };
  }

  const summary = { sent: 0, requeued: 0, failed: 0 };
  for (const row of stuckRows) {
    const { data: pop } = await client
      .from('population')
      .select('cid')
      .eq('person_id', row.population_id)
      .maybeSingle();
    const cid = String(pop?.cid || '').trim();
    if (!cid || !row.write_stamp) {
      await acknowledgeOutcome(client, row.id, 'failed', {
        errorCode: 'NEEDS_MANUAL_REVIEW',
        retryDelays,
      });
      summary.failed += 1;
      continue;
    }
    const check = await inspectPersonState(db, { ...row, cid });
    if (check.state === 'written') {
      await acknowledgeOutcome(client, row.id, 'sent', { retryDelays });
      summary.sent += 1;
    } else if (check.state === 'unwritten') {
      await acknowledgeOutcome(client, row.id, 'approved', {
        errorCode: 'ROLLBACK_RECOVERED',
        retryDelays,
      });
      summary.requeued += 1;
    } else {
      await acknowledgeOutcome(client, row.id, 'failed', {
        errorCode: 'NEEDS_MANUAL_REVIEW',
        retryDelays,
      });
      summary.failed += 1;
    }
  }
  return summary;
}

async function claimJob(client, id, writeStamp) {
  const claimRes = await client.rpc('hosxp_review_claim', {
    p_id: id,
    p_write_stamp: writeStamp,
  });
  if (!claimRes?.error && claimRes?.data) return claimRes.data;
  const errMsg = String(claimRes?.error?.message || '');
  if (errMsg.includes('REVIEW_CHANGED_REFRESH')) fail('REVIEW_CHANGED_REFRESH');
  if (errMsg.includes('NOT_APPROVED')) fail('NOT_APPROVED');

  const reserveRes = await client.rpc('hosxp_review_reserve', { p_id: id });
  if (!reserveRes?.error && reserveRes?.data) {
    return { ...reserveRes.data, write_stamp: reserveRes.data.write_stamp || writeStamp };
  }
  const resMsg = String(reserveRes?.error?.message || '');
  if (resMsg.includes('REVIEW_CHANGED_REFRESH')) fail('REVIEW_CHANGED_REFRESH');
  if (resMsg.includes('NOT_APPROVED')) fail('NOT_APPROVED');
  fail('RESERVATION_REJECTED');
}

async function dispatch({
  db,
  client,
  id,
  enabled = false,
  requireReceiptTable = false,
  retryDelays = [1000, 3000, 9000],
}) {
  if (!enabled) fail('DISPATCH_DISABLED');
  const proposedStamp = formatBangkokStamp();
  let job;
  try {
    job = await claimJob(client, id, proposedStamp);
  } catch (e) {
    // Prevent head-of-line queue blocking when source data or snapshot changed after approval
    if (e.message === 'REVIEW_CHANGED_REFRESH') {
      await acknowledgeOutcome(client, id, 'cancelled', {
        errorCode: 'REVIEW_CHANGED_REFRESH',
        retryDelays,
      }).catch(() => {});
    }
    throw e;
  }

  try {
    await writeApproved(db, job, { requireReceiptTable });
  } catch (e) {
    if (['IDENTITY_CONFLICT', 'BASELINE_CHANGED'].includes(e.message)) {
      await acknowledgeOutcome(client, id, 'failed', {
        errorCode: e.message,
        retryDelays,
      }).catch(() => {});
    }
    throw e;
  }
  await acknowledgeOutcome(client, job.id, 'sent', { retryDelays });
  return { status: 'sent', write_stamp: job.write_stamp };
}

module.exports = {
  writeApproved,
  dispatch,
  recoverReceipt,
  reconcileStaleProcessing,
  inspectPersonState,
  acknowledgeOutcome,
  formatBangkokStamp,
  validate,
};
