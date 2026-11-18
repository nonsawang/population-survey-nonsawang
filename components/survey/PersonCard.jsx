'use client';
import { useState, useEffect } from 'react';
import ChronicEditor from './ChronicEditor';
import { DISCHARGE_TYPES } from '@/lib/population-status';
import { swal } from '@/lib/survey-feedback';
import HosxpStatusSection from './HosxpStatusSection';
import RiskScreeningSection from './RiskScreeningSection';
import OvScreeningSection from './OvScreeningSection';
import { supabase } from '@/lib/supabase';

const RELATIONS = [
  'เจ้าบ้าน',
  'ผู้อาศัย',
  'บุตร/หลาน',
  'บิดา/มารดา',
  'เขย/สะใภ้',
  'เช่าอาศัย',
  'อื่นๆ',
];

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
  const [highlight, setHighlight] = useState(false);

  const isStaff = user && ['admin', 'staff'].includes(user.role);

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
        title: 'ต้องปรับตารางฐานข้อมูลก่อน',
        text: 'กรุณาแจ้งเจ้าหน้าที่ รพ.สต. ให้ตรวจสอบการตั้งค่าระบบ',
      });
      return false;
    }
    if (!DISCHARGE_TYPES.some((item) => item.code === discharge)) {
      swal({
        icon: 'warning',
        title: 'กรุณาระบุสถานะบุคคลก่อน',
        text: 'กรุณาเลือกสถานะการอยู่อาศัยและสถานะบุคคลในข้อที่ 3 ก่อนบันทึก',
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
        text: 'กรุณาลองใหม่อีกครั้ง',
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const confirmSurvey = async () => {
    if (!surveyProgress || saving) return;
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
            ? 'ข้อมูลเพิ่งเปลี่ยนแปลง กรุณากดยืนยันอีกครั้ง'
            : message.includes('SURVEY_INCOMPLETE')
            ? 'ข้อมูลยังไม่ครบทั้ง 3 ข้อ กรุณาตรวจสอบช่องที่ยังขาด'
            : 'ยืนยันสำรวจไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
        );
      }
      onSurveyConfirmed?.();
      setExpanded(false);
      swal({
        icon: 'success',
        title: 'ยืนยันสำรวจเรียบร้อย',
        text: `บันทึกการตรวจข้อมูลของ ${person.fullname} แล้ว`,
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (e) {
      swal({ icon: 'error', title: 'ยังไม่ได้ยืนยันสำรวจ', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const activeTransfer = pendingTransfer || person.pendingTransfer || null;

  // เช็กเฉพาะ 3 หัวข้อหลักที่เปิดให้ อสม. สำรวจจริง (ไม่นำ บุหรี่/สุรา และ OV ที่ปิดรับข้อมูลแล้วมาฟ้องว่าขาด)
  const missingItems = [];
  if (!RELATIONS.includes(String(relValue || '').trim())) {
    missingItems.push('สถานะในบ้าน');
  }
  if (
    !person.chronic ||
    ['-', 'ไม่ระบุ', 'ยังไม่ระบุ'].includes(String(person.chronic).trim())
  ) {
    missingItems.push('โรคประจำตัว');
  }
  if (!person.residencyType || person.needsStatusReview) {
    missingItems.push('การอยู่อาศัย');
  }

  const hasRiskHistory = Boolean(
    (person.smokingStatus && person.smokingStatus !== '-') ||
      (person.alcoholStatus && person.alcoholStatus !== '-')
  );
  const hasOvHistory = Boolean(
    person.age >= 15 &&
      person.ovAnswers &&
      Object.values(person.ovAnswers).some((v) => v && v !== '-')
  );

  return (
    <div
      id={'person-card-' + person.personId}
      tabIndex={-1}
      className={`card card-person border-type${person.residencyType} fade-in mb-3 ${
        highlight ? 'border-primary border-3 shadow' : 'shadow-sm'
      }`}
      style={{
        scrollMarginTop: 90,
        opacity: saving ? 0.65 : 1,
        pointerEvents: saving ? 'none' : 'auto',
        borderRadius: 16,
      }}
    >
      {saving && (
        <div style={{ position: 'absolute', top: 14, right: 16, zIndex: 5 }}>
          <span className="spinner-border spinner-border-sm text-primary" />
        </div>
      )}

      <div className="card-body p-3">
        {/* ส่วนหัวการ์ด (แตะเพื่อกาง/พับได้ทั้งแถบ) */}
        <div className="d-flex justify-content-between align-items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="btn btn-link text-start text-decoration-none p-0 flex-grow-1"
            aria-expanded={expanded}
          >
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <h6
                className="fw-bold mb-0"
                style={{ color: 'var(--primary)', fontSize: '1.1rem' }}
              >
                {person.fullname}
              </h6>
              <span
                className="badge bg-light text-dark border px-2 py-1"
                style={{ fontSize: '.85rem', borderRadius: 8 }}
              >
                อายุ {person.age} ปี
              </span>
            </div>

            <div className="d-flex align-items-center gap-2 flex-wrap mt-2">
              {surveyProgress?.status === 'complete' && missingItems.length === 0 ? (
                <span
                  className="badge bg-success text-white px-3 py-2"
                  style={{ fontSize: '.82rem', borderRadius: 10 }}
                >
                  ✅ สำรวจและยืนยันครบแล้ว
                </span>
              ) : missingItems.length === 0 ? (
                <>
                  <span
                    className="badge bg-success-subtle text-success border border-success-subtle px-3 py-2"
                    style={{ fontSize: '.82rem', borderRadius: 10 }}
                  >
                    ✓ ข้อมูลครบ 3 ข้อ
                  </span>
                  {surveyProgress && surveyProgress.status !== 'complete' && (
                    <span
                      className="badge bg-info-subtle text-info-emphasis border border-info-subtle px-2 py-2"
                      style={{ fontSize: '.8rem', borderRadius: 10 }}
                    >
                      👆 แตะเพื่อกดยืนยันสำรวจ
                    </span>
                  )}
                </>
              ) : (
                <span
                  className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-3 py-2"
                  style={{ fontSize: '.82rem', borderRadius: 10 }}
                >
                  ⏳ ขาดข้อมูล: {missingItems.join(', ')}
                </span>
              )}

              {activeTransfer && (
                <span
                  className="badge bg-warning text-dark px-2 py-2"
                  style={{ fontSize: '.78rem', borderRadius: 10 }}
                >
                  🚚 รอย้ายเข้า ม.{activeTransfer.toMoo} บ้าน {activeTransfer.toHouse}
                </span>
              )}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className={`btn btn-sm fw-bold px-3 d-flex align-items-center gap-1 ${
              expanded ? 'btn-light border text-secondary' : 'btn-primary text-white'
            }`}
            style={{ minHeight: 42, borderRadius: 12, flexShrink: 0 }}
            aria-label={expanded ? 'พับเก็บข้อมูล' : 'เปิดดูและแก้ไขข้อมูล'}
          >
            <span>{expanded ? 'ย่อเก็บ' : 'เปิดดู'}</span>
            <i className={`fa-solid fa-chevron-${expanded ? 'up' : 'down'}`} />
          </button>
        </div>

        {/* เนื้อหา 3 ขั้นตอน เมื่อกางการ์ดออก */}
        {expanded && (
          <div className="mt-3 pt-3 border-top fade-in">
            {/* ขั้นตอนที่ 1: สถานะในบ้าน */}
            <div
              className="p-3 rounded-3 mb-3 border"
              style={{ background: '#f8fafc', borderRadius: 14 }}
            >
              <div className="d-flex align-items-center gap-2 mb-2">
                <span
                  className="badge rounded-circle bg-primary text-white d-inline-flex align-items-center justify-content-center fw-bold"
                  style={{ width: 28, height: 28, fontSize: '.9rem' }}
                >
                  1
                </span>
                <label className="fw-bold text-dark mb-0" style={{ fontSize: '1rem' }}>
                  เป็นอะไรกับเจ้าบ้าน? <span className="text-muted fw-normal">(แตะเลือก)</span>
                </label>
              </div>

              <div
                className="d-flex flex-wrap gap-2"
                role="group"
                aria-label={'สถานะในบ้านของ ' + person.fullname}
              >
                {RELATIONS.map((r) => {
                  const selected = relValue === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      disabled={saving}
                      aria-pressed={selected}
                      onClick={async () => {
                        if (selected) return;
                        const previous = relValue;
                        setRelValue(r);
                        const saved = await doSave(person.residencyType, person.dischargeCode, {
                          relation: r,
                        });
                        if (saved !== true) setRelValue(previous);
                      }}
                      className={`btn fw-bold px-3 ${
                        selected ? 'btn-primary text-white shadow-sm' : 'btn-white bg-white border text-dark'
                      }`}
                      style={{ minHeight: 44, fontSize: '.94rem', borderRadius: 10 }}
                    >
                      {selected ? '✅ ' : ''}
                      {r}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ขั้นตอนที่ 2: โรคประจำตัว */}
            <div
              className="p-3 rounded-3 mb-3 border"
              style={{ background: '#f8fafc', borderRadius: 14 }}
            >
              <div className="d-flex align-items-center gap-2 mb-1">
                <span
                  className="badge rounded-circle bg-primary text-white d-inline-flex align-items-center justify-content-center fw-bold"
                  style={{ width: 28, height: 28, fontSize: '.9rem' }}
                >
                  2
                </span>
                <span className="fw-bold text-dark" style={{ fontSize: '1rem' }}>
                  มีโรคประจำตัวไหม?
                </span>
              </div>
              <ChronicEditor
                value={person.chronic}
                disabled={saving}
                onSave={(chronic) =>
                  doSave(person.residencyType, person.dischargeCode, { chronic })
                }
              />
            </div>

            {/* ขั้นตอนที่ 3: การอยู่อาศัยและสถานะบุคคล */}
            <div
              className="p-3 rounded-3 mb-3 border"
              style={{ background: '#f8fafc', borderRadius: 14 }}
            >
              <div className="d-flex align-items-center gap-2 mb-2">
                <span
                  className="badge rounded-circle bg-primary text-white d-inline-flex align-items-center justify-content-center fw-bold"
                  style={{ width: 28, height: 28, fontSize: '.9rem' }}
                >
                  3
                </span>
                <span className="fw-bold text-dark" style={{ fontSize: '1rem' }}>
                  ปัจจุบันยังอาศัยอยู่ที่บ้านนี้ไหม?
                </span>
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
            </div>

            {/* กล่องกดยืนยันสำรวจ (แสดงเฉพาะเมื่อระบบยืนยันสำรวจพร้อมใช้งาน หรือแสดงแจ้งเตือนเฉพาะเจ้าหน้าที่) */}
            {(surveyProgress || isStaff) && (
              <div
                className="p-3 rounded-3 border bg-success-subtle border-success-subtle mb-2"
                style={{ borderRadius: 14 }}
                aria-live="polite"
              >
                {progressLoading ? (
                  <div className="text-muted small">กำลังโหลดสถานะการยืนยันสำรวจ…</div>
                ) : progressError ? (
                  isStaff ? (
                    <div className="small text-warning-emphasis">{progressError}</div>
                  ) : null
                ) : surveyProgress ? (
                  <>
                    <div className="d-flex justify-content-between align-items-center flex-wrap gap-1 mb-2">
                      <strong className="text-dark" style={{ fontSize: '.96rem' }}>
                        {surveyProgress.status === 'complete'
                          ? '✅ ยืนยันผลการสำรวจคนนี้เรียบร้อยแล้ว'
                          : '📋 เมื่อตรวจข้อมูลทั้ง 3 ข้อถูกต้องแล้ว กดปุ่มด้านล่าง:'}
                      </strong>
                      {surveyProgress.reviewed_at && (
                        <span className="text-muted small">
                          ตรวจล่าสุด {new Date(surveyProgress.reviewed_at).toLocaleString('th-TH')} •{' '}
                          {surveyProgress.reviewed_by}
                        </span>
                      )}
                    </div>

                    {surveyProgress.missing?.length > 0 && (
                      <div className="text-danger fw-semibold small mb-2">
                        ⚠️ กรุณาเลือกข้อมูลให้ครบก่อนกดยืนยัน: {surveyProgress.missing.join(', ')}
                      </div>
                    )}

                    <div className="d-flex flex-column flex-sm-row gap-2">
                      <button
                        type="button"
                        className="btn btn-success fw-bold flex-grow-1 shadow-sm"
                        style={{ minHeight: 52, fontSize: '1.02rem', borderRadius: 12 }}
                        disabled={
                          saving ||
                          surveyProgress.status === 'complete' ||
                          surveyProgress.missing?.length > 0
                        }
                        onClick={confirmSurvey}
                      >
                        {surveyProgress.status === 'complete'
                          ? '✅ ยืนยันตรวจสอบแล้ว'
                          : '✅ ข้อมูลถูกต้อง — ยืนยันสำรวจคนนี้'}
                      </button>
                      {onNextPending && (
                        <button
                          type="button"
                          className="btn btn-outline-primary fw-bold px-3"
                          style={{ minHeight: 52, fontSize: '.96rem', borderRadius: 12 }}
                          onClick={onNextPending}
                        >
                          คนถัดไปที่ยังไม่ครบ ›
                        </button>
                      )}
                    </div>
                  </>
                ) : null}
              </div>
            )}

            {/* ประวัติการคัดกรองเดิม (แสดงเฉพาะเมื่อมีข้อมูลเดิมเก็บไว้ เพื่อไม่ให้รกหน้าจอ อสม.) */}
            {(hasRiskHistory || hasOvHistory) && (
              <details className="mt-2 small text-muted">
                <summary className="py-1" style={{ cursor: 'pointer' }}>
                  📋 ดูประวัติผลคัดกรองเดิม (บุหรี่ / สุรา / พยาธิใบไม้ตับ)
                </summary>
                <div className="mt-1">
                  {hasRiskHistory && (
                    <RiskScreeningSection
                      person={person}
                      user={user}
                      onRefresh={onRefresh}
                      saving={saving}
                      setSaving={setSaving}
                    />
                  )}
                  {hasOvHistory && (
                    <OvScreeningSection
                      person={person}
                      user={user}
                      onRefresh={onRefresh}
                      saving={saving}
                      setSaving={setSaving}
                    />
                  )}
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
