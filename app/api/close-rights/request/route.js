import {sameOrigin,isReadOnly,authResponse,readBody,dbRpc,getSessionToken} from '@/lib/server-auth';
export const runtime='nodejs';
export async function POST(request){
 if(!sameOrigin(request)||isReadOnly())return authResponse({error:'ไม่อนุญาตให้ส่งรายการ'},403);
 // Deployment flag is not permission to transmit: only records staff intent.
 if(process.env.NHSO_CLOSE_MANUAL_QUEUE_ENABLED!=='true')return authResponse({error:'ระบบรับคำสั่งปิดสิทธิ์ยังไม่เปิดใช้งาน'},503);
 let body;
 try{body=await readBody(request,2048);}catch{return authResponse({error:'รูปแบบข้อมูลไม่ถูกต้อง'},400);}
 if(typeof body?.personId!=='string'||body.personId.length>100||typeof body.cardCid!=='string'||!/^\d{13}$/.test(body.cardCid)||!['ปกติ','ผิดปกติ'].includes(body.result)||body.confirm!==true)return authResponse({error:'กรุณาอ่านบัตรและตรวจรายการก่อนยืนยัน'},400);
 const token=await getSessionToken();if(!token)return authResponse({error:'กรุณาเข้าสู่ระบบ'},401);
 try{
  const data=await dbRpc('fit_close_request',{p_person:body.personId,p_card_cid:body.cardCid,p_result:body.result,p_confirm:true},{token});
  return authResponse({id:data.id,state:data.state,sent:false,message:'รับคำสั่งตรวจรายการแล้ว ยังไม่ใช่หลักฐานว่าปิดสิทธิ์สำเร็จ'},202);
 }catch{return authResponse({error:'รับคำสั่งไม่สำเร็จ กรุณาตรวจสิทธิ์บัญชี ผล FIT ของวันนี้ และสถานะนำเข้า visit'},409);}
}
