import { sameOrigin, getSessionToken, dbRpc, authResponse, authError, COOKIE_NAME, sessionOptions } from '@/lib/server-auth';
export const dynamic = 'force-dynamic';
export async function POST(request) {
  if (!sameOrigin(request)) return authResponse({ error: 'FORBIDDEN' }, 403);
  try {
    const token = getSessionToken();
    if (token) await dbRpc('app_logout', {}, { token });
    const response = authResponse({ success: true });
    response.cookies.set(COOKIE_NAME, '', { ...sessionOptions, maxAge: 0 });
    return response;
  } catch (error) { return authError(error); }
}
