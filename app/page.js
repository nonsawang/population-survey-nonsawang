'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { calculateAge, sanitizeInput, validateCID, parseBirthToISO, VALID_MOOS, CHRONIC_LIST } from '@/lib/utils';
import TopBar from '@/components/TopBar';

// ─── PersonCard component ───
function PersonCard({ person, onSave, onMove, vhvList, moo }) {
  const [relValue, setRelValue] = useState(person.relation);
  const [chronicValue, setChronicValue] = useState('');
  const [chronicOther, setChronicOther] = useState('');
  const [showOther, setShowOther] = useState(false);
  const [riskOpen, setRiskOpen] = useState(false);
  const [smokeStatus, setSmokeStatus] = useState(person.smokingStatus || '');
  const [alcoStatus, setAlcoStatus] = useState(person.alcoholStatus || '');
  const [fagerAnswers, setFagerAnswers] = useState(person.fagerstromAnswers || {});
  const [assistAnswers, setAssistAnswers] = useState(person.assistAnswers || {});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const cc = (!person.chronic || person.chronic === '-') ? 'ปกติ (ไม่มีโรค)' : person.chronic;
    const found = CHRONIC_LIST.includes(cc);
    if (found) { setChronicValue(cc); setShowOther(false); }
    else { setChronicValue('__OTHER__'); setChronicOther(cc); setShowOther(true); }
  }, [person.chronic]);

  const getChronicFinal = () => chronicValue === '__OTHER__' ? (chronicOther.trim() || '-') : chronicValue;

  const handleSave = async (type) => {
    setSaving(true);
    await onSave(person.personId, type, relValue, getChronicFinal());
    setSaving(false);
  };

  const handleSaveRisk = async () => {
    setSaving(true);
    const fScore = smokeStatus === 'สูบ' ? ['f1','f2','f3','f4','f5','f6'].reduce((s,k) => s + (parseInt(fagerAnswers[k]) || 0), 0) : null;
    const aScore = alcoStatus === 'ดื่ม' ? ['a1','a2','a3','a4','a5'].reduce((s,k) => s + (parseInt(assistAnswers[k]) || 0), 0) : null;
    const { error } = await supabase.from('population').update({
      smoking_status: smokeStatus || null, alcohol_status: alcoStatus || null,
      fagerstrom_score: fScore, fagerstrom_answers: smokeStatus === 'สูบ' ? JSON.stringify(fagerAnswers) : null,
      assist_score: aScore, assist_answers: alcoStatus === 'ดื่ม' ? JSON.stringify(assistAnswers) : null,
      updated_at: new Date().toISOString()
    }).eq('person_id', person.personId);
    setSaving(false);
    if (!error) alert('บันทึกคัดกรองบุหรี่/สุราเรียบร้อย');
  };

  const fagerTotal = ['f1','f2','f3','f4','f5','f6'].reduce((s,k) => s + (parseInt(fagerAnswers[k]) || 0), 0);
  const assistTotal = ['a1','a2','a3','a4','a5'].reduce((s,k) => s + (parseInt(assistAnswers[k]) || 0), 0);
  const bc = `border-type${person.residencyType}`;
  const rels = ['เจ้าบ้าน','ผู้อาศัย','บิดา/มารดา','เขย/สะใภ้','บุตร/หลาน','เช่าอาศัย','อื่นๆ'];

  return (
    <div className={`card card-person ${bc} fade-in`} style={{opacity: saving ? 0.6 : 1}}>
      <div className="card-body p-3">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h6 className="fw-bold mb-0" style={{color:'var(--primary)'}}>
            {person.fullname}
            {person.smokingStatus && person.smokingStatus !== '-' && <span className="badge ms-1" style={{fontSize:'.65rem',background:'#6f42c1',color:'white'}}><i className="fa-solid fa-smoking me-1"/>{person.smokingStatus === 'สูบ' ? 'สูบ' : 'เลิกแล้ว'}</span>}
            {person.alcoholStatus && person.alcoholStatus !== '-' && <span className="badge ms-1" style={{fontSize:'.65rem',background:'#0d6efd',color:'white'}}><i className="fa-solid fa-wine-bottle me-1"/>{person.alcoholStatus === 'ดื่ม' ? 'ดื่ม' : 'เลิกแล้ว'}</span>}
          </h6>
          <span className="badge bg-light text-dark border" style={{fontSize:'.8em'}}>อายุ {person.age}</span>
        </div>

        {/* Relation + Chronic */}
        <div className="row g-2 mb-3 p-2 rounded-3 mx-0" style={{background:'#f8f9fa'}}>
          <div className="col-6 px-1">
            <label className="text-muted" style={{fontSize:'.68em',fontWeight:600}}>สถานะในบ้าน</label>
            <select className="form-select form-select-sm border-0 fw-bold" style={{fontSize:'.85rem',color:'var(--primary)'}} value={relValue} onChange={e => { setRelValue(e.target.value); handleSave(person.residencyType); }}>
              {rels.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="col-6 px-1">
            <label className="text-muted" style={{fontSize:'.68em',fontWeight:600}}>โรคประจำตัว</label>
            <select className="form-select form-select-sm border-0 fw-bold text-danger" style={{fontSize:'.85rem'}} value={chronicValue} onChange={e => { setChronicValue(e.target.value); setShowOther(e.target.value === '__OTHER__'); if (e.target.value !== '__OTHER__') handleSave(person.residencyType); }}>
              {CHRONIC_LIST.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="__OTHER__">อื่นๆ (ระบุ)</option>
            </select>
            {showOther && (
              <div className="input-group input-group-sm mt-1">
                <input type="text" className="form-control border-danger" style={{fontSize:'.8rem'}} placeholder="ระบุโรค..." value={chronicOther} onChange={e => setChronicOther(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSave(person.residencyType)} />
                <button className="btn btn-danger btn-sm" onClick={() => handleSave(person.residencyType)}><i className="fa-solid fa-check" /></button>
              </div>
            )}
          </div>
        </div>

        {/* Type Buttons */}
        <div className="row g-1 mb-1">
          {[{t:'1',label:'Type 1',desc:'มีชื่อ+อยู่จริง',cls:'success'},{t:'2',label:'Type 2',desc:'มีชื่อ+ไม่อยู่',cls:'warning'},{t:'3',label:'Type 3',desc:'ไม่มีชื่อ+มาอยู่',cls:'danger'}].map(({t,label,desc,cls}) => (
            <div className="col-4" key={t}>
              <button onClick={() => handleSave(t)} className={`btn btn-sm btn-type w-100 h-100 py-2 ${person.residencyType == t ? `btn-${cls} active-type` : `btn-outline-${cls}`}`}>
                <div className="fw-bold">{label}</div><div style={{fontSize:'.62rem'}}>{desc}</div>
              </button>
            </div>
          ))}
        </div>
        <div className="d-flex gap-1 mt-1">
          <button onClick={() => { if(confirm(`บันทึก ${person.fullname} เป็น "เสียชีวิต"?`)) handleSave('4'); }} className={`btn btn-sm btn-type ${person.residencyType == 4 ? 'btn-dark active-type' : 'btn-outline-dark'} flex-fill`}><i className="fa-solid fa-skull"/> เสียชีวิต</button>
          <button onClick={() => { if(confirm(`จำหน่าย ${person.fullname}?`)) handleSave('0'); }} className={`btn btn-sm btn-type ${person.residencyType == 0 ? 'btn-secondary active-type' : 'btn-outline-secondary'} flex-fill`}><i className="fa-solid fa-ban"/> จำหน่าย</button>
          <button onClick={() => onMove(person)} className="btn btn-sm btn-outline-dark flex-fill dashed-border"><i className="fa-solid fa-truck-moving"/> ย้าย</button>
        </div>

        {/* Risk Section */}
        <div className="risk-section">
          <div className="d-flex align-items-center justify-content-between">
            <span className="small text-muted fw-bold"><i className="fa-solid fa-triangle-exclamation text-warning me-1"/>คัดกรองบุหรี่/สุรา</span>
            <button className="btn btn-outline-secondary risk-toggle-btn" onClick={() => setRiskOpen(!riskOpen)}>
              <i className={`fa-solid fa-chevron-${riskOpen ? 'up' : 'down'}`}/> {person.smokingStatus || person.alcoholStatus ? 'แก้ไข' : 'บันทึก'}
            </button>
          </div>
          <div className={`risk-body ${riskOpen ? 'open' : ''}`}>
            {/* Smoking */}
            <div className="mt-2">
              <label className="small fw-bold text-muted mb-1"><i className="fa-solid fa-smoking text-secondary me-1"/>การสูบบุหรี่</label>
              <select className="form-select form-select-sm" value={smokeStatus} onChange={e => setSmokeStatus(e.target.value)}>
                <option value="">เลือก</option>
                <option value="ไม่สูบ ไม่เคยสูบบุหรี่">ไม่สูบ ไม่เคยสูบบุหรี่</option>
                <option value="ไม่สูบ เคยสูบบุหรี่แต่เลิกแล้ว">ไม่สูบ เคยสูบแต่เลิกแล้ว</option>
                <option value="สูบ">สูบ</option>
              </select>
            </div>
            {smokeStatus === 'สูบ' && (
              <div className="sub-test">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="text-primary fw-bold" style={{fontSize:'.78rem'}}>Fagerstrom Test</span>
                  <span className={`score-badge ${fagerTotal <= 3 ? 'score-low' : fagerTotal <= 6 ? 'score-med' : 'score-high'}`}>คะแนน {fagerTotal}</span>
                </div>
                {[{k:'f1',q:'สูบวันละกี่มวน?',opts:[['0','≤10'],['1','11-20'],['2','21-30'],['3','≥31']]},
                  {k:'f2',q:'มวนแรกหลังตื่น?',opts:[['3','ภายใน 5 นาที'],['2','6-30 นาที'],['1','31-60 นาที'],['0','มากกว่า 60 นาที']]},
                  {k:'f3',q:'สูบจัดชั่วโมงแรก?',opts:[['1','ใช่'],['0','ไม่ใช่']]},
                  {k:'f4',q:'มวนที่ไม่อยากเลิก?',opts:[['1','มวนแรกเช้า'],['0','มวนอื่น']]},
                  {k:'f5',q:'ลำบากในเขตปลอดบุหรี่?',opts:[['1','ลำบาก'],['0','ไม่ลำบาก']]},
                  {k:'f6',q:'สูบแม้เจ็บป่วย?',opts:[['1','ใช่'],['0','ไม่ใช่']]}
                ].map(({k,q,opts}) => (
                  <div key={k}>
                    <label>{q}</label>
                    <select className="form-select form-select-sm mb-2" value={fagerAnswers[k] || ''} onChange={e => setFagerAnswers({...fagerAnswers,[k]:e.target.value})}>
                      <option value="">เลือก</option>
                      {opts.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            )}
            {/* Alcohol */}
            <div className="mt-2">
              <label className="small fw-bold text-muted mb-1"><i className="fa-solid fa-wine-bottle text-secondary me-1"/>การดื่มสุรา</label>
              <select className="form-select form-select-sm" value={alcoStatus} onChange={e => setAlcoStatus(e.target.value)}>
                <option value="">เลือก</option>
                <option value="ไม่ดื่ม/ตลอดชีวิตไม่เคยดื่มเลย">ไม่ดื่ม/ไม่เคยดื่มเลย</option>
                <option value="เคยดื่มแต่หยุดแล้ว 1 ปีขึ้นไป">เคยดื่มแต่หยุดแล้ว</option>
                <option value="ดื่ม">ดื่ม</option>
              </select>
            </div>
            {alcoStatus === 'ดื่ม' && (
              <div className="sub-test">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="text-success fw-bold" style={{fontSize:'.78rem'}}>ASSIST</span>
                  <span className={`score-badge ${assistTotal <= 10 ? 'score-low' : assistTotal <= 26 ? 'score-med' : 'score-high'}`}>คะแนน {assistTotal}</span>
                </div>
                {[{k:'a1',q:'3 เดือนที่ผ่านมา ดื่มบ่อยแค่ไหน?',opts:[['6','เกือบทุกวัน'],['4','ทุกสัปดาห์'],['3','ทุกเดือน'],['2','ครั้งสองครั้ง'],['0','ไม่เคย']]},
                  {k:'a2',q:'อยากดื่มมากๆ บ่อยแค่ไหน?',opts:[['6','เกือบทุกวัน'],['5','ทุกสัปดาห์'],['4','ทุกเดือน'],['3','ครั้งสองครั้ง'],['0','ไม่เคย']]},
                  {k:'a3',q:'เกิดปัญหา (สุขภาพ/สังคม/เงิน)?',opts:[['7','เกือบทุกวัน'],['6','ทุกสัปดาห์'],['5','ทุกเดือน'],['4','ครั้งสองครั้ง'],['0','ไม่เคย']]},
                  {k:'a4',q:'เสียงาน/การเรียน?',opts:[['8','เกือบทุกวัน'],['7','ทุกสัปดาห์'],['6','ทุกเดือน'],['5','ครั้งสองครั้ง'],['0','ไม่เคย']]},
                  {k:'a5',q:'คนอื่นเคยตักเตือน?',opts:[['3','เคย (ก่อน 3 เดือน)'],['6','เคย (ใน 3 เดือนนี้)'],['0','ไม่เคย']]}
                ].map(({k,q,opts}) => (
                  <div key={k}>
                    <label>{q}</label>
                    <select className="form-select form-select-sm mb-2" value={assistAnswers[k] || ''} onChange={e => setAssistAnswers({...assistAnswers,[k]:e.target.value})}>
                      <option value="">เลือก</option>
                      {opts.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            )}
            <button onClick={handleSaveRisk} className="btn btn-sm btn-primary w-100 rounded-pill mt-3 fw-bold" disabled={saving}>
              <i className="fa-solid fa-save me-1"/> บันทึกคัดกรองบุหรี่/สุรา
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───
export default function SurveyPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [moo, setMoo] = useState('');
  const [house, setHouse] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [showGuide, setShowGuide] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  const searchData = async () => {
    if (!moo || !house.trim()) { alert('กรุณาระบุข้อมูลให้ครบ'); return; }
    setSearching(true);
    const { data, error } = await supabase.from('population').select('*').eq('house', house.trim()).eq('moo', moo).order('fname');
    setSearching(false);
    if (error) { alert('ค้นหาไม่สำเร็จ: ' + error.message); return; }
    const mapped = (data || []).map(r => {
      let fagerAns = {}; try { if (r.fagerstrom_answers) fagerAns = JSON.parse(r.fagerstrom_answers); } catch(e) {}
      let assistAns = {}; try { if (r.assist_answers) assistAns = JSON.parse(r.assist_answers); } catch(e) {}
      return {
        personId: r.person_id, cid: r.cid || '-', fullname: (r.title||'') + (r.fname||'') + ' ' + (r.lname||''),
        age: calculateAge(r.birth_date), relation: r.relation || 'ไม่ระบุ', residencyType: r.residency_type || '3',
        chronic: r.chronic || '-', vhv: r.vhv || 'ไม่ระบุ', smokingStatus: r.smoking_status || '',
        alcoholStatus: r.alcohol_status || '', fagerstromScore: r.fagerstrom_score, assistScore: r.assist_score,
        fagerstromAnswers: fagerAns, assistAnswers: assistAns
      };
    });
    setResults(mapped);
    setShowGuide(false);
  };

  const handleSave = async (personId, newType, relation, chronic) => {
    const { error } = await supabase.from('population').update({
      residency_type: String(newType), relation: sanitizeInput(relation),
      chronic: chronic || '-', updated_at: new Date().toISOString()
    }).eq('person_id', personId);
    if (error) alert('บันทึกไม่สำเร็จ: ' + error.message);
    else searchData();
  };

  if (loading) return <div className="text-center py-5"><span className="spinner-border text-primary" /></div>;
  if (!user) return null;

  return (
    <>
      <TopBar showAdmin showLogoutConfirm />
      <div className="container py-3" style={{maxWidth:600}}>
        <h5 className="text-center mb-3 fw-bold" style={{color:'var(--primary)'}}><i className="fa-solid fa-clipboard-user"/> ระบบสำรวจประชากร</h5>

        {/* FABs */}
        <div className="fab-container">
          <a href="/screening" className="fab-btn bg-success"><i className="fa-solid fa-clipboard-check fa-lg"/></a>
          <a href="/dashboard" className="fab-btn" style={{background:'var(--primary)'}}><i className="fa-solid fa-chart-line fa-lg"/></a>
        </div>

        {/* Search */}
        <div className="card border-0 shadow-sm mb-4 fade-in" style={{borderRadius:16}}>
          <div className="card-body p-4">
            <div className="row g-2">
              <div className="col-5">
                <label className="small text-muted fw-bold">หมู่ที่</label>
                <select className="form-select text-center" value={moo} onChange={e => setMoo(e.target.value)}>
                  <option value="" disabled>เลือก</option>
                  {VALID_MOOS.map(m => <option key={m} value={m}>หมู่ {m}</option>)}
                </select>
              </div>
              <div className="col-7">
                <label className="small text-muted fw-bold">เลขที่บ้าน</label>
                <input type="text" className="form-control" placeholder="ระบุเลขที่บ้าน" value={house} onChange={e => setHouse(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchData()} />
              </div>
              <div className="col-12 mt-3">
                <button onClick={searchData} className="btn w-100 rounded-pill text-white fw-bold" style={{background:'var(--primary)',padding:10}} disabled={searching}>
                  {searching ? <><span className="spinner-border spinner-border-sm me-1"/>กำลังค้นหา...</> : <><i className="fa-solid fa-magnifying-glass me-1"/> ค้นหาข้อมูล</>}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Guide */}
        {showGuide && (
          <div className="card border-0 shadow-sm mt-3" style={{borderRadius:16,background:'linear-gradient(135deg,#3949ab,#7c4dff)'}}>
            <div className="card-body p-4">
              <h5 className="fw-bold text-white mb-4"><i className="fa-solid fa-book-open me-2"/>คู่มือการใช้งาน</h5>
              {[{n:1,c:'primary',icon:'magnifying-glass',title:'ค้นหาข้อมูลบ้าน',desc:'เลือกหมู่ → ระบุบ้านเลขที่ → กดค้นหา'},
                {n:2,c:'success',icon:'user-check',title:'ปรับปรุงสถานะ (Type)',desc:'Type 1 มีชื่อ+อยู่จริง / Type 2 มีชื่อ+ไม่อยู่ / Type 3 ไม่มีชื่อ+มาอยู่'},
                {n:3,c:'info',icon:'user-plus',title:'เพิ่มผู้อาศัยใหม่',desc:'กดปุ่ม "เพิ่มผู้อาศัย" → กรอกข้อมูล → เลือก อสม.'},
                {n:4,c:'warning',icon:'truck-moving',title:'ย้ายที่อยู่ / กรณีพิเศษ',desc:'ย้ายบ้าน, เสียชีวิต, จำหน่าย, เปลี่ยน อสม.'}
              ].map(({n,c,icon,title,desc}) => (
                <div key={n} className="bg-white rounded-3 p-3 mb-2">
                  <div className="d-flex align-items-start gap-3">
                    <div className={`bg-${c} text-white rounded-circle d-flex align-items-center justify-content-center`} style={{width:30,height:30,fontSize:'.85rem',fontWeight:'bold',flexShrink:0}}>{n}</div>
                    <div><h6 className={`fw-bold text-${c} mb-1`}><i className={`fa-solid fa-${icon} me-1`}/>{title}</h6><small className="text-muted">{desc}</small></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {results !== null && (
          <div>
            {results.length === 0 ? (
              <div className="card border-0 bg-light mt-3 text-center py-5" style={{borderRadius:16}}>
                <i className="fa-solid fa-house-chimney-crack fa-4x text-secondary mb-3"/>
                <h5 className="fw-bold">ไม่พบข้อมูล</h5>
                <p className="text-muted">บ้านเลขที่ {house} หมู่ {moo}</p>
              </div>
            ) : (
              <>
                <div className="alert border-0 shadow-sm d-flex justify-content-between align-items-center mb-3" style={{background:'white',borderRadius:12}}>
                  <div>
                    <div className="small text-muted"><i className="fa-solid fa-location-dot text-primary"/> ม.{moo} บ้านเลขที่ {house}</div>
                    <div className="mt-1"><i className="fa-solid fa-user-nurse text-success"/> อสม: <strong>{results[0]?.vhv || 'ไม่ระบุ'}</strong></div>
                  </div>
                </div>
                <div className="mb-2 text-muted small">พบ <strong>{results.length}</strong> คน</div>
                {results.map(p => (
                  <PersonCard key={p.personId} person={p} onSave={handleSave} onMove={() => {}} vhvList={[]} moo={moo} />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
