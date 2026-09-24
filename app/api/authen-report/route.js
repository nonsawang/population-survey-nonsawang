import {createHash} from 'node:crypto';
import {sameOrigin,currentUser,databaseConfig,authResponse} from '@/lib/server-auth';
import {parse} from '@/lib/authen-report-xlsx.cjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request){
 if(!sameOrigin(request))return authResponse({error:'ไม่มีสิทธิ์'},403);
 try{
  const user=await currentUser();if(!user)return authResponse({error:'กรุณาเข้าสู่ระบบ'},401);
  if(!['staff','admin'].includes(user.role))return authResponse({error:'เฉพาะเจ้าหน้าที่'},403);
  if(request.headers.get('content-type')!=='application/octet-stream')return authResponse({error:'กรุณาเลือกไฟล์ .xlsx'},400);
  const reader=request.body?.getReader();if(!reader)throw Error('REPORT_EMPTY');
  let size=0;const chunks=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2*1024*1024){await reader.cancel();throw Error('REPORT_FILE_LIMIT');}chunks.push(Buffer.from(value));}
  const buffer=Buffer.concat(chunks),rows=await parse(buffer),hash=createHash('sha256').update(buffer).digest('hex');
  const {url,key}=databaseConfig(true);
  const headers={apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=representation'};
  const response=await fetch(`${url}/rest/v1/authen_report_batches?select=id,state`,{method:'POST',headers,cache:'no-store',signal:AbortSignal.timeout(15000),body:JSON.stringify({file_hash:hash,uploaded_by:user.userId,rows})});
  if(response.status===409){
   const existing=await fetch(`${url}/rest/v1/authen_report_batches?file_hash=eq.${hash}&select=id,state`,{headers,cache:'no-store',signal:AbortSignal.timeout(15000)});
   if(!existing.ok)throw Error('REPORT_STORAGE');const data=await existing.json();if(!data[0])throw Error('REPORT_STORAGE');
   return authResponse({...data[0],duplicate:true});
  }
  if(!response.ok)throw Error('REPORT_STORAGE');const data=await response.json();return authResponse({...data[0],count:rows.length});
 }catch(e){
  const messages={REPORT_HEADERS:'คอลัมน์ไม่ตรงกับรายงาน Authen ของ สปสช.',REPORT_FILE_LIMIT:'ไฟล์ใหญ่เกินกำหนด (ไม่เกิน 2 MB)',REPORT_ROW_LIMIT:'รองรับไม่เกิน 500 รายการต่อไฟล์',REPORT_ONE_SHEET:'ไฟล์ต้องมีหนึ่งชีต',REPORT_PLAIN_CELLS_REQUIRED:'ไฟล์มีสูตรหรือเซลล์ชนิดที่ไม่รองรับ กรุณาใช้รายงานต้นฉบับ',REPORT_EMPTY:'ไม่พบข้อมูล',REPORT_XLSX_REQUIRED:'ไฟล์ .xlsx ไม่ถูกต้อง'};
  return authResponse({error:messages[e.message]||'อ่านหรือเก็บรายงานไม่สำเร็จ กรุณาตรวจไฟล์และการติดตั้ง migration'},messages[e.message]?400:503);
 }
}
