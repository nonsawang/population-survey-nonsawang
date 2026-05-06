'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { selectAll } from '@/lib/supabase';
import { calculateAge, getBirthYear, MALE_TITLES } from '@/lib/utils';
import TopBar from '@/components/TopBar';

// ─── Chart wrapper ───
function ChartCanvas({ id, style }) {
  return <div style={{position:'relative',...style}}><canvas id={id} /></div>;
}

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [dashLoading, setDashLoading] = useState(true);
  const chartsRef = useRef({});

  useEffect(() => { if (!loading && !user) router.push('/login'); }, [user, loading, router]);

  const loadDashboard = useCallback(async () => {
    setDashLoading(true);
    try {
      const rows = await selectAll('population');
      setData(computeStats(rows));
    } catch(e) { console.error(e); }
    setDashLoading(false);
  }, []);

  useEffect(() => { if (user) loadDashboard(); }, [user, loadDashboard]);

  // ─── Draw all charts when data changes ───
  useEffect(() => {
    if (!data || typeof window === 'undefined') return;
    import('chart.js/auto').then(({ default: Chart }) => {
      Object.values(chartsRef.current).forEach(c => c?.destroy?.());
      chartsRef.current = {};
      const mk = (id, cfg) => { const el = document.getElementById(id); if (el) { chartsRef.current[id] = new Chart(el, cfg); } };
      const d = data;

      // 1. Pie (Type)
      mk('pieChart', { type:'doughnut', data:{ labels:['Type 1','Type 2','Type 3','จำหน่าย','ยังไม่สำรวจ'], datasets:[{data:[d.type1,d.type2,d.type3,d.type0,d.unsurveyed],backgroundColor:['#198754','#f59e0b','#dc3545','#6b7280','#e5e7eb'],borderColor:'#fff',borderWidth:2}]}, options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{usePointStyle:true,font:{family:'Sarabun',size:11}}}}}});

      // 2. Pyramid
      mk('pyramidChart', {type:'bar',data:{labels:d.pyramid.labels,datasets:[{label:'ชาย',data:d.pyramid.male.map(v=>-v),backgroundColor:'#60a5fa',borderRadius:4},{label:'หญิง',data:d.pyramid.female,backgroundColor:'#f472b6',borderRadius:4}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,scales:{x:{stacked:true,ticks:{callback:v=>Math.abs(v)}},y:{stacked:true}},plugins:{tooltip:{callbacks:{label:c=>c.dataset.label+': '+Math.abs(c.raw)+' คน'}},legend:{position:'bottom'}}}});

      // 3. Bar (by Moo)
      const mooKeys = Object.keys(d.byMoo).sort((a,b)=>a-b);
      mk('barChart', {type:'bar',data:{labels:mooKeys.map(k=>'หมู่ '+k),datasets:[{label:'ประชากร',data:mooKeys.map(k=>d.byMoo[k].total),backgroundColor:'#3949ab',borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}});

      // 4. Stacked Bar (Type per Moo)
      mk('stackedBarChart', {type:'bar',data:{labels:mooKeys.map(k=>'หมู่ '+k),datasets:[{label:'T1',data:mooKeys.map(k=>d.byMoo[k].type1),backgroundColor:'#198754'},{label:'T2',data:mooKeys.map(k=>d.byMoo[k].type2),backgroundColor:'#f59e0b'},{label:'T3',data:mooKeys.map(k=>d.byMoo[k].type3),backgroundColor:'#dc3545'},{label:'ยังไม่สำรวจ',data:mooKeys.map(k=>d.byMoo[k].unsurveyed||0),backgroundColor:'#e5e7eb'}]},options:{responsive:true,maintainAspectRatio:false,scales:{x:{stacked:true},y:{stacked:true}},plugins:{legend:{position:'bottom',labels:{usePointStyle:true}}}}});

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

  // ─── computeStats (same as Code.gs getDashboardData) ───
  function computeStats(rows) {
    const AR = ['0-4','5-9','10-14','15-19','20-24','25-29','30-34','35-39','40-44','45-49','50-54','55-59','60-64','65-69','70-74','75-79','80+'];
    const s = { total:0, unsurveyed:0, type0:0, type1:0, type2:0, type3:0, type4:0, byMoo:{}, houses: new Set(), chronicCount:0, population:{children:0,working:0,elderly:0}, ageGroups:{male:{},female:{}}, kpi:{hep:{total:0,screened:0},fobt:{total:0,screened:0},hpv:{total:0,screened:0},child:{total:0,normal:0}}, risk:{target15plus:0,smokeSurveyed:0,alcSurveyed:0,smoking:{neverSmoked:0,quit:0,current:0},alcohol:{neverDrank:0,quit:0,current:0},fagerstrom:{low:0,medium:0,high:0},assist:{low:0,medium:0,high:0},byMoo:[]}, vhvStats:{}, kpiByMoo:[] };
    AR.forEach(r => { s.ageGroups.male[r]=0; s.ageGroups.female[r]=0; });
    const rBM = {}, kBM = {};

    (rows||[]).forEach(r => {
      const rawT = r.residency_type; const type = (rawT!=null && String(rawT).trim()!=='') ? String(rawT).trim() : '';
      const moo = String(r.moo||'').trim(); const house = String(r.house||'').trim(); const vhv = String(r.vhv||'').trim();
      const gender = MALE_TITLES.includes(String(r.title||'').trim()) ? 'male' : 'female';
      const age = calculateAge(r.birth_date);
      if (type==='0') { s.type0++; return; } if (type==='4') { s.type4++; return; }
      s.total++;
      if (type==='1') s.type1++; else if (type==='2') s.type2++; else if (type==='3') s.type3++; else s.unsurveyed++;

      if (moo && moo!=='-') {
        if (!s.byMoo[moo]) s.byMoo[moo]={total:0,type1:0,type2:0,type3:0,unsurveyed:0};
        s.byMoo[moo].total++;
        if (type==='1') s.byMoo[moo].type1++; else if (type==='2') s.byMoo[moo].type2++; else if (type==='3') s.byMoo[moo].type3++; else s.byMoo[moo].unsurveyed++;
        s.houses.add(moo+'-'+house);
      }
      if (age!=='-') { if (age<15) s.population.children++; else if (age>=60) s.population.elderly++; else s.population.working++; const idx=Math.min(Math.floor(age/5),16); s.ageGroups[gender][AR[idx]]++; }

      // VHV stats
      if (vhv && vhv!=='ไม่ระบุ' && vhv!=='-') { if (!s.vhvStats[vhv]) s.vhvStats[vhv]={people:0,houses:new Set()}; s.vhvStats[vhv].people++; s.vhvStats[vhv].houses.add(moo+'-'+house); }

      // Chronic
      const chronic = String(r.chronic||'').trim();
      if (chronic && chronic!=='-' && chronic!=='ปกติ (ไม่มีโรค)') { chronic.split(/[,\/]+/).forEach(d => { d=d.trim(); if(d && d!=='ปกติ (ไม่มีโรค)') s.chronicCount++; }); }

      if (type==='1'||type==='3') {
        const by = getBirthYear(r.birth_date);
        if (!kBM[moo]) kBM[moo]={hep:{t:0,s:0},fobt:{t:0,s:0},hpv:{t:0,s:0},child:{t:0,s:0}};
        if (by && by<1992) { s.kpi.hep.total++; const v=r.hep_screen||r.hep_result||''; if(v&&v!=='-') { s.kpi.hep.screened++; kBM[moo].hep.s++; } kBM[moo].hep.t++; }
        if (age!=='-'&&age>=50&&age<=70) { s.kpi.fobt.total++; const v=r.fobt_screen||r.fobt_result||''; if(v&&v!=='-') { s.kpi.fobt.screened++; kBM[moo].fobt.s++; } kBM[moo].fobt.t++; }
        if (gender==='female'&&age!=='-'&&age>=30&&age<=60) { s.kpi.hpv.total++; const v=r.hpv_screen||r.hpv_result||''; if(v&&v!=='-') { s.kpi.hpv.screened++; kBM[moo].hpv.s++; } kBM[moo].hpv.t++; }
        if (age!=='-'&&age>=0&&age<=5) { s.kpi.child.total++; const v=r.child_dev||r.child_dev_result||''; if(v&&v!=='-'&&v!=='รอผล') { s.kpi.child.normal++; kBM[moo].child.s++; } kBM[moo].child.t++; }

        if (age!=='-'&&age>=15) {
          s.risk.target15plus++;
          const sm=String(r.smoking_status||'').trim(), al=String(r.alcohol_status||'').trim();
          if (!rBM[moo]) rBM[moo]={target:0,smokeSurveyed:0,smokeNever:0,smokeQuit:0,smoker:0,alcSurveyed:0,alcNever:0,alcQuit:0,drinker:0};
          rBM[moo].target++;
          if (sm&&sm!=='-') { s.risk.smokeSurveyed++; rBM[moo].smokeSurveyed++;
            if (sm.includes('ไม่สูบ ไม่เคย')) { s.risk.smoking.neverSmoked++; rBM[moo].smokeNever++; }
            else if (sm.includes('เลิกแล้ว')) { s.risk.smoking.quit++; rBM[moo].smokeQuit++; }
            else if (sm==='สูบ') { s.risk.smoking.current++; rBM[moo].smoker++; const fs=parseInt(r.fagerstrom_score); if(!isNaN(fs)){if(fs<=3)s.risk.fagerstrom.low++;else if(fs<=6)s.risk.fagerstrom.medium++;else s.risk.fagerstrom.high++;} }
          }
          if (al&&al!=='-') { s.risk.alcSurveyed++; rBM[moo].alcSurveyed++;
            if (al.includes('ไม่ดื่ม')) { s.risk.alcohol.neverDrank++; rBM[moo].alcNever++; }
            else if (al.includes('หยุดแล้ว')) { s.risk.alcohol.quit++; rBM[moo].alcQuit++; }
            else if (al==='ดื่ม') { s.risk.alcohol.current++; rBM[moo].drinker++; const as=parseInt(r.assist_score); if(!isNaN(as)){if(as<=10)s.risk.assist.low++;else if(as<=26)s.risk.assist.medium++;else s.risk.assist.high++;} }
          }
        }
      }
    });
    s.risk.byMoo = Object.keys(rBM).sort((a,b)=>a-b).map(m=>({moo:m,...rBM[m]}));
    s.kpiByMoo = Object.keys(kBM).sort((a,b)=>a-b).map(m=>({moo:m,hepTotal:kBM[m].hep.t,hepScreened:kBM[m].hep.s,fobtTotal:kBM[m].fobt.t,fobtScreened:kBM[m].fobt.s,hpvTotal:kBM[m].hpv.t,hpvScreened:kBM[m].hpv.s,childTotal:kBM[m].child.t,childScreened:kBM[m].child.s}));
    s.totalHouses = s.houses.size;
    s.pyramid = { labels: AR, male: AR.map(r=>s.ageGroups.male[r]), female: AR.map(r=>s.ageGroups.female[r]) };
    s.insight = { ...s.population, dependencyRatio: s.population.working > 0 ? ((s.population.children+s.population.elderly)/s.population.working*100).toFixed(1) : 0 };
    // VHV list
    s.vhvList = Object.entries(s.vhvStats).map(([name,v])=>({name,people:v.people,houseCount:v.houses.size})).sort((a,b)=>b.people-a.people);
    return s;
  }

  const pct = (n,d) => d > 0 ? (n/d*100).toFixed(1) : '0.0';
  if (loading || !user) return <div className="text-center py-5"><span className="spinner-border text-primary"/></div>;
  const d = data;

  return (
    <>
      <TopBar showAdmin />
      <div className="container-fluid px-2 px-md-4">
        <div className="dashboard-container fade-in">
          <div className="text-center mb-4 pt-2"><h4 className="fw-bold" style={{color:'var(--primary)',fontFamily:"'Prompt',sans-serif"}}><i className="fa-solid fa-chart-line"/> Dashboard ประชากร</h4><p className="text-muted small mb-0">รพ.สต.บ้านโนนสว่าง</p></div>
          <div className="row mb-4 justify-content-center"><div className="col-12 col-md-6"><div className="d-flex gap-2"><a href="/" className="btn btn-outline-primary flex-fill rounded-pill"><i className="fa-solid fa-magnifying-glass me-1"/>สำรวจ</a><button onClick={loadDashboard} className="btn flex-fill rounded-pill text-white" style={{background:'var(--primary)'}} disabled={dashLoading}>{dashLoading?<><span className="spinner-border spinner-border-sm me-1"/>โหลด...</>:<><i className="fa-solid fa-chart-pie me-1"/>รีเฟรช</>}</button></div></div></div>

          {/* Insight */}
          <div className="row g-2 g-md-3 mb-4">
            {[{l:'วัยเด็ก (0-14)',v:d?.insight?.children,i:'child',b:'bg-gradient-primary'},{l:'วัยทำงาน',v:d?.insight?.working,i:'briefcase',b:'bg-gradient-success'},{l:'สูงอายุ (60+)',v:d?.insight?.elderly,i:'person-cane',b:'bg-gradient-warning'},{l:'อัตราพึ่งพิง',v:d?d.insight.dependencyRatio+'%':'-',i:'scale-unbalanced',b:'bg-gradient-danger'}].map(({l,v,i,b})=><div className="col-6 col-md-3" key={l}><div className={`card card-insight ${b} p-3 h-100`}><div className="d-flex justify-content-between"><div><div className="small text-white-50">{l}</div><div className="h3 fw-bold mb-0">{v??<span className="num-spin"/>}</div></div><i className={`fa-solid fa-${i} fa-2x text-white-50`}/></div></div></div>)}
          </div>

          {/* Type Stats */}
          <div className="row g-2 g-md-3 row-cols-2 row-cols-md-3 row-cols-lg-6 mb-4">
            {[{l:'ทั้งหมด',v:d?.total,i:'users',c:'total'},{l:'Type 1',v:d?.type1,i:'house-user',c:'type1'},{l:'Type 2',v:d?.type2,i:'person-walking',c:'type2'},{l:'Type 3',v:d?.type3,i:'user-plus',c:'type3'},{l:'จำหน่าย',v:d?.type0,i:'user-xmark',c:'type0'}].map(({l,v,i,c})=><div className={c==='total'?'col-12 col-md-4 col-lg-2':'col'} key={l}><div className={`stat-card ${c}`}><i className={`fa-solid fa-${i} stat-icon`}/><div className="stat-label">{l}</div><div className="stat-number">{v??<span className="num-spin"/>}</div></div></div>)}
            <div className="col"><div className="stat-card" style={{borderLeftColor:'#e5e7eb',background:'#f9fafb'}}><i className="fa-solid fa-question stat-icon" style={{color:'#9ca3af'}}/><div className="stat-label" style={{color:'#9ca3af'}}>ยังไม่สำรวจ</div><div className="stat-number" style={{color:'#9ca3af'}}>{d?.unsurveyed??<span className="num-spin"/>}</div></div></div>
          </div>

          {/* KPI Cards */}
          <div className="row g-3 mb-4">
            <div className="col-12"><h5 className="fw-bold mb-3" style={{color:'var(--primary)'}}><i className="fa-solid fa-bullseye"/> ตัวชี้วัด KPI</h5></div>
            {[{t:'HBV/HCV (ก่อน 2535)',i:'virus',co:'#0891b2',kpi:d?.kpi?.hep},{t:'Fit test (50-70 ปี)',i:'microscope',co:'#d97706',kpi:d?.kpi?.fobt},{t:'HPV DNA (สตรี 30-60)',i:'dna',co:'#db2777',kpi:d?.kpi?.hpv},{t:'พัฒนาการ (0-5 ปี)',i:'baby',co:'#059669',kpi:d?.kpi?.child?{total:d.kpi.child.total,screened:d.kpi.child.normal}:null}].map(({t,i,co,kpi})=><div className="col-12 col-md-6 col-lg-3" key={t}><div className="kpi-card position-relative" style={{borderLeftColor:co,background:`linear-gradient(135deg,#fff,${co}15)`}}><i className={`fa-solid fa-${i} kpi-icon`} style={{color:co}}/><div className="small text-muted fw-bold">{t}</div><div className="kpi-percent">{kpi?pct(kpi.screened||0,kpi.total||0):<span className="num-spin"/>}<span style={{fontSize:'1.8rem'}}>%</span></div><div className="small text-muted">{kpi?`คัดกรอง ${kpi.screened||0} / ${kpi.total||0} คน`:'โหลด...'}</div><div className="progress mt-2" style={{height:6}}><div className="progress-bar" style={{width:`${kpi?pct(kpi.screened||0,kpi.total||0):0}%`,background:co,transition:'width .8s ease-in-out'}}/></div></div></div>)}
          </div>

          {/* KPI By Moo Chart */}
          <div className="row g-3 mb-4"><div className="col-12"><h5 className="fw-bold mb-1" style={{color:'#0891b2'}}><i className="fa-solid fa-chart-bar me-2"/>คัดกรองแยกรายหมู่</h5></div><div className="col-12"><div className="chart-container"><ChartCanvas id="kpiByMooChart" style={{height:400}}/></div></div></div>

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

          {/* Population Charts */}
          <div className="row g-3"><div className="col-12 col-lg-7"><div className="chart-container"><div className="section-title"><i className="fa-solid fa-venus-mars text-primary"/> ปิรามิดประชากร</div><ChartCanvas id="pyramidChart" style={{height:350}}/></div></div><div className="col-12 col-lg-5"><div className="chart-container"><div className="section-title"><i className="fa-solid fa-chart-pie text-primary"/> สัดส่วน Type</div><ChartCanvas id="pieChart" style={{height:350}}/></div></div></div>
          <div className="row g-3 mt-1"><div className="col-12 col-lg-6"><div className="chart-container"><div className="section-title"><i className="fa-solid fa-chart-bar text-primary"/> แยกรายหมู่</div><ChartCanvas id="barChart" style={{height:350}}/></div></div>
            <div className="col-12 col-lg-6"><div className="chart-container d-flex flex-column" style={{height:410}}><div className="section-title"><i className="fa-solid fa-user-nurse text-primary"/> สรุป อสม.</div><div style={{maxHeight:300,overflowY:'auto',flex:1}}><table className="table table-hover table-sm mb-0"><thead style={{position:'sticky',top:0,background:'#f8f9fa'}}><tr><th>ชื่อ อสม.</th><th className="text-center">หลังคาเรือน</th><th className="text-center">ประชากร</th></tr></thead><tbody>{(d?.vhvList||[]).map((v,i)=><tr key={i}><td><i className="fa-solid fa-user-nurse text-success me-1"/>{v.name}</td><td className="text-center"><span className="badge bg-light text-dark border">{v.houseCount}</span></td><td className="text-center"><span className="badge bg-primary rounded-pill">{v.people}</span></td></tr>)}</tbody></table></div></div></div></div>
          <div className="row g-3 mt-1"><div className="col-12"><div className="chart-container"><div className="section-title"><i className="fa-solid fa-layer-group text-primary"/> Type แต่ละหมู่</div><ChartCanvas id="stackedBarChart" style={{height:350}}/></div></div></div>
          <div className="row g-2 g-md-3 mt-1"><div className="col-6 col-md-4"><div className="stat-card bg-light border-0"><div className="stat-label">ครัวเรือน</div><div className="stat-number" style={{fontSize:'1.5em'}}>{d?d.totalHouses+' หลัง':'-'}</div></div></div><div className="col-6 col-md-4"><div className="stat-card bg-light border-0"><div className="stat-label">โรคเรื้อรัง</div><div className="stat-number" style={{fontSize:'1.5em'}}>{d?d.chronicCount+' คน':'-'}</div></div></div><div className="col-12 col-md-4"><div className="stat-card bg-light border-0"><div className="stat-label">อสม.</div><div className="stat-number" style={{fontSize:'1.5em'}}>{d?d.vhvList.length+' ท่าน':'-'}</div></div></div></div>
        </div>
      </div>
      <div className="fab-group"><a href="/screening" className="fab-btn" style={{background:'#059669'}}><i className="fa-solid fa-clipboard-check"/></a><button className="fab-btn" style={{background:'var(--primary)'}} onClick={loadDashboard}><i className="fa-solid fa-rotate"/></button></div>
    </>
  );
}
