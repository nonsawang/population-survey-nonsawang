'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {supabase} from '@/lib/supabase';
const number=v=>Number(v||0).toLocaleString('th-TH');
const time=v=>v?new Date(v).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}):'ยังไม่มีข้อมูล';
export default function HosxpSyncStatus(){
 const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const running=useRef(false);
 const load=useCallback(async()=>{
  if(running.current)return;running.current=true;setBusy(true);
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
  try{const r=await supabase.rpc('hosxp_registry_status').abortSignal(controller.signal);if(r.error)throw Error();setData(r.data);setError('');}
  catch{setError('อ่านสถานะล่าสุดไม่สำเร็จ กรุณาลองใหม่ ข้อมูลเดิมด้านล่างอาจยังไม่เป็นปัจจุบัน');}
  finally{clearTimeout(timeout);running.current=false;setBusy(false);}
 },[]);
 useEffect(()=>{load();const timer=setInterval(()=>{if(!document.hidden)load();},60000);return()=>clearInterval(timer);},[load]);
 const last=data?.sync?.last_success_at,stale=last&&Date.now()-new Date(last).getTime()>3600000;
 const label=error?'อ่านสถานะไม่ได้':!data?'กำลังตรวจสถานะ':!last?'ยังไม่มีประวัติซิงก์':stale?'ไม่มีข้อมูลใหม่เกิน 1 ชั่วโมง':'ได้รับข้อมูลล่าสุดแล้ว';
 const tone=error||stale?'warning':last?'success':'secondary';
 return <section className="card border-0 shadow-sm p-3 p-md-4 mb-4" aria-label="สถานะซิงก์ HOSxP" aria-busy={busy}>
  <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap">
   <div><h2 className="h5 mb-2">สถานะซิงก์ทะเบียน HOSxP</h2><span className={`badge bg-${tone} ${tone==='warning'?'text-dark':''}`} role="status">{label}</span></div>
   <button type="button" className="btn btn-outline-primary" onClick={load} disabled={busy}>{busy?'กำลังตรวจ…':'รีเฟรชสถานะ'}</button>
  </div>
  {error&&<p className="alert alert-warning mt-3 mb-0" role="alert">{error}</p>}
  {data&&<>
   <div className="row g-3 mt-1">
    <div className="col-12 col-md-6"><div className="bg-light rounded p-3 h-100"><div className="small text-muted">รับข้อมูลชื่อชุดล่าสุด (เวลาไทย)</div><strong>{time(last)}</strong><div className="small text-muted mt-1">เป็นเวลารับข้อมูลแต่ละชุด ไม่ใช่เวลาจบทั้งรอบ</div></div></div>
    <div className="col-12 col-md-6"><div className="bg-light rounded p-3 h-100"><div className="small text-muted">บุคคลที่ยืนยันรหัสเชื่อมแล้ว</div><strong className="fs-4">{number(data.linked)}</strong> คน</div></div>
    <div className="col-6"><div className="border rounded p-3"><div className="small text-muted">ชื่อที่อัปเดตในชุดล่าสุด</div><strong>{last?number(data.sync.updated_count):'—'}</strong> คน</div></div>
    <div className="col-6"><div className="border rounded p-3"><div className="small text-muted">ข้ามในชุดล่าสุด</div><strong>{last?number(data.sync.blocked_count):'—'}</strong> คน</div></div>
   </div>
   {stale&&<p className="alert alert-warning mt-3 mb-0">ยังไม่ได้รับข้อมูลใหม่เกิน 1 ชั่วโมง โปรดตรวจเครื่องตัวเชื่อม เครือข่าย และ Task Scheduler</p>}
   <p className="small text-muted mt-3 mb-1">ข้อมูลอ้างอิงทะเบียน: {time(data.snapshot_at)}</p>
  </>}
  <p className="small text-muted mt-3 mb-0">หน้านี้ตรวจสถานะใหม่ทุก 1 นาทีขณะเปิดดู ซิงก์เฉพาะชื่อจาก HOSxP ของบุคคลที่เชื่อมรหัสแล้ว สถานะนี้ไม่ได้ยืนยันว่าตัวเชื่อมออนไลน์หรือทำงานครบทั้งรอบ</p>
 </section>;
}
