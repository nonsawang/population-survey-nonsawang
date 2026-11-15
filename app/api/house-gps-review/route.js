import { authResponse, currentUser, databaseConfig, getSessionToken, sameOrigin, readBody, isReadOnly, readOnlyResponse } from '@/lib/server-auth';
import { VALID_MOOS } from '@/lib/utils';
export const dynamic = 'force-dynamic';
const statuses=['all','awaiting','approved','sent','conflict','other'];
function applyFilters(q,{moo,status,search,actors=[]}) {
 if(moo)q.set('moo','eq.'+moo);
 const parts=[];
 if(search){const clean=search.replace(/[^\p{L}\p{N}\s/.-]/gu,'').trim();if(clean)parts.push('or(address.ilike.*'+clean+'*,actor.ilike.*'+clean+'*'+(actors.length?',actor.in.('+actors.join(',')+')':'')+')');}
 if(status==='awaiting'){q.set('state','eq.pending');q.set('approved_at','is.null');}
 if(status==='approved')parts.push('or(and(state.eq.pending,approved_at.not.is.null),state.eq.processing)');
 if(status==='sent'||status==='conflict')q.set('state','eq.'+status);
 if(status==='other')q.set('state','in.(superseded,cancelled)');
 if(parts.length)q.set('and','('+parts.join(',')+')');
}
export async function GET(request){try{
 const user=await currentUser();if(!user)return authResponse({},401);if(!['staff','admin'].includes(user.role))return authResponse({},403);
 const params=new URL(request.url).searchParams,page=Number(params.get('page')||1),moo=(params.get('moo')||'').trim(),status=params.get('status')||'all',search=(params.get('search')||'').trim().slice(0,60);
 if(!Number.isSafeInteger(page)||page<1||page>1000000||(moo&&!VALID_MOOS.includes(moo))||!statuses.includes(status))return authResponse({},400);
 const {url,key}=databaseConfig(true),headers={apikey:key,Authorization:'Bearer '+key};
 const get=async(table,q,extra={})=>fetch(url+'/rest/v1/'+table+'?'+q,{headers,...extra,cache:'no-store',signal:AbortSignal.timeout(15000)});
 // Read only public profile fields; paginate rather than silently truncate names.
 const profiles=[];for(let offset=0;;offset+=500){const r=await get('app_users',new URLSearchParams({select:'id,display_name',order:'id',limit:'500',offset:String(offset)}));if(!r.ok)throw Error();const part=await r.json();profiles.push(...part);if(part.length<500)break;}
 const names=new Map(profiles.map(p=>[String(p.id),p.display_name]));
 const actors=profiles.filter(p=>(p.display_name||'').toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(p=>String(p.id)).filter(id=>/^[a-zA-Z0-9-]+$/.test(id));
 const filters={moo,search,actors};
 const q=new URLSearchParams({select:'id,moo,address,state,created_at,latitude,longitude,old_latitude,old_longitude,actor,replaces_id,revision_reason,reference_captured_at,approved_by,approved_at',order:'created_at.desc,id.desc',limit:'26',offset:String((page-1)*25)});applyFilters(q,{...filters,status});
 const r=await get('house_gps_queue',q);if(!r.ok)throw Error();const rows=await r.json();
 let counts=null;try{const pairs=await Promise.all(statuses.map(async status=>{const c=new URLSearchParams({select:'id'});applyFilters(c,{...filters,status});const r=await get('house_gps_queue',c,{method:'HEAD',headers:{...headers,Prefer:'count=exact'}});const total=r.headers.get('content-range')?.split('/')[1];if(!r.ok||!/^\d+$/.test(total||''))throw Error();return [status,Number(total)];}));counts=Object.fromEntries(pairs);}catch{}
 return authResponse({rows:rows.slice(0,25).map(r=>({...r,actor_name:names.get(r.actor)||r.actor})),more:rows.length>25,revisionAvailable:true,counts,countsError:counts===null});
}catch{return authResponse({},503);}}
export async function POST(request) {
  try {
    if (!sameOrigin(request)) return authResponse({}, 403);
    const user = await currentUser();
    if (!user) return authResponse({}, 401);
    if (!['staff', 'admin'].includes(user.role)) return authResponse({}, 403);
    const body = await readBody(request);
    if (!['prepare', 'revise', 'approve', 'preview_batch', 'approve_batch'].includes(body.action)) return authResponse({}, 400);
    if (!['prepare', 'preview_batch'].includes(body.action) && isReadOnly()) return readOnlyResponse();
    const single = body.action === 'approve';
    if(single){if(!body.batchId)return authResponse({error:'กรุณาตรวจข้อมูลอ้างอิงใหม่ก่อนอนุมัติ'},409);body.items=[{id:body.id,latitude:body.latitude,longitude:body.longitude,batchId:body.batchId}];}
    const batch = single || ['preview_batch', 'approve_batch'].includes(body.action);
    if (batch && (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 25)) return authResponse({}, 400);
    const rpc = batch
      ? 'house_gps_batch_review'
      : body.action === 'approve'
      ? 'house_gps_approve'
      : body.action === 'prepare'
      ? 'house_gps_revision_context'
      : 'house_gps_revise';
    const args = batch
      ? { p_items: body.items, p_approve: single || body.action === 'approve_batch' }
      : body.action === 'approve'
      ? { p_id: body.id, p_lat: body.latitude, p_lng: body.longitude }
      : body.action === 'prepare'
      ? { p_id: body.oldId }
      : {
          p_old_id: body.oldId,
          p_id: body.id,
          p_batch_id: body.batchId,
          p_expected_state: body.expectedState,
          p_lat: body.latitude,
          p_lng: body.longitude,
          p_reason: body.reason,
        };
    const { url, key } = databaseConfig();
    const response = await fetch(url + '/rest/v1/rpc/' + rpc, {
      method: 'POST',
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
      headers: {
        apikey: key,
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
        'x-app-session': await getSessionToken(),
      },
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
      return authResponse(
        { error: messages[result.message] || 'ดำเนินการไม่ได้ กรุณาโหลดคิวใหม่และตรวจการติดตั้ง migration' },
        409
      );
    }
    if(single && result.rows?.[0]?.status!=='approved')return authResponse({error:'ข้อมูลไม่ผ่านการตรวจ กรุณาโหลดรายการใหม่'},409);
    return authResponse(result);
  } catch {
    return authResponse({ error: 'ติดต่อระบบไม่ได้ กรุณาตรวจคิวก่อนลองใหม่' }, 503);
  }
}
