// Match report rows to live visits. This module never writes HOSxP.
const {matchRows}=require('../lib/authen-report.cjs');
async function inspect(db,rows){
 const visits=[];await db.query('SET NAMES utf8mb4');await db.query('START TRANSACTION READ ONLY');
 try{
  const seen=new Set();
  for(const row of rows){
   if(row.issues.length)continue;const key=row.cid+'|'+row.serviceDate;if(seen.has(key))continue;seen.add(key);
   const [found]=await db.execute(`SELECT o.vn,o.hn,o.vstdate AS service_date,p.cid,f.preparation_id AS fitPreparationId,f.screen_date AS fitScreenDate,f.lab_result AS fitResult,f.lab_order_number AS labOrderNumber,CONCAT(TRIM(p.fname),' ',TRIM(p.lname)) AS name
    FROM ovst o JOIN patient p ON p.hn=o.hn JOIN survey_fit_import_ledger f ON f.vn=o.vn AND f.hn=o.hn JOIN lab_head lh ON lh.vn=o.vn AND lh.lab_order_number=f.lab_order_number JOIN lab_order lo ON lo.lab_order_number=f.lab_order_number AND lo.lab_items_code=? AND lo.lab_order_result=f.lab_result WHERE p.cid=? AND o.vstdate=? LIMIT 20`,[require('./hosxp-fit-preflight.cjs').mapping.lab,row.cid,row.serviceDate]);
   for(const v of found){
    const [codes]=await db.execute("SELECT DISTINCT auth_code FROM visit_pttype WHERE vn=? AND TRIM(COALESCE(auth_code,''))<>''",[v.vn]);
    const reportCodes=rows.filter(r=>r.cid===row.cid&&r.serviceDate===row.serviceDate).map(r=>r.code);
    const elsewhere=[];for(const code of reportCodes){const [r]=await db.execute('SELECT vn FROM visit_pttype WHERE auth_code=? AND vn<>? LIMIT 1',[code,v.vn]);if(r.length)elsewhere.push(code);}
    visits.push({...v,authCodes:codes.map(c=>String(c.auth_code).trim()),codeElsewhere:elsewhere});
   }
  }
  return matchRows(rows,visits);
 }finally{await db.rollback();}
}
async function reconcile({source,db}){
 const {data,error}=await source.from('authen_report_batches').select('id,rows').eq('state','pending').order('uploaded_at').limit(1);
 if(error)throw Error('AUTHEN_REPORT_SOURCE_FAILED');if(!data.length)return {authen_reports_matched:0};
 const b=data[0];let results;
 try{results=await inspect(db,b.rows);}catch{
  const {error:markError}=await source.from('authen_report_batches').update({state:'failed',error_code:'LAN_READ_FAILED'}).eq('id',b.id).eq('state','pending');
  if(markError)throw Error('AUTHEN_REPORT_ACK_FAILED');return {authen_reports_matched:0,authen_report_error:true};
 }
 const {error:saveError}=await source.from('authen_report_batches').update({results,state:'matched',checked_at:new Date().toISOString(),error_code:null}).eq('id',b.id).eq('state','pending');
 if(saveError)throw Error('AUTHEN_REPORT_ACK_FAILED');return {authen_reports_matched:1};
}
module.exports={inspect,reconcile};
