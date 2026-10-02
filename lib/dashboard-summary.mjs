// Convert only aggregated groups into the existing chart contract; no patient rows.
export function dashboardStats(payload){
 const d={...payload.summary,byMoo:{},pyramid:payload.pyramid,vhvList:payload.vhvList,kpiByMoo:[]};
 d.risk={...d.risk,byMoo:[]};
 for(const {moo,stats:s} of payload.groups){
  if(moo&&moo!=='-'&&s.total>0)d.byMoo[moo]={total:s.total,type0:s.type0,type1:s.type1,type2:s.type2,type3:s.type3,unsurveyed:s.unsurveyed};
  if(s.kpiGroup>0)d.kpiByMoo.push({moo,hepTotal:s.kpi.hep.total,hepScreened:s.kpi.hep.screened,fobtTotal:s.kpi.fobt.total,fobtScreened:s.kpi.fobt.screened,hpvTotal:s.kpi.hpv.total,hpvScreened:s.kpi.hpv.screened,childTotal:s.kpi.child.total,childScreened:s.kpi.child.normal});
  const r=s.risk;
  if(r.target15plus>0)d.risk.byMoo.push({moo,target:r.target15plus,smokeSurveyed:r.smokeSurveyed,smokeNever:r.smoking.neverSmoked,smokeQuit:r.smoking.quit,smoker:r.smoking.current,alcSurveyed:r.alcSurveyed,alcNever:r.alcohol.neverDrank,alcQuit:r.alcohol.quit,drinker:r.alcohol.current});
 }
 d.insight={...d.population,dependencyRatio:d.population.working>0?((d.population.children+d.population.elderly)/d.population.working*100).toFixed(1):0};
 return d;
}
