'use client';
import { useCallback, useEffect, useState } from 'react';
import ModalShell from './ModalShell';

function formatBirthThai(dateStr) {
  const s = String(dateStr || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return 'ไม่ระบุวันเกิด';
  const [y, m, d] = s.split('-').map(Number);
  const months = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return `${d} ${months[m] || m} ${y + 543}`;
}

export default function MergeNewPersonModal({ dupPerson, onClose, onMerged }) {
  const dupId = String(dupPerson?.personId || dupPerson?.person_id || '').trim();
  const [dupInfo, setDupInfo] = useState(dupPerson || null);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [moveTargetToDupHouse, setMoveTargetToDupHouse] = useState(false);
  const [reason, setReason] = useState('รวมคนเพิ่มใหม่ (P-...) ที่ซ้ำกับรหัส HOSxP');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchCandidates = useCallback(
    async (query = '') => {
      if (!dupId) return;
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/new-people', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'find_merge_candidates',
            dupPersonId: dupId,
            search: query.trim(),
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.ok) {
          throw new Error(json.error || 'ค้นหารายชื่อ HOSxP ที่ซ้ำกันไม่สำเร็จ');
        }
        if (json.dup) setDupInfo(json.dup);
        const list = Array.isArray(json.candidates) ? json.candidates : [];
        setCandidates(list);
        setSelectedId((prev) => {
          if (prev && list.some((c) => c.person_id === prev)) return prev;
          return list[0]?.person_id || '';
        });
      } catch (e) {
        setError(e.message || 'เชื่อมต่อฐานข้อมูลไม่สำเร็จ');
      } finally {
        setLoading(false);
      }
    },
    [dupId]
  );

  useEffect(() => {
    fetchCandidates('');
  }, [fetchCandidates]);

  const selected = candidates.find((c) => c.person_id === selectedId) || null;

  useEffect(() => {
    if (!selected) return;
    // If HOSxP target currently sits in another house, default to moving them into P-...'s house
    setMoveTargetToDupHouse(!selected.sameHouse);
    setConfirmed(false);
  }, [selected?.person_id, selected?.sameHouse]);

  const previewTransferFields = selected
    ? moveTargetToDupHouse
      ? selected.transferFieldsWithMove || []
      : selected.transferFieldsSameHouse || []
    : [];

  const handleSubmit = async () => {
    if (!selected || !confirmed || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/new-people', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'merge_duplicate',
          dupPersonId: dupId,
          targetPersonId: selected.person_id,
          moveTargetToDupHouse,
          reason: reason.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'รวมและลบรายชื่อซ้ำไม่สำเร็จ');
      }
      onMerged?.(json);
    } catch (e) {
      setError(e.message || 'รวมและลบรายชื่อซ้ำไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  const dupName =
    dupInfo?.fullname ||
    `${dupInfo?.title || ''}${dupInfo?.fname || ''} ${dupInfo?.lname || ''}`.trim() ||
    dupId;
  const dupMoo = dupInfo?.moo || '';
  const dupHouse = dupInfo?.house || '';

  return (
    <ModalShell
      title="รวมและลบคนเพิ่มใหม่ (P-...) ที่ซ้ำกับรหัส HOSxP"
      icon="fa-code-merge"
      variant="warning"
      scrollable
      zIndex={1065}
      onClose={() => {
        if (!submitting) onClose?.();
      }}
      bodyClassName="p-3 p-md-4"
      footer={
        <>
          <button
            type="button"
            className="btn btn-outline-secondary rounded-pill px-3"
            disabled={submitting}
            onClick={onClose}
          >
            ยกเลิก
          </button>
          <button
            type="button"
            className="btn btn-danger fw-bold rounded-pill px-4"
            disabled={!selected || !confirmed || submitting || loading}
            onClick={handleSubmit}
          >
            {submitting
              ? 'กำลังรวมและลบข้อมูล…'
              : `🔗 ยืนยันรวมข้อมูลและลบ ${dupId}`}
          </button>
        </>
      }
    >
      {/* รายการชั่วคราว P-... ที่จะถูกลบ */}
      <div className="p-3 rounded-3 border border-danger-subtle bg-danger-subtle mb-3">
        <div className="small fw-bold text-danger mb-1">
          🗑️ รายการคนเพิ่มใหม่ชั่วคราว (จะถูกลบออกหลังโอนข้อมูล)
        </div>
        <div className="fw-bold text-dark fs-6">{dupName}</div>
        <div className="small text-dark mt-1">
          รหัส: <code>{dupId}</code> • บ้านเลขที่ <strong>{dupHouse || '-'}</strong> ม.
          <strong>{dupMoo || '-'}</strong> • วันเกิด:{' '}
          {formatBirthThai(dupInfo?.birth_date || dupInfo?.birthDate)}
        </div>
        <div className="small text-muted mt-1">
          สถานะในบ้าน: {dupInfo?.relation || 'ผู้อาศัย'} • ประเภทอยู่อาศัย:{' '}
          {dupInfo?.residency_type || dupInfo?.residencyType || '-'} • โรค:{' '}
          {dupInfo?.chronic || '-'}
        </div>
      </div>

      {/* ค้นหารหัส HOSxP ปลายทางเพิ่มเติม */}
      <form
        className="input-group input-group-sm mb-3"
        onSubmit={(e) => {
          e.preventDefault();
          fetchCandidates(searchInput);
        }}
      >
        <input
          type="search"
          className="form-control"
          placeholder="ค้นหาชื่อ-สกุล, เลขบัตร 13 หลัก หรือรหัส HOSxP..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          disabled={loading || submitting}
        />
        <button type="submit" className="btn btn-primary px-3" disabled={loading || submitting}>
          🔍 ค้นหา
        </button>
      </form>

      {/* รายชื่อรหัส HOSxP ที่พบ */}
      <div className="mb-3">
        <div className="fw-bold small mb-2 text-dark">
          ✅ เลือกรหัส HOSxP ตัวจริงที่จะเก็บไว้ ({candidates.length} รายการ):
        </div>
        {loading ? (
          <div className="text-center py-3 text-muted small">
            <span className="spinner-border spinner-border-sm me-2" />
            กำลังค้นหารหัส HOSxP ที่ตรงกัน…
          </div>
        ) : candidates.length === 0 ? (
          <div className="alert alert-light border small text-muted mb-0">
            ยังไม่พบรหัส HOSxP ที่ตรงกันอัตโนมัติ — ลองพิมพ์ชื่อ นามสกุล หรือเลขบัตร 13 หลักในช่องค้นหาด้านบน
          </div>
        ) : (
          <div className="d-flex flex-column gap-2" style={{ maxHeight: 230, overflowY: 'auto' }}>
            {candidates.map((c) => {
              const active = c.person_id === selectedId;
              return (
                <label
                  key={c.person_id}
                  className={`p-2 px-3 rounded-3 border d-flex align-items-start gap-2 ${
                    active ? 'border-primary border-2 bg-primary-subtle' : 'bg-white'
                  }`}
                  style={{ cursor: 'pointer' }}
                >
                  <input
                    type="radio"
                    name="merge-target-hosxp"
                    className="form-check-input mt-1"
                    checked={active}
                    disabled={submitting}
                    onChange={() => setSelectedId(c.person_id)}
                  />
                  <div className="flex-grow-1 small">
                    <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                      <span className="fw-bold text-dark">{c.fullname}</span>
                      <span
                        className={`badge ${
                          c.sameHouse
                            ? 'bg-success text-white'
                            : c.score >= 85
                            ? 'bg-info-subtle text-info-emphasis border border-info-subtle'
                            : 'bg-light text-dark border'
                        }`}
                      >
                        {c.matchReason} {c.sameHouse ? '• บ้านเดียวกัน' : `(บ้าน ${c.house || '-'} ม.${c.moo || '-'})`}
                      </span>
                    </div>
                    <div className="text-muted mt-1">
                      HOSxP: <code>{c.person_id}</code>
                      {c.cid ? ` • บัตร: ${c.cid}` : ''} • เกิด: {formatBirthThai(c.birth_date)}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* สรุปผลก่อนรวม */}
      {selected && (
        <div className="p-3 rounded-3 border bg-light mb-3 small">
          <div className="fw-bold text-dark mb-1">
            📋 ข้อมูลที่จะโอนเข้าสู่รหัส HOSxP <code>{selected.person_id}</code> (เติมเฉพาะช่องที่ยังว่าง):
          </div>
          {!selected.sameHouse && (
            <label className="form-check mt-2 mb-2 fw-semibold text-primary">
              <input
                type="checkbox"
                className="form-check-input"
                checked={moveTargetToDupHouse}
                disabled={submitting}
                onChange={(e) => {
                  setMoveTargetToDupHouse(e.target.checked);
                  setConfirmed(false);
                }}
              />{' '}
              ย้ายที่อยู่สำรวจของรหัส HOSxP จากบ้าน {selected.house || '-'} ม.{selected.moo || '-'} มาอยู่บ้าน{' '}
              {dupHouse || '-'} ม.{dupMoo || '-'} ด้วย
            </label>
          )}
          {previewTransferFields.length > 0 ? (
            <ul className="mb-0 ps-3 text-success fw-semibold">
              {previewTransferFields.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <div className="text-muted">
              ไม่มีข้อมูลใหม่ที่ต้องโอน (รหัส HOSxP มีข้อมูลครบอยู่แล้ว) — จะลบเฉพาะรายการซ้ำ {dupId}
            </div>
          )}
        </div>
      )}

      <div className="mb-3">
        <label className="small fw-bold text-dark d-block mb-1">หมายเหตุ / เหตุผลการรวมรายชื่อ</label>
        <input
          type="text"
          className="form-control form-control-sm"
          maxLength={300}
          disabled={submitting}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>

      {selected && (
        <label className="form-check p-2 px-3 rounded-3 border bg-warning-subtle small fw-bold text-dark">
          <input
            type="checkbox"
            className="form-check-input"
            checked={confirmed}
            disabled={submitting}
            onChange={(e) => setConfirmed(e.target.checked)}
          />{' '}
          ยืนยันว่า <strong>{dupName} ({dupId})</strong> และ{' '}
          <strong>{selected.fullname} ({selected.person_id})</strong> เป็นบุคคลเดียวกัน และต้องการลบ{' '}
          <code>{dupId}</code>
        </label>
      )}

      {error && (
        <div role="alert" className="alert alert-danger py-2 px-3 mt-2 mb-0 small fw-semibold">
          ⚠️ {error}
        </div>
      )}
    </ModalShell>
  );
}
