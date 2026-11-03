// Ultra-lightweight Windows Native Gateway (~18 MB RAM, zero Docker, zero Nginx).
// Spawns postgrest.exe on 127.0.0.1:54320 and proxies /rest/v1/* on 127.0.0.1:54321
// so both Next.js and all HOSxP LAN connector scripts work identically to Supabase.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

function loadEnvFile(filePath, target = {}) {
  if (!fs.existsSync(filePath)) return target;
  const content = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || target[match[1]] !== undefined) continue;
    let val = match[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    target[match[1]] = val;
  }
  return target;
}

function resolveConfig(rootDir) {
  const cfg = { ...process.env };
  loadEnvFile(path.join(rootDir, 'local-stack', '.env.native'), cfg);
  loadEnvFile(path.join(rootDir, '.env.local'), cfg);
  return {
    pgHost: cfg.PG_HOST || '127.0.0.1',
    pgPort: Number(cfg.PG_PORT || 5432),
    pgDatabase: cfg.PG_DATABASE || 'nonsawang',
    pgUser: cfg.PG_USER || 'postgres',
    pgPassword: cfg.POSTGRES_PASSWORD || '',
    jwtSecret: cfg.PGRST_JWT_SECRET || '',
    gatewayHost: '127.0.0.1',
    gatewayPort: Number(cfg.LOCAL_GATEWAY_PORT || 54321),
    postgrestPort: Number(cfg.LOCAL_POSTGREST_PORT || 54320),
  };
}

function writePostgrestConf(runtimeDir, cfg) {
  fs.mkdirSync(runtimeDir, { recursive: true });
  const confPath = path.join(runtimeDir, 'postgrest-native.conf');
  const encodedPass = encodeURIComponent(cfg.pgPassword);
  const lines = [
    `db-uri = "postgres://${cfg.pgUser}:${encodedPass}@${cfg.pgHost}:${cfg.pgPort}/${cfg.pgDatabase}"`,
    `db-schemas = "public"`,
    `db-anon-role = "anon"`,
    `db-pool = 10`,
    `db-max-rows = 1000`,
    `server-host = "127.0.0.1"`,
    `server-port = ${cfg.postgrestPort}`,
    `jwt-secret = "${cfg.jwtSecret.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`,
  ];
  fs.writeFileSync(confPath, lines.join('\r\n') + '\r\n', { encoding: 'utf8' });
  return confPath;
}

function buildPostgrestEnv() {
  const pgDirs = [
    'C:\\Program Files\\PostgreSQL\\16\\bin',
    'C:\\Program Files\\PostgreSQL\\17\\bin',
    'C:\\Program Files\\PostgreSQL\\15\\bin',
  ].filter(d => fs.existsSync(d));
  const pathKey = Object.keys(process.env).find(k => k.toUpperCase() === 'PATH') || 'PATH';
  const currentPath = process.env[pathKey] || '';
  return {
    ...process.env,
    [pathKey]: [...pgDirs, currentPath].filter(Boolean).join(';'),
  };
}

function findPostgrestBinary(rootDir) {
  const candidates = [
    path.join(rootDir, 'local-stack', 'postgrest.exe'),
    path.join(rootDir, 'postgrest.exe'),
    'C:\\Program Files\\PostgREST\\postgrest.exe',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'postgrest.exe';
}

function createRestGatewayServer({ postgrestPort, getPostgrestStatus }) {
  return http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, postgrest: getPostgrestStatus() }));
      return;
    }

    if (!req.url || !req.url.startsWith('/rest/v1/')) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'NOT_FOUND' }));
      return;
    }

    const upstreamPath = '/' + req.url.slice('/rest/v1/'.length);
    const proxyReq = http.request(
      {
        hostname: '127.0.0.1',
        port: postgrestPort,
        path: upstreamPath,
        method: req.method,
        headers: { ...req.headers, host: `127.0.0.1:${postgrestPort}` },
        timeout: 30000,
      },
      proxyRes => {
        res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
        proxyRes.pipe(res);
      }
    );

    proxyReq.on('error', () => {
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
      }
      res.end(JSON.stringify({ message: 'POSTGREST_UNAVAILABLE' }));
    });

    req.pipe(proxyReq);
  });
}

if (require.main === module) {
  const rootDir = path.resolve(__dirname, '..');
  const runtimeDir = path.join(rootDir, 'lan-runtime');
  const cfg = resolveConfig(rootDir);

  if (!cfg.jwtSecret || !cfg.pgPassword) {
    console.error('Missing PGRST_JWT_SECRET or POSTGRES_PASSWORD. Run Setup-Native-4GB.cmd first.');
    process.exit(1);
  }

  const confPath = writePostgrestConf(runtimeDir, cfg);
  const bin = findPostgrestBinary(rootDir);
  let child = null;
  let stopping = false;
  let pgStatus = 'starting';

  function startPostgrest() {
    if (stopping) return;
    child = spawn(bin, [confPath], {
      cwd: rootDir,
      env: buildPostgrestEnv(),
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    pgStatus = 'running';
    child.on('error', err => {
      pgStatus = `error: ${err.code || err.message}`;
      console.error(`[PostgREST] Could not start ${bin}: ${err.message}`);
    });
    child.on('exit', code => {
      pgStatus = `exited (${code})`;
      if (!stopping) setTimeout(startPostgrest, 3000);
    });
  }

  startPostgrest();

  const server = createRestGatewayServer({
    postgrestPort: cfg.postgrestPort,
    getPostgrestStatus: () => pgStatus,
  });

  server.listen(cfg.gatewayPort, cfg.gatewayHost, () => {
    fs.writeFileSync(path.join(runtimeDir, 'native-gateway.pid'), String(process.pid));
    console.log(`[Native Gateway] Listening on http://${cfg.gatewayHost}:${cfg.gatewayPort}/rest/v1/ -> PostgREST :${cfg.postgrestPort}`);
  });

  const shutdown = () => {
    stopping = true;
    if (child) child.kill();
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = { createRestGatewayServer, resolveConfig, writePostgrestConf };
