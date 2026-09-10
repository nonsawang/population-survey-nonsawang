import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const COOKIE_NAME = 'population_session';
export const sessionOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 8 * 60 * 60 };
export function authResponse(body, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', 'Vary': 'Cookie' } });
}
export function sameOrigin(request) {
  return request.headers.get('origin') === new URL(request.url).origin && request.headers.get('sec-fetch-site') !== 'cross-site';
}
export async function readBody(request, limit = 16384) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('INVALID_BODY');
  if (Number(request.headers.get('content-length') || 0) > limit) throw new Error('INVALID_BODY');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('INVALID_BODY');
  let total = 0; const chunks = [];
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    total += value.byteLength;
    if (total > limit) { await reader.cancel(); throw new Error('INVALID_BODY'); }
    chunks.push(Buffer.from(value));
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export function getSessionToken() {
  const token = cookies().get(COOKIE_NAME)?.value || '';
  return /^[a-f0-9]{64}$/.test(token) ? token : '';
}
export function databaseConfig(privileged = false) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = privileged ? process.env.SUPABASE_SERVICE_ROLE_KEY : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('AUTH_NOT_CONFIGURED');
  return { url, key };
}
export async function dbRpc(name, body, { privileged = false, token = '' } = {}) {
  const { url, key } = databaseConfig(privileged);
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(15000),
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(token ? { 'x-app-session': token } : {}) },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error('AUTH_SERVICE_UNAVAILABLE');
  return response.json();
}
export async function currentUser(token = getSessionToken()) {
  return token ? dbRpc('app_current_user', {}, { token }) : null;
}
export async function verifiedLineProfile(accessToken) {
  const channel = process.env.LINE_LOGIN_CHANNEL_ID || process.env.NEXT_PUBLIC_LINE_CLIENT_ID;
  if (!channel) throw new Error('AUTH_NOT_CONFIGURED');
  if (typeof accessToken !== 'string' || !accessToken || accessToken.length > 4096) throw new Error('INVALID_LINE');
  const verified = await fetch(`https://api.line.me/oauth2/v2.1/verify?access_token=${encodeURIComponent(accessToken)}`, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
  if (!verified.ok) throw new Error('INVALID_LINE');
  const claims = await verified.json();
  if (String(claims.client_id) !== String(channel) || !(Number(claims.expires_in) > 0)) throw new Error('INVALID_LINE');
  const response = await fetch('https://api.line.me/v2/profile', { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('INVALID_LINE');
  const profile = await response.json();
  if (typeof profile.userId !== 'string' || !profile.userId) throw new Error('INVALID_LINE');
  return profile;
}
export async function openSession(rpc, args) {
  const token = randomBytes(32).toString('hex');
  const result = await dbRpc(rpc, { ...args, p_token_hash: createHash('sha256').update(token).digest('hex') }, { privileged: true });
  if (result.error) {
    const messages = { NOT_LINKED: 'กรุณาผูกบัญชีด้วยเลขบัตรหรือรหัสผ่าน', LINE_ALREADY_LINKED: 'บัญชีนี้ผูกกับ LINE อื่นแล้ว กรุณาติดต่อเจ้าหน้าที่', RATE_LIMITED: 'ลองเข้าสู่ระบบหลายครั้ง กรุณารอ 15 นาที' };
    return authResponse({ success: false, status: result.error, error: messages[result.error] || 'บัญชีหรือรหัสผ่านไม่ถูกต้อง หรือบัญชีถูกระงับ' }, result.error === 'RATE_LIMITED' ? 429 : 401);
  }
  if (!result.user?.userId) throw new Error('AUTH_SERVICE_UNAVAILABLE');
  const response = authResponse({ success: true, user: result.user });
  response.cookies.set(COOKIE_NAME, token, sessionOptions);
  return response;
}
export function authError(error) {
  const invalid = ['INVALID_BODY', 'INVALID_LINE'].includes(error.message) || error instanceof SyntaxError;
  return authResponse({ success: false, error: invalid ? 'ข้อมูลเข้าสู่ระบบไม่ถูกต้อง กรุณาลองใหม่' : 'ระบบยืนยันตัวตนยังไม่พร้อม กรุณาติดต่อผู้ดูแล' }, invalid ? 400 : 503);
}
