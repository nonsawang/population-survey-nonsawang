'use client';
import { useState, useEffect, useCallback } from 'react';
import { buildRuleBasedAnalysis } from '@/lib/local-ai.mjs';

const PRESET_PROMPTS = [
  { key: 'overview', label: 'สรุปภาพรวมผู้บริหาร & จุดเร่งด่วน', prompt: 'สรุปภาพรวมประชากร ความก้าวหน้างานสำรวจ และลำดับความสำคัญของงานที่ต้องเร่งรัดในสัปดาห์นี้' },
  { key: 'kpi', label: 'วิเคราะห์คิวคัดกรอง 4 KPI รายหมู่บ้าน', prompt: 'วิเคราะห์ผลงานคัดกรอง 4 KPI (ไวรัสตับอักเสบ B/C, FIT Test, HPV DNA, พัฒนาการเด็ก) ว่าตัวชี้วัดใดและหมู่บ้านใดต้องเร่งติดตามก่อน' },
  { key: 'tracking', label: 'จัดลำดับบ้านและหมู่ที่สำรวจไม่ครบ', prompt: 'จัดลำดับหมู่บ้านและกลยุทธ์การติดตามบ้านที่ยังสำรวจไม่ครบ เพื่อให้ อสม. ปิดงานได้เร็วที่สุด' },
  { key: 'risk', label: 'วิเคราะห์กลุ่มเสี่ยงบุหรี่/สุรา', prompt: 'วิเคราะห์สถานการณ์ผู้สูบบุหรี่ (Fagerstrom) และดื่มสุรา (ASSIST) พร้อมแนวทางติดตามกลุ่มเสี่ยงสูง' },
];

