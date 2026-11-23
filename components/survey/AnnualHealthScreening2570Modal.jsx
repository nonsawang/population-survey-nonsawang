'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  FISCAL_YEAR_2570,
  CHRONIC_HISTORY_OPTIONS,
  SYMPTOM_HISTORY_12,
  ASSIST_Q2_QUESTIONS,
  ASSIST_Q3_QUESTIONS,
  TB_SYMPTOM_QUESTIONS,
  KNEE_SYMPTOM_QUESTIONS,
  MNA_QUESTIONS,
  ADL_QUESTIONS,
  createDefaultScreening2570Form,
  evaluateFullScreening2570,
  buildScreening2570PrintHtml,
} from '@/lib/health-screening-2570.mjs';

const TABS = [
  { id: 'general', label: '1. ทั่วไป & ประวัติ', short: 'ประวัติ/12อาการ' },
  { id: 'chronic', label: '2. ร่างกาย & มะเร็ง (1–7)', short: 'หมวด 1–7' },
  { id: 'behavior', label: '3. พฤติกรรม & 2Q (8–12)', short: 'หมวด 8–12' },
  { id: 'elderly1', label: '4. ผู้สูงอายุ (13–20)', short: 'หมวด 13–20' },
  { id: 'elderly2', label: '5. MNA / ADL / เซ็นชื่อ (21–22)', short: 'หมวด 21–22' },
];

const LEVEL_BADGE = {
  normal: 'bg-success-subtle text-success border border-success-subtle',
  risk: 'bg-warning-subtle text-warning-emphasis border border-warning-subtle',
  warning: 'bg-warning-subtle text-warning-emphasis border border-warning-subtle',
  abnormal: 'bg-danger-subtle text-danger border border-danger-subtle',
  danger: 'bg-danger text-white',
  unknown: 'bg-light text-secondary border',
};

function SectionShell({ no, title, targetText, applicable, showAll, codeBadge, actionSlot, children }) {
  if (!applicable && !showAll) return null;
  return (
    <div
      className={`card mb-3 border ${applicable ? 'border-primary-subtle' : 'border-secondary-subtle opacity-75'}`}
      style={{ borderRadius: 14 }}
    >
      <div
        className="card-header d-flex justify-content-between align-items-center flex-wrap gap-2 py-2 px-3"
        style={{ background: applicable ? '#f0f7ff' : '#f8fafc', borderRadius: '14px 14px 0 0' }}
      >
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <span
            className={`badge rounded-pill ${applicable ? 'bg-primary' : 'bg-secondary'} px-2 py-1`}
            style={{ fontSize: '.85rem' }}
          >
            หมวด {no}
          </span>
          <strong className="text-dark" style={{ fontSize: '1.02rem' }}>
            {title}
          </strong>
          {targetText && (
            <span className="badge bg-white text-dark border" style={{ fontSize: '.76rem' }}>
              {targetText}
            </span>
          )}
          {!applicable && (
            <span className="badge bg-secondary-subtle text-secondary" style={{ fontSize: '.74rem' }}>
              นอกเกณฑ์อายุ/เพศ (แสดงทั้งหมด)
            </span>
          )}
        </div>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          {actionSlot}
          {codeBadge && (
            <span className="badge bg-info-subtle text-info-emphasis border border-info-subtle">
              PP: {codeBadge}
            </span>
          )}
        </div>
      </div>
      <div className="card-body p-3">{children}</div>
    </div>
  );
}

function ChoiceButton({ active, variant = 'primary', onClick, children, className = '' }) {
  const cls = active
    ? `btn-${variant} text-white shadow-sm`
    : 'btn-white bg-white border text-dark';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`btn fw-semibold px-3 ${cls} ${className}`}
      style={{ minHeight: 46, borderRadius: 10, fontSize: '.94rem' }}
      aria-pressed={active}
    >
      {active ? '✅ ' : ''}
      {children}
    </button>
  );
}

