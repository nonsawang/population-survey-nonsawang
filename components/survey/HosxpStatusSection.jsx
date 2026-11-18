'use client';
import { useState, useEffect } from 'react';
import { getSwal } from '@/lib/survey-feedback';
import { RESIDENCY_TYPES, DISCHARGE_TYPES } from '@/lib/population-status';

const FRIENDLY_RESIDENCY = {
  '1': {
    icon: '🏠',
    title: 'อยู่บ้านนี้จริง (มีชื่อในทะเบียนบ้าน)',
    sub: 'Type 1 — มีชื่อในทะเบียนบ้าน และตัวอาศัยอยู่จริง',
    badgeClass: 'bg-success-subtle text-success border-success-subtle',
  },
  '2': {
    icon: '🧳',
    title: 'ไปทำงาน/เรียนต่างถิ่น (มีแต่ชื่อ ไม่อยู่จริง)',
    sub: 'Type 2 — มีชื่อในทะเบียนบ้าน แต่ตัวไม่ได้อยู่อาศัย',
    badgeClass: 'bg-warning-subtle text-warning-emphasis border-warning-subtle',
  },
  '3': {
    icon: '👋',
    title: 'มาอาศัยอยู่บ้านนี้จริง (แต่ชื่ออยู่บ้านอื่น)',
    sub: 'Type 3 — ไม่มีชื่อในทะเบียนบ้านนี้ แต่ตัวมาอยู่อาศัยจริง',
    badgeClass: 'bg-info-subtle text-info-emphasis border-info-subtle',
  },
  '0': {
    icon: '⛺',
    title: 'มาอาศัยในเขต (ไม่อยู่ตามทะเบียนบ้าน)',
    sub: 'Type 0 — มาอาศัยในเขตแต่ไม่อยู่ตามทะเบียนบ้าน',
    badgeClass: 'bg-secondary-subtle text-secondary-emphasis border-secondary-subtle',
  },
  '4': {
    icon: '🌍',
    title: 'บุคคลนอกเขตรับผิดชอบ',
    sub: 'Type 4 — บุคคลนอกเขต',
    badgeClass: 'bg-secondary-subtle text-secondary-emphasis border-secondary-subtle',
  },
};

const FRIENDLY_DISCHARGE = {
  '9': {
    icon: '💚',
    title: 'ปกติ (ยังมีชีวิต)',
    badgeClass: 'bg-success-subtle text-success border-success-subtle',
  },
  '1': {
    icon: '🕊️',
    title: 'เสียชีวิตแล้ว',
    badgeClass: 'bg-danger-subtle text-danger border-danger-subtle',
  },
  '2': {
    icon: '🚚',
    title: 'ย้ายออกไปแล้ว',
    badgeClass: 'bg-warning-subtle text-warning-emphasis border-warning-subtle',
  },
  '3': {
    icon: '❓',
    title: 'สาบสูญ',
    badgeClass: 'bg-secondary-subtle text-secondary-emphasis border-secondary-subtle',
  },
};