export default function LocalAiAssistant({ dashboard = null, tracking = null, defaultFocus = 'overview', title = 'ผู้ช่วย Local AI วิเคราะห์ข้อมูลสุขภาพและคิวงาน (Offline / ในหน่วยบริการ)' }) {
  const [aiStatus, setAiStatus] = useState({ checking: true, online: false, model: '' });
  const [focus, setFocus] = useState(defaultFocus);
  const [customPrompt, setCustomPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [replyMeta, setReplyMeta] = useState(null);
  const [expanded, setExpanded] = useState(true);

  const checkStatus = useCallback(async () => {
    setAiStatus(s => ({ ...s, checking: true }));
    try {
      const res = await fetch('/api/local-ai', { cache: 'no-store', credentials: 'same-origin' });
      const data = await res.json();
      setAiStatus({
        checking: false,
        online: Boolean(data?.online),
        model: data?.model || 'qwen2.5:7b',
        models: data?.models || [],
      });
    } catch {
      setAiStatus({ checking: false, online: false, model: 'Built-in Local Analyzer', models: [] });
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  useEffect(() => {
    if ((dashboard || tracking) && !reply) {
      const autoText = buildRuleBasedAnalysis({ dashboard, tracking, focus: defaultFocus });
      if (autoText) {
        setReply(autoText);
        setReplyMeta({ source: 'local-rules', model: 'สรุปอัตโนมัติในเครื่อง (Instant Local Insights)' });
      }
    }
  }, [dashboard, tracking, defaultFocus, reply]);

  const runAnalysis = async (selectedFocus, promptText) => {
    if (loading) return;
    setLoading(true);
    setFocus(selectedFocus);
    try {
      const res = await fetch('/api/local-ai', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          focus: selectedFocus,
          prompt: promptText,
          dashboard,
          tracking,
        }),
      });
      const data = await res.json();
      if (data?.reply) {
        setReply(data.reply);
        setReplyMeta({ source: data.source, model: data.model });
      }
    } catch {
      const fallback = buildRuleBasedAnalysis({ dashboard, tracking, focus: selectedFocus });
      setReply(fallback || 'ไม่สามารถประมวลผลได้ในขณะนี้');
      setReplyMeta({ source: 'local-rules', model: 'Built-in Local Analyzer' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card border-0 shadow-sm mb-4" style={{ borderRadius: 16, background: 'linear-gradient(135deg, #f8faff 0%, #eef2ff 100%)', borderLeft: '5px solid #253e92' }} aria-label="Local AI Assistant">
      <div className="card-body p-3 p-md-4">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <span className="badge rounded-pill text-white px-3 py-2" style={{ background: '#1a237e' }}>
              <i className="fa-solid fa-microchip-ai me-1" /> Local AI
            </span>
            <h5 className="fw-bold mb-0" style={{ color: '#172b57', fontSize: '1.05rem' }}>{title}</h5>
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className={`badge rounded-pill ${aiStatus.online ? 'bg-success' : 'bg-secondary'}`}>
              {aiStatus.checking
                ? 'กำลังตรวจ Ollama...'
                : aiStatus.online
                ? `Ollama พร้อมใช้งาน (${aiStatus.model})`
                : 'โหมดวิเคราะห์ในเครื่อง (รอเปิด Ollama)'}
            </span>
            <button type="button" className="btn btn-sm btn-outline-primary rounded-pill" onClick={checkStatus} disabled={aiStatus.checking || loading}>
              <i className="fa-solid fa-rotate me-1" /> ตรวจสถานะ AI
            </button>
            <button type="button" className="btn btn-sm btn-light border rounded-pill" onClick={() => setExpanded(v => !v)}>
              {expanded ? 'ย่อ' : 'ขยาย'}
            </button>
          </div>
        </div>

        <p className="small text-muted mt-2 mb-0">
          <i className="fa-solid fa-shield-halved text-success me-1" />
          ประมวลผลเฉพาะตัวเลขสถิติสรุปและยอดคงค้างระดับหมู่บ้านภายในเครื่องหน่วยบริการ ไม่มีการส่งเลขบัตรประชาชนหรือชื่อผู้ป่วยออกนอกระบบ
        </p>

        {expanded && (
          <div className="mt-3">
            <div className="d-flex flex-wrap gap-2 mb-3">
              {PRESET_PROMPTS.map(p => (
                <button
                  key={p.key}
                  type="button"
                  disabled={loading || (!dashboard && !tracking)}
                  onClick={() => runAnalysis(p.key, p.prompt)}
                  className={`btn btn-sm rounded-pill ${focus === p.key ? 'btn-primary text-white' : 'btn-outline-primary bg-white'}`}
                >
                  <i className="fa-solid fa-wand-magic-sparkles me-1" />
                  {p.label}
                </button>
              ))}
            </div>

            <form
              className="row g-2 mb-3"
              onSubmit={e => {
                e.preventDefault();
                if (!customPrompt.trim()) return;
                runAnalysis(focus, customPrompt.trim());
              }}
            >
              <div className="col-12 col-md-9">
                <input
                  type="text"
                  className="form-control bg-white"
                  placeholder="ถาม Local AI เช่น หมู่ไหนค้างตรวจ FIT Test มากที่สุด หรือควรจัดทีมลงหมู่ไหนก่อน..."
                  value={customPrompt}
                  maxLength={500}
                  onChange={e => setCustomPrompt(e.target.value)}
                />
              </div>
              <div className="col-12 col-md-3">
                <button type="submit" className="btn btn-primary w-100 rounded-pill fw-bold" disabled={loading || !customPrompt.trim() || (!dashboard && !tracking)}>
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" /> กำลังวิเคราะห์...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-paper-plane me-1" /> ถาม Local AI
                    </>
                  )}
                </button>
              </div>
            </form>

            {reply && (
              <div className="bg-white rounded-3 p-3 border shadow-sm">
                <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-2 flex-wrap gap-2">
                  <strong className="small text-primary">
                    <i className="fa-solid fa-clipboard-check me-1" /> ผลการวิเคราะห์และข้อเสนอแนะเชิงปฏิบัติการ
                  </strong>
                  {replyMeta && (
                    <span className="small text-muted">
                      แหล่งประมวลผล: <code>{replyMeta.model}</code>
                    </span>
                  )}
                </div>
                <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.92rem', lineHeight: 1.65, color: '#1e293b' }}>{reply}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
