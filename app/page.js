'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { calculateAge, sanitizeInput, validateCID, parseBirthToISO, VALID_MOOS, CHRONIC_LIST } from '@/lib/utils';
import TopBar from '@/components/TopBar';

// ✅ SweetAlert2 — ใช้ CDN จาก layout.js (window.Swal)
const getSwal = () => typeof window !== 'undefined' ? window.Swal : null;
const swal = (opts) => { const S = getSwal(); return S ? S.fire(opts) : alert(opts.title || opts.text || ''); };
const Toast = (icon, title) => { const S = getSwal(); return S ? S.mixin({ toast:true, position:'top-end', showConfirmButton:false, timer:2000, timerProgressBar:true }).fire({ icon, title }) : null; };
const showLoading = (title) => { const S = getSwal(); return S ? S.fire({ title, allowOutsideClick:false, didOpen:()=>S.showLoading() }) : null; };
const closeLoading = () => { const S = getSwal(); return S ? S.close() : null; };

// ═══════════════════════════════════════════
// PersonCard — การ์ดแต่ละคน
// ═══════════════════════════════════════════
function PersonCard({ person, onSave, onMove, onRefresh }) {
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
    if (CHRONIC_LIST.includes(cc)) { setChronicValue(cc); setShowOther(false); }
    else { setChronicValue('__OTHER__'); setChronicOther(cc); setShowOther(true); }
  }, [person.chronic]);

  const getChronicFinal = () => chronicValue === '__OTHER__' ? (chronicOther.trim() || '-') : chronicValue;

  const doSave = async (type) => {
    setSaving(true);
    await onSave(person.personId, type, relValue, getChronicFinal());
    setSaving(false);
  };

  const doSaveRisk = async () => {
    if (!smokeStatus && !alcoStatus) { swal({icon:'warning',title:'กรุณาเลือกสถานะบุหรี่หรือสุรา',timer:1500,showConfirmButton:false}); return; }
    setSaving(true);
    showLoading('กำลังบันทึก...');
    const fScore = smokeStatus === 'สูบ' ? ['f1','f2','f3','f4','f5','f6'].reduce((s,k) => s + (parseInt(fagerAnswers[k]) || 0), 0) : null;
    const aScore = alcoStatus === 'ดื่ม' ? ['a1','a2','a3','a4','a5'].reduce((s,k) => s + (parseInt(assistAnswers[k]) || 0), 0) : null;
    const { error } = await supabase.from('population').update({
      smoking_status: smokeStatus || null, alcohol_status: alcoStatus || null,
      fagerstrom_score: fScore, fagerstrom_answers: smokeStatus === 'สูบ' ? JSON.stringify(fagerAnswers) : null,
      assist_score: aScore, assist_answers: alcoStatus === 'ดื่ม' ? JSON.stringify(assistAnswers) : null,
      updated_at: new Date().toISOString()
    }).eq('person_id', person.personId);
    closeLoading(); setSaving(false);
    if (!error) { Toast('success','บันทึกคัดกรองบุหรี่/สุราเรียบร้อย'); onRefresh(); }
    else swal({icon:'error',title:'ผิดพลาด',text:error.message});
  };

  const fT = ['f1','f2','f3','f4','f5','f6'].reduce((s,k) => s + (parseInt(fagerAnswers[k]) || 0), 0);
  const aT = ['a1','a2','a3','a4','a5'].reduce((s,k) => s + (parseInt(assistAnswers[k]) || 0), 0);
  const rels = ['เจ้าบ้าน','ผู้อาศัย','บิดา/มารดา','เขย/สะใภ้','บุตร/หลาน','เช่าอาศัย','อื่นๆ'];

  return (
    <div className={`card card-person border-type${person.residencyType} fade-in`} style={{opacity: saving ? 0.6 : 1, pointerEvents: saving ? 'none' : 'auto'}}>
      {/* ✅ Spinner มุมขวาบนตอนบันทึก */}
      {saving && <div style={{position:'absolute',top:10,right:10,zIndex:5}}><span className="spinner-border spinner-border-sm text-primary"/></div>}
      <div className="card-body p-3">
        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h6 className="fw-bold mb-0" style={{color:'var(--primary)'}}>
            {person.fullname}
            {person.smokingStatus && person.smokingStatus !== '-' && person.smokingStatus !== '' && <span className="badge ms-1" style={{fontSize:'.65rem',background:'#6f42c1',color:'white'}}><i className="fa-solid fa-smoking me-1"/>{person.smokingStatus === 'สูบ' ? 'สูบ' : 'เลิกแล้ว'}</span>}
            {person.alcoholStatus && person.alcoholStatus !== '-' && person.alcoholStatus !== '' && <span className="badge ms-1" style={{fontSize:'.65rem',background:'#0d6efd',color:'white'}}><i className="fa-solid fa-wine-bottle me-1"/>{person.alcoholStatus === 'ดื่ม' ? 'ดื่ม' : 'เลิกแล้ว'}</span>}
          </h6>
          <span className="badge bg-light text-dark border" style={{fontSize:'.8em'}}>อายุ {person.age}</span>
        </div>

        {/* Relation + Chronic */}
        <div className="row g-2 mb-3 p-2 rounded-3 mx-0" style={{background:'#f8f9fa'}}>
          <div className="col-6 px-1">
            <label className="text-muted" style={{fontSize:'.68em',fontWeight:600}}>สถานะในบ้าน</label>
            <select className="form-select form-select-sm border-0 fw-bold" style={{fontSize:'.85rem',color:'var(--primary)'}} value={relValue} onChange={e => { setRelValue(e.target.value); doSave(person.residencyType); }}>
              {rels.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="col-6 px-1">
            <label className="text-muted" style={{fontSize:'.68em',fontWeight:600}}>โรคประจำตัว</label>
            <select className="form-select form-select-sm border-0 fw-bold text-danger" style={{fontSize:'.85rem'}} value={chronicValue} onChange={e => { setChronicValue(e.target.value); setShowOther(e.target.value === '__OTHER__'); if (e.target.value !== '__OTHER__') doSave(person.residencyType); }}>
              {CHRONIC_LIST.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="__OTHER__">อื่นๆ (ระบุ)</option>
            </select>
            {showOther && (
              <div className="input-group input-group-sm mt-1">
                <input type="text" className="form-control border-danger" style={{fontSize:'.8rem'}} placeholder="ระบุโรค..." value={chronicOther} onChange={e => setChronicOther(e.target.value)} onKeyDown={e => e.key === 'Enter' && doSave(person.residencyType)} />
                <button className="btn btn-danger btn-sm" onClick={() => doSave(person.residencyType)}><i className="fa-solid fa-check" /></button>
              </div>
            )}
          </div>
        </div>

        {/* Type Buttons */}
        <div className="row g-1 mb-1">
          {[{t:'1',label:'Type 1',desc:'มีชื่อ+อยู่จริง',cls:'success'},{t:'2',label:'Type 2',desc:'มีชื่อ+ไม่อยู่',cls:'warning'},{t:'3',label:'Type 3',desc:'ไม่มีชื่อ+มาอยู่',cls:'danger'}].map(({t,label,desc,cls}) => (
            <div className="col-4" key={t}>
              <button onClick={() => doSave(t)} className={`btn btn-sm btn-type w-100 h-100 py-2 ${person.residencyType == t ? `btn-${cls} active-type` : `btn-outline-${cls}`}`}>
                <div className="fw-bold">{label}</div><div style={{fontSize:'.62rem'}}>{desc}</div>
              </button>
            </div>
          ))}
        </div>
        <div className="d-flex gap-1 mt-1">
          <button onClick={() => { const S=getSwal(); S && S.fire({title:'ยืนยัน?',text:`บันทึก ${person.fullname} เป็น "เสียชีวิต"`,icon:'warning',showCancelButton:true,confirmButtonColor:'#1f2937',confirmButtonText:'ยืนยัน',cancelButtonText:'ยกเลิก'}).then(r=>{if(r.isConfirmed)doSave('4');}); }} className={`btn btn-sm btn-type ${person.residencyType == 4 ? 'btn-dark active-type' : 'btn-outline-dark'} flex-fill`}><i className="fa-solid fa-skull"/> เสียชีวิต</button>
          <button onClick={() => { const S=getSwal(); S && S.fire({title:'ยืนยันจำหน่าย?',text:`จำหน่าย ${person.fullname} ออกจากพื้นที่`,icon:'warning',showCancelButton:true,confirmButtonColor:'#6b7280',confirmButtonText:'ยืนยัน',cancelButtonText:'ยกเลิก'}).then(r=>{if(r.isConfirmed)doSave('0');}); }} className={`btn btn-sm btn-type ${person.residencyType == 0 ? 'btn-secondary active-type' : 'btn-outline-secondary'} flex-fill`}><i className="fa-solid fa-ban"/> จำหน่าย</button>
          <button onClick={() => onMove(person)} className="btn btn-sm btn-outline-dark flex-fill dashed-border"><i className="fa-solid fa-truck-moving"/> ย้าย</button>
        </div>

        {/* ─── Risk Section ─── */}
        <div className="risk-section">
          <div className="d-flex align-items-center justify-content-between">
            <span className="small text-muted fw-bold"><i className="fa-solid fa-triangle-exclamation text-warning me-1"/>คัดกรองบุหรี่/สุรา</span>
            <button className="btn btn-outline-secondary risk-toggle-btn" onClick={() => setRiskOpen(!riskOpen)}>
              <i className={`fa-solid fa-chevron-${riskOpen ? 'up' : 'down'}`}/> {person.smokingStatus || person.alcoholStatus ? 'แก้ไข' : 'บันทึก'}
            </button>
          </div>
          <div className={`risk-body ${riskOpen ? 'open' : ''}`}>
            <div className="mt-2"><label className="small fw-bold text-muted mb-1"><i className="fa-solid fa-smoking text-secondary me-1"/>การสูบบุหรี่</label>
              <select className="form-select form-select-sm" value={smokeStatus} onChange={e => setSmokeStatus(e.target.value)}>
                <option value="">เลือก</option><option value="ไม่สูบ ไม่เคยสูบบุหรี่">ไม่สูบ ไม่เคยสูบบุหรี่</option><option value="ไม่สูบ เคยสูบบุหรี่แต่เลิกแล้ว">เคยสูบแต่เลิกแล้ว</option><option value="สูบ">สูบ</option>
              </select>
            </div>
            {smokeStatus === 'สูบ' && <div className="sub-test"><div className="d-flex justify-content-between align-items-center mb-2"><span className="text-primary fw-bold" style={{fontSize:'.78rem'}}>Fagerstrom</span><span className={`score-badge ${fT<=3?'score-low':fT<=6?'score-med':'score-high'}`}>คะแนน {fT}</span></div>
              {[{k:'f1',q:'สูบวันละกี่มวน?',o:[['0','≤10'],['1','11-20'],['2','21-30'],['3','≥31']]},{k:'f2',q:'มวนแรกหลังตื่น?',o:[['3','ภายใน 5 นาที'],['2','6-30 นาที'],['1','31-60 นาที'],['0','>60 นาที']]},{k:'f3',q:'สูบจัดชั่วโมงแรก?',o:[['1','ใช่'],['0','ไม่ใช่']]},{k:'f4',q:'มวนที่ไม่อยากเลิก?',o:[['1','มวนแรกเช้า'],['0','มวนอื่น']]},{k:'f5',q:'ลำบากในเขตปลอดบุหรี่?',o:[['1','ลำบาก'],['0','ไม่ลำบาก']]},{k:'f6',q:'สูบแม้เจ็บป่วย?',o:[['1','ใช่'],['0','ไม่ใช่']]}].map(({k,q,o})=><div key={k}><label>{q}</label><select className="form-select form-select-sm mb-2" value={fagerAnswers[k]||''} onChange={e=>setFagerAnswers({...fagerAnswers,[k]:e.target.value})}><option value="">เลือก</option>{o.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>)}
            </div>}
            <div className="mt-2"><label className="small fw-bold text-muted mb-1"><i className="fa-solid fa-wine-bottle text-secondary me-1"/>การดื่มสุรา</label>
              <select className="form-select form-select-sm" value={alcoStatus} onChange={e => setAlcoStatus(e.target.value)}>
                <option value="">เลือก</option><option value="ไม่ดื่ม/ตลอดชีวิตไม่เคยดื่มเลย">ไม่ดื่ม/ไม่เคยดื่ม</option><option value="เคยดื่มแต่หยุดแล้ว 1 ปีขึ้นไป">เคยดื่มแต่หยุดแล้ว</option><option value="ดื่ม">ดื่ม</option>
              </select>
            </div>
            {alcoStatus === 'ดื่ม' && <div className="sub-test"><div className="d-flex justify-content-between align-items-center mb-2"><span className="text-success fw-bold" style={{fontSize:'.78rem'}}>ASSIST</span><span className={`score-badge ${aT<=10?'score-low':aT<=26?'score-med':'score-high'}`}>คะแนน {aT}</span></div>
              {[{k:'a1',q:'ดื่มบ่อยแค่ไหน?',o:[['6','เกือบทุกวัน'],['4','ทุกสัปดาห์'],['3','ทุกเดือน'],['2','ครั้งสองครั้ง'],['0','ไม่เคย']]},{k:'a2',q:'อยากดื่มมากๆ?',o:[['6','เกือบทุกวัน'],['5','ทุกสัปดาห์'],['4','ทุกเดือน'],['3','ครั้งสองครั้ง'],['0','ไม่เคย']]},{k:'a3',q:'เกิดปัญหา?',o:[['7','เกือบทุกวัน'],['6','ทุกสัปดาห์'],['5','ทุกเดือน'],['4','ครั้งสองครั้ง'],['0','ไม่เคย']]},{k:'a4',q:'เสียงาน/การเรียน?',o:[['8','เกือบทุกวัน'],['7','ทุกสัปดาห์'],['6','ทุกเดือน'],['5','ครั้งสองครั้ง'],['0','ไม่เคย']]},{k:'a5',q:'คนอื่นตักเตือน?',o:[['3','เคย (ก่อน 3 เดือน)'],['6','เคย (ใน 3 เดือน)'],['0','ไม่เคย']]}].map(({k,q,o})=><div key={k}><label>{q}</label><select className="form-select form-select-sm mb-2" value={assistAnswers[k]||''} onChange={e=>setAssistAnswers({...assistAnswers,[k]:e.target.value})}><option value="">เลือก</option>{o.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>)}
            </div>}
            <button onClick={doSaveRisk} className="btn btn-sm btn-primary w-100 rounded-pill mt-3 fw-bold" disabled={saving}><i className="fa-solid fa-save me-1"/> บันทึกคัดกรองบุหรี่/สุรา</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// Main Survey Page
// ═══════════════════════════════════════════
export default function SurveyPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [moo, setMoo] = useState('');
  const [house, setHouse] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [vhvData, setVhvData] = useState({});
  const [moveTarget, setMoveTarget] = useState(null);
  const [moveMoo, setMoveMoo] = useState('');
  const [moveHouse, setMoveHouse] = useState('');
  // ✅ VHV change modal — เก็บ house/moo ตอนเปิด ไม่ผูกกับช่องค้นหา
  const [showVhvModal, setShowVhvModal] = useState(false);
  const [selectedVhv, setSelectedVhv] = useState('');
  const [vhvHouse, setVhvHouse] = useState('');
  const [vhvMoo, setVhvMoo] = useState('');
  // ✅ Add person modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ cid:'', title:'นาย', fname:'', lname:'', birth_day:'', birth_month:'', birth_year:'', relation:'ผู้อาศัย', type:'3', chronic:'ปกติ (ไม่มีโรค)', chronicOther:'', vhv:'' });

  // ✅ จำกัดหมู่สำหรับ vhv
  const allowedMoos = (user?.role === 'vhv' && user?.moo) ? user.moo.split(',').map(m => m.trim()) : null;
  const visibleMoos = allowedMoos ? VALID_MOOS.filter(m => allowedMoos.includes(m)) : VALID_MOOS;

  useEffect(() => { if (!loading && !user) router.push('/login'); }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      supabase.from('vhv_data').select('name,moo').limit(1000).then(({ data }) => {
        const map = {};
        (data || []).forEach(r => { const m = String(r.moo).trim(); if (!map[m]) map[m] = []; map[m].push(String(r.name).trim()); });
        Object.keys(map).forEach(m => map[m].sort());
        setVhvData(map);
      });
      // ✅ Auto-select first moo for vhv role
      if (allowedMoos && allowedMoos[0]) setMoo(allowedMoos[0]);
    }
  }, [user]);

  const searchData = async () => {
    if (!moo || !house.trim()) { swal({icon:'warning',title:'กรุณาระบุข้อมูลให้ครบ'}); return; }
    // ✅ ตรวจสิทธิ์หมู่สำหรับ vhv
    if (allowedMoos && !allowedMoos.includes(moo)) { swal({icon:'error',title:'ไม่มีสิทธิ์เข้าถึงหมู่ ' + moo}); return; }
    setSearching(true); showLoading('กำลังค้นหา...');
    const { data, error } = await supabase.from('population').select('*').eq('house', house.trim()).eq('moo', moo).order('fname');
    closeLoading(); setSearching(false);
    if (error) { swal({icon:'error',title:'ค้นหาไม่สำเร็จ',text:error.message}); return; }
    const mapped = (data || []).map(r => {
      let fa = {}; try { if (r.fagerstrom_answers) fa = JSON.parse(r.fagerstrom_answers); } catch(e) {}
      let aa = {}; try { if (r.assist_answers) aa = JSON.parse(r.assist_answers); } catch(e) {}
      return { personId: r.person_id, cid: r.cid||'-', fullname: (r.title||'')+(r.fname||'')+' '+(r.lname||''), age: calculateAge(r.birth_date), relation: r.relation||'ไม่ระบุ', residencyType: r.residency_type||'3', chronic: r.chronic||'-', vhv: r.vhv||'ไม่ระบุ', smokingStatus: r.smoking_status||'', alcoholStatus: r.alcohol_status||'', fagerstromScore: r.fagerstrom_score, assistScore: r.assist_score, fagerstromAnswers: fa, assistAnswers: aa };
    });
    setResults(mapped);
    setShowGuide(false);
  };

  // ✅ Refresh เงียบๆ — ไม่แสดง Swal loading (ใช้หลังบันทึก Type)
  const searchDataSilent = async () => {
    if (!moo || !house.trim()) return;
    const { data } = await supabase.from('population').select('*').eq('house', house.trim()).eq('moo', moo).order('fname');
    const mapped = (data || []).map(r => {
      let fa = {}; try { if (r.fagerstrom_answers) fa = JSON.parse(r.fagerstrom_answers); } catch(e) {}
      let aa = {}; try { if (r.assist_answers) aa = JSON.parse(r.assist_answers); } catch(e) {}
      return { personId: r.person_id, cid: r.cid||'-', fullname: (r.title||'')+(r.fname||'')+' '+(r.lname||''), age: calculateAge(r.birth_date), relation: r.relation||'ไม่ระบุ', residencyType: r.residency_type||'3', chronic: r.chronic||'-', vhv: r.vhv||'ไม่ระบุ', smokingStatus: r.smoking_status||'', alcoholStatus: r.alcohol_status||'', fagerstromScore: r.fagerstrom_score, assistScore: r.assist_score, fagerstromAnswers: fa, assistAnswers: aa };
    });
    setResults(mapped);
  };

  const handleSave = async (personId, newType, relation, chronic) => {
    const { error } = await supabase.from('population').update({ residency_type: String(newType), relation: sanitizeInput(relation), chronic: chronic || '-', updated_at: new Date().toISOString() }).eq('person_id', personId);
    if (error) swal({icon:'error',title:'บันทึกไม่สำเร็จ',text:error.message});
    // ✅ ไม่แสดง Toast — ใช้ spinner ในการ์ดแทน + refresh ข้อมูลเงียบๆ
    await searchDataSilent();
  };

  // ✅ เปลี่ยน อสม. — เปิด modal เลือกจาก vhv_data
  const openVhvModal = () => {
    const list = vhvData[moo] || [];
    if (list.length === 0) { swal({icon:'warning',title:'ไม่พบรายชื่อ อสม.',text:'ไม่พบ อสม. ในหมู่ ' + moo}); return; }
    // ✅ จับค่า house/moo ตอนเปิด modal — ไม่เปลี่ยนตามช่องค้นหา
    setVhvHouse(house.trim());
    setVhvMoo(moo);
    setSelectedVhv(results?.[0]?.vhv || '');
    setShowVhvModal(true);
  };
  const submitVhvChange = async () => {
    if (!selectedVhv) { swal({icon:'warning',title:'กรุณาเลือก อสม.'}); return; }
    showLoading('กำลังอัปเดต...');
    await supabase.from('population').update({ vhv: selectedVhv, updated_at: new Date().toISOString() }).eq('house', vhvHouse).eq('moo', vhvMoo);
    closeLoading(); setShowVhvModal(false);
    Toast('success','อัปเดต อสม. เรียบร้อย');
    searchDataSilent();
  };

  // ✅ ย้ายบ้าน
  const handleMove = async () => {
    if (!moveMoo || !moveHouse.trim()) { swal({icon:'warning',title:'ข้อมูลไม่ครบ',text:'กรุณาระบุหมู่และบ้านเลขที่ใหม่'}); return; }
    showLoading('กำลังย้าย...');
    const { data: targetRows } = await supabase.from('population').select('vhv').eq('house', moveHouse.trim()).eq('moo', moveMoo).limit(1);
    const newVhv = (targetRows && targetRows[0]?.vhv) || 'ไม่ระบุ';
    const { error } = await supabase.from('population').update({ house: moveHouse.trim(), moo: moveMoo, vhv: newVhv, updated_at: new Date().toISOString() }).eq('person_id', moveTarget.personId);
    closeLoading(); setMoveTarget(null);
    if (!error) {
      swal({icon:'success',title:'ย้ายที่อยู่เรียบร้อย',showConfirmButton:false,timer:1500}).then(() => searchDataSilent());
    } else swal({icon:'error',title:'ย้ายไม่สำเร็จ',text:error.message});
  };

  // ✅ เพิ่มผู้อาศัยใหม่
  const openAddModal = (h, m, vhvName) => {
    setAddForm({ cid:'', title:'นาย', fname:'', lname:'', birth_day:'', birth_month:'', birth_year:'', relation:'ผู้อาศัย', type:'3', chronic:'ปกติ (ไม่มีโรค)', chronicOther:'', vhv: vhvName || '' });
    setShowAddModal(true);
  };
  const submitNewPerson = async () => {
    const f = addForm;
    if (!f.fname?.trim()) { swal({icon:'warning',title:'กรุณากรอกชื่อจริง'}); return; }
    if (!f.lname?.trim()) { swal({icon:'warning',title:'กรุณากรอกนามสกุล'}); return; }
    if (!f.vhv) { swal({icon:'warning',title:'กรุณาเลือก อสม.'}); return; }
    // CID validation
    let cleanCid = null;
    if (f.cid && f.cid.trim() && f.cid.trim() !== '-') {
      const cidResult = validateCID(f.cid);
      if (!cidResult.valid) { swal({icon:'error',title:'เลขบัตรประชาชนไม่ถูกต้อง',text:'ตรวจสอบ 13 หลักและ checksum'}); return; }
      cleanCid = cidResult.clean;
    }
    // Build birth ISO
    let birthISO = null;
    if (f.birth_day && f.birth_month && f.birth_year) {
      const y = parseInt(f.birth_year) - 543;
      birthISO = `${y}-${f.birth_month}-${f.birth_day}`;
    }
    // Chronic
    let chronicVal = f.chronic === '__OTHER__' ? (f.chronicOther?.trim() || '-') : f.chronic;

    // ✅ ถ้ามี existingId = ย้ายคนเดิมมาบ้านนี้ (update) / ถ้าไม่มี = เพิ่มคนใหม่ (insert)
    const existingId = f.existingPersonId || null;
    const recordId = existingId || ('P-' + Date.now());
    const isUpdate = !!existingId;

    showLoading(isUpdate ? 'กำลังย้ายมาบ้านนี้...' : 'กำลังบันทึก...');
    const { error } = await supabase.from('population').upsert({
      person_id: recordId, cid: cleanCid, title: sanitizeInput(f.title) || 'นาย',
      fname: sanitizeInput(f.fname), lname: sanitizeInput(f.lname || ''),
      birth_date: birthISO, house: house.trim(), moo, relation: sanitizeInput(f.relation) || 'ผู้อาศัย',
      residency_type: f.type || '3', chronic: chronicVal || '-', vhv: sanitizeInput(f.vhv),
      updated_at: new Date().toISOString(), status: 'Active'
    });
    closeLoading(); setShowAddModal(false);
    if (!error) {
      const msg = isUpdate ? 'ย้ายมาบ้านนี้เรียบร้อย' : 'เพิ่มผู้อาศัยใหม่เรียบร้อย';
      swal({icon:'success',title:'สำเร็จ!',text:msg,showConfirmButton:false,timer:1500}).then(() => searchDataSilent());
    } else swal({icon:'error',title:'ไม่สำเร็จ',text:error.message});
  };
  const searchCidAuto = async () => {
    const cid = (addForm.cid || '').replace(/\D/g, '');
    if (cid.length !== 13) { swal({icon:'warning',title:'เลขบัตรต้องครบ 13 หลัก'}); return; }
    showLoading('กำลังค้นหา...');
    const { data } = await supabase.from('population').select('*').eq('cid', cid);
    closeLoading();
    if (data && data.length > 0) {
      const r = data[0]; const bd = r.birth_date ? new Date(r.birth_date) : null;
      // ✅ เก็บ person_id เดิมไว้ — เมื่อบันทึกจะ update แทน insert ใหม่
      setAddForm(prev => ({...prev,
        existingPersonId: r.person_id,
        title: r.title||prev.title, fname: r.fname||'', lname: r.lname||'',
        birth_day: bd ? String(bd.getDate()).padStart(2,'0') : '',
        birth_month: bd ? String(bd.getMonth()+1).padStart(2,'0') : '',
        birth_year: bd ? String(bd.getFullYear()+543) : '',
        chronic: r.chronic||'ปกติ (ไม่มีโรค)'
      }));
      swal({icon:'success',title:'พบข้อมูลเก่า',text:`เคยอยู่บ้าน ${r.house} ม.${r.moo}\nกดบันทึกเพื่อย้ายมาบ้านนี้`,timer:3000,showConfirmButton:false});
    } else {
      // ✅ ไม่พบ → ล้าง existingPersonId
      setAddForm(prev => ({...prev, existingPersonId: null}));
      swal({icon:'info',title:'ไม่พบข้อมูล',text:'เป็นรายชื่อใหม่',timer:1500,showConfirmButton:false});
    }
  };

  if (loading) return <div className="text-center py-5"><span className="spinner-border text-primary" /></div>;
  if (!user) return null;

  return (
    <>
      <TopBar showAdmin />
      <div className="container py-3" style={{maxWidth:600}}>
        <h5 className="text-center mb-3 fw-bold" style={{color:'var(--primary)'}}><i className="fa-solid fa-clipboard-user"/> ระบบสำรวจประชากร</h5>

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
                  {/* ✅ แสดงเฉพาะหมู่ที่มีสิทธิ์ */}
                  {visibleMoos.map(m => <option key={m} value={m}>หมู่ {m}</option>)}
                </select>
              </div>
              <div className="col-7">
                <label className="small text-muted fw-bold">เลขที่บ้าน</label>
                <input type="text" className="form-control" placeholder="ระบุเลขที่บ้าน" value={house} onChange={e => setHouse(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchData()} />
              </div>
              <div className="col-12 mt-3">
                <button onClick={searchData} className="btn w-100 rounded-pill text-white fw-bold" style={{background:'var(--primary)',padding:10}} disabled={searching}>
                  {searching ? <><span className="spinner-border spinner-border-sm me-1"/>ค้นหา...</> : <><i className="fa-solid fa-magnifying-glass me-1"/> ค้นหาข้อมูล</>}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ✅ คู่มือการใช้งาน — ครบ 4 ขั้นตอน + ปุ่มซ่อน/แสดง */}
        {showGuide && (
          <div className="card border-0 shadow-sm mt-3 fade-in" style={{borderRadius:16,background:'linear-gradient(135deg,#3949ab 0%,#7c4dff 100%)',overflow:'hidden'}}>
            <div className="card-body p-4">
              <h5 className="fw-bold text-white mb-4"><i className="fa-solid fa-book-open me-2"/> คู่มือการใช้งาน</h5>

              <div className="bg-white rounded-3 p-3 mb-3" style={{transition:'transform .2s'}}>
                <div className="d-flex align-items-start gap-3">
                  <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" style={{width:30,height:30,fontSize:'.85rem',fontWeight:'bold',flexShrink:0}}>1</div>
                  <div>
                    <h6 className="fw-bold text-primary mb-1"><i className="fa-solid fa-magnifying-glass me-1"/> ค้นหาข้อมูลบ้าน</h6>
                    <small className="text-muted">เลือกหมู่ → ระบุบ้านเลขที่ → กดค้นหา → ระบบแสดงรายชื่อผู้อาศัย</small>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-3 p-3 mb-3">
                <div className="d-flex align-items-start gap-3">
                  <div className="bg-success text-white rounded-circle d-flex align-items-center justify-content-center" style={{width:30,height:30,fontSize:'.85rem',fontWeight:'bold',flexShrink:0}}>2</div>
                  <div>
                    <h6 className="fw-bold text-success mb-1"><i className="fa-solid fa-user-check me-1"/> ปรับปรุงสถานะ (Type)</h6>
                    <div className="d-flex flex-wrap gap-1 mt-1">
                      <span className="badge bg-success">Type 1 มีชื่อ+อยู่จริง</span>
                      <span className="badge bg-warning text-dark">Type 2 มีชื่อ+ไม่อยู่</span>
                      <span className="badge bg-danger">Type 3 ไม่มีชื่อ+มาอยู่</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-3 p-3 mb-3">
                <div className="d-flex align-items-start gap-3">
                  <div className="bg-info text-white rounded-circle d-flex align-items-center justify-content-center" style={{width:30,height:30,fontSize:'.85rem',fontWeight:'bold',flexShrink:0}}>3</div>
                  <div>
                    <h6 className="fw-bold text-info mb-1"><i className="fa-solid fa-user-plus me-1"/> เพิ่มผู้อาศัยใหม่</h6>
                    <small className="text-muted">กดปุ่ม &quot;เพิ่มผู้อาศัย&quot; ด้านล่าง → กรอกข้อมูล → เลือก อสม.</small>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-3 p-3 mb-0">
                <div className="d-flex align-items-start gap-3">
                  <div className="bg-warning text-dark rounded-circle d-flex align-items-center justify-content-center" style={{width:30,height:30,fontSize:'.85rem',fontWeight:'bold',flexShrink:0}}>4</div>
                  <div>
                    <h6 className="fw-bold mb-1" style={{color:'#f59e0b'}}><i className="fa-solid fa-truck-moving me-1"/> ย้ายที่อยู่ / กรณีพิเศษ</h6>
                    <small className="text-muted">ย้ายบ้าน, เสียชีวิต, จำหน่าย, เปลี่ยน อสม. — กดปุ่มบนการ์ดแต่ละคน</small>
                  </div>
                </div>
              </div>

              <div className="text-center mt-3"><small className="text-white-50"><i className="fa-solid fa-headset me-1"/> พบปัญหา ติดต่อเจ้าหน้าที่ รพ.สต.</small></div>
            </div>
          </div>
        )}
        <div className="text-center mt-3 mb-3">
          <button onClick={() => setShowGuide(!showGuide)} className={`btn btn-sm ${showGuide ? 'btn-outline-primary' : 'btn-primary'} rounded-pill px-4`}>
            <i className={`fa-solid fa-eye${showGuide ? '-slash' : ''} me-1`}/> {showGuide ? 'ซ่อนคู่มือ' : 'แสดงคู่มือ'}
          </button>
        </div>

        {/* Results */}
        {results !== null && (
          <div>
            {results.length === 0 ? (
              <div className="card border-0 bg-light mt-3 text-center py-5 fade-in" style={{borderRadius:16}}>
                <i className="fa-solid fa-house-chimney-crack fa-4x text-secondary mb-3"/>
                <h5 className="fw-bold">ไม่พบข้อมูล</h5>
                <p className="text-muted">บ้านเลขที่ {house} หมู่ {moo}</p>
                <button onClick={() => openAddModal(house, moo, 'ไม่ระบุ')} className="btn btn-primary mt-2 rounded-pill px-4"><i className="fa-solid fa-plus-circle me-1"/> เพิ่มบ้านใหม่</button>
              </div>
            ) : (
              <>
                {/* ✅ Header + ปุ่มเปลี่ยน อสม. */}
                <div className="alert border-0 shadow-sm d-flex justify-content-between align-items-center mb-3" style={{background:'white',borderRadius:12}}>
                  <div>
                    <div className="small text-muted"><i className="fa-solid fa-location-dot text-primary"/> ม.{moo} บ้านเลขที่ {house}</div>
                    <div className="mt-1"><i className="fa-solid fa-user-nurse text-success"/> อสม: <strong>{results[0]?.vhv || 'ไม่ระบุ'}</strong></div>
                  </div>
                  <button onClick={openVhvModal} className="btn btn-sm btn-light border rounded-pill">เปลี่ยน</button>
                </div>
                <div className="mb-2 text-muted small">พบ <strong>{results.length}</strong> คน</div>
                {results.map(p => <PersonCard key={p.personId} person={p} onSave={handleSave} onMove={p => setMoveTarget(p)} onRefresh={searchData} />)}
                <div className="mt-4 border-top pt-3 fade-in">
                  <button onClick={() => openAddModal(house, moo, results[0]?.vhv || 'ไม่ระบุ')} className="btn btn-outline-primary w-100 dashed-border rounded-pill">
                    <i className="fa-solid fa-user-plus me-1"/> เพิ่มผู้อาศัย
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ✅ Move Modal */}
      {moveTarget && (
        <div className="modal fade show d-block" style={{background:'rgba(0,0,0,.5)'}}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content" style={{borderRadius:16,overflow:'hidden'}}>
              <div className="modal-header bg-warning text-dark"><h5 className="modal-title fw-bold"><i className="fa-solid fa-truck-moving"/> ย้ายที่อยู่</h5><button className="btn-close" onClick={() => setMoveTarget(null)}/></div>
              <div className="modal-body">
                <p>กำลังย้าย: <strong className="text-primary">{moveTarget.fullname}</strong></p>
                <div className="row g-2">
                  <div className="col-5"><label className="small fw-bold">ย้ายไปหมู่ที่</label><select className="form-select text-center" value={moveMoo} onChange={e => setMoveMoo(e.target.value)}><option value="" disabled>เลือก</option>{VALID_MOOS.map(m => <option key={m} value={m}>หมู่ {m}</option>)}</select></div>
                  <div className="col-7"><label className="small fw-bold">เลขที่บ้านใหม่</label><input type="text" className="form-control" value={moveHouse} onChange={e => setMoveHouse(e.target.value)} placeholder="บ้านเลขที่ใหม่" /></div>
                </div>
              </div>
              <div className="modal-footer"><button className="btn btn-secondary rounded-pill" onClick={() => setMoveTarget(null)}>ยกเลิก</button><button className="btn btn-warning rounded-pill fw-bold" onClick={handleMove}><i className="fa-solid fa-check me-1"/> ยืนยันย้าย</button></div>
            </div>
          </div>
        </div>
      )}
      {/* ✅ Add Person Modal */}
      {showAddModal && (
        <div className="modal fade show d-block" style={{background:'rgba(0,0,0,.5)',zIndex:1055}}>
          <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content border-0 shadow-lg" style={{borderRadius:16,overflow:'hidden'}}>
              <div className="modal-header text-white" style={{background:'var(--primary)'}}><h5 className="modal-title fw-bold"><i className="fa-solid fa-user-plus"/> เพิ่มผู้อาศัยใหม่</h5><button className="btn-close btn-close-white" onClick={()=>setShowAddModal(false)}/></div>
              <div className="modal-body p-4">
                <div className="alert alert-light py-2 mb-3 text-center border" style={{borderRadius:10}}><span className="fw-bold text-primary small"><i className="fa-solid fa-location-dot"/> บ้านเลขที่ {house} ม.{moo}</span></div>

                {/* อสม. */}
                <div className="mb-3 p-3 rounded-3" style={{background:'#e8eaf6'}}>
                  <label className="small fw-bold mb-2" style={{color:'var(--primary)'}}><i className="fa-solid fa-user-nurse"/> อสม. ผู้รับผิดชอบ</label>
                  <select className="form-select shadow-sm" value={addForm.vhv} onChange={e=>setAddForm({...addForm,vhv:e.target.value})} style={{borderColor:'var(--primary-light)'}}>
                    <option value="">-- เลือก อสม. --</option>
                    {(vhvData[moo]||[]).map(n=><option key={n} value={n}>{n}</option>)}
                  </select>
                </div>

                {/* CID */}
                <div className="mb-3"><label className="small fw-bold text-muted">เลขบัตรประชาชน (13 หลัก)</label>
                  <div className="input-group shadow-sm">
                    <input type="text" className="form-control" placeholder="ระบุเพื่อดึงข้อมูลเก่า" maxLength={13} inputMode="numeric" value={addForm.cid} onChange={e=>setAddForm({...addForm,cid:e.target.value})} />
                    <button className="btn btn-primary" onClick={searchCidAuto}><i className="fa-solid fa-magnifying-glass"/></button>
                  </div>
                </div>

                {/* Name */}
                <div className="row g-2 mb-3">
                  <div className="col-4"><label className="small fw-bold text-muted">คำนำหน้า</label>
                    <select className="form-select" value={addForm.title} onChange={e=>setAddForm({...addForm,title:e.target.value})}>
                      {['นาย','นาง','น.ส.','ด.ช.','ด.ญ.'].map(t=><option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="col-8"><label className="small fw-bold text-muted">ชื่อจริง <span className="text-danger">*</span></label>
                    <input type="text" className="form-control" placeholder="ชื่อ" value={addForm.fname} onChange={e=>setAddForm({...addForm,fname:e.target.value})} />
                  </div>
                </div>
                <div className="mb-3"><label className="small fw-bold text-muted">นามสกุล <span className="text-danger">*</span></label>
                  <input type="text" className="form-control" placeholder="นามสกุล" value={addForm.lname} onChange={e=>setAddForm({...addForm,lname:e.target.value})} />
                </div>

                {/* Birth Date (พ.ศ.) */}
                <div className="mb-3"><label className="small fw-bold text-muted">วันเกิด (พ.ศ.)</label>
                  <div className="row g-2">
                    <div className="col-3"><select className="form-select" value={addForm.birth_day} onChange={e=>setAddForm({...addForm,birth_day:e.target.value})}>
                      <option value="">วัน</option>{Array.from({length:31},(_,i)=>{const d=String(i+1).padStart(2,'0');return <option key={d} value={d}>{i+1}</option>;})}
                    </select></div>
                    <div className="col-5"><select className="form-select" value={addForm.birth_month} onChange={e=>setAddForm({...addForm,birth_month:e.target.value})}>
                      <option value="">เดือน</option>{[['01','ม.ค.'],['02','ก.พ.'],['03','มี.ค.'],['04','เม.ย.'],['05','พ.ค.'],['06','มิ.ย.'],['07','ก.ค.'],['08','ส.ค.'],['09','ก.ย.'],['10','ต.ค.'],['11','พ.ย.'],['12','ธ.ค.']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                    </select></div>
                    <div className="col-4"><select className="form-select" value={addForm.birth_year} onChange={e=>setAddForm({...addForm,birth_year:e.target.value})}>
                      <option value="">พ.ศ.</option>{Array.from({length:120},(_,i)=>{const y=new Date().getFullYear()+543-i;return <option key={y} value={y}>{y}</option>;})}
                    </select></div>
                  </div>
                </div>

                {/* Relation + Type */}
                <div className="row g-2 mb-3">
                  <div className="col-6"><label className="small fw-bold text-muted">สถานะในบ้าน</label>
                    <select className="form-select" value={addForm.relation} onChange={e=>setAddForm({...addForm,relation:e.target.value})}>
                      {['ผู้อาศัย','เจ้าบ้าน','เขย/สะใภ้','หลาน','เช่าอาศัย','อื่นๆ'].map(r=><option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="col-6"><label className="small fw-bold" style={{color:'var(--primary)'}}>ประเภทประชากร</label>
                    <select className="form-select fw-bold" value={addForm.type} onChange={e=>setAddForm({...addForm,type:e.target.value})} style={{borderColor:'var(--primary-light)'}}>
                      <option value="3">Type 3 (ไม่มีชื่อ+มาอยู่)</option><option value="1">Type 1 (มีชื่อ+อยู่จริง)</option><option value="2">Type 2 (มีชื่อ+ไม่อยู่)</option><option value="0">Type 0 (นอกเขต)</option>
                    </select>
                  </div>
                </div>

                {/* Chronic */}
                <div className="mb-1"><label className="small fw-bold text-muted">โรคประจำตัว</label>
                  <select className="form-select" value={addForm.chronic} onChange={e=>setAddForm({...addForm,chronic:e.target.value})}>
                    {CHRONIC_LIST.map(c=><option key={c} value={c}>{c}</option>)}
                    <option value="__OTHER__">อื่นๆ (ระบุ)</option>
                  </select>
                  {addForm.chronic==='__OTHER__' && <input type="text" className="form-control mt-1" placeholder="ระบุโรคประจำตัว..." value={addForm.chronicOther} onChange={e=>setAddForm({...addForm,chronicOther:e.target.value})} />}
                </div>
              </div>
              <div className="modal-footer" style={{background:'#f8f9fa'}}>
                <button className="btn btn-outline-secondary rounded-pill px-4" onClick={()=>setShowAddModal(false)}>ยกเลิก</button>
                <button className="btn rounded-pill px-4 text-white" style={{background:'var(--primary)'}} onClick={submitNewPerson}><i className="fa-solid fa-save me-1"/> บันทึก</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✅ VHV Change Modal — เลือกจาก vhv_data ใน Supabase */}
      {showVhvModal && (
        <div className="modal fade show d-block" style={{background:'rgba(0,0,0,.5)',zIndex:1060}}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content" style={{borderRadius:16,overflow:'hidden'}}>
              <div className="modal-header text-white" style={{background:'var(--primary)'}}>
                <h5 className="modal-title fw-bold"><i className="fa-solid fa-user-nurse me-2"/> เปลี่ยน อสม.</h5>
                <button className="btn-close btn-close-white" onClick={() => setShowVhvModal(false)} />
              </div>
              <div className="modal-body">
                <div className="alert alert-light border py-2 mb-3 text-center" style={{borderRadius:10}}>
                  <small className="text-primary fw-bold"><i className="fa-solid fa-location-dot me-1"/> บ้านเลขที่ {vhvHouse} ม.{vhvMoo}</small>
                </div>
                <label className="small fw-bold text-muted mb-2"><i className="fa-solid fa-user-nurse text-success me-1"/> เลือก อสม. ใหม่</label>
                <select className="form-select form-select-lg" value={selectedVhv} onChange={e => setSelectedVhv(e.target.value)} style={{borderColor:'var(--primary-light)'}}>
                  <option value="">-- เลือก อสม. --</option>
                  {(vhvData[vhvMoo] || []).map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <div className="alert alert-info border-0 mt-3 small mb-0" style={{borderRadius:10}}>
                  <i className="fa-solid fa-info-circle me-1"/> ระบบจะเปลี่ยน อสม. ให้ทุกคนในบ้านนี้
                </div>
              </div>
              <div className="modal-footer" style={{background:'#f8f9fa'}}>
                <button className="btn btn-outline-secondary rounded-pill px-4" onClick={() => setShowVhvModal(false)}>ยกเลิก</button>
                <button className="btn rounded-pill px-4 text-white fw-bold" style={{background:'var(--primary)'}} onClick={submitVhvChange} disabled={!selectedVhv}>
                  <i className="fa-solid fa-save me-1"/> บันทึก
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
