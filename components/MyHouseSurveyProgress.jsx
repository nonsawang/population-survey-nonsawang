'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  loadSurveyProgress,
  surveyHouses,
  surveyLink,
  summarizeSurveyMembers,
} from '@/lib/survey-progress.mjs';

const VALID_RELATIONS = new Set([
  'เจ้าบ้าน',
  'ผู้อาศัย',
  'บิดา/มารดา',
  'เขย/สะใภ้',
  'บุตร/หลาน',
  'เช่าอาศัย',
  'อื่นๆ',
]);

function computeFallbackMissing(p) {
  const missing = [];
  if (!VALID_RELATIONS.has(String(p.relation || '').trim())) {
    missing.push('สถานะในบ้าน');
  }
  const ch = String(p.chronic || '').trim();
  if (!ch || ['-', 'ไม่ระบุ', 'ยังไม่ระบุ'].includes(ch)) {
    missing.push('โรคประจำตัว');
  }
  if (
    !['0', '1', '2', '3', '4'].includes(String(p.residency_type || '').trim()) ||
    Number(p.status_model_version) !== 1
  ) {
    missing.push('การอยู่อาศัย');
  }
  if (![1, 2, 3, 9].includes(Number(p.person_discharge_id))) {
    missing.push('สถานะบุคคล');
  }
  return missing;
}

