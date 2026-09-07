'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { VALID_MOOS } from '@/lib/utils';
import { summarizeSurvey, vhvName } from '@/lib/survey-work';
import StaffSurveyOverview from '@/components/StaffSurveyOverview';
import { inSurveyScope } from '@/lib/population-status';

const PAGE_SIZE = 20;
const labels = { notStarted: 'ยังไม่เริ่ม', partial: 'สำรวจบางส่วน', complete: 'สำรวจครบ' };

export default function SurveyWorkPanel({ user, refreshKey, opening, onOpenHouse }) {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [legacySchema, setLegacySchema] = useState(false);
  const [retry, setRetry] = useState(0);
  const [moo, setMoo] = useState('');
  const [vhv, setVhv] = useState('');
  const isStaffView = ['staff', 'admin', 'manager'].includes(user?.role);
  const [status, setStatus] = useState(() => isStaffView ? 'pending' : 'all');
  const [scrollTarget, setScrollTarget] = useState('');
  useEffect(() => {
    if (scrollTarget) { document.getElementById(scrollTarget)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); setScrollTarget(''); }
  }, [scrollTarget]);
  const [page, setPage] = useState(1);
  const scope = user?.role === 'vhv' ? String(user?.moo || '') : null;
  const moos = useMemo(() => scope === null ? VALID_MOOS.map(String) : VALID_MOOS.map(String).filter(m => scope.split(',').map(v => v.trim()).includes(m)), [scope]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setBusy(true); setError(''); setRows([]); setLegacySchema(false);
      try {
        if (!user || !moos.length) return;
        const collected = [];
        for (let offset = 0; ; offset += 1000) {
          const baseColumns = 'person_id,moo,house,vhv,residency_type';
          let response = await supabase.from('population').select(baseColumns + ',status_model_version,person_discharge_id,legacy_residency_type').in('moo', moos).order('person_id').range(offset, offset + 999);
          if (cancelled) return;
          if (response.error && ['42703', 'PGRST204'].includes(response.error.code)) {
            setLegacySchema(true);
            response = await supabase.from('population').select(baseColumns).in('moo', moos).order('person_id').range(offset, offset + 999);
          }
          const { data, error: queryError } = response;
          if (cancelled) return;
          if (queryError) throw queryError;
          collected.push(...(data || []));
          if (!data || data.length < 1000) break;
        }
        if (!cancelled) setRows(collected);
      } catch {
        if (!cancelled) setError('โหลดรายการงานไม่สำเร็จ กรุณาลองอีกครั้ง');
      } finally { if (!cancelled) setBusy(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [user, moos, refreshKey, retry]);

  const selectedMoo = moos.includes(moo) ? moo : '';
  const owners = useMemo(() => [...new Set(rows.filter(r => (!selectedMoo || String(r.moo).trim() === selectedMoo) && inSurveyScope(r)).map(r => vhvName(r.vhv)))].sort((a, b) => a.localeCompare(b, 'th')), [rows, selectedMoo]);
  const selectedVhv = owners.includes(vhv) ? vhv : '';
  const { houses, totals } = useMemo(() => summarizeSurvey(rows, selectedMoo, selectedVhv, status), [rows, selectedMoo, selectedVhv, status]);
  const pages = Math.max(1, Math.ceil(houses.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  useEffect(() => { setPage(1); }, [moo, vhv, status, refreshKey, scope]);

  return <section className="card survey-work-panel border-0 shadow-sm mb-4" style={{ borderRadius: 16 }} aria-labelledby="survey-work-title">
    <div className="card-body p-4">
      <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
        <h2 id="survey-work-title" className="h5 fw-bold mb-0">ติดตามงานสำรวจ</h2>
        <button type="button" className="btn btn-sm btn-outline-primary" disabled={busy} onClick={() => setRetry(v => v + 1)}>รีเฟรช</button>
      </div>
      <p className="small text-muted">งานคงค้างนับผู้ที่ยังไม่จำหน่ายและยังไม่ระบุประเภทอยู่อาศัย Type 0–3 ไม่นับบุคคลนอกเขต (Type 4) ผู้เสียชีวิต หรือผู้จำหน่าย ไม่รวมความครบถ้วนของการคัดกรองสุขภาพ</p>
      {legacySchema && <p className="alert alert-warning small">กำลังอ่านสถานะแบบเดิม ต้องรัน migration ใน Supabase ก่อนบันทึกสถานะตาม HOSxP</p>}
      {!busy && !error && isStaffView && <StaffSurveyOverview rows={rows} moo={selectedMoo} vhv={selectedVhv} onSelect={(m, owner, nextStatus, showHouses) => { setMoo(m); setVhv(owner); setStatus(nextStatus); setPage(1); setScrollTarget(showHouses ? 'staff-house-list-title' : 'staff-owners-title'); }} />}
      <div id="staff-house-list-title" className="staff-house-list-heading"><h3 className="h5 fw-bold mb-1">{isStaffView ? '3. บ้านที่ต้องติดตาม' : 'รายการบ้าน'}</h3><p className="small text-muted mb-3">{selectedMoo ? 'หมู่ ' + selectedMoo : 'ทุกหมู่ที่มีสิทธิ์'}{selectedVhv ? ' • ' + selectedVhv : ' • อสม. ทุกคน'} • เลือกสถานะเพื่อดูบ้านที่ยังไม่เริ่มหรือสำรวจบางส่วน</p></div>
      <div className="row g-2 mb-3">
        <div className="col-12 col-md-4"><label htmlFor="work-moo" className="form-label">หมู่บ้าน</label><select id="work-moo" className="form-select" value={selectedMoo} onChange={e => { setMoo(e.target.value); setVhv(''); }}><option value="">ทุกหมู่ที่มีสิทธิ์</option>{moos.map(m => <option key={m} value={m}>หมู่ {m}</option>)}</select></div>
        <div className="col-12 col-md-4"><label htmlFor="work-vhv" className="form-label">อสม.</label><select id="work-vhv" className="form-select" value={selectedVhv} onChange={e => setVhv(e.target.value)}><option value="">ทุกคน</option>{owners.map(name => <option key={name} value={name}>{name}</option>)}</select></div>
        <div className="col-12 col-md-4"><label htmlFor="work-status" className="form-label">สถานะการสำรวจ</label><select id="work-status" className="form-select" value={status} onChange={e => setStatus(e.target.value)}><option value="all">ทั้งหมด</option><option value="pending">งานที่ยังไม่ครบ</option><option value="notStarted">ยังไม่เริ่ม</option><option value="partial">สำรวจบางส่วน</option><option value="complete">สำรวจครบ</option></select></div>
      </div>
      {busy ? <p role="status">กำลังโหลดงานสำรวจ...</p> : error ? <div role="alert" className="alert alert-danger">{error} <button className="btn btn-sm btn-outline-danger" onClick={() => setRetry(v => v + 1)}>ลองอีกครั้ง</button></div> : !moos.length ? <p role="status">ยังไม่มีหมู่บ้านที่ได้รับสิทธิ์ กรุณาติดต่อผู้ดูแล</p> : <>
        <div className="row g-2 mb-3" aria-live="polite">
          {[['ประชากร', totals.people, 'คน'], ['บ้านทั้งหมด', totals.houses, 'หลัง'], ['ยังไม่สำรวจ', totals.pending, 'คน'], ['บ้านที่ยังไม่ครบ', totals.incomplete, 'หลัง']].map(([label, value, unit]) => <div className="col-6 col-lg-3" key={label}><div className="survey-work-stat rounded-3 p-3"><div className="small text-muted">{label}</div><strong className="fs-5">{value.toLocaleString('th-TH')}</strong> <small>{unit}</small></div></div>)}
        </div>
        <p className="small text-muted">ยอดสรุปตามหมู่บ้านและ อสม. ที่เลือก • เมื่อเลือก อสม. จะนับเฉพาะคนในความรับผิดชอบของ อสม. คนนั้น</p>
        <div className="d-flex gap-2 flex-wrap mb-3"><button className="btn btn-sm btn-warning" onClick={() => setStatus('pending')}>แสดงงานที่ยังไม่ครบ</button><button className="btn btn-sm btn-outline-secondary" onClick={() => { setMoo(''); setVhv(''); setStatus('all'); setPage(1); }}>ล้างตัวกรอง</button></div>
        {!houses.length ? <p role="status" className="text-center bg-light rounded p-3">ไม่พบงานตามตัวกรองที่เลือก</p> : <>
          <div className="table-responsive survey-work-table"><table className="table align-middle"><caption>พบ {houses.length.toLocaleString('th-TH')} รายการ • เรียงงานคงค้างมากก่อน</caption><thead><tr><th scope="col">บ้าน</th><th scope="col">อสม.</th><th scope="col">สำรวจแล้ว / ทั้งหมด</th><th scope="col">คงค้าง</th><th scope="col">สถานะ</th><th scope="col">ดำเนินการ</th></tr></thead><tbody>{houses.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map(h => <tr key={h.key}><td data-label="บ้าน" className="text-nowrap">ม.{h.moo || '-'} บ้าน {h.house || 'ไม่ระบุ'}</td><td data-label="อสม.">{h.owners.join(', ')}</td><td data-label="สำรวจแล้ว / ทั้งหมด">{h.done} / {h.total}</td><td data-label="คงค้าง" className={h.pending ? 'text-danger fw-bold' : ''}>{h.pending} คน</td><td data-label="สถานะ"><span className={`badge ${h.status === 'complete' ? 'bg-success' : h.status === 'partial' ? 'bg-warning text-dark' : 'bg-secondary'}`}>{labels[h.status]}</span></td><td className="survey-work-action"><button className="btn btn-sm btn-primary text-nowrap" disabled={opening || !h.house || h.house === '-'} onClick={() => onOpenHouse(h.moo, h.house)} aria-label={`เปิดบ้าน ${h.house} หมู่ ${h.moo}`}>เปิดบ้าน</button></td></tr>)}</tbody></table></div>
          <div className="d-flex justify-content-between align-items-center"><button className="btn btn-sm btn-outline-secondary" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>ก่อนหน้า</button><span className="small" aria-live="polite">หน้า {currentPage} / {pages}</span><button className="btn btn-sm btn-outline-secondary" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>ถัดไป</button></div>
        </>}
      </>}
    </div>
  </section>;
}
