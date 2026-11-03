'use client';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { supabase, selectAll } from '@/lib/supabase';
import { dashboardStats } from '@/lib/dashboard-summary.mjs';
import {
  buildProactiveAnalytics,
  computeMooAgeAndVulnerability,
  buildDrilldownList,
} from '@/lib/proactive-dashboard.mjs';

import TopBar from '@/components/TopBar';
import LocalAiAssistant from '@/components/LocalAiAssistant';

const PROACTIVE_POPULATION_COLUMNS =
  'person_id,title,fname,lname,birth_date,moo,house,vhv,residency_type,person_discharge_id,status_model_version,chronic,adl_score,latitude,longitude,hep_screen,fobt_screen,hpv_screen,child_dev';

// ─── Chart wrapper ───
function ChartCanvas({ id, style }) {
  return <div style={{ position: 'relative', ...style }}><canvas id={id} /></div>;
}

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [proactive, setProactive] = useState(null);
  const [proactiveLoading, setProactiveLoading] = useState(false);
  const [dashLoading, setDashLoading] = useState(true);
  const [selectedMoo, setSelectedMoo] = useState('all');
  const [vhvMooFilter, setVhvMooFilter] = useState('all');
  const [vhvSearch, setVhvSearch] = useState('');
  const [drilldown, setDrilldown] = useState(null); // { filterKey, moo, vhv }
  const [drilldownSearch, setDrilldownSearch] = useState('');

  const chartsRef = useRef({});
  const requestRef = useRef(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  // จำกัดหมู่เริ่มต้นสำหรับ อสม.
  useEffect(() => {
    if (user?.role === 'vhv' && user?.moo) {
      const firstMoo = String(user.moo).split(',').map(m => m.trim()).filter(Boolean)[0];
      if (firstMoo) {
        setSelectedMoo(firstMoo);
        setVhvMooFilter(firstMoo);
      }
    }
  }, [user]);

  const loadDashboard = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 30000);
    setDashLoading(true);
    setProactiveLoading(true);
    setLoadError('');
    try {
      const { data: summary, error } = await supabase.rpc('dashboard_summary').abortSignal(controller.signal);
      if (error) throw error;
      if (requestRef.current === controller) {
        setData(dashboardStats(summary));
      }

      // โหลดข้อมูลเชิงรุก (กลุ่มเปราะบาง, ปิรามิดรายหมู่บ้าน, ตารางจัดอันดับ อสม., และ Drill-down โดยไม่ดึง cid)
      selectAll('population', PROACTIVE_POPULATION_COLUMNS)
        .then(rows => {
          if (requestRef.current === controller) {
            setProactive(buildProactiveAnalytics(rows || []));
            setProactiveLoading(false);
          }
        })
        .catch(() => {
          if (requestRef.current === controller) {
            setProactiveLoading(false);
          }
        });
    } catch {
      if (requestRef.current === controller) {
        setLoadError('โหลดสถิติไม่สำเร็จ กรุณาลองรีเฟรช หากยังไม่ได้ให้ตรวจการติดตั้ง Dashboard migration');
        setProactiveLoading(false);
      }
    } finally {
      clearTimeout(timeout);
      if (requestRef.current === controller) setDashLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadDashboard();
    return () => {
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, [user, loadDashboard]);

  // คำนวณข้อมูลกลุ่มเปราะบาง + ปิรามิดประชากร + 4 ช่วงวัย ตามหมู่บ้านที่เลือก
  const activeMooStats = useMemo(() => {
    if (!proactive) return null;
    return computeMooAgeAndVulnerability(proactive.records, proactive.houseMap, selectedMoo);
  }, [proactive, selectedMoo]);

  // รายชื่อสำหรับหน้าต่าง Modal Drill-down
  const activeDrilldownData = useMemo(() => {
    if (!proactive || !drilldown) return null;
    return buildDrilldownList(proactive.records, proactive.houseMap, drilldown);
  }, [proactive, drilldown]);

  const filteredDrilldownItems = useMemo(() => {
    if (!activeDrilldownData) return [];
    const q = drilldownSearch.trim().toLowerCase();
    if (!q) return activeDrilldownData.items;
    return activeDrilldownData.items.filter(item =>
      (item.fullname || '').toLowerCase().includes(q) ||
      String(item.house || '').toLowerCase().includes(q) ||
      String(item.vhv || '').toLowerCase().includes(q) ||
      String(item.chronic || '').toLowerCase().includes(q)
    );
  }, [activeDrilldownData, drilldownSearch]);

  // กรองตารางจัดอันดับ อสม.
  const filteredVhvLeaderboard = useMemo(() => {
    if (!proactive?.vhvLeaderboard) return [];
    return proactive.vhvLeaderboard.filter(v => {
      if (vhvMooFilter !== 'all' && !v.moos.includes(String(vhvMooFilter))) return false;
      if (vhvSearch.trim() && !v.name.toLowerCase().includes(vhvSearch.trim().toLowerCase())) return false;
      return true;
    });
  }, [proactive, vhvMooFilter, vhvSearch]);

  const openDrilldown = (filterKey, moo = selectedMoo, vhv = '') => {
    setDrilldownSearch('');
    setDrilldown({ filterKey, moo, vhv });
  };

  // ─── Draw all charts when data changes ───
  useEffect(() => {
    if (!data || typeof window === 'undefined') return;
    import('chart.js/auto').then(({ default: Chart }) => {
      Object.values(chartsRef.current).forEach(c => c?.destroy?.());
      chartsRef.current = {};
      const mk = (id, cfg) => {
        const el = document.getElementById(id);
        if (el) {
          chartsRef.current[id] = new Chart(el, cfg);
        }
      };
      const d = data;
      const pyramidSource = activeMooStats?.pyramid || d.pyramid;

      // 1. Pie (Type)
      mk('pieChart', { type:'doughnut', data:{ labels:['Type 1','Type 2','Type 3','Type 0: ในเขตไม่ตามทะเบียน','ยังไม่สำรวจ'], datasets:[{data:[d.type1,d.type2,d.type3,d.type0,d.unsurveyed],backgroundColor:['#198754','#f59e0b','#dc3545','#6b7280','#e5e7eb'],borderColor:'#fff',borderWidth:2}]}, options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{usePointStyle:true,font:{family:'Sarabun',size:11}}}}}});

      // 2. Pyramid (รองรับแยกตามหมู่บ้าน)
      mk('pyramidChart', {type:'bar',data:{labels:pyramidSource.labels,datasets:[{label:'ชาย',data:pyramidSource.male.map(v=>-v),backgroundColor:'#60a5fa',borderRadius:4},{label:'หญิง',data:pyramidSource.female,backgroundColor:'#f472b6',borderRadius:4}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,scales:{x:{stacked:true,ticks:{callback:v=>Math.abs(v)}},y:{stacked:true}},plugins:{tooltip:{callbacks:{label:c=>c.dataset.label+': '+Math.abs(c.raw)+' คน'}},legend:{position:'bottom'}}}});

      // 3. Bar (by Moo)
      const mooKeys = Object.keys(d.byMoo).sort((a,b)=>a-b);
      mk('barChart', {type:'bar',data:{labels:mooKeys.map(k=>'หมู่ '+k),datasets:[{label:'ประชากร',data:mooKeys.map(k=>d.byMoo[k].total),backgroundColor:'#3949ab',borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}});

      // 4. Stacked Bar (Type per Moo)
      mk('stackedBarChart', {type:'bar',data:{labels:mooKeys.map(k=>'หมู่ '+k),datasets:[{label:'T0',data:mooKeys.map(k=>d.byMoo[k].type0),backgroundColor:'#64748b'},{label:'T1',data:mooKeys.map(k=>d.byMoo[k].type1),backgroundColor:'#198754'},{label:'T2',data:mooKeys.map(k=>d.byMoo[k].type2),backgroundColor:'#f59e0b'},{label:'T3',data:mooKeys.map(k=>d.byMoo[k].type3),backgroundColor:'#dc3545'},{label:'ยังไม่สำรวจ',data:mooKeys.map(k=>d.byMoo[k].unsurveyed||0),backgroundColor:'#e5e7eb'}]},options:{responsive:true,maintainAspectRatio:false,scales:{x:{stacked:true},y:{stacked:true}},plugins:{legend:{position:'bottom',labels:{usePointStyle:true}}}}});

      // 5. Smoke Doughnut
      const r = d.risk;
      mk('smokeChart', {type:'doughnut',data:{labels:['ไม่สูบ/ไม่เคย','เลิกแล้ว','สูบอยู่','ยังไม่คัดกรอง'],datasets:[{data:[r.smoking.neverSmoked,r.smoking.quit,r.smoking.current,r.target15plus-r.smokeSurveyed],backgroundColor:['#10b981','#f59e0b','#ef4444','#e5e7eb'],borderWidth:2,borderColor:'#fff'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{usePointStyle:true,font:{family:'Sarabun',size:11}}}}}});

      // 6. Alcohol Doughnut
      mk('alcoChart', {type:'doughnut',data:{labels:['ไม่ดื่ม/ไม่เคย','เลิกแล้ว','ดื่มอยู่','ยังไม่คัดกรอง'],datasets:[{data:[r.alcohol.neverDrank,r.alcohol.quit,r.alcohol.current,r.target15plus-r.alcSurveyed],backgroundColor:['#10b981','#f59e0b','#3b82f6','#e5e7eb'],borderWidth:2,borderColor:'#fff'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{usePointStyle:true,font:{family:'Sarabun',size:11}}}}}});

      // 7. Fagerstrom Bar
      mk('fagerChart', {type:'bar',data:{labels:['ติดน้อย (0-3)','ปานกลาง (4-6)','ติดมาก (7-10)'],datasets:[{label:'คน',data:[r.fagerstrom.low,r.fagerstrom.medium,r.fagerstrom.high],backgroundColor:['#10b981','#f59e0b','#ef4444'],borderRadius:8}]},options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{beginAtZero:true}}}});

      // 8. ASSIST Bar
      mk('assistChart', {type:'bar',data:{labels:['เสี่ยงต่ำ (0-10)','ปานกลาง (11-26)','สูง (27+)'],datasets:[{label:'คน',data:[r.assist.low,r.assist.medium,r.assist.high],backgroundColor:['#10b981','#f59e0b','#ef4444'],borderRadius:8}]},options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{beginAtZero:true}}}});

      // 9. Smoke By Moo
      mk('smokeByMooChart', {type:'bar',data:{labels:r.byMoo.map(m=>'ม.'+m.moo),datasets:[{label:'สูบอยู่',data:r.byMoo.map(m=>m.smoker),backgroundColor:'#ef4444'},{label:'เลิกแล้ว',data:r.byMoo.map(m=>m.smokeQuit),backgroundColor:'#f59e0b'},{label:'ไม่สูบ',data:r.byMoo.map(m=>m.smokeNever),backgroundColor:'#10b981'},{label:'ยังไม่คัดกรอง',data:r.byMoo.map(m=>m.target-m.smokeSurveyed),backgroundColor:'#e5e7eb'}]},options:{responsive:true,maintainAspectRatio:false,scales:{x:{stacked:true},y:{stacked:true}},plugins:{legend:{position:'bottom',labels:{usePointStyle:true}}}}});

      // 10. Alcohol By Moo
      mk('alcByMooChart', {type:'bar',data:{labels:r.byMoo.map(m=>'ม.'+m.moo),datasets:[{label:'ดื่มอยู่',data:r.byMoo.map(m=>m.drinker),backgroundColor:'#3b82f6'},{label:'เลิกแล้ว',data:r.byMoo.map(m=>m.alcQuit),backgroundColor:'#f59e0b'},{label:'ไม่ดื่ม',data:r.byMoo.map(m=>m.alcNever),backgroundColor:'#10b981'},{label:'ยังไม่คัดกรอง',data:r.byMoo.map(m=>m.target-m.alcSurveyed),backgroundColor:'#e5e7eb'}]},options:{responsive:true,maintainAspectRatio:false,scales:{x:{stacked:true},y:{stacked:true}},plugins:{legend:{position:'bottom',labels:{usePointStyle:true}}}}});

      // 11. KPI By Moo
      if (d.kpiByMoo.length > 0) {
        mk('kpiByMooChart', {type:'bar',data:{labels:d.kpiByMoo.map(m=>'ม.'+m.moo),datasets:[
          {label:'HEP คัดกรองแล้ว',data:d.kpiByMoo.map(m=>m.hepScreened),backgroundColor:'#0891b2',stack:'hep'},
          {label:'HEP ยังไม่คัดกรอง',data:d.kpiByMoo.map(m=>m.hepTotal-m.hepScreened),backgroundColor:'#e5e7eb',stack:'hep'},
          {label:'FOBT คัดกรองแล้ว',data:d.kpiByMoo.map(m=>m.fobtScreened),backgroundColor:'#d97706',stack:'fobt'},
          {label:'FOBT ยังไม่คัดกรอง',data:d.kpiByMoo.map(m=>m.fobtTotal-m.fobtScreened),backgroundColor:'#e5e7eb',stack:'fobt'},
          {label:'HPV คัดกรองแล้ว',data:d.kpiByMoo.map(m=>m.hpvScreened),backgroundColor:'#db2777',stack:'hpv'},
          {label:'HPV ยังไม่คัดกรอง',data:d.kpiByMoo.map(m=>m.hpvTotal-m.hpvScreened),backgroundColor:'#e5e7eb',stack:'hpv'},
          {label:'พัฒนาการ คัดกรองแล้ว',data:d.kpiByMoo.map(m=>m.childScreened),backgroundColor:'#059669',stack:'child'},
          {label:'พัฒนาการ ยังไม่คัดกรอง',data:d.kpiByMoo.map(m=>m.childTotal-m.childScreened),backgroundColor:'#e5e7eb',stack:'child'},
        ]},options:{responsive:true,maintainAspectRatio:false,scales:{x:{stacked:true},y:{stacked:true}},plugins:{legend:{position:'bottom',labels:{usePointStyle:true,filter:i=>!i.text.includes('ยังไม่')}}}}});
      }
    });
    return () => { Object.values(chartsRef.current).forEach(c => c?.destroy?.()); };
  }, [data]);

  // อัปเดตกราฟปิรามิดประชากรทันทีเมื่อเปลี่ยนตัวกรองหมู่บ้าน
  useEffect(() => {
    const chart = chartsRef.current?.pyramidChart;
    if (!chart || !activeMooStats?.pyramid) return;
    chart.data.labels = activeMooStats.pyramid.labels;
    chart.data.datasets[0].data = activeMooStats.pyramid.male.map(v => -v);
    chart.data.datasets[1].data = activeMooStats.pyramid.female;
    chart.update();
  }, [activeMooStats]);

  const pct = (n, d) => (d > 0 ? ((n / d) * 100).toFixed(1) : '0.0');
  if (loading || !user) return <div className="text-center py-5"><span className="spinner-border text-primary"/></div>;
  const d = data;
  const mooList = proactive?.mooList || (d ? Object.keys(d.byMoo).sort((a, b) => Number(a) - Number(b)) : []);

  return (
    <>
      <TopBar showAdmin />
      <div className="container-fluid px-2 px-md-4">
        <div className="dashboard-container fade-in">
          <div className="text-center mb-4 pt-2">
            <h4 className="fw-bold" style={{color:'var(--primary)',fontFamily:"'Prompt',sans-serif"}}>
              <i className="fa-solid fa-chart-line me-1"/> Dashboard ประชากร &amp; ใบงานเชิงรุก
            </h4>
            <p className="text-muted small mb-0">รพ.สต.บ้านโนนสว่าง • คลิกที่ตัวเลขเพื่อเปิดรายชื่อหลังคาเรือนหรือดูพิกัดบนแผนที่ทันที</p>
          </div>
          <div className="row mb-4 justify-content-center">
            <div className="col-12 col-md-8">
              <div className="d-flex flex-wrap gap-2">
                <a href="/" className="btn btn-outline-primary flex-fill rounded-pill">
                  <i className="fa-solid fa-magnifying-glass me-1"/>สำรวจครัวเรือน
                </a>
                <a href={`/map?moo=${selectedMoo}`} className="btn btn-outline-success flex-fill rounded-pill">
                  <i className="fa-solid fa-map-location-dot me-1"/>แผนที่หลังคาเรือน GIS
                </a>
                <button onClick={loadDashboard} className="btn flex-fill rounded-pill text-white" style={{background:'var(--primary)'}} disabled={dashLoading}>
                  {dashLoading?<><span className="spinner-border spinner-border-sm me-1"/>โหลด...</>:<><i className="fa-solid fa-rotate me-1"/>รีเฟรชข้อมูล</>}
                </button>
              </div>
            </div>
          </div>

          {loadError&&<div className="alert alert-danger" role="alert">{loadError}{data&&' • กำลังแสดงสถิติจากการโหลดครั้งก่อน'}</div>}
          {/* Local AI Assistant */}
          {d && <LocalAiAssistant dashboard={d} defaultFocus="overview" />}

          {/* ═══════════════════════════════════════════════════════════════════════
              1. การ์ด "กลุ่มเปราะบางประจำหมู่บ้าน (Vulnerability Watchlist)" + ตัวกรองหมู่บ้าน
             ═══════════════════════════════════════════════════════════════════════ */}
          <div className="card border-0 shadow-sm rounded-4 p-3 p-md-4 mb-4" style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)' }}>
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <div>
                <h5 className="fw-bold mb-1" style={{ color: '#b91c1c' }}>
                  <i className="fa-solid fa-shield-heart me-2" />
                  กลุ่มเปราะบางประจำหมู่บ้าน (Vulnerability Watchlist)
                </h5>
                <div className="text-muted small">
                  ช่วยวางแผนเยี่ยมบ้านฉุกเฉิน ภัยพิบัติ และการดูแลระยะยาว (LTC) • <strong>คลิกที่การ์ดเพื่อดูรายชื่อหรือเปิดแผนที่ทันที</strong>
                </div>
              </div>
              <div className="d-flex align-items-center gap-2">
                <span className="small fw-bold text-secondary text-nowrap">
                  <i className="fa-solid fa-filter me-1" />เลือกหมู่บ้าน:
                </span>
                <select
                  className="form-select form-select-sm rounded-pill fw-bold"
                  style={{ minWidth: 165, borderColor: '#cbd5e1' }}
                  value={selectedMoo}
                  onChange={e => setSelectedMoo(e.target.value)}
                >
                  <option value="all">ทุกหมู่บ้าน (รวมทั้งตำบล)</option>
                  {mooList.map(m => (
                    <option key={m} value={m}>หมู่ที่ {m}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="row g-2 g-md-3">
              {[
                {
                  key: 'bedridden',
                  title: 'ผู้สูงอายุติดเตียง',
                  sub: 'ADL 0–4 คะแนน',
                  val: activeMooStats?.watchlist?.bedridden?.length,
                  icon: 'bed-pulse',
                  color: '#dc2626',
                  bg: '#fef2f2',
                  border: '#fecaca',
                  unit: 'คน',
                },
                {
                  key: 'homebound',
                  title: 'ผู้สูงอายุติดบ้าน',
                  sub: 'ADL 5–11 คะแนน',
                  val: activeMooStats?.watchlist?.homebound?.length,
                  icon: 'house-medical-flag',
                  color: '#ea580c',
                  bg: '#fff7ed',
                  border: '#fed7aa',
                  unit: 'คน',
                },
                {
                  key: 'living_alone',
                  title: 'ผู้สูงอายุอยู่คนเดียว',
                  sub: 'บ้านมีสมาชิก Type 1 เพียง 1 คน (60+)',
                  val: activeMooStats?.watchlist?.livingAlone?.length,
                  icon: 'person-shelter',
                  color: '#7c3aed',
                  bg: '#f5f3ff',
                  border: '#ddd6fe',
                  unit: 'คน',
                },
                {
                  key: 'child_pending',
                  title: 'เด็ก 0–5 ปี ค้างพัฒนาการ',
                  sub: 'ยังไม่ได้ตรวจ DSPM (child_dev)',
                  val: activeMooStats?.watchlist?.childPending?.length,
                  icon: 'baby',
                  color: '#059669',
                  bg: '#ecfdf5',
                  border: '#a7f3d0',
                  unit: 'คน',
                },
                {
                  key: 'multi_chronic',
                  title: 'โรคเรื้อรังซับซ้อน',
                  sub: 'มีโรคประจำตัวตั้งแต่ 2 โรคขึ้นไป',
                  val: activeMooStats?.watchlist?.multiChronic?.length,
                  icon: 'heart-circle-exclamation',
                  color: '#be123c',
                  bg: '#fff1f2',
                  border: '#fecdd3',
                  unit: 'คน',
                },
                {
                  key: 'missing_gps',
                  title: 'บ้านยังไม่มีพิกัด GPS',
                  sub: 'หลังคาเรือนที่ยังไม่ได้ปักหมุด',
                  val: activeMooStats?.watchlist?.missingGpsHouses?.length,
                  icon: 'location-pin-lock',
                  color: '#475569',
                  bg: '#f1f5f9',
                  border: '#cbd5e1',
                  unit: 'หลัง',
                },
              ].map(card => (
                <div className="col-6 col-md-4 col-xl-2" key={card.key}>
                  <button
                    type="button"
                    onClick={() => openDrilldown(card.key, selectedMoo)}
                    className="w-100 text-start p-3 rounded-4 h-100 transition-all position-relative"
                    style={{
                      background: card.bg,
                      border: `1.5px solid ${card.border}`,
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(15,23,42,0.04)',
                    }}
                  >
                    <div className="d-flex justify-content-between align-items-start mb-1">
                      <span className="fw-bold small" style={{ color: card.color }}>{card.title}</span>
                      <i className={`fa-solid fa-${card.icon}`} style={{ color: card.color, fontSize: '1.15rem' }} />
                    </div>
                    <div className="d-flex align-items-baseline gap-1 my-1">
                      <span className="h3 fw-bold mb-0" style={{ color: card.color }}>
                        {proactiveLoading && !activeMooStats ? <span className="spinner-border spinner-border-sm" /> : (card.val ?? 0)}
                      </span>
                      <span className="small text-muted">{card.unit}</span>
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.73rem', lineHeight: 1.25 }}>{card.sub}</div>
                    <div className="mt-2 pt-1 border-top d-flex justify-content-between align-items-center" style={{ borderColor: card.border, fontSize: '0.72rem', color: card.color }}>
                      <span className="fw-bold">คลิกดูรายชื่อ/แผนที่</span>
                      <i className="fa-solid fa-arrow-up-right-from-square" />
                    </div>
                  </button>
                </div>
              ))}
            </div>

            {/* สรุปโครงสร้าง 4 ช่วงวัย ของหมู่บ้านที่เลือก */}
            {activeMooStats && (
              <div className="mt-3 pt-3 border-top">
                <div className="d-flex flex-wrap justify-content-between align-items-center mb-2">
                  <span className="small fw-bold text-secondary">
                    <i className="fa-solid fa-users-viewfinder me-1 text-primary" />
                    โครงสร้างประชากรอาศัยจริง (Type 1+3) {selectedMoo === 'all' ? 'ทั้งตำบลโนนสว่าง' : `หมู่ที่ ${selectedMoo}`} — รวม {activeMooStats.totalActive.toLocaleString()} คน ({activeMooStats.totalHouses.toLocaleString()} หลังคาเรือน)
                  </span>
                  <span className="badge rounded-pill bg-warning text-dark">
                    สัดส่วนผู้สูงอายุ 60+ : {pct(activeMooStats.ageGroups.elderly60plus, activeMooStats.totalActive)}%
                  </span>
                </div>
                <div className="row g-2">
                  {[
                    { label: 'วัยเด็กเล็ก (0–5 ปี)', count: activeMooStats.ageGroups.child0to5, color: '#059669', icon: 'baby' },
                    { label: 'วัยเรียน (6–14 ปี)', count: activeMooStats.ageGroups.school6to14, color: '#0284c7', icon: 'Child-reaching' },
                    { label: 'วัยทำงาน (15–59 ปี)', count: activeMooStats.ageGroups.working15to59, color: '#4f46e5', icon: 'briefcase' },
                    { label: 'ผู้สูงอายุ (60+ ปี)', count: activeMooStats.ageGroups.elderly60plus, color: '#d97706', icon: 'person-cane' },
                  ].map(g => (
                    <div className="col-6 col-md-3" key={g.label}>
                      <div className="p-2 px-3 rounded-3 bg-white border d-flex justify-content-between align-items-center">
                        <div>
                          <div className="text-muted" style={{ fontSize: '0.75rem' }}>{g.label}</div>
                          <div className="fw-bold" style={{ color: g.color, fontSize: '1.05rem' }}>
                            {g.count.toLocaleString()} <span className="small fw-normal text-muted">คน ({pct(g.count, activeMooStats.totalActive)}%)</span>
                          </div>
                        </div>
                        <i className={`fa-solid fa-${g.icon.toLowerCase()} opacity-50`} style={{ color: g.color, fontSize: '1.3rem' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Insight */}
          <div className="row g-2 g-md-3 mb-4">
            {[{l:'วัยเด็ก (0-14)',v:d?.insight?.children,i:'child',b:'bg-gradient-primary'},{l:'วัยทำงาน',v:d?.insight?.working,i:'briefcase',b:'bg-gradient-success'},{l:'สูงอายุ (60+)',v:d?.insight?.elderly,i:'person-cane',b:'bg-gradient-warning'},{l:'อัตราพึ่งพิง',v:d?d.insight.dependencyRatio+'%':'-',i:'scale-unbalanced',b:'bg-gradient-danger'}].map(({l,v,i,b})=><div className="col-6 col-md-3" key={l}><div className={`card card-insight ${b} p-3 h-100`}><div className="d-flex justify-content-between"><div><div className="small text-white-50">{l}</div><div className="h3 fw-bold mb-0">{v??<span className="num-spin"/>}</div></div><i className={`fa-solid fa-${i} fa-2x text-white-50`}/></div></div></div>)}
          </div>

          {/* Type Stats */}
          <div className="row g-2 g-md-3 row-cols-2 row-cols-md-3 row-cols-lg-6 mb-4">
            {[{l:'ทั้งหมด',v:d?.total,i:'users',c:'total'},{l:'Type 1',v:d?.type1,i:'house-user',c:'type1'},{l:'Type 2',v:d?.type2,i:'person-walking',c:'type2'},{l:'Type 3',v:d?.type3,i:'user-plus',c:'type3'},{l:'Type 0 ในเขตไม่ตามทะเบียน',v:d?.type0,i:'house',c:'type0'},{l:'นอกเขต (Type 4)',v:d?.outside,i:'map',c:'type0'},{l:'จำหน่าย/รอตรวจเหตุ',v:d?.discharged,i:'user-xmark',c:'type0'},{l:'เสียชีวิต',v:d?.deceased,i:'user-minus',c:'type0'}].map(({l,v,i,c})=><div className={c==='total'?'col-12 col-md-4 col-lg-2':'col'} key={l}><div className={`stat-card ${c}`}><i className={`fa-solid fa-${i} stat-icon`}/><div className="stat-label">{l}</div><div className="stat-number">{v??<span className="num-spin"/>}</div></div></div>)}
            <div className="col"><div className="stat-card" style={{borderLeftColor:'#e5e7eb',background:'#f9fafb'}}><i className="fa-solid fa-question stat-icon" style={{color:'#9ca3af'}}/><div className="stat-label" style={{color:'#9ca3af'}}>ยังไม่สำรวจ</div><div className="stat-number" style={{color:'#9ca3af'}}>{d?.unsurveyed??<span className="num-spin"/>}</div></div></div>
          </div>

          {/* KPI Cards (Clickable Drill-down) */}
          <div className="row g-3 mb-4">
            <div className="col-12 d-flex flex-wrap justify-content-between align-items-center">
              <h5 className="fw-bold mb-0" style={{color:'var(--primary)'}}>
                <i className="fa-solid fa-bullseye me-2"/> ตัวชี้วัด KPI (คลิกที่การ์ดเพื่อดูรายชื่อผู้ค้างคัดกรอง)
              </h5>
              <span className="small text-muted">คลิกการ์ดแต่ละตัวเพื่อออกใบงานเชิงรุก</span>
            </div>
            {[
              {t:'HBV/HCV (เกิดก่อน 2535)',i:'virus',co:'#0891b2',kpi:d?.kpi?.hep,fk:'hep_pending'},
              {t:'Fit test มะเร็งลำไส้ (50-70 ปี)',i:'microscope',co:'#d97706',kpi:d?.kpi?.fobt,fk:'fobt_pending'},
              {t:'HPV DNA (สตรี 30-60 ปี)',i:'dna',co:'#db2777',kpi:d?.kpi?.hpv,fk:'hpv_pending'},
              {t:'พัฒนาการเด็ก (0-5 ปี)',i:'baby',co:'#059669',kpi:d?.kpi?.child?{total:d.kpi.child.total,screened:d.kpi.child.normal}:null,fk:'child_pending'},
            ].map(({t,i,co,kpi,fk})=>{
              const pendingCount = kpi ? Math.max(0, (kpi.total || 0) - (kpi.screened || 0)) : 0;
              return (
                <div className="col-12 col-md-6 col-lg-3" key={t}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => openDrilldown(fk, selectedMoo)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') openDrilldown(fk, selectedMoo); }}
                    className="kpi-card position-relative h-100"
                    style={{borderLeftColor:co,background:`linear-gradient(135deg,#fff,${co}15)`,cursor:'pointer'}}
                  >
                    <i className={`fa-solid fa-${i} kpi-icon`} style={{color:co}}/>
                    <div className="small text-muted fw-bold">{t}</div>
                    <div className="kpi-percent">{kpi?pct(kpi.screened||0,kpi.total||0):<span className="num-spin"/>}<span style={{fontSize:'1.8rem'}}>%</span></div>
                    <div className="small text-muted">{kpi?`คัดกรองแล้ว ${kpi.screened||0} / ${kpi.total||0} คน`:'โหลด...'}</div>
                    <div className="progress mt-2" style={{height:6}}>
                      <div className="progress-bar" style={{width:`${kpi?pct(kpi.screened||0,kpi.total||0):0}%`,background:co,transition:'width .8s ease-in-out'}}/>
                    </div>
                    {kpi && (
                      <div className="mt-2 d-flex justify-content-between align-items-center small fw-bold" style={{ color: co }}>
                        <span>ค้างตรวจ {pendingCount.toLocaleString()} คน</span>
                        <span>ดูรายชื่อ/แผนที่ <i className="fa-solid fa-chevron-right ms-1"/></span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ═══════════════════════════════════════════════════════════════════════
              4. ตารางใบงานเชิงรุก: คลิกตัวเลขค้างคัดกรองรายหมู่บ้านแล้วเด้งดูรายชื่อ/แผนที่ทันที (Drill-down)
             ═══════════════════════════════════════════════════════════════════════ */}
          {proactive?.kpiPendingByMoo?.length > 0 && (
            <div className="card border-0 shadow-sm rounded-4 p-3 p-md-4 mb-4">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                <div>
                  <h5 className="fw-bold mb-1" style={{ color: '#0f766e' }}>
                    <i className="fa-solid fa-table-list me-2" />
                    ตารางใบงานค้างคัดกรอง 4 KPI &amp; กลุ่มเปราะบาง แยกรายหมู่บ้าน (Interactive Drill-down)
                  </h5>
                  <div className="text-muted small">
                    คลิกที่ตัวเลขในแต่ละช่อง เช่น <strong>&ldquo;ค้างคัดกรองมะเร็งลำไส้ (FOBT) หมู่ 3&rdquo;</strong> เพื่อเปิดรายชื่อบ้านที่ยังไม่ได้ตรวจ หรือกดเปิดดูเฉพาะบ้านที่ค้างตรวจบนแผนที่ได้ทันที
                  </div>
                </div>
              </div>
              <div className="table-responsive" style={{ maxHeight: 420 }}>
                <table className="table table-hover table-sm align-middle mb-0">
                  <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 2 }}>
                    <tr>
                      <th>หมู่บ้าน</th>
                      <th className="text-center">ประชากร (T1+T3)</th>
                      <th className="text-center">ค้างไวรัสตับอักเสบ (HEP)</th>
                      <th className="text-center">ค้างมะเร็งลำไส้ (FOBT)</th>
                      <th className="text-center">ค้างมะเร็งปากมดลูก (HPV)</th>
                      <th className="text-center">ค้างพัฒนาการเด็ก (0–5 ปี)</th>
                      <th className="text-center">ติดเตียง / ติดบ้าน</th>
                      <th className="text-center">สูงอายุอยู่คนเดียว</th>
                      <th className="text-center">บ้านไร้พิกัด GPS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proactive.kpiPendingByMoo.map(row => (
                      <tr key={row.moo}>
                        <td className="fw-bold">
                          <button
                            type="button"
                            className="btn btn-sm btn-link text-decoration-none fw-bold p-0"
                            onClick={() => setSelectedMoo(row.moo)}
                          >
                            หมู่ที่ {row.moo}
                          </button>
                        </td>
                        <td className="text-center fw-semibold">{row.totalActive.toLocaleString()}</td>
                        <td className="text-center">
                          <button
                            type="button"
                            onClick={() => openDrilldown('hep_pending', row.moo)}
                            className="btn btn-sm rounded-pill px-2 py-0 fw-bold"
                            style={{ background: row.hepPending > 0 ? '#cffafe' : '#f1f5f9', color: row.hepPending > 0 ? '#0e7490' : '#94a3b8' }}
                            title={`คลิกดูรายชื่อค้างคัดกรอง HEP หมู่ ${row.moo}`}
                          >
                            {row.hepPending} <span className="fw-normal small">/ {row.hepTarget}</span>
                          </button>
                        </td>
                        <td className="text-center">
                          <button
                            type="button"
                            onClick={() => openDrilldown('fobt_pending', row.moo)}
                            className="btn btn-sm rounded-pill px-2 py-0 fw-bold"
                            style={{ background: row.fobtPending > 0 ? '#fef3c7' : '#f1f5f9', color: row.fobtPending > 0 ? '#b45309' : '#94a3b8' }}
                            title={`คลิกดูรายชื่อค้างคัดกรองมะเร็งลำไส้ (FOBT) หมู่ ${row.moo}`}
                          >
                            {row.fobtPending} <span className="fw-normal small">/ {row.fobtTarget}</span>
                          </button>
                        </td>
                        <td className="text-center">
                          <button
                            type="button"
                            onClick={() => openDrilldown('hpv_pending', row.moo)}
                            className="btn btn-sm rounded-pill px-2 py-0 fw-bold"
                            style={{ background: row.hpvPending > 0 ? '#fce7f3' : '#f1f5f9', color: row.hpvPending > 0 ? '#be185d' : '#94a3b8' }}
                            title={`คลิกดูรายชื่อค้างคัดกรอง HPV หมู่ ${row.moo}`}
                          >
                            {row.hpvPending} <span className="fw-normal small">/ {row.hpvTarget}</span>
                          </button>
                        </td>
                        <td className="text-center">
                          <button
                            type="button"
                            onClick={() => openDrilldown('child_pending', row.moo)}
                            className="btn btn-sm rounded-pill px-2 py-0 fw-bold"
                            style={{ background: row.childPending > 0 ? '#d1fae5' : '#f1f5f9', color: row.childPending > 0 ? '#047857' : '#94a3b8' }}
                            title={`คลิกดูรายชื่อเด็ก 0-5 ปี ค้างตรวจพัฒนาการ หมู่ ${row.moo}`}
                          >
                            {row.childPending} <span className="fw-normal small">/ {row.childTarget}</span>
                          </button>
                        </td>
                        <td className="text-center">
                          <div className="d-inline-flex gap-1">
                            <button
                              type="button"
                              onClick={() => openDrilldown('bedridden', row.moo)}
                              className="btn btn-sm rounded-pill px-2 py-0 fw-bold"
                              style={{ background: row.bedridden > 0 ? '#fee2e2' : '#f1f5f9', color: row.bedridden > 0 ? '#b91c1c' : '#94a3b8' }}
                              title={`ผู้สูงอายุติดเตียง หมู่ ${row.moo}`}
                            >
                              เตียง {row.bedridden}
                            </button>
                            <button
                              type="button"
                              onClick={() => openDrilldown('homebound', row.moo)}
                              className="btn btn-sm rounded-pill px-2 py-0 fw-bold"
                              style={{ background: row.homebound > 0 ? '#ffedd5' : '#f1f5f9', color: row.homebound > 0 ? '#c2410c' : '#94a3b8' }}
                              title={`ผู้สูงอายุติดบ้าน หมู่ ${row.moo}`}
                            >
                              บ้าน {row.homebound}
                            </button>
                          </div>
                        </td>
                        <td className="text-center">
                          <button
                            type="button"
                            onClick={() => openDrilldown('living_alone', row.moo)}
                            className="btn btn-sm rounded-pill px-2 py-0 fw-bold"
                            style={{ background: row.livingAlone > 0 ? '#ede9fe' : '#f1f5f9', color: row.livingAlone > 0 ? '#6d28d9' : '#94a3b8' }}
                            title={`ผู้สูงอายุอยู่คนเดียว หมู่ ${row.moo}`}
                          >
                            {row.livingAlone} คน
                          </button>
                        </td>
                        <td className="text-center">
                          <button
                            type="button"
                            onClick={() => openDrilldown('missing_gps', row.moo)}
                            className="btn btn-sm rounded-pill px-2 py-0 fw-bold"
                            style={{ background: row.missingGps > 0 ? '#e2e8f0' : '#dcfce7', color: row.missingGps > 0 ? '#334155' : '#15803d' }}
                            title={`บ้านยังไม่มีพิกัด GPS หมู่ ${row.moo}`}
                          >
                            {row.missingGps > 0 ? `ขาด ${row.missingGps} หลัง` : 'ครบ 100%'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* KPI By Moo Chart */}
          <div className="row g-3 mb-4"><div className="col-12"><h5 className="fw-bold mb-1" style={{color:'#0891b2'}}><i className="fa-solid fa-chart-bar me-2"/>กราฟคัดกรองแยกรายหมู่</h5></div><div className="col-12"><div className="chart-container"><ChartCanvas id="kpiByMooChart" style={{height:400}}/></div></div></div>

          {/* ═══════════════════════════════════════════════════════════════════════
              2. กราฟปิรามิดประชากร (Population Pyramid) แยกตามหมู่บ้าน + สัดส่วน Type
             ═══════════════════════════════════════════════════════════════════════ */}
          <div className="row g-3 mb-4">
            <div className="col-12 col-lg-7">
              <div className="chart-container">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                  <div className="section-title mb-0">
                    <i className="fa-solid fa-venus-mars text-primary"/> ปิรามิดประชากร {selectedMoo === 'all' ? '(รวมทั้งตำบล)' : `(เฉพาะหมู่ที่ ${selectedMoo})`}
                  </div>
                  <select
                    className="form-select form-select-sm rounded-pill w-auto"
                    value={selectedMoo}
                    onChange={e => setSelectedMoo(e.target.value)}
                  >
                    <option value="all">ทุกหมู่บ้าน</option>
                    {mooList.map(m => (
                      <option key={m} value={m}>หมู่ที่ {m}</option>
                    ))}
                  </select>
                </div>
                <ChartCanvas id="pyramidChart" style={{height:350}}/>
              </div>
            </div>
            <div className="col-12 col-lg-5">
              <div className="chart-container">
                <div className="section-title"><i className="fa-solid fa-chart-pie text-primary"/> สัดส่วน Type</div>
                <ChartCanvas id="pieChart" style={{height:350}}/>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════════
              3. ตารางจัดอันดับความครอบคลุม "พิกัดหลังคาเรือน + คัดกรองครบ" ราย อสม.
             ═══════════════════════════════════════════════════════════════════════ */}
          <div className="card border-0 shadow-sm rounded-4 p-3 p-md-4 mb-4">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <div>
                <h5 className="fw-bold mb-1" style={{ color: '#1e40af' }}>
                  <i className="fa-solid fa-ranking-star me-2" />
                  ตารางจัดอันดับความครอบคลุม &ldquo;พิกัดหลังคาเรือน (GPS) + คัดกรองครบ 4 KPI&rdquo; ราย อสม.
                </h5>
                <div className="text-muted small">
                  ติดตามความคืบหน้าของ อสม. แต่ละคน: รับผิดชอบกี่หลังคาเรือน, ปักหมุด GPS แล้วกี่หลัง, และคัดกรองกลุ่มเป้าหมายครบกี่เปอร์เซ็นต์
                </div>
              </div>
              <div className="d-flex flex-wrap gap-2">
                <select
                  className="form-select form-select-sm rounded-pill"
                  style={{ width: 150 }}
                  value={vhvMooFilter}
                  onChange={e => setVhvMooFilter(e.target.value)}
                >
                  <option value="all">ทุกหมู่บ้าน</option>
                  {mooList.map(m => (
                    <option key={m} value={m}>หมู่ที่ {m}</option>
                  ))}
                </select>
                <input
                  type="search"
                  className="form-control form-control-sm rounded-pill"
                  style={{ width: 200 }}
                  placeholder="ค้นหาชื่อ อสม. ..."
                  value={vhvSearch}
                  onChange={e => setVhvSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="table-responsive" style={{ maxHeight: 460 }}>
              <table className="table table-hover table-sm align-middle mb-0">
                <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 2 }}>
                  <tr>
                    <th style={{ width: 55 }} className="text-center">อันดับ</th>
                    <th>ชื่อ อสม.</th>
                    <th className="text-center">หมู่</th>
                    <th className="text-center">เขตรับผิดชอบ</th>
                    <th style={{ minWidth: 190 }}>ความครอบคลุมปักหมุด GPS</th>
                    <th style={{ minWidth: 190 }}>ความครอบคลุมคัดกรอง 4 KPI</th>
                    <th className="text-center">คะแนนรวม</th>
                    <th className="text-center">ใบงาน</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVhvLeaderboard.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center text-muted py-4">
                        {proactiveLoading ? 'กำลังคำนวณความครอบคลุมราย อสม. ...' : 'ไม่พบข้อมูล อสม. ตามเงื่อนไขที่ค้นหา'}
                      </td>
                    </tr>
                  ) : (
                    filteredVhvLeaderboard.map((v, idx) => (
                      <tr key={v.name}>
                        <td className="text-center fw-bold">
                          {idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : idx + 1}
                        </td>
                        <td className="fw-semibold">
                          <i className="fa-solid fa-user-nurse text-success me-1" />
                          {v.name}
                        </td>
                        <td className="text-center">
                          <span className="badge bg-light text-dark border">ม.{v.mooLabel}</span>
                        </td>
                        <td className="text-center">
                          <span className="badge bg-primary-subtle text-primary-emphasis rounded-pill me-1">
                            {v.houseCount} หลัง
                          </span>
                          <span className="small text-muted">({v.peopleCount} คน)</span>
                        </td>
                        <td>
                          <div className="d-flex justify-content-between small mb-1">
                            <span>ปักหมุด {v.gpsHouseCount}/{v.houseCount} หลัง</span>
                            <span className="fw-bold" style={{ color: v.gpsPct >= 80 ? '#15803d' : v.gpsPct >= 50 ? '#b45309' : '#dc2626' }}>
                              {v.gpsPct}%
                            </span>
                          </div>
                          <div className="progress" style={{ height: 7 }}>
                            <div
                              className="progress-bar"
                              style={{
                                width: `${v.gpsPct}%`,
                                background: v.gpsPct >= 80 ? '#16a34a' : v.gpsPct >= 50 ? '#f59e0b' : '#ef4444',
                              }}
                            />
                          </div>
                        </td>
                        <td>
                          <div className="d-flex justify-content-between small mb-1">
                            <span>ตรวจครบ {v.kpiCompleteCount}/{v.kpiTargetCount} คน</span>
                            <span className="fw-bold" style={{ color: v.kpiPct >= 80 ? '#0f766e' : v.kpiPct >= 50 ? '#d97706' : '#dc2626' }}>
                              {v.kpiPct}%
                            </span>
                          </div>
                          <div className="progress" style={{ height: 7 }}>
                            <div
                              className="progress-bar"
                              style={{
                                width: `${v.kpiPct}%`,
                                background: v.kpiPct >= 80 ? '#0d9488' : v.kpiPct >= 50 ? '#f59e0b' : '#ef4444',
                              }}
                            />
                          </div>
                        </td>
                        <td className="text-center">
                          <span
                            className="badge rounded-pill"
                            style={{
                              background: v.overallScore >= 80 ? '#dcfce7' : v.overallScore >= 50 ? '#fef3c7' : '#fee2e2',
                              color: v.overallScore >= 80 ? '#166534' : v.overallScore >= 50 ? '#92400e' : '#991b1b',
                              fontSize: '0.85rem',
                            }}
                          >
                            {v.overallScore}%
                          </span>
                        </td>
                        <td className="text-center">
                          <div className="d-inline-flex gap-1">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary rounded-pill py-0 px-2"
                              onClick={() => openDrilldown('vhv_pending', vhvMooFilter !== 'all' ? vhvMooFilter : 'all', v.name)}
                              title={`ดูใบงานค้างตรวจ/ขาดพิกัดของ อสม. ${v.name}`}
                            >
                              <i className="fa-solid fa-list-check me-1" />ใบงาน
                            </button>
                            <a
                              href={`/map?moo=${encodeURIComponent(vhvMooFilter)}&vhv=${encodeURIComponent(v.name)}`}
                              className="btn btn-sm btn-outline-success rounded-pill py-0 px-2"
                              title={`ดูหลังคาเรือนของ อสม. ${v.name} บนแผนที่`}
                            >
                              <i className="fa-solid fa-map-pin" />
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Risk Cards */}
          {d?.risk && <div className="row g-3 mb-4">
            <div className="col-12"><h5 className="fw-bold mb-1" style={{color:'#6f42c1'}}><i className="fa-solid fa-triangle-exclamation me-2"/>คัดกรองบุหรี่ / สุรา</h5><p className="text-muted small mb-3">อายุ 15+ (Type 1+3)</p></div>
            {[{l:'เป้าหมาย (15+)',v:d.risk.target15plus,i:'users',co:'#6d28d9',bg:'#f3e8ff'},{l:'คัดกรองบุหรี่แล้ว',v:d.risk.smokeSurveyed,i:'smoking',co:'#be185d',bg:'#fce7f3'},{l:'คัดกรองสุราแล้ว',v:d.risk.alcSurveyed,i:'wine-bottle',co:'#1d4ed8',bg:'#dbeafe'},{l:'พบเสี่ยง (สูบ+ดื่ม)',v:`${d.risk.smoking.current} + ${d.risk.alcohol.current}`,i:'chart-pie',co:'#b45309',bg:'#fef3c7'}].map(({l,v,i,co,bg})=><div className="col-6 col-md-3" key={l}><div className="risk-stat-card shadow-sm" style={{background:`linear-gradient(135deg,${bg},${bg}ee)`}}><i className={`fa-solid fa-${i} bg-icon`} style={{color:co}}/><div className="small text-muted fw-bold">{l}</div><div className="big-num" style={{color:co}}>{v}</div></div></div>)}
            <div className="col-12 col-md-6"><div className="chart-container"><div className="section-title"><i className="fa-solid fa-smoking" style={{color:'#7c3aed'}}/> สถานะบุหรี่</div><ChartCanvas id="smokeChart" style={{height:280}}/></div></div>
            <div className="col-12 col-md-6"><div className="chart-container"><div className="section-title"><i className="fa-solid fa-wine-bottle" style={{color:'#1d4ed8'}}/> สถานะสุรา</div><ChartCanvas id="alcoChart" style={{height:280}}/></div></div>
            <div className="col-12 col-md-6"><div className="chart-container"><div className="section-title"><i className="fa-solid fa-gauge-high" style={{color:'#dc2626'}}/> Fagerstrom</div><ChartCanvas id="fagerChart" style={{height:250}}/></div></div>
            <div className="col-12 col-md-6"><div className="chart-container"><div className="section-title"><i className="fa-solid fa-flask-vial" style={{color:'#0369a1'}}/> ASSIST</div><ChartCanvas id="assistChart" style={{height:250}}/></div></div>
            <div className="col-12"><div className="chart-container"><div className="section-title"><i className="fa-solid fa-smoking" style={{color:'#7c3aed'}}/> คัดกรองบุหรี่ แยกรายหมู่</div><ChartCanvas id="smokeByMooChart" style={{height:350}}/></div></div>
            <div className="col-12"><div className="chart-container"><div className="section-title"><i className="fa-solid fa-wine-bottle" style={{color:'#1d4ed8'}}/> คัดกรองสุรา แยกรายหมู่</div><ChartCanvas id="alcByMooChart" style={{height:350}}/></div></div>
          </div>}

          <div className="row g-3 mt-1"><div className="col-12 col-lg-6"><div className="chart-container"><div className="section-title"><i className="fa-solid fa-chart-bar text-primary"/> แยกรายหมู่</div><ChartCanvas id="barChart" style={{height:350}}/></div></div>
            <div className="col-12 col-lg-6"><div className="chart-container d-flex flex-column" style={{height:410}}><div className="section-title"><i className="fa-solid fa-user-nurse text-primary"/> สรุป อสม.</div><div style={{maxHeight:300,overflowY:'auto',flex:1}}><table className="table table-hover table-sm mb-0"><thead style={{position:'sticky',top:0,background:'#f8f9fa'}}><tr><th>ชื่อ อสม.</th><th className="text-center">หลังคาเรือน</th><th className="text-center">ประชากร</th></tr></thead><tbody>{(d?.vhvList||[]).map((v,i)=><tr key={i}><td><i className="fa-solid fa-user-nurse text-success me-1"/>{v.name}</td><td className="text-center"><span className="badge bg-light text-dark border">{v.houseCount}</span></td><td className="text-center"><span className="badge bg-primary rounded-pill">{v.people}</span></td></tr>)}</tbody></table></div></div></div></div>
          <div className="row g-3 mt-1"><div className="col-12"><div className="chart-container"><div className="section-title"><i className="fa-solid fa-layer-group text-primary"/> Type แต่ละหมู่</div><ChartCanvas id="stackedBarChart" style={{height:350}}/></div></div></div>
          <div className="row g-2 g-md-3 mt-1"><div className="col-6 col-md-4"><div className="stat-card bg-light border-0"><div className="stat-label">ครัวเรือน</div><div className="stat-number" style={{fontSize:'1.5em'}}>{d?d.totalHouses+' หลัง':'-'}</div></div></div><div className="col-6 col-md-4"><div className="stat-card bg-light border-0"><div className="stat-label">โรคเรื้อรัง</div><div className="stat-number" style={{fontSize:'1.5em'}}>{d?d.chronicCount+' คน':'-'}</div></div></div><div className="col-12 col-md-4"><div className="stat-card bg-light border-0"><div className="stat-label">อสม.</div><div className="stat-number" style={{fontSize:'1.5em'}}>{d?d.vhvList.length+' ท่าน':'-'}</div></div></div></div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          หน้าต่าง Modal ใบงานเชิงรุก (Drill-down Worklist Modal)
         ═══════════════════════════════════════════════════════════════════════ */}
      {drilldown && activeDrilldownData && (
        <div
          className="modal d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.55)', zIndex: 1060 }}
          onClick={() => setDrilldown(null)}
        >
          <div
            className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable"
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-content rounded-4 border-0 shadow-lg">
              <div className="modal-header border-bottom bg-light rounded-top-4">
                <div>
                  <h5 className="modal-title fw-bold text-primary mb-1">
                    <i className="fa-solid fa-clipboard-list me-2" />
                    {activeDrilldownData.title}
                    {drilldown.moo && drilldown.moo !== 'all' ? ` • หมู่ที่ ${drilldown.moo}` : ' • ทุกหมู่บ้าน'}
                  </h5>
                  <div className="small text-muted">
                    พบทั้งหมด <strong>{activeDrilldownData.items.length.toLocaleString()}</strong> รายการ
                    {' '}(จาก <strong>{activeDrilldownData.houseSummary.length.toLocaleString()}</strong> หลังคาเรือน)
                  </div>
                </div>
                <button type="button" className="btn-close" onClick={() => setDrilldown(null)} />
              </div>

              <div className="modal-body p-3 p-md-4">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                  <div className="d-flex flex-wrap gap-2 align-items-center">
                    {drilldown.filterKey === 'missing_gps' ? <span className="small text-muted">บ้านกลุ่มนี้ยังไม่มีพิกัดสำหรับแสดงบนแผนที่</span> : <a
                      href={`/map?moo=${drilldown.moo || 'all'}&filter=${drilldown.filterKey}${drilldown.vhv ? `&vhv=${encodeURIComponent(drilldown.vhv)}` : ''}`}
                      className="btn btn-success btn-sm rounded-pill fw-bold px-3"
                    >
                      <i className="fa-solid fa-map-location-dot me-1" />
                      เปิดดูเฉพาะกลุ่มนี้บนแผนที่ GIS
                    </a>}
                    <select
                      className="form-select form-select-sm rounded-pill w-auto"
                      value={drilldown.moo || 'all'}
                      onChange={e => setDrilldown(prev => ({ ...prev, moo: e.target.value }))}
                    >
                      <option value="all">ทุกหมู่บ้าน</option>
                      {mooList.map(m => (
                        <option key={m} value={m}>หมู่ที่ {m}</option>
                      ))}
                    </select>
                  </div>
                  <input
                    type="search"
                    className="form-control form-control-sm rounded-pill"
                    style={{ maxWidth: 260 }}
                    placeholder="ค้นหาชื่อ / บ้านเลขที่ / อสม. ..."
                    value={drilldownSearch}
                    onChange={e => setDrilldownSearch(e.target.value)}
                  />
                </div>

                <div className="table-responsive" style={{ maxHeight: 440 }}>
                  <table className="table table-hover table-sm align-middle mb-0">
                    <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 2 }}>
                      <tr>
                        <th>หมู่</th>
                        <th>บ้านเลขที่</th>
                        <th>ชื่อ - นามสกุล</th>
                        <th className="text-center">อายุ</th>
                        <th>โรคประจำตัว / ADL</th>
                        <th>รายละเอียดใบงาน</th>
                        <th>อสม. ผู้รับผิดชอบ</th>
                        <th className="text-center">พิกัด GPS</th>
                        <th className="text-center">ดำเนินการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDrilldownItems.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="text-center text-muted py-4">
                            ไม่พบรายการตามเงื่อนไขที่เลือก
                          </td>
                        </tr>
                      ) : (
                        filteredDrilldownItems.slice(0, 300).map((item, idx) => {
                          const houseInfo = proactive?.houseMap?.get(`${item.moo}|${item.house}`);
                          const hasGps = item.hasGps ?? houseInfo?.hasGps ?? false;
                          return (
                            <tr key={`${item.personId || idx}-${item.moo}-${item.house}`}>
                              <td className="fw-bold">ม.{item.moo}</td>
                              <td className="fw-bold text-primary">{item.house}</td>
                              <td className="fw-semibold">{item.fullname}</td>
                              <td className="text-center">{item.age !== null && item.age !== undefined ? `${item.age} ปี` : '-'}</td>
                              <td className="small">
                                <div>{item.chronic || '-'}</div>
                                {item.adlScore !== null && item.adlScore !== undefined && (
                                  <span className="badge bg-danger-subtle text-danger-emphasis">ADL {item.adlScore}</span>
                                )}
                              </td>
                              <td>
                                <span className="badge bg-warning-subtle text-warning-emphasis border">
                                  {item.badge || 'เป้าหมาย'}
                                </span>
                              </td>
                              <td className="small">{item.vhv || 'ไม่ระบุ'}</td>
                              <td className="text-center">
                                {hasGps ? (
                                  <span className="badge bg-success-subtle text-success-emphasis">มีพิกัด</span>
                                ) : (
                                  <span className="badge bg-secondary-subtle text-secondary-emphasis">ยังไม่มี</span>
                                )}
                              </td>
                              <td className="text-center">
                                <div className="d-inline-flex gap-1">
                                  <a
                                    href={`/?moo=${encodeURIComponent(item.moo)}&house=${encodeURIComponent(item.house)}`}
                                    className="btn btn-sm btn-outline-primary rounded-pill py-0 px-2"
                                    title="เปิดหน้าสำรวจหลังคาเรือนนี้"
                                  >
                                    สำรวจ
                                  </a>
                                  <a
                                    href={`/screening?kpi=${
                                      ({fobt_pending:'FOBT', hpv_pending:'HPV', child_pending:'CHILD', hep_pending:'HEP'})[drilldown.filterKey] || ''
                                    }&q=${encodeURIComponent([item.fname,item.lname].filter(Boolean).join(' ') || item.fullname || '')}`}
                                    className="btn btn-sm btn-outline-teal rounded-pill py-0 px-2"
                                    style={{ borderColor: '#0d9488', color: '#0f766e' }}
                                    title="ไปหน้าบันทึกคัดกรอง KPI"
                                  >
                                    คัดกรอง
                                  </a>
                                  {hasGps && (
                                    <a
                                      href={`/map?moo=${encodeURIComponent(item.moo)}&house=${encodeURIComponent(item.house)}&filter=${drilldown.filterKey}`}
                                      className="btn btn-sm btn-outline-success rounded-pill py-0 px-2"
                                      title="ดูหมุดบ้านนี้บนแผนที่"
                                    >
                                      <i className="fa-solid fa-location-dot" />
                                    </a>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                {filteredDrilldownItems.length > 300 && (
                  <div className="text-muted small mt-2 text-center">
                    แสดง 300 รายการแรก (จากทั้งหมด {filteredDrilldownItems.length.toLocaleString()} รายการ) • ใช้ช่องค้นหาหรือเลือกหมู่บ้านเพื่อกรองเพิ่มเติม
                  </div>
                )}
              </div>

              <div className="modal-footer border-top bg-light rounded-bottom-4">
                <button type="button" className="btn btn-secondary rounded-pill px-4" onClick={() => setDrilldown(null)}>
                  ปิดหน้าต่าง
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="fab-group"><a href="/screening" className="fab-btn" style={{background:'#059669'}}><i className="fa-solid fa-clipboard-check"/></a><button className="fab-btn" style={{background:'var(--primary)'}} onClick={loadDashboard}><i className="fa-solid fa-rotate"/></button></div>
    </>
  );
}
