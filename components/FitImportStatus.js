'use client';
import {useCallback,useEffect,useState} from 'react';
import {supabase} from '@/lib/supabase';
import FitAuthen from './FitAuthen';
const labels={mapping:'ตรวจ Mapping ค่าบริการ FIT สำหรับ NDP',auth:'ตรวจ Authen Code/การปิดสิทธิ',invoice:'ตรวจเลขเอกสารการเงินของค่าบริการ FIT',export_verified:'ตรวจข้อมูลส่งออก NDP และรับรองความครบถ้วน'};
export default function FitImportStatus({historyId,refreshKey=0}){
 const [state,setState]=useState({loading:true,data:null,error:false});
 const [refresh,setRefresh]=useState(0);
 const load=useCallback(async(isActive)=>{
  setState(s=>({...s,loading:true,error:false}));
  try{
   const {data,error}=await supabase.rpc('hosxp_fit_import_status',{p_history:historyId});
   if(isActive())setState({loading:false,data:data||null,error:!!error});
  }catch{if(isActive())setState({loading:false,data:null,error:true});}
 },[historyId]);
 useEffect(()=>{let active=true;load(()=>active);return()=>{active=false};},[load,refresh,refreshKey]);
 const r=state.data;
 return <section className="border rounded p-3 my-2" aria-label="สถานะนำเข้าและส่งเบิก FIT" aria-busy={state.loading}>
  <div className="d-flex flex-wrap justify-content-between gap-2"><strong>ผลการนำเข้า HOSxP</strong><button type="button" className="btn btn-sm btn-outline-secondary" disabled={state.loading} onClick={()=>setRefresh(n=>n+1)}>ตรวจสถานะอีกครั้ง</button></div>
  {state.loading?<p role="status" className="mb-0 mt-2">กำลังตรวจสถานะ...</p>:state.error?<p role="alert" className="text-danger mb-0 mt-2">ยังตรวจสถานะการนำเข้าไม่ได้ กรุณาลองใหม่ ไม่ต้องเตรียมรายการซ้ำ</p>:r?.import_status==='imported'?<>
   <p className="text-success fw-bold mt-2 mb-1">นำเข้า HOSxP สำเร็จ</p>
   <p className="mb-1">VN: <strong>{r.vn}</strong> • ใบแล็บ: {r.lab_order_number}</p>
   <p className="small">นำเข้าเมื่อ {new Date(r.imported_at).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</p>
   <FitAuthen vn={r.vn} checks={r.claim_checks} verifiedAt={r.verified_at}/>
   <p className={`fw-bold mb-1 ${r.claim_status==='ready'?'text-success':'text-warning'}`}>ข้อมูลพร้อมส่งเบิก: {r.claim_status==='ready'?'พร้อม':'ยังไม่พร้อม'}</p>
   {r.claim_status!=='ready'&&<ul className="small mb-0">{Object.entries(labels).filter(([k])=>r.claim_checks?.[k]!==true).map(([k,label])=><li key={k}>{label}</li>)}</ul>}
   <p className="small mt-2 mb-0">สถานะนี้ไม่ได้หมายความว่าส่งเบิกหรือได้รับการชดเชยแล้ว ผลแล็บที่นำเข้ายังต้องผ่านการรับรองใน HOSxP</p>
  </>:<p className="mb-0 mt-2">{r?'รอตัวเชื่อม LAN นำเข้า — ยังไม่มี VN':'ยังไม่ได้เตรียมรายการ FIT สำหรับนำเข้า'}</p>}
 </section>;
}
