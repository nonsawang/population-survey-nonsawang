'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { RESIDENCY_TYPES, DISCHARGE_TYPES } from '@/lib/population-status';
import { ScreeningReview } from '@/components/ScreeningWorkflow';
import TopBar from '@/components/TopBar';
import AuthenReportImport from '@/components/AuthenReportImport';

const STATES = {
  ready: 'พร้อมตรวจอนุมัติ', approved: 'อนุมัติแล้ว / รอส่ง', no_change: 'ข้อมูลตรงกัน',
  invalid_cid: 'เลขบัตรไม่ถูกต้อง', duplicate: 'เลขบัตรซ้ำ', id_conflict: 'รหัสบุคคลขัดกัน',
  unmatched: 'ไม่พบใน HOSxP', needs_review: 'สถานะต้นทางไม่ครบ', stale_snapshot: 'ข้อมูล HOSxP เกิน 24 ชม.', no_snapshot: 'ยังไม่มีข้อมูล HOSxP',
};
const typeLabel = code => RESIDENCY_TYPES.find(v => v.code === String(code)) ? `${code} — ${RESIDENCY_TYPES.find(v => v.code === String(code)).label}` : 'ไม่ระบุ';
const dischargeLabel = code => DISCHARGE_TYPES.find(v => v.code === String(code)) ? `${code} — ${DISCHARGE_TYPES.find(v => v.code === String(code)).label}` : 'ไม่ระบุ';
const formatTime = value => value ? new Date(value).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) : '-';

