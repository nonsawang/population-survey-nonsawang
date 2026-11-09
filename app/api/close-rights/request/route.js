import {sameOrigin,isReadOnly,authResponse,readBody,getSessionToken,databaseConfig} from '@/lib/server-auth';
export const runtime='nodejs';

const ERROR_MESSAGES={
 CLOSE_PERMISSION_REQUIRED:'บัญชีนี้ยังไม่ได้รับสิทธิ์ปิดสิทธิ์ กรุณาติดต่อผู้ดูแลระบบ',
 MANUAL_APPROVAL_REQUIRED:'กรุณาติ๊กยืนยันการตรวจสอบข้อมูลก่อนกดปิดสิทธิ์',
 CARD_IDENTITY_MISMATCH:'เลขบัตรประชาชนที่อ่านได้ไม่ตรงกับข้อมูลในฐานข้อมูล',
 CURRENT_DAY_FIT_REQUIRED:'ต้องมีผลตรวจ FIT (ปกติ/ผิดปกติ) ที่บันทึกในวันนี้ก่อนปิดสิทธิ์',
 FIT_APPROVAL_REQUIRED:'รายการนี้ยังไม่ได้อนุมัติผลคัดกรอง กรุณากดอนุมัติผลก่อน',
 FIT_PREPARATION_REQUIRED:'รายการนี้ยังไม่ได้เตรียมข้อมูลส่ง HOSxP กรุณากดเตรียมรายการก่อน',
 FIT_VISIT_REQUIRED:'ยังไม่มีเลข VN จาก HOSxP (รอตัวเชื่อม LAN นำเข้า Visit ก่อนกดปิดสิทธิ์)',
 FIT_INTENT_CHANGED:'ข้อมูลรายการเปลี่ยนแปลงจากที่เคยขอปิดสิทธิ์ไว้ กรุณาตรวจสอบรายการ',
};

export async function POST(request){
 if(!sameOrigin(request)||isReadOnly())return authResponse({error:'ไม่อนุญาตให้ส่งรายการ'},403);
 // Deployment flag is not permission to transmit: only records staff intent.
 if(process.env.NHSO_CLOSE_MANUAL_QUEUE_ENABLED!=='true')return authResponse({error:'ระบบรับคำสั่งปิดสิทธิ์ยังไม่เปิดใช้งาน'},503);
 let body;
 try{body=await readBody(request,2048);}catch{return authResponse({error:'รูปแบบข้อมูลไม่ถูกต้อง'},400);}
 if(typeof body?.personId!=='string'||body.personId.length>100||typeof body.cardCid!=='string'||!/^\d{13}$/.test(body.cardCid)||!['ปกติ','ผิดปกติ'].includes(body.result)||body.confirm!==true)return authResponse({error:'กรุณาอ่านบัตรและตรวจรายการก่อนยืนยัน'},400);
 const token=await getSessionToken();if(!token)return authResponse({error:'กรุณาเข้าสู่ระบบ'},401);
 try{
  const {url,key}=databaseConfig(false);
  const res=await fetch(`${url}/rest/v1/rpc/fit_close_request`,{
   method:'POST',
   cache:'no-store',
   signal:AbortSignal.timeout(15000),
   headers:{
    apikey:key,
    Authorization:`Bearer ${key}`,
    'Content-Type':'application/json',
    'x-app-session':token,
   },
   body:JSON.stringify({p_person:body.personId,p_card_cid:body.cardCid,p_result:body.result,p_confirm:true}),
  });
  const payload=await res.json().catch(()=>({}));
  if(!res.ok){
   const rawMsg=String(payload?.message||payload?.error||'');
   const matchedKey=Object.keys(ERROR_MESSAGES).find(k=>rawMsg.includes(k));
   return authResponse({
    error:matchedKey?ERROR_MESSAGES[matchedKey]:'รับคำสั่งไม่สำเร็จ กรุณาตรวจสิทธิ์บัญชี ผล FIT ของวันนี้ และสถานะนำเข้า visit',
    code:matchedKey||'REQUEST_FAILED',
   },409);
  }
  return authResponse({
   id:payload.id,
   state:payload.state,
   sent:false,
   message:'รับคำสั่งเข้าคิวปิดสิทธิ์เรียบร้อยแล้ว ตัวเชื่อม LAN จะตรวจสอบ Visit และส่งปิดสิทธิ์ไปยัง สปสช.',
  },202);
 }catch{
  return authResponse({error:'รับคำสั่งไม่สำเร็จ กรุณาตรวจการเชื่อมต่อแล้วลองใหม่'},503);
 }
}
