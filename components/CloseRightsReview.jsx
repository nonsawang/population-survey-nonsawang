'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { closeRightsPrice } from '@/lib/close-rights-prices.mjs';
import { readCard } from '@/lib/eform-card.mjs';
import { validateCID } from '@/lib/utils';
import { maskedScreeningCid } from '@/lib/screening-search';

const INTENT_STATE_LABELS = {
  pending: { badge: 'text-bg-info', text: 'อยู่ในคิวรอตัวเชื่อม LAN ส่งปิดสิทธิ์ สปสช.' },
  reserved: { badge: 'text-bg-primary', text: 'กำลังส่งคำขอปิดสิทธิ์ไปยัง สปสช.' },
  confirmed: { badge: 'text-bg-success', text: 'ปิดสิทธิ์ สปสช. สำเร็จ (รอบันทึก Authen ลง HOSxP)' },
  written: { badge: 'text-bg-success', text: 'ปิดสิทธิ์และบันทึก Authen Code ลง HOSxP สำเร็จครบถ้วน' },
  reconcile: { badge: 'text-bg-warning', text: 'รอตรวจสอบผลตอบกลับกับ สปสช. (ห้ามส่งซ้ำ)' },
};

export default function CloseRightsReview({ person, kpi, serviceName, date, result, saved, busy }) {
  const price = closeRightsPrice(kpi);
  const [reading, setReading] = useState(false);
  const [readiness, setReadiness] = useState(null);
  const [checking, setChecking] = useState(false);
  const [preparingHosxp, setPreparingHosxp] = useState(false);
  const [matched, setMatched] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [requested, setRequested] = useState(false);

  const readinessLock = useRef(false);
  const submitLock = useRef(false);
  const pending = useRef(false);
  const generation = useRef(0);

  useEffect(() => () => { generation.current++; }, []);

  const checkReadiness = useCallback(async () => {
    if (readinessLock.current || pending.current || !person?.personId) return;
    readinessLock.current = true;
    setChecking(true);
    const version = generation.current;
    try {
      const response = await fetch('/api/close-rights/readiness', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId: person.personId, kpi }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await response.json();
      if (version !== generation.current) return;
      if (!response.ok) {
        setReadiness({ error: data?.error || 'ตรวจความพร้อมไม่สำเร็จ กรุณาตรวจสิทธิ์บัญชีแล้วลองใหม่' });
        return;
      }
      setReadiness(data);
      if (data?.statusDetail?.intent) {
        setRequested(true);
      }
    } catch {
      if (version === generation.current) {
        setReadiness({ error: 'ตรวจความพร้อมไม่สำเร็จ กรุณาตรวจการเข้าสู่ระบบแล้วลองใหม่' });
      }
    } finally {
      readinessLock.current = false;
      if (version === generation.current) setChecking(false);
    }
  }, [person?.personId, kpi]);

  useEffect(() => {
    if (person?.personId && kpi === 'FOBT') {
      checkReadiness();
    }
  }, [person?.personId, kpi, saved, checkReadiness]);

  async function quickApproveAndPrepare() {
    const detail = readiness?.statusDetail;
    if (!detail?.historyId || preparingHosxp || busy) return;
    setPreparingHosxp(true);
    setMessage('');
    try {
      if (!detail.isApproved) {
        const { error: appErr } = await supabase.rpc('screening_review_approve', { p_history: detail.historyId });
        if (appErr) throw new Error(appErr.message || 'อนุมัติผลคัดกรองไม่สำเร็จ');
      }
      if (!detail.isPrepared) {
        const labResult = detail.labResult || (detail.result === 'ปกติ' ? 'Negative' : 'Positive');
        const { error: prepErr } = await supabase.rpc('hosxp_fit_prepare', {
          p_history: detail.historyId,
          p_confirmed_result: labResult,
        });
        if (prepErr) throw new Error(prepErr.message || 'เตรียมรายการส่ง HOSxP ไม่สำเร็จ');
      }
      setMessage('อนุมัติและส่งเข้าคิวตัวเชื่อม LAN เรียบร้อยแล้ว กรุณารอตัวเชื่อม LAN สร้าง VN สักครู่แล้วกดตรวจความพร้อมอีกครั้ง');
      await checkReadiness();
    } catch (err) {
      setMessage(err.message || 'ดำเนินการอนุมัติ/เตรียมรายการไม่สำเร็จ');
    } finally {
      setPreparingHosxp(false);
    }
  }

  async function requestClose() {
    if (submitLock.current || !matched || !reviewed || !saved || busy || readiness?.canRequest !== true) return;
    submitLock.current = true;
    setSubmitting(true);
    const version = generation.current;
    try {
      const response = await fetch('/api/close-rights/request', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personId: person.personId,
          cardCid: String(person.cid || '').trim(),
          result,
          confirm: true,
        }),
        signal: AbortSignal.timeout(20000),
      });
      const data = await response.json();
      if (version !== generation.current) return;
      if (!response.ok) {
        setMessage(data.error || 'รับคำสั่งไม่สำเร็จ');
        return;
      }
      setRequested(true);
      setMessage(data.message || 'รับคำสั่งเข้าคิวปิดสิทธิ์เรียบร้อยแล้ว');
      await checkReadiness();
    } catch {
      if (version === generation.current) {
        setMessage('ยังยืนยันผลรับคำสั่งไม่ได้ กรุณาตรวจสถานะก่อนส่งซ้ำ');
      }
    } finally {
      submitLock.current = false;
      if (version === generation.current) setSubmitting(false);
    }
  }

  async function verifyCard() {
    if (pending.current || readinessLock.current || busy || submitLock.current || requested) return;
    pending.current = true;
    const request = ++generation.current;
    setReading(true);
    setMatched(false);
    setReviewed(false);
    setMessage('กำลังอ่านบัตร…');
    try {
      const card = await readCard();
      if (request !== generation.current) return;
      if (!validateCID(card.cid).valid || card.cid !== String(person.cid || '').trim()) {
        setMessage('เลขบัตรไม่ตรงกับรายการที่เลือก กรุณาตรวจผู้รับบริการและเลือกบุคคลใหม่');
        return;
      }
      setMatched(true);
      setMessage('เลขบัตรตรงกับผู้รับบริการที่เลือก กรุณาตรวจวันที่และรายการด้านล่าง');
      await checkReadiness();
    } catch {
      if (request === generation.current) {
        setMessage('อ่านบัตรไม่สำเร็จ กรุณาตรวจ E-Form Agent และเครื่องอ่าน แล้วลองใหม่');
      }
    } finally {
      pending.current = false;
      if (request === generation.current) setReading(false);
    }
  }

  const detail = readiness?.statusDetail;
  const intent = detail?.intent;
  const intentMeta = intent ? (INTENT_STATE_LABELS[intent.state] || { badge: 'text-bg-secondary', text: intent.state }) : null;

  return (
    <section className="card border-warning mt-3" aria-label="ตรวจรายการก่อนปิดสิทธิ์">
      <div className="card-body">
        <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-2">
          <h6 className="fw-bold mb-0">ปิดสิทธิ์โดยเจ้าหน้าที่ (สปสช.)</h6>
          {intent ? (
            <span className={`badge ${intentMeta.badge}`}>{intentMeta.text}</span>
          ) : readiness?.canRequest ? (
            <span className="badge text-bg-success">พร้อมส่งเข้าคิวปิดสิทธิ์ (VN: {detail?.vn})</span>
          ) : (
            <span className="badge text-bg-warning">รอเตรียม Visit / ตรวจความพร้อม</span>
          )}
        </div>
        <p className="small text-muted">
          อ่านบัตร → ตรวจสถานะ VN จาก HOSxP → กดยืนยันเข้าคิวปิดสิทธิ์ด้วยตนเอง
        </p>

        {/* แสดงสถานะคิวปิดสิทธิ์หากเคยส่งคำขอแล้ว */}
        {intent && (
          <div className="alert alert-success small mb-3" role="status">
            <div className="fw-bold mb-1">
              <i className="fa-solid fa-circle-check me-1" />
              สถานะคิวปิดสิทธิ์: {intentMeta.text}
            </div>
            <div>VN: <strong>{intent.vn}</strong> • รหัสคำขอ: <code>{intent.id}</code></div>
            {intent.authenCode && (
              <div className="mt-1">
                Authen Code: <strong className="text-success">{intent.authenCode}</strong>
                {intent.seq && <span> • Seq: <strong>{intent.seq}</strong></span>}
              </div>
            )}
          </div>
        )}

        {/* แสดงสถานะความพร้อม 4 ขั้นตอนของรายการ FIT */}
        {detail && (
          <div className="border rounded p-3 mb-3 bg-light small">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <strong>สถานะความพร้อมของผู้รับบริการรายนี้</strong>
              {detail.vn && <span className="badge bg-primary">VN: {detail.vn}</span>}
            </div>
            <ul className="list-unstyled mb-0">
              <li className="mb-1">
                <i className={`fa-solid ${detail.hasTodayFit ? 'fa-circle-check text-success' : 'fa-circle-xmark text-danger'} me-2`} />
                1. บันทึกผล FIT ของวันนี้ ({detail.today}):{' '}
                <strong>{detail.hasTodayFit ? `บันทึกแล้ว (${detail.result})` : 'ยังไม่ได้บันทึกผลของวันนี้'}</strong>
              </li>
              <li className="mb-1">
                <i className={`fa-solid ${detail.isApproved ? 'fa-circle-check text-success' : 'fa-clock text-warning'} me-2`} />
                2. อนุมัติผลคัดกรอง:{' '}
                <strong>{detail.isApproved ? 'อนุมัติแล้ว' : 'รออนุมัติผล'}</strong>
              </li>
              <li className="mb-1">
                <i className={`fa-solid ${detail.isPrepared ? 'fa-circle-check text-success' : 'fa-clock text-warning'} me-2`} />
                3. เตรียมรายการส่ง HOSxP:{' '}
                <strong>{detail.isPrepared ? `เตรียมแล้ว (${detail.labResult})` : 'รอเตรียมรายการ'}</strong>
              </li>
              <li>
                <i className={`fa-solid ${detail.isImported ? 'fa-circle-check text-success' : 'fa-clock text-warning'} me-2`} />
                4. ตัวเชื่อม LAN สร้าง Visit ใน HOSxP:{' '}
                <strong>
                  {detail.isImported
                    ? `นำเข้าสำเร็จ (VN: ${detail.vn}${detail.labOrderNumber ? ` • ใบแล็บ ${detail.labOrderNumber}` : ''})`
                    : 'รอตัวเชื่อม LAN นำเข้า HOSxP'}
                </strong>
              </li>
            </ul>

            {detail.hasTodayFit && (!detail.isApproved || !detail.isPrepared) && (
              <div className="mt-2 pt-2 border-top">
                <button
                  type="button"
                  className="btn btn-sm btn-warning fw-bold w-100"
                  disabled={preparingHosxp || busy}
                  onClick={quickApproveAndPrepare}
                >
                  {preparingHosxp
                    ? 'กำลังอนุมัติและส่งเข้าคิว HOSxP…'
                    : '⚡ อนุมัติผลและส่งเข้าคิวสร้าง VN (HOSxP) ทันที'}
                </button>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          className="btn btn-outline-primary w-100"
          onClick={verifyCard}
          disabled={reading || checking || busy || Boolean(intent)}
        >
          {reading ? 'กำลังอ่านบัตร…' : matched ? '✓ อ่านบัตรและยืนยันตัวตนผู้รับบริการแล้ว' : '1. อ่านบัตรเพื่อตรวจผู้รับบริการ'}
        </button>
        {message && <p role="status" aria-live="polite" className="small mt-2 text-primary fw-semibold">{message}</p>}

        {matched && (
          <>
            <h6 className="fw-bold mt-2">2. ตรวจรายการคัดกรองที่เลือก</h6>
            <dl className="row small mb-2">
              <dt className="col-4">ผู้รับบริการ</dt><dd className="col-8">{person.name}</dd>
              <dt className="col-4">เลขบัตร</dt><dd className="col-8">{maskedScreeningCid(person.cid)}</dd>
              <dt className="col-4">บริการ</dt><dd className="col-8">{serviceName}</dd>
              <dt className="col-4">วันที่คัดกรอง</dt><dd className="col-8">{date || 'ยังไม่ระบุ'}</dd>
              <dt className="col-4">ผลคัดกรอง</dt><dd className="col-8">{result || 'ยังไม่ระบุ'}{!saved && ' (ยังไม่ได้บันทึกการเปลี่ยนแปลง)'}</dd>
              {detail?.vn && (
                <>
                  <dt className="col-4">เลข Visit (VN)</dt>
                  <dd className="col-8 fw-bold text-success">{detail.vn}</dd>
                </>
              )}
            </dl>
            <div className="border rounded p-3 mb-3 bg-light">
              <h6 className="fw-bold">ค่าบริการที่ต้องตรวจสอบ</h6>
              <dl className="row small mb-0">
                <dt className="col-7">ค่าบริการรวมต่อคน</dt><dd className="col-5 text-end fw-bold">{price ? `${(price.totalSatang / 100).toFixed(2)} บาท` : 'ยังไม่ได้กำหนด'}</dd>
                <dt className="col-7">ยอดที่เบิกได้ (PP)</dt><dd className="col-5 text-end">{price ? `${(price.totalSatang / 100).toFixed(2)} บาท` : 'รอตรวจสิทธิ'}</dd>
                <dt className="col-7">ยอดที่ผู้ป่วยต้องชำระ</dt><dd className="col-5 text-end">0.00 บาท</dd>
              </dl>
              <p className="small text-muted mb-0">
                {price
                  ? 'รหัสบริการ PG0060001 (60.00 บาท) ตัวเชื่อม LAN จะตรวจสอบรายการค่าใช้จ่ายและสิทธิจริงใน HOSxP ก่อนยิง API สปสช.'
                  : 'ต้องตรวจรายการค่าใช้จ่ายใน HOSxP ก่อนปิดสิทธิ์'}
              </p>
            </div>
            <label className="d-flex gap-2 align-items-start mb-3">
              <input
                type="checkbox"
                className="form-check-input"
                checked={reviewed}
                disabled={!saved || busy || Boolean(intent)}
                onChange={e => setReviewed(e.target.checked)}
              />
              <span>ตรวจผู้รับบริการและข้อมูลคัดกรองข้างต้นแล้ว</span>
            </label>
          </>
        )}

        <button
          type="button"
          className="btn btn-outline-secondary w-100 mb-2"
          disabled={checking || reading || busy}
          onClick={checkReadiness}
        >
          {checking ? 'กำลังตรวจความพร้อม…' : 'รีเฟรชสถานะความพร้อม / เลข VN'}
        </button>

        {readiness?.error && (
          <div className="alert alert-danger small" role="alert">
            {readiness.error}
          </div>
        )}

        {readiness && !readiness.error && readiness.blockers?.length > 0 && !intent && (
          <div className="alert alert-warning small" role="status">
            <strong>ขั้นตอนที่ต้องทำก่อนกดยืนยันปิดสิทธิ์:</strong>
            <ul className="mb-0 mt-1">
              {readiness.blockers.map(item => (
                <li key={item.code}>{item.message}</li>
              ))}
            </ul>
          </div>
        )}

        <button
          type="button"
          className="btn btn-primary w-100"
          onClick={requestClose}
          disabled={
            submitting ||
            requested ||
            Boolean(intent) ||
            !matched ||
            !reviewed ||
            !saved ||
            busy ||
            readiness?.canRequest !== true
          }
          aria-describedby="close-rights-disabled-reason"
        >
          {submitting
            ? 'กำลังรับคำยืนยัน…'
            : intent || requested
            ? '✓ ส่งเข้าคิวปิดสิทธิ์ FIT แล้ว'
            : '3. ยืนยันเข้าคิวปิดสิทธิ์ FIT'}
        </button>
        <p id="close-rights-disabled-reason" className="small text-muted mt-2 mb-0">
          {intent
            ? `รายการนี้อยู่ในระบบปิดสิทธิ์แล้ว (VN: ${intent.vn})`
            : readiness?.canRequest
            ? 'พร้อมส่งเข้าคิวปิดสิทธิ์ — กรุณาอ่านบัตรและติ๊กยืนยันด้านบนเพื่อกดปุ่มที่ 3'
            : 'เมื่อบันทึกผลของวันนี้ อนุมัติผล และตัวเชื่อม LAN สร้าง VN ใน HOSxP แล้ว ปุ่มยืนยันปิดสิทธิ์จะเปิดให้กดทันที'}
        </p>
      </div>
    </section>
  );
}
