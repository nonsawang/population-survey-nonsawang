// Only the Supabase identity correction is written here. HOSxP stays read-only.
const {cidValid}=require('../lib/authen-report.cjs');
function verify(target,persons,patients){
 if(!cidValid(target.cid)||persons.length!==1||patients.length!==1)throw Error('IDENTITY_NOT_UNIQUE');
 const p=persons[0],h=patients[0];
 if(String(p.cid)!==target.cid||String(h.cid)!==target.cid||String(p.patient_hn)!==String(h.hn))throw Error('IDENTITY_HN_CONFLICT');
 if(!target.birth_date||target.birth_date!==p.birthdate||target.birth_date!==h.birthday)throw Error('IDENTITY_BIRTH_DATE_CONFLICT');
 return {cid:target.cid,hn:String(h.hn),hosxp_person_id:String(p.person_id)};
}
async function read(q){const {data,error}=await q;if(error)throw Error('IDENTITY_SOURCE_READ_FAILED');return data;}
async function reconcile({source,db}){
 const jobs=await read(source.from('person_identity_jobs').select('*').eq('state','pending').order('requested_at').limit(1));
 if(!jobs.length)return {identity_merged:0};const job=jobs[0],locks=[];
 try{
  if(Date.now()-Date.parse(job.requested_at)>86400000)throw Error('IDENTITY_REQUEST_EXPIRED');
  const preps=await read(source.from('hosxp_fit_preparations').select('id').in('person_id',[job.source_id,job.target_id]).order('id'));
  // Same locks used by direct imports; a late/uncertain import is checked in its ledger.
  for(const p of preps){const key='survey-fit:'+p.id;const [[r]]=await db.execute('SELECT GET_LOCK(?,5) ok',[key]);if(Number(r.ok)!==1)throw Error('IDENTITY_BUSY');locks.push(key);}
  const target=await read(source.from('population').select('cid,birth_date').eq('person_id',job.target_id).single());
  await db.query('SET NAMES utf8mb4');await db.query('START TRANSACTION READ ONLY');let verified;
  try{
   const from=await read(source.from('hosxp_fit_preparations').select('id').eq('person_id',job.source_id));
   if(from.some(p=>!preps.some(x=>x.id===p.id)))throw Error('IDENTITY_CHANGED');
   for(const p of from){const [receipts]=await db.execute('SELECT vn FROM survey_fit_import_ledger WHERE preparation_id=?',[p.id]);if(receipts.length)throw Error('IDENTITY_SOURCE_ALREADY_IMPORTED');}
   const [persons]=await db.execute('SELECT person_id,cid,patient_hn,birthdate FROM person WHERE cid=? LIMIT 2',[target.cid]);
   const [patients]=await db.execute('SELECT hn,cid,birthday FROM patient WHERE cid=? LIMIT 2',[target.cid]);
   verified=verify(target,persons,patients);
  }finally{await db.rollback();}
  const {error}=await source.rpc('person_identity_apply',{p_job:job.id,p_verified:verified});
  if(error){if(/IDENTITY_|SOURCE_|TARGET_/.test(error.message||''))throw Error('IDENTITY_CHANGED_OR_CONFLICT');throw Error('IDENTITY_ACK_RETRY');}
  return {identity_merged:1,preparations:preps.map(p=>p.id)};
 }catch(e){
  const blocking=['IDENTITY_NOT_UNIQUE','IDENTITY_HN_CONFLICT','IDENTITY_BIRTH_DATE_CONFLICT','IDENTITY_SOURCE_ALREADY_IMPORTED','IDENTITY_CHANGED','IDENTITY_CHANGED_OR_CONFLICT','IDENTITY_REQUEST_EXPIRED'];
  if(!blocking.includes(e.message))throw Error('IDENTITY_RETRY');
  const {error}=await source.from('person_identity_jobs').update({state:'blocked',error_code:e.message,completed_at:new Date().toISOString()}).eq('id',job.id).eq('state','pending');
  if(error)throw Error('IDENTITY_ACK_RETRY');return {identity_merged:0,identity_blocked:1};
 }finally{for(const key of locks.reverse())await db.execute('SELECT RELEASE_LOCK(?)',[key]);}
}
module.exports={verify,reconcile};
