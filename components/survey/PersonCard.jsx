'use client';
import { useState } from 'react';
import ChronicEditor from './ChronicEditor';
import { DISCHARGE_TYPES } from '@/lib/population-status';
import { swal } from '@/lib/survey-feedback';
import HosxpStatusSection from './HosxpStatusSection';
import RiskScreeningSection from './RiskScreeningSection';
import OvScreeningSection from './OvScreeningSection';

export default function PersonCard({ person, onSave, onMove, onRefresh, user, pendingTransfer, defaultExpanded = false }) {
  const [relValue, setRelValue] = useState(person.relation);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [menuOpen, setMenuOpen] = useState(false);

  const doSave = async (type, discharge = person.dischargeCode, changes = {}) => {
    if (!person.statusSchemaReady) { swal({ icon:'info', title:'ต้องปรับตาราง Supabase ก่อน', text:'รัน migration สถานะ HOSxP แล้วโหลดหน้านี้ใหม่' }); return false; }
    if (!DISCHARGE_TYPES.some(item => item.code === discharge)) { swal({ icon: 'warning', title: 'กรุณาระบุเหตุจำหน่ายก่อน', text: 'ข้อมูล Type 0 เดิมยังไม่มีเหตุจำหน่ายที่ตรงกับ HOSxP' }); return false; }
    setSaving(true);
    try { return await onSave(person.personId, type, changes.relation ?? relValue, changes.chronic ?? person.chronic ?? '-', discharge); }
    finally { setSaving(false); }
  };

  const rels = ['เจ้าบ้าน', 'ผู้อาศัย', 'บิดา/มารดา', 'เขย/สะใภ้', 'บุตร/หลาน', 'เช่าอาศัย', 'อื่นๆ'];
  const activeTransfer = pendingTransfer || person.pendingTransfer || null;
  const canMove = !user || ['admin', 'staff', 'vhv'].includes(user.role);

  const missingItems = [];
  if (!person.residencyType) missingItems.push('สถานะ Type');
  if (!person.chronic || person.chronic === '-') missingItems.push('โรคประจำตัว');
  if (!person.smokingStatus || !person.alcoholStatus) missingItems.push('บุหรี่/สุรา');
  if (person.age >= 15 && (!person.ovAnswers || !person.ovAnswers.q1)) missingItems.push('OV');

  return (
    <div className={`card card-person border-type${person.residencyType} fade-in mb-2`} style={{ opacity: saving ? 0.6 : 1, pointerEvents: saving ? 'none' : 'auto', borderRadius: 14 }}>
      {saving && <div style={{ position: 'absolute', top: 12, right: 44, zIndex: 5 }}><span className="spinner-border spinner-border-sm text-primary" /></div>}
      <div className="card-body p-3">
        {/* Accordion Header (Tap to expand/collapse) */}
        <div className="d-flex justify-content-between align-items-start gap-2">
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="btn btn-link text-start text-decoration-none p-0 flex-grow-1"
            aria-expanded={expanded}
          >
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <h6 className="fw-bold mb-0" style={{ color: 'var(--primary)', fontSize: '1.02rem' }}>
                {person.fullname}
              </h6>
              <span className="badge bg-light text-dark border" style={{ fontSize: '.78em' }}>อายุ {person.age}</span>
            </div>
            <div className="d-flex align-items-center gap-1 flex-wrap mt-1">
              {missingItems.length === 0 ? (
                <span className="badge bg-success-subtle text-success border border-success-subtle" style={{ fontSize: '.72rem' }}>
                  ✓ ครบแล้ว
                </span>
              ) : (
                <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle" style={{ fontSize: '.72rem' }}>
                  ⏳ ขาด: {missingItems.join(', ')}
                </span>
              )}
              {activeTransfer && (
                <span className="badge bg-warning text-dark" style={{ fontSize: '.7rem' }}>
                  ⏳ รอย้ายเข้า ม.{activeTransfer.toMoo} บ้าน {activeTransfer.toHouse}
                </span>
              )}
            </div>
          </button>

          <div className="d-flex align-items-center gap-1 position-relative">
            {canMove && (
              <>
                <button
                  type="button"
                  onClick={() => setMenuOpen(v => !v)}
                  className="btn btn-sm btn-light border rounded-circle d-flex align-items-center justify-content-center"
                  style={{ width: 36, height: 36 }}
                  aria-label="เมนูเพิ่มเติม"
                >
                  <i className="fa-solid fa-ellipsis-vertical" />
                </button>
                {menuOpen && (
                  <div
                    className="card shadow border position-absolute end-0 mt-1 p-1"
                    style={{ top: '100%', zIndex: 20, minWidth: 210, borderRadius: 12 }}
                  >
                    <button
                      type="button"
                      onClick={() => { setMenuOpen(false); onMove(person); }}
                      className="btn btn-sm btn-light text-start w-100 fw-semibold py-2"
                    >
                      <i className="fa-solid fa-truck-moving text-warning me-2" />
                      {activeTransfer ? 'เปลี่ยนบ้านปลายทางที่ขอย้าย' : 'ย้ายบ้านในทะเบียนสำรวจ'}
                    </button>
                  </div>
                )}
              </>
            )}
            <button
              type="button"
              onClick={() => setExpanded(v => !v)}
              className="btn btn-sm btn-light border rounded-circle d-flex align-items-center justify-content-center"
              style={{ width: 36, height: 36 }}
              aria-label={expanded ? 'พับการ์ด' : 'กางการ์ด'}
            >
              <i className={`fa-solid fa-chevron-${expanded ? 'up' : 'down'}`} />
            </button>
          </div>
        </div>

        {/* Collapsible Body */}
        {expanded && (
          <div className="mt-3 pt-2 border-top fade-in">
            {/* Relation + Chronic */}
            <div className="row g-2 mb-3 p-2 rounded-3 mx-0" style={{ background: '#f8f9fa' }}>
              <div className="col-12 col-sm-6 px-1">
                <label className="text-muted" style={{ fontSize: '.68em', fontWeight: 600 }}>สถานะในบ้าน</label>
                <select className="form-select form-select-sm border-0 fw-bold" style={{ fontSize: '.85rem', color: 'var(--primary)', minHeight: 40 }} value={relValue} onChange={e => { setRelValue(e.target.value); doSave(person.residencyType, person.dischargeCode, { relation: e.target.value }); }}>
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
        )}
      </div>
    </div>
  );
}
