'use client';
import { useCallback, useEffect, useState } from 'react';

export default function NhsoApiSettingsCard({ showBackButton = true }) {
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serviceCode, setServiceCode] = useState('PG0060001');
  const [apiUrl, setApiUrl] = useState('https://authenucws.nhso.go.th/authencodestatus/api/check-authen-status');
  const [confirmTokenInfo, setConfirmTokenInfo] = useState({ ok: false, length: 0, source: '' });
  const [feeTokenInfo, setFeeTokenInfo] = useState({ ok: false, length: 0, source: '' });
  const [testResult, setTestResult] = useState(null);
  const [saveNotice, setSaveNotice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/close-rights/config-test', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'โหลดข้อมูลไม่สำเร็จ');
      if (data.serviceCode) setServiceCode(data.serviceCode);
      if (data.apiUrl) setApiUrl(data.apiUrl);
      if (data.confirmPrivilegeToken) setConfirmTokenInfo(data.confirmPrivilegeToken);
      if (data.feeScheduleToken) setFeeTokenInfo(data.feeScheduleToken);
    } catch (err) {
      setErrorMsg(err.message || 'โหลดสถานะ NHSO API ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function handleTestConnection() {
    if (testing) return;
    setTesting(true);
    setTestResult(null);
    setSaveNotice('');
    setErrorMsg('');
    try {
      const res = await fetch('/api/close-rights/config-test', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', serviceCode, apiUrl }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ ok: false, message: 'เกิดข้อผิดพลาดขณะทดสอบเชื่อมต่อ NHSO API' });
    } finally {
      setTesting(false);
    }
  }

  async function handleSaveSettings() {
    if (saving) return;
    setSaving(true);
    setSaveNotice('');
    setErrorMsg('');
    try {
      const res = await fetch('/api/close-rights/config-test', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', serviceCode, apiUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'บันทึกไม่สำเร็จ');
      setSaveNotice(data.message || 'บันทึกการตั้งค่าเรียบร้อยแล้ว');
    } catch (err) {
      setErrorMsg(err.message || 'บันทึกการตั้งค่าไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  const tokenBoxStyle = ok => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    borderRadius: '8px',
    border: ok ? '1.5px solid #bbf7d0' : '1.5px solid #fecaca',
    background: ok ? '#f0fdf4' : '#fef2f2',
    color: ok ? '#15803d' : '#b91c1c',
    fontWeight: 600,
    fontSize: '0.92rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  });

  return (
    <section className="card border-0 shadow-sm mb-4" style={{ borderRadius: 14 }} aria-label="ค่าเชื่อมต่อ NHSO Authen API และ API v2">
      <div className="card-body p-4">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <h5 className="fw-bold mb-0" style={{ color: '#1e293b' }}>
            <i className="fa-solid fa-cloud me-2 text-secondary" />
            3. ค่าเชื่อมต่อ NHSO Authen API &amp; API v2
          </h5>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary rounded-pill"
            disabled={loading}
            onClick={loadStatus}
          >
            <i className="fa-solid fa-rotate me-1" />
            อ่านค่าจาก HOSxP ใหม่
          </button>
        </div>

        {errorMsg && (
          <div className="alert alert-danger small" role="alert">
            {errorMsg}
          </div>
        )}
        {saveNotice && (
          <div className="alert alert-success small" role="status">
            <i className="fa-solid fa-circle-check me-1" />
            {saveNotice}
          </div>
        )}

        {/* Token 1: NHSO Confirm Privilege API Token */}
        <div className="mb-3">
          <div className="fw-bold mb-2" style={{ color: '#334155', fontSize: '0.95rem' }}>
            NHSO Confirm Privilege API Token
          </div>
          <div style={tokenBoxStyle(confirmTokenInfo.ok)}>
            <i className={`fa-solid ${confirmTokenInfo.ok ? 'fa-circle-check' : 'fa-circle-exclamation'}`} />
            <span>
              {loading
                ? 'กำลังอ่าน Token จาก HOSxP...'
                : confirmTokenInfo.ok
                ? 'อ่าน Token จาก HOSxP สำเร็จ'
                : `ยังอ่าน Token ไม่ได้ (${confirmTokenInfo.source || 'ตรวจสอบการเชื่อมต่อ HOSxP'})`}
            </span>
          </div>
        </div>

        {/* Token 2: NHSO 13 File Fee Schedule API Token */}
        <div className="mb-4">
          <div className="fw-bold mb-2" style={{ color: '#334155', fontSize: '0.95rem' }}>
            NHSO 13 File Fee Schedule API Token
          </div>
          <div style={tokenBoxStyle(feeTokenInfo.ok)}>
            <i className={`fa-solid ${feeTokenInfo.ok ? 'fa-circle-check' : 'fa-circle-exclamation'}`} />
            <span>
              {loading
                ? 'กำลังอ่าน Token จาก HOSxP...'
                : feeTokenInfo.ok
                ? 'อ่าน Token จาก HOSxP สำเร็จ'
                : `ยังอ่าน Token ไม่ได้ (${feeTokenInfo.source || 'ตรวจสอบการเชื่อมต่อ HOSxP'})`}
            </span>
          </div>
        </div>

        {/* Service Code & API URL */}
        <div className="row g-3 mb-3">
          <div className="col-12 col-md-6">
            <label htmlFor="nhso-service-code" className="form-label fw-semibold" style={{ color: '#334155' }}>
              Service Code
            </label>
            <input
              id="nhso-service-code"
              type="text"
              className="form-control"
              style={{ fontFamily: 'monospace', fontSize: '0.95rem', padding: '10px 14px', borderRadius: 8 }}
              value={serviceCode}
              onChange={e => setServiceCode(e.target.value)}
            />
          </div>
          <div className="col-12 col-md-6">
            <label htmlFor="nhso-api-url" className="form-label fw-semibold" style={{ color: '#334155' }}>
              API URL
            </label>
            <input
              id="nhso-api-url"
              type="url"
              className="form-control"
              style={{ fontFamily: 'monospace', fontSize: '0.95rem', padding: '10px 14px', borderRadius: 8 }}
              value={apiUrl}
              onChange={e => setApiUrl(e.target.value)}
            />
          </div>
        </div>

        {/* Test Connection Button */}
        <div className="mb-3">
          <button
            type="button"
            className="btn btn-outline-dark fw-semibold px-3 py-2"
            style={{ borderRadius: 8 }}
            disabled={testing || loading}
            onClick={handleTestConnection}
          >
            <i className="fa-solid fa-plug me-2" />
            {testing ? 'กำลังทดสอบการเชื่อมต่อ NHSO API...' : 'ทดสอบการเชื่อมต่อ NHSO API'}
          </button>
          <div className="small text-muted mt-2">
            ทดสอบด้วยเลขบัตรประชาชนตัวอย่าง เพื่อยืนยันว่า Token/URL ใช้งานได้จริง ไม่ใช่การค้นหาสิทธิ์ผู้ป่วยจริง
          </div>
        </div>

        {testResult && (
          <div
            className={`alert ${testResult.ok ? 'alert-success' : 'alert-warning'} small mb-3`}
            role="status"
          >
            <div className="fw-bold">
              <i className={`fa-solid ${testResult.ok ? 'fa-circle-check' : 'fa-triangle-exclamation'} me-1`} />
              {testResult.message}
            </div>
            {testResult.httpStatus && (
              <div className="mt-1">
                HTTP Status: <code>{testResult.httpStatus}</code> • เวลาตอบสนอง: <strong>{testResult.latencyMs} ms</strong> • Service Code: <code>{testResult.serviceCode}</code>
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 pt-3 border-top mt-3">
          {showBackButton ? (
            <a href="/" className="btn btn-outline-secondary px-3 py-2" style={{ borderRadius: 8 }}>
              <i className="fa-solid fa-arrow-left me-2" />
              กลับหน้าหลัก
            </a>
          ) : <div />}
          <button
            type="button"
            className="btn text-white fw-bold px-4 py-2"
            style={{ background: '#1b4332', borderRadius: 8 }}
            disabled={saving || loading}
            onClick={handleSaveSettings}
          >
            <i className="fa-solid fa-floppy-disk me-2" />
            {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
          </button>
        </div>
      </div>
    </section>
  );
}