async function loadFallbackFromPopulation(user) {
  const moos = String(user?.moo || '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  const vhvName = String(user?.displayName || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!moos.length || !vhvName) return [];

  const collected = [];
  let afterId = null;
  for (;;) {
    let q = supabase
      .from('population')
      .select(
        'person_id,moo,house,vhv,title,fname,lname,latitude,longitude,relation,chronic,residency_type,person_discharge_id,status_model_version'
      )
      .in('moo', moos)
      .order('person_id', { ascending: true })
      .limit(1000);
    if (afterId) q = q.gt('person_id', afterId);
    const { data, error } = await q;
    if (error) throw new Error('โหลดรายชื่อบ้านไม่สำเร็จ กรุณากดโหลดใหม่อีกครั้ง');
    const batch = data || [];
    for (const r of batch) {
      const rowVhv = String(r.vhv || '')
        .trim()
        .replace(/\s+/g, ' ');
      if (rowVhv !== vhvName) continue;
      const missing = computeFallbackMissing(r);
      collected.push({
        ...r,
        missing,
        status: missing.length === 0 ? 'complete' : 'partial',
      });
    }
    if (batch.length < 1000) break;
    afterId = batch[batch.length - 1]?.person_id;
    if (!afterId) break;
  }
  return collected;
}

export default function MyHouseSurveyProgress({ user, refreshKey }) {
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
      .catch(async (e) => {
        // หากยังไม่ได้ติดตั้ง migration ยืนยันสำรวจ ให้ดึงข้อมูลจากตาราง population อัตโนมัติโดยไม่โชว์ Error เทคนิคให้ อสม. ตกใจ
        if (String(e?.message || '').includes('20261113_survey_confirmation.sql') && user) {
          try {
            const fallbackRows = await loadFallbackFromPopulation(user);
            if (active) setRows(fallbackRows);
            return;
          } catch (fallbackErr) {
            if (active) setError(fallbackErr.message);
            return;
          }
        }
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [refreshKey, retry, user]);

  const houses = useMemo(() => surveyHouses(rows), [rows]);

  const houseCounts = useMemo(() => {
    const total = houses.length;
    const pending = houses.filter((h) => h.pending > 0).length;
    const complete = total - pending;
    const pct = total > 0 ? Math.round((complete / total) * 100) : 0;
    return { total, pending, complete, pct };
  }, [houses]);

  const totals = useMemo(() => {
    const allMembers = houses.flatMap((h) => h.members);
    return summarizeSurveyMembers(allMembers);
  }, [houses]);

  const matchHouseFilter = (h, key) => {
    if (key === 'all') return true;
    if (key === 'pending') return h.pending > 0;
    if (key === 'complete') return h.pending === 0;
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

  return (
    <section className="my-3">
      {busy ? (
        <div className="card border-0 shadow-sm p-4 text-center" style={{ borderRadius: 16 }}>
          <div role="status" className="py-3">
            <span className="spinner-border text-primary me-2" />
            <span className="fw-bold" style={{ fontSize: '1.05rem' }}>
              กำลังโหลดรายชื่อบ้านที่คุณรับผิดชอบ…
            </span>
          </div>
        </div>
      ) : error ? (
        <div role="alert" className="alert alert-warning p-3" style={{ borderRadius: 14 }}>
          <div className="fw-bold mb-2">{error}</div>
          <button
            type="button"
            className="btn btn-primary rounded-pill px-4 fw-bold"
            onClick={() => setRetry((v) => v + 1)}
          >
            🔄 กดโหลดใหม่อีกครั้ง
          </button>
        </div>
      ) : (
        <>
          {/* 1. กล่องสรุปความคืบหน้าแบบหลอดพลัง (Progress Bar) เข้าใจใน 1 วินาที */}
          <div
            className="card border-0 shadow-sm mb-3"
            style={{
              borderRadius: 16,
              background: 'linear-gradient(135deg, #f0fdf4 0%, #eff6ff 100%)',
            }}
          >
            <div className="card-body p-3 p-md-4">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                <div>
                  <div className="fw-bold text-dark" style={{ fontSize: '1.15rem' }}>
                    🏡 บ้านในความรับผิดชอบทั้งหมด {houseCounts.total} หลัง
                  </div>
                  <div className="mt-1" style={{ fontSize: '1rem' }}>
                    <span className="text-success fw-bold">
                      ✅ สำรวจครบแล้ว {houseCounts.complete} หลัง
                    </span>
                    {' • '}
                    <span
                      className={
                        houseCounts.pending > 0 ? 'text-danger fw-bold' : 'text-muted'
                      }
                    >
                      ⏳ เหลือต้องสำรวจอีก {houseCounts.pending} หลัง
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-white bg-white border rounded-pill px-3 fw-bold"
                  style={{ minHeight: 38 }}
                  disabled={busy}
                  onClick={() => setRetry((v) => v + 1)}
                >
                  🔄 โหลดข้อมูลใหม่
                </button>
              </div>

              {/* หลอดความคืบหน้า */}
              <div
                className="progress bg-white border"
                style={{ height: 18, borderRadius: 999 }}
                role="progressbar"
                aria-label="ความคืบหน้าการสำรวจบ้าน"
                aria-valuenow={houseCounts.pct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="progress-bar bg-success fw-bold"
                  style={{ width: `${houseCounts.pct}%`, fontSize: '.78rem' }}
                >
                  {houseCounts.pct >= 15 ? `${houseCounts.pct}%` : ''}
                </div>
              </div>

              {/* รายละเอียดจำนวนรายคน (พับเก็บไว้ให้ไม่รก แต่กดดูได้) */}
              <details className="mt-2 small">
                <summary className="text-muted fw-semibold" style={{ cursor: 'pointer' }}>
                  📊 ดูยอดสรุปรายคน (ทั้งหมด {totals.total} คน — ครบแล้ว {totals.done} คน • ค้าง{' '}
                  {totals.pending} คน)
                </summary>
                <div className="row g-2 mt-1">
                  <div className="col-6 col-sm-3">
                    <div className="p-2 rounded-3 bg-white border">
                      <div className="text-success fw-bold">✅ ยืนยันครบ</div>
                      <div className="fs-6 fw-bold">{totals.done} คน</div>
                    </div>
                  </div>
                  <div className="col-6 col-sm-3">
                    <div className="p-2 rounded-3 bg-white border">
                      <div className="text-secondary fw-bold">⚪ ยังไม่เริ่ม</div>
                      <div className="fs-6 fw-bold">{totals.notStarted} คน</div>
                    </div>
                  </div>
                  <div className="col-6 col-sm-3">
                    <div className="p-2 rounded-3 bg-white border">
                      <div className="text-info-emphasis fw-bold">🔵 รอกดยืนยัน</div>
                      <div className="fs-6 fw-bold">{totals.awaitingConfirm} คน</div>
                    </div>
                  </div>
                  <div className="col-6 col-sm-3">
                    <div className="p-2 rounded-3 bg-white border">
                      <div className="text-warning-emphasis fw-bold">🟠 ข้อมูลไม่ครบ</div>
                      <div className="fs-6 fw-bold">{totals.incomplete} คน</div>
                    </div>
                  </div>
                </div>
              </details>
            </div>
          </div>

          {/* 2. ช่องพิมพ์เลขที่บ้านตัวใหญ่ + แป้นตัวเลขด่วน */}
          <div
            className="card border-0 shadow-sm mb-3"
            style={{ borderRadius: 16 }}
          >
            <div className="card-body p-3">
              <label
                htmlFor="quick-house-search"
                className="fw-bold text-dark mb-2 d-block"
                style={{ fontSize: '1rem' }}
              >
                🔍 ค้นหาเลขที่บ้านด่วน (พิมพ์เลขบ้านแล้วแตะเข้าบ้านได้เลย)
              </label>
              <div className="input-group">
                <input
                  id="quick-house-search"
                  type="search"
                  inputMode="tel"
                  className="form-control fw-bold"
                  style={{
                    minHeight: 52,
                    fontSize: '1.2rem',
                    borderRadius: searchHouse ? '12px 0 0 12px' : 12,
                  }}
                  placeholder="พิมพ์เลขที่บ้าน เช่น 24/1..."
                  value={searchHouse}
                  onChange={(e) => {
                    setSearchHouse(e.target.value);
                    setPage(1);
                  }}
                />
                {searchHouse && (
                  <button
                    type="button"
                    className="btn btn-outline-secondary fw-bold px-3"
                    style={{ minHeight: 52, borderRadius: '0 12px 12px 0' }}
                    onClick={() => {
                      setSearchHouse('');
                      setPage(1);
                    }}
                  >
                    ✖ ล้าง
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 3. ปุ่มกรองใหญ่ 3 ปุ่ม เข้าใจง่าย */}
          <div className="row g-2 mb-3" role="group" aria-label="ตัวกรองบ้าน">
            {[
              {
                key: 'pending',
                label: '🟠 ยังทำไม่เสร็จ',
                count: houseCounts.pending,
                activeClass: 'btn-warning text-dark border-warning shadow-sm',
              },
              {
                key: 'complete',
                label: '🟢 ทำเสร็จครบแล้ว',
                count: houseCounts.complete,
                activeClass: 'btn-success text-white border-success shadow-sm',
              },
              {
                key: 'all',
                label: '🏠 ดูทั้งหมด',
                count: houseCounts.total,
                activeClass: 'btn-primary text-white border-primary shadow-sm',
              },
            ].map((item) => {
              const active = filter === item.key;
              return (
                <div key={item.key} className="col-4">
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setFilter(item.key);
                      setPage(1);
                    }}
                    className={`btn w-100 fw-bold py-2 px-1 h-100 d-flex flex-column align-items-center justify-content-center ${
                      active ? item.activeClass : 'bg-white border text-dark'
                    }`}
                    style={{ minHeight: 60, borderRadius: 14, fontSize: '.92rem' }}
                  >
                    <span>{item.label}</span>
                    <span className="fs-6 fw-bold mt-1">({item.count} หลัง)</span>
                  </button>
                </div>
              );
            })}
          </div>

          {/* 4. รายการการ์ดบ้านแบบแตะง่ายทั้งใบ */}
          {!visible.length ? (
            <div
              className="card border-0 shadow-sm p-4 text-center bg-white"
              style={{ borderRadius: 16 }}
            >
              <div className="fs-1 mb-2">{filter === 'pending' && houseCounts.total > 0 ? '🎉' : '🏡'}</div>
              <div className="fw-bold text-dark" style={{ fontSize: '1.1rem' }}>
                {filter === 'pending' && houseCounts.total > 0 && !searchHouse
                  ? 'ยอดเยี่ยมมาก! คุณสำรวจบ้านครบทุกหลังแล้ว'
                  : 'ไม่พบบ้านตามคำค้นหาหรือตัวกรองที่เลือก'}
              </div>
              {filter === 'pending' && houseCounts.complete > 0 && (
                <button
                  type="button"
                  className="btn btn-outline-primary rounded-pill px-4 fw-bold mt-3 align-self-center"
                  style={{ minHeight: 46 }}
                  onClick={() => setFilter('all')}
                >
                  🏠 กดดูบ้านทั้งหมด ({houseCounts.total} หลัง)
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="d-flex flex-column gap-3 mb-3">
                {visible.slice((current - 1) * 20, current * 20).map((h) => {
                  const pendingMembers = h.members.filter((p) => p.status !== 'complete');
                  const firstPendingId = pendingMembers[0]?.person_id;
                  const targetUrl = surveyLink(h.moo, h.house, firstPendingId);
                  const canOpen = Boolean(h.house && h.house !== '-');

                  const pendingNames = pendingMembers
                    .slice(0, 3)
                    .map((p) => `${p.title || ''}${p.fname || ''}`.trim())
                    .filter(Boolean);

                  return (
                    <article
                      key={h.key}
                      className="card border-0 shadow-sm bg-white overflow-hidden"
                      style={{
                        borderRadius: 16,
                        borderLeft: h.pending > 0 ? '6px solid #f59e0b' : '6px solid #16a34a',
                      }}
                    >
                      <div className="card-body p-3">
                        {/* แถวบน: เลขที่บ้านตัวใหญ่ + ป้ายสถานะ */}
                        <div className="d-flex justify-content-between align-items-start gap-2">
                          <div>
                            <h3 className="fw-bold text-dark mb-1" style={{ fontSize: '1.25rem' }}>
                              🏡 บ้านเลขที่{' '}
                              <span className="text-primary">{h.house || 'ไม่ระบุ'}</span>{' '}
                              <span className="fs-6 fw-normal text-muted">(หมู่ {h.moo})</span>
                            </h3>
                            <div className="d-flex align-items-center gap-2 flex-wrap mt-1">
                              <span
                                className="badge bg-light text-dark border px-2 py-1"
                                style={{ fontSize: '.85rem' }}
                              >
                                👨‍👩‍👧‍👦 สมาชิก {h.members.length} คน
                              </span>
                              {h.pinned ? (
                                <span
                                  className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1"
                                  style={{ fontSize: '.85rem' }}
                                >
                                  📍 มีพิกัดบ้านแล้ว
                                </span>
                              ) : (
                                <span
                                  className="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1"
                                  style={{ fontSize: '.85rem' }}
                                >
                                  ⚠️ ยังไม่ได้ปักหมุดพิกัด
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-end" style={{ flexShrink: 0 }}>
                            {h.pending > 0 ? (
                              <span
                                className="badge bg-warning text-dark px-3 py-2 rounded-pill fw-bold"
                                style={{ fontSize: '.9rem' }}
                              >
                                ⏳ เหลือ {h.pending} คน
                              </span>
                            ) : (
                              <span
                                className="badge bg-success text-white px-3 py-2 rounded-pill fw-bold"
                                style={{ fontSize: '.9rem' }}
                              >
                                ✅ ครบแล้ว
                              </span>
                            )}
                          </div>
                        </div>

                        {/* แสดงรายชื่อคนที่ยังค้างสั้นๆ อ่านง่าย */}
                        {pendingMembers.length > 0 && (
                          <div
                            className="mt-2 p-2 px-3 rounded-3 bg-warning-subtle text-dark"
                            style={{ fontSize: '.92rem' }}
                          >
                            <strong>👉 คนที่ยังต้องตรวจ:</strong> {pendingNames.join(', ')}
                            {pendingMembers.length > 3 &&
                              ` และอีก ${pendingMembers.length - 3} คน`}
                          </div>
                        )}

                        {/* ปุ่มใหญ่เต็มความกว้าง กดเข้าบ้านได้ทันที */}
                        <div className="mt-3">
                          {canOpen ? (
                            <Link
                              href={targetUrl}
                              className={`btn w-100 fw-bold d-flex align-items-center justify-content-center shadow-sm ${
                                h.pending > 0 ? 'btn-primary text-white' : 'btn-outline-success'
                              }`}
                              style={{ minHeight: 50, fontSize: '1.02rem', borderRadius: 12 }}
                            >
                              {h.pending > 0
                                ? `🏠 แตะเพื่อเข้าสำรวจบ้านนี้ (เหลือ ${h.pending} คน) ›`
                                : '🏠 เปิดดูข้อมูลบ้านนี้ ›'}
                            </Link>
                          ) : (
                            <div className="text-muted small">
                              กรุณาแจ้งเจ้าหน้าที่ให้ระบุบ้านเลขที่ก่อน
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* ปุ่มเปลี่ยนหน้า ขนาดใหญ่ */}
              {pages > 1 && (
                <div className="d-flex justify-content-between align-items-center bg-white p-2 rounded-3 shadow-sm border">
                  <button
                    type="button"
                    className="btn btn-outline-primary fw-bold px-3"
                    style={{ minHeight: 46, borderRadius: 12 }}
                    disabled={current === 1}
                    onClick={() => setPage(current - 1)}
                  >
                    ⬅️ หน้าก่อน
                  </button>
                  <span className="fw-bold text-dark" style={{ fontSize: '.98rem' }}>
                    หน้า {current} / {pages}
                  </span>
                  <button
                    type="button"
                    className="btn btn-outline-primary fw-bold px-3"
                    style={{ minHeight: 46, borderRadius: 12 }}
                    disabled={current === pages}
                    onClick={() => setPage(current + 1)}
                  >
                    หน้าถัดไป ➡️
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
