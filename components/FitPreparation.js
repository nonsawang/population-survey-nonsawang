'use client';
import {useRef,useState} from 'react';
import {supabase} from '@/lib/supabase';
const messages={FIT_CHANGED_REFRESH:'ผลนี้มีการแก้ไขแล้ว กรุณาเปิดรายการล่าสุด',FIT_DATE_ALREADY_PREPARED:'มีรายการ FIT ของคนนี้ในวันเดียวกันเตรียมไว้แล้ว ต้องตรวจรายการเดิมก่อน',FIT_APPROVAL_REQUIRED:'กรุณาอนุมัติผลก่อนเตรียมรายการ',INVALID_FIT_EVENT:'รายการนี้ยังไม่พร้อมเตรียม FIT'};
function errorText(error){return Object.entries(messages).find(([key])=>String(error?.message).includes(key))?.[1]||'โหลดหรือบันทึกไม่สำเร็จ กรุณาลองใหม่';}
export default function FitPreparation({historyId}){
 const [preview,setPreview]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[confirmed,setConfirmed]=useState(false);
 const lock=useRef(false);
 async function request(save=false){
  if(lock.current)return;lock.current=true;setBusy(true);setError('');
  try{
   const {data,error}=await supabase.rpc(save?'hosxp_fit_prepare':'hosxp_fit_preview',save?{p_history:historyId,p_confirmed_result:preview.lab_result}:{p_history:historyId});
   if(error)throw error;
   if(save)setPreview(p=>({...p,...data}));else {setPreview(data);setConfirmed(false);}
  }catch(e){setError(errorText(e));}finally{lock.current=false;setBusy(false);}
 }
 return <div className="mt-2 border-top pt-2">
  {!preview&&<button className="btn btn-outline-primary" disabled={busy} onClick={()=>request()}>{busy?'กำลังตรวจ...':'เตรียม FIT สำหรับ HOSxP'}</button>}
  {error&&<p className="text-danger mt-2" role="alert">{error}</p>}
  {preview&&<div className="bg-light rounded p-3">
   <h6>ตัวอย่างรายการ FIT</h6><p>วันที่ {preview.screen_date} • {preview.source_result} → <strong>{preview.lab_result}</strong></p>
   <p className="small">visit ใหม่สำหรับ FIT • ฝ่ายส่งเสริมสุขภาพ • แผนกอื่น ๆ • ผู้ตรวจ กฤตพล<br/>แล็บ {preview.lab_code} • ค่าบริการ {preview.fee_code} • วินิจฉัย {preview.diagnosis}</p>
   {preview.state==='awaiting_lan_validation'?<p role="status" className="fw-bold">เตรียมรายการแล้ว — รอตัวเชื่อม LAN ตรวจสอบ ยังไม่ได้สร้าง visit และยังไม่มีเลข VN</p>:<>
    <label className="d-flex gap-2 align-items-start"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/>ยืนยันว่าผลแล็บ {preview.lab_result} ตรงกับผล FIT ครั้งนี้</label>
    <p className="small mt-2">ขั้นตอนนี้บันทึกรายการเตรียมเท่านั้น ยังไม่ส่งเข้า HOSxP</p>
    <button className="btn btn-primary" disabled={busy||!confirmed} onClick={()=>request(true)}>{busy?'กำลังบันทึก...':'บันทึกรายการเตรียม FIT'}</button>
   </>}
  </div>}
 </div>;
}
