const path = require('node:path');
const mysql = require('mysql2/promise');
const { createClient } = require('@supabase/supabase-js');
const { readConfig, refresh } = require('./refresh-hosxp-review.cjs');
const { dispatch, recoverReceipt, reconcileStaleProcessing } = require('./hosxp-review-writer.cjs');
const { isAllowedSourceUrl, requireServiceKey } = require('./lan-service-key.cjs');

const RECORD_SKIPPED_ERRORS = new Set([
  'REVIEW_CHANGED_REFRESH',
  'IDENTITY_CONFLICT',
  'BASELINE_CHANGED',
  'NOT_APPROVED',
]);

async function run() {
  const mode = process.argv[2];
  const id = process.argv[3];
  const fingerprint = process.argv[4];
  const c = readConfig(path.resolve(__dirname, '../.env.sync'));

  if (!['snapshot', 'send', 'recover', 'reconcile'].includes(mode)) {
    throw Error('USE_snapshot_send_recover_reconcile');
  }
  requireServiceKey(c.SUPABASE_SERVICE_ROLE_KEY);
  if (!isAllowedSourceUrl(c.SUPABASE_URL)) {
    throw Error('HTTPS_REQUIRED');
  }
  if (mode === 'snapshot') {
    await refresh(c);
    return;
  }
  const writeEnabled =
    c.HOSXP_REVIEW_WRITE_ENABLED === 'true' || c.HOSXP_REVIEW_ENABLE === 'true';
  if (!writeEnabled) {
    throw Error('REVIEW_WRITE_DISABLED');
  }
  if (['send', 'recover'].includes(mode) && !/^[0-9a-f-]{36}$/i.test(id || '')) {
    throw Error('JOB_ID_REQUIRED');
  }

  const client = createClient(c.SUPABASE_URL, c.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const db = await mysql.createConnection({
    host: c.HOSXP_DB_HOST,
    port: Number(c.HOSXP_DB_PORT || 3306),
    database: c.HOSXP_DB_NAME,
    user: c.HOSXP_DB_USER,
    password: c.HOSXP_DB_PASSWORD || '',
    dateStrings: true,
    connectTimeout: 15000,
  });

  try {
    if (mode === 'reconcile') {
      const report = await reconcileStaleProcessing({
        db,
        client,
        staleMinutes: 10,
        retryDelays: [1000, 3000, 9000],
      });
      console.log('REVIEW_RECONCILED', JSON.stringify(report));
      return;
    }

    if (mode === 'recover') {
      const { data: approval, error } = await client
        .from('hosxp_review_approvals')
        .select('*')
        .eq('id', id)
        .single();
      if (error || !approval) throw Error('APPROVAL_LOOKUP_FAILED');
      const { data: pop } = await client
        .from('population')
        .select('cid')
        .eq('person_id', approval.population_id)
        .maybeSingle();
      const job = pop?.cid ? { ...approval, cid: String(pop.cid).trim() } : null;
      const fp = fingerprint || approval.fingerprint;
      const res = await recoverReceipt(db, client, id, fp, job, {
        retryDelays: [1000, 3000, 9000],
      });
      console.log(JSON.stringify(res));
      return;
    }

    const res = await dispatch({
      db,
      client,
      id,
      enabled: true,
      retryDelays: [1000, 3000, 9000],
    });
    console.log('REVIEW_SENT', JSON.stringify(res));
  } finally {
    await db.end();
  }
}

if (require.main === module) {
  run().catch((e) => {
    const code = e?.message || '';
    if (RECORD_SKIPPED_ERRORS.has(code)) {
      console.warn('REVIEW_JOB_SKIPPED_RECORD:', code);
      process.exitCode = 2;
      return;
    }
    console.error(
      'REVIEW_JOB_STOPPED:',
      code || 'inspect reservation/receipt before retry; no automatic resend'
    );
    process.exitCode = 1;
  });
}

module.exports = { run, RECORD_SKIPPED_ERRORS };
