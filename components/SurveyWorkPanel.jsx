'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { VALID_MOOS } from '@/lib/utils';
import { summarizeSurvey, summarizeStaffSurvey, filterSurveyHouses, vhvName } from '@/lib/survey-work';
import StaffSurveyOverview from '@/components/StaffSurveyOverview';
import LocalAiAssistant from '@/components/LocalAiAssistant';
import { inSurveyScope } from '@/lib/population-status';

const PAGE_SIZE = 20;
const FETCH_LIMIT = 1000;
const thCollator = new Intl.Collator('th', { numeric: true });
const labels = { notStarted: 'ยังไม่เริ่ม', partial: 'สำรวจบางส่วน', complete: 'สำรวจครบ' };

export default function SurveyWorkPanel({ user, refreshKey, opening, onOpenHouse, personal = false }) {
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
    const controller = new AbortController();
    async function load() {
      setBusy(true); setError(''); setRows([]); setLegacySchema(false);
      try {
        if (!user || !moos.length) return;
        const collected = [];
        const moosSet = new Set(moos);
        const baseColumns = 'person_id,moo,house,vhv,residency_type,latitude,longitude';
        let columns = baseColumns + ',status_model_version,person_discharge_id,legacy_residency_type';
        let lastPersonId = null;

        const queryPage = async (cols, afterId) => {
          for (let attempt = 0; attempt < 3; attempt++) {
            let q = supabase.from('population').select(cols).order('person_id', { ascending: true }).limit(FETCH_LIMIT);
            if (scope !== null) q = q.in('moo', moos);
            if (afterId !== null) q = q.gt('person_id', afterId);
            if (typeof q.abortSignal === 'function') q = q.abortSignal(controller.signal);
            const res = await q;
            if (!res.error || ['42703', 'PGRST204'].includes(res.error.code) || cancelled) return res;
            if (attempt < 2) await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
            else return res;
          }
        };

        for (;;) {
          let response = await queryPage(columns, lastPersonId);
          if (cancelled) return;
          if (response?.error && ['42703', 'PGRST204'].includes(response.error.code) && columns !== baseColumns) {
            setLegacySchema(true);
            columns = baseColumns;
            response = await queryPage(columns, lastPersonId);
          }
          const { data, error: queryError } = response || {};
          if (cancelled) return;
          if (queryError) throw queryError;
          const batch = data || [];
          for (const row of batch) {
            if (personal) {
              const owner = String(row.vhv || '').trim().replace(/\s+/g, ' ');
              const name = String(user.displayName || '').trim().replace(/\s+/g, ' ');
              if (!name || owner !== name) continue;
            }
            if (moosSet.has(String(row.moo ?? '').trim())) collected.push(row);
          }
          const nextId = batch.length ? String(batch[batch.length - 1].person_id || '') : '';
          if (batch.length < FETCH_LIMIT || !nextId || nextId === lastPersonId) break;
          lastPersonId = nextId;
        }
        if (!cancelled) setRows(collected);
      } catch {
        if (!cancelled && !controller.signal.aborted) setError('โหลดรายการงานไม่สำเร็จ กรุณาลองอีกครั้ง');
      } finally { if (!cancelled) setBusy(false); }
    }
    load();
    return () => { cancelled = true; controller.abort(); };
  }, [user, moos, scope, refreshKey, retry, personal]);

  const selectedMoo = moos.includes(moo) ? moo : '';
  const owners = useMemo(() => [...new Set(rows.filter(r => (!selectedMoo || String(r.moo).trim() === selectedMoo) && inSurveyScope(r)).map(r => vhvName(r.vhv)))].sort(thCollator.compare), [rows, selectedMoo]);
  const selectedVhv = owners.includes(vhv) ? vhv : '';
  const baseSummary = useMemo(() => summarizeSurvey(rows, selectedMoo, selectedVhv, 'all'), [rows, selectedMoo, selectedVhv]);
  const totals = baseSummary.totals;
  const houseStatusCounts = useMemo(() => {
    const counts = { complete: 0, partial: 0, notStarted: 0 };
    for (const house of baseSummary.houses) {
      if (house.house && house.house !== '-') counts[house.status]++;
    }
    return counts;
  }, [baseSummary]);
  const fieldWork = useMemo(() => {
    const pinned = new Set();
    for (const r of rows) {
      const lat = Number(r.latitude), lon = Number(r.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lon) && lat !== 0 && lon !== 0 && Math.abs(lat) <= 90 && Math.abs(lon) <= 180)
        pinned.add(JSON.stringify([String(r.moo ?? '').trim(), String(r.house ?? '').trim()]));
    }
    return baseSummary.houses
      .filter(h => h.house && h.house !== '-' && (h.pending || !pinned.has(h.key)))
      .slice()
      .sort((a, b) => thCollator.compare(String(a.moo ?? ''), String(b.moo ?? '')) || thCollator.compare(String(a.house ?? ''), String(b.house ?? '')))
      .map(h => [h.moo, h.house, h.owners.join(', '), h.pending ? labels[h.status] + ' (ค้าง ' + h.pending + ' คน)' : 'ครบแล้ว', pinned.has(h.key) ? 'มีพิกัด' : 'ต้องปักหมุด', '']);
  }, [rows, baseSummary]);
  function printFieldWork() {
    const w = window.open('', '_blank');
    if (!w) { window.alert('กรุณาอนุญาตหน้าต่างใหม่เพื่อพิมพ์ใบงาน'); return; }
    w.opener = null;
    const d = w.document;
    d.documentElement.lang = 'th';
    d.title = 'ใบงาน อสม. ติดตามบ้าน';
    const add = (parent, tag, value) => { const el = d.createElement(tag); el.textContent = value; parent.appendChild(el); return el; };
    add(d.head, 'style', '@page{size:A4;margin:12mm}body{font:14px sans-serif;color:#111}table{border-collapse:collapse;width:100%}td,th{border:1px solid #888;padding:5px}td:last-child{width:22%}tr{break-inside:avoid}thead{display:table-header-group}@media print{button{display:none}}');
    add(d.body,'h1','ใบงาน อสม. ติดตามบ้านค้างสำรวจหรือปักหมุด');
    add(d.body,'p', (selectedMoo ? 'หมู่ '+selectedMoo : 'ทุกหมู่ที่มีสิทธิ์')+' • '+(selectedVhv || 'อสม. ทุกคน')+' • '+fieldWork.length+' หลัง • '+new Date().toLocaleDateString('th-TH'));
    const table = add(d.body,'table',''), header = table.createTHead().insertRow(), body = table.createTBody();
    for (const label of ['หมู่','บ้านเลขที่','อสม.','งานสำรวจ','งานพิกัด','วันที่ / ผลติดตาม']) add(header,'th',label);
    for (const values of fieldWork) { const row = body.insertRow(); for (const v of values) row.insertCell().textContent = v; }
    add(d.body,'button','พิมพ์อีกครั้ง').onclick = () => w.print();
    w.focus(); w.print();
  }
  const houses = useMemo(() => filterSurveyHouses(baseSummary.houses, status), [baseSummary.houses, status]);
  const staffSummary = useMemo(() => isStaffView ? summarizeStaffSurvey(rows) : null, [rows, isStaffView]);
  const aiTrackingContext = useMemo(() => ({
    selectedMoo: selectedMoo || 'ทุกหมู่',
    totals,
    topVillages: (staffSummary?.villages || []).filter(v => v.incomplete > 0).slice(0, 5),
    topOwners: (staffSummary?.owners || []).filter(o => o.pendingPeople > 0).slice(0, 5),
  }), [selectedMoo, totals, staffSummary]);
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
      {personal && !busy && !error && !rows.length && <p className="alert alert-info">ยังไม่พบบ้านที่ผูกชื่อผู้รับผิดชอบตรงกับชื่อบัญชีของคุณ กรุณาให้เจ้าหน้าที่ตรวจชื่อ อสม. และหมู่บ้านที่รับผิดชอบ</p>}
      {!busy && !error && rows.length > 0 && <LocalAiAssistant tracking={aiTrackingContext} defaultFocus="tracking" title="ผู้ช่วย Local AI จัดลำดับคิวติดตามสำรวจรายหมู่บ้านและ อสม." />}
      {!busy && !error && isStaffView && <StaffSurveyOverview rows={rows} moo={selectedMoo} vhv={selectedVhv} onSelect={(m, owner, nextStatus, showHouses) => { setMoo(m); setVhv(owner); setStatus(nextStatus); setPage(1); setScrollTarget(showHouses ? 'staff-house-list-title' : 'staff-owners-title'); }} />}
      <div id="staff-house-list-title" className="staff-house-list-heading"><h3 className="h5 fw-bold mb-1">{isStaffView ? '3. บ้านที่ต้องติดตาม' : 'รายการบ้าน'}</h3><p className="small text-muted mb-3">{selectedMoo ? 'หมู่ ' + selectedMoo : 'ทุกหมู่ที่มีสิทธิ์'}{selectedVhv ? ' • ' + selectedVhv : ' • อสม. ทุกคน'} • เลือกสถานะเพื่อดูบ้านที่ยังไม่เริ่มหรือสำรวจบางส่วน</p></div>
      {!busy && !error && <div className="mb-3"><button type="button" className="btn btn-outline-primary" disabled={!fieldWork.length} onClick={printFieldWork}>พิมพ์ใบงาน อสม. ({fieldWork.length} หลัง)</button><small className="d-block text-muted">รวมบ้านค้างสำรวจหรือขาดพิกัดทุกหน้า ตามหมู่และ อสม. ที่เลือก</small></div>}
      <div className="row g-2 mb-3">
        <div className="col-12 col-md-4"><label htmlFor="work-moo" className="form-label">หมู่บ้าน</label><select id="work-moo" className="form-select" value={selectedMoo} onChange={e => { setMoo(e.target.value); setVhv(''); }}><option value="">ทุกหมู่ที่มีสิทธิ์</option>{moos.map(m => <option key={m} value={m}>หมู่ {m}</option>)}</select></div>
        <div className="col-12 col-md-4"><label htmlFor="work-vhv" className="form-label">อสม.</label><select id="work-vhv" className="form-select" value={selectedVhv} onChange={e => setVhv(e.target.value)}><option value="">ทุกคน</option>{owners.map(name => <option key={name} value={name}>{name}</option>)}</select></div>
        <div className="col-12 col-md-4"><label htmlFor="work-status" className="form-label">สถานะการสำรวจ</label><select id="work-status" className="form-select" value={status} onChange={e => setStatus(e.target.value)}><option value="all">ทั้งหมด</option><option value="pending">งานที่ยังไม่ครบ</option><option value="notStarted">ยังไม่เริ่ม</option><option value="partial">สำรวจบางส่วน</option><option value="complete">สำรวจครบ</option></select></div>
      </div>
      {busy ? <p role="status">กำลังโหลดงานสำรวจ...</p> : error ? <div role="alert" className="alert alert-danger">{error} <button className="btn btn-sm btn-outline-danger" onClick={() => setRetry(v => v + 1)}>ลองอีกครั้ง</button></div> : !moos.length ? <p role="status">ยังไม่มีหมู่บ้านที่ได้รับสิทธิ์ กรุณาติดต่อผู้ดูแล</p> : <>
        <div className="row g-2 mb-3" aria-live="polite">
          {[['ประชากร', totals.people, 'คน'], ['บ้านทั้งหมด', totals.houses, 'หลัง'], ['ยังไม่สำรวจ', totals.pending, 'คน'], ['บ้านที่ยังไม่ครบ', totals.incomplete, 'หลัง']].map(([label, value, unit]) => <div className="col-6 col-lg-3" key={label}><div className="survey-work-stat rounded-3 p-3"><div className="small text-muted">{label}</div><strong className="fs-5">{value.toLocaleString('th-TH')}</strong> <small>{unit}</small></div></div>)}
        </div>
        <div className="d-flex gap-2 flex-wrap mb-3" role="group" aria-label="เลือกสถานะบ้านแบบด่วน">
          {['complete', 'partial', 'notStarted'].map(key => <button
            key={key} type="button" aria-pressed={status === key}
            className={`btn ${status === key ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => { setStatus(key); setPage(1); }}>
            {labels[key]} {houseStatusCounts[key].toLocaleString('th-TH')} หลัง
          </button>)}
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
