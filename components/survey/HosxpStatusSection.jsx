'use client';
import { useState, useEffect } from 'react';
import { getSwal } from '@/lib/survey-feedback';
import { RESIDENCY_TYPES, DISCHARGE_TYPES } from '@/lib/population-status';

export default function HosxpStatusSection({ person, saving, doSave, onMove, pendingTransfer, user }) {
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState('');
  const [typeValue, setTypeValue] = useState(person.residencyType);
  const [dischargeValue, setDischargeValue] = useState(person.dischargeCode);
  useEffect(() => {
    setTypeValue(person.residencyType);
    setDischargeValue(person.dischargeCode);
  }, [person.residencyType, person.dischargeCode]);

  const activeTransfer = pendingTransfer || person.pendingTransfer || null;
  const canMove = !user || ['admin', 'staff', 'vhv'].includes(user.role);
  const residency = RESIDENCY_TYPES.find(item => item.code === String(person.residencyType));
  const discharge = DISCHARGE_TYPES.find(item => item.code === String(person.dischargeCode));
  const cancelEdit = () => {
    setTypeValue(person.residencyType);
    setDischargeValue(person.dischargeCode);
    setEditing(false);
  };

  return (
    <div className="border rounded-3 p-3 my-3 bg-white">
      <h3 className="h6 fw-bold">ประเภทอยู่อาศัยและสถานะจำหน่าย</h3>
      <div className="small mb-2">
        <div><strong>ประเภทอยู่อาศัย: </strong>{residency ? `Type ${residency.code} — ${residency.label}` : 'ยังไม่ระบุ / รอตรวจสอบ'}</div>
        <div><strong>สถานะจำหน่าย: </strong>{discharge ? `${discharge.code} — ${discharge.label}` : 'รอตรวจเหตุจำหน่ายเดิม'}</div>
      </div>
      <p className="small text-muted mb-2">ข้อมูลจากทะเบียนสำรวจบนเว็บ การบันทึกนี้ไม่ได้เขียนเข้า HOSxP ทันที ต้องตรวจสอบก่อนส่งผ่านตัวเชื่อม</p>
      <p className="small text-muted">หน้านี้ยังไม่แสดงผลคิวส่ง HOSxP จึงไม่ใช้ยืนยันว่าเขียนสำเร็จแล้ว</p>
      {notice && <div role="status" className="alert alert-info py-2 small">{notice}</div>}
      {!person.statusSchemaReady && (
        <p className="small text-danger" role="status">
          ต้องรัน migration สถานะ HOSxP ใน Supabase ก่อนบันทึก
        </p>
      )}
      {person.needsStatusReview && (
        <p className="small text-warning-emphasis">
          {person.legacyDischarge
            ? 'Type 0 เดิมใช้ทั้งจำหน่ายและนอกเขต กรุณาตรวจประเภทอยู่อาศัยและสถานะจำหน่ายตามข้อเท็จจริง'
            : 'กรุณาตรวจประเภทอยู่อาศัยก่อนส่งข้อมูลเข้า HOSxP'}
        </p>
      )}
      {activeTransfer && (
        <div
          className="alert alert-warning py-2 px-3 mb-2 small d-flex align-items-center justify-content-between flex-wrap gap-2"
          style={{ borderRadius: 10 }}
        >
          <div>
            <strong>⏳ รอยืนยันย้ายเข้า (ทะเบียนสำรวจ):</strong> บ้านเลขที่ {activeTransfer.toHouse} ม.{activeTransfer.toMoo}
            <span className="text-muted ms-1">
              (รอ อสม.หมู่ {activeTransfer.toMoo} หรือเจ้าหน้าที่กดยืนยัน)
            </span>
          </div>
        </div>
      )}
      <button type="button" className="btn btn-outline-primary btn-sm" disabled={saving}
        aria-expanded={editing} aria-controls={'status-editor-' + person.personId}
        onClick={() => { if (editing) cancelEdit(); else { setNotice(''); setEditing(true); } }}>
        {editing ? 'ยกเลิกการแก้ไข' : 'ตรวจ / แก้ไขสถานะ'}
      </button>
      {editing && <div id={'status-editor-' + person.personId} className="mt-3">
      <fieldset disabled={saving}>
      <legend className="visually-hidden">แก้ไขสถานะในทะเบียนสำรวจ</legend>
      <div className="row g-2">
        <div className="col-12 col-md-7">
          <label className="form-label" htmlFor={'residency-' + person.personId}>
            ประเภทอยู่อาศัย
          </label>
          <select
            id={'residency-' + person.personId}
            className="form-select"
            value={typeValue}
            onChange={(e) => setTypeValue(e.target.value)}
          >
            <option value="">ยังไม่ระบุ</option>
            {RESIDENCY_TYPES.map((item) => (
              <option key={item.code} value={item.code}>
                Type {item.code} — {item.label}
              </option>
            ))}
          </select>
        </div>
        <div className="col-12 col-md-5">
          <label className="form-label" htmlFor={'discharge-' + person.personId}>
            สถานะจำหน่าย
          </label>
          <select
            id={'discharge-' + person.personId}
            className="form-select"
            value={dischargeValue}
            onChange={(e) => setDischargeValue(e.target.value)}
          >
            <option value="" disabled>
              รอตรวจเหตุจำหน่ายเดิม
            </option>
            {DISCHARGE_TYPES.map((item) => (
              <option key={item.code} value={item.code}>
                {item.code} — {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <button
        type="button"
        className="btn btn-primary w-100 mt-3"
        disabled={saving || !dischargeValue || !person.statusSchemaReady}
        onClick={async () => {
          if (dischargeValue !== person.dischargeCode) {
            const label = DISCHARGE_TYPES.find((item) => item.code === dischargeValue)?.label;
            const S = getSwal();
            const confirmed = S
              ? (
                  await S.fire({
                    title: 'ยืนยันเปลี่ยนสถานะจำหน่าย',
                    text: person.fullname + ' → ' + label,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'ยืนยัน',
                    cancelButtonText: 'ยกเลิก',
                  })
                ).isConfirmed
              : window.confirm(person.fullname + ' → ' + label);
            if (!confirmed) return;
          }
          const saved = await doSave(typeValue, dischargeValue);
          if (saved === true) {
            setEditing(false);
            setNotice('บันทึกในทะเบียนสำรวจแล้ว — ยังไม่ใช่หลักฐานว่าเขียนเข้า HOSxP สำเร็จ');
          }
        }}
      >
        บันทึกสถานะในทะเบียนสำรวจ
      </button>
      </fieldset>
      </div>}
      {canMove && (
        <button
          type="button"
          onClick={() => onMove(person)}
          className="btn btn-outline-secondary w-100 mt-2"
        >
          <i className="fa-solid fa-truck-moving me-1" />
          {activeTransfer ? 'เปลี่ยนบ้านปลายทางที่ขอย้าย (ทะเบียนสำรวจ)' : 'ย้ายบ้านในทะเบียนสำรวจ (ในหมู่ / ข้ามหมู่)'}
        </button>
      )}
    </div>
  );
}