export default function AnnualHealthScreening2570Modal({
  person,
  user,
  onClose,
  onSaved,
}) {
  const readOnlyUser = user?.role === 'manager';
  const [activeTab, setActiveTab] = useState('general');
  const [showAll22, setShowAll22] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [saveOk, setSaveOk] = useState(false);
  const [alreadyScreened, setAlreadyScreened] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [resolvedPerson, setResolvedPerson] = useState(person);

  useEffect(() => {
    setResolvedPerson(person);
  }, [person]);

  const [formData, setFormData] = useState(() => {
    const base = createDefaultScreening2570Form(person);
    if (user?.displayName || user?.username) {
      base.consent.staffName = user.displayName || user.username;
      base.consent.staffPosition = user.role === 'vhv' ? 'อสม.' : 'เจ้าหน้าที่สาธารณสุข';
    }
    return base;
  });

  // TUGT stopwatch state
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const timerStartRef = useRef(0);

  // Signature canvas ref
  const sigCanvasRef = useRef(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    fetch(`/api/health-screening-2570?personId=${encodeURIComponent(person.personId)}`, {
      cache: 'no-store',
    })
      .then((res) => res.json().then((j) => ({ ok: res.ok, j })))
      .then(({ ok, j }) => {
        if (!active) return;
        if (!ok || !j?.ok) {
          setLoadError(j?.error || 'โหลดข้อมูลเดิมไม่สำเร็จ');
          return;
        }
        if (j.person) setResolvedPerson((prev) => ({ ...prev, ...j.person }));
        const loaded = j.formData || createDefaultScreening2570Form(j.person || person);
        if (!loaded.consent?.staffName && (user?.displayName || user?.username)) {
          loaded.consent = {
            ...loaded.consent,
            staffName: user.displayName || user.username,
            staffPosition: user.role === 'vhv' ? 'อสม.' : 'เจ้าหน้าที่สาธารณสุข',
          };
        }
        setFormData(loaded);
        setAlreadyScreened(Boolean(j.screened));
      })
      .catch(() => {
        if (active) setLoadError('เชื่อมต่อไม่สำเร็จ ใช้แบบฟอร์มตั้งต้นแทน');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [person.personId]);

  useEffect(() => {
    if (!timerRunning) return undefined;
    timerStartRef.current = Date.now() - elapsedMs;
    const id = setInterval(() => {
      const ms = Date.now() - timerStartRef.current;
      setElapsedMs(ms);
      const totalSec = Math.floor(ms / 1000);
      setFormData((prev) => ({
        ...prev,
        s19: {
          ...prev.s19,
          walkMinutes: Math.floor(totalSec / 60),
          walkSeconds: totalSec % 60,
        },
      }));
    }, 100);
    return () => clearInterval(id);
  }, [timerRunning]);

  const evaluation = useMemo(
    () => evaluateFullScreening2570(formData, resolvedPerson),
    [formData, resolvedPerson]
  );
  const profile = evaluation.profile;
  const targets = evaluation.targets;

  const updateSection = (sectionKey, patch) => {
    setSaveOk(false);
    setSaveMessage('');
    setFormData((prev) => ({
      ...prev,
      [sectionKey]: {
        ...prev[sectionKey],
        ...patch,
      },
    }));
  };

  const toggleShowAllSymptomsNormal = () => {
    setSaveOk(false);
    setFormData((prev) => ({
      ...prev,
      pastSymptoms: Object.fromEntries(SYMPTOM_HISTORY_12.map((s) => [s.id, false])),
    }));
  };

  const setBehaviorAllNormal = () => {
    setSaveOk(false);
    setFormData((prev) => ({
      ...prev,
      s8: { ...prev.s8, status: 'never' },
      s9: { ...prev.s9, status: 'never' },
      s10: { ...prev.s10, frequency: '3_per_week' },
      s11: {
        ...prev.s11,
        hasFamilyTb: false,
        isTbCaregiver: false,
        everHadTb: 'never',
        symptoms: { tb1: false, tb2: false, tb3: false, tb4: false, tb5: false, tb6: false },
      },
      s12: { q1_sad: false, q2_bored: false },
    }));
  };

  const setElderly13to20Normal = () => {
    setSaveOk(false);
    setTimerRunning(false);
    setFormData((prev) => ({
      ...prev,
      s13: {
        ...prev.s13,
        naturalTeethCount: prev.s13.naturalTeethCount || '24',
        lessThan20Teeth: false,
        hasDecay: false,
        hasGumAbscessLoose: false,
        hasOralUlcerOver2W: false,
        hasDryMouth: false,
        cleanliness: 'clean',
      },
      s14: { leftEar: 'hear', rightEar: 'hear' },
      s15: {
        nearVision: 'normal',
        farVision: 'normal',
        cataract: 'normal',
        cataractEye: '',
        glaucoma: 'normal',
        glaucomaEye: '',
        amd: 'normal',
        amdEye: '',
      },
      s16: {
        repeatWords: { w1: true, w2: true, w3: true },
        clockScore: 2,
        recallWords: { w1: true, w2: true, w3: true },
      },
      s17: {
        hasKneePain: false,
        symptoms: { k1: false, k2: false, k3: false, k4: false, k5: false },
      },
      s18: { hasIncontinence: false },
      s19: { fellLast6Months: false, walkMinutes: 0, walkSeconds: 9 },
      s20: {
        ...prev.s20,
        hasSleepProblem: false,
        daytimeFatigue: false,
      },
    }));
  };

  const setAdlFullNormal = () => {
    setSaveOk(false);
    setFormData((prev) => ({
      ...prev,
      s22: {
        adl1: 2,
        adl2: 1,
        adl3: 3,
        adl4: 2,
        adl5: 3,
        adl6: 2,
        adl7: 2,
        adl8: 1,
        adl9: 2,
        adl10: 2,
      },
    }));
  };

  // Signature drawing handlers
  const getCanvasPoint = (e) => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleSigDown = (e) => {
    if (readOnlyUser) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture?.(e.pointerId);
    const ctx = canvas.getContext('2d');
    const pt = getCanvasPoint(e);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
    drawingRef.current = true;
  };

  const handleSigMove = (e) => {
    if (!drawingRef.current) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const pt = getCanvasPoint(e);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  };

  const handleSigUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    updateSection('consent', { patientSignatureDataUrl: canvas.toDataURL('image/png') });
  };

  const clearSignature = () => {
    const canvas = sigCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    updateSection('consent', { patientSignatureDataUrl: '' });
  };

  const handleCopyPpCodes = async () => {
    const text = evaluation.ppSpecialCodes.join(', ');
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCodes(true);
      setTimeout(() => setCopiedCodes(false), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  const handlePrint = () => {
    const html = buildScreening2570PrintHtml({ ...formData, showAll22 }, resolvedPerson, evaluation);
    const win = window.open('', '_blank', 'width=980,height=800');
    if (!win) {
      setSaveMessage('เบราว์เซอร์บล็อกหน้าต่างป๊อปอัป กรุณาอนุญาตป๊อปอัปเพื่อพิมพ์แบบฟอร์ม');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  const handleSave = async () => {
    if (saving || readOnlyUser) return;
    setSaving(true);
    setSaveMessage('');
    setSaveOk(false);
    try {
      const res = await fetch('/api/health-screening-2570', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personId: person.personId,
          formData,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setSaveMessage(json.error || 'บันทึกไม่สำเร็จ กรุณาลองใหม่');
        return;
      }
      setAlreadyScreened(true);
      setSaveOk(true);
      setSaveMessage('บันทึกผลคัดกรองสุขภาพประจำปี 2570 เรียบร้อยแล้ว');
      onSaved?.(json.summary, json.evaluation);
    } catch {
      setSaveMessage('เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setSaving(false);
    }
  };

  const fullName = resolvedPerson.fullname || resolvedPerson.name || '-';

  return (
    <div
      className="modal fade show d-block"
      role="dialog"
      aria-modal="true"
      aria-label={`คัดกรองภาวะสุขภาพประจำปี 2570 ของ ${fullName}`}
      style={{ background: 'rgba(15,23,42,.62)', zIndex: 1060 }}
    >
      <div className="modal-dialog modal-xl modal-dialog-scrollable modal-fullscreen-md-down">
        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 16, overflow: 'hidden' }}>
          {/* Header */}
          <div className="modal-header text-white py-3 px-3 px-md-4" style={{ background: 'var(--primary)' }}>
            <div className="flex-grow-1">
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <h5 className="modal-title fw-bold mb-0">
                  🩺 คัดกรองภาวะสุขภาพประจำปี {FISCAL_YEAR_2570}
                </h5>
                {alreadyScreened && (
                  <span className="badge bg-success border border-white">✅ คัดกรองแล้ว</span>
                )}
              </div>
              <div className="small opacity-90 mt-1 d-flex flex-wrap gap-2">
                <span><strong>{fullName}</strong></span>
                <span>• อายุ {profile.age} ปี (เกิด พ.ศ. {profile.birthYearBE})</span>
                <span>• บ้าน {resolvedPerson.house || '-'} ม.{resolvedPerson.moo || '-'}</span>
              </div>
            </div>
            <button
              type="button"
              className="btn-close btn-close-white ms-2"
              aria-label="ปิด"
              onClick={onClose}
            />
          </div>

          {/* Control Strip: Age-Filter Toggle & Section Tabs */}
          <div className="bg-light border-bottom px-3 py-2">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
              <div className="btn-group" role="group" aria-label="ตัวกรองหมวดคัดกรอง">
                <button
                  type="button"
                  onClick={() => setShowAll22(false)}
                  className={`btn btn-sm fw-bold ${!showAll22 ? 'btn-primary' : 'btn-outline-primary bg-white'}`}
                  style={{ minHeight: 38 }}
                >
                  🎯 แสดงเฉพาะหมวดตามเกณฑ์อายุ/เพศ
                </button>
                <button
                  type="button"
                  onClick={() => setShowAll22(true)}
                  className={`btn btn-sm fw-bold ${showAll22 ? 'btn-primary' : 'btn-outline-primary bg-white'}`}
                  style={{ minHeight: 38 }}
                >
                  📋 แสดงครบทั้ง 22 หมวด
                </button>
              </div>
              <span className={`badge px-3 py-2 ${evaluation.risks.length === 0 ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-danger-subtle text-danger border border-danger-subtle'}`}>
                {evaluation.overallStatus}
              </span>
            </div>

            <div className="d-flex gap-1 overflow-auto pb-1">
              {TABS.map((t) => {
                const isElderlyTab = t.id === 'elderly1' || t.id === 'elderly2';
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    className={`btn btn-sm fw-bold text-nowrap ${
                      activeTab === t.id
                        ? 'btn-dark text-white'
                        : 'btn-white bg-white border text-dark'
                    }`}
                    style={{ minHeight: 40, borderRadius: 10 }}
                  >
                    <span className="d-none d-md-inline">{t.label}</span>
                    <span className="d-inline d-md-none">{t.short}</span>
                    {isElderlyTab && profile.age < 60 && !showAll22 && (
                      <span className="ms-1 small opacity-75">(60+)</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Body */}
          <div className="modal-body p-3 p-md-4" style={{ background: '#f8fafc' }}>
            {loading && (
              <div className="text-center py-4">
                <span className="spinner-border text-primary me-2" /> กำลังโหลดแบบฟอร์มคัดกรอง 2570...
              </div>
            )}
            {loadError && <div className="alert alert-warning py-2">{loadError}</div>}

            {!loading && activeTab === 'general' && (
              <div>
                <div className="card mb-3 border-primary-subtle" style={{ borderRadius: 14 }}>
                  <div className="card-header bg-white fw-bold">
                    ข้อมูลทั่วไป & ประวัติโรคประจำตัว / ครอบครัว
                  </div>
                  <div className="card-body">
                    <div className="row g-3 mb-3">
                      <div className="col-md-4">
                        <label className="form-label fw-bold small">วันที่ตรวจคัดกรอง</label>
                        <input
                          type="date"
                          className="form-control"
                          style={{ minHeight: 46 }}
                          value={formData.screenDate}
                          onChange={(e) => setFormData((p) => ({ ...p, screenDate: e.target.value }))}
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label fw-bold small">เบอร์โทรศัพท์</label>
                        <input
                          type="tel"
                          className="form-control"
                          style={{ minHeight: 46 }}
                          placeholder="08x-xxx-xxxx"
                          value={formData.phone}
                          onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label fw-bold small">ที่อยู่ตามทะเบียนสำรวจ</label>
                        <div className="form-control bg-light" style={{ minHeight: 46, lineHeight: '32px' }}>
                          บ้าน {resolvedPerson.house || '-'} หมู่ที่ {resolvedPerson.moo || '-'} ต.เหนือเมือง
                        </div>
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="form-label fw-bold d-block">ประวัติโรคประจำตัว (ผู้รับตรวจ)</label>
                      <div className="d-flex flex-wrap gap-2">
                        {CHRONIC_HISTORY_OPTIONS.map((opt) => (
                          <ChoiceButton
                            key={opt.id}
                            active={Boolean(formData.personalChronic[opt.id])}
                            variant="danger"
                            onClick={() =>
                              updateSection('personalChronic', {
                                [opt.id]: !formData.personalChronic[opt.id],
                              })
                            }
                          >
                            {opt.label}
                          </ChoiceButton>
                        ))}
                        <input
                          type="text"
                          className="form-control"
                          style={{ maxWidth: 260, minHeight: 46 }}
                          placeholder="โรคอื่นๆ (ระบุ)..."
                          value={formData.personalChronic.other || ''}
                          onChange={(e) => updateSection('personalChronic', { other: e.target.value })}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="form-label fw-bold d-block">ประวัติโรคของบุคคลในครอบครัว</label>
                      <div className="d-flex flex-wrap gap-2">
                        {CHRONIC_HISTORY_OPTIONS.map((opt) => (
                          <ChoiceButton
                            key={opt.id}
                            active={Boolean(formData.familyChronic[opt.id])}
                            variant="warning"
                            onClick={() =>
                              updateSection('familyChronic', {
                                [opt.id]: !formData.familyChronic[opt.id],
                              })
                            }
                          >
                            {opt.label}
                          </ChoiceButton>
                        ))}
                        <input
                          type="text"
                          className="form-control"
                          style={{ maxWidth: 260, minHeight: 46 }}
                          placeholder="โรคอื่นๆ ในครอบครัว..."
                          value={formData.familyChronic.other || ''}
                          onChange={(e) => updateSection('familyChronic', { other: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card mb-3 border-primary-subtle" style={{ borderRadius: 14 }}>
                  <div className="card-header bg-white d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <span className="fw-bold">อาการที่เคยมีประวัติ (12 ข้อ)</span>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-success fw-bold"
                      onClick={toggleShowAllSymptomsNormal}
                    >
                      ✅ ปกติ / ไม่มีอาการเสี่ยงทั้ง 12 ข้อ
                    </button>
                  </div>
                  <div className="card-body">
                    <div className="row g-2">
                      {SYMPTOM_HISTORY_12.map((sym) => {
                        const checked = Boolean(formData.pastSymptoms[sym.id]);
                        return (
                          <div className="col-md-6" key={sym.id}>
                            <button
                              type="button"
                              onClick={() =>
                                updateSection('pastSymptoms', { [sym.id]: !checked })
                              }
                              className={`btn w-100 text-start fw-semibold ${
                                checked ? 'btn-danger text-white' : 'btn-white bg-white border text-dark'
                              }`}
                              style={{ minHeight: 46, borderRadius: 10 }}
                            >
                              {checked ? '☑️ ' : '⬜ '}
                              {sym.no}. {sym.label}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!loading && activeTab === 'chronic' && (
              <div>
                {/* หมวด 1 */}
                <SectionShell
                  no={1}
                  title="น้ำหนัก ส่วนสูง รอบเอว และดัชนีมวลกาย (BMI)"
                  targetText="ทุกคน"
                  applicable={targets.s1_anthropometry}
                  showAll={showAll22}
                >
                  <div className="row g-3 align-items-end">
                    <div className="col-6 col-md-3">
                      <label className="form-label fw-bold small">น้ำหนัก (กก.)</label>
                      <input
                        type="number"
                        step="0.1"
                        className="form-control form-control-lg"
                        placeholder="เช่น 60"
                        value={formData.s1.weightKg}
                        onChange={(e) => updateSection('s1', { weightKg: e.target.value })}
                      />
                    </div>
                    <div className="col-6 col-md-3">
                      <label className="form-label fw-bold small">ส่วนสูง (ซม.)</label>
                      <input
                        type="number"
                        step="0.1"
                        className="form-control form-control-lg"
                        placeholder="เช่น 165"
                        value={formData.s1.heightCm}
                        onChange={(e) => updateSection('s1', { heightCm: e.target.value })}
                      />
                    </div>
                    <div className="col-6 col-md-3">
                      <label className="form-label fw-bold small">รอบเอว (ซม.)</label>
                      <input
                        type="number"
                        step="0.1"
                        className="form-control form-control-lg"
                        placeholder="เช่น 82"
                        value={formData.s1.waistCm}
                        onChange={(e) => updateSection('s1', { waistCm: e.target.value })}
                      />
                    </div>
                    <div className="col-6 col-md-3">
                      <div className={`p-2 rounded-3 text-center ${LEVEL_BADGE[evaluation.bmiInfo.level]}`}>
                        <div className="small">BMI อัตโนมัติ</div>
                        <div className="fs-5 fw-bold">{evaluation.bmi ?? '-'}</div>
                        <div className="small">{evaluation.bmiInfo.label}</div>
                      </div>
                    </div>
                  </div>
                </SectionShell>

                {/* หมวด 2 */}
                <SectionShell
                  no={2}
                  title="ความดันโลหิต (BP)"
                  targetText="อายุ 35 ปีขึ้นไป"
                  applicable={targets.s2_blood_pressure}
                  showAll={showAll22}
                >
                  <div className="row g-3">
                    <div className="col-md-6">
                      <div className="fw-bold small mb-1">วัดครั้งที่ 1</div>
                      <div className="input-group input-group-lg">
                        <input
                          type="number"
                          className="form-control"
                          placeholder="ตัวบน (SBP)"
                          value={formData.s2.sbp1}
                          onChange={(e) => updateSection('s2', { sbp1: e.target.value })}
                        />
                        <span className="input-group-text">/</span>
                        <input
                          type="number"
                          className="form-control"
                          placeholder="ตัวล่าง (DBP)"
                          value={formData.s2.dbp1}
                          onChange={(e) => updateSection('s2', { dbp1: e.target.value })}
                        />
                        <span className="input-group-text">P</span>
                        <input
                          type="number"
                          className="form-control"
                          placeholder="ชีพจร"
                          aria-label="ชีพจร ครั้งที่ 1 (ครั้ง/นาที)"
                          value={formData.s2.pulse1 || ''}
                          onChange={(e) => updateSection('s2', { pulse1: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="fw-bold small mb-1">
                        วัดครั้งที่ 2 {evaluation.bpInfo.needsSecond && <span className="text-danger">(แนะนำวัดซ้ำเนื่องจาก &gt; 140/90)</span>}
                      </div>
                      <div className="input-group input-group-lg">
                        <input
                          type="number"
                          className="form-control"
                          placeholder="ตัวบน (SBP)"
                          value={formData.s2.sbp2}
                          onChange={(e) => updateSection('s2', { sbp2: e.target.value })}
                        />
                        <span className="input-group-text">/</span>
                        <input
                          type="number"
                          className="form-control"
                          placeholder="ตัวล่าง (DBP)"
                          value={formData.s2.dbp2}
                          onChange={(e) => updateSection('s2', { dbp2: e.target.value })}
                        />
                        <span className="input-group-text">P</span>
                        <input
                          type="number"
                          className="form-control"
                          placeholder="ชีพจร"
                          aria-label="ชีพจร ครั้งที่ 2 (ครั้ง/นาที)"
                          value={formData.s2.pulse2 || ''}
                          onChange={(e) => updateSection('s2', { pulse2: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                  <div className={`mt-2 badge px-3 py-2 ${LEVEL_BADGE[evaluation.bpInfo.level]}`}>
                    ผลความดัน: {evaluation.bpInfo.label}
                  </div>
                </SectionShell>

                {/* หมวด 3 */}
                <SectionShell
                  no={3}
                  title="เบาหวาน / น้ำตาลในเลือด (DTX)"
                  targetText="อายุ 35 ปีขึ้นไป"
                  applicable={targets.s3_diabetes}
                  showAll={showAll22}
                >
                  <div className="row g-3 align-items-center">
                    <div className="col-md-6 d-flex flex-wrap gap-2">
                      <ChoiceButton
                        active={formData.s3.fastingType === 'fasting'}
                        onClick={() => updateSection('s3', { fastingType: 'fasting' })}
                      >
                        ก่อนอาหาร (งด 6–8 ชม.)
                      </ChoiceButton>
                      <ChoiceButton
                        active={formData.s3.fastingType === 'postprandial'}
                        onClick={() => updateSection('s3', { fastingType: 'postprandial' })}
                      >
                        หลังอาหาร
                      </ChoiceButton>
                    </div>
                    <div className="col-md-3">
                      <div className="input-group input-group-lg">
                        <input
                          type="number"
                          className="form-control"
                          placeholder="ค่าน้ำตาล"
                          value={formData.s3.dtxMgDl}
                          onChange={(e) => updateSection('s3', { dtxMgDl: e.target.value })}
                        />
                        <span className="input-group-text">mg/dL</span>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <span className={`badge px-3 py-2 w-100 ${LEVEL_BADGE[evaluation.sugarInfo.level]}`}>
                        {evaluation.sugarInfo.label}
                      </span>
                    </div>
                  </div>
                </SectionShell>

                {/* หมวด 4 */}
                <SectionShell
                  no={4}
                  title="คัดกรองไวรัสตับอักเสบ B และ C (1 ครั้งในชีวิต)"
                  targetText="เกิดก่อน พ.ศ. 2535"
                  applicable={targets.s4_hepatitis_bc}
                  showAll={showAll22}
                >
                  <div className="row g-3">
                    <div className="col-md-6">
                      <div className="fw-bold small mb-2">ไวรัสตับอักเสบ B (HBV)</div>
                      <div className="d-flex gap-2">
                        <ChoiceButton
                          active={formData.s4.hbvResult === 'negative'}
                          variant="success"
                          onClick={() => updateSection('s4', { hbvResult: 'negative' })}
                        >
                          ผลลบ (ไม่พบเชื้อ)
                        </ChoiceButton>
                        <ChoiceButton
                          active={formData.s4.hbvResult === 'positive'}
                          variant="danger"
                          onClick={() => updateSection('s4', { hbvResult: 'positive' })}
                        >
                          ผลบวก
                        </ChoiceButton>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="fw-bold small mb-2">ไวรัสตับอักเสบ C (HBC)</div>
                      <div className="d-flex gap-2">
                        <ChoiceButton
                          active={formData.s4.hbcResult === 'negative'}
                          variant="success"
                          onClick={() => updateSection('s4', { hbcResult: 'negative' })}
                        >
                          ผลลบ (ไม่พบเชื้อ)
                        </ChoiceButton>
                        <ChoiceButton
                          active={formData.s4.hbcResult === 'positive'}
                          variant="danger"
                          onClick={() => updateSection('s4', { hbcResult: 'positive' })}
                        >
                          ผลบวก
                        </ChoiceButton>
                      </div>
                    </div>
                  </div>
                </SectionShell>

                {/* หมวด 5 */}
                <SectionShell
                  no={5}
                  title="คัดกรองมะเร็งเต้านมด้วยตนเอง"
                  targetText="สตรีอายุ 30–70 ปี"
                  applicable={targets.s5_breast_cancer}
                  showAll={showAll22}
                >
                  <div className="d-flex flex-wrap gap-2 align-items-center">
                    <ChoiceButton
                      active={formData.s5.result === 'normal'}
                      variant="success"
                      onClick={() => updateSection('s5', { result: 'normal', abnormalDetail: '' })}
                    >
                      ปกติ
                    </ChoiceButton>
                    <ChoiceButton
                      active={formData.s5.result === 'abnormal'}
                      variant="danger"
                      onClick={() => updateSection('s5', { result: 'abnormal' })}
                    >
                      ผิดปกติ
                    </ChoiceButton>
                    {formData.s5.result === 'abnormal' && (
                      <input
                        type="text"
                        className="form-control flex-grow-1"
                        style={{ minHeight: 46 }}
                        placeholder="ระบุอาการผิดปกติที่พบ..."
                        value={formData.s5.abnormalDetail || ''}
                        onChange={(e) => updateSection('s5', { abnormalDetail: e.target.value })}
                      />
                    )}
                  </div>
                </SectionShell>

                {/* หมวด 6 */}
                <SectionShell
                  no={6}
                  title="คัดกรองมะเร็งปากมดลูก (ตรวจซ้ำทุก 5 ปี)"
                  targetText="สตรีอายุ 30–59 ปี"
                  applicable={targets.s6_cervical_cancer}
                  showAll={showAll22}
                >
                  <div className="d-flex flex-wrap gap-2 align-items-center">
                    <ChoiceButton
                      active={formData.s6.everScreened === 'ever'}
                      variant="success"
                      onClick={() => updateSection('s6', { everScreened: 'ever' })}
                    >
                      เคยตรวจ
                    </ChoiceButton>
                    <ChoiceButton
                      active={formData.s6.everScreened === 'never'}
                      variant="warning"
                      onClick={() => updateSection('s6', { everScreened: 'never', screenedYearBE: '' })}
                    >
                      ไม่เคยตรวจ
                    </ChoiceButton>
                    {formData.s6.everScreened === 'ever' && (
                      <input
                        type="text"
                        className="form-control"
                        style={{ maxWidth: 200, minHeight: 46 }}
                        placeholder="ระบุปี พ.ศ. ที่ตรวจ"
                        value={formData.s6.screenedYearBE || ''}
                        onChange={(e) => updateSection('s6', { screenedYearBE: e.target.value })}
                      />
                    )}
                  </div>
                </SectionShell>

                {/* หมวด 7 */}
                <SectionShell
                  no={7}
                  title="คัดกรองมะเร็งลำไส้ (ตรวจซ้ำทุก 1–2 ปี)"
                  targetText="อายุ 50–70 ปี"
                  applicable={targets.s7_colorectal_cancer}
                  showAll={showAll22}
                >
                  <div className="d-flex flex-wrap gap-2 align-items-center">
                    <ChoiceButton
                      active={formData.s7.everScreened === 'ever'}
                      variant="success"
                      onClick={() => updateSection('s7', { everScreened: 'ever' })}
                    >
                      เคยตรวจ
                    </ChoiceButton>
                    <ChoiceButton
                      active={formData.s7.everScreened === 'never'}
                      variant="warning"
                      onClick={() => updateSection('s7', { everScreened: 'never', screenedYearBE: '' })}
                    >
                      ไม่เคยตรวจ
                    </ChoiceButton>
                    {formData.s7.everScreened === 'ever' && (
                      <input
                        type="text"
                        className="form-control"
                        style={{ maxWidth: 200, minHeight: 46 }}
                        placeholder="ระบุปี พ.ศ. ที่ตรวจ"
                        value={formData.s7.screenedYearBE || ''}
                        onChange={(e) => updateSection('s7', { screenedYearBE: e.target.value })}
                      />
                    )}
                  </div>
                </SectionShell>
              </div>
            )}

            {!loading && activeTab === 'behavior' && (
              <div>
                <div className="d-flex justify-content-end mb-2">
                  <button
                    type="button"
                    className="btn btn-success fw-bold"
                    style={{ minHeight: 44, borderRadius: 10 }}
                    onClick={setBehaviorAllNormal}
                  >
                    ✅ ตั้งค่าพฤติกรรมปกติทั้งหมด (ไม่สูบ ไม่ดื่ม ไม่พบเสี่ยง TB / 2Q)
                  </button>
                </div>

                {/* หมวด 8 */}
                <SectionShell
                  no={8}
                  title="คัดกรองบุหรี่"
                  targetText="อายุ 15 ปีขึ้นไป"
                  applicable={targets.s8_smoking}
                  showAll={showAll22}
                  codeBadge={evaluation.smokingInfo.codes.join(', ')}
                >
                  <div className="d-flex flex-wrap gap-2 mb-2">
                    <ChoiceButton
                      active={formData.s8.status === 'never'}
                      variant="success"
                      onClick={() => updateSection('s8', { status: 'never' })}
                    >
                      ไม่เคยสูบเลย (1B52)
                    </ChoiceButton>
                    <ChoiceButton
                      active={formData.s8.status === 'quit'}
                      variant="info"
                      onClick={() => updateSection('s8', { status: 'quit' })}
                    >
                      เคยสูบแต่เลิกแล้ว (1B51)
                    </ChoiceButton>
                    <ChoiceButton
                      active={formData.s8.status === 'current'}
                      variant="danger"
                      onClick={() => updateSection('s8', { status: 'current' })}
                    >
                      ยังสูบอยู่ (1B50)
                    </ChoiceButton>
                  </div>

                  {formData.s8.status === 'current' && (
                    <div className="p-3 bg-light rounded-3 border mt-2">
                      <div className="mb-2">
                        <div className="small fw-bold mb-1">สูบบุหรี่กี่มวน/วัน</div>
                        <div className="d-flex flex-wrap gap-2">
                          <ChoiceButton active={formData.s8.cigsPerDay === '1_10'} onClick={() => updateSection('s8', { cigsPerDay: '1_10' })}>
                            1–10 มวน (1B501)
                          </ChoiceButton>
                          <ChoiceButton active={formData.s8.cigsPerDay === '11_19'} onClick={() => updateSection('s8', { cigsPerDay: '11_19' })}>
                            11–19 มวน (1B502)
                          </ChoiceButton>
                          <ChoiceButton active={formData.s8.cigsPerDay === '20_up'} variant="danger" onClick={() => updateSection('s8', { cigsPerDay: '20_up' })}>
                            20 มวนขึ้นไป (1B503)
                          </ChoiceButton>
                        </div>
                      </div>
                      <div className="mb-2">
                        <div className="small fw-bold mb-1">ระยะเวลาที่สูบมวนแรกหลังตื่นนอน</div>
                        <div className="d-flex flex-wrap gap-2">
                          <ChoiceButton active={formData.s8.firstCigWait === 'lt_30m'} variant="danger" onClick={() => updateSection('s8', { firstCigWait: 'lt_30m' })}>
                            น้อยกว่า 30 นาที (1B504)
                          </ChoiceButton>
                          <ChoiceButton active={formData.s8.firstCigWait === 'gt_30m'} onClick={() => updateSection('s8', { firstCigWait: 'gt_30m' })}>
                            มากกว่า 30 นาที (1B505)
                          </ChoiceButton>
                          <ChoiceButton active={formData.s8.firstCigWait === 'gte_1h'} onClick={() => updateSection('s8', { firstCigWait: 'gte_1h' })}>
                            1 ชม. ขึ้นไป (1B506)
                          </ChoiceButton>
                        </div>
                      </div>
                      <div>
                        <div className="small fw-bold mb-1">การดูแลของเจ้าหน้าที่</div>
                        <div className="d-flex flex-wrap gap-2">
                          <ChoiceButton active={formData.s8.staffCare === 'advice'} onClick={() => updateSection('s8', { staffCare: 'advice' })}>
                            ให้คำแนะนำ (1B530)
                          </ChoiceButton>
                          <ChoiceButton active={formData.s8.staffCare === 'counseling'} onClick={() => updateSection('s8', { staffCare: 'counseling' })}>
                            ให้คำปรึกษาเลิกบุหรี่ (1B531)
                          </ChoiceButton>
                          <ChoiceButton active={formData.s8.staffCare === 'counseling_med'} onClick={() => updateSection('s8', { staffCare: 'counseling_med' })}>
                            ให้คำปรึกษาและยาเลิกบุหรี่ (1B532)
                          </ChoiceButton>
                        </div>
                      </div>
                    </div>
                  )}
                </SectionShell>

                {/* หมวด 9 */}
                <SectionShell
                  no={9}
                  title="คัดกรองสุรา (ASSIST)"
                  targetText="อายุ 15 ปีขึ้นไป"
                  applicable={targets.s9_alcohol}
                  showAll={showAll22}
                  codeBadge={evaluation.alcoholInfo.codes.join(', ')}
                >
                  <div className="d-flex flex-wrap gap-2 mb-2">
                    <ChoiceButton
                      active={formData.s9.status === 'never'}
                      variant="success"
                      onClick={() => updateSection('s9', { status: 'never' })}
                    >
                      ไม่เคยดื่ม (1B600)
                    </ChoiceButton>
                    <ChoiceButton
                      active={formData.s9.status === 'quit_1y'}
                      variant="info"
                      onClick={() => updateSection('s9', { status: 'quit_1y' })}
                    >
                      เคยดื่มแต่หยุดแล้ว 1 ปี+ (1B601)
                    </ChoiceButton>
                    <ChoiceButton
                      active={formData.s9.status === 'current'}
                      variant="warning"
                      onClick={() => updateSection('s9', { status: 'current' })}
                    >
                      ดื่ม (ประเมินข้อ 2–3)
                    </ChoiceButton>
                  </div>

                  {formData.s9.status === 'current' && (
                    <div className="p-3 bg-light rounded-3 border mt-2">
                      {ASSIST_Q2_QUESTIONS.map((q, idx) => {
                        if (idx > 0 && formData.s9.q2_1 === 'never') return null;
                        return (
                          <div className="mb-3" key={q.id}>
                            <div className="small fw-bold mb-1">{q.label}</div>
                            <div className="d-flex flex-wrap gap-2">
                              {q.options.map((opt) => (
                                <ChoiceButton
                                  key={opt.value}
                                  active={formData.s9[q.id] === opt.value}
                                  onClick={() => updateSection('s9', { [q.id]: opt.value })}
                                >
                                  {opt.label} ({opt.score})
                                </ChoiceButton>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      {ASSIST_Q3_QUESTIONS.map((q) => (
                        <div className="mb-3" key={q.id}>
                          <div className="small fw-bold mb-1">{q.label}</div>
                          <div className="d-flex flex-wrap gap-2">
                            {q.options.map((opt) => (
                              <ChoiceButton
                                key={opt.value}
                                active={formData.s9[q.id] === opt.value}
                                onClick={() => updateSection('s9', { [q.id]: opt.value })}
                              >
                                {opt.label} ({opt.score})
                              </ChoiceButton>
                            ))}
                          </div>
                        </div>
                      ))}
                      <div className={`badge px-3 py-2 ${LEVEL_BADGE[evaluation.alcoholInfo.level]}`}>
                        แปลผล: {evaluation.alcoholInfo.label}
                      </div>
                    </div>
                  )}
                </SectionShell>

                {/* หมวด 10 */}
                <SectionShell
                  no={10}
                  title="การออกกำลังกาย"
                  targetText="อายุ 15 ปีขึ้นไป"
                  applicable={targets.s10_exercise}
                  showAll={showAll22}
                >
                  <div className="d-flex flex-wrap gap-2">
                    {[
                      { v: 'daily_30m', l: 'ทุกวัน 30 นาที/ครั้ง' },
                      { v: 'gt_3_per_week', l: 'มากกว่า 3 ครั้ง/สัปดาห์' },
                      { v: '3_per_week', l: 'สัปดาห์ละ 3 ครั้ง' },
                      { v: 'lt_3_per_week', l: 'น้อยกว่า 3 ครั้ง/สัปดาห์' },
                      { v: 'none', l: 'ไม่ออกกำลังกายเลย' },
                    ].map((opt) => (
                      <ChoiceButton
                        key={opt.v}
                        active={formData.s10.frequency === opt.v}
                        variant={opt.v === 'none' ? 'warning' : 'success'}
                        onClick={() => updateSection('s10', { frequency: opt.v })}
                      >
                        {opt.l}
                      </ChoiceButton>
                    ))}
                  </div>
                </SectionShell>

                {/* หมวด 11 */}
                <SectionShell
                  no={11}
                  title="คัดกรองวัณโรค"
                  targetText="ทุกคน"
                  applicable={targets.s11_tuberculosis}
                  showAll={showAll22}
                >
                  <div className="row g-2 mb-3">
                    <div className="col-md-4">
                      <ChoiceButton
                        active={Boolean(formData.s11.hasFamilyTb)}
                        variant="warning"
                        className="w-100"
                        onClick={() => updateSection('s11', { hasFamilyTb: !formData.s11.hasFamilyTb })}
                      >
                        มีผู้ป่วยวัณโรคในครอบครัว
                      </ChoiceButton>
                      {formData.s11.hasFamilyTb && (
                        <input
                          type="text"
                          className="form-control mt-1"
                          placeholder="ระบุความสัมพันธ์..."
                          value={formData.s11.familyTbDetail || ''}
                          onChange={(e) => updateSection('s11', { familyTbDetail: e.target.value })}
                        />
                      )}
                    </div>
                    <div className="col-md-4">
                      <ChoiceButton
                        active={Boolean(formData.s11.isTbCaregiver)}
                        variant="warning"
                        className="w-100"
                        onClick={() => updateSection('s11', { isTbCaregiver: !formData.s11.isTbCaregiver })}
                      >
                        เป็นผู้ดูแลผู้ป่วยวัณโรค
                      </ChoiceButton>
                      {formData.s11.isTbCaregiver && (
                        <input
                          type="text"
                          className="form-control mt-1"
                          placeholder="ระบุ..."
                          value={formData.s11.tbCaregiverDetail || ''}
                          onChange={(e) => updateSection('s11', { tbCaregiverDetail: e.target.value })}
                        />
                      )}
                    </div>
                    <div className="col-md-4">
                      <div className="d-flex gap-2">
                        <ChoiceButton
                          active={formData.s11.everHadTb === 'never'}
                          variant="success"
                          className="flex-fill"
                          onClick={() => updateSection('s11', { everHadTb: 'never' })}
                        >
                          ไม่เคยเป็น TB
                        </ChoiceButton>
                        <ChoiceButton
                          active={formData.s11.everHadTb === 'ever'}
                          variant="warning"
                          className="flex-fill"
                          onClick={() => updateSection('s11', { everHadTb: 'ever' })}
                        >
                          เคยเป็น TB
                        </ChoiceButton>
                      </div>
                      {formData.s11.everHadTb === 'ever' && (
                        <div className="d-flex gap-1 mt-1">
                          <input
                            type="text"
                            className="form-control"
                            placeholder="เมื่อปี..."
                            value={formData.s11.tbYear || ''}
                            onChange={(e) => updateSection('s11', { tbYear: e.target.value })}
                          />
                          <input
                            type="text"
                            className="form-control"
                            placeholder="รักษาที่..."
                            value={formData.s11.tbHospital || ''}
                            onChange={(e) => updateSection('s11', { tbHospital: e.target.value })}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="fw-bold small mb-2">อาการสงสัยวัณโรคใน 1 เดือนที่ผ่านมา (รวม ≥ 3 คะแนน ส่งตรวจวินิจฉัย)</div>
                  <div className="row g-2">
                    {TB_SYMPTOM_QUESTIONS.map((q) => {
                      const hasSym = Boolean(formData.s11.symptoms?.[q.id]);
                      return (
                        <div className="col-md-6" key={q.id}>
                          <div className="p-2 bg-white border rounded-3 d-flex justify-content-between align-items-center gap-2">
                            <span className="small fw-semibold">{q.label}</span>
                            <div className="btn-group flex-shrink-0">
                              <button
                                type="button"
                                className={`btn btn-sm fw-bold ${!hasSym ? 'btn-success' : 'btn-outline-secondary'}`}
                                onClick={() =>
                                  updateSection('s11', {
                                    symptoms: { ...formData.s11.symptoms, [q.id]: false },
                                  })
                                }
                              >
                                ไม่มี (0)
                              </button>
                              <button
                                type="button"
                                className={`btn btn-sm fw-bold ${hasSym ? 'btn-danger' : 'btn-outline-secondary'}`}
                                onClick={() =>
                                  updateSection('s11', {
                                    symptoms: { ...formData.s11.symptoms, [q.id]: true },
                                  })
                                }
                              >
                                มี ({q.weight})
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className={`mt-2 badge px-3 py-2 ${LEVEL_BADGE[evaluation.tbInfo.level]}`}>
                    {evaluation.tbInfo.label}
                  </div>
                </SectionShell>

                {/* หมวด 12 */}
                <SectionShell
                  no={12}
                  title="คัดกรองโรคซึมเศร้า (2Q)"
                  targetText="อายุ 15 ปีขึ้นไป"
                  applicable={targets.s12_depression_2q}
                  showAll={showAll22}
                  codeBadge={evaluation.dep2qInfo.code}
                >
                  <div className="row g-2">
                    <div className="col-md-6">
                      <div className="p-2 bg-light rounded-3 border">
                        <div className="small fw-bold mb-2">1. ใน 2 สัปดาห์ที่ผ่านมา รวมวันนี้ ท่านรู้สึกหดหู่ เศร้า หรือท้อแท้สิ้นหวังหรือไม่</div>
                        <div className="d-flex gap-2">
                          <ChoiceButton active={!formData.s12.q1_sad} variant="success" onClick={() => updateSection('s12', { q1_sad: false })}>
                            ไม่มี
                          </ChoiceButton>
                          <ChoiceButton active={Boolean(formData.s12.q1_sad)} variant="danger" onClick={() => updateSection('s12', { q1_sad: true })}>
                            มี
                          </ChoiceButton>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="p-2 bg-light rounded-3 border">
                        <div className="small fw-bold mb-2">2. ใน 2 สัปดาห์ที่ผ่านมา รวมวันนี้ ท่านรู้สึกเบื่อ ทำอะไรก็ไม่เพลิดเพลินหรือไม่</div>
                        <div className="d-flex gap-2">
                          <ChoiceButton active={!formData.s12.q2_bored} variant="success" onClick={() => updateSection('s12', { q2_bored: false })}>
                            ไม่มี
                          </ChoiceButton>
                          <ChoiceButton active={Boolean(formData.s12.q2_bored)} variant="danger" onClick={() => updateSection('s12', { q2_bored: true })}>
                            มี
                          </ChoiceButton>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className={`mt-2 badge px-3 py-2 ${LEVEL_BADGE[evaluation.dep2qInfo.level]}`}>
                    {evaluation.dep2qInfo.label} ({evaluation.dep2qInfo.code})
                  </div>
                </SectionShell>
              </div>
            )}

            {!loading && activeTab === 'elderly1' && (
              <div>
                {profile.age < 60 && !showAll22 ? (
                  <div className="alert alert-info">
                    <strong>ℹ️ หมวด 13–20 เป็นการคัดกรองผู้สูงอายุ 60 ปีขึ้นไป</strong> (ผู้รับตรวจอายุ {profile.age} ปี)
                    <div className="mt-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-primary fw-bold"
                        onClick={() => setShowAll22(true)}
                      >
                        📋 เปิดแสดงครบทั้ง 22 หมวดเพื่อตรวจ/บันทึก
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="d-flex justify-content-end mb-2">
                    <button
                      type="button"
                      className="btn btn-success fw-bold"
                      style={{ minHeight: 44, borderRadius: 10 }}
                      onClick={setElderly13to20Normal}
                    >
                      ✅ ตั้งค่าผู้สูงอายุแข็งแรงปกติ (หมวด 13–20)
                    </button>
                  </div>
                )}

                {/* หมวด 13 */}
                <SectionShell
                  no={13}
                  title="สุขภาพช่องปาก"
                  targetText="อายุ 60 ปีขึ้นไป"
                  applicable={targets.s13_oral_health}
                  showAll={showAll22}
                  codeBadge={evaluation.oralInfo.code}
                >
                  <div className="row g-2 align-items-center mb-2">
                    <div className="col-md-4">
                      <label className="form-label small fw-bold">1.1 จำนวนฟันแท้ในช่องปาก (ซี่)</label>
                      <input
                        type="number"
                        className="form-control"
                        style={{ minHeight: 44 }}
                        value={formData.s13.naturalTeethCount}
                        onChange={(e) => {
                          const cnt = e.target.value;
                          updateSection('s13', {
                            naturalTeethCount: cnt,
                            lessThan20Teeth: cnt !== '' && Number(cnt) < 20,
                          });
                        }}
                      />
                    </div>
                    <div className="col-md-8">
                      <label className="form-label small fw-bold d-block">4. สภาพในช่องปากสะอาดหรือไม่</label>
                      <div className="d-flex gap-2">
                        <ChoiceButton active={formData.s13.cleanliness !== 'unclean'} variant="success" onClick={() => updateSection('s13', { cleanliness: 'clean' })}>
                          สะอาด (1B1260)
                        </ChoiceButton>
                        <ChoiceButton active={formData.s13.cleanliness === 'unclean'} variant="danger" onClick={() => updateSection('s13', { cleanliness: 'unclean' })}>
                          ไม่สะอาด (1B1261)
                        </ChoiceButton>
                      </div>
                    </div>
                  </div>
                  <div className="row g-2">
                    {[
                      { k: 'lessThan20Teeth', l: '1.2 ฟันแท้น้อยกว่าเกณฑ์ (<20 ซี่ หรือ <4 คู่สบ)' },
                      { k: 'hasDecay', l: '1.3 มีฟันหรือรากฟันผุ' },
                      { k: 'hasGumAbscessLoose', l: '1.4 มีเหงือกบวม ฝีหนอง หรือฟันโยก' },
                      { k: 'hasDenture', l: '1.5 ฟันปลอมชนิดติดแน่น/ถอดได้' },
                      { k: 'hasOralUlcerOver2W', l: '2. ก้อน/รอยแดง/รอยขาว/แผลเรื้อรัง > 2 สัปดาห์' },
                      { k: 'hasDryMouth', l: '3. ปากแห้ง ลิ้นแห้งติดเพดานบ่อย' },
                    ].map((item) => {
                      const val = Boolean(formData.s13[item.k]);
                      return (
                        <div className="col-md-6" key={item.k}>
                          <div className="p-2 bg-white border rounded-3 d-flex justify-content-between align-items-center gap-2">
                            <span className="small fw-semibold">{item.l}</span>
                            <div className="btn-group flex-shrink-0">
                              <button
                                type="button"
                                className={`btn btn-sm fw-bold ${!val ? 'btn-success' : 'btn-outline-secondary'}`}
                                onClick={() => updateSection('s13', { [item.k]: false })}
                              >
                                ไม่มี
                              </button>
                              <button
                                type="button"
                                className={`btn btn-sm fw-bold ${val ? 'btn-warning' : 'btn-outline-secondary'}`}
                                onClick={() => updateSection('s13', { [item.k]: true })}
                              >
                                มี
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </SectionShell>

                {/* หมวด 14 */}
                <SectionShell
                  no={14}
                  title="การได้ยิน (ถูนิ้วห่างหู 1 นิ้ว)"
                  targetText="อายุ 60 ปีขึ้นไป"
                  applicable={targets.s14_hearing}
                  showAll={showAll22}
                  codeBadge={evaluation.hearingInfo.code}
                >
                  <div className="row g-3">
                    <div className="col-md-6">
                      <div className="fw-bold small mb-1">หูซ้าย</div>
                      <div className="d-flex gap-2">
                        <ChoiceButton active={formData.s14.leftEar !== 'not_hear'} variant="success" onClick={() => updateSection('s14', { leftEar: 'hear' })}>
                          ได้ยิน
                        </ChoiceButton>
                        <ChoiceButton active={formData.s14.leftEar === 'not_hear'} variant="danger" onClick={() => updateSection('s14', { leftEar: 'not_hear' })}>
                          ไม่ได้ยิน
                        </ChoiceButton>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="fw-bold small mb-1">หูขวา</div>
                      <div className="d-flex gap-2">
                        <ChoiceButton active={formData.s14.rightEar !== 'not_hear'} variant="success" onClick={() => updateSection('s14', { rightEar: 'hear' })}>
                          ได้ยิน
                        </ChoiceButton>
                        <ChoiceButton active={formData.s14.rightEar === 'not_hear'} variant="danger" onClick={() => updateSection('s14', { rightEar: 'not_hear' })}>
                          ไม่ได้ยิน
                        </ChoiceButton>
                      </div>
                    </div>
                  </div>
                  <div className={`mt-2 badge px-3 py-2 ${LEVEL_BADGE[evaluation.hearingInfo.level]}`}>
                    {evaluation.hearingInfo.label}
                  </div>
                </SectionShell>

                {/* หมวด 15 */}
                <SectionShell
                  no={15}
                  title="สุขภาพทางตา (5 ข้อ)"
                  targetText="อายุ 60 ปีขึ้นไป"
                  applicable={targets.s15_vision}
                  showAll={showAll22}
                  codeBadge={evaluation.visionInfo.codes.join(', ')}
                >
                  <div className="vstack gap-2">
                    {[
                      { key: 'nearVision', label: '1. อ่านหนังสือระยะ 1 ฟุต ไม่ได้/ไม่ชัด (ใกล้)', c0: '1B1240', c1: '1B1241', c2: '1B1242' },
                      { key: 'farVision', label: '2. นับนิ้วระยะ 3 เมตร ถูกน้อยกว่า 3/4 ครั้ง (ไกล)', c0: '1B1243', c1: '1B1244', c2: '1B1245' },
                      { key: 'cataract', eyeKey: 'cataractEye', label: '3. ปิดตาดูทีละข้าง มองมัวคล้ายหมอกบัง (เสี่ยงต้อกระจก)', c0: '1B1250', c1: '1B1251', c2: '1B1252' },
                      { key: 'glaucoma', eyeKey: 'glaucomaEye', label: '4. เห็นชัดเฉพาะตรงกลาง เดินชนสิ่งของ (เสี่ยงต้อหิน)', c0: '1B1253', c1: '1B1254', c2: '1B1255' },
                      { key: 'amd', eyeKey: 'amdEye', label: '5. เห็นจุดดำกลางภาพ/ภาพบิดเบี้ยว (เสี่ยงจอตาเสื่อม)', c0: '1B1256', c1: '1B1257', c2: '1B1258' },
                    ].map((row) => (
                      <div className="p-2 bg-white border rounded-3" key={row.key}>
                        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                          <span className="small fw-bold">{row.label}</span>
                          <div className="d-flex flex-wrap gap-1">
                            <ChoiceButton active={formData.s15[row.key] === 'normal'} variant="success" onClick={() => updateSection('s15', { [row.key]: 'normal', ...(row.eyeKey ? { [row.eyeKey]: '' } : {}) })}>
                              ปกติ ({row.c0})
                            </ChoiceButton>
                            <ChoiceButton active={formData.s15[row.key] === 'problem'} variant="warning" onClick={() => updateSection('s15', { [row.key]: 'problem' })}>
                              มีปัญหา ({row.c1})
                            </ChoiceButton>
                            <ChoiceButton active={formData.s15[row.key] === 'refer'} variant="danger" onClick={() => updateSection('s15', { [row.key]: 'refer' })}>
                              ส่งต่อ ({row.c2})
                            </ChoiceButton>
                          </div>
                        </div>
                        {row.eyeKey && formData.s15[row.key] !== 'normal' && (
                          <div className="mt-2 d-flex align-items-center gap-2 small">
                            <span className="fw-semibold">ตาข้างที่พบปัญหา:</span>
                            {['ซ้าย', 'ขวา', 'ทั้งสองข้าง'].map((eye) => (
                              <button
                                key={eye}
                                type="button"
                                className={`btn btn-sm ${formData.s15[row.eyeKey] === eye ? 'btn-dark' : 'btn-outline-secondary'}`}
                                onClick={() => updateSection('s15', { [row.eyeKey]: eye })}
                              >
                                {eye}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </SectionShell>

                {/* หมวด 16 */}
                <SectionShell
                  no={16}
                  title="การทดสอบสภาพสมอง (Mini-Cog)"
                  targetText="อายุ 60 ปีขึ้นไป"
                  applicable={targets.s16_minicog}
                  showAll={showAll22}
                  codeBadge={evaluation.miniCogInfo.code}
                >
                  <div className="mb-2">
                    <div className="small fw-bold mb-1">1. บอกคำ 3 คำให้จำ (หลานสาว, สวรรค์, ภูเขา) แล้วทวน</div>
                    <div className="d-flex flex-wrap gap-2">
                      {[{ k: 'w1', l: 'หลานสาว' }, { k: 'w2', l: 'สวรรค์' }, { k: 'w3', l: 'ภูเขา' }].map((w) => (
                        <ChoiceButton
                          key={w.k}
                          active={Boolean(formData.s16.repeatWords?.[w.k])}
                          onClick={() =>
                            updateSection('s16', {
                              repeatWords: {
                                ...formData.s16.repeatWords,
                                [w.k]: !formData.s16.repeatWords?.[w.k],
                              },
                            })
                          }
                        >
                          ทวนคำ: {w.l}
                        </ChoiceButton>
                      ))}
                    </div>
                  </div>
                  <div className="mb-2">
                    <div className="small fw-bold mb-1">2. วาดรูปนาฬิกาเวลา 11.10 น. (2 คะแนน)</div>
                    <div className="d-flex gap-2">
                      <ChoiceButton active={Number(formData.s16.clockScore) === 2} variant="success" onClick={() => updateSection('s16', { clockScore: 2 })}>
                        วาดถูกต้อง (2 คะแนน)
                      </ChoiceButton>
                      <ChoiceButton active={Number(formData.s16.clockScore) === 0} variant="danger" onClick={() => updateSection('s16', { clockScore: 0 })}>
                        ไม่ถูกต้อง (0 คะแนน)
                      </ChoiceButton>
                    </div>
                  </div>
                  <div className="mb-2">
                    <div className="small fw-bold mb-1">3. ทดสอบจำคำ 3 คำที่ให้จำเมื่อสักครู่ (ข้อละ 1 คะแนน)</div>
                    <div className="d-flex flex-wrap gap-2">
                      {[{ k: 'w1', l: 'หลานสาว' }, { k: 'w2', l: 'สวรรค์' }, { k: 'w3', l: 'ภูเขา' }].map((w) => (
                        <ChoiceButton
                          key={w.k}
                          active={Boolean(formData.s16.recallWords?.[w.k])}
                          variant="success"
                          onClick={() =>
                            updateSection('s16', {
                              recallWords: {
                                ...formData.s16.recallWords,
                                [w.k]: !formData.s16.recallWords?.[w.k],
                              },
                            })
                          }
                        >
                          จำได้: {w.l} (+1)
                        </ChoiceButton>
                      ))}
                    </div>
                  </div>
                  <div className={`badge px-3 py-2 ${LEVEL_BADGE[evaluation.miniCogInfo.level]}`}>
                    {evaluation.miniCogInfo.label}
                  </div>
                </SectionShell>

                {/* หมวด 17 */}
                <SectionShell
                  no={17}
                  title="คัดกรองโรคข้อเข่าเสื่อม"
                  targetText="อายุ 60 ปีขึ้นไป"
                  applicable={targets.s17_knee_oa}
                  showAll={showAll22}
                  codeBadge={evaluation.kneeInfo.code}
                >
                  <div className="d-flex flex-wrap gap-2 mb-2">
                    <ChoiceButton active={!formData.s17.hasKneePain} variant="success" onClick={() => updateSection('s17', { hasKneePain: false })}>
                      ไม่ปวดเข่า (ปกติ)
                    </ChoiceButton>
                    <ChoiceButton active={Boolean(formData.s17.hasKneePain)} variant="warning" onClick={() => updateSection('s17', { hasKneePain: true })}>
                      ปวดเข่า (ประเมิน 5 ข้อ)
                    </ChoiceButton>
                  </div>
                  {formData.s17.hasKneePain && (
                    <div className="row g-2 mb-2">
                      {KNEE_SYMPTOM_QUESTIONS.map((q) => {
                        const checked = Boolean(formData.s17.symptoms?.[q.id]);
                        return (
                          <div className="col-md-6" key={q.id}>
                            <div className="p-2 bg-white border rounded-3 d-flex justify-content-between align-items-center gap-2">
                              <span className="small fw-semibold">{q.label}</span>
                              <div className="btn-group flex-shrink-0">
                                <button
                                  type="button"
                                  className={`btn btn-sm fw-bold ${!checked ? 'btn-success' : 'btn-outline-secondary'}`}
                                  onClick={() => updateSection('s17', { symptoms: { ...formData.s17.symptoms, [q.id]: false } })}
                                >
                                  ไม่ใช่
                                </button>
                                <button
                                  type="button"
                                  className={`btn btn-sm fw-bold ${checked ? 'btn-danger' : 'btn-outline-secondary'}`}
                                  onClick={() => updateSection('s17', { symptoms: { ...formData.s17.symptoms, [q.id]: true } })}
                                >
                                  ใช่
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className={`badge px-3 py-2 ${LEVEL_BADGE[evaluation.kneeInfo.level]}`}>
                    {evaluation.kneeInfo.label}
                  </div>
                </SectionShell>

                {/* หมวด 18 */}
                <SectionShell
                  no={18}
                  title="คัดกรองภาวะกลั้นปัสสาวะ"
                  targetText="อายุ 60 ปีขึ้นไป"
                  applicable={targets.s18_incontinence}
                  showAll={showAll22}
                  codeBadge={evaluation.incontinenceInfo.code}
                >
                  <div className="d-flex flex-wrap gap-2">
                    <ChoiceButton active={!formData.s18.hasIncontinence} variant="success" onClick={() => updateSection('s18', { hasIncontinence: false })}>
                      ไม่มีปัญหา (1B1284)
                    </ChoiceButton>
                    <ChoiceButton active={Boolean(formData.s18.hasIncontinence)} variant="danger" onClick={() => updateSection('s18', { hasIncontinence: true })}>
                      มีปัสสาวะเล็ด/ราด จนกระทบชีวิตประจำวัน (1B1285)
                    </ChoiceButton>
                  </div>
                </SectionShell>

                {/* หมวด 19 */}
                <SectionShell
                  no={19}
                  title="คัดกรองภาวะหกล้ม (TUGT เดิน 3 เมตรไป-กลับ)"
                  targetText="อายุ 60 ปีขึ้นไป"
                  applicable={targets.s19_fall_tugt}
                  showAll={showAll22}
                  codeBadge={evaluation.fallInfo.code}
                >
                  <div className="d-flex flex-wrap gap-2 mb-3">
                    <ChoiceButton active={!formData.s19.fellLast6Months} variant="success" onClick={() => updateSection('s19', { fellLast6Months: false })}>
                      6 เดือนที่ผ่านมา ไม่เคยหกล้ม
                    </ChoiceButton>
                    <ChoiceButton active={Boolean(formData.s19.fellLast6Months)} variant="danger" onClick={() => updateSection('s19', { fellLast6Months: true })}>
                      6 เดือนที่ผ่านมา เคยหกล้ม
                    </ChoiceButton>
                  </div>
                  <div className="p-3 bg-light rounded-3 border">
                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                      <strong>⏱️ นาฬิกาจับเวลาเดิน 3 เมตร (≥ 12 วินาที = เสี่ยงหกล้ม)</strong>
                      <div className="d-flex gap-2">
                        <button
                          type="button"
                          className={`btn btn-sm fw-bold ${timerRunning ? 'btn-danger' : 'btn-primary'}`}
                          onClick={() => setTimerRunning((v) => !v)}
                        >
                          {timerRunning ? '⏹️ หยุดจับเวลา' : '⏱️ เริ่มจับเวลา'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary fw-bold"
                          onClick={() => {
                            setTimerRunning(false);
                            setElapsedMs(0);
                            updateSection('s19', { walkMinutes: 0, walkSeconds: 0 });
                          }}
                        >
                          🔄 รีเซ็ต
                        </button>
                      </div>
                    </div>
                    <div className="row g-2 align-items-center">
                      <div className="col-6 col-md-3">
                        <label className="small fw-bold">นาที</label>
                        <input
                          type="number"
                          min="0"
                          className="form-control"
                          value={formData.s19.walkMinutes}
                          onChange={(e) => updateSection('s19', { walkMinutes: e.target.value })}
                        />
                      </div>
                      <div className="col-6 col-md-3">
                        <label className="small fw-bold">วินาที</label>
                        <input
                          type="number"
                          min="0"
                          max="59"
                          className="form-control"
                          value={formData.s19.walkSeconds}
                          onChange={(e) => updateSection('s19', { walkSeconds: e.target.value })}
                        />
                      </div>
                      <div className="col-12 col-md-6">
                        <span className={`badge px-3 py-2 ${LEVEL_BADGE[evaluation.fallInfo.level]}`}>
                          {evaluation.fallInfo.label}
                        </span>
                      </div>
                    </div>
                  </div>
                </SectionShell>

                {/* หมวด 20 */}
                <SectionShell
                  no={20}
                  title="ปัญหาการนอน"
                  targetText="อายุ 60 ปีขึ้นไป"
                  applicable={targets.s20_sleep}
                  showAll={showAll22}
                  codeBadge={evaluation.sleepInfo.codes.join(', ') || '-'}
                >
                  <div className="mb-2">
                    <div className="small fw-bold mb-1">คำถามที่ 1: ท่านมีปัญหาการนอนหลับหรือไม่</div>
                    <div className="d-flex flex-wrap gap-2">
                      <ChoiceButton active={!formData.s20.hasSleepProblem} variant="success" onClick={() => updateSection('s20', { hasSleepProblem: false })}>
                        ไม่มีปัญหา
                      </ChoiceButton>
                      <ChoiceButton active={Boolean(formData.s20.hasSleepProblem)} variant="warning" onClick={() => updateSection('s20', { hasSleepProblem: true })}>
                        มีปัญหาการนอน
                      </ChoiceButton>
                    </div>
                  </div>
                  {formData.s20.hasSleepProblem && (
                    <div className="p-2 bg-light rounded-3 border mb-2">
                      <div className="d-flex flex-wrap gap-2 mb-2">
                        {[
                          { k: 'insomnia', l: 'นอนไม่หลับ' },
                          { k: 'oversleep', l: 'นอนมากไป' },
                          { k: 'snoring', l: 'นอนกรน' },
                          { k: 'sleepwalking', l: 'นอนละเมอ' },
                        ].map((opt) => (
                          <ChoiceButton
                            key={opt.k}
                            active={Boolean(formData.s20.problems?.[opt.k])}
                            variant="warning"
                            onClick={() =>
                              updateSection('s20', {
                                problems: {
                                  ...formData.s20.problems,
                                  [opt.k]: !formData.s20.problems?.[opt.k],
                                },
                              })
                            }
                          >
                            {opt.l}
                          </ChoiceButton>
                        ))}
                      </div>
                      <div className="row g-2">
                        <div className="col-md-4">
                          <input
                            type="text"
                            className="form-control"
                            placeholder="อื่นๆ ระบุ..."
                            value={formData.s20.problems?.other || ''}
                            onChange={(e) =>
                              updateSection('s20', {
                                problems: { ...formData.s20.problems, other: e.target.value },
                              })
                            }
                          />
                        </div>
                        <div className="col-6 col-md-4">
                          <input
                            type="text"
                            className="form-control"
                            placeholder="ระยะเวลาที่มีปัญหา (ปี)"
                            value={formData.s20.durationYears || ''}
                            onChange={(e) => updateSection('s20', { durationYears: e.target.value })}
                          />
                        </div>
                        <div className="col-6 col-md-4">
                          <input
                            type="text"
                            className="form-control"
                            placeholder="เฉลี่ยนอนคืนละ (ชม.)"
                            value={formData.s20.avgHoursPerNight || ''}
                            onChange={(e) => updateSection('s20', { avgHoursPerNight: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="small fw-bold mb-1">คำถามที่ 2: ท่านมีอาการง่วง อ่อนเพลีย ตอนกลางวันหรือไม่</div>
                    <div className="d-flex gap-2">
                      <ChoiceButton active={!formData.s20.daytimeFatigue} variant="success" onClick={() => updateSection('s20', { daytimeFatigue: false })}>
                        ไม่มี
                      </ChoiceButton>
                      <ChoiceButton active={Boolean(formData.s20.daytimeFatigue)} variant="warning" onClick={() => updateSection('s20', { daytimeFatigue: true })}>
                        มี (1B1213)
                      </ChoiceButton>
                    </div>
                  </div>
                </SectionShell>
              </div>
            )}

            {!loading && activeTab === 'elderly2' && (
              <div>
                {profile.age < 60 && !showAll22 && (
                  <div className="alert alert-info">
                    <strong>ℹ️ หมวด 21–22 (MNA / ADL) สำหรับผู้สูงอายุ 60 ปีขึ้นไป</strong> ด้านล่างยังสามารถลงนามรับรองและบันทึกข้อมูลได้
                    <button
                      type="button"
                      className="btn btn-sm btn-primary fw-bold ms-2"
                      onClick={() => setShowAll22(true)}
                    >
                      เปิดแสดงครบ 22 หมวด
                    </button>
                  </div>
                )}

                {/* หมวด 21 */}
                <SectionShell
                  no={21}
                  title="ภาวะขาดสารอาหาร (MNA)"
                  targetText="อายุ 60 ปีขึ้นไป"
                  applicable={targets.s21_nutrition_mna}
                  showAll={showAll22}
                  codeBadge={evaluation.mnaInfo.code}
                >
                  <div className="vstack gap-2">
                    {MNA_QUESTIONS.map((q) => {
                      const activeScore =
                        q.id === 'mna6'
                          ? evaluation.mnaInfo.mna6
                          : q.id === 'mna7'
                          ? evaluation.mnaInfo.mna7
                          : Number(formData.s21[q.id]);
                      return (
                        <div className="p-2 bg-white border rounded-3" key={q.id}>
                          <div className="small fw-bold mb-1">{q.label}</div>
                          {q.id === 'mna7' && (
                            <div className="mb-2 d-flex align-items-center gap-2">
                              <span className="small">เส้นรอบวงน่อง (ซม.):</span>
                              <input
                                type="number"
                                step="0.1"
                                className="form-control form-control-sm"
                                style={{ maxWidth: 120 }}
                                value={formData.s21.calfCm}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  updateSection('s21', {
                                    calfCm: v,
                                    mna7: Number(v) >= 31 ? 3 : 0,
                                  });
                                }}
                              />
                            </div>
                          )}
                          <div className="d-flex flex-wrap gap-2">
                            {q.options.map((opt) => (
                              <ChoiceButton
                                key={opt.score}
                                active={activeScore === opt.score}
                                onClick={() => {
                                  if (q.id === 'mna6') updateSection('s21', { mna6Override: opt.score });
                                  else updateSection('s21', { [q.id]: opt.score });
                                }}
                              >
                                {opt.label}
                              </ChoiceButton>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className={`mt-2 badge px-3 py-2 ${LEVEL_BADGE[evaluation.mnaInfo.level]}`}>
                    {evaluation.mnaInfo.label}
                  </div>
                </SectionShell>

                {/* หมวด 22 */}
                <SectionShell
                  no={22}
                  title="การประเมินความสามารถในการทำกิจวัตรประจำวัน (ADL 10 ข้อ)"
                  targetText="อายุ 60 ปีขึ้นไป"
                  applicable={targets.s22_adl}
                  showAll={showAll22}
                  codeBadge={evaluation.adlInfo.code}
                  actionSlot={
                    <button
                      type="button"
                      className="btn btn-sm btn-success fw-bold"
                      onClick={setAdlFullNormal}
                    >
                      ✅ ช่วยเหลือตัวเองได้ทุกข้อ (20/20 ติดสังคม)
                    </button>
                  }
                >
                  <div className="vstack gap-2">
                    {ADL_QUESTIONS.map((q) => (
                      <div className="p-2 bg-white border rounded-3" key={q.id}>
                        <div className="small fw-bold mb-1">{q.label}</div>
                        <div className="d-flex flex-wrap gap-2">
                          {q.options.map((opt) => (
                            <ChoiceButton
                              key={opt.score}
                              active={Number(formData.s22[q.id]) === opt.score}
                              onClick={() => updateSection('s22', { [q.id]: opt.score })}
                            >
                              {opt.label}
                            </ChoiceButton>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className={`mt-2 badge px-3 py-2 ${LEVEL_BADGE[evaluation.adlInfo.level]}`}>
                    {evaluation.adlInfo.label}
                  </div>
                </SectionShell>

                {/* คำรับรองยินยอม & ลายเซ็น */}
                <div className="card border-primary-subtle" style={{ borderRadius: 14 }}>
                  <div className="card-header bg-white fw-bold">
                    ✍️ คำรับรองยินยอม & ลงลายมือชื่อ
                  </div>
                  <div className="card-body">
                    <div className="form-check mb-3">
                      <input
                        id="consent-2570"
                        type="checkbox"
                        className="form-check-input"
                        checked={Boolean(formData.consent.accepted)}
                        onChange={(e) => updateSection('consent', { accepted: e.target.checked })}
                      />
                      <label htmlFor="consent-2570" className="form-check-label small">
                        ทั้งนี้ขอรับรองว่าผู้มารับบริการได้เข้ามารับการตรวจคัดกรองภาวะสุขภาพประจำปี ในเขตรับผิดชอบ รพ.สต.บ้านโนนสว่าง จริง และยินยอมให้นำข้อมูลบันทึกในระบบหมอพร้อมและระบบของ รพ.สต.บ้านโนนสว่าง
                      </label>
                    </div>

                    <div className="row g-2 mb-3">
                      <div className="col-md-6">
                        <label className="form-label small fw-bold">ลงชื่อเจ้าหน้าที่ / อสม. ผู้คัดกรอง</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formData.consent.staffName || ''}
                          onChange={(e) => updateSection('consent', { staffName: e.target.value })}
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label small fw-bold">ตำแหน่ง</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formData.consent.staffPosition || ''}
                          onChange={(e) => updateSection('consent', { staffPosition: e.target.value })}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <label className="small fw-bold mb-0">ลงนามผู้มารับบริการ (ใช้นิ้วหรือเมาส์เซ็นในกรอบ)</label>
                        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={clearSignature}>
                          🧹 ล้างลายเซ็น
                        </button>
                      </div>
                      <div className="border rounded-3 bg-white p-1" style={{ maxWidth: 460 }}>
                        <canvas
                          ref={sigCanvasRef}
                          width={440}
                          height={130}
                          onPointerDown={handleSigDown}
                          onPointerMove={handleSigMove}
                          onPointerUp={handleSigUp}
                          onPointerCancel={handleSigUp}
                          style={{
                            width: '100%',
                            height: 130,
                            touchAction: 'none',
                            cursor: 'crosshair',
                            display: 'block',
                          }}
                        />
                      </div>
                      {formData.consent.patientSignatureDataUrl && (
                        <div className="mt-2 small text-success fw-semibold">
                          ✅ มีลายเซ็นผู้รับบริการแล้ว{' '}
                          <img
                            src={formData.consent.patientSignatureDataUrl}
                            alt="ลายเซ็นที่บันทึก"
                            className="border rounded ms-2 bg-white"
                            style={{ height: 34 }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {saveMessage && (
              <div className={`alert mt-3 mb-0 ${saveOk ? 'alert-success' : 'alert-danger'}`} role="status">
                {saveMessage}
              </div>
            )}
          </div>

          {/* Footer: PP Special Summary & Actions */}
          <div className="modal-footer bg-white d-flex flex-column align-items-stretch gap-2 p-3 border-top">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 p-2 rounded-3 bg-light border">
              <div className="d-flex align-items-center gap-1 flex-wrap small">
                <strong className="me-1">รหัส PP Special:</strong>
                {evaluation.ppSpecialCodes.length > 0 ? (
                  evaluation.ppSpecialCodes.map((code) => (
                    <span key={code} className="badge bg-info-subtle text-info-emphasis border border-info-subtle">
                      {code}
                    </span>
                  ))
                ) : (
                  <span className="text-muted">ไม่มีรหัส PP Special สำหรับช่วงอายุนี้</span>
                )}
              </div>
              {evaluation.ppSpecialCodes.length > 0 && (
                <button type="button" className="btn btn-sm btn-outline-primary fw-bold" onClick={handleCopyPpCodes}>
                  {copiedCodes ? '✅ คัดลอกแล้ว' : '📋 คัดลอกรหัส PP Special'}
                </button>
              )}
            </div>

            <div className="d-flex flex-wrap justify-content-between gap-2">
              <button
                type="button"
                className="btn btn-outline-dark fw-bold"
                style={{ minHeight: 46, borderRadius: 12 }}
                onClick={handlePrint}
              >
                🖨️ พิมพ์ใบคัดกรอง A4 (ครบ 22 หมวด)
              </button>

              <div className="d-flex gap-2 ms-auto">
                <button
                  type="button"
                  className="btn btn-outline-secondary fw-bold px-3"
                  style={{ minHeight: 46, borderRadius: 12 }}
                  onClick={onClose}
                >
                  ปิดหน้าต่าง
                </button>
                {!readOnlyUser && (
                  <button
                    type="button"
                    disabled={loading || saving}
                    className="btn btn-success fw-bold px-4 shadow-sm"
                    style={{ minHeight: 46, borderRadius: 12 }}
                    onClick={handleSave}
                  >
                    {saving ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" /> กำลังบันทึก...
                      </>
                    ) : (
                      '💾 บันทึกผลคัดกรองปี 2570'
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
