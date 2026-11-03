// Generate matching HS256 JWT keys (anon + service_role) for a self-hosted
// Local PostgreSQL + PostgREST stack on the facility server.
const crypto = require('node:crypto');

function signJwt(payload, secret) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

if (require.main === module) {
  const jwtSecret = crypto.randomBytes(32).toString('hex');
  const dbPassword = crypto.randomBytes(18).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 10 * 365 * 24 * 60 * 60; // 10 years for local appliance

  const anonKey = signJwt({ role: 'anon', iss: 'nonsawang-local', iat: now, exp }, jwtSecret);
  const serviceKey = signJwt({ role: 'service_role', iss: 'nonsawang-local', iat: now, exp }, jwtSecret);

  console.log('# === 1. สำหรับไฟล์ local-stack/.env (Docker PostgreSQL + PostgREST) ===');
  console.log(`POSTGRES_PASSWORD=${dbPassword}`);
  console.log(`PGRST_JWT_SECRET=${jwtSecret}\n`);

  console.log('# === 2. สำหรับไฟล์ .env.local (เว็บเซิร์ฟเวอร์ Next.js + Local AI) ===');
  console.log(`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`);
  console.log(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey}`);
  console.log(`SUPABASE_SERVICE_ROLE_KEY=${serviceKey}`);
  console.log(`LOCAL_AI_URL=http://127.0.0.1:11434`);
  console.log(`LOCAL_AI_MODEL=qwen2.5:7b`);
  console.log(`ALLOW_HTTP_SESSION=true\n`);

  console.log('# === 3. สำหรับไฟล์ .env.sync (ตัวเชื่อม HOSxP เดิมบนเครื่องหน่วยบริการ) ===');
  console.log(`SUPABASE_URL=http://127.0.0.1:54321`);
  console.log(`SUPABASE_SERVICE_ROLE_KEY=${serviceKey}`);
}

module.exports = { signJwt };
