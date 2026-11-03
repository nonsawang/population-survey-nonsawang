import { sameOrigin, getSessionToken, currentUser, readBody, authResponse } from '@/lib/server-auth';
import { probeLocalAi, askLocalAi } from '@/lib/local-ai.mjs';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const token = await getSessionToken();
    const user = await currentUser(token);
    if (!user) return authResponse({ message: 'กรุณาเข้าสู่ระบบใหม่', code: 'AUTH_REQUIRED' }, 401);
    const status = await probeLocalAi();
    return authResponse({
      ok: true,
      online: status.online,
      provider: status.provider,
      model: status.activeModel || status.model,
      models: status.models || [],
    });
  } catch {
    return authResponse({ ok: false, online: false, error: 'ไม่สามารถตรวจสอบสถานะ Local AI ได้' }, 503);
  }
}

export async function POST(request) {
  if (request.headers.get('sec-fetch-site') === 'cross-site' || !sameOrigin(request)) {
    return authResponse({ message: 'FORBIDDEN' }, 403);
  }
  try {
    const token = await getSessionToken();
    const user = await currentUser(token);
    if (!user) return authResponse({ message: 'กรุณาเข้าสู่ระบบใหม่', code: 'AUTH_REQUIRED' }, 401);

    const payload = await readBody(request, 262144);
    const result = await askLocalAi({
      prompt: payload?.prompt || '',
      focus: payload?.focus || 'overview',
      dashboard: payload?.dashboard || null,
      tracking: payload?.tracking || null,
    });
    return authResponse(result);
  } catch {
    return authResponse({ ok: false, error: 'ไม่สามารถประมวลผลคำขอ Local AI ได้' }, 400);
  }
}
