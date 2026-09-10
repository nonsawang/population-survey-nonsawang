import { sameOrigin, readBody, verifiedLineProfile, openSession, authResponse, authError } from '@/lib/server-auth';
export const dynamic = 'force-dynamic';
export async function POST(request) {
  if (!sameOrigin(request)) return authResponse({ error: 'FORBIDDEN' }, 403);
  try {
    const body = await readBody(request);
    const profile = await verifiedLineProfile(body.accessToken);
    return await openSession('app_auth_line', { p_line_id: profile.userId, p_avatar: profile.pictureUrl || null });
  } catch (error) { return authError(error); }
}
