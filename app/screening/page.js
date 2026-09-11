'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { calculateAge } from '@/lib/utils';
import { createScreeningSaver, screeningToday } from '@/lib/screening-save';
import { ScreeningHistory, ScreeningOverview } from '@/components/ScreeningWorkflow';
import TopBar from '@/components/TopBar';

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
  const [screenDate, setScreenDate] = useState(screeningToday);
  const [stats, setStats] = useState(null);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveMessage,setSaveMessage]=useState('');
  const saveRef=useRef(null); const saveLock=useRef(false);
  if(!saveRef.current) saveRef.current=createScreeningSaver(supabase);
  const search = useMemo(() => searchScreeningPeople([], appliedTerm, searchMode), [appliedTerm, searchMode]);
  const searching = searchTerm !== appliedTerm;
  const filtered = candidates;
  const doSearch = () => { setAppliedTerm(searchTerm); setPage(1); setRetry(n=>n+1); };
  useEffect(() => { const timer=setTimeout(()=>setAppliedTerm(searchTerm),300);return ()=>clearTimeout(timer); },[searchTerm]);
  useEffect(() => { if (!loading && !user) router.push('/login'); }, [user, loading, router]);
  const selectKPI = type => {
    requestId.current += 1;
    setCurrentKPI(type); setSelected(null); setSearchTerm(''); setAppliedTerm('');
    setPage(1); setCandidates([]); setStats(null); setLoadError('');
  };
  useEffect(() => {
    const request=++requestId.current;
    const controller=new AbortController();
    setCandidates([]); setStats(null); setLoadError(''); setLoadingCandidates(false);
    if (!user || !currentKPI || searching || !search.ready) return;
    setLoadingCandidates(true);
    (async()=>{
      try {
        const {data,error}=await supabase.rpc('screening_search', {
          p_kpi:currentKPI,p_query:appliedTerm,p_mode:searchMode,p_page:page
        }).abortSignal(controller.signal);
        if (request!==requestId.current || controller.signal.aborted) return;
        if(error) throw error;
        setCandidates((data.rows||[]).map(r=>({
          personId:r.person_id,cid:r.cid||'-',name:(r.title||'')+(r.fname||'')+' '+(r.lname||''),
          age:calculateAge(r.birth_date),house:r.house,moo:r.moo,status:r.screen_result||'-',
          screenDate:r.screen_date||'-',hasResult:!['','-','รอผล'].includes(r.screen_result||'')
        })));
        setStats({total:data.total,done:data.done,pending:data.total-data.done});
      } catch(e) {
        if(request===requestId.current && !controller.signal.aborted) {
          setLoadError('ค้นหาไม่สำเร็จ กรุณาลองใหม่');
        }
      } finally { if(request===requestId.current)setLoadingCandidates(false); }
    })();
    return ()=>{controller.abort();requestId.current+=1;};
  },[user,currentKPI,appliedTerm,searchMode,page,retry,searching,search.ready]);

  const handleSave = async () => {
    if(saveLock.current) return; saveLock.current=true;
    setSaving(true); setSaveMessage('');
    try {
      const row=await saveRef.current({personId:selected?.personId,type:currentKPI,result,date:screenDate});
      if(!row) return;
      setSelected(p=>({...p,status:result,screenDate,hasResult:true}));
      setRetry(n=>n+1);
      setSaveMessage('บันทึกสำเร็จ และตรวจสอบผลกับวันที่จากฐานข้อมูลแล้ว');
    } catch(e) { setSaveMessage(e.message || 'บันทึกไม่สำเร็จ ข้อมูลที่กรอกยังอยู่ กรุณาลองใหม่'); }
    finally { saveLock.current=false; setSaving(false); }
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

        {currentKPI && <ScreeningOverview key={currentKPI} kpi={currentKPI} refresh={retry}/>}
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
                    <div className="d-flex gap-2 mt-2"><button className="btn btn-primary" type="submit" disabled={loadingCandidates}>ค้นหา</button><button className="btn btn-outline-secondary" type="button" disabled={!searchTerm} onClick={()=>{setSearchTerm('');setAppliedTerm('');setPage(1);}}>ล้างคำค้น</button></div>
                    <p id="screening-search-help" className="small text-muted mt-2 mb-0">ชื่อค้นบางส่วนได้ รองรับเลขไทยและเลขบัตรที่มีขีดหรือช่องว่าง เลขบัตรครบ 13 หลักจะค้นตรงทั้งเลข • ค้นเฉพาะกลุ่มเป้าหมาย {KPI_INFO[currentKPI].name} ตามเกณฑ์เดิม</p>
                  </form>
                  {loadingCandidates && <div className="text-center py-3" role="status"><span className="spinner-border text-primary"/> กำลังโหลดรายชื่อ...</div>}
                  {loadError && <div className="alert alert-danger" role="alert">{loadError} <button className="btn btn-outline-danger ms-2" onClick={()=>setRetry(n=>n+1)}>ลองใหม่</button></div>}
                  {!loadingCandidates && !loadError && <p role="status" aria-live="polite" className="small text-muted">{searching?'กำลังค้นหา...':!search.ready?search.message:stats?.total?`พบ ${stats.total.toLocaleString('th-TH')} คน • หน้า ${page} / ${Math.ceil(stats.total/20)}`:'ไม่พบรายชื่อในกลุ่มคัดกรองนี้ กรุณาตรวจคำค้นหรือเลือกประเภทคัดกรองให้ตรงกับผู้รับบริการ'}</p>}
                  {!loadingCandidates && !loadError && !searching && filtered.length > 0 && (
                    <div className="row g-2">
                      {filtered.map((p,i) => {
                        const sc = p.hasResult ? (['ปกติ','ผ่าน','สมวัย'].includes(p.status) ? 'success' : 'danger') : 'warning';
                        return (
                          <div className="col-md-6" key={p.personId}>
                            <button type="button" className={`card border-${sc} search-result-card w-100 text-start p-0`} aria-label={`เลือก ${p.name} บ้าน ${p.house} หมู่ ${p.moo} เลขบัตรลงท้าย ${String(p.cid).slice(-4)}`} onClick={() => { setSelected(p); setResult(p.hasResult ? p.status : ''); setScreenDate(p.screenDate && p.screenDate!=='-' ? p.screenDate : screeningToday()); setSaveMessage(''); }}>
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
                  {!loadingCandidates && !loadError && !searching && stats?.total>20 && <nav aria-label="หน้าผลค้นหา" className="d-flex justify-content-between mt-3"><button className="btn btn-outline-primary" disabled={page===1} onClick={()=>setPage(p=>p-1)}>ก่อนหน้า</button><button className="btn btn-outline-primary" disabled={page*20>=stats.total} onClick={()=>setPage(p=>p+1)}>ถัดไป</button></nav>}
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
                        <select className="form-select form-select-lg" disabled={saving} value={result} onChange={e => setResult(e.target.value)}>
                          <option value="">-- เลือกผล --</option>
                          {currentKPI === 'CHILD' ? <><option value="สมวัย">✅ สมวัย</option><option value="ไม่สมวัย">⚠️ ไม่สมวัย</option></> : <><option value="ปกติ">✅ ปกติ</option><option value="ผิดปกติ">⚠️ ผิดปกติ</option></>}
                        </select>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-bold"><i className="fa-solid fa-calendar"/> วันที่คัดกรอง</label>
                        <input type="date" max={screeningToday()} disabled={saving} className="form-control form-control-lg" value={screenDate} onChange={e => setScreenDate(e.target.value)} />
                      </div>
                    </div>
                    {saveMessage && <div className="alert alert-info mt-3" role="status">{saveMessage}</div>}<div className="d-flex gap-2 mt-4 justify-content-end">
                      <button className="btn btn-secondary rounded-pill" disabled={saving} onClick={() => setSelected(null)}><i className="fa-solid fa-arrow-left me-1"/> กลับ</button>
                      <button className="btn btn-success btn-lg rounded-pill px-4" onClick={handleSave} disabled={saving}>
                        {saving ? <><span className="spinner-border spinner-border-sm me-1"/>บันทึก...</> : <><i className="fa-solid fa-save me-1"/> บันทึกผล</>}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {selected && <ScreeningHistory key={selected.personId+currentKPI} personId={selected.personId} kpi={currentKPI} refresh={retry}/>}
              {/* Stats */}
              {stats && (
                <div className="row text-center g-2 mt-4">
                  {[{label:'พบตามคำค้น',val:stats.total,color:KPI_INFO[currentKPI]?.color},{label:'ตรวจแล้วในผลค้นหา',val:stats.done,color:'#059669'},{label:'รอผลในผลค้นหา',val:stats.pending,color:'#dc3545'},{label:'ความสำเร็จ',val:pct(stats.done,stats.total)+'%',color:'#1a237e'}].map(({label,val,color}) => (
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
