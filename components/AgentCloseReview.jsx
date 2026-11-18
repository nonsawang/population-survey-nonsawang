'use client';
import {useEffect,useState} from 'react';
async function api(body){const r=await fetch('/api/close-rights/agent',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',cache:'no-store',body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});const d=await r.json();if(!r.ok)throw Error(d.error||'ติดต่อคิว Agent ไม่สำเร็จ');return d;}
export default function AgentCloseReview({person,kpi,result,date,saved,busy,readiness,onRefresh}){
 const [stations,setStations]=useState([]),[station,setStation]=useState(''),[job,setJob]=useState(null),[status,setStatus]=useState(null),[working,setWorking]=useState(false),[reviewed,setReviewed]=useState(false),[message,setMessage]=useState(''),[submitted,setSubmitted]=useState(false);
 useEffect(()=>{let active=true;api({action:'stations'}).then(s=>{if(active)setStations(s);}).catch(e=>{if(active)setMessage(e.message)});return()=>{active=false};},[]);
 useEffect(()=>{if(!job)return;let active=true,timer;async function poll(){try{const s=await api({action:'status',id:job});if(!active)return;setStatus(s);if(s.intentId)setSubmitted(true);if(['pending','reading','ready'].includes(s.state)&&!s.expired&&!s.intentId)timer=setTimeout(poll,2000);}catch(e){if(active)setMessage(e.message);}}poll();return()=>{active=false;clearTimeout(timer)};},[job]);
 async function read(){setWorking(true);setReviewed(false);setStatus(null);setMessage('');try{setJob(await api({action:'read',personId:person.personId,station}));}catch(e){setMessage(e.message);}finally{setWorking(false)}}
 async function confirm(){if(working||!ready||!reviewed||submitted)return;setWorking(true);setMessage('');try{const r=await api({action:'confirm',id:job,result,vn:readiness.statusDetail.vn,confirm:true});setSubmitted(true);setMessage('รับคำยืนยันแล้ว รอตัวเชื่อม LAN ปิดสิทธิ์และบันทึกผลกลับ');await onRefresh();}catch(e){setMessage(e.message+' หากคำตอบขาดช่วง ให้ตรวจสถานะก่อนส่งซ้ำ');try{const s=await api({action:'status',id:job});setStatus(s);if(s.intentId)setSubmitted(true);}catch{}}finally{setWorking(false)}}
 const intent=readiness?.statusDetail?.intent;
 const ready=kpi==='FOBT'&&saved&&!busy&&readiness?.canRequest===true&&status?.state==='ready'&&!status.expired&&status.claimTypes?.includes('PG0060001');
 return <section className="card border-primary mt-3"><div className="card-body"><h6>ปิดสิทธิ์ผ่านเครื่องอ่านบัตร NHSO Agent</h6>
 <p>เลือกเครื่องที่เสียบบัตร → อ่านบัตรและตรวจสิทธิ์ → ตรวจรายการ → ยืนยันด้วยตนเอง</p>
 {intent?<p role="status">สถานะ: {intent.state} • VN: {intent.vn}{intent.authenCode?' • เลขปิดสิทธิ์: '+intent.authenCode:''}</p>:<>
 <label htmlFor="agent-station">เครื่องอ่านบัตร</label><select id="agent-station" className="form-select" disabled={working||!!job} value={station} onChange={e=>setStation(e.target.value)}><option value="">เลือกเครื่องที่กำลังใช้งาน</option>{stations.map(s=><option key={s.id} value={s.id} disabled={!s.online}>{s.label}{s.online?'':' (ออฟไลน์)'}</option>)}</select>
 <button className="btn btn-outline-primary my-2" disabled={!station||working||busy||submitted||(['pending','reading'].includes(status?.state)&&!status?.expired)} onClick={read}>อ่านบัตรและตรวจสิทธิ์</button>
 {status&&<p role="status">{status.expired?'ผลอ่านบัตรหมดอายุ กรุณาอ่านใหม่':status.state==='ready'?'อ่านบัตรตรงกับผู้รับบริการและตรวจสิทธิ์สำเร็จ':status.state==='failed'?'อ่านบัตรหรือตรวจสิทธิ์ไม่สำเร็จ กรุณาตรวจบัตรและ Agent':'รอเครื่อง LAN อ่านบัตร…'}</p>}
 {status?.state==='ready'&&<div className="border rounded p-3"><p>สิทธิ์หลัก: {status.mainInscl} • ตรวจเมื่อ {new Date(status.checkedAt).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</p><p>วันที่ FIT: {date} • ผล: {result} • VN: {readiness?.statusDetail?.vn||'ยังไม่มี'}</p><p>ค่าบริการ 60 บาท • เบิกได้ 60 บาท / เบิกไม่ได้ 0 บาท — ตัวเชื่อมต้องตรวจยอดจริงใน visit ให้ตรงก่อนส่ง</p>{!status.claimTypes?.includes('PG0060001')&&<p className="text-danger">ไม่พบประเภทบริการที่ระบบกำหนดในผลตรวจสิทธิ์ ห้ามส่งจนกว่าจะตรวจสอบรหัสบริการ</p>}<label><input type="checkbox" checked={reviewed} disabled={!ready||working||submitted} onChange={e=>setReviewed(e.target.checked)}/> ตรวจผู้รับบริการ ผล FIT วันที่ visit และยอดเงินแล้ว</label></div>}
 {readiness?.blockers?.map(b=><p key={b.code} className="text-warning">{b.message}</p>)}
 <button className="btn btn-primary mt-2" disabled={!ready||!reviewed||working||submitted} onClick={confirm}>ยืนยันปิดสิทธิ์และเข้าคิวบันทึก HOSxP</button>
 </>}
 <button className="btn btn-outline-secondary ms-2 mt-2" disabled={working} onClick={onRefresh}>ตรวจสถานะรายการ</button>{message&&<p role="status" className="mt-2">{message}</p>}
 <small>ปิดสิทธิ์สำเร็จกับบันทึกเข้า HOSxP เป็นคนละขั้นตอน หากไม่ทราบผลส่ง ระบบจะไม่ส่งซ้ำอัตโนมัติ</small></div></section>;
}
