export function trackingFor(history, imported, reports){
 if(history.kpi!=='FOBT')return {auth:'ยังไม่รองรับ',importLabel:'รอพัฒนาการนำเข้า',stage:'unsupported'};
 const matches=[];
 for(const report of reports||[])for(const m of report.results||[]){
  if(m.matchVersion!=='fit-source-v1'||m.historyId!==history.id)continue;
  const row=report.rows?.find(r=>r.row===m.row),write=report.writes?.find(w=>w.row===m.row);
  matches.push({row,write,m,checked:report.checked_at});
 }
 const codes=[...new Set(matches.map(x=>x.row?.code).filter(Boolean))];
 const problem=matches.some(x=>['blocked','failed'].includes(x.write?.state)||['blocked','ambiguous','unmatched','failed'].includes(x.m.status));
 const conflict=codes.length>1||matches.some(x=>x.write?.vn&&imported?.vn&&x.write.vn!==imported.vn);
 const recorded=matches.some(x=>['written','already_present'].includes(x.write?.state)&&!!imported?.vn&&x.write.vn===imported.vn);
 const auth=conflict?'มีข้อมูลขัดแย้ง ต้องตรวจสอบ':problem?'ไม่ผ่านตรวจสอบ':imported?.claim_checks?.auth===true?'พบ Authen ใน HOSxP':recorded?'บันทึก Authen แล้ว':matches.some(x=>x.write?.state==='pending')?'อนุมัติแล้ว รอ LAN':matches.length?'พบในรายงาน รอตรวจรับรอง':'ไม่พบใน 20 รายงานล่าสุด';
 const importLabel=imported?.import_status==='imported'?'นำเข้า HOSxP สำเร็จ':imported?'เตรียมแล้ว รอ LAN':history.state?'อนุมัติแล้ว ยังไม่เตรียม':'รออนุมัติผล';
 return {auth,codes,importLabel,vn:imported?.vn,verifiedAt:imported?.verified_at,claimReady:imported?.claim_status==='ready',stage:conflict||problem?'problem':imported?.import_status==='imported'?'imported':imported?'queued':'pending'};
}
