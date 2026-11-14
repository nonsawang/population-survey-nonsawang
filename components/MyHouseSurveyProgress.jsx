'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  loadSurveyProgress,
  surveyHouses,
  surveyLink,
  SURVEY_LABELS,
  summarizeSurveyMembers,
  isLegacyOrMissingStatus,
} from '@/lib/survey-progress.mjs';

const HOUSE_FILTERS = [
  { key: 'pending', label: '🔥 บ้านที่มีคนค้างทุกประเภท' },
  { key: 'notStarted', label: '⚪ ยังไม่เริ่มทั้งบ้าน' },
  { key: 'partial', label: '🟠 สำรวจบางส่วน / รอยืนยัน' },
  { key: 'complete', label: '✅ สำรวจครบทั้งบ้าน' },
  { key: 'all', label: '🏠 บ้านทั้งหมด' },
];

export default function MyHouseSurveyProgress({ refreshKey }) {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [filter, setFilter] = useState('pending');
  const [searchHouse, setSearchHouse] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    setBusy(true);
    setError('');
    loadSurveyProgress(supabase)
      .then((data) => {
        if (active) setRows(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [refreshKey, retry]);

  const houses = useMemo(() => surveyHouses(rows), [rows]);

  const totals = useMemo(() => {
    const allMembers = houses.flatMap((h) => h.members);
    return summarizeSurveyMembers(allMembers);
  }, [houses]);

  const matchHouseFilter = (h, key) => {
    if (key === 'all') return true;
    if (key === 'pending') return h.pending > 0;
    return h.status === key;
  };

  const visible = useMemo(() => {
    const q = searchHouse.trim().toLowerCase();
    return houses.filter((h) => {
      if (!matchHouseFilter(h, filter)) return false;
      if (!q) return true;
      return String(h.house || '').toLowerCase().includes(q);
    });
  }, [houses, filter, searchHouse]);

  const pages = Math.max(1, Math.ceil(visible.length / 20));
  const current = Math.min(page, pages);

  const renderPersonBadge = (p) => {
    if (p.status === 'complete') {
      return (
        <span className="badge bg-success-subtle text-success border border-success-subtle">
          ✅ ยืนยันสำรวจแล้ว
        </span>
      );
    }
    const hasMissing = Array.isArray(p.missing) && p.missing.length > 0;
    if (p.status === 'notStarted') {
      return (
        <span className="badge bg-secondary-subtle text-secondary-emphasis border border-secondary-subtle">
          {hasMissing ? '⚪ ยังไม่เริ่ม (ข้อมูลไม่ครบ)' : '⚪ ยังไม่เริ่ม (ข้อมูลเดิมครบ รอกดยืนยัน)'}
        </span>
      );
    }
    if (hasMissing) {
      return (
        <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle">
          🟠 ข้อมูลไม่ครบ
        </span>
      );
    }
    return (
      <span className="badge bg-info-subtle text-info-emphasis border border-info-subtle">
        🔵 กรอกครบแล้ว รอกดยืนยัน
      </span>
    );
  };

  return (
    <section className="card border-0 shadow-sm my-3" style={{ borderRadius: 16 }}>
      <div className="card-body p-3 p-md-4">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
          <h2 className="h5 fw-bold mb-0">สถานะยืนยันสำรวจรายคน (บ้านของฉัน)</h2>
          <button
            className="btn btn-sm btn-outline-primary rounded-pill px-3"
            disabled={busy}
            onClick={() => setRetry((v) => v + 1)}
          >
            <i className="fa-solid fa-rotate me-1" /> โหลดใหม่
          </button>
        </div>

        <div className="alert alert-light border small py-2 px-3 mb-3" style={{ borderRadius: 12 }}>
          <div className="fw-semibold text-dark mb-1">
            <i className="fa-solid fa-circle-info text-primary me-1" /> คำอธิบายการนับยอดยืนยันสำรวจ:
          </div>
          <ul className="mb-0 ps-3 text-muted">
            <li>
              <strong>ยังไม่เริ่ม</strong> = ยังไม่มีประวัติกดยืนยันในระบบยืนยันสำรวจใหม่ (คนที่เคยบันทึกข้อมูลไว้ก่อนติดตั้งระบบนี้จะแสดงในกลุ่มนี้ ต้องเปิดตรวจและกดปุ่ม <em>“ยืนยันตรวจสอบแล้ว”</em>)
            </li>
            <li>
              <strong>ข้อมูลไม่ครบ</strong> = ขาดข้อมูลบังคับ (สถานะในบ้าน, โรคประจำตัว, ประเภทอยู่อาศัย Type 0–3 หรือสถานะจำหน่าย/สถานะเดิมยังไม่อัปเดต)
            </li>
            <li>
              <strong>รอยืนยัน</strong> = ข้อมูลทั้ง 4 ช่องครบแล้ว แต่ยังไม่ได้กดปุ่มยืนยันสำรวจ (รวมถึงกรณีแก้ไขข้อมูลใหม่หลังเคยยืนยันแล้ว)
            </li>
            <li>
              <strong>ต่างจาก “ใบงานเดิมด้านล่าง”</strong> เพราะใบงานเดิมนับเฉพาะผู้ที่ยังไม่ระบุ Type แต่ส่วนนี้นับหลักฐานการกดยืนยันสำรวจรายคนและรวมผู้ที่ยังไม่ระบุสถานะจำหน่ายด้วย
            </li>
          </ul>
        </div>

        {busy ? (
          <p role="status" className="text-center py-4">
            <span className="spinner-border spinner-border-sm text-primary me-2" />
            กำลังโหลดหลักฐานสำรวจ…
          </p>
        ) : error ? (
          <p role="alert" className="alert alert-warning">
            {error}
          </p>
        ) : (
          <>
            {/* สรุปยอดรายคนแยกชัดเจน */}
            <div className="row g-2 mb-3">
              <div className="col-6 col-md-3">
                <div className="border rounded-3 p-2 h-100 bg-success-subtle border-success-subtle">
                  <div className="small text-success fw-semibold">✅ ยืนยันสำรวจครบ</div>
                  <div className="fs-5 fw-bold text-success">
                    {totals.done} <span className="fs-6 fw-normal">คน</span>
                  </div>
                  <div className="text-muted" style={{ fontSize: '.72rem' }}>
                    จากทั้งหมด {totals.total} คน
                  </div>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="border rounded-3 p-2 h-100 bg-light">
                  <div className="small text-secondary-emphasis fw-semibold">⚪ ยังไม่เริ่ม</div>
                  <div className="fs-5 fw-bold text-dark">
                    {totals.notStarted} <span className="fs-6 fw-normal">คน</span>
                  </div>
                  <div className="text-muted" style={{ fontSize: '.72rem' }}>
                    ยังไม่เคยบันทึกในระบบยืนยันใหม่
                  </div>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="border rounded-3 p-2 h-100 bg-info-subtle border-info-subtle">
                  <div className="small text-info-emphasis fw-semibold">🔵 ข้อมูลครบ รอยืนยัน</div>
                  <div className="fs-5 fw-bold text-info-emphasis">
                    {totals.awaitingConfirm} <span className="fs-6 fw-normal">คน</span>
                  </div>
                  <div className="text-muted" style={{ fontSize: '.72rem' }}>
                    ข้อมูลครบแล้ว เหลือกดปุ่มยืนยัน
                  </div>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="border rounded-3 p-2 h-100 bg-warning-subtle border-warning-subtle">
                  <div className="small text-warning-emphasis fw-semibold">🟠 ข้อมูลไม่ครบ</div>
                  <div className="fs-5 fw-bold text-warning-emphasis">
                    {totals.incomplete} <span className="fs-6 fw-normal">คน</span>
                  </div>
                  <div className="text-muted" style={{ fontSize: '.72rem' }}>
                    {totals.needsStatusReview > 0
                      ? `รวมรอตรวจสถานะจำหน่าย/แบบเก่า ${totals.needsStatusReview} คน`
                      : 'ขาดโรคประจำตัว / Type / สถานะในบ้าน'}
                  </div>
                </div>
              </div>
            </div>

            {/* ช่องค้นหาบ้านเลขที่ด่วน */}
            <div className="input-group mb-3">
              <span className="input-group-text bg-white border-end-0">
                <i className="fa-solid fa-magnifying-glass text-muted" />
              </span>
              <input
                type="search"
                className="form-control border-start-0"
                placeholder="พิมพ์เลขที่บ้านเพื่อค้นหาด่วน เช่น 24/1..."
                value={searchHouse}
                onChange={(e) => {
                  setSearchHouse(e.target.value);
                  setPage(1);
                }}
              />
              {searchHouse && (
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => {
                    setSearchHouse('');
                    setPage(1);
                  }}
                >
                  ล้าง
                </button>
              )}
            </div>

            {/* ปุ่มกรองระดับบ้าน */}
            <div className="d-flex flex-wrap gap-2 mb-3">
              {HOUSE_FILTERS.map((item) => {
                const count = houses.filter((h) => matchHouseFilter(h, item.key)).length;
                const active = filter === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`btn btn-sm rounded-pill px-3 fw-semibold ${
                      active ? 'btn-primary' : 'btn-outline-primary'
                    }`}
                    aria-pressed={active}
                    onClick={() => {
                      setFilter(item.key);
                      setPage(1);
                    }}
                  >
                    {item.label} ({count} หลัง)
                  </button>
                );
              })}
            </div>

            {!visible.length && (
              <p className="text-muted py-3 mb-0">
                ไม่พบบ้านตามตัวกรอง หรือยังไม่ได้ผูกชื่อ อสม. กับบัญชีของคุณ
              </p>
            )}

            {visible.slice((current - 1) * 20, current * 20).map((h) => (
              <article
                key={h.key}
                className="border rounded-3 p-3 mb-3 bg-white"
                style={{ borderRadius: 14 }}
              >
                <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-1">
                  <div>
                    <h3 className="h6 fw-bold mb-1">
                      บ้านเลขที่ {h.house || 'ไม่ระบุ'} หมู่ {h.moo}
                    </h3>
                    <div className="small text-muted">
                      สมาชิก {h.members.length} คน • ยืนยันครบ <strong>{h.done}</strong> • ค้างรวม{' '}
                      <strong className={h.pending > 0 ? 'text-danger' : 'text-success'}>
                        {h.pending}
                      </strong>{' '}
                      คน
                      {h.pending > 0 && (
                        <span>
                          {' '}
                          (ยังไม่เริ่ม {h.notStartedCount} • ข้อมูลไม่ครบ {h.incompleteCount} • รอยืนยัน{' '}
                          {h.awaitingConfirmCount})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-end">
                    <strong>{SURVEY_LABELS[h.status]}</strong>
                    <div className="small mt-1">
                      {h.pinned ? (
                        <span className="text-success">📍 มีพิกัดแล้ว</span>
                      ) : (
                        <span className="text-warning-emphasis">⚠️ ยังไม่มีพิกัด</span>
                      )}
                    </div>
                  </div>
                </div>

                <ul className="list-unstyled mb-2 mt-2">
                  {h.members.map((p) => {
                    const hasMissing = Array.isArray(p.missing) && p.missing.length > 0;
                    const legacyStatus = isLegacyOrMissingStatus(p);
                    return (
                      <li key={p.person_id} className="border-top py-2">
                        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                          {h.house && h.house !== '-' ? (
                            <Link
                              className="fw-semibold text-decoration-none"
                              href={surveyLink(h.moo, h.house, p.person_id)}
                            >
                              {p.title}
                              {p.fname} {p.lname} ›
                            </Link>
                          ) : (
                            <span className="fw-semibold">
                              {p.title}
                              {p.fname} {p.lname}
                            </span>
                          )}
                          {renderPersonBadge(p)}
                        </div>
                        {hasMissing && (
                          <small className="d-block text-warning-emphasis mt-1">
                            ขาดข้อมูล: {p.missing.join(', ')}
                            {legacyStatus && ' (กรุณาตรวจสถานะจำหน่าย/สถานะแบบเก่า)'}
                          </small>
                        )}
                        {!hasMissing && p.status !== 'complete' && (
                          <small className="d-block text-info-emphasis mt-1">
                            {p.status === 'notStarted'
                              ? 'มีข้อมูลเดิมครบแล้ว — กดเปิดการ์ดเพื่อตรวจและกดยืนยันสำรวจ'
                              : 'แก้ไขข้อมูลแล้ว — กรุณากดยืนยันตรวจสอบอีกครั้ง'}
                          </small>
                        )}
                        {p.reviewed_at && (
                          <small className="d-block text-muted">
                            บันทึกล่าสุด {new Date(p.reviewed_at).toLocaleString('th-TH')} •{' '}
                            {p.reviewed_by}
                          </small>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {h.house && h.house !== '-' ? (
                  <Link
                    className="btn btn-primary btn-sm rounded-pill px-3 fw-semibold"
                    href={surveyLink(
                      h.moo,
                      h.house,
                      h.members.find((p) => p.status !== 'complete')?.person_id
                    )}
                  >
                    {h.pending ? `สำรวจสมาชิกที่ค้าง (${h.pending} คน)` : 'เปิดดูข้อมูลบ้าน'}
                  </Link>
                ) : (
                  <small className="text-muted">กรุณาให้เจ้าหน้าที่ระบุบ้านเลขที่ก่อน</small>
                )}
              </article>
            ))}

            <div className="d-flex justify-content-between align-items-center">
              <button
                className="btn btn-outline-secondary btn-sm rounded-pill px-3"
                disabled={current === 1}
                onClick={() => setPage(current - 1)}
              >
                ก่อนหน้า
              </button>
              <span className="small text-muted">
                หน้า {current} / {pages}
              </span>
              <button
                className="btn btn-outline-secondary btn-sm rounded-pill px-3"
                disabled={current === pages}
                onClick={() => setPage(current + 1)}
              >
                ถัดไป
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
