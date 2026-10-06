// Separate names-only cycle; never invokes the FIT writer.
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const runtime = path.join(root, 'lan-runtime');
function cycle() {
  const config = JSON.parse(fs.readFileSync(path.join(runtime, 'registry-auto.json'), 'utf8').replace(/^\uFEFF/, ''));
  if (!config.enabled) return;
  const startedAt = new Date().toISOString();
  const result = spawnSync(process.execPath, [path.join(__dirname, 'hosxp-registry-sync.cjs'), '--apply',...(config.registrationChecks===true?['--registrations']:[])], {
    cwd: root, windowsHide: true, timeout: 1200000, encoding: 'utf8',
    env: {...process.env, NODE_PATH: config.nodePath}, maxBuffer: 1048576,
  });
  let status = {startedAt, finishedAt: new Date().toISOString(), ok: false};
  if (result.status === 0) {
    try {
      const summary = JSON.parse(result.stdout.trim());
      if (![summary.checked, summary.updated, summary.blocked].every(Number.isInteger)) throw Error();
      status = {...status, ok: true, checked: summary.checked, updated: summary.updated, blocked: summary.blocked};
    } catch { status.error = 'REGISTRY_INVALID_SUMMARY'; }
  } else status.error = result.error?.code === 'ETIMEDOUT' ? 'REGISTRY_TIMEOUT' : 'REGISTRY_SYNC_FAILED';
  // Never persist raw stdout/stderr: only aggregate counts and fixed error codes.
  const log = path.join(runtime, 'registry-auto.log');
  if (fs.existsSync(log) && fs.statSync(log).size > 1048576) fs.renameSync(log, log + '.previous');
  fs.appendFileSync(log, JSON.stringify(status) + '\n');
  fs.writeFileSync(path.join(runtime, 'registry-status.json'), JSON.stringify(status, null, 2));
  if (!status.ok) process.exitCode = 1;
}
try { cycle(); } catch { console.error('REGISTRY_AUTO_FAILED'); process.exitCode = 1; }
