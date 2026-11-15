'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { VALID_MOOS } from '@/lib/utils';
import HouseGpsRefresh from './HouseGpsRefresh';

const HouseGpsRevision = dynamic(() => import('./HouseGpsRevision'), { ssr: false });
const HouseGpsOverviewMap = dynamic(() => import('./HouseGpsOverviewMap'), { ssr: false });

const STATE_LABELS = {
  pending: 'รอเจ้าหน้าที่ตรวจสอบ',
  processing: 'กำลังส่งเข้า HOSxP',
  sent: 'เขียนเข้า HOSxP แล้ว',
  conflict: 'ข้อมูลบ้านเปลี่ยน ต้องตรวจสอบ',
  superseded: 'ยกเลิกและแทนที่แล้ว',
  cancelled: 'ยกเลิก — ล้างพิกัดบนเว็บเพื่อปักใหม่',
};

const SKIP_REASONS = {
  NOT_PENDING: 'สถานะเปลี่ยน / ไม่ได้รอส่ง',
  ALREADY_APPROVED: 'อนุมัติแล้ว',
  FORBIDDEN: 'ไม่มีสิทธิ์ในหมู่นี้',
  NOT_FOUND: 'ไม่พบคิว',
  GPS_REFERENCE_CHANGED: 'พิกัดหรือข้อมูลอ้างอิง HOSxP เปลี่ยน',
  GPS_SNAPSHOT_REQUIRED: 'ข้อมูลอ้างอิง HOSxP เกิน 24 ชม. / ยังไม่มี',
  HOUSE_NOT_UNIQUE: 'บ้านจับคู่ใน HOSxP ไม่ได้เพียงหลังเดียว',
  HOUSE_CHANGED: 'รหัสบ้านใน HOSxP เปลี่ยน',
  ALREADY_REPLACED: 'มีรายการแทนที่แล้ว',
  REVISION_STATE_CHANGED: 'สถานะเปลี่ยน',
  CHECK_FAILED: 'ตรวจสอบไม่สำเร็จ',
};

const STATUS_TABS = [
  { key: 'awaiting', label: '🟠 รออนุมัติ', badgeClass: 'bg-warning-subtle text-warning-emphasis border-warning-subtle' },
  { key: 'approved', label: '🔵 อนุมัติแล้ว / รอ LAN', badgeClass: 'bg-info-subtle text-info-emphasis border-info-subtle' },
  { key: 'sent', label: '🟢 เขียนเข้า HOSxP แล้ว', badgeClass: 'bg-success-subtle text-success border-success-subtle' },
  { key: 'conflict', label: '🔴 ต้องตรวจสอบ / ขัดแย้ง', badgeClass: 'bg-danger-subtle text-danger border-danger-subtle' },
  { key: 'all', label: '📋 ทั้งหมด', badgeClass: 'bg-light text-dark border' },
];

function calcDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getDistanceInfo(row) {
  const newLat = Number(row.latitude);
  const newLng = Number(row.longitude);
  const oldLat = Number(row.old_latitude);
  const oldLng = Number(row.old_longitude);
  const hasOld =
    row.old_latitude !== null &&
    row.old_latitude !== '' &&
    Number.isFinite(oldLat) &&
    Number.isFinite(oldLng) &&
    oldLat !== 0 &&
    oldLng !== 0 &&
    Math.abs(oldLat) <= 90 &&
    Math.abs(oldLng) <= 180;

  if (!hasOld) {
    return {
      isNew: true,
      meters: null,
      label: '✨ ปักพิกัดใหม่ (HOSxP เดิมว่าง)',
      badgeClass: 'bg-info-subtle text-info-emphasis border border-info-subtle',
    };
  }
  const meters = Math.round(calcDistanceMeters(oldLat, oldLng, newLat, newLng));
  if (meters <= 50) {
    return {
      isNew: false,
      meters,
      label: `📏 ห่างจุดเดิม ${meters} ม.`,
      badgeClass: 'bg-success-subtle text-success border border-success-subtle',
    };
  }
  if (meters <= 150) {
    return {
      isNew: false,
      meters,
      label: `📏 ห่างจุดเดิม ${meters} ม.`,
      badgeClass: 'bg-warning-subtle text-warning-emphasis border border-warning-subtle',
    };
  }
  return {
    isNew: false,
    meters,
    label: `⚠️ ห่างจุดเดิม ${meters.toLocaleString('th-TH')} ม.`,
    badgeClass: 'bg-danger-subtle text-danger border border-danger-subtle',
  };
}

