'use client';
import {useRef,useState} from 'react';
const reasons={NOT_PENDING:'สถานะเปลี่ยน / ไม่ได้รอส่ง',ALREADY_APPROVED:'อนุมัติแล้ว',FORBIDDEN:'ไม่มีสิทธิ์',NOT_FOUND:'ไม่พบคิว',GPS_REFERENCE_CHANGED:'พิกัดหรือข้อมูลอ้างอิงเปลี่ยน',GPS_SNAPSHOT_REQUIRED:'ข้อมูลอ้างอิงเกิน 24 ชั่วโมง / ยังไม่มี',HOUSE_NOT_UNIQUE:'บ้านจับคู่ไม่ได้เพียงหลังเดียว',HOUSE_CHANGED:'รหัสบ้านเปลี่ยน',ALREADY_REPLACED:'มีรายการแทนที่แล้ว',REVISION_STATE_CHANGED:'สถานะเปลี่ยน',CHECK_FAILED:'ตรวจสอบไม่สำเร็จ'};
export default function HouseGpsBatchApproval({rows,busy,setBusy,onApproved}) {
 const [review,setReview]=useState(null),[selected,setSelected]=useState([]),[message,setMessage]=useState('');
 const lock=useRef(false);
 const ready=review?.filter(r=>r.status==='ready')||[];
 async function run(approve){
  if(lock.current||busy)return;
  const items=approve?ready.filter(r=>selected.includes(r.id)):rows;
  if(!items.length)return;
  if(approve&&!window.confirm(`ยืนยันอนุมัติส่ง ${items.length} รายการที่เลือก? ตัวส่ง LAN จะตรวจพิกัดเดิมกับ HOSxP ก่อนเขียนอีกครั้ง`))return;
  lock.current=true;setBusy(true);setMessage('');
  try{
   const response=await fetch('/api/house-gps-review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:approve?'approve_batch':'preview_batch',items:items.map(r=>({id:r.id,latitude:r.latitude,longitude:r.longitude,...(approve?{batchId:r.batchId}:{})}))})});
   const result=await response.json();
   if(!response.ok||!Array.isArray(result.rows))throw Error(result.error||'ตรวจสอบไม่สำเร็จ กรุณาตรวจ migration และโหลดคิวใหม่');
   setReview(result.rows);setSelected(approve?[]:result.rows.filter(r=>r.status==='ready').map(r=>r.id));
   if(approve){setMessage(`อนุมัติแล้ว ${result.rows.filter(r=>r.status==='approved').length} รายการ • ข้าม ${result.rows.filter(r=>r.status==='skipped').length} รายการ — รอตัวส่ง LAN ยังไม่ใช่ผลเขียน HOSxP`);onApproved();}
  }catch(e){setReview(null);setSelected([]);setMessage(approve?'ไม่สามารถยืนยันผลการอนุมัติได้ กรุณาโหลดรายการใหม่และตรวจสถานะก่อนลองอีกครั้ง':e.message);}
  finally{lock.current=false;setBusy(false);}
 }
 return <section className="border rounded p-3 my-3" aria-label="อนุมัติพิกัดเป็นชุด">
  <button className="btn btn-outline-primary" disabled={busy||!rows.length} onClick={()=>run(false)}>ตรวจสอบและอนุมัติรายการที่ผ่าน</button>
  <p className="small mt-2">ตรวจเฉพาะ {rows.length} รายการในหน้านี้ (สูงสุด 25) เทียบข้อมูลอ้างอิง HOSxP ล่าสุด ไม่ใช่การอ่านฐาน HOSxP สด</p>
  {message&&<p role="status">{message}</p>}
  {review&&<><p>ผ่านพร้อมเลือก {ready.length} รายการ • ข้าม {review.filter(r=>r.status==='skipped').length} รายการ</p>
   <div className="table-responsive"><table className="table table-sm"><thead><tr><th>เลือก</th><th>บ้าน / คิว</th><th>พิกัดเดิม → ใหม่</th><th>ผลตรวจ</th></tr></thead><tbody>{review.map(r=><tr key={r.id}><td>{r.status==='ready'&&<input type="checkbox" aria-label={`เลือกบ้าน ${r.address} หมู่ ${r.moo}`} disabled={busy} checked={selected.includes(r.id)} onChange={e=>setSelected(s=>e.target.checked?[...s,r.id]:s.filter(id=>id!==r.id))}/>}</td><td>{r.address?`ม.${r.moo} บ้าน ${r.address}`:r.id}</td><td>{r.address&&<>{r.oldLatitude??'-'}, {r.oldLongitude??'-'} → {r.latitude}, {r.longitude}<small className="d-block">ข้อมูลอ้างอิง {new Date(r.capturedAt).toLocaleString('th-TH')}</small></>}</td><td>{r.status==='ready'?'พร้อมส่ง':r.status==='approved'?'อนุมัติแล้ว รอ LAN':reasons[r.reason]||'ตรวจไม่ผ่าน'}</td></tr>)}</tbody></table></div>
   {ready.length>0&&<button className="btn btn-primary" disabled={busy||!selected.length} onClick={()=>run(true)}>อนุมัติส่ง {selected.length} รายการที่เลือก</button>}
  </>}
 </section>;
}
