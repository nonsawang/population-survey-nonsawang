// One bounded pass for approved population review items (house_regist_type_id & person_discharge_id).
// Uses existing hosxp_review_approvals table directly (like house_gps_queue) without creating new tables.
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createClient } = require('@supabase/supabase-js');
const { readConfig, refresh } = require('./refresh-hosxp-review.cjs');

async function run(envConfig, spawn = spawnSync) {
  const c = envConfig || readConfig(path.resolve(__dirname, '../.env.sync'));
  const client = createClient(c.SUPABASE_URL, c.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Auto-refresh HOSxP person reference snapshot if missing or older than 12 hours
  try {
    const { data: batches } = await client
      .from('hosxp_review_batches')
      .select('captured_at')
      .not('completed_at', 'is', null)
      .order('captured_at', { ascending: false })
      .limit(1);
    if (!batches?.[0] || Date.now() - Date.parse(batches[0].captured_at) > 12 * 3600 * 1000) {
      await refresh(c);
    }
  } catch {
    // Non-fatal if snapshot check fails; claim RPC enforces 24h freshness
  }

  const writeEnabled =
    c.HOSXP_REVIEW_WRITE_ENABLED === 'true' || c.HOSXP_REVIEW_ENABLE === 'true';
  if (!writeEnabled) {
    console.log('REVIEW_REFERENCE_ONLY_WRITE_DISABLED');
    return { status: 'disabled', sent: 0, skipped: 0 };
  }

  // Reconcile any stale 'processing' items (>10 minutes) before picking new 'approved' items
  spawn(process.execPath, [path.join(__dirname, 'hosxp-review-lan.cjs'), 'reconcile'], {
    stdio: 'inherit',
    windowsHide: true,
    timeout: 60000,
  });

  const { data, error } = await client
    .from('hosxp_review_approvals')
    .select('id')
    .eq('state', 'approved')
    .order('approved_at')
    .limit(10);
  if (error) throw Error('APPROVED_QUEUE_READ_FAILED');

  let sent = 0;
  let skipped = 0;
  for (const q of data || []) {
    const result = spawn(
      process.execPath,
      [path.join(__dirname, 'hosxp-review-lan.cjs'), 'send', q.id],
      { stdio: 'inherit', windowsHide: true, timeout: 60000 }
    );
    if (result.status === 0) {
      sent += 1;
      continue;
    }
    if (result.status === 2) {
      // Record-level conflict/stale data was marked cancelled/failed; do not block subsequent items!
      skipped += 1;
      continue;
    }
    console.error('REVIEW_AUTO_STOPPED_CHECK_QUEUE');
    process.exitCode = 1;
    return { status: 'stopped', sent, skipped };
  }
  console.log('REVIEW_AUTO_PASS_COMPLETE');
  return { status: 'completed', sent, skipped };
}

if (require.main === module) {
  run().catch(() => {
    console.error('REVIEW_AUTO_FAILED');
    process.exitCode = 1;
  });
}

module.exports = { run };