export default function HouseGpsReview() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('awaiting');
  const [mooFilter, setMooFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showMap, setShowMap] = useState(true);
  const [activeRowId, setActiveRowId] = useState(null);

  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const [message, setMessage] = useState('');

  // Unified batch preview & selection state
  const [batchMap, setBatchMap] = useState({});
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const batchLock = useRef(false);

  // Load queue rows with filters
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setFailed(false);
    setBatchMap({});
    setSelectedIds([]);

    const params = new URLSearchParams({
      page: String(page),
      status: statusFilter,
    });
    if (mooFilter) params.set('moo', mooFilter);
    if (searchQuery) params.set('search', searchQuery);

    fetch('/api/house-gps-review?' + params.toString(), {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) throw Error();
        const result = await response.json();
        if (!controller.signal.aborted) {
          setData(result);
          // Auto-switch from 'awaiting' to 'all' on first load if awaiting is 0 but queue has other rows
          if (
            statusFilter === 'awaiting' &&
            page === 1 &&
            !mooFilter &&
            !searchQuery &&
            result.rows?.length === 0 &&
            result.counts?.all > 0 &&
            result.counts?.awaiting === 0
          ) {
            setStatusFilter('all');
          }
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });

    return () => controller.abort();
  }, [page, statusFilter, mooFilter, searchQuery, refresh]);

  // Auto-run preview_batch for pending unapproved rows in current page
  useEffect(() => {
    if (!data?.rows?.length) return;
    const candidates = data.rows.filter((r) => r.state === 'pending' && !r.approved_at);
    if (!candidates.length) {
      setBatchMap({});
      setSelectedIds([]);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);
    fetch('/api/house-gps-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'preview_batch',
        items: candidates.map((r) => ({
          id: r.id,
          latitude: r.latitude,
          longitude: r.longitude,
        })),
      }),
    })
      .then(async (res) => {
        const result = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && Array.isArray(result.rows)) {
          const map = Object.fromEntries(result.rows.map((item) => [item.id, item]));
          setBatchMap(map);
          setSelectedIds(result.rows.filter((item) => item.status === 'ready').map((item) => item.id));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [data]);

  const readyRows = useMemo(() => {
    if (!data?.rows) return [];
    return data.rows.filter((r) => batchMap[r.id]?.status === 'ready');
  }, [data, batchMap]);

  async function approveSingle(row) {
    if(preparing || batchMap[row.id]?.status !== 'ready')return;
    const dist = getDistanceInfo(row);
    if (
      !window.confirm(
        `ยืนยันอนุมัติส่งพิกัด บ้านเลขที่ ${row.address} หมู่ ${row.moo}?\n` +
          `• พิกัดเดิม HOSxP: ${row.old_latitude ?? '-'}, ${row.old_longitude ?? '-'}\n` +
          `• พิกัดใหม่: ${row.latitude}, ${row.longitude} (${dist.label})\n` +
          `ตัวส่ง LAN จะตรวจค่าเดิมก่อนเขียนเข้า HOSxP อัตโนมัติ`
      )
    )
      return;
    setPreparing(true);
    setMessage('');
    try {
      const response = await fetch('/api/house-gps-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          batchId: batchMap[row.id]?.batchId,
          id: row.id,
          latitude: row.latitude,
          longitude: row.longitude,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'ยืนยันไม่สำเร็จ');
      setMessage(`✅ อนุมัติบ้าน ${row.address} หมู่ ${row.moo} แล้ว — รอตัวส่ง LAN เขียนเข้า HOSxP`);
      setRefresh((n) => n + 1);
    } catch (e) {
      setMessage(e.message);
    } finally {
      setPreparing(false);
    }
  }

  async function approveSelectedBatch() {
    if (batchLock.current || preparing) return;
    const itemsToApprove = readyRows
      .filter((r) => selectedIds.includes(r.id))
      .map((r) => ({
        id: r.id,
        latitude: r.latitude,
        longitude: r.longitude,
        batchId: batchMap[r.id]?.batchId,
      }));
    if (!itemsToApprove.length) return;
    if (
      !window.confirm(
        `ยืนยันอนุมัติส่งพิกัด ${itemsToApprove.length} หลังที่เลือกเข้าคิว HOSxP?\nตัวส่ง LAN จะตรวจพิกัดเดิมกับ HOSxP ก่อนเขียนจริงอีกครั้ง`
      )
    )
      return;

    batchLock.current = true;
    setPreparing(true);
    setMessage('');
    try {
      const response = await fetch('/api/house-gps-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve_batch',
          items: itemsToApprove,
        }),
      });
      const result = await response.json();
      if (!response.ok || !Array.isArray(result.rows)) {
        throw Error(result.error || 'อนุมัติเป็นชุดไม่สำเร็จ กรุณาโหลดคิวใหม่');
      }
      const approvedCount = result.rows.filter((r) => r.status === 'approved').length;
      const skippedCount = result.rows.filter((r) => r.status === 'skipped').length;
      setMessage(
        `✅ อนุมัติเป็นชุดสำเร็จ ${approvedCount} หลัง${skippedCount ? ` • ข้าม ${skippedCount} หลัง` : ''} — รอเครื่อง LAN ส่งเข้า HOSxP`
      );
      setSelectedIds([]);
      setRefresh((n) => n + 1);
    } catch (e) {
      setMessage(e.message || 'ไม่สามารถยืนยันผลการอนุมัติได้ กรุณาโหลดรายการใหม่');
    } finally {
      batchLock.current = false;
      setPreparing(false);
    }
  }

  async function edit(row) {
    setPreparing(true);
    setMessage('');
    setEditing(null);
    try {
      const response = await fetch('/api/house-gps-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'prepare', oldId: row.id }),
      });
      const context = await response.json();
      if (!response.ok) throw Error(context.error || 'โหลดข้อมูลอ้างอิงไม่สำเร็จ');
      setEditing({ row, context });
    } catch (e) {
      setMessage(e.message);
    } finally {
      setPreparing(false);
    }
  }

  const counts = data?.counts || { all: 0, awaiting: 0, approved: 0, sent: 0, conflict: 0 };

  const renderStatusCell = (row) => {
    if (row.state === 'pending' && !row.approved_at) {
      const check = batchMap[row.id];
      if (previewLoading && !check) {
        return <span className="badge bg-light text-muted border">กำลังตรวจข้อมูลอ้างอิง…</span>;
      }
      if (check?.status === 'ready') {
        return (
          <div>
            <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle">
              🟠 รออนุมัติ (พร้อมส่ง)
            </span>
            {check.capturedAt && (
              <small className="d-block text-muted mt-1" style={{ fontSize: '.72rem' }}>
                เทียบข้อมูล HOSxP {new Date(check.capturedAt).toLocaleString('th-TH')}
              </small>
            )}
          </div>
        );
      }
      if (check?.status === 'skipped') {
        return (
          <div>
            <span className="badge bg-danger-subtle text-danger border border-danger-subtle">
              ⚠️ ยังอนุมัติไม่ได้
            </span>
            <small className="d-block text-danger mt-1" style={{ fontSize: '.75rem' }}>
              {SKIP_REASONS[check.reason] || check.reason || 'ตรวจไม่ผ่าน'}
            </small>
          </div>
        );
      }
      return (
        <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle">
          🟠 รอเจ้าหน้าที่ตรวจสอบ
        </span>
      );
    }
    if (row.state === 'pending' && row.approved_at) {
      return (
        <div>
          <span className="badge bg-info-subtle text-info-emphasis border border-info-subtle">
            🔵 อนุมัติแล้ว รอเครื่อง LAN
          </span>
          <small className="d-block text-muted mt-1" style={{ fontSize: '.72rem' }}>
            โดย {row.approved_by || '-'}
          </small>
        </div>
      );
    }
    if (row.state === 'processing') {
      return <span className="badge bg-primary text-white">⏳ เครื่อง LAN กำลังส่ง…</span>;
    }
    if (row.state === 'sent') {
      return (
        <div>
          <span className="badge bg-success-subtle text-success border border-success-subtle">
            🟢 เขียนเข้า HOSxP แล้ว
          </span>
          {row.approved_by && (
            <small className="d-block text-muted mt-1" style={{ fontSize: '.72rem' }}>
              อนุมัติโดย {row.approved_by}
            </small>
          )}
        </div>
      );
    }
    if (row.state === 'conflict') {
      return (
        <span className="badge bg-danger-subtle text-danger border border-danger-subtle">
          🔴 ข้อมูลบ้านเปลี่ยน ต้องตรวจสอบ
        </span>
      );
    }
    return (
      <span className="badge bg-secondary-subtle text-secondary border">
        {STATE_LABELS[row.state] || row.state}
      </span>
    );
  };

  return (
    <section id="house-gps" className="card border-0 shadow-sm p-3 p-md-4" style={{ borderRadius: 16 }}>
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
        <div>
          <h2 className="h4 fw-bold mb-1">รายการพิกัดบ้านและการอนุมัติส่ง HOSxP</h2>
          <p className="text-muted small mb-0">
            ตรวจสอบระยะห่างจากจุดเดิม ดูตำแหน่งบนแผนที่ และติ๊กเลือกอนุมัติส่งเข้าคิว HOSxP ได้ในตารางเดียว
          </p>
        </div>
        <div className="d-flex gap-2">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary rounded-pill px-3"
            onClick={() => setShowMap((v) => !v)}
          >
            <i className={`fa-solid ${showMap ? 'fa-eye-slash' : 'fa-map-location-dot'} me-1`} />
            {showMap ? 'ซ่อนแผนที่ภาพรวม' : 'แสดงแผนที่ภาพรวม'}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-primary rounded-pill px-3"
            disabled={preparing}
            onClick={() => setRefresh((n) => n + 1)}
          >
            <i className="fa-solid fa-rotate me-1" /> โหลดรายการใหม่
          </button>
        </div>
      </div>

      {/* กล่องดึงข้อมูลอ้างอิง HOSxP */}
      <HouseGpsRefresh />

      {data?.revisionAvailable === false && (
        <p role="status" className="alert alert-warning mt-2">
          แสดงคิวพิกัดเดิมได้แล้ว การแก้ไขและส่งใหม่ต้องติดตั้ง migration 20261105_house_gps_revision.sql ก่อน
        </p>
      )}
      {data?.countsError && <p role="alert" className="text-danger">โหลดจำนวนสรุปไม่ได้ กรุณาโหลดรายการใหม่</p>}
      {message && (
        <div role="status" className="alert alert-info py-2 px-3 my-2">
          {message}
        </div>
      )}

      {/* การ์ดสรุปภาพรวม (Summary KPI Cards — คลิกกรองได้ทันที) */}
      <div className="row g-2 my-2">
        {STATUS_TABS.map((tab) => {
          const active = statusFilter === tab.key;
          const count = data?.counts ? counts[tab.key] : '—';
          return (
            <div key={tab.key} className="col-6 col-md">
              <button
                type="button"
                onClick={() => {
                  setStatusFilter(tab.key);
                  setPage(1);
                  setActiveRowId(null);
                }}
                className={`btn w-100 text-start p-2 rounded-3 border h-100 transition-all ${
                  active ? 'border-primary border-2 shadow-sm bg-primary-subtle' : 'bg-white'
                }`}
              >
                <div className="small fw-semibold text-muted">{tab.label}</div>
                <div className="fs-4 fw-bold text-dark mt-1">
                  {count.toLocaleString('th-TH')}{' '}
                  <span className="fs-6 fw-normal text-muted">รายการ</span>
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {/* แถบตัวกรองหมู่บ้าน + ค้นหาบ้านเลขที่/ชื่อ อสม. */}
      <div className="row g-2 align-items-center my-2 bg-light p-2 rounded-3 border mx-0">
        <div className="col-12 col-sm-4 col-md-3">
          <label className="form-label small fw-semibold mb-1" htmlFor="gps-filter-moo">
            กรองตามหมู่บ้าน
          </label>
          <select
            id="gps-filter-moo"
            className="form-select form-select-sm"
            value={mooFilter}
            onChange={(e) => {
              setMooFilter(e.target.value);
              setPage(1);
              setActiveRowId(null);
            }}
          >
            <option value="">ทุกหมู่บ้าน (หมู่ 1–17)</option>
            {VALID_MOOS.map((m) => (
              <option key={m} value={m}>
                หมู่ที่ {m}
              </option>
            ))}
          </select>
        </div>

        <div className="col-12 col-sm-8 col-md-6">
          <label className="form-label small fw-semibold mb-1" htmlFor="gps-filter-search">
            ค้นหาเลขที่บ้าน หรือชื่อผู้บันทึก
          </label>
          <form
            className="d-flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setSearchQuery(searchInput.trim());
              setPage(1);
            }}
          >
            <input
              id="gps-filter-search"
              type="search"
              className="form-control form-control-sm"
              placeholder="เช่น 24/1 หรือชื่อ อสม..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <button type="submit" className="btn btn-sm btn-primary px-3">
              ค้นหา
            </button>
            {(mooFilter || searchQuery || statusFilter !== 'awaiting') && (
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary text-nowrap"
                onClick={() => {
                  setMooFilter('');
                  setSearchInput('');
                  setSearchQuery('');
                  setStatusFilter('awaiting');
                  setPage(1);
                  setActiveRowId(null);
                }}
              >
                ล้างตัวกรอง
              </button>
            )}
          </form>
        </div>

        <div className="col-12 col-md-3 text-md-end small text-muted">
          แสดงหน้าละไม่เกิน 25 รายการ
        </div>
      </div>

      {/* หน้าต่างแก้ไขพิกัดรายบ้าน */}
      {editing && (
        <HouseGpsRevision
          key={editing.row.id}
          {...editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setMessage('บันทึกพิกัดใหม่บนเว็บและเข้าคิวแล้ว รอตรวจอนุมัติเพื่อส่งเข้า HOSxP');
            setRefresh((n) => n + 1);
          }}
        />
      )}

      {failed ? (
        <p role="alert" className="alert alert-danger my-3">
          โหลดรายการพิกัดไม่สำเร็จ กรุณาลองใหม่
        </p>
      ) : !data ? (
        <p role="status" className="text-center py-4">
          <span className="spinner-border spinner-border-sm text-primary me-2" />
          กำลังโหลดรายการพิกัด…
        </p>
      ) : (
        <>
          {/* แผนที่ภาพรวม */}
          {showMap && data.rows.length > 0 && (
            <HouseGpsOverviewMap
              rows={data.rows}
              activeId={activeRowId}
              onSelectRow={(id) => setActiveRowId(id)}
              onApproveRow={approveSingle}
              readyIds={readyRows.map(r=>r.id)}
              onEditRow={edit}
              busy={preparing}
              distanceInfo={getDistanceInfo}
            />
          )}

          {/* แถบจัดการอนุมัติเป็นชุด (Unified Batch Bar) */}
          {readyRows.length > 0 && (
            <div
              className="d-flex justify-content-between align-items-center flex-wrap gap-2 p-3 mb-3 rounded-3 border bg-primary-subtle border-primary-subtle"
              aria-label="อนุมัติพิกัดเป็นชุด"
            >
              <div className="d-flex align-items-center gap-2">
                <input
                  type="checkbox"
                  id="gps-select-all-ready"
                  className="form-check-input mt-0"
                  style={{ width: 20, height: 20 }}
                  disabled={preparing}
                  checked={
                    readyRows.length > 0 && readyRows.every((r) => selectedIds.includes(r.id))
                  }
                  onChange={(e) =>
                    setSelectedIds(e.target.checked ? readyRows.map((r) => r.id) : [])
                  }
                />
                <label htmlFor="gps-select-all-ready" className="fw-bold mb-0 cursor-pointer">
                  เลือกที่พร้อมอนุมัติทั้งหมดในหน้านี้ ({readyRows.length} หลัง)
                </label>
              </div>
              <div className="d-flex align-items-center gap-2">
                <span className="small text-muted">
                  เลือกไว้ <strong>{selectedIds.length}</strong> รายการ
                </span>
                <button
                  type="button"
                  className="btn btn-primary fw-bold rounded-pill px-4"
                  disabled={preparing || !selectedIds.length}
                  onClick={approveSelectedBatch}
                >
                  {preparing
                    ? 'กำลังดำเนินการ…'
                    : `✅ อนุมัติส่ง HOSxP ที่เลือก (${selectedIds.length})`}
                </button>
              </div>
            </div>
          )}

          {/* ตารางรวมรายการพิกัดบ้าน */}
          {data.rows.length ? (
            <div className="table-responsive">
              <table className="table table-hover align-middle">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: 44 }} className="text-center">
                      เลือก
                    </th>
                    <th>บ้าน / หมู่ / ผู้ปักหมุด</th>
                    <th>เปรียบเทียบพิกัด (เดิม → ใหม่)</th>
                    <th>สถานะตรวจสอบ</th>
                    <th className="text-end">ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => {
                    const isReady = batchMap[row.id]?.status === 'ready';
                    const isSelected = selectedIds.includes(row.id);
                    const isActive = activeRowId === row.id;
                    const dist = getDistanceInfo(row);

                    return (
                      <tr
                        key={row.id}
                        className={isActive ? 'table-primary' : ''}
                        onClick={() => setActiveRowId(row.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td className="text-center" onClick={(e) => e.stopPropagation()}>
                          {isReady ? (
                            <input
                              type="checkbox"
                              className="form-check-input"
                              style={{ width: 18, height: 18 }}
                              aria-label={`เลือกบ้าน ${row.address} หมู่ ${row.moo}`}
                              disabled={preparing}
                              checked={isSelected}
                              onChange={(e) =>
                                setSelectedIds((prev) =>
                                  e.target.checked
                                    ? [...prev, row.id]
                                    : prev.filter((id) => id !== row.id)
                                )
                              }
                            />
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>

                        <td>
                          <div className="fw-bold text-dark">
                            บ้านเลขที่ {row.address} <span className="badge bg-secondary">หมู่ {row.moo}</span>
                          </div>
                          <div className="small text-muted">
                            โดย <strong>{row.actor_name || row.actor || '-'}</strong> •{' '}
                            {new Date(row.created_at).toLocaleString('th-TH', {
                              timeZone: 'Asia/Bangkok',
                            })}
                          </div>
                        </td>

                        <td>
                          <div className="mb-1">
                            <span className={`badge ${dist.badgeClass}`}>{dist.label}</span>
                          </div>
                          <div className="small text-muted" style={{ fontSize: '.76rem' }}>
                            เดิม: {row.old_latitude ?? '-'}, {row.old_longitude ?? '-'}
                            <br />
                            ใหม่:{' '}
                            <strong className="text-dark">
                              {Number(row.latitude).toFixed(6)}, {Number(row.longitude).toFixed(6)}
                            </strong>
                          </div>
                        </td>

                        <td>{renderStatusCell(row)}</td>

                        <td className="text-end" onClick={(e) => e.stopPropagation()}>
                          <div className="d-flex justify-content-end gap-1 flex-wrap">
                            <button
                              type="button"
                              className="btn btn-sm btn-light border"
                              title="ดูบนแผนที่"
                              onClick={() => {
                                setShowMap(true);
                                setActiveRowId(row.id);
                              }}
                            >
                              📍 ดูแผนที่
                            </button>
                            {row.state === 'pending' && !row.approved_at && (
                              <button
                                type="button"
                                className="btn btn-sm btn-primary fw-semibold"
                                disabled={preparing || !isReady}
                                onClick={() => approveSingle(row)}
                              >
                                ✅ อนุมัติส่ง
                              </button>
                            )}
                            {data.revisionAvailable !== false &&
                              ['pending', 'sent', 'conflict'].includes(row.state) && (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-primary"
                                  disabled={preparing}
                                  onClick={() => edit(row)}
                                >
                                  แก้ไขพิกัด
                                </button>
                              )}
                          </div>
                          {row.state === 'processing' && (
                            <small className="d-block text-muted mt-1">
                              กำลังส่งผ่านเครื่อง LAN
                            </small>
                          )}
                          <details className="mt-1 text-start d-inline-block">
                            <summary className="small text-muted" style={{ cursor: 'pointer' }}>
                              ประวัติคิว
                            </summary>
                            <small className="d-block p-2 bg-light border rounded mt-1 text-muted">
                              รหัสคิว: {row.id}
                              <br />
                              ผู้บันทึก: {row.actor || '-'}
                              <br />
                              ผู้อนุมัติส่ง: {row.approved_by || '-'}
                              <br />
                              เวลาอนุมัติ:{' '}
                              {row.approved_at
                                ? new Date(row.approved_at).toLocaleString('th-TH')
                                : '-'}
                              <br />
                              อ้างอิงคิวเดิม: {row.replaces_id || '-'}
                              <br />
                              เหตุผลแก้ไข: {row.revision_reason || '-'}
                            </small>
                          </details>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-4 text-muted border rounded-3 bg-light">
              ไม่พบรายการพิกัดตามตัวกรองที่เลือก
            </div>
          )}

          {/* Pagination */}
          <div className="d-flex justify-content-between align-items-center mt-3">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm rounded-pill px-3"
              disabled={preparing || page === 1}
              onClick={() => {
                setPage(page - 1);
                setActiveRowId(null);
              }}
            >
              ก่อนหน้า
            </button>
            <span className="small text-muted">หน้า {page}</span>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm rounded-pill px-3"
              disabled={preparing || !data.more}
              onClick={() => {
                setPage(page + 1);
                setActiveRowId(null);
              }}
            >
              ถัดไป
            </button>
          </div>
        </>
      )}
    </section>
  );
}
