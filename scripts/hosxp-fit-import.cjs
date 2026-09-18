// Explicit single-job writer. Default is read-only, never an unattended batch.
const path=require('node:path');
const mysql=require('mysql2/promise');
const {createClient}=require('@supabase/supabase-js');
const {readConfig}=require('./refresh-hosxp-review.cjs');
const {requireServiceKey}=require('./lan-service-key.cjs');
const {inspect}=require('./hosxp-fit-preflight.cjs');
const {validateSource,snapshotStatus,targetCheck}=require('./validate-hosxp-fit-queue.cjs');
const {POLICY,stamp,readBack,claimChecks,writeVisit,payloadHash}=require('./hosxp-fit-writer.cjs');
function writeEnabled(c,args=process.argv){return c.HOSXP_IMPORT_ENABLED==='true'&&args.includes('--write')&&args.includes('--confirm-fit-write');}
async function rows(query){const {data,error}=await query;if(error)throw new Error('SOURCE_READ_FAILED');return data;}
async function sourceJob(source,id){
 const job=await rows(source.from('hosxp_fit_preparations').select('*').eq('id',id).single());
 const person=await rows(source.from('population').select('person_id,cid,fname,lname,birth_date,fobt_screen,fobt_date').eq('person_id',job.person_id).single());
 const history=await rows(source.from('screening_history').select('id,person_id,kpi,result,screen_date,recorded_at').eq('id',job.history_id).single());
 const approval=await rows(source.from('screening_review').select('history_id,approved_by,approved_at').eq('history_id',job.history_id).maybeSingle());
 const invalid=validateSource(job,history,person,approval,stamp().date);if(invalid)throw new Error(invalid);
 const newer=await rows(source.from('screening_history').select('id').eq('person_id',job.person_id).eq('kpi','FOBT').gt('recorded_at',history.recorded_at).limit(1));
 if(newer.length)throw new Error('SOURCE_CHANGED');
 const duplicates=await rows(source.from('population').select('person_id').eq('cid',person.cid).limit(2));
 if(duplicates.length!==1)throw new Error('DUPLICATE_SOURCE_CID');
 const batches=await rows(source.from('hosxp_review_batches').select('id,captured_at,completed_at').not('completed_at','is',null).order('captured_at',{ascending:false}).limit(1));
 const batch=batches[0];
 const targets=batch?await rows(source.from('hosxp_review_snapshot').select('cid,hosxp_person_id').eq('batch_id',batch.id).eq('cid',person.cid).limit(2)):[];
 const stale=snapshotStatus(batch,targets);if(stale)throw new Error(stale);
 return {job,person,snapshot:targets[0],approval};
}
const required={ovst:['hos_guid','vn','hn','vstdate','vsttime'],vn_stat:['vn','hn','pdx','inc_nondrug'],opdscreen:['hos_guid','vn','cc'],ovst_seq:['vn','seq_id'],ovstdiag:['ovst_diag_id','vn'],lab_head:['lab_order_number','vn','order_note'],lab_order:['lab_order_number','lab_items_code','lab_order_result'],opitemrece:['hos_guid','vn','finance_number'],visit_pttype:['vn','pttype','pttype_number','auth_code'],serial:['name','serial_no'],survey_fit_import_ledger:['preparation_id','payload_hash','vn','hn','screen_date','lab_order_number','lab_result','imported_at','policy_version']};
async function schemaCheck(db){
 required.pp_special=['pp_special_id','vn','hn','pp_special_type_id','pp_special_code','doctor','pp_special_service_place_type_id','dest_hospcode','entry_datetime','hos_guid'];
 required.pp_special_type=['pp_special_type_id','pp_special_code','is_active'];
 const [tables]=await db.query('SELECT table_name,engine FROM information_schema.tables WHERE table_schema=DATABASE()');
 const [columns]=await db.query('SELECT table_name,column_name FROM information_schema.columns WHERE table_schema=DATABASE()');
 const problems=[];
 for(const [table,fields] of Object.entries(required)){
  if(!tables.some(t=>t.table_name===table&&t.engine==='InnoDB'))problems.push('ENGINE_OR_TABLE_'+table);
  for(const field of fields)if(!columns.some(c=>c.table_name===table&&c.column_name===field))problems.push('COLUMN_'+table+'_'+field);
 }
 return problems;
}
async function acknowledge(source,db,ledger){
 await readBack(db,ledger);
 const checks=await claimChecks(db,ledger.vn);
 const result={preparation_id:ledger.preparation_id,vn:ledger.vn,lab_order_number:ledger.lab_order_number,imported_at:ledger.imported_at.replace(' ','T')+'+07:00',verified_at:new Date().toISOString(),policy_version:POLICY,payload_hash:ledger.payload_hash,import_status:'imported',claim_status:'not_ready',claim_checks:checks};
 const {error}=await source.from('hosxp_fit_import_results').upsert(result,{onConflict:'preparation_id'});
 if(error)throw new Error('COMMITTED_ACK_PENDING');
 return {preparation_id:ledger.preparation_id,vn:ledger.vn,import_status:'imported',claim_status:'not_ready',claim_checks:checks,replayed:!!ledger.replayed};
}
async function main(config,args=process.argv){
 requireServiceKey(config.SUPABASE_SERVICE_ROLE_KEY);
 if(!config.SUPABASE_URL||new URL(config.SUPABASE_URL).protocol!=='https:')throw new Error('HTTPS_SOURCE_REQUIRED');
 const id=args.find(x=>x.startsWith('--job='))?.slice(6);
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id||''))throw new Error('EXPLICIT_PREPARATION_ID_REQUIRED');
 if(args.includes('--write')&&!writeEnabled(config,args))throw new Error('WRITE_NOT_ENABLED');
 const source=createClient(config.SUPABASE_URL,config.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const db=await mysql.createConnection({host:config.HOSXP_DB_HOST,port:Number(config.HOSXP_DB_PORT||3306),user:config.HOSXP_DB_USER,password:config.HOSXP_DB_PASSWORD,database:config.HOSXP_DB_NAME,dateStrings:true,connectTimeout:8000});
 try{
  // The server init_connect overrides the handshake with TIS-620.
  // mysql2 sends UTF-8: align this session before binding Thai text.
  await db.query('SET NAMES utf8mb4');
  const issues=await schemaCheck(db);
  await rows(source.from('hosxp_fit_import_results').select('preparation_id').eq('preparation_id',id).limit(1));
  if(issues.length)return {mode:'blocked',issues,write_enabled:false};
  const [prior]=await db.execute('SELECT * FROM survey_fit_import_ledger WHERE preparation_id=?',[id]);
  if(prior.length){
   if(!writeEnabled(config,args)){await readBack(db,prior[0]);return {mode:'read_only',preparation_id:id,already_imported:true};}
   // Recovery verifies immutable preparation, not the potentially edited latest screening.
   const job=await rows(source.from('hosxp_fit_preparations').select('*').eq('id',id).single());
   if(prior[0].payload_hash!==payloadHash(job)||prior[0].policy_version!==POLICY)throw new Error('REPLAY_PAYLOAD_CHANGED');
   return await acknowledge(source,db,{...prior[0],replayed:true});
  }
  const preflight=await inspect(config);if(!preflight.catalogVerified)throw new Error('CATALOG_CHANGED');
  const context=await sourceJob(source,id);
  if(!writeEnabled(config,args)){
   await db.query('START TRANSACTION READ ONLY');
   try{return {mode:'read_only',preparation_id:id,status:await targetCheck(db,context.person,context.job.screen_date,context.snapshot),policy:POLICY};}finally{await db.rollback();}
  }
  const fingerprint=JSON.stringify(context);
  const revalidate=async()=>{if(JSON.stringify(await sourceJob(source,id))!==fingerprint)throw new Error('SOURCE_CHANGED');};
  const ledger=await writeVisit(db,{...context,revalidate});
  return await acknowledge(source,db,ledger);
 }finally{await db.end();}
}
if(require.main===module)main(readConfig(path.resolve(__dirname,'../.env.sync'))).then(r=>{console.log(JSON.stringify(r,null,2));if(r.mode==='blocked')process.exitCode=2;}).catch(e=>{console.error(/^[A-Z][A-Z0-9_]+$/.test(e.message)?e.message:'HOSXP_IMPORT_FAILED');process.exitCode=1;});
module.exports={writeEnabled,main,sourceJob,schemaCheck,acknowledge};
