'use client';
import {useEffect,useState} from 'react';
import {supabase} from '@/lib/supabase';
import {logFilters,activityLogQuery,LOG_PAGE_SIZE} from '@/lib/activity-log-query.mjs';
const empty={start:'',end:'',username:'',action:''};
export default function ActivityLogPanel(){
 const [draft,setDraft]=useState(empty),[query,setQuery]=useState({filters:logFilters(empty),page:1,version:0});
 const [rows,setRows]=useState([]),[count,setCount]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[validation,setValidation]=useState('');
 useEffect(()=>{let active=true;const controller=new AbortController();setLoading(true);setError('');setRows([]);setCount(null);
 (async()=>{try{const r=await activityLogQuery(supabase,query.filters,query.page).abortSignal(controller.signal);if(r.error)throw r.error;if(active){setRows(r.data||[]);setCount(r.count);}}catch{if(active)setError('โหลดประวัติไม่สำเร็จ กรุณาลองใหม่');}finally{if(active)setLoading(false);}})();return()=>{active=false;controller.abort();};},[query]);
 function search(e){e.preventDefault();try{const filters=logFilters(draft);setValidation('');setQuery(q=>({filters,page:1,version:q.version+1}));}catch(e){setValidation(e.message);}}
 function reset(){setDraft(empty);setValidation('');setQuery(q=>({filters:logFilters(empty),page:1,version:q.version+1}));}
 const field=(key,label,type='text')=><div className="col-12 col-md-3"><label className="form-label" htmlFor={'log-'+key}>{label}</label><input id={'log-'+key} type={type} className="form-control" maxLength={100} value={draft[key]} onChange={e=>setDraft(d=>({...d,[key]:e.target.value}))}/></div>;
 return <section className="card shadow-sm border-0 p-3" aria-label="ประวัติ Action ผู้ใช้">
 <form onSubmit={search}><div className="row g-2">{field('start','ตั้งแต่วันที่ (เวลาไทย)','date')}{field('end','ถึงวันที่ (รวมวันนี้)','date')}{field('username','ชื่อบัญชีผู้ใช้')}{field('action','Action เช่น LOGIN')}</div>
 <div className="d-flex gap-2 my-3"><button className="btn btn-primary" type="submit">ค้นหา</button><button className="btn btn-outline-secondary" type="button" onClick={reset}>ล้างตัวกรอง</button><button className="btn btn-outline-secondary" type="button" disabled={loading} onClick={()=>setQuery(q=>({...q,version:q.version+1}))}>โหลดใหม่</button></div></form>
 <p className="small text-muted">เว้นวันที่เพื่อค้นประวัติทั้งหมดที่ยังอยู่ในฐาน • ค้นชื่อบัญชีและ Action แบบมีคำที่ระบุ • หน้าละ 50 รายการ</p>
 {validation&&<p role="alert" className="text-danger">{validation}</p>}
 {loading?<p role="status">กำลังโหลดประวัติ…</p>:error?<p role="alert" className="text-danger">{error}</p>:<>
 <p role="status">{count!==null?'พบ '+count.toLocaleString('th-TH')+' รายการ':'ไม่ทราบยอดรวม'} • หน้า {query.page}</p>
 {!rows.length?<p>ไม่พบรายการในหน้านี้ตามเงื่อนไขที่เลือก</p>:<div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>เวลา (ไทย)</th><th>ผู้ใช้</th><th>Action</th><th>รายละเอียด</th></tr></thead><tbody>{rows.map(log=><tr key={log.id}><td>{log.created_at?new Date(log.created_at).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}):'-'}</td><td>{log.username||'-'}</td><td>{log.action||'-'}</td><td style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{typeof log.details==='object'?JSON.stringify(log.details):log.details||'-'}</td></tr>)}</tbody></table></div>}
 </>}
 <nav aria-label="แบ่งหน้าประวัติ" className="d-flex gap-3 align-items-center"><button className="btn btn-outline-primary" disabled={loading||query.page===1} onClick={()=>setQuery(q=>({...q,page:q.page-1}))}>ก่อนหน้า</button><span>หน้า {query.page}</span><button className="btn btn-outline-primary" disabled={loading||!!error||(count!==null?query.page*LOG_PAGE_SIZE>=count:rows.length<LOG_PAGE_SIZE)} onClick={()=>setQuery(q=>({...q,page:q.page+1}))}>ถัดไป</button></nav>
 </section>;
}
