'use client';
import {useEffect,useRef,useState} from 'react';
import {supabase} from '@/lib/supabase';
import {readCard} from '@/lib/eform-card.mjs';
import {validateCID,VALID_MOOS} from '@/lib/utils';
import ModalShell from '@/components/survey/ModalShell';
export default function RegisterScreeningPerson({onClose,onRegistered}){
 const [form,setForm]=useState({cid:'',title:'นาย',fname:'',lname:'',birth_date:'',house:'',moo:'',vhv:''});
 const [owners,setOwners]=useState([]),[busy,setBusy]=useState(false),[message,setMessage]=useState('');const lock=useRef(false);
 useEffect(()=>{supabase.from('vhv_data').select('name,moo').limit(1000).then(({data,error})=>{if(error)setMessage('โหลดรายชื่อ อสม. ไม่สำเร็จ');else setOwners(data||[]);});},[]);
 const change=(key,value)=>setForm(f=>({...f,[key]:value,...(key==='moo'?{vhv:''}:{})}));
 async function read(){if(lock.current)return;lock.current=true;setBusy(true);try{const c=await readCard();setForm(f=>({...f,cid:c.cid,title:c.title,fname:c.fname,lname:c.lname,birth_date:c.birth_year?`${Number(c.birth_year)-543}-${c.birth_month}-${c.birth_day}`:''}));setMessage('อ่านข้อมูลแล้ว กรุณาตรวจที่อยู่จริงและ อสม.');}catch{setMessage('อ่านบัตรไม่สำเร็จ กรุณาตรวจ E-Form Agent หรือกรอกข้อมูลเอง');}finally{lock.current=false;setBusy(false);}}
 async function save(){if(lock.current)return;if(!validateCID(form.cid).valid){setMessage('เลขบัตรประชาชนไม่ถูกต้อง');return;}if(['fname','lname','birth_date','house','moo','vhv'].some(k=>!form[k].trim())){setMessage('กรุณากรอกข้อมูลให้ครบ');return;}lock.current=true;setBusy(true);try{const {data,error}=await supabase.rpc('screening_register_person',{p_data:form});if(error){setMessage(['PGRST202','42883'].includes(error.code)?'ต้องติดตั้ง migration เพิ่มบุคคลก่อนใช้งาน':'บันทึกไม่สำเร็จ กรุณาตรวจวันเกิด หมู่ และ อสม. แล้วลองใหม่');return;}if(data.status==='existing'){setMessage('มีทะเบียนเดิมอยู่แล้ว ระบบไม่สร้างซ้ำ ใช้เลขบัตรนี้ค้นหา หรือตรวจเกณฑ์กลุ่มเป้าหมาย');return;}onRegistered(form.cid);}catch{setMessage('เชื่อมต่อไม่สำเร็จ ข้อมูลที่กรอกยังอยู่ สามารถลองบันทึกใหม่ได้');}finally{lock.current=false;setBusy(false);}}
 return <ModalShell title="เพิ่มบุคคลใหม่" icon="fa-user-plus" onClose={()=>{if(!busy)onClose();}} scrollable footer={<><button className="btn btn-secondary" disabled={busy} onClick={onClose}>ยกเลิก</button><button className="btn btn-primary" disabled={busy} onClick={save}>บันทึกและรอตรวจทะเบียน HOSxP</button></>}>
 <p className="small">สำหรับเจ้าหน้าที่ • ตรวจเลขบัตรซ้ำทั้งฐานเว็บก่อนบันทึก การค้นไม่พบในกลุ่มคัดกรองไม่ได้หมายความว่าไม่มีทะเบียน</p>
 <button className="btn btn-outline-primary w-100 mb-3" disabled={busy} onClick={read}>อ่านบัตรประชาชน</button>
 <fieldset disabled={busy} className="row g-2">
 {[["cid","เลขบัตรประชาชน"],["title","คำนำหน้า"],["fname","ชื่อ"],["lname","นามสกุล"],["birth_date","วันเกิด (ค.ศ.)"],["house","บ้านเลขที่"]].map(([key,label])=><div className="col-12 col-sm-6" key={key}><label className="form-label" htmlFor={'register-'+key}>{label}</label><input id={'register-'+key} className="form-control" type={key==='birth_date'?'date':'text'} value={form[key]} maxLength={key==='cid'?13:100} onChange={e=>change(key,e.target.value)}/></div>)}
 <div className="col-6"><label htmlFor="register-moo">หมู่</label><select id="register-moo" className="form-select" value={form.moo} onChange={e=>change('moo',e.target.value)}><option value="">เลือกหมู่</option>{VALID_MOOS.map(m=><option key={m} value={m}>{m}</option>)}</select></div>
 <div className="col-6"><label htmlFor="register-vhv">อสม.</label><select id="register-vhv" className="form-select" value={form.vhv} onChange={e=>change('vhv',e.target.value)}><option value="">เลือก อสม.</option>{owners.filter(o=>String(o.moo)===form.moo).map(o=><option key={o.name}>{o.name}</option>)}</select></div>
 </fieldset><p role="status" className="mt-3">{message}</p><p className="small text-muted">ขั้นนี้บันทึกทะเบียนเว็บและคำขอตรวจ HOSxP เท่านั้น ยังไม่ออก HN หรือสร้าง visit</p>
 </ModalShell>;
}
