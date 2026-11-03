// Prepare Windows Native configuration for low-RAM (4 GB) PCs without Docker.
// Generates:
// 1. local-stack/.env.native (if not exists)
// 2. local-stack/postgresql-4gb-tuning.sql
// 3. local-stack/apply-all-migrations.sql (ordered correctly so dependencies succeed)

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { signJwt } = require('./generate-local-keys.cjs');

const ORDERED_MIGRATIONS = [
  '20260907_population_status.sql',
  '20260907_hosxp_review.sql',
  '20260910_auth_prepare.sql',
  '20260910_auth_activate.sql',
  '20260911_population_read_scope_per_statement.sql',
  '20260911_screening_search.sql',
  '20260911_screening_workflow.sql',
  '20260914_fix_review_reauthentication.sql',
  '20260914_fit_preparation.sql',
  '20260914_review_fit_baseline.sql',
  '20260917_fit_import_results.sql',
  '20260922_fit_billing_preview.sql',
  '20260923_authen_report.sql',
  '20260924_authen_fit_source.sql',
  '20260925_person_identity.sql',
  '20260930_hosxp_registry_sync.sql',
  '20261001_registry_identity_link.sql',
  '20261002_dashboard_summary.sql',
  '20261006_screening_non_target.sql',
  '20261006_screening_register_person.sql',
  '20261006_screening_registration_followup.sql',
  '20261007_nhso_close_ledger.sql',
  '20261009_fit_auth_writeback_queue.sql',
  '20261009_nhso_close_permissions.sql',
  '20261012_fit_close_intents.sql',
  '20261012_fit_close_reservation.sql',
  '20261015_screening_all_candidates.sql',
  '20261019_hosxp_review_snapshot_join.sql',
  '20261022_hosxp_review_dispatch.sql',
  '20261028_house_gps.sql',
  '20261029_hosxp_review_retention.sql',
];

function setupNativeFiles(rootDir = path.resolve(__dirname, '..')) {
  const stackDir = path.join(rootDir, 'local-stack');
  fs.mkdirSync(stackDir, { recursive: true });

  // 1. PostgreSQL memory tuning for 4 GB RAM PC (HP 280 G4 MT)
  const tuningFile = path.join(stackDir, 'postgresql-4gb-tuning.sql');
  const tuningSql = [
    '-- Tuning PostgreSQL 16 for a 4 GB RAM Windows PC (HP 280 G4 MT, i5-8500, SATA SSD)',
    '-- Uses ~80-120 MB RAM instead of heavy server defaults.',
    "ALTER SYSTEM SET shared_buffers = '128MB';",
    "ALTER SYSTEM SET effective_cache_size = '512MB';",
    "ALTER SYSTEM SET work_mem = '4MB';",
    "ALTER SYSTEM SET maintenance_work_mem = '32MB';",
    "ALTER SYSTEM SET max_connections = '35';",
    "ALTER SYSTEM SET random_page_cost = '1.1';",
    'SELECT pg_reload_conf();',
  ].join('\r\n');
  fs.writeFileSync(tuningFile, tuningSql + '\r\n', 'utf8');

  // 2. Ordered migration runner script for psql
  const applyFile = path.join(stackDir, 'apply-all-migrations.sql');
  const lines = [
    '-- Run from project root with:',
    '-- psql -h 127.0.0.1 -U postgres -d nonsawang -v ON_ERROR_STOP=1 -f local-stack/apply-all-migrations.sql',
    '\\i local-stack/init-roles.sql',
  ];
  for (const name of ORDERED_MIGRATIONS) {
    if (fs.existsSync(path.join(rootDir, 'migrations', name))) {
      lines.push(`\\i migrations/${name}`);
    }
  }
  fs.writeFileSync(applyFile, lines.join('\r\n') + '\r\n', 'utf8');

  // 3. Create local-stack/.env.native if it doesn't exist yet (never overwrite existing keys)
  const envNativePath = path.join(stackDir, '.env.native');
  let createdEnv = false;
  if (!fs.existsSync(envNativePath)) {
    const jwtSecret = crypto.randomBytes(32).toString('hex');
    const dbPassword = 'ChangeMe_' + crypto.randomBytes(9).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 10 * 365 * 24 * 60 * 60;
    const anonKey = signJwt({ role: 'anon', iss: 'nonsawang-local', iat: now, exp }, jwtSecret);
    const serviceKey = signJwt({ role: 'service_role', iss: 'nonsawang-local', iat: now, exp }, jwtSecret);

    const envLines = [
      '# Windows Native Stack Configuration (No Docker - Optimized for 4 GB RAM)',
      'PG_HOST=127.0.0.1',
      'PG_PORT=5432',
      'PG_DATABASE=nonsawang',
      'PG_USER=postgres',
      `POSTGRES_PASSWORD=${dbPassword}`,
      `PGRST_JWT_SECRET=${jwtSecret}`,
      'LOCAL_GATEWAY_PORT=54321',
      'LOCAL_POSTGREST_PORT=54320',
      '',
      '# Copy these into .env.local (for Next.js) and .env.sync (for HOSxP connector):',
      'NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321',
      `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey}`,
      'SUPABASE_URL=http://127.0.0.1:54321',
      `SUPABASE_SERVICE_ROLE_KEY=${serviceKey}`,
      'ALLOW_HTTP_SESSION=true',
    ];
    fs.writeFileSync(envNativePath, envLines.join('\r\n') + '\r\n', 'utf8');
    createdEnv = true;
  }

  return { tuningFile, applyFile, envNativePath, createdEnv };
}

if (require.main === module) {
  const res = setupNativeFiles();
  console.log('=== เตรียมไฟล์สำหรับ Windows Native (ประหยัด RAM สำหรับเครื่อง 4 GB) สำเร็จ ===');
  console.log('1. ไฟล์ตั้งค่าและคีย์:', res.envNativePath, res.createdEnv ? '(สร้างใหม่)' : '(มีอยู่แล้ว ไม่เขียนทับ)');
  console.log('2. สคริปต์ปรับจูนแรม PostgreSQL:', res.tuningFile);
  console.log('3. สคริปต์รัน Migration เรียงตามลำดับ:', res.applyFile);
}

module.exports = { setupNativeFiles, ORDERED_MIGRATIONS };
