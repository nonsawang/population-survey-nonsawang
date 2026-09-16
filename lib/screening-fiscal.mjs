export function baselineLabel(date) {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return 'ผลเดิม • ไม่ระบุปีงบ';
 const d=new Date(`${date}T00:00:00Z`);
 if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==date)return 'ผลเดิม • วันที่ไม่ถูกต้อง';
 return `ผลเดิม ปีงบ ${d.getUTCFullYear()+543+(d.getUTCMonth()>=9?1:0)}`;
}
