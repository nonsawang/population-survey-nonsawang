'use client';
import { useState, useEffect } from 'react';
import { CHRONIC_LIST } from '@/lib/utils';
import { DISCHARGE_TYPES } from '@/lib/population-status';
import { swal } from '@/lib/survey-feedback';
import HosxpStatusSection from './HosxpStatusSection';
import RiskScreeningSection from './RiskScreeningSection';
import OvScreeningSection from './OvScreeningSection';
export default function PersonCard({ person, onSave, onMove, onRefresh, user }) {
  const [relValue, setRelValue] = useState(person.relation);
  const [chronicValue, setChronicValue] = useState('');
  const [chronicOther, setChronicOther] = useState('');
  const [showOther, setShowOther] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const cc = (!person.chronic || person.chronic === '-') ? 'ปกติ (ไม่มีโรค)' : person.chronic;
    if (CHRONIC_LIST.includes(cc)) { setChronicValue(cc); setShowOther(false); }
    else { setChronicValue('__OTHER__'); setChronicOther(cc); setShowOther(true); }
  }, [person.chronic]);

  const getChronicFinal = () => chronicValue === '__OTHER__' ? (chronicOther.trim() || '-') : chronicValue;

  const doSave = async (type, discharge = person.dischargeCode, changes = {}) => {
    if (!person.statusSchemaReady) { swal({ icon:'info', title:'ต้องปรับตาราง Supabase ก่อน', text:'รัน migration สถานะ HOSxP แล้วโหลดหน้านี้ใหม่' }); return; }
    if (!DISCHARGE_TYPES.some(item => item.code === discharge)) { swal({ icon: 'warning', title: 'กรุณาระบุเหตุจำหน่ายก่อน', text: 'ข้อมูล Type 0 เดิมยังไม่มีเหตุจำหน่ายที่ตรงกับ HOSxP' }); return; }
    setSaving(true);
    try { await onSave(person.personId, type, changes.relation ?? relValue, changes.chronic ?? getChronicFinal(), discharge); }
    finally { setSaving(false); }
  };

  const rels = ['เจ้าบ้าน', 'ผู้อาศัย', 'บิดา/มารดา', 'เขย/สะใภ้', 'บุตร/หลาน', 'เช่าอาศัย', 'อื่นๆ'];

  return (
    <div className={`card card-person border-type${person.residencyType} fade-in`} style={{ opacity: saving ? 0.6 : 1, pointerEvents: saving ? 'none' : 'auto' }}>
      {saving && <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 5 }}><span className="spinner-border spinner-border-sm text-primary" /></div>}
      <div className="card-body p-3">
        {/* Header */}
        <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap mb-2">
          <h6 className="fw-bold mb-0" style={{ color: 'var(--primary)' }}>
            {person.fullname}
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
            <select className="form-select form-select-sm border-0 fw-bold text-danger" style={{ fontSize: '.85rem' }} value={chronicValue} onChange={e => { setChronicValue(e.target.value); setShowOther(e.target.value === '__OTHER__'); if (e.target.value !== '__OTHER__') doSave(person.residencyType, person.dischargeCode, { chronic: e.target.value }); }}>
              {CHRONIC_LIST.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="__OTHER__">อื่นๆ (ระบุ)</option>
            </select>
            {showOther && (
              <div className="input-group input-group-sm mt-1">
                <input type="text" className="form-control border-danger" style={{ fontSize: '.8rem' }} placeholder="ระบุโรค..." value={chronicOther} onChange={e => setChronicOther(e.target.value)} onKeyDown={e => e.key === 'Enter' && doSave(person.residencyType)} />
                <button className="btn btn-danger btn-sm" onClick={() => doSave(person.residencyType)}><i className="fa-solid fa-check" /></button>
              </div>
            )}
          </div>
        </div>

        <HosxpStatusSection person={person} saving={saving} doSave={doSave} onMove={onMove} />
        <RiskScreeningSection person={person} user={user} onRefresh={onRefresh} saving={saving} setSaving={setSaving} />
        {person.age >= 15 && <OvScreeningSection person={person} user={user} onRefresh={onRefresh} saving={saving} setSaving={setSaving} />}
      </div>
    </div>
  );
}

