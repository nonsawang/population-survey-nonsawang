import {calculateAge,getBirthYear,MALE_TITLES} from '../lib/utils.js';
import {populationStatus} from '../lib/population-status.js';
export function computeStats(rows) {
    const AR = ['0-4','5-9','10-14','15-19','20-24','25-29','30-34','35-39','40-44','45-49','50-54','55-59','60-64','65-69','70-74','75-79','80+'];
    const s = { total:0, unsurveyed:0, discharged:0, deceased:0, outside:0, type0:0, type1:0, type2:0, type3:0, type4:0, byMoo:{}, houses: new Set(), chronicCount:0, population:{children:0,working:0,elderly:0}, ageGroups:{male:{},female:{}}, kpi:{hep:{total:0,screened:0},fobt:{total:0,screened:0},hpv:{total:0,screened:0},child:{total:0,normal:0}}, risk:{target15plus:0,smokeSurveyed:0,alcSurveyed:0,smoking:{neverSmoked:0,quit:0,current:0},alcohol:{neverDrank:0,quit:0,current:0},fagerstrom:{low:0,medium:0,high:0},assist:{low:0,medium:0,high:0},byMoo:[]}, vhvStats:{}, kpiByMoo:[] };
    AR.forEach(r => { s.ageGroups.male[r]=0; s.ageGroups.female[r]=0; });
    const rBM = {}, kBM = {};

    (rows||[]).forEach(r => {
      const state = populationStatus(r); const type = state.residencyType;
      const moo = String(r.moo||'').trim(); const house = String(r.house||'').trim(); const vhv = String(r.vhv||'').trim();
      const gender = MALE_TITLES.includes(String(r.title||'').trim()) ? 'male' : 'female';
      const age = calculateAge(r.birth_date);
      if (!state.active) { if (state.deceased) s.deceased++; else s.discharged++; return; }
      if (type==='4') { s.outside++; return; }
      s.total++;
      if (type==='0') s.type0++; else if (type==='1') s.type1++; else if (type==='2') s.type2++; else if (type==='3') s.type3++; else s.unsurveyed++;

      if (moo && moo!=='-') {
        if (!s.byMoo[moo]) s.byMoo[moo]={total:0,type0:0,type1:0,type2:0,type3:0,unsurveyed:0};
        s.byMoo[moo].total++;
        if (type==='0') s.byMoo[moo].type0++; else if (type==='1') s.byMoo[moo].type1++; else if (type==='2') s.byMoo[moo].type2++; else if (type==='3') s.byMoo[moo].type3++; else s.byMoo[moo].unsurveyed++;
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
        if (by && by<1992) { s.kpi.hep.total++; const v=r.hep_screen||''; if(v&&v!=='-') { s.kpi.hep.screened++; kBM[moo].hep.s++; } kBM[moo].hep.t++; }
        if (age!=='-'&&age>=50&&age<=70) { s.kpi.fobt.total++; const v=r.fobt_screen||''; if(v&&v!=='-') { s.kpi.fobt.screened++; kBM[moo].fobt.s++; } kBM[moo].fobt.t++; }
        if (gender==='female'&&age!=='-'&&age>=30&&age<=60) { s.kpi.hpv.total++; const v=r.hpv_screen||''; if(v&&v!=='-') { s.kpi.hpv.screened++; kBM[moo].hpv.s++; } kBM[moo].hpv.t++; }
        if (age!=='-'&&age>=0&&age<=5) { s.kpi.child.total++; const v=r.child_dev||''; if(v&&v!=='-'&&v!=='รอผล') { s.kpi.child.normal++; kBM[moo].child.s++; } kBM[moo].child.t++; }

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