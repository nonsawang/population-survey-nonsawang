'use client';
import { useState, useEffect } from 'react';
import ChronicEditor from './ChronicEditor';
import { DISCHARGE_TYPES } from '@/lib/population-status';
import { swal } from '@/lib/survey-feedback';
import HosxpStatusSection from './HosxpStatusSection';
import RiskScreeningSection from './RiskScreeningSection';
import OvScreeningSection from './OvScreeningSection';
import { supabase } from '@/lib/supabase';
import { SURVEY_LABELS } from '@/lib/survey-progress.mjs';
export default function PersonCard({ person, onSave, onMove, onRefresh, user, pendingTransfer, surveyProgress, progressError, progressLoading, focused, onSurveyConfirmed, onNextPending }) {
  const [relValue, setRelValue] = useState(person.relation);
  const [saving, setSaving] = useState(false);
  const [highlight, setHighlight] = useState(false);
  useEffect(() => {
    if (!focused) { setHighlight(false); return; }
    setHighlight(true);
    const timer = setTimeout(() => setHighlight(false), 4500);
    return () => clearTimeout(timer);
  }, [focused]);
  useEffect(() => { setRelValue(person.relation); }, [person.personId, person.relation]);
  const doSave = async (type, discharge = person.dischargeCode, changes = {}) => {
    if (!person.statusSchemaReady) { swal({ icon:'info', title:'ต้องปรับตาราง Supabase ก่อน', text:'รัน migration สถานะ HOSxP แล้วโหลดหน้านี้ใหม่' }); return false; }
    if (!DISCHARGE_TYPES.some(item => item.code === discharge)) { swal({ icon: 'warning', title: 'กรุณาระบุเหตุจำหน่ายก่อน', text: 'ข้อมูล Type 0 เดิมยังไม่มีเหตุจำหน่ายที่ตรงกับ HOSxP' }); return false; }
    setSaving(true);
    try { return await onSave(person.personId, type, changes.relation ?? relValue, changes.chronic ?? person.chronic ?? '-', discharge); }
    catch { swal({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: 'กรุณาลองใหม่ ข้อมูลที่เลือกยังไม่ได้รับการยืนยันว่าบันทึกสำเร็จ' }); return false; }
    finally { setSaving(false); }
  };

  const rels = ['เจ้าบ้าน', 'ผู้อาศัย', 'บิดา/มารดา', 'เขย/สะใภ้', 'บุตร/หลาน', 'เช่าอาศัย', 'อื่นๆ'];
  const activeTransfer = pendingTransfer || person.pendingTransfer || null;
  const confirmSurvey = async () => {
    if (!surveyProgress || saving) return;
    if (!window.confirm('ยืนยันว่าได้ตรวจสอบข้อมูลของ ' + person.fullname + ' แล้ว? การยืนยันนี้ไม่ส่งข้อมูลเข้า HOSxP')) return;
    setSaving(true);
    try {
      const {error} = await supabase.rpc('survey_confirm_person',{p_person_id:String(person.personId),p_expected:person.surveyExpected});
      if(error) {
        const message=String(error.message || '');
        throw new Error(message.includes('SURVEY_CHANGED') ? 'ข้อมูลเปลี่ยนแปลง กรุณาโหลดบ้านใหม่และตรวจสอบอีกครั้ง' : message.includes('SURVEY_INCOMPLETE') ? 'ข้อมูลยังไม่ครบ กรุณาตรวจช่องที่ขาด' : 'ยืนยันสำรวจไม่สำเร็จ กรุณาตรวจสิทธิ์และการติดตั้ง migration');
      }
      onSurveyConfirmed?.();
      swal({icon:'success',title:'ยืนยันสำรวจแล้ว',text:'บันทึกผู้ตรวจและเวลาแล้ว ไม่ใช่ผลส่ง HOSxP'});
    } catch(e) { swal({icon:'error',title:'ยังไม่ได้ยืนยันสำรวจ',text:e.message}); }
    finally {setSaving(false);}
  };

  return (
    <div id={'person-card-' + person.personId} tabIndex={-1} className={`card card-person border-type${person.residencyType} fade-in ${highlight ? 'border-primary border-3 shadow' : ''}`} style={{ scrollMarginTop: 90, opacity: saving ? 0.6 : 1, pointerEvents: saving ? 'none' : 'auto' }}>
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

        <div className="small mb-3" aria-live="polite">
          {progressLoading ? 'กำลังตรวจหลักฐานสำรวจ…' : progressError ? <span className="text-warning-emphasis">{progressError}</span> : surveyProgress ? <>
            <strong>{SURVEY_LABELS[surveyProgress.status]}</strong>
            {surveyProgress.missing?.length > 0 && <div>ข้อมูลที่ขาด: {surveyProgress.missing.join(', ')}</div>}
            {surveyProgress.status === 'partial' && !surveyProgress.missing?.length && <div>กรุณายืนยันข้อมูลล่าสุดอีกครั้ง</div>}
            {surveyProgress.reviewed_at && <div className="text-muted">บันทึกสำรวจล่าสุด {new Date(surveyProgress.reviewed_at).toLocaleString('th-TH')} • {surveyProgress.reviewed_by}</div>}
            <button className="btn btn-sm btn-success mt-2" disabled={saving || surveyProgress.status==='complete' || surveyProgress.missing?.length>0} onClick={confirmSurvey}>ยืนยันตรวจสอบแล้ว</button>
            {onNextPending && <button className="btn btn-sm btn-outline-primary mt-2 ms-2" onClick={onNextPending}>คนถัดไปที่ยังไม่ครบ</button>}
          </> : 'ยังไม่มีข้อมูลหลักฐานสำรวจในสิทธิ์ของบัญชีนี้'}
        </div>
        {/* Relation + Chronic */}
        <div className="row g-2 mb-3 p-2 rounded-3 mx-0" style={{ background: '#f8f9fa' }}>
          <div className="col-12 col-sm-6 px-1">
            <label className="text-muted" style={{ fontSize: '.68em', fontWeight: 600 }}>สถานะในบ้าน</label>
            <select aria-label={'สถานะในบ้านของ ' + person.fullname} disabled={saving} className="form-select form-select-sm border-0 fw-bold" style={{ fontSize: '.85rem', color: 'var(--primary)' }} value={relValue} onChange={async e => {
              const previous = relValue;
              const next = e.target.value;
              setRelValue(next);
              const saved = await doSave(person.residencyType, person.dischargeCode, { relation: next });
              if (saved !== true) setRelValue(previous);
            }}>
              {!rels.includes(relValue) && <option value={relValue || ''}>{relValue || 'ยังไม่ระบุ'}</option>}
              {rels.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="col-12 col-sm-6 px-1">
            <label className="text-muted" style={{ fontSize: '.68em', fontWeight: 600 }}>โรคประจำตัว</label>
            <ChronicEditor value={person.chronic} disabled={saving} onSave={chronic=>doSave(person.residencyType,person.dischargeCode,{chronic})} />
          </div>
        </div>

        <HosxpStatusSection person={person} saving={saving} doSave={doSave} onMove={onMove} pendingTransfer={activeTransfer} user={user} focused={focused} />
        <RiskScreeningSection person={person} user={user} onRefresh={onRefresh} saving={saving} setSaving={setSaving} />
        {person.age >= 15 && <OvScreeningSection person={person} user={user} onRefresh={onRefresh} saving={saving} setSaving={setSaving} />}
      </div>
    </div>
  );
}
