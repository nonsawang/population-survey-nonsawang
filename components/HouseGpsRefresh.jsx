'use client';
import {useEffect,useRef,useState} from 'react';
import {supabase} from '@/lib/supabase';
const labels={pending:'รอเครื่อง LAN รับงาน',processing:'เครื่อง LAN กำลังอ่านทะเบียนบ้าน',completed:'อัปเดตข้อมูลอ้างอิงสำเร็จ',failed:'โหลดไม่สำเร็จ กรุณาตรวจเครื่อง LAN และการเชื่อมต่อ HOSxP'};
export default function HouseGpsRefresh(){
 const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0);
 const lock=useRef(false);
 useEffect(()=>{
  let active=true,timer;
  async function poll(){
   try{
    const {data:result,error:e}=await supabase.rpc('house_gps_refresh_status');
    if(e)throw e;
    if(!active)return;
    setData(result);setError('');
    if(['pending','processing'].includes(result?.request?.state))timer=setTimeout(poll,10000);
   }catch(e){if(active)setError(['PGRST202','42883'].includes(e.code)?'ต้องติดตั้ง migration 20261115_house_gps_refresh.sql ก่อน':'โหลดสถานะไม่ได้ กรุณาลองใหม่');}
  }
  poll();return()=>{active=false;clearTimeout(timer);};
 },[retry]);
 async function request(){
  if(lock.current)return;
  lock.current=true;setBusy(true);setError('');
  try{
   const {data:result,error:e}=await supabase.rpc('house_gps_refresh_request');if(e)throw e;
   setData(result);setRetry(n=>n+1);
  }catch{setError('ส่งคำขอไม่สำเร็จ กรุณาตรวจสถานะก่อนลองใหม่');}
  finally{lock.current=false;setBusy(false);}
 }
 const state=data?.request?.state,waiting=['pending','processing'].includes(state);
 return <section className="border rounded p-3 my-3" aria-label="โหลดทะเบียนบ้าน HOSxP">
  <h3 className="h6">ข้อมูลอ้างอิงทะเบียนบ้านและพิกัด HOSxP</h3>
  <p className="small">อ่านจาก HOSxP ผ่านเครื่อง LAN เพื่ออัปเดตข้อมูลอ้างอิงบนเว็บ ไม่เปลี่ยนหมุดที่ อสม. บันทึก และไม่เขียนข้อมูลกลับ HOSxP</p>
  <button className="btn btn-primary me-2" disabled={busy||waiting||!data||!!error} onClick={request}>ดึงทะเบียนบ้านและพิกัดจาก HOSxP ใหม่</button>
  <button className="btn btn-outline-secondary" disabled={busy} onClick={()=>setRetry(n=>n+1)}>ตรวจสถานะ</button>
  {error&&<p role="alert" className="text-danger mt-2">{error}</p>}
  {state&&<p role="status" className="mt-2">{labels[state]}{state==='completed'?` • ${data.request.house_count} หลัง`:''}</p>}
  {waiting&&<p className="small text-muted">เปิดเครื่อง LAN ที่ติดตั้งตัวเชื่อมและเข้าสู่ Windows ไว้ ระบบรับงานตามรอบ Scheduled Task ประมาณ 1 นาที หากสถานะค้างนาน ให้เจ้าหน้าที่ตรวจโปรเซสและบันทึกตัวเชื่อมก่อนลองใหม่</p>}
  {data?.storage&&<p className={data.storage.warning?'alert alert-warning mt-2':'small text-muted mt-2'}>พื้นที่ฐานล่าสุด {(data.storage.database_bytes/1000000).toFixed(1)} MB • ตรวจเมื่อ {new Date(data.storage.checked_at).toLocaleString('th-TH')}{data.storage.warning?' — ถึงเกณฑ์เตือนภายในระบบ 400 MB กรุณาตรวจพื้นที่และ retention':''}</p>}
  <small>ข้อมูลอ้างอิงล่าสุด: {data?.snapshot?.captured_at?new Date(data.snapshot.captured_at).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}):'ยังไม่มี / ยังโหลดไม่สำเร็จ'}</small>
 </section>;
}
