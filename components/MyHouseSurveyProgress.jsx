'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { loadSurveyProgress, surveyHouses, surveyLink, SURVEY_LABELS } from '@/lib/survey-progress.mjs';

export default function MyHouseSurveyProgress({ refreshKey }) {
  const [rows,setRows]=useState([]), [busy,setBusy]=useState(true), [error,setError]=useState('');
  const [retry,setRetry]=useState(0), [filter,setFilter]=useState('all'), [page,setPage]=useState(1);
  useEffect(() => {
    let active=true;
    setBusy(true); setError('');
    loadSurveyProgress(supabase).then(data=>{if(active)setRows(data);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setBusy(false);});
    return ()=>{active=false;};
  },[refreshKey,retry]);
  const houses=useMemo(()=>surveyHouses(rows),[rows]);
  const visible=houses.filter(h=>filter==='all'||h.status===filter);
  const pages=Math.max(1,Math.ceil(visible.length/20)), current=Math.min(page,pages);
  return <section className="card border-0 shadow-sm my-3"><div className="card-body">
    <div className="d-flex justify-content-between"><h2 className="h5">สถานะสำรวจบ้านของฉัน</h2><button className="btn btn-sm btn-outline-primary" disabled={busy} onClick={()=>setRetry(v=>v+1)}>โหลดใหม่</button></div>
    <p className="small text-muted">นับเฉพาะสมาชิกที่ยังไม่จำหน่ายใน Type 0–3 และผู้ที่ยังไม่ระบุ Type ของคุณ สถานะสำรวจครบต้องมีการยืนยัน ไม่รวมคัดกรองและผลส่ง HOSxP</p>
    {busy ? <p role="status">กำลังโหลดหลักฐานสำรวจ…</p> : error ? <p role="alert" className="alert alert-warning">{error}</p> : <>
      <div className="d-flex flex-wrap gap-2 mb-3">{['all','notStarted','partial','complete'].map(key=><button key={key} className={`btn ${key===filter?'btn-primary':'btn-outline-primary'}`} aria-pressed={key===filter} onClick={()=>{setFilter(key);setPage(1);}}>{key==='all'?'บ้านทั้งหมด':SURVEY_LABELS[key]} {key==='all'?houses.length:houses.filter(h=>h.status===key).length} หลัง</button>)}</div>
      {!visible.length && <p>ไม่พบบ้านตามตัวกรอง หรือยังไม่ได้ผูกชื่อ อสม. กับบัญชีของคุณ</p>}
      {visible.slice((current-1)*20,current*20).map(h=><article key={h.key} className="border rounded-3 p-3 mb-3">
        <div className="d-flex justify-content-between flex-wrap gap-2"><h3 className="h6">บ้าน {h.house || 'ไม่ระบุ'} หมู่ {h.moo}</h3><strong>{SURVEY_LABELS[h.status]}</strong></div>
        <p className="small">สมาชิก {h.members.length} คน • สำรวจครบ {h.done} • ยังไม่ครบ {h.pending}<br/>{h.pinned?'📍 มีพิกัดแล้ว':'📍 ยังไม่มีพิกัด'}</p>
        <ul className="list-unstyled">{h.members.map(p=><li key={p.person_id} className="border-top py-2">
          {h.house && h.house!=='-' ? <Link className="d-block" href={surveyLink(h.moo,h.house,p.person_id)}>{SURVEY_LABELS[p.status]} — {p.title}{p.fname} {p.lname} ›</Link> : <span>{SURVEY_LABELS[p.status]} — {p.title}{p.fname} {p.lname}</span>}
          {p.status!=='notStarted' && p.missing?.length>0 && <small className="text-warning-emphasis">ขาด: {p.missing.join(', ')}</small>}
          {p.status==='partial' && !p.missing?.length && <small>ข้อมูลเปลี่ยนแปลงหรือยังไม่ได้กดยืนยันตรวจสอบ</small>}
          {p.reviewed_at && <small className="d-block text-muted">บันทึกล่าสุด {new Date(p.reviewed_at).toLocaleString('th-TH')} • {p.reviewed_by}</small>}
        </li>)}</ul>
        {h.house && h.house!=='-' ? <Link className="btn btn-primary btn-sm" href={surveyLink(h.moo,h.house,h.members.find(p=>p.status!=='complete')?.person_id)}>{h.pending?'สำรวจสมาชิกที่ยังไม่ครบ':'เปิดบ้าน'}</Link> : <small>กรุณาให้เจ้าหน้าที่ระบุบ้านก่อน</small>}
      </article>)}
      <div className="d-flex justify-content-between"><button className="btn btn-outline-secondary" disabled={current===1} onClick={()=>setPage(current-1)}>ก่อนหน้า</button><span>{current} / {pages}</span><button className="btn btn-outline-secondary" disabled={current===pages} onClick={()=>setPage(current+1)}>ถัดไป</button></div>
    </>}
  </div></section>;
}
