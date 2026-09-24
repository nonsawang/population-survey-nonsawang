'use client';
import {useEffect,useState} from 'react';
import {supabase} from '@/lib/supabase';
const statuses={pending:'รอตัวเชื่อม LAN ตรวจสอบ',matched:'จับคู่ได้ รอตรวจรับรอง',already_present:'เลขตรงกับ HOSxP แล้ว',blocked:'ไม่ผ่านตรวจสอบ',unmatched:'ไม่พบ visit วันที่ตรงกัน',ambiguous:'พบหลายรายการ',failed:'ตรวจไม่สำเร็จ'};
const reasons={invalid_cid:'เลขบัตรไม่ถูกต้อง',other_provider:'ต่างหน่วยบริการ',invalid_date:'วันที่ไม่ถูกต้อง',invalid_code:'เลข Authen ไม่ถูกต้อง',invalid_service:'ไม่มีรหัสบริการ',cancelled:'มีข้อมูลยกเลิก',unknown_status:'ไม่รู้จักสถานะ',duplicate_code:'เลข Authen ซ้ำในไฟล์',multiple_visits:'มีหลาย visit',no_visit:'ไม่พบ visit',hn_conflict:'HN ไม่ตรง',name_conflict:'ชื่อไม่ตรง',not_fit:'ไม่ใช่ FIT ที่นำเข้าจากระบบนี้',multiple_insurance_codes:'มีเลขเดิมหลายเลข',existing_code_conflict:'เลขเดิมต่างกัน',code_used_elsewhere:'เลขถูกใช้กับ VN อื่น',multiple_report_rows_for_visit:'หลายแถวตรงกับ VN เดียวกัน'};
export default function AuthenReportImport(){
 const [files,setFiles]=useState([]),[report,setReport]=useState(null),[selected,setSelected]=useState([]),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function load(id){const {data,error}=await supabase.rpc('authen_report_list',{p_id:id||null});if(error)throw Error('โหลดรายงานไม่สำเร็จ กรุณาตรวจการติดตั้ง migration');if(id){setReport(data);setSelected([]);setConfirmed(false);}else setFiles(data||[]);}
 useEffect(()=>{let alive=true;supabase.rpc('authen_report_list',{p_id:null}).then(({data,error})=>{if(alive){if(error)setError('ส่วนรายงาน Authen ยังไม่พร้อม กรุณาติดตั้ง migration');else setFiles(data||[]);}});return()=>{alive=false;};},[]);
 async function refresh(id){setBusy(true);setError('');try{await load(id);}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function recheck(){if(!report||busy)return;setBusy(true);setError('');try{const {error}=await supabase.rpc('authen_report_refresh',{p_id:report.id});if(error)throw Error('ขอตรวจใหม่ไม่สำเร็จ');await load(report.id);}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function upload(event){const file=event.target.files?.[0];if(!file||busy)return;setBusy(true);setError('');setNotice('');setSelected([]);setConfirmed(false);
  try{if(!/\.xlsx$/i.test(file.name)||file.size>2*1024*1024)throw Error('เลือกไฟล์ .xlsx ไม่เกิน 2 MB');
   const response=await fetch('/api/authen-report',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file});const data=await response.json();if(!response.ok)throw Error(data.error||'อัปโหลดไม่สำเร็จ');
   await load();await load(data.id);setNotice(data.duplicate?'ไฟล์นี้เคยนำเข้าแล้ว เปิดรายงานเดิมให้ตรวจสอบ':'รับไฟล์แล้ว รอตัวเชื่อม LAN จับคู่ จากนั้นกดตรวจผลล่าสุด');
  }catch(e){setError(e.message);}finally{setBusy(false);event.target.value='';}
 }
 async function accept(){if(busy||!confirmed||!selected.length)return;setBusy(true);setError('');
  try{const items=report.results.filter(r=>selected.includes(r.row)).map(r=>({row:r.row,fingerprint:r.fingerprint}));
   const {error}=await supabase.rpc('authen_report_accept',{p_id:report.id,p_items:items,p_confirm_report:true});if(error)throw Error('รับรองไม่สำเร็จ ผลจับคู่อาจเกิน 24 ชั่วโมง หรือข้อมูลเปลี่ยน กรุณาให้ตัวเชื่อมตรวจใหม่');
   await load(report.id);setNotice('อนุมัติแล้ว รอตัวเชื่อม LAN ตรวจซ้ำและบันทึกเลขเข้า HOSxP');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 const results=new Map((report?.results||[]).map(r=>[r.row,r]));
 return <section id="authen-report" className="card mb-4" aria-label="นำเข้ารายงาน Authen"><div className="card-body">
  <h2 className="h4">นำเข้ารายงาน Authen</h2>
  <p>เลือกไฟล์รายงาน .xlsx จาก New Authen เพื่อจับคู่กับ visit ใน HOSxP โดยตรวจเลขบัตร ชื่อ วันที่บริการ และเลข Authen เดิมผ่าน LAN พร้อมแสดงประเภทบริการให้ตรวจสอบ</p>
  <p className="small text-muted">เมื่ออนุมัติ ตัวเชื่อม LAN จะตรวจซ้ำและเติมเลข Authen เฉพาะช่องว่าง โดยไม่ทับเลขเดิมที่ต่างกัน การบันทึกสำเร็จยังไม่ยืนยันความพร้อมส่งเบิก</p>
  <label className="form-label">ไฟล์รายงาน (ไม่เกิน 500 รายการ / 2 MB)<input type="file" accept=".xlsx" className="form-control" onChange={upload} disabled={busy}/></label>
  {error&&<div role="alert" className="alert alert-danger">{error}</div>}{notice&&<div role="status" className="alert alert-info">{notice}</div>}
  <div className="d-flex flex-wrap gap-2 my-2"><select aria-label="รายงานที่นำเข้า" className="form-select w-auto" disabled={busy} value={report?.id||''} onChange={e=>e.target.value&&refresh(e.target.value)}><option value="">เลือกรายงานล่าสุด</option>{files.map(f=><option key={f.id} value={f.id}>{new Date(f.uploaded_at).toLocaleString('th-TH')} — {f.row_count} รายการ</option>)}</select><button className="btn btn-outline-primary" disabled={busy} onClick={()=>refresh(report?.id)}>ตรวจผลล่าสุด</button></div>
  {report&&<><p>สถานะ: {report.state==='matched'?'ตรวจจาก LAN แล้ว':statuses[report.state]} {report.checked_at&&`(${new Date(report.checked_at).toLocaleString('th-TH')})`}</p>
   {report.state!=='pending'&&!report.approved_rows.length&&<button className="btn btn-outline-secondary mb-2" disabled={busy} onClick={recheck}>ให้ LAN ตรวจข้อมูลใหม่</button>}
   <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>เลือก</th><th>ผู้รับบริการ / เลขบัตรท้าย 4</th><th>วันที่ / บริการตามรายงาน</th><th>Authen จากรายงาน</th><th>VN / เลขเดิม</th><th>ผลตรวจ</th></tr></thead><tbody>{report.rows.map(r=>{const w=report.writes?.find(w=>w.row===r.row);const m=results.get(r.row),approved=report.approved_rows.includes(r.row),eligible=['matched','already_present'].includes(m?.status);return <tr key={r.row}><td><input type="checkbox" aria-label={`เลือกแถว ${r.row}`} disabled={busy||!eligible||approved} checked={selected.includes(r.row)||approved} onChange={e=>setSelected(s=>e.target.checked?[...s,r.row]:s.filter(n=>n!==r.row))}/></td><td>{r.name}<br/><small>••••{r.cid.slice(-4)}</small></td><td>{r.serviceDate||'วันที่ไม่ถูกต้อง'}<br/>{r.serviceCode}<br/><small>{r.serviceName}</small></td><td>{r.code}</td><td>{m?.vn||'-'}<br/><small>{m?.existingCode||'ไม่มีเลขเดิม'}</small></td><td>{w?({pending:'รอบันทึกผ่าน LAN',written:'บันทึก HOSxP สำเร็จ',already_present:'ตรวจแล้ว เลขตรงกับ HOSxP',blocked:'ระงับการบันทึก ต้องตรวจใหม่'}[w.state]):approved?'อนุมัติแล้ว':statuses[m?.status||'pending']}{w?.error_code&&<small className="d-block">{w.error_code}</small>}<br/><small>{(m?.reasons||r.issues).map(k=>reasons[k]||k).join(', ')}</small>{r.statusUnconfirmed&&<div className="text-warning-emphasis small">รายงานไม่ระบุสถานะใช้งาน</div>}</td></tr>;})}</tbody></table></div>
   <label className="d-flex gap-2 my-3"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/><span>ตรวจประเภทบริการและสถานะปัจจุบันของรายการที่เลือกแล้ว โดยเฉพาะรายการที่รายงานไม่ระบุสถานะใช้งาน</span></label>
   <button className="btn btn-primary" disabled={busy||!confirmed||!selected.length} onClick={accept}>{busy?'กำลังดำเนินการ…':`อนุมัติบันทึก HOSxP ${selected.length} รายการ`}</button>
  </>}
 </div></section>;
}