export default function HosxpStatusSection({
  person,
  saving,
  doSave,
  onMove,
  pendingTransfer,
  user,
  focused,
}) {
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (focused) setEditing(true);
  }, [focused]);

  const [typeValue, setTypeValue] = useState(person.residencyType);
  const [dischargeValue, setDischargeValue] = useState(person.dischargeCode || '9');
  useEffect(() => {
    setTypeValue(person.residencyType);
    setDischargeValue(person.dischargeCode || '9');
  }, [person.residencyType, person.dischargeCode]);

  const activeTransfer = pendingTransfer || person.pendingTransfer || null;
  const canMove = !user || ['admin', 'staff', 'vhv'].includes(user.role);
  const isStaff = user && ['admin', 'staff'].includes(user.role);

  const friendlyRes = FRIENDLY_RESIDENCY[String(person.residencyType)] || null;
  const friendlyDis = FRIENDLY_DISCHARGE[String(person.dischargeCode)] || null;

  const cancelEdit = () => {
    setTypeValue(person.residencyType);
    setDischargeValue(person.dischargeCode || '9');
    setEditing(false);
  };

  return (
    <div>
      {/* สรุปสถานะปัจจุบันด้วยภาษาชาวบ้าน ตัวใหญ่ อ่านง่าย */}
      <div className="p-2 rounded-3 bg-white border mb-2">
        <div className="mb-2">
          <div className="text-muted small fw-semibold mb-1">การอยู่อาศัยปัจจุบัน:</div>
          {friendlyRes ? (
            <div
              className={`p-2 rounded-3 border fw-bold ${friendlyRes.badgeClass}`}
              style={{ fontSize: '.96rem' }}
            >
              {friendlyRes.icon} {friendlyRes.title}
            </div>
          ) : (
            <div
              className="p-2 rounded-3 border bg-warning-subtle text-warning-emphasis border-warning-subtle fw-bold"
              style={{ fontSize: '.96rem' }}
            >
              ⚠️ ยังไม่ระบุการอยู่อาศัย (กรุณากดเลือกด้านล่าง)
            </div>
          )}
        </div>

        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
          <span className="text-muted small fw-semibold">สถานะบุคคล:</span>
          {friendlyDis ? (
            <span
              className={`badge border px-3 py-2 ${friendlyDis.badgeClass}`}
              style={{ fontSize: '.88rem', borderRadius: 10 }}
            >
              {friendlyDis.icon} {friendlyDis.title}
            </span>
          ) : (
            <span
              className="badge bg-warning-subtle text-warning-emphasis border px-3 py-2"
              style={{ fontSize: '.88rem', borderRadius: 10 }}
            >
              ⚠️ รอตรวจสอบสถานะ
            </span>
          )}
        </div>
      </div>

      {/* แสดงหมายเหตุเทคนิคเฉพาะเจ้าหน้าที่ (ไม่แสดงให้ อสม. สับสน) */}
      {isStaff && (
        <p className="small text-muted mb-2">
          ข้อมูลสำรวจบนเว็บจะเข้าคิวตรวจสอบก่อนส่งเข้า HOSxP ผ่านเครื่องแม่ข่าย LAN
        </p>
      )}

      {notice && (
        <div role="status" className="alert alert-success py-2 px-3 small mb-2">
          ✅ {notice}
        </div>
      )}

      {!person.statusSchemaReady && isStaff && (
        <p className="small text-danger" role="status">
          ต้องรัน migration สถานะ HOSxP ใน Supabase ก่อนบันทึก
        </p>
      )}

      {person.needsStatusReview && (
        <div className="alert alert-warning py-2 px-3 small mb-2" style={{ borderRadius: 10 }}>
          👆 กรุณากดปุ่ม <strong>“เปลี่ยนสถานะการอยู่อาศัย”</strong> ด้านล่างเพื่อระบุว่าปัจจุบันคนนี้อยู่ที่บ้านนี้หรือไม่
        </div>
      )}

      {activeTransfer && (
        <div
          className="alert alert-warning py-2 px-3 mb-2 small"
          style={{ borderRadius: 10 }}
        >
          <strong>⏳ แจ้งย้ายบ้านไว้แล้ว:</strong> รอย้ายเข้า บ้านเลขที่ {activeTransfer.toHouse}{' '}
          ม.{activeTransfer.toMoo}
        </div>
      )}

      {/* ปุ่มหลักขนาดใหญ่ 2 ปุ่ม: เปลี่ยนสถานะอยู่อาศัย & แจ้งย้ายบ้าน */}
      <div className="row g-2 mt-1">
        <div className={canMove ? 'col-12 col-sm-6' : 'col-12'}>
          <button
            type="button"
            className={`btn w-100 fw-bold ${
              editing
                ? 'btn-secondary'
                : person.needsStatusReview
                ? 'btn-warning text-dark'
                : 'btn-outline-primary'
            }`}
            style={{ minHeight: 48, fontSize: '.95rem', borderRadius: 12 }}
            disabled={saving}
            aria-expanded={editing}
            aria-controls={'status-editor-' + person.personId}
            onClick={() => {
              if (editing) cancelEdit();
              else {
                setNotice('');
                setEditing(true);
              }
            }}
          >
            {editing ? 'ปิดหน้าต่างแก้ไข ▲' : '✏️ เปลี่ยนการอยู่อาศัย / แจ้งเสียชีวิต ▼'}
          </button>
        </div>

        {canMove && (
          <div className="col-12 col-sm-6">
            <button
              type="button"
              onClick={() => onMove(person)}
              disabled={saving}
              className="btn btn-outline-secondary w-100 fw-bold"
              style={{ minHeight: 48, fontSize: '.95rem', borderRadius: 12 }}
            >
              🚚 {activeTransfer ? 'เปลี่ยนบ้านปลายทางที่ขอย้าย' : 'แจ้งย้ายไปบ้านเลขที่อื่น'}
            </button>
          </div>
        )}
      </div>

      {/* แผงเลือกสถานะแบบปุ่มใหญ่ กดง่ายสำหรับ อสม. สูงอายุ */}
      {editing && (
        <div
          id={'status-editor-' + person.personId}
          className="mt-3 p-3 border rounded-3 bg-white shadow-sm"
        >
          <fieldset disabled={saving}>
            <legend className="visually-hidden">แก้ไขสถานะในทะเบียนสำรวจ</legend>

            <div className="fw-bold text-dark mb-2" style={{ fontSize: '.98rem' }}>
              เลือกการอยู่อาศัยตามความจริง:
            </div>
            <div className="d-flex flex-column gap-2 mb-3">
              {['1', '2', '3', '0', '4'].map((code) => {
                const info = FRIENDLY_RESIDENCY[code];
                const selected = String(typeValue) === code;
                return (
                  <button
                    key={code}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setTypeValue(code)}
                    className={`btn text-start p-2 px-3 rounded-3 border ${
                      selected
                        ? 'btn-primary text-white fw-bold shadow-sm'
                        : 'btn-light text-dark'
                    }`}
                    style={{ minHeight: 52 }}
                  >
                    <div style={{ fontSize: '.96rem' }}>
                      {selected ? '✅ ' : '⬜ '}
                      {info.icon} {info.title}
                    </div>
                    <div
                      className={selected ? 'text-white-50' : 'text-muted'}
                      style={{ fontSize: '.76rem' }}
                    >
                      {info.sub}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="fw-bold text-dark mb-2" style={{ fontSize: '.98rem' }}>
              สถานะบุคคล (กรณีเสียชีวิต / ย้ายออกนอกพื้นที่):
            </div>
            <div className="row g-2 mb-2">
              {DISCHARGE_TYPES.map((item) => {
                const info = FRIENDLY_DISCHARGE[item.code] || {
                  icon: '•',
                  title: item.label,
                };
                const selected = String(dischargeValue) === item.code;
                return (
                  <div key={item.code} className="col-6">
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setDischargeValue(item.code)}
                      className={`btn w-100 text-start px-3 py-2 rounded-3 border fw-semibold ${
                        selected
                          ? item.code === '9'
                            ? 'btn-success text-white'
                            : 'btn-danger text-white'
                          : 'btn-light text-dark'
                      }`}
                      style={{ minHeight: 48, fontSize: '.92rem' }}
                    >
                      {selected ? '✅ ' : ''}
                      {info.icon} {info.title}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="d-flex gap-2 mt-3">
              <button
                type="button"
                className="btn btn-primary flex-grow-1 fw-bold"
                style={{ minHeight: 50, fontSize: '1rem', borderRadius: 12 }}
                disabled={saving || !dischargeValue || !person.statusSchemaReady}
                onClick={async () => {
                  if (dischargeValue !== person.dischargeCode) {
                    const label = DISCHARGE_TYPES.find(
                      (item) => item.code === dischargeValue
                    )?.label;
                    const S = getSwal();
                    const confirmed = S
                      ? (
                          await S.fire({
                            title: 'ยืนยันการเปลี่ยนสถานะบุคคล',
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
                    setNotice('บันทึกสถานะการอยู่อาศัยเรียบร้อยแล้ว');
                  }
                }}
              >
                {saving ? 'กำลังบันทึก…' : '💾 บันทึกสถานะการอยู่อาศัย'}
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary fw-semibold px-3"
                style={{ minHeight: 50, borderRadius: 12 }}
                onClick={cancelEdit}
              >
                ยกเลิก
              </button>
            </div>
          </fieldset>
        </div>
      )}
    </div>
  );
}
