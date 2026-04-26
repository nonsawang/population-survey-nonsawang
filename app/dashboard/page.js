'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { supabase, selectAll } from '@/lib/supabase';
import { calculateAge, getBirthYear, MALE_TITLES } from '@/lib/utils';
import TopBar from '@/components/TopBar';
import dynamic from 'next/dynamic';

// Chart.js - client only
let Chart;
if (typeof window !== 'undefined') {
  Chart = require('chart.js/auto');
}

function StatCard({ label, value, icon, cls }) {
  return (
    <div className={`stat-card ${cls || ''}`}>
      <i className={`fa-solid fa-${icon} stat-icon`} />
      <div className="stat-label">{label}</div>
      <div className="stat-number">{value ?? <span className="num-spin" />}</div>
    </div>
  );
}

function KpiCard({ title, icon, color, percent, detail, progressId, onClick }) {
  return (
    <div className={`kpi-card position-relative`} style={{borderLeftColor: color, background:`linear-gradient(135deg,#fff,${color}15)`}} onClick={onClick}>
      <i className={`fa-solid fa-${icon} kpi-icon`} style={{color}} />
      <div className="small text-muted fw-bold"><i className={`fa-solid fa-${icon} me-1`} style={{color}} />{title}</div>
      <div className="kpi-percent">{percent ?? <span className="num-spin" />}<span style={{fontSize:'1.8rem'}}>%</span></div>
      <div className="small text-muted">{detail || 'กำลังโหลด...'}</div>
      <div className="progress mt-2" style={{height:6}}><div className="progress-bar" style={{width:`${percent || 0}%`,background:color}} /></div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [dashLoading, setDashLoading] = useState(true);
  const chartsRef = useRef({});

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  const loadDashboard = useCallback(async () => {
    setDashLoading(true);
    try {
      const rows = await selectAll('population');
      const stats = computeStats(rows);
      setData(stats);
    } catch (e) {
      console.error('Dashboard error:', e);
    }
    setDashLoading(false);
  }, []);

  useEffect(() => { if (user) loadDashboard(); }, [user, loadDashboard]);

  // Compute all statistics (same logic as getDashboardData in Code.gs)
  function computeStats(rows) {
    const ageRanges = ['0-4','5-9','10-14','15-19','20-24','25-29','30-34','35-39','40-44','45-49','50-54','55-59','60-64','65-69','70-74','75-79','80+'];
    const s = {
      total:0, unsurveyed:0, type0:0, type1:0, type2:0, type3:0, type4:0,
      byMoo:{}, houses:new Set(), chronicCount:0,
      population:{children:0,working:0,elderly:0},
      ageGroups:{male:{},female:{}},
      kpi:{hep:{total:0,screened:0},fobt:{total:0,screened:0},hpv:{total:0,screened:0},child:{total:0,normal:0}},
      risk:{target15plus:0,smokeSurveyed:0,alcSurveyed:0,smoking:{neverSmoked:0,quit:0,current:0},alcohol:{neverDrank:0,quit:0,current:0},fagerstrom:{low:0,medium:0,high:0},assist:{low:0,medium:0,high:0},byMoo:[]}
    };
    ageRanges.forEach(r => { s.ageGroups.male[r]=0; s.ageGroups.female[r]=0; });
    const riskByMoo = {};

    (rows||[]).forEach(r => {
      const rawType = r.residency_type;
      const type = (rawType != null && String(rawType).trim() !== '') ? String(rawType).trim() : '';
      const moo = String(r.moo||'').trim();
      const gender = MALE_TITLES.includes(String(r.title||'').trim()) ? 'male' : 'female';
      const age = calculateAge(r.birth_date);

      if (type === '0') { s.type0++; return; }
      if (type === '4') { s.type4++; return; }
      s.total++;
      if (type === '1') s.type1++; else if (type === '2') s.type2++; else if (type === '3') s.type3++; else s.unsurveyed++;

      if (moo && moo !== '-') {
        if (!s.byMoo[moo]) s.byMoo[moo] = {total:0,type1:0,type2:0,type3:0,unsurveyed:0};
        s.byMoo[moo].total++;
        if (type==='1') s.byMoo[moo].type1++; else if (type==='2') s.byMoo[moo].type2++; else if (type==='3') s.byMoo[moo].type3++; else s.byMoo[moo].unsurveyed++;
        s.houses.add(moo+'-'+(r.house||''));
      }
      if (age !== '-') {
        if (age < 15) s.population.children++; else if (age >= 60) s.population.elderly++; else s.population.working++;
        const idx = Math.min(Math.floor(age/5), 16);
        s.ageGroups[gender][ageRanges[idx]]++;
      }

      // KPI + Risk (type 1 or 3 only)
      if (type === '1' || type === '3') {
        const birthYear = getBirthYear(r.birth_date);
        if (birthYear && birthYear < 1992) { s.kpi.hep.total++; const v = r.hep_screen||r.hep_result||''; if (v && v !== '-') s.kpi.hep.screened++; }
        if (age !== '-' && age >= 50 && age <= 70) { s.kpi.fobt.total++; const v = r.fobt_screen||r.fobt_result||''; if (v && v !== '-') s.kpi.fobt.screened++; }
        if (gender === 'female' && age !== '-' && age >= 30 && age <= 60) { s.kpi.hpv.total++; const v = r.hpv_screen||r.hpv_result||''; if (v && v !== '-') s.kpi.hpv.screened++; }
        if (age !== '-' && age >= 0 && age <= 5) { s.kpi.child.total++; const v = r.child_dev||r.child_dev_result||''; if (v && v !== '-' && v !== 'รอผล') s.kpi.child.normal++; }

        if (age !== '-' && age >= 15) {
          s.risk.target15plus++;
          const smoke = String(r.smoking_status||'').trim();
          const alco = String(r.alcohol_status||'').trim();
          if (!riskByMoo[moo]) riskByMoo[moo] = {target:0,smokeSurveyed:0,smokeNever:0,smokeQuit:0,smoker:0,alcSurveyed:0,alcNever:0,alcQuit:0,drinker:0};
          riskByMoo[moo].target++;
          if (smoke && smoke !== '-') { s.risk.smokeSurveyed++; riskByMoo[moo].smokeSurveyed++;
            if (smoke.includes('ไม่สูบ ไม่เคย')) { s.risk.smoking.neverSmoked++; riskByMoo[moo].smokeNever++; }
            else if (smoke.includes('เลิกแล้ว')) { s.risk.smoking.quit++; riskByMoo[moo].smokeQuit++; }
            else if (smoke === 'สูบ') { s.risk.smoking.current++; riskByMoo[moo].smoker++;
              const fs = parseInt(r.fagerstrom_score); if (!isNaN(fs)) { if (fs<=3) s.risk.fagerstrom.low++; else if (fs<=6) s.risk.fagerstrom.medium++; else s.risk.fagerstrom.high++; }
            }
          }
          if (alco && alco !== '-') { s.risk.alcSurveyed++; riskByMoo[moo].alcSurveyed++;
            if (alco.includes('ไม่ดื่ม')) { s.risk.alcohol.neverDrank++; riskByMoo[moo].alcNever++; }
            else if (alco.includes('หยุดแล้ว')) { s.risk.alcohol.quit++; riskByMoo[moo].alcQuit++; }
            else if (alco === 'ดื่ม') { s.risk.alcohol.current++; riskByMoo[moo].drinker++;
              const as = parseInt(r.assist_score); if (!isNaN(as)) { if (as<=10) s.risk.assist.low++; else if (as<=26) s.risk.assist.medium++; else s.risk.assist.high++; }
            }
          }
        }
      }
    });

    s.risk.byMoo = Object.keys(riskByMoo).sort((a,b)=>parseInt(a)-parseInt(b)).map(m=>({moo:m,...riskByMoo[m]}));
    s.totalHouses = s.houses.size;
    s.pyramid = { labels: ageRanges, male: ageRanges.map(r=>s.ageGroups.male[r]), female: ageRanges.map(r=>s.ageGroups.female[r]) };
    s.insight = { ...s.population, dependencyRatio: s.population.working > 0 ? ((s.population.children+s.population.elderly)/s.population.working*100).toFixed(1) : 0 };
    return s;
  }

  const pct = (n,d) => d > 0 ? (n/d*100).toFixed(1) : '0.0';

  if (loading || !user) return <div className="text-center py-5"><span className="spinner-border text-primary"/></div>;

  return (
    <>
      <TopBar showAdmin />
      <div className="container-fluid px-2 px-md-4">
        <div className="dashboard-container fade-in">
          <div className="text-center mb-4 pt-2">
            <h4 className="fw-bold" style={{color:'var(--primary)',fontFamily:"'Prompt',sans-serif"}}><i className="fa-solid fa-chart-line"/> Dashboard ประชากร</h4>
            <p className="text-muted small mb-0">รพ.สต.บ้านโนนสว่าง</p>
          </div>

          <div className="row mb-4 justify-content-center"><div className="col-12 col-md-6"><div className="d-flex gap-2">
            <a href="/" className="btn btn-outline-primary flex-fill rounded-pill"><i className="fa-solid fa-magnifying-glass me-1"/>สำรวจ</a>
            <button onClick={loadDashboard} className="btn flex-fill rounded-pill text-white" style={{background:'var(--primary)'}}><i className="fa-solid fa-chart-pie me-1"/>รีเฟรช</button>
          </div></div></div>

          {/* Insight Cards */}
          <div className="row g-2 g-md-3 mb-4">
            {[{label:'วัยเด็ก (0-14)',val:data?.insight?.children,icon:'child',bg:'bg-gradient-primary'},
              {label:'วัยทำงาน',val:data?.insight?.working,icon:'briefcase',bg:'bg-gradient-success'},
              {label:'สูงอายุ (60+)',val:data?.insight?.elderly,icon:'person-cane',bg:'bg-gradient-warning'},
              {label:'อัตราพึ่งพิง',val:data?.insight?.dependencyRatio ? data.insight.dependencyRatio+'%' : '-',icon:'scale-unbalanced',bg:'bg-gradient-danger'}
            ].map(({label,val,icon,bg}) => (
              <div className="col-6 col-md-3" key={label}>
                <div className={`card card-insight ${bg} p-3 h-100`}>
                  <div className="d-flex justify-content-between"><div><div className="small text-white-50">{label}</div><div className="h3 fw-bold mb-0">{val ?? '-'}</div></div><i className={`fa-solid fa-${icon} fa-2x text-white-50`}/></div>
                </div>
              </div>
            ))}
          </div>

          {/* Type Stats */}
          <div className="row g-2 g-md-3 row-cols-2 row-cols-md-3 row-cols-lg-6 mb-4">
            <div className="col-12 col-md-4 col-lg-2"><StatCard label="ทั้งหมด" value={data?.total} icon="users" cls="total"/></div>
            <div className="col"><StatCard label="Type 1" value={data?.type1} icon="house-user" cls="type1"/></div>
            <div className="col"><StatCard label="Type 2" value={data?.type2} icon="person-walking" cls="type2"/></div>
            <div className="col"><StatCard label="Type 3" value={data?.type3} icon="user-plus" cls="type3"/></div>
            <div className="col"><StatCard label="จำหน่าย" value={data?.type0} icon="user-xmark" cls="type0"/></div>
            <div className="col">
              <div className="stat-card" style={{borderLeftColor:'#e5e7eb',background:'#f9fafb'}}>
                <i className="fa-solid fa-question stat-icon" style={{color:'#9ca3af'}}/>
                <div className="stat-label" style={{color:'#9ca3af'}}>ยังไม่สำรวจ</div>
                <div className="stat-number" style={{color:'#9ca3af'}}>{data?.unsurveyed ?? '-'}</div>
              </div>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="row g-3 mb-4">
            <div className="col-12"><h5 className="fw-bold mb-3" style={{color:'var(--primary)'}}><i className="fa-solid fa-bullseye"/> ตัวชี้วัด KPI</h5></div>
            {[{title:'HBV/HCV (ก่อน 2535)',icon:'virus',color:'#0891b2',d:data?.kpi?.hep},
              {title:'Fit test (50-70 ปี)',icon:'microscope',color:'#d97706',d:data?.kpi?.fobt},
              {title:'HPV DNA (สตรี 30-60)',icon:'dna',color:'#db2777',d:data?.kpi?.hpv},
              {title:'พัฒนาการ (0-5 ปี)',icon:'baby',color:'#059669',d:{total:data?.kpi?.child?.total,screened:data?.kpi?.child?.normal}}
            ].map(({title,icon,color,d}) => (
              <div className="col-12 col-md-6 col-lg-3" key={title}>
                <KpiCard title={title} icon={icon} color={color}
                  percent={d ? pct(d.screened||0, d.total||0) : null}
                  detail={d ? `คัดกรองแล้ว ${d.screened||0} / ${d.total||0} คน` : null} />
              </div>
            ))}
          </div>

          {/* Risk Summary Cards */}
          {data?.risk && (
            <div className="row g-3 mb-4">
              <div className="col-12"><h5 className="fw-bold mb-1" style={{color:'#6f42c1'}}><i className="fa-solid fa-triangle-exclamation me-2"/>คัดกรองบุหรี่ / สุรา</h5><p className="text-muted small mb-3">นับเฉพาะอายุ 15 ปีขึ้นไป (Type 1 + Type 3)</p></div>
              {[{label:'เป้าหมาย (15+)',val:data.risk.target15plus,icon:'users',color:'#6d28d9',bg:'#f3e8ff'},
                {label:'คัดกรองบุหรี่แล้ว',val:data.risk.smokeSurveyed,icon:'smoking',color:'#be185d',bg:'#fce7f3'},
                {label:'คัดกรองสุราแล้ว',val:data.risk.alcSurveyed,icon:'wine-bottle',color:'#1d4ed8',bg:'#dbeafe'},
                {label:'พบเสี่ยง (สูบ+ดื่ม)',val:`${data.risk.smoking.current} + ${data.risk.alcohol.current}`,icon:'chart-pie',color:'#b45309',bg:'#fef3c7'}
              ].map(({label,val,icon,color,bg}) => (
                <div className="col-6 col-md-3" key={label}>
                  <div className="risk-stat-card shadow-sm" style={{background:`linear-gradient(135deg,${bg},${bg}ee)`}}>
                    <i className={`fa-solid fa-${icon} bg-icon`} style={{color}} />
                    <div className="small text-muted fw-bold">{label}</div>
                    <div className="big-num" style={{color}}>{val}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Summary Stats */}
          <div className="row g-2 g-md-3 mt-3">
            <div className="col-6 col-md-4"><StatCard label="ครัวเรือน" value={data ? data.totalHouses + ' หลัง' : null} icon="house" cls="bg-light border-0" /></div>
            <div className="col-6 col-md-4"><StatCard label="โรคเรื้อรัง" value={data ? data.chronicCount + ' คน' : null} icon="heart-pulse" cls="bg-light border-0" /></div>
            <div className="col-12 col-md-4"><StatCard label="หมายเหตุ" value="กราฟอยู่ใน Chart.js" icon="chart-bar" cls="bg-light border-0" /></div>
          </div>

        </div>
      </div>

      {/* FABs */}
      <div className="fab-group">
        <a href="/screening" className="fab-btn" style={{background:'#059669'}}><i className="fa-solid fa-clipboard-check"/></a>
        <button className="fab-btn" style={{background:'var(--primary)'}} onClick={loadDashboard}><i className="fa-solid fa-rotate"/></button>
      </div>
    </>
  );
}
