'use client';
import { useState } from 'react';
import ChronicEditor from './ChronicEditor';
import { DISCHARGE_TYPES } from '@/lib/population-status';
import { swal } from '@/lib/survey-feedback';
import HosxpStatusSection from './HosxpStatusSection';
import RiskScreeningSection from './RiskScreeningSection';
import OvScreeningSection from './OvScreeningSection';
export default function PersonCard({ person, onSave, onMove, onRefresh, user, pendingTransfer }) {
  const [relValue, setRelValue] = useState(person.relation);
  const [saving, setSaving] = useState(false);
  const doSave = async (type, discharge = person.dischargeCode, changes = {}) => {
    if (!person.statusSchemaReady) { swal({ icon:'info', title:'ต้องปรับตาราง Supabase ก่อน', text:'รัน migration สถานะ HOSxP แล้วโหลดหน้านี้ใหม่' }); return false; }
    if (!DISCHARGE_TYPES.some(item => item.code === discharge)) { swal({ icon: 'warning', title: 'กรุณาระบุเหตุจำหน่ายก่อน', text: 'ข้อมูล Type 0 เดิมยังไม่มีเหตุจำหน่ายที่ตรงกับ HOSxP' }); return false; }
    setSaving(true);
    try { return await onSave(person.personId, type, changes.relation ?? relValue, changes.chronic ?? person.chronic ?? '-', discharge); }
    finally { setSaving(false); }
  };

  const rels = ['เจ้าบ้าน', 'ผู้อาศัย', 'บิดา/มารดา', 'เขย/สะใภ้', 'บุตร/หลาน', 'เช่าอาศัย', 'อื่นๆ'];
  const activeTransfer = pendingTransfer || person.pendingTransfer || null;

  return (
    <div className={`card card-person border-type${person.residencyType} fade-in`} style={{ opacity: saving ? 0.6 : 1, pointerEvents: saving ? 'none' : 'auto' }}>
      {saving && <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 5 }}><span className="spinner-border spinner-border-sm text-primary" /></div>}
      <div className="card-body p-3">
        {/* Header */}
        <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap mb-2">
          <h6 className="fw-bold mb-0" style={{ color: 'var(--primary)' }}>
            {person.fullname}
            {activeTransfer && (
              <span className="badge bg-warning text-dark ms-1" style={{ fontSize: '.68rem' }}>
                ⏳ รอยืนยันย้ายเข้า ม.{activeTransfer.toMoo} บ้าน {activeTransfer.toHouse}
              </span>
            )}
            {person.smokingStatus && person.smokingStatus !== '-' && person.smokingStatus !== '' && <span className="badge ms-1" style={{ fontSize: '.65rem', background: '#6f42c1', color: 'white' }}><i className="fa-solid fa-smoking me-1" />{person.smokingStatus === 'สูบ' ? 'สูบ' : 'เลิกแล้ว'}</span>}
            {person.alcoholStatus && person.alcoholStatus !== '-' && person.alcoholStatus !== '' && <span className="badge ms-1" style={{ fontSize: '.65rem', background: '#0d6efd', color: 'white' }}><i className="fa-solid fa-wine-bottle me-1" />{person.alcoholStatus === 'ดื่ม' ? 'ดื่ม' : 'เลิกแล้ว'}</span>}
          </h6>
          <span className="badge bg-light text-dark border" style={{ fontSize: '.8em' }}>อายุ {person.age}</span>
        </div>

        {/* Relation + Chronic */}
        <div className="row g-2 mb-3 p-2 rounded-3 mx-0" style={{ background: '#f8f9fa' }}>
          <div className="col-12 col-sm-6 px-1">
            <label className="text-muted" style={{ fontSize: '.68em', fontWeight: 600 }}>สถานะในบ้าน</label>
            <select className="form-select form-select-sm border-0 fw-bold" style={{ fontSize: '.85rem', color: 'var(--primary)' }} value={relValue} onChange={e => { setRelValue(e.target.value); doSave(person.residencyType, person.dischargeCode, { relation: e.target.value }); }}>
              {rels.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="col-12 col-sm-6 px-1">
            <label className="text-muted" style={{ fontSize: '.68em', fontWeight: 600 }}>โรคประจำตัว</label>
            <ChronicEditor value={person.chronic} disabled={saving} onSave={chronic=>doSave(person.residencyType,person.dischargeCode,{chronic})} />
          </div>
        </div>

        <HosxpStatusSection person={person} saving={saving} doSave={doSave} onMove={onMove} pendingTransfer={activeTransfer} user={user} />
        <RiskScreeningSection person={person} user={user} onRefresh={onRefresh} saving={saving} setSaving={setSaving} />
        {person.age >= 15 && <OvScreeningSection person={person} user={user} onRefresh={onRefresh} saving={saving} setSaving={setSaving} />}
      </div>
    </div>
  );
}
