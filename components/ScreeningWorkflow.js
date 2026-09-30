'use client';
import {useEffect,useState} from 'react';
import {supabase} from '@/lib/supabase';
import {baselineLabel} from '@/lib/screening-fiscal.mjs';
import FitPreparation from '@/components/FitPreparation';
const names={HEP:'HBV/HCV',FOBT:'FIT',HPV:'HPV',CHILD:'พัฒนาการเด็ก'};
const time=v=>v?new Date(v).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}):'-';
function useQuery(name,args,refresh){
 const [data,setData]=useState(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const key=JSON.stringify(args);
 useEffect(()=>{const c=new AbortController();setData(null);setError('');
 supabase.rpc(name,JSON.parse(key)).abortSignal(c.signal).then(({data,error})=>{
 if(c.signal.aborted)return;if(error)setError('โหลดไม่สำเร็จ กรุณาลองใหม่');else setData(data);
 }).catch(()=>{if(!c.signal.aborted)setError('เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่');});
 return ()=>c.abort();},[name,key,refresh,retry]);
 return {data,error,reload:()=>setRetry(n=>n+1)};
}
function State({data,error,reload}){return error?<div role="alert">{error} <button className="btn btn-outline-primary btn-sm" onClick={reload}>ลองใหม่</button></div>:data===null?<p role="status">กำลังโหลด...</p>:null;}
function Pages({page,setPage,rows}){return <div className="d-flex gap-2 mt-2"><button className="btn btn-outline-primary btn-sm" disabled={page===1} onClick={()=>setPage(n=>n-1)}>ก่อนหน้า</button><span>หน้า {page}</span><button className="btn btn-outline-primary btn-sm" disabled={!rows||rows.length<20} onClick={()=>setPage(n=>n+1)}>ถัดไป</button></div>;}
export function ScreeningHistory({personId,kpi,refresh}){
 const [page,setPage]=useState(1);const q=useQuery('screening_history_list',{p_person:personId,p_kpi:kpi,p_page:page},refresh);
 return <section className="mt-4"><h6>ประวัติ {names[kpi]}</h6><State {...q}/>{q.data?.length===0&&<p>ยังไม่มีประวัติ</p>}
 {q.data?.map(h=><div className="border rounded p-2 mb-2" key={h.id}><strong>{h.result||'ล้างผล'}</strong> • วันที่คัดกรอง {h.screen_date||'ไม่ระบุ'}<br/><small>{h.source==='baseline'?'ผลเดิมก่อนเริ่มเก็บประวัติ • ไม่ทราบเวลาบันทึกเดิม':`${h.recorded_name} • ${time(h.recorded_at)}`}</small>{h.source!=='baseline'&&<div className="small text-muted">ก่อนแก้ไข: {h.previous_result||'-'} • {h.previous_date||'-'}</div>}</div>)}<Pages page={page} setPage={setPage} rows={q.data}/></section>;
}
export function ScreeningOverview({kpi,refresh}){
 const q=useQuery('screening_overview',{p_kpi:kpi},refresh);const [group,setGroup]=useState('moo');
 const rows=group==='vhv'?(q.data?.groups||[]):Object.values((q.data?.groups||[]).reduce((a,r)=>{const x=a[r.moo]||(a[r.moo]={moo:r.moo,total:0,done:0,pending:0});x.total+=r.total;x.done+=r.done;x.pending+=r.pending;return a;},{}));
 return <details className="card p-3 mb-3"><summary className="fw-bold">ภาพรวมงานค้าง {names[kpi]} แยกจากผลค้นหา</summary><p className="small mt-2">ยอดกลุ่มเป้าหมายทั้งหมดตามสิทธิ์ที่เข้าถึง ใช้ผลล่าสุดของแต่ละคน</p><State {...q}/><select aria-label="จัดกลุ่มภาพรวม" className="form-select my-2" value={group} onChange={e=>setGroup(e.target.value)}><option value="moo">ตามหมู่บ้าน</option><option value="vhv">ตามหมู่บ้านและ อสม.</option></select><div className="table-responsive"><table className="table table-sm"><thead><tr><th>หมู่</th>{group==='vhv'&&<th>อสม.</th>}<th>เป้าหมาย</th><th>ตรวจแล้ว</th><th>ค้าง</th></tr></thead><tbody>{rows.map((r,i)=><tr key={i}><td>{r.moo}</td>{group==='vhv'&&<td>{r.vhv}</td>}<td>{r.total}</td><td>{r.done}</td><td className="text-danger fw-bold">{r.pending}</td></tr>)}</tbody></table></div>{q.data&&rows.length===0&&<p>ไม่มีกลุ่มเป้าหมาย</p>}</details>;
}
export function ScreeningReview(){
 const [page,setPage]=useState(1),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');const q=useQuery('screening_review_list',{p_page:page},0);
 const [filters,setFilters]=useState({search:'',kpi:'',status:'',date:''});
 const visible=(q.data||[]).filter(h=>(!filters.search||[h.person_name,h.house,h.moo].join(' ').includes(filters.search.trim()))&&(!filters.kpi||h.kpi===filters.kpi)&&(!filters.date||h.screen_date===filters.date)&&(!filters.status||(filters.status==='approved'?!!h.state:!h.state)));
 async function approve(h){if(busy)return;if(h.source==='baseline'&&!window.confirm('ยืนยันว่าได้ตรวจผล FIT และวันที่คัดกรองของผลเดิมรายการนี้แล้ว?'))return;setBusy(true);setNotice('');try{const {error}=await supabase.rpc('screening_review_approve',{p_history:h.id});if(error)throw error;setNotice('อนุมัติผลแล้ว รายการ FIT สามารถเปิดตัวอย่างเพื่อเตรียมนำเข้าได้');q.reload();}catch{setNotice('อนุมัติไม่สำเร็จ กรุณาตรวจรายการและลองใหม่');}finally{setBusy(false);}}
 return <section id="screening-review" className="card p-3 mb-4 workflow-section"><div className="workflow-section-title"><span className="workflow-step">01</span><h2 className="h4 mb-0">ตรวจอนุมัติผลคัดกรอง</h2></div><p>FIT ตรวจรหัสแล็บและค่าบริการแล้ว เปิดตัวอย่างและเตรียมรายการได้หลังอนุมัติ ส่วน HBV/HCV, HPV และพัฒนาการเด็กยังต้องตรวจ mapping ให้ครบ การเตรียมรายการยังไม่สร้าง visit</p><State {...q}/>{notice&&<p role="status">{notice}</p>}{q.data?.length===0&&<p>ยังไม่มีรายการคัดกรองที่เข้าเงื่อนไข</p>}
 <div className="workflow-filters"><label>ค้นหาในหน้าปัจจุบัน<input className="form-control" placeholder="ชื่อ บ้านเลขที่ หรือหมู่" value={filters.search} onChange={e=>setFilters(f=>({...f,search:e.target.value}))}/></label><label>ประเภทคัดกรอง<select className="form-select" value={filters.kpi} onChange={e=>setFilters(f=>({...f,kpi:e.target.value}))}><option value="">ทุกประเภท</option>{Object.entries(names).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>สถานะ<select className="form-select" value={filters.status} onChange={e=>setFilters(f=>({...f,status:e.target.value}))}><option value="">ทุกสถานะ</option><option value="pending">รออนุมัติ</option><option value="approved">อนุมัติแล้ว</option></select></label><label>วันที่คัดกรอง<input type="date" className="form-control" value={filters.date} onChange={e=>setFilters(f=>({...f,date:e.target.value}))}/></label><button type="button" className="btn btn-outline-secondary" onClick={()=>setFilters({search:'',kpi:'',status:'',date:''})}>ล้างตัวกรอง</button></div>
 {q.data&&<p className="small text-muted" role="status">แสดง {visible.length} จาก {q.data.length} รายการในหน้า {page} • ตัวกรองใช้เฉพาะหน้านี้ กดถัดไปเพื่อดูรายการเพิ่มเติม</p>}
 {q.data?.length>0&&!visible.length&&<div className="workflow-empty">ไม่พบรายการในหน้านี้ตามตัวกรอง</div>}
 {visible.map(h=><article className="border rounded p-3 mb-2" key={h.id}>{h.source==='baseline'&&<div className="mb-2"><span className="badge bg-info text-dark">{baselineLabel(h.screen_date)}</span></div>}<strong>{h.person_name}</strong> • บ้าน {h.house} หมู่ {h.moo}<p>{names[h.kpi]} • ผล {h.result} • วันที่ {h.screen_date||'ไม่ระบุ'}</p><p className="small">{h.source==='baseline'?'ผลก่อนเริ่มเก็บประวัติ • ไม่ทราบผู้บันทึกและเวลาบันทึกเดิม':`${h.recorded_name} • ${time(h.recorded_at)}`}<br/>ผลในระบบก่อนแก้: {h.previous_result||'-'} • {h.previous_date||'-'}</p>{h.state?<p>อนุมัติโดย {h.approved_name} • {time(h.approved_at)} • อนุมัติผลแล้ว</p>:<button className="btn btn-primary" disabled={busy||!h.screen_date} onClick={()=>approve(h)}>อนุมัติผลรายการนี้</button>}{h.kpi==='FOBT'&&h.state&&<FitPreparation historyId={h.id}/>}</article>)}<Pages page={page} setPage={setPage} rows={q.data}/></section>;
}
