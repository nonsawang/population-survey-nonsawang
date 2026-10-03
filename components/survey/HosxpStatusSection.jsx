'use client';
import { useState, useEffect } from 'react';
import { getSwal } from '@/lib/survey-feedback';
import { RESIDENCY_TYPES, DISCHARGE_TYPES } from '@/lib/population-status';
export default function HosxpStatusSection({person, saving, doSave, onMove}) {
  const [typeValue, setTypeValue] = useState(person.residencyType);
  const [dischargeValue, setDischargeValue] = useState(person.dischargeCode);
  useEffect(() => { setTypeValue(person.residencyType); setDischargeValue(person.dischargeCode); }, [person.residencyType, person.dischargeCode]);

return (
        <div className="border rounded-3 p-3 my-3 bg-white">
          <h3 className="h6 fw-bold">สถานะตาม HOSxP</h3>
          {!person.statusSchemaReady && <p className="small text-danger" role="status">ต้องรัน migration สถานะ HOSxP ใน Supabase ก่อนบันทึก</p>}
          {person.needsStatusReview && <p className="small text-warning-emphasis">{person.legacyDischarge ? 'Type 0 เดิมใช้ทั้งจำหน่ายและนอกเขต กรุณาตรวจประเภทอยู่อาศัยและสถานะจำหน่ายตามข้อเท็จจริง' : 'กรุณาตรวจประเภทอยู่อาศัยก่อนส่งข้อมูลเข้า HOSxP'}</p>}
          <div className="row g-2">
            <div className="col-12 col-md-7"><label className="form-label" htmlFor={'residency-' + person.personId}>ประเภทอยู่อาศัย</label><select id={'residency-' + person.personId} className="form-select" value={typeValue} onChange={e => setTypeValue(e.target.value)}><option value="">ยังไม่ระบุ</option>{RESIDENCY_TYPES.map(item => <option key={item.code} value={item.code}>Type {item.code} — {item.label}</option>)}</select></div>
            <div className="col-12 col-md-5"><label className="form-label" htmlFor={'discharge-' + person.personId}>สถานะจำหน่าย</label><select id={'discharge-' + person.personId} className="form-select" value={dischargeValue} onChange={e => setDischargeValue(e.target.value)}><option value="" disabled>รอตรวจเหตุจำหน่ายเดิม</option>{DISCHARGE_TYPES.map(item => <option key={item.code} value={item.code}>{item.code} — {item.label}</option>)}</select></div>
          </div>
          <button type="button" className="btn btn-primary w-100 mt-3" disabled={saving || !dischargeValue || !person.statusSchemaReady} onClick={async () => {
            if (dischargeValue !== person.dischargeCode) {
              const label = DISCHARGE_TYPES.find(item => item.code === dischargeValue)?.label;
              const S = getSwal();
              const confirmed = S ? (await S.fire({ title: 'ยืนยันเปลี่ยนสถานะจำหน่าย', text: person.fullname + ' → ' + label, icon: 'warning', showCancelButton: true, confirmButtonText: 'ยืนยัน', cancelButtonText: 'ยกเลิก' })).isConfirmed : window.confirm(person.fullname + ' → ' + label);
              if (!confirmed) return;
            }
            await doSave(typeValue, dischargeValue);
          }}>บันทึกประเภทอยู่อาศัยและสถานะจำหน่าย</button>
          <button type="button" onClick={() => onMove(person)} className="btn btn-outline-secondary w-100 mt-2">ย้ายบ้านภายในพื้นที่</button>
        </div>

);
}
