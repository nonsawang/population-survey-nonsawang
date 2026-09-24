const {createHash}=require('node:crypto');
const {matchRows,cidValid}=require('../lib/authen-report.cjs');
const hash=s=>createHash('sha256').update(s).digest('hex');
const fail=code=>{throw Error(code);};
function validate(job,batch){
 const row=batch.rows.find(r=>r.row===job.row_number),snapshot=batch.results.find(r=>r.row===job.row_number);
 if(!row||!snapshot||!batch.approved_rows.includes(job.row_number)||snapshot.fingerprint!==job.fingerprint||snapshot.vn!==job.vn||!['matched','already_present'].includes(snapshot.status))fail('AUTHEN_APPROVAL_CHANGED');
 if(row.issues.length||!cidValid(row.cid)||row.hcode!=='05080'||!row.serviceDate||!row.code)fail('AUTHEN_SOURCE_INVALID');
 return {row,snapshot};
}
async function write(db,job,batch){
 const {row,snapshot}=validate(job,batch);
 const [[lock]]=await db.execute("SELECT GET_LOCK('survey-authen-write',5) acquired");if(Number(lock.acquired)!==1)fail('AUTHEN_WRITER_BUSY');
 let committed=false;
 try{
  await db.query('SET NAMES utf8mb4');
  const [engines]=await db.query("SELECT table_name,engine FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('ovst','patient','visit_pttype','survey_authen_import_ledger')");
  if(engines.length!==4||engines.some(t=>t.engine!=='InnoDB'))fail('AUTHEN_TRANSACTION_REQUIRED');
  const [columns]=await db.query("SELECT character_maximum_length AS size FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='visit_pttype' AND column_name='auth_code'");
  if(columns.length!==1||row.code.length>Number(columns[0].size))fail('AUTHEN_FIELD_LENGTH');
  await db.beginTransaction();
  const [receipt]=await db.execute('SELECT * FROM survey_authen_import_ledger WHERE job_id=? FOR UPDATE',[job.id]);
  if(receipt.length&&(receipt[0].vn!==job.vn||receipt[0].fingerprint!==job.fingerprint||receipt[0].code_hash!==hash(row.code)))fail('AUTHEN_RECEIPT_CONFLICT');
  if(!receipt.length&&Date.now()-Date.parse(job.approved_at)>86400000)fail('AUTHEN_APPROVAL_EXPIRED');
  const [people]=await db.execute('SELECT hn FROM patient WHERE cid=? FOR UPDATE',[row.cid]);if(people.length!==1)fail('AUTHEN_PATIENT_AMBIGUOUS');
  const [visits]=await db.execute("SELECT o.vn,o.hn,o.vstdate AS service_date,p.cid,CONCAT(TRIM(p.fname),' ',TRIM(p.lname)) AS name FROM ovst o JOIN patient p ON p.hn=o.hn WHERE p.cid=? AND o.vstdate=? FOR UPDATE",[row.cid,row.serviceDate]);
  if(visits.length!==1||visits[0].vn!==job.vn||visits[0].hn!==snapshot.hn)fail('AUTHEN_VISIT_CHANGED');
  const [rights]=await db.execute('SELECT auth_code FROM visit_pttype WHERE vn=? FOR UPDATE',[job.vn]);
  if(rights.length!==1)fail('AUTHEN_INSURANCE_AMBIGUOUS');
  const old=String(rights[0].auth_code||'').trim();
  const [used]=await db.execute('SELECT vn FROM visit_pttype WHERE auth_code=? AND vn<>? LIMIT 1 FOR UPDATE',[row.code,job.vn]);
  const current=matchRows([row],[{...visits[0],authCodes:old?[old]:[],codeElsewhere:used.length?[row.code]:[]}])[0];
  if(!['matched','already_present'].includes(current.status))fail('AUTHEN_LIVE_CONFLICT');
  if(receipt.length&&old!==row.code)fail('AUTHEN_RECEIPT_READBACK_FAILED');
  if(!old){
   if(snapshot.existingCode)fail('AUTHEN_EXISTING_CHANGED');
   const [updated]=await db.execute("UPDATE visit_pttype SET auth_code=? WHERE vn=? AND TRIM(COALESCE(auth_code,''))=''",[row.code,job.vn]);
   if(updated.affectedRows!==1)fail('AUTHEN_UPDATE_CONFLICT');
  }
  const [back]=await db.execute('SELECT auth_code FROM visit_pttype WHERE vn=?',[job.vn]);
  if(back.length!==1||String(back[0].auth_code).trim()!==row.code)fail('AUTHEN_READBACK_FAILED');
  const outcome=receipt[0]?.outcome||(old?'already_present':'written');
  if(!receipt.length)await db.execute('INSERT INTO survey_authen_import_ledger(job_id,batch_id,row_number,vn,fingerprint,code_hash,approved_by,outcome,recorded_at) VALUES(?,?,?,?,?,?,?,?,NOW())',[job.id,job.batch_id,job.row_number,job.vn,job.fingerprint,hash(row.code),job.approved_by,outcome]);
  await db.commit();committed=true;return {state:outcome};
 }finally{if(!committed)await db.rollback();await db.execute("SELECT RELEASE_LOCK('survey-authen-write')");}
}
async function reconcile({source,db}){
 const {data,error}=await source.from('authen_report_writes').select('*').eq('state','pending').order('approved_at').limit(1);
 if(error)throw Error('AUTHEN_WRITE_QUEUE_FAILED');if(!data.length)return {authen_written:0};const job=data[0];
 const {data:batch,error:readError}=await source.from('authen_report_batches').select('rows,results,approved_rows').eq('id',job.batch_id).single();
 if(readError)throw Error('AUTHEN_WRITE_SOURCE_FAILED');
 let outcome;
 try{outcome=await write(db,job,batch);}catch(e){
  // Uncertain database/network failures stay pending for receipt-based recovery.
  if(!/^AUTHEN_(APPROVAL_CHANGED|SOURCE_INVALID|TRANSACTION_REQUIRED|FIELD_LENGTH|RECEIPT_CONFLICT|APPROVAL_EXPIRED|PATIENT_AMBIGUOUS|VISIT_CHANGED|INSURANCE_AMBIGUOUS|LIVE_CONFLICT|RECEIPT_READBACK_FAILED|EXISTING_CHANGED|UPDATE_CONFLICT|READBACK_FAILED)$/.test(e.message))throw Error('AUTHEN_WRITE_RETRY');
  outcome={state:'blocked',error_code:e.message};
 }
 const {error:ackError}=await source.from('authen_report_writes').update({...outcome,completed_at:new Date().toISOString()}).eq('id',job.id).eq('state','pending');
 if(ackError)throw Error('AUTHEN_ACK_PENDING');return {authen_written:outcome.state==='written'?1:0,authen_write_state:outcome.state};
}
module.exports={write,validate,reconcile};
