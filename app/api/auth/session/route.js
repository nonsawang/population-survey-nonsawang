import { currentUser, authResponse, authError, COOKIE_NAME, sessionOptions } from '@/lib/server-auth';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const user = await currentUser();
    const response = authResponse({ user });
    if (!user) response.cookies.set(COOKIE_NAME, '', { ...sessionOptions, maxAge: 0 });
    return response;
  } catch (error) { return authError(error); }
}
