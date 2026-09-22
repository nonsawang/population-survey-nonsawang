// Observe existing HOSxP evidence. Never request Authen, allocate invoices or transfer debt.
const {acknowledge}=require('./hosxp-fit-import.cjs');
async function reconcile({source,db}){
 const {data:rows,error}=await source.from('hosxp_fit_import_results').select('preparation_id,vn,payload_hash,policy_version').eq('import_status','imported').order('verified_at',{ascending:true}).limit(1);
 if(error)throw Error('FINANCE_STATUS_SOURCE_FAILED');
 if(!rows.length)return {finance_status_refreshed:0};
 const expected=rows[0];
 await db.query('START TRANSACTION READ ONLY');
 try{
  const [ledger]=await db.execute('SELECT * FROM survey_fit_import_ledger WHERE preparation_id=?',[expected.preparation_id]);
  if(ledger.length!==1||ledger[0].vn!==expected.vn||ledger[0].payload_hash!==expected.payload_hash||ledger[0].policy_version!==expected.policy_version)throw Error('FINANCE_STATUS_LEDGER_MISMATCH');
  await acknowledge(source,db,ledger[0]);
  return {finance_status_refreshed:1};
 }finally{await db.rollback();}
}
module.exports={reconcile};
