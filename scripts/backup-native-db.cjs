// Backup local PostgreSQL database to SATA HDD (D:\ or E:\) automatically,
// keeping the latest 30 backups so disk space never fills up.

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { resolveConfig } = require('./native-local-gateway.cjs');

function findPgDump() {
  const candidates = [
    'C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe',
    'C:\\Program Files\\PostgreSQL\\16\\bin\\pg_dump.exe',
    'C:\\Program Files\\PostgreSQL\\15\\bin\\pg_dump.exe',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'pg_dump.exe';
}

function resolveBackupDir(rootDir) {
  if (fs.existsSync('D:\\')) return 'D:\\Nonsawang-DB-Backups';
  if (fs.existsSync('E:\\')) return 'E:\\Nonsawang-DB-Backups';
  return path.join(rootDir, 'lan-runtime', 'backups');
}

function pruneOldBackups(dir, keepCount = 30) {
  if (!fs.existsSync(dir)) return;
  const files = fs
    .readdirSync(dir)
    .filter(f => f.startsWith('nonsawang-') && f.endsWith('.backup'))
    .map(f => ({ name: f, full: path.join(dir, f), mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  for (const old of files.slice(keepCount)) {
    try {
      fs.unlinkSync(old.full);
    } catch {}
  }
}

if (require.main === module) {
  const rootDir = path.resolve(__dirname, '..');
  const cfg = resolveConfig(rootDir);
  const backupDir = resolveBackupDir(rootDir);
  fs.mkdirSync(backupDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outFile = path.join(backupDir, `nonsawang-${stamp}.backup`);
  const pgDump = findPgDump();

  console.log(`[Backup] กำลังสำรองฐานข้อมูล ${cfg.pgDatabase} ไปยัง ${outFile} ...`);
  const res = spawnSync(
    pgDump,
    ['-h', cfg.pgHost, '-p', String(cfg.pgPort), '-U', cfg.pgUser, '-F', 'c', '-f', outFile, cfg.pgDatabase],
    {
      env: { ...process.env, PGPASSWORD: cfg.pgPassword },
      stdio: 'inherit',
    }
  );

  if (res.status !== 0) {
    console.error('[Backup] สำรองข้อมูลไม่สำเร็จ กรุณาตรวจสอบว่าติดตั้ง PostgreSQL และตั้งรหัสผ่านใน local-stack/.env.native ตรงกัน');
    process.exit(1);
  }

  pruneOldBackups(backupDir, 30);
  console.log(`[Backup] สำเร็จ! เก็บไฟล์ไว้ที่ ${outFile} (เก็บย้อนหลัง 30 ชุดล่าสุดอัตโนมัติ)`);
}
