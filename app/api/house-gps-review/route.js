import { authResponse, currentUser, databaseConfig } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';
export async function GET(request) {
  try {
    const user = await currentUser();
    if (!user) return authResponse({}, 401);
    if (!['staff', 'admin'].includes(user.role)) return authResponse({}, 403);
    const page = Number(new URL(request.url).searchParams.get('page') || 1);
    if (!Number.isSafeInteger(page) || page < 1 || page > 1000000) return authResponse({}, 400);
    const { url, key } = databaseConfig(true);
    const query = new URLSearchParams({select:'id,moo,address,state,created_at',order:'created_at.desc,id.desc',limit:'26',offset:String((page-1)*25)});
    const result = await fetch(url+'/rest/v1/house_gps_queue?'+query, {headers:{apikey:key,Authorization:'Bearer '+key},cache:'no-store',signal:AbortSignal.timeout(15000)});
    if (!result.ok) return authResponse({}, 503);
    const rows = await result.json();
    return authResponse({rows:rows.slice(0,25),more:rows.length>25});
  } catch { return authResponse({}, 503); }
}
