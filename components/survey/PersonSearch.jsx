'use client';
import {useRef,useState} from 'react';
import {supabase} from '@/lib/supabase';

export default function PersonSearch({onOpenHouse,busy}){
 const [mode,setMode]=useState('name'),[query,setQuery]=useState(''),[rows,setRows]=useState(null),[message,setMessage]=useState(''),[loading,setLoading]=useState(false);
 const version=useRef(0);
 function reset(){version.current++;setRows(null);setMessage('');setLoading(false);}
 async function search(e){
  e.preventDefault();const q=query.trim();const id=++version.current;
  setRows(null);setMessage('');
  const digits=q.replace(/[\s-]/g,'');
  if(mode==='cid'&&!/^\d{13}$/.test(digits)){setMessage('กรุณาระบุเลขบัตรประชาชนครบ 13 หลัก');return;}
  if(mode==='name'&&(q.length<2||q.length>100)){setMessage('กรุณาระบุชื่อหรือนามสกุล 2–100 ตัวอักษร');return;}
  setLoading(true);
  try{
   let request=supabase.from('population').select('person_id,title,fname,lname,cid,house,moo').order('fname').order('person_id').limit(21);
   if(mode==='cid')request=request.eq('cid',digits);
   else for(const word of q.split(/\s+/)){
    const pattern='%'+word.replace(/[\\%_]/g,'\\$&')+'%';
    const quoted=JSON.stringify(pattern);
    request=request.or(`fname.ilike.${quoted},lname.ilike.${quoted}`);
   }
   const {data,error}=await request;
   if(id!==version.current)return;
   if(error)throw error;
   setRows((data||[]).slice(0,20));
   setMessage(data?.length>20?'แสดง 20 รายการแรก กรุณาระบุชื่อให้ละเอียดขึ้น':data?.length?'เลือกรายชื่อเพื่อเปิดบ้านและสำรวจ':'ไม่พบรายชื่อในขอบเขตข้อมูลที่คุณมีสิทธิ์เข้าถึง');
  }catch{if(id===version.current)setMessage('ค้นหาไม่สำเร็จ กรุณาลองใหม่');}
  finally{if(id===version.current)setLoading(false);}
 }
 return <section className="card border-0 shadow-sm mb-4"><div className="card-body">
  <h2 className="h5 fw-bold">ค้นหาบุคคลเพื่อสำรวจ</h2>
  <p className="small text-muted">ค้นหาจากทะเบียนประชากรตามสิทธิ์ของคุณ ไม่จำกัดกลุ่มเป้าหมายคัดกรอง</p>
  <form onSubmit={search} className="row g-2">
   <div className="col-12 col-md-3"><label htmlFor="survey-person-mode" className="form-label">ค้นหาด้วย</label><select id="survey-person-mode" className="form-select" value={mode} onChange={e=>{reset();setMode(e.target.value);setQuery('');}}><option value="name">ชื่อ / นามสกุล</option><option value="cid">เลขบัตรประชาชน</option></select></div>
   <div className="col-12 col-md-6"><label htmlFor="survey-person-query" className="form-label">คำค้น</label><input id="survey-person-query" className="form-control" value={query} maxLength={100} inputMode={mode==='cid'?'numeric':'text'} autoComplete="off" placeholder={mode==='cid'?'เลขบัตร 13 หลัก':'ชื่อ นามสกุล (ไม่ต้องใส่คำนำหน้า)'} onChange={e=>{reset();setQuery(e.target.value);}} /></div>
   <div className="col-12 col-md-3 d-flex align-items-end"><button className="btn btn-primary w-100" disabled={loading||busy}>{loading?'กำลังค้นหา…':'ค้นหาบุคคล'}</button></div>
  </form>
  <p className="small mt-2 mb-0" role="status">{message}</p>
  {rows?.map(p=><div key={p.person_id} className="border rounded p-3 mt-2 d-flex flex-wrap gap-2 justify-content-between align-items-center"><div><strong>{p.title}{p.fname} {p.lname}</strong><div className="small text-muted">เลขบัตร •••••••••{String(p.cid||'').slice(-4)} · บ้าน {p.house||'ยังไม่ระบุ'} หมู่ {p.moo||'ยังไม่ระบุ'}</div></div><button type="button" className="btn btn-outline-primary" disabled={busy||!p.house||!p.moo} onClick={()=>onOpenHouse(String(p.moo),String(p.house))}>เปิดบ้านเพื่อสำรวจ</button></div>)}
 </div></section>;
}
