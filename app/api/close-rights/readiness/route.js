import {currentUser,authResponse,sameOrigin,isReadOnly} from '@/lib/server-auth';
export const runtime='nodejs';
export const dynamic='force-dynamic';
// Capability report only. No credentials, clinical data, reservation or NHSO request.
export async function POST(request){
 if(!sameOrigin(request))return authResponse({error:'ไม่มีสิทธิ์เข้าถึง'},403);
 try{
  const user=await currentUser();
  if(!user)return authResponse({error:'กรุณาเข้าสู่ระบบ'},401);
  if(!['staff','admin'].includes(user.role))return authResponse({error:'เฉพาะเจ้าหน้าที่'},403);
  const blockers=[
   {code:'VISIT_MAPPING_PENDING',message:'ยังไม่ได้เชื่อม visit สิทธิการรักษา และยอดเงินจาก HOSxP สำหรับปิดสิทธิ์'},
   {code:'SERVER_CONFIRMATION_PENDING',message:'ยังไม่ได้เชื่อมการยืนยันรายการของเจ้าหน้าที่ฝั่งเซิร์ฟเวอร์'},
   {code:'LIVE_TRANSPORT_DISABLED',message:'ยังไม่เปิดตัวส่ง API จริง'}
  ];
  if(isReadOnly())blockers.unshift({code:'READ_ONLY_MODE',message:'ระบบกำลังอยู่ในโหมดอ่านอย่างเดียว'});
  return authResponse({canSubmit:false,manualOnly:true,patientVerified:false,blockers});
 }catch{return authResponse({error:'ตรวจความพร้อมไม่สำเร็จ กรุณาลองใหม่'},503);}
}
