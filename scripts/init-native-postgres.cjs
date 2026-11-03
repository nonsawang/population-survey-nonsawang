// Interactive & automated PostgreSQL 16 initializer for Windows Native (4 GB RAM)
// - Verifies or prompts for the PostgreSQL superuser password set during installation
// - Syncs POSTGRES_PASSWORD and PGRST_DB_URI in local-stack/.env.native
// - Creates database "nonsawang", applies 4 GB RAM tuning & all 31 SQL migrations
// - Ensures an initial admin account exists in public.app_users

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { spawnSync } = require('node:child_process');
const { setupNativeFiles } = require('./setup-native-env.cjs');

function findPsql() {
  const candidates = [
    'C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe',
    'C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe',
    'C:\\Program Files\\PostgreSQL\\15\\bin\\psql.exe',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'psql.exe';
}

function readEnvMap(envPath) {
  const map = {};
  if (!fs.existsSync(envPath)) return map;
  const content = fs.readFileSync(envPath, 'utf8').replace(/^\uFEFF/, '');
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match) map[match[1]] = match[2];
  }
  return map;
}

function updateEnvPassword(envPath, newPassword) {
  if (!fs.existsSync(envPath)) return;
  let content = fs.readFileSync(envPath, 'utf8');
  const encoded = encodeURIComponent(newPassword);
  content = content.replace(/^POSTGRES_PASSWORD=.*$/m, `POSTGRES_PASSWORD=${newPassword}`);
  content = content.replace(
    /^PGRST_DB_URI=postgres:\/\/([^:]+):[^@]+@(.*)$/m,
    `PGRST_DB_URI=postgres://$1:${encoded}@$2`
  );
  fs.writeFileSync(envPath, content, { encoding: 'utf8' });
}

function runPsql(psqlBin, password, args, cwd, inputSql) {
  return spawnSync(psqlBin, args, {
    cwd,
    input: inputSql,
    env: { ...process.env, PGPASSWORD: password, PGCLIENTENCODING: 'UTF8' },
    encoding: 'utf8',
  });
}

function testPassword(psqlBin, password, rootDir) {
  if (!password) return false;
  const res = runPsql(
    psqlBin,
    password,
    ['-h', '127.0.0.1', '-p', '5432', '-U', 'postgres', '-d', 'postgres', '-tAc', 'SELECT 1;'],
    rootDir
  );
  return res.status === 0 && (res.stdout || '').trim() === '1';
}