export default function HosxpReviewPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const allowed = ['staff', 'admin'].includes(user?.role);
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [expires, setExpires] = useState('');
  const [opening, setOpening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState([]);
  const [filters, setFilters] = useState({ moo: '', search: '', status: 'ready', page: 1 });
  const [searchDraft, setSearchDraft] = useState('');
  const [refresh, setRefresh] = useState(0);
  const identity = user?.userId || user?.username;
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  useEffect(() => { setToken(''); setData(null); setPassword(''); setSelected([]); }, [identity]);
  useEffect(() => { if (!loading && !user) router.push('/login'); }, [loading, user, router]);

  const handleError = useCallback(err => {
    if (String(err?.message).includes('REVIEW_SESSION_EXPIRED')) {
      setToken(''); setData(null); setError('หมดเวลาตรวจสอบ กรุณายืนยันรหัสผ่านอีกครั้ง');
    } else if (String(err?.message).includes('REVIEW_CHANGED_REFRESH')) {
      setError('ข้อมูลเปลี่ยนระหว่างตรวจสอบ กรุณาโหลดข้อมูลใหม่และตรวจอีกครั้ง'); setRefresh(v => v + 1);
    } else {
      setError('ดำเนินการไม่สำเร็จ กรุณาลองใหม่ หากยังพบปัญหาให้ผู้ดูแลตรวจการติดตั้งหน้าตรวจสอบ HOSxP');
    }
  }, []);

  useEffect(() => {
    if (!token || !allowed) return;
    let cancelled = false;
    setBusy(true); setError(''); setSelected([]); setData(null);
    supabase.rpc('hosxp_review_list', { p_token: token, p_moo: filters.moo, p_search: filters.search, p_status: filters.status, p_page: filters.page })
      .then(({ data: result, error: queryError }) => {
        if (cancelled) return;
        if (queryError) handleError(queryError); else setData(result);
      }).catch(err => { if (!cancelled) handleError(err); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [token, allowed, filters, refresh, handleError]);

  async function openSession(event) {
    event.preventDefault(); if (!password || opening) return;
    const forIdentity = identity;
    setOpening(true); setError('');
    try {
      const { data: result, error: loginError } = await supabase.rpc('hosxp_review_open_session', { p_username: user.username, p_password: password });
      if (currentIdentity.current !== forIdentity) return;
      if (loginError) handleError(loginError);
      else if (result?.error) setError(result.error);
      else if (result?.token) { setToken(result.token); setExpires(result.expires_at); setNotice(''); }
      else setError('ไม่สามารถยืนยันสิทธิ์ได้');
    } catch (err) { if (currentIdentity.current === forIdentity) handleError(err); }
    finally { setPassword(''); setOpening(false); }
  }

  const rows = data?.rows || [];
  const readyRows = rows.filter(row => row.status === 'ready');
  const changeFilters = changes => { setSelected([]); setNotice(''); setFilters(f => ({ ...f, ...changes, page: 1 })); };
  async function approve() {
    const items = rows.filter(row => selected.includes(row.population_id) && row.status === 'ready')
      .map(row => ({ population_id: row.population_id, fingerprint: row.fingerprint, batch_id: row.batch_id }));
    if (!items.length || saving || !window.confirm(`อนุมัติ ${items.length} รายการเป็นคิวรอส่ง? ขั้นตอนนี้ยังไม่เขียนข้อมูลเข้า HOSxP`)) return;
    setSaving(true); setError('');
    try {
      const { data: result, error: saveError } = await supabase.rpc('hosxp_review_approve', { p_token: token, p_items: items });
      if (saveError) handleError(saveError);
      else { setNotice(`อนุมัติ ${result.approved} รายการแล้ว — อยู่ในคิวรอส่ง ยังไม่เขียนเข้า HOSxP`); setSelected([]); setRefresh(v => v + 1); }
    } catch (err) { handleError(err); }
    finally { setSaving(false); }
  }

  if (loading) return <p className="text-center p-5" role="status">กำลังตรวจสิทธิ์...</p>;
  if (!user) return null;
  return <><TopBar showAdmin /><main className="container survey-page py-4">{allowed && <><AuthenReportImport key={identity}/><ScreeningReview/></>}
    <header className="survey-heading"><div><p className="survey-eyebrow">สำหรับเจ้าหน้าที่</p><h1>ตรวจสอบก่อนส่ง HOSxP</h1><p>จับคู่บุคคล ตรวจค่าเดิม–ใหม่ และอนุมัติรายการรอส่ง</p></div><a href="/" className="btn btn-outline-secondary">กลับหน้าสำรวจ</a></header>
    {!allowed ? <div className="alert alert-warning">หน้านี้สำหรับเจ้าหน้าที่และผู้ดูแลระบบ</div> : <>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {notice && <div className="alert alert-success" role="status">{notice}</div>}
      {!token ? <form className="card border-0 shadow-sm p-4 review-signin" onSubmit={openSession}>
        <h2 className="h5 fw-bold">ยืนยันสิทธิ์ผู้ตรวจสอบ</h2><p className="text-muted">บัญชี {user.username} • ใช้รหัสผ่านเดียวกับการเข้าสู่ระบบเจ้าหน้าที่</p>
        <label htmlFor="review-password" className="form-label">รหัสผ่านเจ้าหน้าที่</label><input id="review-password" type="password" autoComplete="current-password" className="form-control" required value={password} onChange={e => setPassword(e.target.value)} disabled={opening} />
        <button type="submit" className="btn btn-primary mt-3" disabled={opening || !password}>{opening ? 'กำลังยืนยัน...' : 'เริ่มตรวจสอบ'}</button><p className="small text-muted mt-3 mb-0">สิทธิ์ตรวจสอบมีอายุ 30 นาที ระบบไม่เก็บรหัสผ่านในเบราว์เซอร์</p>
      </form> : <>
        <div className="review-source-bar"><div><strong>ข้อมูลอ้างอิง HOSxP</strong><div className="small">{data?.snapshot ? `${data.snapshot.source_name} • อ่านเมื่อ ${formatTime(data.snapshot.captured_at)}` : busy ? 'กำลังโหลด...' : 'ยังไม่มีชุดข้อมูลอ้างอิง'}</div><div className="small text-muted">เปรียบเทียบกับชุดข้อมูล ณ เวลาที่ระบุ ไม่ใช่ข้อมูลสด • ต้องอ่านข้อมูลใหม่เมื่อเกิน 24 ชั่วโมง</div></div><button className="btn btn-outline-primary" disabled={busy || saving} onClick={() => setRefresh(v => v + 1)}>โหลดรายการใหม่</button></div>
        <p className="small text-muted">สิทธิ์ตรวจสอบถึง {formatTime(expires)} • การอนุมัติยังไม่ส่งข้อมูลเข้า HOSxP</p>
        <form className="card border-0 shadow-sm p-3 mb-3" onSubmit={event => { event.preventDefault(); changeFilters({ search: searchDraft.trim() }); }}>
          <div className="row g-3"><div className="col-12 col-md-3"><label htmlFor="review-moo" className="form-label">หมู่บ้าน</label><select id="review-moo" className="form-select" value={filters.moo} disabled={saving} onChange={e => changeFilters({ moo: e.target.value })}><option value="">ทุกหมู่</option>{(data?.villages || (filters.moo ? [filters.moo] : [])).map(m => <option key={m} value={m}>หมู่ {m}</option>)}</select></div>
          <div className="col-12 col-md-4"><label htmlFor="review-status" className="form-label">ผลตรวจสอบ</label><select id="review-status" className="form-select" value={filters.status} disabled={saving} onChange={e => changeFilters({ status: e.target.value })}><option value="all">ทั้งหมด</option>{Object.entries(STATES).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></div>
          <div className="col-12 col-md-5"><label htmlFor="review-search" className="form-label">ชื่อ เลขบัตร หรือรหัสบุคคล</label><div className="input-group"><input id="review-search" className="form-control" value={searchDraft} onChange={e => setSearchDraft(e.target.value)} disabled={saving} /><button className="btn btn-outline-primary" disabled={saving}>ค้นหา</button></div></div></div>
        </form>
        {busy ? <p className="p-4 text-center" role="status">กำลังจับคู่และเปรียบเทียบข้อมูล...</p> : data && <>
          <div className="review-metrics mb-3" aria-live="polite">{[['ready','พร้อมตรวจ'],['approved','อนุมัติ / รอส่ง'],['no_change','ข้อมูลตรงกัน']].map(([key,label]) => <div key={key}><span className="small text-muted">{label}</span><strong>{(data.counts?.[key] || 0).toLocaleString('th-TH')}</strong></div>)}</div>
          <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap mb-3"><label className="staff-pending-toggle"><input type="checkbox" checked={readyRows.length>0 && readyRows.every(row => selected.includes(row.population_id))} disabled={!readyRows.length || saving} onChange={e => setSelected(e.target.checked ? readyRows.map(row => row.population_id) : [])} /> เลือกที่พร้อมอนุมัติในหน้านี้</label><button className="btn btn-primary" disabled={!selected.length || saving} onClick={approve}>{saving ? 'กำลังบันทึก...' : `อนุมัติ ${selected.length} รายการ`}</button></div>
          <p className="small text-muted">เลขบัตรต้องถูกต้องและจับคู่ได้เพียงคนเดียว รหัสบุคคลเดิมต้องไม่ชี้ไปยังคนอื่น • ประเภทอยู่อาศัยที่เว้นว่างในรายการเสียชีวิตจะคงค่า HOSxP ไว้</p>
          {!rows.length ? <div className="card border-0 p-4 text-center" role="status">ไม่พบรายการตามเงื่อนไขที่เลือก</div> : <div className="card border-0 shadow-sm p-3"><div className="table-responsive survey-work-table review-table"><table className="table align-middle"><caption>พบ {data.total.toLocaleString('th-TH')} รายการ • หน้า {filters.page} / {Math.max(1, Math.ceil(data.total/25))}</caption><thead><tr><th scope="col">เลือก / บุคคล</th><th scope="col">รหัสจับคู่</th><th scope="col">เดิมใน HOSxP</th><th scope="col">ข้อมูลสำรวจใหม่</th><th scope="col">ผลตรวจ</th></tr></thead><tbody>{rows.map(row => <tr key={row.population_id}>
            <td data-label="บุคคล"><div><label className="review-person"><input type="checkbox" aria-label={`เลือกรายการ ${row.name}`} disabled={row.status!=='ready' || saving} checked={selected.includes(row.population_id)} onChange={e => setSelected(ids => e.target.checked ? [...ids,row.population_id] : ids.filter(id => id!==row.population_id))} /><strong>{row.name}</strong></label><div className="small text-muted">{row.cid_masked}</div><div className="small">ม.{row.moo} บ้าน {row.house || '-'}</div></div></td>
            <td data-label="รหัสจับคู่"><div><div className="small">สำรวจ: {row.population_id}</div><div className="small">HOSxP: {row.target_id || 'ยังจับคู่ไม่ได้'}</div></div></td>
            <td data-label="เดิม HOSxP"><div>{row.target_id ? <><div className="review-field"><small>ประเภทอยู่อาศัย</small>{typeLabel(row.old_type)}</div><div className="review-field"><small>สถานะจำหน่าย</small>{dischargeLabel(row.old_discharge)}</div></> : '—'}</div></td>
            <td data-label="สำรวจใหม่"><div><div className={`review-field ${row.changes?.house_regist_type_id !== undefined ? 'review-changed' : ''}`}><small>ประเภทอยู่อาศัย</small>{row.new_type ? typeLabel(row.new_type) : row.new_discharge==='1' ? 'คงค่าเดิมใน HOSxP' : 'ยังไม่ระบุ'}</div><div className={`review-field ${row.changes?.person_discharge_id !== undefined ? 'review-changed' : ''}`}><small>สถานะจำหน่าย</small>{dischargeLabel(row.new_discharge)}</div></div></td>
            <td data-label="ผลตรวจ"><div><span className={`badge ${row.status==='ready' ? 'bg-primary' : row.status==='approved' ? 'bg-success' : 'bg-secondary'}`}>{STATES[row.status]}</span>{row.approved_at && <div className="small mt-2">{formatTime(row.approved_at)}</div>}</div></td>
          </tr>)}</tbody></table></div></div>}
          <div className="d-flex justify-content-between align-items-center gap-2 mt-3"><button className="btn btn-outline-secondary" disabled={filters.page===1 || saving} onClick={() => setFilters(f => ({...f,page:f.page-1}))}>ก่อนหน้า</button><span className="small">เลือกได้ครั้งละ 25 รายการ</span><button className="btn btn-outline-secondary" disabled={filters.page*25>=data.total || saving} onClick={() => setFilters(f => ({...f,page:f.page+1}))}>ถัดไป</button></div>
        </>}
      </>}
    </>}
  </main></>;
}
