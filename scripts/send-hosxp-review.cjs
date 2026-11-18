// Single-job LAN command for approved population review items.
const path = require('node:path');
const mysql = require('mysql2/promise');
const { createClient } = require('@supabase/supabase-js');
const { readConfig } = require('./refresh-hosxp-review.cjs');
const { dispatch, recoverReceipt } = require('./hosxp-review-writer.cjs');
const { isAllowedSourceUrl, requireServiceKey } = require('./lan-service-key.cjs');

(async () => {
  const arg2 = process.argv[2];
  const arg3 = process.argv[3];
  const isUuidArg2 = /^[0-9a-f-]{36}$/i.test(arg2 || '');
  const configFile = isUuidArg2 ? path.resolve(__dirname, '../.env.sync') : arg2;
  const id = isUuidArg2 ? arg2 : arg3;
  const fingerprint = isUuidArg2 ? arg3 : process.argv[4];

  if (!configFile || !id) {
    throw Error('USAGE: node scripts/send-hosxp-review.cjs [config-file] <approval-uuid> [fingerprint]');
  }
  const c = readConfig(path.resolve(configFile));
  const writeEnabled =
    c.HOSXP_REVIEW_WRITE_ENABLED === 'true' || c.HOSXP_REVIEW_ENABLE === 'true';
  if (!writeEnabled) {
    throw Error('REVIEW_WRITE_DISABLED');
  }
  requireServiceKey(c.SUPABASE_SERVICE_ROLE_KEY);
  if (!isAllowedSourceUrl(c.SUPABASE_URL)) {
    throw Error('HTTPS_REQUIRED');
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
    let result;
    if (fingerprint) {
      const { data: approval } = await client
        .from('hosxp_review_approvals')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      const { data: pop } = approval
        ? await client
            .from('population')
            .select('cid')
            .eq('person_id', approval.population_id)
            .maybeSingle()
        : { data: null };
      const job = approval && pop?.cid ? { ...approval, cid: String(pop.cid).trim() } : null;
      result = await recoverReceipt(db, client, id, fingerprint, job, {
        retryDelays: [1000, 3000, 9000],
      });
    } else {
      result = await dispatch({
        db,
        client,
        id,
        enabled: true,
        retryDelays: [1000, 3000, 9000],
      });
    }
    console.log(JSON.stringify(result));
  } finally {
    await db.end();
  }
})().catch((e) => {
  console.error(
    'REVIEW_SEND_STOPPED:',
    e?.message || 'inspect reservation/receipt before retry; no automatic resend'
  );
  process.exitCode = 1;
});
