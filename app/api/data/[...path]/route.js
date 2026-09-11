import { sameOrigin, getSessionToken, currentUser, databaseConfig, readBody, authResponse, authError } from '@/lib/server-auth';
export const dynamic = 'force-dynamic';
const tables = new Set(['population', 'vhv_data', 'app_users', 'activity_logs']);
const rpc = new Set(['screening_history_list','screening_overview','screening_review_list','screening_review_approve','screening_search', 'hosxp_review_list', 'hosxp_review_open_session', 'hosxp_review_approve', 'app_admin_save_user', 'app_change_password']);
async function handle(request, { params }) {
  const parts = params.path || [];
  const isRpc = parts.length === 2 && parts[0] === 'rpc' && rpc.has(parts[1]);
  if (!(parts.length === 1 && tables.has(parts[0])) && !isRpc) return authResponse({ message: 'NOT_FOUND' }, 404);
  if (request.headers.get('sec-fetch-site') === 'cross-site' || (!['GET', 'HEAD'].includes(request.method) && !sameOrigin(request))) return authResponse({ message: 'FORBIDDEN' }, 403);
  if (isRpc && request.method !== 'POST') return authResponse({ message: 'METHOD_NOT_ALLOWED' }, 405);
  try {
    const token = getSessionToken();
    const user = await currentUser(token);
    if (!user) return authResponse({ message: 'กรุณาเข้าสู่ระบบใหม่', code: 'AUTH_REQUIRED' }, 401);
    const { url, key } = databaseConfig();
    const headers = { apikey: key, Authorization: `Bearer ${key}`, 'x-app-session': token, 'Content-Type': 'application/json' };
    for (const name of ['accept', 'prefer', 'range', 'range-unit']) {
      if (request.headers.has(name)) headers[name] = request.headers.get(name);
    }
    if (request.method === 'PATCH' && parts[0] === 'population') {
      headers.prefer = `${(headers.prefer || '').split(',').filter(v => !v.trim().startsWith('return=')).join(',')},return=representation`;
    }
    let body;
    if (!['GET', 'HEAD'].includes(request.method)) {
      const payload = await readBody(request, 262144);
      // Accept requests from an older cached client while keeping the
      // database contract on the canonical screening column names.
      if (request.method === 'PATCH' && parts[0] === 'population' && payload && typeof payload === 'object' && !Array.isArray(payload)) {
        const aliases = { hep_result: 'hep_screen', fobt_result: 'fobt_screen', hpv_result: 'hpv_screen', child_dev_result: 'child_dev' };
        Object.entries(aliases).forEach(([legacy, canonical]) => {
          if (Object.prototype.hasOwnProperty.call(payload, legacy)) {
            if (!Object.prototype.hasOwnProperty.call(payload, canonical)) payload[canonical] = payload[legacy];
            delete payload[legacy];
          }
        });
      }
      body = JSON.stringify(payload);
    }
    const upstream = await fetch(`${url}/rest/v1/${parts.join('/')}${new URL(request.url).search}`, { method: request.method, headers, body, cache: 'no-store', signal: AbortSignal.timeout(30000) });
    if (request.method === 'PATCH' && parts[0] === 'population' && upstream.ok) {
      const changed = await upstream.json();
      if (Array.isArray(changed) && changed.length === 0) return authResponse({ message: 'ไม่พบรายการหรือไม่มีสิทธิ์แก้ไขข้อมูลนี้', code: 'NO_ROWS_UPDATED' }, 409);
      return authResponse(changed);
    }
    const outgoing = new Headers({ 'Cache-Control': 'no-store', 'Vary': 'Cookie' });
    for (const name of ['content-type', 'content-range', 'preference-applied']) {
      if (upstream.headers.has(name)) outgoing.set(name, upstream.headers.get(name));
    }
    return new Response(request.method === 'HEAD' || upstream.status === 204 ? null : await upstream.text(), { status: upstream.status, headers: outgoing });
  } catch (error) { return authError(error); }
}
export { handle as GET, handle as HEAD, handle as POST, handle as PATCH };
