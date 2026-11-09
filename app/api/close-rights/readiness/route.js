import { createClient } from '@supabase/supabase-js';
import {currentUser,authResponse,sameOrigin,isReadOnly,dbRpc,getSessionToken,databaseConfig,readBody} from '@/lib/server-auth';
export const runtime='nodejs';
export const dynamic='force-dynamic';

function bangkokToday() {
 return new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
 }).format(new Date());
}

export async function POST(request){
 if(!sameOrigin(request))return authResponse({error:'ไม่มีสิทธิ์เข้าถึง'},403);
 try{
  const token=await getSessionToken();
  const user=await currentUser(token);
  if(!user)return authResponse({error:'กรุณาเข้าสู่ระบบ'},401);
  if(!['staff','admin'].includes(user.role))return authResponse({error:'เฉพาะเจ้าหน้าที่'},403);
  const allowed=await dbRpc('nhso_close_allowed',{},{token});
  if(allowed!==true)return authResponse({error:'บัญชีนี้ยังไม่ได้รับสิทธิ์ปิดสิทธิ์'},403);

  let body={};
  if(request.headers.get('content-type')?.startsWith('application/json')){
   try{body=await readBody(request,2048)||{};}catch{body={};}
  }
  const personId=typeof body.personId==='string'?body.personId.trim():'';
  const kpi=typeof body.kpi==='string'?body.kpi.trim():'FOBT';

  const blockers=[];
  if(isReadOnly()){
   blockers.push({code:'READ_ONLY_MODE',message:'ระบบกำลังอยู่ในโหมดอ่านอย่างเดียว'});
  }
  const queueEnabled=process.env.NHSO_CLOSE_MANUAL_QUEUE_ENABLED==='true';
  if(!queueEnabled){
   blockers.push({code:'QUEUE_DISABLED',message:'ยังไม่ได้เปิดใช้งาน NHSO_CLOSE_MANUAL_QUEUE_ENABLED ในระบบ'});
  }
  if(kpi!=='FOBT'){
   blockers.push({code:'KPI_NOT_SUPPORTED',message:'ระบบปิดสิทธิ์ปัจจุบันรองรับเฉพาะตรวจ FIT Test (มะเร็งลำไส้ใหญ่)'});
  }

  let statusDetail=null;
  if(personId && kpi==='FOBT'){
   const {url,key}=databaseConfig(true);
   const sb=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
   const today=bangkokToday();
   const {data:histRows}=await sb
    .from('screening_history')
    .select('id,result,screen_date,source,recorded_at')
    .eq('person_id',personId)
    .eq('kpi','FOBT')
    .order('recorded_at',{ascending:false})
    .order('id',{ascending:false})
    .limit(1);
   const latest=histRows?.[0]||null;
   const hasTodayFit=Boolean(
    latest &&
    latest.source!=='baseline' &&
    ['ปกติ','ผิดปกติ'].includes(latest.result) &&
    String(latest.screen_date)===today
   );

   let isApproved=false;
   let prep=null;
   let importRow=null;
   let intentRow=null;
   let closureRow=null;

   if(latest?.id){
    const {data:rev}=await sb.from('screening_review').select('history_id,approved_at').eq('history_id',latest.id).maybeSingle();
    isApproved=Boolean(rev?.history_id);

    const {data:prepData}=await sb.from('hosxp_fit_preparations').select('id,state,lab_result,prepared_at').eq('history_id',latest.id).maybeSingle();
    prep=prepData||null;

    if(prep?.id){
     const {data:impData}=await sb.from('hosxp_fit_import_results').select('preparation_id,vn,lab_order_number,import_status,imported_at').eq('preparation_id',prep.id).maybeSingle();
     importRow=impData||null;

     const {data:intData}=await sb.from('fit_close_intents').select('id,vn,state,result,requested_at,closure_id').eq('preparation_id',prep.id).maybeSingle();
     intentRow=intData||null;

     if(intentRow?.closure_id){
      const {data:subData}=await sb.from('nhso_close_submissions').select('id,state,seq,authen_code,updated_at').eq('id',intentRow.closure_id).maybeSingle();
      closureRow=subData||null;
     }
    }
   }

   const isPrepared=Boolean(prep?.id);
   const isImported=importRow?.import_status==='imported' && Boolean(importRow?.vn);

   if(!hasTodayFit){
    blockers.push({code:'CURRENT_DAY_FIT_REQUIRED',message:`ต้องบันทึกผลตรวจ FIT (ปกติ/ผิดปกติ) ของวันนี้ (${today}) ก่อนปิดสิทธิ์`});
   }else{
    if(!isApproved){
     blockers.push({code:'FIT_APPROVAL_REQUIRED',message:'ยังไม่ได้อนุมัติผลคัดกรอง FIT (กดปุ่ม "อนุมัติผลและเตรียมส่ง HOSxP ทันที" ด้านล่างได้)'});
    }
    if(!isPrepared){
     blockers.push({code:'FIT_PREPARATION_REQUIRED',message:'ยังไม่ได้เตรียมรายการ FIT สำหรับส่งตัวเชื่อม LAN สร้าง Visit'});
    }else if(!isImported){
     blockers.push({code:'FIT_VISIT_REQUIRED',message:'เตรียมรายการ FIT แล้ว กำลังรอตัวเชื่อม LAN นำเข้า HOSxP เพื่อออกเลข VN'});
    }
   }

   statusDetail={
    today,
    historyId:latest?.id||null,
    screenDate:latest?.screen_date||null,
    result:latest?.result||null,
    hasTodayFit,
    isApproved,
    isPrepared,
    preparationId:prep?.id||null,
    labResult:prep?.lab_result||(latest?.result==='ปกติ'?'Negative':latest?.result==='ผิดปกติ'?'Positive':null),
    isImported,
    vn:importRow?.vn||intentRow?.vn||null,
    labOrderNumber:importRow?.lab_order_number||null,
    importedAt:importRow?.imported_at||null,
    intent:intentRow?{
     id:intentRow.id,
     state:intentRow.state,
     vn:intentRow.vn,
     requestedAt:intentRow.requested_at,
     closureState:closureRow?.state||null,
     seq:closureRow?.seq||null,
     authenCode:closureRow?.authen_code||null,
     updatedAt:closureRow?.updated_at||null,
    }:null,
   };
  }

  const readyToQueue=!isReadOnly() && queueEnabled && kpi==='FOBT' && (personId ? blockers.length===0 : true);
  return authResponse({
   canSubmit:false,
   canRequest:readyToQueue,
   queueEnabled,
   manualOnly:true,
   patientVerified:Boolean(statusDetail?.isImported),
   statusDetail,
   blockers,
  });
 }catch{return authResponse({error:'ตรวจความพร้อมไม่สำเร็จ กรุณาลองใหม่'},503);}
}
