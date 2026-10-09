'use client';
import { useEffect, useRef, useState } from 'react';
import { closeRightsPrice } from '@/lib/close-rights-prices.mjs';
import { readCard } from '@/lib/eform-card.mjs';
import { validateCID } from '@/lib/utils';
import { maskedScreeningCid } from '@/lib/screening-search';

export default function CloseRightsReview({ person, kpi, serviceName, date, result, saved, busy }) {
  const price=closeRightsPrice(kpi);
  const [reading, setReading] = useState(false);
  const [readiness,setReadiness]=useState(null);
  const [checking,setChecking]=useState(false);
  const readinessLock=useRef(false);
  async function checkReadiness(){
    if(readinessLock.current || pending.current)return;
    readinessLock.current=true;setChecking(true);setReadiness(null);
    const version=generation.current;
    try{
      const response=await fetch('/api/close-rights/readiness',{method:'POST',credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});
      const data=await response.json();
      if(version!==generation.current)return;
      if(!response.ok)throw Error();
      setReadiness(data);
    }catch{if(version===generation.current)setReadiness({error:'ตรวจความพร้อมไม่สำเร็จ กรุณาตรวจการเข้าสู่ระบบแล้วลองใหม่'});}
    finally{readinessLock.current=false;if(version===generation.current)setChecking(false);}
  }
  const [matched, setMatched] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [message, setMessage] = useState('');
  const pending = useRef(false);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);
  async function verifyCard() {
    if (pending.current || readinessLock.current || busy) return;
    pending.current = true;
    const request = ++generation.current;
    setReading(true); setMatched(false); setReviewed(false); setMessage('กำลังอ่านบัตร…');
    try {
      const card = await readCard();
      if (request !== generation.current) return;
      if (!validateCID(card.cid).valid || card.cid !== String(person.cid || '').trim()) {
        setMessage('เลขบัตรไม่ตรงกับรายการที่เลือก กรุณาตรวจผู้รับบริการและเลือกบุคคลใหม่');
        return;
      }
      setMatched(true);
      setMessage('เลขบัตรตรงกับผู้รับบริการที่เลือก กรุณาตรวจวันที่และรายการด้านล่าง');
    } catch {
      if (request === generation.current) setMessage('อ่านบัตรไม่สำเร็จ กรุณาตรวจ E-Form Agent และเครื่องอ่าน แล้วลองใหม่');
    } finally {
      pending.current = false;
      if (request === generation.current) setReading(false);
    }
  }
  return <section className="card border-warning mt-3" aria-label="ตรวจรายการก่อนปิดสิทธิ์">
    <div className="card-body">
      <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-2">
        <h6 className="fw-bold mb-0">ปิดสิทธิ์โดยเจ้าหน้าที่</h6>
        <span className="badge text-bg-warning">ยังไม่เปิดส่งจริง</span>
      </div>
      <p className="small text-muted">อ่านบัตร → ตรวจรายการ → กดปิดสิทธิ์ด้วยตนเอง การบันทึกผลคัดกรองไม่ใช่การปิดสิทธิ์</p>
      <button type="button" className="btn btn-outline-primary w-100" onClick={verifyCard} disabled={reading || checking || busy}>
        {reading ? 'กำลังอ่านบัตร…' : '1. อ่านบัตรเพื่อตรวจผู้รับบริการ'}
      </button>
      <p role="status" aria-live="polite" className="small mt-2">{message}</p>
      {matched && <>
        <h6 className="fw-bold">2. ตรวจรายการคัดกรองที่เลือก</h6>
        <dl className="row small mb-2">
          <dt className="col-4">ผู้รับบริการ</dt><dd className="col-8">{person.name}</dd>
          <dt className="col-4">เลขบัตร</dt><dd className="col-8">{maskedScreeningCid(person.cid)}</dd>
          <dt className="col-4">บริการ</dt><dd className="col-8">{serviceName}</dd>
          <dt className="col-4">วันที่คัดกรอง</dt><dd className="col-8">{date || 'ยังไม่ระบุ'}</dd>
          <dt className="col-4">ผลคัดกรอง</dt><dd className="col-8">{result || 'ยังไม่ระบุ'}{!saved && ' (ยังไม่ได้บันทึกการเปลี่ยนแปลง)'}</dd>
        </dl>
        <div className="border rounded p-3 mb-3 bg-light">
          <h6 className="fw-bold">ค่าบริการที่ต้องตรวจสอบ</h6>
          <dl className="row small mb-0">
            <dt className="col-7">ค่าบริการรวมต่อคน</dt><dd className="col-5 text-end fw-bold">{price ? `${(price.totalSatang/100).toFixed(2)} บาท` : 'ยังไม่ได้กำหนด'}</dd>
            <dt className="col-7">ยอดที่เบิกได้</dt><dd className="col-5 text-end">รอตรวจสิทธิ</dd>
            <dt className="col-7">ยอดที่ผู้ป่วยต้องชำระ</dt><dd className="col-5 text-end">รอตรวจสิทธิ</dd>
          </dl>
          <p className="small text-muted mb-0">{price ? 'ราคา FIT ที่หน่วยบริการกำหนด ยังไม่ได้เทียบรายการค่าใช้จ่ายใน HOSxP และไม่ใช่การยืนยันว่าสามารถเบิกได้เต็มจำนวน' : 'ต้องตรวจรายการค่าใช้จ่ายใน HOSxP ก่อนปิดสิทธิ์'}</p>
        </div>
        <label className="d-flex gap-2 align-items-start mb-3">
          <input type="checkbox" className="form-check-input" checked={reviewed} disabled={!saved || busy} onChange={e => setReviewed(e.target.checked)} />
          <span>ตรวจผู้รับบริการและข้อมูลคัดกรองข้างต้นแล้ว</span>
        </label>
      </>}
      <button type="button" className="btn btn-outline-secondary w-100 mb-2" disabled={checking || reading || busy} onClick={checkReadiness}>{checking?'กำลังตรวจความพร้อม…':'ตรวจความพร้อมของระบบปิดสิทธิ์'}</button>
      {readiness && <div className="alert alert-info small" role="status">
        {readiness.error || <><strong>ยังไม่พร้อมส่งปิดสิทธิ์</strong><ul className="mb-0 mt-2">{readiness.blockers?.map(item=><li key={item.code}>{item.message}</li>)}</ul><div className="mt-2">การตรวจนี้ยังไม่ได้ตรวจ visit หรือยืนยันสิทธิผู้ป่วย</div></>}
      </div>}
      <button type="button" className="btn btn-secondary w-100" disabled aria-describedby="close-rights-disabled-reason">3. ปิดสิทธิ์ — ยังไม่เปิดใช้งาน</button>
      <p id="close-rights-disabled-reason" className="small text-muted mt-2 mb-0">
        {matched && reviewed ? 'ตรวจข้อมูลคัดกรองแล้ว แต่ยังไม่ส่งคำขอ ' : ''}
        รอทดสอบ API Test Zone และตรวจ visit สิทธิการรักษา รหัสบริการ และยอดเงินจาก HOSxP ก่อนเปิดใช้งาน
      </p>
    </div>
  </section>;
}



