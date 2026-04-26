'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { selectAll } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { calculateAge, getBirthYear, MALE_TITLES } from '@/lib/utils';
import TopBar from '@/components/TopBar';

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
  const [filtered, setFiltered] = useState([]);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState('');
  const [screenDate, setScreenDate] = useState(new Date().toISOString().split('T')[0]);
  const [stats, setStats] = useState(null);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!loading && !user) router.push('/login'); }, [user, loading, router]);

  const selectKPI = async (type) => {
    setCurrentKPI(type);
    setSelected(null); setSearchTerm(''); setFiltered([]);
    setLoadingCandidates(true);
    try {
      const rows = await selectAll('population');
      const cands = [];
      (rows||[]).forEach(r => {
        const t = String(r.residency_type||'').trim();
        if (t !== '1' && t !== '3') return;
        const age = calculateAge(r.birth_date);
        const birthYear = getBirthYear(r.birth_date);
        const gender = MALE_TITLES.includes(String(r.title||'').trim()) ? 'male' : 'female';
        let isCandidate = false, status = '-', sDate = '-';
        if (type === 'HEP' && birthYear && birthYear < 1992) { isCandidate = true; status = r.hep_screen || r.hep_result || '-'; sDate = r.hep_date || '-'; }
        if (type === 'FOBT' && age !== '-' && age >= 50 && age <= 70) { isCandidate = true; status = r.fobt_screen || r.fobt_result || '-'; sDate = r.fobt_date || '-'; }
        if (type === 'HPV' && gender === 'female' && age !== '-' && age >= 30 && age <= 60) { isCandidate = true; status = r.hpv_screen || r.hpv_result || '-'; sDate = r.hpv_date || '-'; }
        if (type === 'CHILD' && age !== '-' && age >= 0 && age <= 5) { isCandidate = true; status = r.child_dev || r.child_dev_result || '-'; sDate = r.child_date || '-'; }
        if (isCandidate) {
          const hasResult = status !== '-' && status !== '' && status !== 'รอผล';
          cands.push({ personId: r.person_id, cid: r.cid||'-', name: (r.title||'')+(r.fname||'')+' '+(r.lname||''), age, house: r.house, moo: r.moo, status, screenDate: sDate, hasResult });
        }
      });
      cands.sort((a,b) => { if (a.hasResult !== b.hasResult) return a.hasResult ? 1 : -1; return String(a.moo).localeCompare(String(b.moo),undefined,{numeric:true}); });
      setCandidates(cands);
      setStats({ total: cands.length, pending: cands.filter(c => !c.hasResult).length, done: cands.filter(c => c.hasResult).length });
    } catch(e) { console.error(e); }
    setLoadingCandidates(false);
  };

  const doSearch = () => {
    if (!searchTerm.trim()) { setFiltered([]); return; }
    const q = searchTerm.toLowerCase().replace(/\s+/g,'');
    setFiltered(candidates.filter(p => {
      const name = (p.name||'').toLowerCase().replace(/\s+/g,'');
      return name.includes(q) || (p.house||'').includes(q) || (p.cid||'').replace(/\D/g,'').includes(q.replace(/\D/g,''));
    }));
  };

  useEffect(() => { if (searchTerm.length >= 2) { const t = setTimeout(doSearch, 300); return () => clearTimeout(t); } else setFiltered([]); }, [searchTerm]);

  const handleSave = async () => {
    if (!result) { alert('กรุณาเลือกผลการคัดกรอง'); return; }
    setSaving(true);
    const colMap = { HEP: { result:'hep_screen', date:'hep_date', alt:'hep_result' }, FOBT: { result:'fobt_screen', date:'fobt_date', alt:'fobt_result' }, HPV: { result:'hpv_screen', date:'hpv_date', alt:'hpv_result' }, CHILD: { result:'child_dev', date:'child_date', alt:'child_dev_result' } };
    const cols = colMap[currentKPI];
    const updateData = { updated_at: new Date().toISOString() };
    updateData[cols.result] = result;
    updateData[cols.date] = screenDate;
    updateData[cols.alt] = result;
    const { error } = await supabase.from('population').update(updateData).eq('person_id', selected.personId);
    setSaving(false);
    if (error) { alert('บันทึกไม่สำเร็จ: ' + error.message); }
    else { alert('บันทึกสำเร็จ'); setSelected(null); setSearchTerm(''); setFiltered([]); selectKPI(currentKPI); }
  };

  if (loading || !user) return <div className="text-center py-5"><span className="spinner-border text-primary"/></div>;

  return (
    <>
      <TopBar />
      <div className="container py-3" style={{maxWidth:900}}>
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
                <button onClick={() => selectKPI(key)} className={`btn btn-sm w-100 kpi-btn ${currentKPI === key ? `btn-${key==='HEP'?'info':key==='FOBT'?'warning':key==='HPV'?'danger':'success'} active` : `btn-outline-${key==='HEP'?'info':key==='FOBT'?'warning':key==='HPV'?'danger':'success'}`}`}>
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
                  <div className="input-group input-group-lg mb-3">
                    <input type="text" className="form-control" placeholder="พิมพ์ชื่อ, เลขบัตร, บ้านเลขที่..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onKeyDown={e => e.key === 'Enter' && doSearch()} />
                    <button className="btn btn-primary" onClick={doSearch}><i className="fa-solid fa-search"/></button>
                  </div>
                  {loadingCandidates && <div className="text-center py-3"><span className="spinner-border text-primary"/></div>}
                  {filtered.length > 0 && (
                    <div className="row g-2">
                      {filtered.map((p,i) => {
                        const sc = p.hasResult ? (['ปกติ','ผ่าน','สมวัย'].includes(p.status) ? 'success' : 'danger') : 'warning';
                        return (
                          <div className="col-md-6" key={i}>
                            <div className={`card border-${sc} search-result-card`} onClick={() => { setSelected(p); setResult(p.hasResult ? p.status : ''); }}>
                              <div className="card-body p-3">
                                <div className="d-flex justify-content-between">
                                  <div>
                                    <div className="fw-bold mb-1">{p.name}</div>
                                    <small className="text-muted">อายุ {p.age} | บ้าน {p.house} ม.{p.moo}</small>
                                  </div>
                                  <div className="text-center ms-2">
                                    <i className={`fa-solid fa-${sc==='warning'?'clock':'check-circle'} fa-2x text-${sc}`}/>
                                    <div className="small mt-1">{p.hasResult ? p.status : 'รอผล'}</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
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
                      <button className="btn btn-secondary rounded-pill" onClick={() => setSelected(null)}><i className="fa-solid fa-arrow-left me-1"/> กลับ</button>
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
