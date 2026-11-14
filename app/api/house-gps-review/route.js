import { authResponse, currentUser, databaseConfig, getSessionToken, sameOrigin, readBody, isReadOnly, readOnlyResponse } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';
export async function GET(request) {
  try {
    const user = await currentUser();
    if (!user) return authResponse({}, 401);
    if (!['staff', 'admin'].includes(user.role)) return authResponse({}, 403);
    const page = Number(new URL(request.url).searchParams.get('page') || 1);
    if (!Number.isSafeInteger(page) || page < 1 || page > 1000000) return authResponse({}, 400);
    const { url, key } = databaseConfig(true);
    const query = new URLSearchParams({select:'id,moo,address,state,created_at,latitude,longitude,old_latitude,old_longitude,actor,replaces_id,revision_reason,reference_captured_at,approved_by,approved_at',order:'created_at.desc,id.desc',limit:'26',offset:String((page-1)*25)});
    const load = () => fetch(url+'/rest/v1/house_gps_queue?'+query, {headers:{apikey:key,Authorization:'Bearer '+key},cache:'no-store',signal:AbortSignal.timeout(15000)});
    let result = await load();
    let revisionAvailable = true;
    if (!result.ok) {
      const detail = await result.clone().json().catch(() => ({}));
      if (['42703','PGRST204'].includes(detail.code) && /replaces_id|revision_reason|reference_captured_at/.test(detail.message || '')) {
        revisionAvailable = false;
        query.set('select','id,moo,address,state,created_at,latitude,longitude,old_latitude,old_longitude,actor');
        result = await load();
      }
    }
    if (!result.ok) return authResponse({}, 503);
    const rows = await result.json();
    return authResponse({rows:rows.slice(0,25),more:rows.length>25,revisionAvailable});
  } catch { return authResponse({}, 503); }
}

export async function POST(request) {
  try {
    if (!sameOrigin(request)) return authResponse({}, 403);
    const user = await currentUser();
    if (!user) return authResponse({}, 401);
    if (!['staff', 'admin'].includes(user.role)) return authResponse({}, 403);
    const body = await readBody(request);
    if (!['prepare', 'revise', 'approve', 'preview_batch', 'approve_batch'].includes(body.action)) return authResponse({}, 400);
    if (!['prepare','preview_batch'].includes(body.action) && isReadOnly()) return readOnlyResponse();
    const batch = ['preview_batch','approve_batch'].includes(body.action);
    if (batch && (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 25)) return authResponse({},400);
    const rpc = batch ? 'house_gps_batch_review' : body.action === 'approve' ? 'house_gps_approve' : body.action === 'prepare' ? 'house_gps_revision_context' : 'house_gps_revise';
    const args = batch ? {p_items:body.items,p_approve:body.action==='approve_batch'} : body.action === 'approve' ? {p_id:body.id,p_lat:body.latitude,p_lng:body.longitude} : body.action === 'prepare' ? { p_id: body.oldId } : {
      p_old_id: body.oldId, p_id: body.id, p_batch_id: body.batchId,
      p_expected_state: body.expectedState, p_lat: body.latitude,
      p_lng: body.longitude, p_reason: body.reason,
    };
    const { url, key } = databaseConfig();
    const response = await fetch(url + '/rest/v1/rpc/' + rpc, {
      method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(15000),
      headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', 'x-app-session': await getSessionToken() },
      body: JSON.stringify(args),
    });
    const result = await response.json();
    if (!response.ok) {
      const messages = {
        GPS_SNAPSHOT_REQUIRED: 'ต้องอ่านข้อมูลอ้างอิงบ้านจากเครื่อง LAN ใหม่ก่อน',
        GPS_SNAPSHOT_AFTER_RESULT_REQUIRED: 'ต้องอ่านข้อมูลบ้านจาก HOSxP ใหม่หลังผลส่งครั้งล่าสุด แล้วเปิดแก้ไขอีกครั้ง',
        GPS_REFERENCE_CHANGED: 'ข้อมูลอ้างอิงเปลี่ยนแล้ว กรุณาปิดและเปิดแก้ไขใหม่เพื่อตรวจค่าอีกครั้ง',
        REVISION_STATE_CHANGED: 'สถานะคิวเปลี่ยนหรือกำลังส่ง ต้องตรวจผลกับหลักฐาน HOSxP ก่อนแก้ไข',
        ALREADY_REPLACED: 'รายการนี้มีคิวแก้ไขแล้ว กรุณาเปิดรายการล่าสุด',
        HOUSE_CHANGED: 'ข้อมูลบ้านไม่ตรงกับ HOSxP ต้องตรวจสอบก่อน',
        HOUSE_NOT_UNIQUE: 'ไม่พบบ้านที่ตรงกันเพียงหลังเดียว',
        INVALID_REVISION: 'ตรวจพิกัดและระบุเหตุผล 3–500 ตัวอักษร',
      };
      return authResponse({ error: messages[result.message] || 'ดำเนินการไม่ได้ กรุณาโหลดคิวใหม่และตรวจการติดตั้ง migration' }, 409);
    }
    return authResponse(result);
  } catch { return authResponse({ error: 'ติดต่อระบบไม่ได้ กรุณาตรวจคิวก่อนลองใหม่' }, 503); }
}
