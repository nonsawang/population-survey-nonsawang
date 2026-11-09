'use client';
import { useState, useEffect, useCallback } from 'react';
import { swal, Toast } from '@/lib/survey-feedback';

const PAGE_SIZE = 20;

export default function PendingTransfersBanner({
  user,
  refreshTrigger = 0,
  onPendingMapChange,
  onResolved,
  onOpenHouse,
}) {
  const [page, setPage] = useState(1);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [incomingTotal, setIncomingTotal] = useState(0);
  const [outgoingTotal, setOutgoingTotal] = useState(0);
  const [vhvByMoo, setVhvByMoo] = useState({});
  const [selectedVhvById, setSelectedVhvById] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [loading, setLoading] = useState(false);

  const canUseTransfer = Boolean(user && ['admin', 'staff', 'vhv'].includes(user.role));

  const loadPending = useCallback(
    async (targetPage = page) => {
      if (!canUseTransfer) return;
      setLoading(true);
      try {
        const res = await fetch('/api/house-transfer', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'list_pending',
            page: targetPage,
            pageSize: PAGE_SIZE,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) return;

        const inc = Array.isArray(data.incoming) ? data.incoming : [];
        const out = Array.isArray(data.outgoing) ? data.outgoing : [];
        setIncoming(inc);
        setOutgoing(out);
        setIncomingTotal(Number(data.incomingTotal ?? inc.length));
        setOutgoingTotal(Number(data.outgoingTotal ?? out.length));
        setVhvByMoo(data.vhvByMoo || {});

        setSelectedVhvById((prev) => {
          const next = { ...prev };
          inc.forEach((r) => {
            if (!next[r.requestId]) {
              next[r.requestId] = r.toVhv && r.toVhv !== 'ไม่ระบุ' ? r.toVhv : '';
            }
          });
          return next;
        });

        if (typeof onPendingMapChange === 'function') {
          const map = {};
          (Array.isArray(data.allPendingForLookup) ? data.allPendingForLookup : [...inc, ...out]).forEach((r) => {
            if (r?.personId) map[r.personId] = r;
          });
          onPendingMapChange(map);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    },
    [canUseTransfer, page, onPendingMapChange]
  );

  useEffect(() => {
    loadPending(page);
  }, [loadPending, page, refreshTrigger]);

  const handleApprove = async (req) => {
    const chosenVhv = selectedVhvById[req.requestId] || req.toVhv || '';
    setBusyId(req.requestId);
    try {
      const res = await fetch('/api/house-transfer', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          requestId: req.requestId,
          toVhv: chosenVhv,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        swal({ icon: 'error', title: 'ยืนยันย้ายเข้าไม่สำเร็จ', text: data.error || 'กรุณาลองใหม่' });
        await loadPending(page);
        return;
      }
      Toast('success', data.message || 'ยืนยันรับเข้าบ้านในทะเบียนสำรวจเรียบร้อยแล้ว');
      await loadPending(page);
      if (typeof onResolved === 'function') onResolved(req, 'approved');
    } catch {
      swal({ icon: 'error', title: 'เชื่อมต่อไม่สำเร็จ', text: 'กรุณาลองใหม่อีกครั้ง' });
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (req, isCancel = false) => {
    setBusyId(req.requestId);
    try {
      const res = await fetch('/api/house-transfer', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          requestId: req.requestId,
          reason: isCancel ? 'ผู้แจ้งยกเลิกคำขอย้ายบ้าน' : 'ปฏิเสธคำขอย้ายเข้าบ้านปลายทาง',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        swal({ icon: 'error', title: 'ดำเนินการไม่สำเร็จ', text: data.error || 'กรุณาลองใหม่' });
        await loadPending(page);
        return;
      }
      Toast('info', data.message || 'ยกเลิกคำขอย้ายบ้านเรียบร้อยแล้ว');
      await loadPending(page);
      if (typeof onResolved === 'function') onResolved(req, 'rejected');
    } catch {
      swal({ icon: 'error', title: 'เชื่อมต่อไม่สำเร็จ', text: 'กรุณาลองใหม่อีกครั้ง' });
    } finally {
      setBusyId(null);
    }
  };

  if (!canUseTransfer || (incomingTotal === 0 && outgoingTotal === 0 && incoming.length === 0 && outgoing.length === 0)) {
    return null;
  }

  const maxTotal = Math.max(incomingTotal, outgoingTotal);
  const totalPages = Math.max(1, Math.ceil(maxTotal / PAGE_SIZE));

  return (
    <div className="mb-3 fade-in">
      {incoming.length > 0 && (
        <div
          className="card border-0 shadow-sm mb-2"
          style={{
            borderRadius: 14,
            background: '#fffbeb',
            borderLeft: '5px solid #f59e0b',
          }}
        >
          <div className="card-body p-3">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-1">
              <div className="fw-bold" style={{ color: '#b45309' }}>
                <i className="fa-solid fa-truck-ramp-box me-2" />
                รายการรอยืนยันย้ายเข้าบ้าน ({incomingTotal} รายการ)
              </div>
              <button
                type="button"
                onClick={() => loadPending(page)}
                disabled={loading}
                className="btn btn-sm btn-outline-warning rounded-pill px-3"
                style={{ fontSize: '.78rem' }}
              >
                <i className="fa-solid fa-rotate me-1" /> รีเฟรช
              </button>
            </div>
            <div className="small text-muted mb-2" style={{ fontSize: '.76rem' }}>
              หมายเหตุ: การยืนยันรับเข้าบ้านจะปรับปรุงเฉพาะทะเบียนสำรวจในระบบ ยังไม่ได้เปลี่ยนที่อยู่ใน HOSxP อัตโนมัติ
            </div>

            <div className="d-flex flex-column gap-2">
              {incoming.map((req) => {
                const vhvOptions = vhvByMoo[String(req.toMoo)] || [];
                const currentVhv = selectedVhvById[req.requestId] ?? (req.toVhv !== 'ไม่ระบุ' ? req.toVhv : '');
                const isBusy = busyId === req.requestId;

                return (
                  <div
                    key={req.requestId}
                    className="bg-white rounded-3 p-3 border"
                    style={{ borderColor: '#fde68a' }}
                  >
                    <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                      <div>
                        <div className="fw-bold text-dark">
                          <span className="badge bg-warning text-dark me-2">⏳ รอยืนยันย้ายเข้า</span>
                          {req.fullname}{req.legacyNeedsReview && <span className="badge bg-danger ms-2">คำขอเดิม: ตรวจข้อมูลและส่งคำขอใหม่</span>}
                          {req.relation ? (
                            <span className="text-muted fw-normal small ms-2">({req.relation})</span>
                          ) : null}
                        </div>
                        <div className="small text-muted mt-1">
                          ย้ายจาก: <strong>บ้านเลขที่ {req.fromHouse} ม.{req.fromMoo}</strong>
                          {' → '}
                          ย้ายเข้า:{' '}
                          <strong className="text-primary">
                            บ้านเลขที่ {req.toHouse} ม.{req.toMoo}
                          </strong>
                        </div>
                        <div className="small text-secondary mt-1" style={{ fontSize: '.78rem' }}>
                          แจ้งย้ายโดย: {req.requestedByName || req.requestedBy || '-'}
                          {req.requestedAt
                            ? ` • ${new Date(req.requestedAt).toLocaleString('th-TH', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })}`
                            : ''}
                        </div>
                      </div>

                      {typeof onOpenHouse === 'function' && (
                        <button
                          type="button"
                          onClick={() => onOpenHouse(String(req.toMoo), String(req.toHouse))}
                          className="btn btn-sm btn-light border rounded-pill"
                          style={{ fontSize: '.76rem' }}
                        >
                          <i className="fa-solid fa-house-user me-1" /> ดูบ้านปลายทาง
                        </button>
                      )}
                    </div>

                    {req.canApprove && (
                      <div className="row g-2 align-items-center mt-2 pt-2 border-top">
                        <div className="col-12 col-md-6">
                          <label className="small text-muted fw-semibold d-block mb-1" style={{ fontSize: '.75rem' }}>
                            อสม. ผู้รับผิดชอบบ้านปลายทาง (ม.{req.toMoo} บ้าน {req.toHouse})
                          </label>
                          <select
                            className="form-select form-select-sm"
                            value={currentVhv}
                            disabled={isBusy}
                            onChange={(e) =>
                              setSelectedVhvById((prev) => ({
                                ...prev,
                                [req.requestId]: e.target.value,
                              }))
                            }
                          >
                            <option value="">-- ใช้ค่าบ้านปลายทาง --</option>
                            {vhvOptions.map((name) => (
                              <option key={name} value={name}>
                                {name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="col-12 col-md-6 d-flex gap-2 justify-content-md-end mt-2 mt-md-4">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleApprove(req)}
                            className="btn btn-sm btn-success rounded-pill px-3 fw-bold flex-grow-1 flex-md-grow-0"
                          >
                            <i className="fa-solid fa-check me-1" /> ยืนยันรับเข้าบ้าน
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleReject(req, false)}
                            className="btn btn-sm btn-outline-danger rounded-pill px-3"
                          >
                            <i className="fa-solid fa-xmark me-1" /> ปฏิเสธ
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {outgoing.length > 0 && (
        <div
          className="card border-0 shadow-sm"
          style={{
            borderRadius: 14,
            background: '#eff6ff',
            borderLeft: '5px solid #3b82f6',
          }}
        >
          <div className="card-body p-3">
            <div className="fw-bold mb-2" style={{ color: '#1d4ed8', fontSize: '.9rem' }}>
              <i className="fa-solid fa-paper-plane me-2" />
              รายการแจ้งย้ายข้ามหมู่ที่รอปลายทางรับเข้า ({outgoingTotal} รายการ)
            </div>
            <div className="d-flex flex-column gap-2">
              {outgoing.map((req) => (
                <div
                  key={req.requestId}
                  className="bg-white rounded-3 p-2 px-3 border d-flex justify-content-between align-items-center flex-wrap gap-2"
                >
                  <div className="small">
                    <span className="badge bg-warning text-dark me-2">⏳ รอยืนยันย้ายเข้า</span>
                    <strong>{req.fullname}</strong> • บ้านเลขที่ {req.fromHouse} ม.{req.fromMoo} →{' '}
                    <strong className="text-primary">
                      บ้านเลขที่ {req.toHouse} ม.{req.toMoo}
                    </strong>
                  </div>
                  <button
                    type="button"
                    disabled={busyId === req.requestId}
                    onClick={() => handleReject(req, true)}
                    className="btn btn-sm btn-outline-secondary rounded-pill px-3"
                    style={{ fontSize: '.75rem' }}
                  >
                    ยกเลิกคำขอ
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="d-flex justify-content-between align-items-center mt-2 px-1 small text-muted">
          <span>
            หน้า {page} จาก {totalPages}
          </span>
          <div className="btn-group btn-group-sm">
            <button
              type="button"
              className="btn btn-outline-secondary"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ก่อนหน้า
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              ถัดไป
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
