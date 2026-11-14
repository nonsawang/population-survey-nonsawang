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

export default function PersonCard({
  person,
  onSave,
  onMove,
  onRefresh,
  user,
  pendingTransfer,
  surveyProgress,
  progressError,
  progressLoading,
  focused = false,
  onSurveyConfirmed,
  onNextPending,
  defaultExpanded = false,
}) {
  const [relValue, setRelValue] = useState(person.relation);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(defaultExpanded || focused);
  const [menuOpen, setMenuOpen] = useState(false);
  const [highlight, setHighlight] = useState(false);

  useEffect(() => {
    if (!focused) {
      setHighlight(false);
      return;
    }
    setExpanded(true);
    setHighlight(true);
    const timer = setTimeout(() => setHighlight(false), 4500);
    return () => clearTimeout(timer);
  }, [focused]);

  useEffect(() => {
    setRelValue(person.relation);
  }, [person.personId, person.relation]);

  const doSave = async (type, discharge = person.dischargeCode, changes = {}) => {
    if (!person.statusSchemaReady) {
      swal({
        icon: 'info',
        title: 'ต้องปรับตาราง Supabase ก่อน',
        text: 'รัน migration สถานะ HOSxP แล้วโหลดหน้านี้ใหม่',
      });
      return false;
    }
    if (!DISCHARGE_TYPES.some((item) => item.code === discharge)) {
      swal({
        icon: 'warning',
        title: 'กรุณาระบุเหตุจำหน่ายก่อน',
        text: 'ข้อมูล Type 0 เดิมยังไม่มีเหตุจำหน่ายที่ตรงกับ HOSxP',
      });
      return false;
    }
    setSaving(true);
    try {
      return await onSave(
        person.personId,
        type,
        changes.relation ?? relValue,
        changes.chronic ?? person.chronic ?? '-',
        discharge
      );
    } catch {
      swal({
        icon: 'error',
        title: 'บันทึกไม่สำเร็จ',
        text: 'กรุณาลองใหม่ ข้อมูลที่เลือกยังไม่ได้รับการยืนยันว่าบันทึกสำเร็จ',
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const confirmSurvey = async () => {
    if (!surveyProgress || saving) return;
    if (
      !window.confirm(
        'ยืนยันว่าได้ตรวจสอบข้อมูลของ ' + person.fullname + ' แล้ว? การยืนยันนี้ไม่ส่งข้อมูลเข้า HOSxP'
      )
    )
      return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc('survey_confirm_person', {
        p_person_id: String(person.personId),
        p_expected: person.surveyExpected,
      });
      if (error) {
        const message = String(error.message || '');
        throw new Error(
          message.includes('SURVEY_CHANGED')
            ? 'ข้อมูลเปลี่ยนแปลง กรุณาโหลดบ้านใหม่และตรวจสอบอีกครั้ง'
            : message.includes('SURVEY_INCOMPLETE')
            ? 'ข้อมูลยังไม่ครบ กรุณาตรวจช่องที่ขาด'
            : 'ยืนยันสำรวจไม่สำเร็จ กรุณาตรวจสิทธิ์และการติดตั้ง migration'
        );
      }
      onSurveyConfirmed?.();
      swal({
        icon: 'success',
        title: 'ยืนยันสำรวจแล้ว',
        text: 'บันทึกผู้ตรวจและเวลาแล้ว ไม่ใช่ผลส่ง HOSxP',
      });
    } catch (e) {
      swal({ icon: 'error', title: 'ยังไม่ได้ยืนยันสำรวจ', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const rels = ['เจ้าบ้าน', 'ผู้อาศัย', 'บิดา/มารดา', 'เขย/สะใภ้', 'บุตร/หลาน', 'เช่าอาศัย', 'อื่นๆ'];
  const activeTransfer = pendingTransfer || person.pendingTransfer || null;
  const canMove = !user || ['admin', 'staff', 'vhv'].includes(user.role);

  const missingItems = [];
  if (!person.residencyType || person.needsStatusReview) missingItems.push('สถานะ Type/จำหน่าย');
  if (!person.chronic || person.chronic === '-') missingItems.push('โรคประจำตัว');
  if (!person.smokingStatus || !person.alcoholStatus) missingItems.push('บุหรี่/สุรา');
  if (person.age >= 15 && (!person.ovAnswers || !person.ovAnswers.q1)) missingItems.push('OV');

  const surveyBadge = () => {
    if (!surveyProgress) return null;
    if (surveyProgress.status === 'complete') {
      return (
        <span className="badge bg-success text-white" style={{ fontSize: '.72rem' }}>
          ✅ ยืนยันสำรวจแล้ว
        </span>
      );
    }
    const hasMissing = Array.isArray(surveyProgress.missing) && surveyProgress.missing.length > 0;
    if (surveyProgress.status === 'notStarted') {
      return (
        <span
          className="badge bg-secondary-subtle text-secondary-emphasis border border-secondary-subtle"
          style={{ fontSize: '.72rem' }}
        >
          {hasMissing ? '⚪ ยังไม่เริ่มสำรวจ' : '⚪ ข้อมูลเดิมครบ รอกดยืนยัน'}
        </span>
      );
    }
    if (hasMissing) {
      return (
        <span
          className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle"
          style={{ fontSize: '.72rem' }}
        >
          🟠 ข้อมูลยืนยันไม่ครบ
        </span>
      );
    }
    return (
      <span
        className="badge bg-info-subtle text-info-emphasis border border-info-subtle"
        style={{ fontSize: '.72rem' }}
      >
        🔵 รอกดยืนยันสำรวจ
      </span>
    );
  };

  return (
    <div
      id={'person-card-' + person.personId}
      tabIndex={-1}
      className={`card card-person border-type${person.residencyType} fade-in mb-2 ${
        highlight ? 'border-primary border-3 shadow' : ''
      }`}
      style={{
        scrollMarginTop: 90,
        opacity: saving ? 0.6 : 1,
        pointerEvents: saving ? 'none' : 'auto',
        borderRadius: 14,
      }}
    >
      {saving && (
        <div style={{ position: 'absolute', top: 12, right: 44, zIndex: 5 }}>
          <span className="spinner-border spinner-border-sm text-primary" />
        </div>
      )}
      <div className="card-body p-3">
        {/* Accordion Header (Tap to expand/collapse) */}
        <div className="d-flex justify-content-between align-items-start gap-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="btn btn-link text-start text-decoration-none p-0 flex-grow-1"
            aria-expanded={expanded}
          >
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <h6 className="fw-bold mb-0" style={{ color: 'var(--primary)', fontSize: '1.02rem' }}>
                {person.fullname}
              </h6>
              <span className="badge bg-light text-dark border" style={{ fontSize: '.78em' }}>
                อายุ {person.age}
              </span>
            </div>
            <div className="d-flex align-items-center gap-1 flex-wrap mt-1">
              {surveyBadge()}
              {missingItems.length === 0 ? (
                <span
                  className="badge bg-success-subtle text-success border border-success-subtle"
                  style={{ fontSize: '.72rem' }}
                >
                  ✓ ข้อมูลและคัดกรองครบ
                </span>
              ) : (
                <span
                  className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle"
                  style={{ fontSize: '.72rem' }}
                >
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
                  onClick={() => setMenuOpen((v) => !v)}
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
                      onClick={() => {
                        setMenuOpen(false);
                        onMove(person);
                      }}
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
              onClick={() => setExpanded((v) => !v)}
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
            {/* Survey Confirmation Section */}
            <div className="small mb-3 p-2 rounded-3 border bg-light" aria-live="polite">
              {progressLoading ? (
                'กำลังตรวจหลักฐานสำรวจ…'
              ) : progressError ? (
                <span className="text-warning-emphasis">{progressError}</span>
              ) : surveyProgress ? (
                <>
                  <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                    <strong>{SURVEY_LABELS[surveyProgress.status]}</strong>
                    {surveyProgress.reviewed_at && (
                      <span className="text-muted" style={{ fontSize: '.75rem' }}>
                        ล่าสุด {new Date(surveyProgress.reviewed_at).toLocaleString('th-TH')} •{' '}
                        {surveyProgress.reviewed_by}
                      </span>
                    )}
                  </div>
                  {surveyProgress.missing?.length > 0 && (
                    <div className="text-warning-emphasis mt-1">
                      ข้อมูลที่ต้องระบุก่อนยืนยัน: {surveyProgress.missing.join(', ')}
                    </div>
                  )}
                  {surveyProgress.status !== 'complete' && !surveyProgress.missing?.length && (
                    <div className="text-info-emphasis mt-1">
                      {surveyProgress.status === 'notStarted'
                        ? 'ข้อมูลเดิมครบแล้ว กรุณาตรวจสอบและกดปุ่ม “ยืนยันตรวจสอบแล้ว” ด้านล่าง'
                        : 'แก้ไขข้อมูลแล้ว กรุณากดยืนยันข้อมูลล่าสุดอีกครั้ง'}
                    </div>
                  )}
                  <div className="d-flex flex-wrap gap-2 mt-2">
                    <button
                      type="button"
                      className="btn btn-success fw-bold flex-grow-1"
                      style={{ minHeight: 44 }}
                      disabled={
                        saving ||
                        surveyProgress.status === 'complete' ||
                        surveyProgress.missing?.length > 0
                      }
                      onClick={confirmSurvey}
                    >
                      {surveyProgress.status === 'complete'
                        ? '✅ ยืนยันตรวจสอบแล้ว'
                        : '✓ ยืนยันตรวจสอบแล้ว'}
                    </button>
                    {onNextPending && (
                      <button
                        type="button"
                        className="btn btn-outline-primary fw-semibold"
                        style={{ minHeight: 44 }}
                        onClick={onNextPending}
                      >
                        คนถัดไปที่ยังไม่ครบ ›
                      </button>
                    )}
                  </div>
                </>
              ) : (
                'ยังไม่มีข้อมูลหลักฐานสำรวจในสิทธิ์ของบัญชีนี้'
              )}
            </div>

            {/* Relation + Chronic */}
            <div className="row g-2 mb-3 p-2 rounded-3 mx-0" style={{ background: '#f8f9fa' }}>
              <div className="col-12 col-sm-6 px-1">
                <label className="text-muted" style={{ fontSize: '.68em', fontWeight: 600 }}>
                  สถานะในบ้าน
                </label>
                <select
                  aria-label={'สถานะในบ้านของ ' + person.fullname}
                  disabled={saving}
                  className="form-select form-select-sm border-0 fw-bold"
                  style={{ fontSize: '.85rem', color: 'var(--primary)', minHeight: 44 }}
                  value={relValue}
                  onChange={async (e) => {
                    const previous = relValue;
                    const next = e.target.value;
                    setRelValue(next);
                    const saved = await doSave(person.residencyType, person.dischargeCode, {
                      relation: next,
                    });
                    if (saved !== true) setRelValue(previous);
                  }}
                >
                  {!rels.includes(relValue) && (
                    <option value={relValue || ''}>{relValue || 'ยังไม่ระบุ'}</option>
                  )}
                  {rels.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12 col-sm-6 px-1">
                <label className="text-muted" style={{ fontSize: '.68em', fontWeight: 600 }}>
                  โรคประจำตัว
                </label>
                <ChronicEditor
                  value={person.chronic}
                  disabled={saving}
                  onSave={(chronic) =>
                    doSave(person.residencyType, person.dischargeCode, { chronic })
                  }
                />
              </div>
            </div>

            <HosxpStatusSection
              person={person}
              saving={saving}
              doSave={doSave}
              onMove={onMove}
              pendingTransfer={activeTransfer}
              user={user}
              focused={focused}
            />
            <RiskScreeningSection
              person={person}
              user={user}
              onRefresh={onRefresh}
              saving={saving}
              setSaving={setSaving}
            />
            {person.age >= 15 && (
              <OvScreeningSection
                person={person}
                user={user}
                onRefresh={onRefresh}
                saving={saving}
                setSaving={setSaving}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
