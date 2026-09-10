'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { selectAll } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { calculateAge, getBirthYear, MALE_TITLES } from '@/lib/utils';
import TopBar from '@/components/TopBar';
import { populationStatus } from '@/lib/population-status';
import { searchScreeningPeople, maskedScreeningCid } from '@/lib/screening-search';

const KPI_INFO = {
  HEP:  { name:'คัดกรอง HBV/HCV', icon:'fa-virus', color:'#0891b2', desc:'เกิดก่อน พ.ศ.2535' },
  FOBT: { name:'ตรวจ Fit test', icon:'fa-microscope', color:'#d97706', desc:'อายุ 50-70 ปี' },
  HPV:  { name:'คัดกรอง HPV DNA', icon:'fa-dna', color:'#db2777', desc:'สตรี 30-60 ปี' },
  CHILD:{ name:'ประเมินพัฒนาการ', icon:'fa-baby', color:'#059669', desc:'เด็ก 0-5 ปี' }
};

export default function ScreeningPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [currentKPI, setCurrentKPI] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [searchMode, setSearchMode] = useState('auto');
  const [appliedTerm, setAppliedTerm] = useState('');
  const [page, setPage] = useState(1);
  const [loadError, setLoadError] = useState('');
  const requestId = useRef(0);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState('');
  const [screenDate, setScreenDate] = useState(new Date().toISOString().split('T')[0]);
  const [stats, setStats] = useState(null);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [loadedKPI, setLoadedKPI] = useState('');
  const [saving, setSaving] = useState(false);
  const search = useMemo(() => searchScreeningPeople(candidates, appliedTerm, searchMode), [candidates, appliedTerm, searchMode]);
  const searching = searchTerm !== appliedTerm;
  const filtered = search.rows.slice((page-1)*20,page*20);
  const doSearch = () => { setAppliedTerm(searchTerm); setPage(1); };
  useEffect(() => { const timer=setTimeout(()=>setAppliedTerm(searchTerm),250);return ()=>clearTimeout(timer); },[searchTerm]);
  useEffect(() => {
    const query = searchTerm.trim();
    if (currentKPI && query.length >= 2 && loadedKPI !== currentKPI && !loadingCandidates) selectKPI(currentKPI, query);
  }, [searchTerm, currentKPI, loadedKPI, loadingCandidates]);
  useEffect(() => () => { requestId.current += 1; }, []);

  useEffect(() => { if (!loading && !user) router.push('/login'); }, [user, loading, router]);

  const selectKPI = async (type, initialQuery = '') => {
    const request = ++requestId.current;
    setCurrentKPI(type);
    setSelected(null); setSearchTerm(initialQuery); setAppliedTerm(initialQuery); setPage(1); setCandidates([]); setStats(null); setLoadError(''); setLoadedKPI(initialQuery.trim().length >= 2 ? type : '');
    if (initialQuery.trim().length < 2) { setLoadingCandidates(false); return; }
    setLoadingCandidates(true);
    try {
      const screeningColumns = [
        'person_id','cid','title','fname','lname','birth_date','house','moo',
        'residency_type','person_discharge_id','status_model_version',
        'legacy_residency_type','hep_screen','fobt_screen','hpv_screen','child_dev',
        'hep_date','fobt_date','hpv_date','child_date','updated_at'
      ].join(',');
      const rows = await selectAll('population', screeningColumns);
      if (request !== requestId.current) return;
      const cands = [];
      (rows||[]).forEach(r => {
        const state = populationStatus(r);
        if (!state.active) return;
        const t = state.residencyType;
        if (t !== '1' && t !== '3') return;
        const age = calculateAge(r.birth_date);
        const birthYear = getBirthYear(r.birth_date);
        const gender = MALE_TITLES.includes(String(r.title||'').trim()) ? 'male' : 'female';
        let isCandidate = false, status = '-', sDate = '-';
        if (type === 'HEP' && birthYear && birthYear < 1992) { isCandidate = true; status = r.hep_screen || '-'; sDate = r.hep_date || '-'; }
        if (type === 'FOBT' && age !== '-' && age >= 50 && age <= 70) { isCandidate = true; status = r.fobt_screen || '-'; sDate = r.fobt_date || '-'; }
        if (type === 'HPV' && gender === 'female' && age !== '-' && age >= 30 && age <= 60) { isCandidate = true; status = r.hpv_screen || '-'; sDate = r.hpv_date || '-'; }
        if (type === 'CHILD' && age !== '-' && age >= 0 && age <= 5) { isCandidate = true; status = r.child_dev || '-'; sDate = r.child_date || '-'; }
        if (isCandidate) {
          const hasResult = status !== '-' && status !== '' && status !== 'รอผล';
          cands.push({ personId: r.person_id, cid: r.cid||'-', name: (r.title||'')+(r.fname||'')+' '+(r.lname||''), age, house: r.house, moo: r.moo, status, screenDate: sDate, hasResult });
        }
      });
      cands.sort((a,b) => { if (a.hasResult !== b.hasResult) return a.hasResult ? 1 : -1; return String(a.moo).localeCompare(String(b.moo),undefined,{numeric:true}); });
      setCandidates(cands);
      setStats({ total: cands.length, pending: cands.filter(c => !c.hasResult).length, done: cands.filter(c => c.hasResult).length });
    } catch(e) {
      if(request === requestId.current) {
        console.error('Screening list load failed:', e);
        setLoadError('โหลดรายชื่อไม่สำเร็จ กรุณาลองใหม่ หากยังพบปัญหาให้รีเฟรชหน้า');
      }
    }
    finally { if(request === requestId.current)setLoadingCandidates(false); }
  };

  const handleSave = async () => {
    if (!result) { alert('กรุณาเลือกผลการคัดกรอง'); return; }
    setSaving(true);
    // Use only canonical columns that exist in the population table.
    // Sending a legacy *_result column makes PostgREST reject the entire update.
    const colMap = { HEP: { result:'hep_screen', date:'hep_date' }, FOBT: { result:'fobt_screen', date:'fobt_date' }, HPV: { result:'hpv_screen', date:'hpv_date' }, CHILD: { result:'child_dev', date:'child_date' } };
    const cols = colMap[currentKPI];
    const updateData = { updated_at: new Date().toISOString() };
    updateData[cols.result] = result;
    updateData[cols.date] = screenDate;
    const { error } = await supabase.from('population').update(updateData).eq('person_id', selected.personId);
    setSaving(false);
    if (error) { alert('บันทึกไม่สำเร็จ: ' + error.message); }
    else { alert('บันทึกสำเร็จ'); setSelected(null); setSearchTerm(''); setAppliedTerm(''); selectKPI(currentKPI); }
  };

  if (loading || !user) return <div className="text-center py-5"><span className="spinner-border text-primary"/></div>;

  return (
    <>
      <TopBar />
      <div className="container survey-page py-3" style={{maxWidth:900}}>
        <h5 className="text-center mb-3 fw-bold" style={{color:'var(--primary)'}}><i className="fa-solid fa-clipboard-check"/> บันทึกผลการคัดกรอง</h5>

        <div className="d-flex gap-2 mb-3">
          <a href="/" className="btn btn-outline-primary btn-sm flex-fill rounded-pill"><i className="fa-solid fa-magnifying-glass"/> สำรวจ</a>
          <a href="/dashboard" className="btn btn-outline-primary btn-sm flex-fill rounded-pill"><i className="fa-solid fa-chart-line"/> Dashboard</a>
          <span className="btn btn-sm flex-fill rounded-pill text-white" style={{background:'var(--primary)'}}><i className="fa-solid fa-clipboard-check"/> คัดกรอง</span>
        </div>

        {/* KPI Buttons */}
        <div className="card border-0 shadow-sm mb-3 p-3" style={{borderRadius:14}}>
          <div className="row g-2">
            {Object.entries(KPI_INFO).map(([key, info]) => (
              <div className="col-6 col-md-3" key={key}>
                <button disabled={saving} onClick={() => selectKPI(key)} className={`btn btn-sm w-100 kpi-btn ${currentKPI === key ? `btn-${key==='HEP'?'info':key==='FOBT'?'warning':key==='HPV'?'danger':'success'} active` : `btn-outline-${key==='HEP'?'info':key==='FOBT'?'warning':key==='HPV'?'danger':'success'}`}`}>
                  <i className={`fa-solid ${info.icon} fa-lg mb-1 d-block`}/><small className="fw-bold">{info.name.split(' ').pop()}</small>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Search & Results */}
        {currentKPI && (
          <div className="card shadow-sm border-0 fade-in" style={{borderRadius:14}}>
            <div className="card-header text-white py-3" style={{background:'var(--primary)'}}>
              <h6 className="mb-0 fw-bold"><i className={`fa-solid ${KPI_INFO[currentKPI].icon} me-2`}/>{KPI_INFO[currentKPI].name} <small className="d-block opacity-75" style={{fontSize:'.75rem'}}>{KPI_INFO[currentKPI].desc}</small></h6>
            </div>
            <div className="card-body p-3 p-md-4">
              {!selected ? (
                <>
                  <form onSubmit={e=>{e.preventDefault();doSearch();}} className="mb-3">
                    <div className="row g-2">
                      <div className="col-12 col-md-4"><label htmlFor="screening-search-mode" className="form-label">ค้นหาด้วย</label><select id="screening-search-mode" className="form-select" value={searchMode} onChange={e=>{setSearchMode(e.target.value);setPage(1);}}><option value="auto">ชื่อ / เลขบัตร / บ้านเลขที่</option><option value="name">ชื่อ–นามสกุล</option><option value="cid">เลขบัตรประชาชน</option><option value="house">บ้านเลขที่</option></select></div>
                      <div className="col-12 col-md-8"><label htmlFor="screening-search" className="form-label">คำค้น</label><input id="screening-search" type="text" inputMode={searchMode==='cid'?'numeric':'text'} autoComplete="off" className="form-control" placeholder={searchMode==='cid'?'เลขบัตร 4–13 หลัก':'ชื่อ นามสกุล เลขบัตร หรือบ้านเลขที่'} value={searchTerm} onChange={e=>{setSearchTerm(e.target.value);setPage(1);}} aria-describedby="screening-search-help" /></div>
                    </div>
                    <div className="d-flex gap-2 mt-2"><button className="btn btn-primary" type="submit" disabled={loadingCandidates || !!loadError}>ค้นหา</button><button className="btn btn-outline-secondary" type="button" disabled={!searchTerm} onClick={()=>{setSearchTerm('');setAppliedTerm('');setPage(1);}}>ล้างคำค้น</button></div>
                    <p id="screening-search-help" className="small text-muted mt-2 mb-0">ชื่อค้นบางส่วนได้ รองรับเลขไทยและเลขบัตรที่มีขีดหรือช่องว่าง เลขบัตรครบ 13 หลักจะค้นตรงทั้งเลข • ค้นเฉพาะกลุ่มเป้าหมาย {KPI_INFO[currentKPI].name} ตามเกณฑ์เดิม</p>
                  </form>
                  {loadingCandidates && <div className="text-center py-3" role="status"><span className="spinner-border text-primary"/> กำลังโหลดรายชื่อ...</div>}
                  {loadError && <div className="alert alert-danger" role="alert">{loadError} <button className="btn btn-outline-danger ms-2" onClick={()=>selectKPI(currentKPI)}>ลองใหม่</button></div>}
                  {!loadingCandidates && !loadError && <p role="status" aria-live="polite" className="small text-muted">{searching?'กำลังค้นหา...':!search.ready?search.message:search.rows.length?`พบ ${search.rows.length.toLocaleString('th-TH')} คน • หน้า ${page} / ${Math.ceil(search.rows.length/20)}`:'ไม่พบรายชื่อในกลุ่มคัดกรองนี้ กรุณาตรวจคำค้นหรือเลือกประเภทคัดกรองให้ตรงกับผู้รับบริการ'}</p>}
                  {!loadingCandidates && !loadError && !searching && filtered.length > 0 && (
                    <div className="row g-2">
                      {filtered.map((p,i) => {
                        const sc = p.hasResult ? (['ปกติ','ผ่าน','สมวัย'].includes(p.status) ? 'success' : 'danger') : 'warning';
                        return (
                          <div className="col-md-6" key={p.personId}>
                            <button type="button" className={`card border-${sc} search-result-card w-100 text-start p-0`} aria-label={`เลือก ${p.name} บ้าน ${p.house} หมู่ ${p.moo} เลขบัตรลงท้าย ${String(p.cid).slice(-4)}`} onClick={() => { setSelected(p); setResult(p.hasResult ? p.status : ''); }}>
                              <div className="card-body p-3">
                                <div className="d-flex justify-content-between">
                                  <div>
                                    <div className="fw-bold mb-1">{p.name}</div>
                                    <small className="text-muted">อายุ {p.age} | บ้าน {p.house} ม.{p.moo}</small>
                                    <div className="small text-muted mt-1">เลขบัตร {maskedScreeningCid(p.cid)}</div>
                                  </div>
                                  <div className="text-center ms-2">
                                    <i className={`fa-solid fa-${sc==='warning'?'clock':'check-circle'} fa-2x text-${sc}`}/>
                                    <div className="small mt-1">{p.hasResult ? p.status : 'รอผล'}</div>
                                  </div>
                                </div>
                              </div>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {!loadingCandidates && !loadError && !searching && search.rows.length>20 && <nav aria-label="หน้าผลค้นหา" className="d-flex justify-content-between mt-3"><button className="btn btn-outline-primary" disabled={page===1} onClick={()=>setPage(p=>p-1)}>ก่อนหน้า</button><button className="btn btn-outline-primary" disabled={page*20>=search.rows.length} onClick={()=>setPage(p=>p+1)}>ถัดไป</button></nav>}
                </>
              ) : (
                <div className="card border-primary" style={{borderRadius:12}}>
                  <div className="card-header text-white" style={{background:'var(--primary)'}}><h6 className="mb-0 fw-bold"><i className="fa-solid fa-user-check me-1"/> ข้อมูลผู้รับการคัดกรอง</h6></div>
                  <div className="card-body">
                    <div className="row mb-3">
                      <div className="col-md-4"><label className="text-muted small">ชื่อ-นามสกุล</label><div className="fw-bold">{selected.name}</div></div>
                      <div className="col-md-4"><label className="text-muted small">อายุ</label><div className="fw-bold">{selected.age} ปี</div></div>
                      <div className="col-md-4"><label className="text-muted small">ที่อยู่</label><div className="fw-bold">บ้าน {selected.house} ม.{selected.moo}</div></div>
                    </div>
                    <p className="small mb-3">เลขบัตรประชาชน <strong>{selected.cid}</strong> • ตรวจสอบชื่อและเลขบัตรก่อนบันทึกผล</p>
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label fw-bold"><i className="fa-solid fa-clipboard-check"/> ผลการคัดกรอง *</label>
                        <select className="form-select form-select-lg" value={result} onChange={e => setResult(e.target.value)}>
                          <option value="">-- เลือกผล --</option>
                          {currentKPI === 'CHILD' ? <><option value="สมวัย">✅ สมวัย</option><option value="ไม่สมวัย">⚠️ ไม่สมวัย</option></> : <><option value="ปกติ">✅ ปกติ</option><option value="ผิดปกติ">⚠️ ผิดปกติ</option></>}
                        </select>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-bold"><i className="fa-solid fa-calendar"/> วันที่คัดกรอง</label>
                        <input type="date" className="form-control form-control-lg" value={screenDate} onChange={e => setScreenDate(e.target.value)} />
                      </div>
                    </div>
                    <div className="d-flex gap-2 mt-4 justify-content-end">
                      <button className="btn btn-secondary rounded-pill" disabled={saving} onClick={() => setSelected(null)}><i className="fa-solid fa-arrow-left me-1"/> กลับ</button>
                      <button className="btn btn-success btn-lg rounded-pill px-4" onClick={handleSave} disabled={saving}>
                        {saving ? <><span className="spinner-border spinner-border-sm me-1"/>บันทึก...</> : <><i className="fa-solid fa-save me-1"/> บันทึกผล</>}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Stats */}
              {stats && (
                <div className="row text-center g-2 mt-4">
                  {[{label:'เป้าหมาย',val:stats.total,color:KPI_INFO[currentKPI]?.color},{label:'ตรวจแล้ว',val:stats.done,color:'#059669'},{label:'รอดำเนินการ',val:stats.pending,color:'#dc3545'},{label:'ความสำเร็จ',val:pct(stats.done,stats.total)+'%',color:'#1a237e'}].map(({label,val,color}) => (
                    <div className="col-6 col-md-3" key={label}>
                      <div className="card border-0 shadow-sm p-2" style={{borderLeft:`3px solid ${color}`}}><h5 className="mb-0 fw-bold" style={{color}}>{val}</h5><small className="text-muted">{label}</small></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function pct(n,d) { return d > 0 ? (n/d*100).toFixed(1) : '0.0'; }
