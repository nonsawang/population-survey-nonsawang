'use client';
import {useEffect,useState} from 'react';
import {supabase} from '@/lib/supabase';
import {trackingFor} from '@/lib/screening-tracking.mjs';
export function useScreeningTracking(rows){
 const [state,setState]=useState({loading:true,imports:{},reports:[],error:false}),[revision,setRevision]=useState(0);
 useEffect(()=>{
  const c=new AbortController();
  async function rpc(name,args){const r=await supabase.rpc(name,args).abortSignal(c.signal);if(r.error)throw Error();return r.data;}
  async function load(){
   setState({loading:true,imports:{},reports:[],error:false});
   try{
    const imports={},reports=[];
    // Serial reads avoid overloading the existing authenticated data gateway.
    for(const h of rows||[])if(h.kpi==='FOBT')imports[h.id]=await rpc('hosxp_fit_import_status',{p_history:h.id});
    if((rows||[]).some(h=>h.kpi==='FOBT')){
     const files=await rpc('authen_report_list',{p_id:null});
     for(const f of files||[]){const report=await rpc('authen_report_list',{p_id:f.id});if(!report)throw Error();reports.push(report);}
    }
    if(!c.signal.aborted)setState({loading:false,imports,reports,error:false});
   }catch{if(!c.signal.aborted)setState({loading:false,imports:{},reports:[],error:true});}
  }
  if(rows)load();
  return()=>c.abort();
 },[rows,revision]);
 return {...state,reload:()=>setRevision(n=>n+1),get:h=>trackingFor(h,state.imports[h.id],state.reports)};
}
export function TrackingCells({history,tracking}){
 if(tracking.loading)return <><td>กำลังตรวจ…</td><td>กำลังตรวจ…</td><td>—</td></>;
 if(tracking.error)return <><td colSpan={3}><span className="text-danger">อ่านสถานะไม่ได้</span> <button className="btn btn-sm btn-outline-secondary" onClick={tracking.reload}>ลองใหม่</button></td></>;
 const t=tracking.get(history);
 return <><td><div>{t.auth}</div>{t.codes?.map(code=><div className="small" key={code}>เลขจากรายงาน: {code}</div>)}{history.kpi==='FOBT'&&<a href="#authen-report" className="small">ตรวจรายงาน Authen</a>}</td><td><strong className={t.stage==='imported'?'text-success':''}>{t.importLabel}</strong>{t.vn&&<div className="text-nowrap">VN: {t.vn}</div>}{t.verifiedAt&&<small>ตรวจล่าสุด {new Date(t.verifiedAt).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</small>}</td><td>{history.kpi!=='FOBT'?'—':t.claimReady?'ข้อมูลพร้อมส่งเบิก':'ยังไม่พร้อม / ยังไม่ยืนยัน'}<div className="small text-muted">ไม่ใช่สถานะได้รับเงิน</div></td></>;
}
