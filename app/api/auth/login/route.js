import { sameOrigin, readBody, verifiedLineProfile, openSession, authResponse, authError } from '@/lib/server-auth';
export const dynamic = 'force-dynamic';
export async function POST(request) {
  if (!sameOrigin(request)) return authResponse({ error: 'FORBIDDEN' }, 403);
  try {
    const body = await readBody(request);
    if (typeof body.username !== 'string' || typeof body.password !== 'string' || body.username.length > 150 || body.password.length > 1024) throw new Error('INVALID_BODY');
    const profile = body.lineAccessToken ? await verifiedLineProfile(body.lineAccessToken) : null;
    return await openSession('app_auth_password', { p_username: body.username, p_password: body.password, p_line_id: profile?.userId || null, p_avatar: profile?.pictureUrl || null });
  } catch (error) { return authError(error); }
}
