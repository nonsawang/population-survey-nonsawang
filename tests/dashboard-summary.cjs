const fs=require('fs'),assert=require('node:assert/strict');const {PGlite}=require('@electric-sql/pglite');
(async()=>{
const {computeStats}=await import('./dashboard-reference.mjs');const {dashboardStats}=await import('../lib/dashboard-summary.mjs');
const db=new PGlite();
try{
await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE TABLE population(person_id text,cid text,fname text,title text,birth_date date,moo text,house text,vhv text,residency_type text,status_model_version int,person_discharge_id int,chronic text,hep_screen text,fobt_screen text,hpv_screen text,child_dev text,smoking_status text,alcohol_status text,fagerstrom_score text,assist_score text);ALTER TABLE population ENABLE ROW LEVEL SECURITY;GRANT SELECT ON population TO anon,authenticated;CREATE POLICY scope ON population USING(current_setting('test.actor',true)='staff' OR (current_setting('test.actor',true)='vhv' AND moo='1'));`);
const rows=[];
for(let i=0;i<280;i++){
 const r={person_id:String(i),cid:'private-cid-'+i,fname:'private-name',title:['นาย','นาง','เด็กชาย',''][i%4],birth_date:i%17===0?null:`${[2023,2021,2011,1996,1976,1966,1956,1946,1900,1800,2030,1991][i%12]}-01-01`,moo:['1','2','','-'][i%4],house:String(i%11),vhv:['อสม ก','อสม ข','-','ไม่ระบุ'][i%4],residency_type:['0','1','2','3','4','','-'][i%7],status_model_version:i%5===0?0:1,person_discharge_id:[9,9,9,9,9,1,2,null][i%8],chronic:['-','ปกติ (ไม่มีโรค)','DM,HT','DM / ปกติ (ไม่มีโรค)'][i%4],hep_screen:['','-','รอผล','ปกติ'][i%4],fobt_screen:'ปกติ',hpv_screen:'-',child_dev:'รอผล',smoking_status:['สูบ','ไม่สูบ ไม่เคย','เลิกแล้ว','-'][i%4],alcohol_status:['ดื่ม','ไม่ดื่ม','หยุดแล้ว',''][i%4],fagerstrom_score:['3','6','7','bad'][i%4],assist_score:['10','26','27','bad'][i%4]};rows.push(r);
 const keys=Object.keys(r);await db.query(`INSERT INTO population(${keys.join(',')}) VALUES(${keys.map((_,n)=>'$'+(n+1)).join(',')})`,Object.values(r));
}
await db.exec(fs.readFileSync('migrations/20261002_dashboard_summary.sql','utf8'));await db.exec('SET ROLE anon');
for(const actor of ['','vhv','staff']){
 await db.query("SELECT set_config('test.actor',$1,false)",[actor]);const payload=(await db.query('SELECT dashboard_summary() AS d')).rows[0].d;
 const expected=computeStats(actor==='staff'?rows:actor==='vhv'?rows.filter(r=>r.moo==='1'):[]),actual=dashboardStats(payload);
 actual.risk.byMoo.sort((a,b)=>a.moo.localeCompare(b.moo));expected.risk.byMoo.sort((a,b)=>a.moo.localeCompare(b.moo));
 for(const k of ['total','unsurveyed','discharged','deceased','outside','type0','type1','type2','type3','totalHouses','chronicCount','population','kpi','risk','byMoo','pyramid','insight'])assert.deepEqual(actual[k],expected[k],actor+':'+k);
 const sort=a=>[...a].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));assert.deepEqual(sort(actual.kpiByMoo),sort(expected.kpiByMoo));assert.deepEqual(sort(actual.vhvList),sort(expected.vhvList));assert(!JSON.stringify(payload).includes('private-'));
 console.log('PASS '+(actor||'anonymous')+' parity and no patient identifiers; summary bytes '+Buffer.byteLength(JSON.stringify(payload)));
}
}finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
