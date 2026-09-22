'use client';
import {useRef,useState} from 'react';
import {supabase} from '@/lib/supabase';
import FitImportStatus from './FitImportStatus';
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
  <FitImportStatus historyId={historyId} refreshKey={preview?.prepared_at||0}/>
  {!preview&&<button className="btn btn-outline-primary" disabled={busy} onClick={()=>request()}>{busy?'กำลังตรวจ...':'เตรียม FIT สำหรับ HOSxP'}</button>}
  {error&&<p className="text-danger mt-2" role="alert">{error}</p>}
  {preview&&<div className="bg-light rounded p-3">
   <h6>ตรวจรายการก่อนเตรียมส่ง FIT</h6><p>วันที่ตรวจจริงและวันที่รับบริการ {preview.screen_date} • {preview.source_result} → <strong>{preview.lab_result}</strong></p>
   <p className="small">visit ใหม่สำหรับ FIT • สิทธิ PP–ส่งเสริมป้องกัน • เวลาใช้เวลาที่นำเข้า<br/>ฝ่ายส่งเสริมสุขภาพ • แผนกอื่น ๆ • ผู้ตรวจ กฤตพล<br/>แล็บ {preview.lab_code} • ค่าบริการ {preview.fee_code} • วินิจฉัย {preview.diagnosis}</p>
   <div className="border rounded bg-white p-3 mb-3">
    <strong>ค่าบริการ FIT ที่ต้องใช้ใน HOSxP</strong>
    <p className="mb-1">หมวด 07 — แล็บ • Bill Code 31209 • ADP Type 15 / Code 31209</p>
    <p className="mb-1">1 รายการ × 60 บาท • PP Special {preview.lab_result==='Negative'?'1B0060':'1B0061'}</p>
    <p className="small mb-0">ตัวเชื่อมต้องตรวจค่าจริงใน HOSxP ก่อนนำเข้า ไม่เพิ่มค่าบริการ FIT อีกชุด และไม่เปลี่ยนวันที่ตรวจเป็นวันที่นำเข้า</p>
   </div>
   <p className="small">ก่อนส่ง NDP: เจ้าหน้าที่ต้องรับรองผลแล็บ ตรวจ Authen ของ visit นี้ และจัดทำเอกสารการเงิน การเตรียมรายการไม่ได้ยืนยันว่าพร้อมส่งเบิก</p>
   {preview.state==='awaiting_lan_validation'?<p role="status" className="fw-bold">เตรียมรายการแล้ว — ดู VN และผลการนำเข้าจากช่องสถานะด้านบน</p>:<>
    <label className="d-flex gap-2 align-items-start"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/>ยืนยันว่าผลแล็บ {preview.lab_result} ตรงกับผล FIT ครั้งนี้</label>
    <p className="small mt-2">เมื่อบันทึก รายการจะเข้าคิวตัวเชื่อม LAN หากเปิดนำเข้าอัตโนมัติ ตัวเชื่อมจะตรวจและสร้าง visit โดยไม่ต้องกดส่งอีกครั้ง</p>
    <button className="btn btn-primary" disabled={busy||!confirmed} onClick={()=>request(true)}>{busy?'กำลังบันทึก...':'บันทึกรายการเตรียม FIT'}</button>
   </>}
  </div>}
 </div>;
}