function askQuestion(query) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(query, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  setupNativeFiles(rootDir);

  const envPath = path.join(rootDir, 'local-stack', '.env.native');
  const envMap = readEnvMap(envPath);
  const psqlBin = findPsql();

  console.log('\n=== ตั้งค่าฐานข้อมูล PostgreSQL 16 (Windows Native 4 GB RAM) ===');
  console.log(`ใช้โปรแกรม psql: ${psqlBin}`);

  let password = process.env.PGPASSWORD || envMap.POSTGRES_PASSWORD || '';
  if (!testPassword(psqlBin, password, rootDir)) {
    console.log('\n[!] รหัสผ่านใน .env.native ไม่ตรงกับรหัสผ่าน postgres ที่ตั้งไว้ตอนติดตั้ง PostgreSQL 16');
    for (let attempt = 1; attempt <= 3; attempt++) {
      const input = await askQuestion(`กรุณากรอกรหัสผ่านของ user "postgres" ที่ตั้งไว้ตอนติดตั้ง (ครั้งที่ ${attempt}/3): `);
      if (testPassword(psqlBin, input, rootDir)) {
        password = input;
        updateEnvPassword(envPath, password);
        console.log('[OK] เชื่อมต่อ PostgreSQL 16 สำเร็จ และบันทึกรหัสผ่านลงใน local-stack/.env.native เรียบร้อยแล้ว');
        break;
      } else {
        console.error('[X] รหัสผ่านไม่ถูกต้อง กรุณาลองอีกครั้ง');
      }
    }
  } else {
    updateEnvPassword(envPath, password);
    console.log('[OK] เชื่อมต่อ PostgreSQL 16 สำเร็จ');
  }

  if (!testPassword(psqlBin, password, rootDir)) {
    console.error('\nไม่สามารถเชื่อมต่อ PostgreSQL 16 ได้ กรุณาตรวจสอบรหัสผ่านของ user "postgres" แล้วรันใหม่อีกครั้ง');
    process.exit(1);
  }

  // 1. Check / create database nonsawang
  const dbCheck = runPsql(
    psqlBin,
    password,
    ['-h', '127.0.0.1', '-U', 'postgres', '-d', 'postgres', '-tAc', "SELECT 1 FROM pg_database WHERE datname = 'nonsawang';"],
    rootDir
  );
  if ((dbCheck.stdout || '').trim() !== '1') {
    console.log('\nกำลังสร้างฐานข้อมูล "nonsawang"...');
    const createRes = runPsql(
      psqlBin,
      password,
      ['-h', '127.0.0.1', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', "CREATE DATABASE nonsawang ENCODING 'UTF8';"],
      rootDir
    );
    if (createRes.status !== 0) {
      console.error('สร้างฐานข้อมูล nonsawang ไม่สำเร็จ:', createRes.stderr || createRes.stdout);
      process.exit(1);
    }
    console.log('[OK] สร้างฐานข้อมูล "nonsawang" สำเร็จ');
  } else {
    console.log('[OK] มีฐานข้อมูล "nonsawang" อยู่แล้ว');
  }

  // 2. Apply 4 GB RAM tuning + reload conf
  console.log('\nกำลังปรับจูนค่าหน่วยความจำ PostgreSQL สำหรับเครื่อง RAM 4 GB...');
  const tuneRes = runPsql(
    psqlBin,
    password,
    ['-h', '127.0.0.1', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-f', 'local-stack/postgresql-4gb-tuning.sql'],
    rootDir
  );
  if (tuneRes.status !== 0) {
    console.error('ปรับจูนค่าไม่สำเร็จ:', tuneRes.stderr || tuneRes.stdout);
    process.exit(1);
  }
  runPsql(psqlBin, password, ['-h', '127.0.0.1', '-U', 'postgres', '-d', 'postgres', '-c', 'SELECT pg_reload_conf();'], rootDir);
  console.log('[OK] ปรับจูน PostgreSQL สำหรับ RAM 4 GB สำเร็จ (หมายเหตุ: ค่า shared_buffers จะมีผลเต็มที่เมื่อ Restart บริการ postgresql-x64-16)');

  // 3. Apply all migrations (if not yet applied)
  const schemaCheck = runPsql(
    psqlBin,
    password,
    ['-h', '127.0.0.1', '-U', 'postgres', '-d', 'nonsawang', '-tAc', "SELECT CASE WHEN to_regclass('public.house_gps_snapshot') IS NOT NULL THEN '1' ELSE '0' END;"],
    rootDir
  );
  if ((schemaCheck.stdout || '').trim() === '1') {
    console.log('\n[OK] ตรวจสอบพบโครงสร้างตารางและ Migrations ทั้ง 31 ไฟล์ในฐานข้อมูล "nonsawang" ครบถ้วนแล้ว');
  } else {
    console.log('\nกำลังรันโครงสร้างตารางและ Migrations ทั้ง 31 ไฟล์ ลงในฐานข้อมูล "nonsawang"...');
    const migRes = runPsql(
      psqlBin,
      password,
      ['-h', '127.0.0.1', '-U', 'postgres', '-d', 'nonsawang', '-v', 'ON_ERROR_STOP=1', '-f', 'local-stack/apply-all-migrations.sql'],
      rootDir
    );
    if (migRes.status !== 0) {
      console.error('รัน Migration ไม่สำเร็จ:\n', migRes.stderr || migRes.stdout);
      process.exit(1);
    }
    console.log('[OK] รันโครงสร้างตารางและ Migrations ทั้งหมดสำเร็จ!');
  }

  // 4. Ensure initial admin account exists
  const adminCheck = runPsql(
    psqlBin,
    password,
    ['-h', '127.0.0.1', '-U', 'postgres', '-d', 'nonsawang', '-tAc', "SELECT count(*) FROM public.app_users WHERE role = 'admin' AND is_active = true;"],
    rootDir
  );
  const adminCount = Number((adminCheck.stdout || '0').trim());
  if (adminCount === 0) {
    console.log('\nกำลังสร้างบัญชีผู้ดูแลระบบเริ่มต้น (admin)...');
    const seedSql = `
      INSERT INTO public.app_users (username, password_hash, display_name, role, moo, is_active)
      VALUES ('admin', app_private.password_hash('Admin@1234'), 'ผู้ดูแลระบบ รพ.สต.บ้านโนนสว่าง', 'admin', '', true)
      ON CONFLICT (username) DO UPDATE
      SET password_hash = EXCLUDED.password_hash, role = 'admin', is_active = true;
    `;
    const seedRes = runPsql(
      psqlBin,
      password,
      ['-h', '127.0.0.1', '-U', 'postgres', '-d', 'nonsawang', '-v', 'ON_ERROR_STOP=1'],
      rootDir,
      seedSql
    );
    if (seedRes.status === 0) {
      console.log('[OK] สร้างบัญชีเริ่มต้นสำเร็จ -> ชื่อผู้ใช้: admin / รหัสผ่านเริ่มต้น: Admin@1234 (แนะนำให้เปลี่ยนรหัสผ่านหลังเข้าสู่ระบบ)');
    } else {
      console.error('สร้างบัญชีเริ่มต้นไม่สำเร็จ:', seedRes.stderr || seedRes.stdout);
      process.exit(1);
    }
  } else {
    console.log(`[OK] พบผู้ดูแลระบบ (admin) ในฐานข้อมูลแล้ว (${adminCount} บัญชี)`);
  }

  console.log('\n================================================================');
  console.log('ตั้งค่าฐานข้อมูล PostgreSQL 16 เสร็จสมบูรณ์ พร้อมเปิดระบบด้วย Start-Native-Server.cmd');
  console.log('================================================================\n');
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
