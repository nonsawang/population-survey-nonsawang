const fail=code=>{throw new Error(code);};
const norm=v=>v==null?null:String(v);
function validate(job){
 if(!job || !/^[0-9a-f-]{36}$/i.test(job.id)||!/^[0-9a-f]{64}$/i.test(job.fingerprint))fail('INVALID_JOB');
 if(!/^\d+$/.test(job.target_person_id)||!/^\d{13}$/.test(job.cid))fail('INVALID_IDENTITY');
 let sum=0;for(let i=0;i<12;i++)sum+=Number(job.cid[i])*(13-i);
 if((11-sum%11)%10!==Number(job.cid[12]))fail('INVALID_CID');
 const keys=Object.keys(job.changes||{});
 if(!keys.length||keys.some(k=>!['house_regist_type_id','person_discharge_id'].includes(k)))fail('INVALID_CHANGES');
 for(const k of keys)if(!(k==='house_regist_type_id'?[0,1,2,3,4]:[1,2,3,9]).includes(job.changes[k]))fail('INVALID_CHANGES');
 if(!job.old_values)fail('MISSING_BASELINE');
 return keys;
}
async function writeApproved(db,job){
 const keys=validate(job);
 const [engines]=await db.execute("SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('person','survey_person_review_receipts')");
 if(engines.length!==2||engines.some(r=>r.ENGINE!=='InnoDB'))fail('TRANSACTIONAL_TABLES_REQUIRED');
 await db.beginTransaction();
 try{
  // Reserve a unique receipt in the same transaction as the person update.
  await db.execute('INSERT INTO survey_person_review_receipts(approval_id,fingerprint) VALUES(?,?)',[job.id,job.fingerprint]);
  const [rows]=await db.execute('SELECT person_id,cid,house_regist_type_id,person_discharge_id,last_update FROM person WHERE person_id=? OR TRIM(cid)=? FOR UPDATE',[job.target_person_id,job.cid]);
  if(rows.length!==1||String(rows[0].person_id)!==job.target_person_id||String(rows[0].cid).trim()!==job.cid)fail('IDENTITY_CONFLICT');
  for(const k of ['house_regist_type_id','person_discharge_id','last_update'])if(norm(rows[0][k])!==norm(job.old_values[k]))fail('BASELINE_CHANGED');
  const [result]=await db.execute('UPDATE person SET '+keys.map(k=>'`'+k+'`=?').join(',')+',last_update=NOW() WHERE person_id=?',[...keys.map(k=>job.changes[k]),job.target_person_id]);
  if(result.affectedRows!==1)fail('UPDATE_COUNT');
  await db.commit();
  return {written:true};
 }catch(e){await db.rollback().catch(()=>{});throw e;}
}
async function recoverReceipt(db,client,id,fingerprint){
 const [rows]=await db.execute('SELECT fingerprint FROM survey_person_review_receipts WHERE approval_id=?',[id]);
 if(rows.length!==1||rows[0].fingerprint!==fingerprint)fail('RECONCILIATION_REQUIRED');
 const {error}=await client.rpc('hosxp_review_finish',{p_id:id,p_outcome:'sent'});
 if(error)fail('ACK_PENDING');
 return {status:'sent'};
}
async function dispatch({db,client,id,enabled=false}){
 if(!enabled)fail('DISPATCH_DISABLED');
 const {data:job,error}=await client.rpc('hosxp_review_reserve',{p_id:id});
 if(error||!job)fail('RESERVATION_REJECTED');
 // Any exception after reservation is held for reconciliation; never blindly resend.
 await writeApproved(db,job);
 return recoverReceipt(db,client,job.id,job.fingerprint);
}
module.exports={writeApproved,dispatch,recoverReceipt,validate};
