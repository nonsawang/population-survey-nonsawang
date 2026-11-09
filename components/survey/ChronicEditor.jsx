'use client';
import {useState} from 'react';
import {CHRONIC_CHOICES,NORMAL,chronicDraft,serializeChronic,parseChronicList,diseaseCount} from '@/lib/chronic.mjs';

export default function ChronicEditor({value,onSave,disabled}) {
  const [open,setOpen]=useState(false);
  const [draft,setDraft]=useState(()=>chronicDraft(value));
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const saved=parseChronicList(value),count=diseaseCount(saved);
  function toggle(name) {
    setDraft(d=>({ ...d,normal:false,selected:d.selected.includes(name)?d.selected.filter(x=>x!==name):[...d.selected,name] }));
  }
  async function save() {
    setBusy(true);setError('');
    try {
      if (await onSave(serializeChronic(draft)) === false) {setError('บันทึกไม่สำเร็จ แบบร่างยังอยู่ กรุณาตรวจข้อมูลแล้วลองใหม่');return;}
      setOpen(false);
    } catch {setError('บันทึกไม่สำเร็จ แบบร่างยังอยู่ กรุณาลองใหม่');}
    finally {setBusy(false);}
  }
  return <div>
    <div className="d-flex flex-wrap gap-1 my-1">
      {saved.length ? saved.map(name=><span key={name} className="badge text-wrap" style={{background:['#285d91','#8b4d85','#956814','#516f64'][Math.max(0,CHRONIC_CHOICES.indexOf(name))%4]}}>{name}</span>) : <span className="badge bg-light text-dark">{chronicDraft(value).normal?NORMAL:'ยังไม่ระบุ'}</span>}
      {count>=2 && <span className="badge bg-danger">มีโรคเรื้อรังร่วม {count} โรค</span>}
    </div>
    <button type="button" className="btn btn-sm btn-outline-primary" aria-expanded={open} disabled={disabled||busy} onClick={()=>{if(!open){setDraft(chronicDraft(value));setError('');}setOpen(!open);}}>แก้ไขโรค {open?'▴':'▾'}</button>
    {open && <fieldset className="border rounded p-2 mt-2" disabled={disabled||busy}>
      <legend className="small float-none w-auto">เลือกได้หลายโรค</legend>
      <div className="d-flex flex-wrap gap-2">
        <button type="button" aria-pressed={draft.normal} className={'btn '+(draft.normal?'btn-success':'btn-outline-success')} style={{minHeight:44}} onClick={()=>setDraft({normal:!draft.normal,selected:[],other:''})}>{draft.normal?'✓ ':''}{NORMAL}</button>
        {CHRONIC_CHOICES.map(name=><button key={name} type="button" aria-pressed={draft.selected.includes(name)} className={'btn '+(draft.selected.includes(name)?'btn-primary':'btn-outline-primary')} style={{minHeight:44}} onClick={()=>toggle(name)}>{draft.selected.includes(name)?'✓ ':''}{name}</button>)}
      </div>
      <label className="d-block mt-2">โรคอื่น ๆ (เพิ่มพร้อมโรคหลักได้)
        <input className="form-control" value={draft.other} maxLength={500} placeholder="เช่น เกาต์, ไทรอยด์" onChange={e=>setDraft(d=>({...d,other:e.target.value,normal:e.target.value.trim()?false:d.normal}))}/>
      </label>
      <small className="d-block text-muted">คั่นโรคด้วยลูกน้ำ • ไม่เลือกโรคและไม่เลือกปกติ = ยังไม่ระบุ • ติดเตียงเป็นสถานะการดูแล ไม่นับเพิ่มเป็นโรค</small>
      {error && <p role="alert" className="text-danger">{error}</p>}
      <button type="button" className="btn btn-primary mt-2" onClick={save}>{busy?'กำลังบันทึก…':'บันทึกโรคประจำตัว'}</button>
      <button type="button" className="btn btn-outline-secondary mt-2 ms-2" onClick={()=>setOpen(false)}>ยกเลิก</button>
    </fieldset>}
  </div>;
}
