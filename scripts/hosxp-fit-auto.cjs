// One bounded scheduled cycle. No public port; only prepared, approved FIT jobs.
const fs=require('node:fs'),path=require('node:path');
function settings(value){
 if(!value||value.enabled!==true||!['new_only','include_existing'].includes(value.scope)||!Number.isFinite(Date.parse(value.startAt)))throw Error('AUTO_NOT_CONFIGURED');
 return {...value,limit:Math.min(5,Math.max(1,Number(value.limit)||1))};
}
function due(job,done,state,now){return !done.has(job.id)&&(!state[job.id]||state[job.id].attempts<5&&state[job.id].nextAt<=now);}
function failure(state,id,now,code){const attempts=(state[id]?.attempts||0)+1;state[id]={attempts,nextAt:now+Math.min(60,5*2**(attempts-1))*60000,code:/^[A-Z][A-Z0-9_]{1,80}$/.test(code)?code:'AUTO_IMPORT_FAILED'};}
async function processJobs({jobs,done,state,limit,importJob,now,save}){
 const report={imported:0,failed:0};let attempted=0;
 for(const job of jobs){
  if(attempted>=limit)break;if(!due(job,done,state,now))continue;attempted++;
  // Persist a cooldown before starting; an interrupted cycle cannot hot-loop.
  failure(state,job.id,now,'IN_PROGRESS');await save(state);
  try{
   const result=await importJob(job.id);
   if(result.import_status!=='imported')throw Error('AUTO_SCHEMA_BLOCKED');
   delete state[job.id];done.add(job.id);report.imported++;
  }catch(e){state[job.id].code=/^[A-Z][A-Z0-9_]{1,80}$/.test(e.message)?e.message:'AUTO_IMPORT_FAILED';report.failed++;}
  await save(state);
 }
 return report;
}
async function run(config,optionsFile){
 const {createClient}=require('@supabase/supabase-js'),mysql=require('mysql2/promise');
 const {requireServiceKey}=require('./lan-service-key.cjs');
 const {refresh}=require('./refresh-hosxp-review.cjs'),{main}=require('./hosxp-fit-import.cjs');
 const opt=settings(JSON.parse(fs.readFileSync(optionsFile,'utf8').replace(/^\uFEFF/,'')));
 requireServiceKey(config.SUPABASE_SERVICE_ROLE_KEY);
 if(new URL(config.SUPABASE_URL).protocol!=='https:')throw Error('HTTPS_SOURCE_REQUIRED');
 const db=await mysql.createConnection({host:config.HOSXP_DB_HOST,port:Number(config.HOSXP_DB_PORT||3306),user:config.HOSXP_DB_USER,password:config.HOSXP_DB_PASSWORD,database:config.HOSXP_DB_NAME,dateStrings:true,connectTimeout:8000});
 try{
  const [[lock]]=await db.execute("SELECT GET_LOCK('survey-fit-auto',0) acquired");
  if(Number(lock.acquired)!==1)return {skipped:'CYCLE_ALREADY_RUNNING'};
  const source=createClient(config.SUPABASE_URL,config.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  async function read(q){const {data,error}=await q;if(error)throw Error('AUTO_SOURCE_READ_FAILED');return data;}
  const batches=await read(source.from('hosxp_review_batches').select('captured_at').not('completed_at','is',null).order('captured_at',{ascending:false}).limit(1));
  if(!batches[0]||Date.now()-Date.parse(batches[0].captured_at)>3600000)await refresh(config);
  const stateFile=optionsFile+'.state.json';
  const state=fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile,'utf8')):{};
  const save=async value=>{fs.writeFileSync(stateFile+'.tmp',JSON.stringify(value,null,2));fs.renameSync(stateFile+'.tmp',stateFile);};
  const done=new Set(),jobs=[];let after=null;
  // Keyset pagination prevents old completed jobs from starving newer work.
  for(let page=0;page<100;page++){
   let q=source.from('hosxp_fit_preparations').select('id,prepared_at').eq('state','awaiting_lan_validation').order('id').limit(100);
   if(opt.scope==='new_only')q=q.gte('prepared_at',opt.startAt);
   if(after)q=q.gt('id',after);
   const batch=await read(q);if(!batch.length)break;
   const outcomes=await read(source.from('hosxp_fit_import_results').select('preparation_id').in('preparation_id',batch.map(j=>j.id)));
   outcomes.forEach(r=>done.add(r.preparation_id));jobs.push(...batch.filter(j=>due(j,done,state,Date.now())));
   if(jobs.length>=opt.limit||batch.length<100)break;after=batch.at(-1).id;
  }
  const report=await processJobs({jobs,done,state,limit:opt.limit,now:Date.now(),save,importJob:async id=>{
   // A lost worker lock aborts before another patient's import.
   await db.query('SELECT 1');
   return main({...config,HOSXP_IMPORT_ENABLED:'true'},['--job='+id,'--write','--confirm-fit-write']);
  }});
  // Previously imported visits may acquire Authen/finance references later in HOSxP.
  // Refresh evidence without modifying clinical or financial records.
  try{Object.assign(report,await require('./hosxp-fit-finance-status.cjs').reconcile({source,db}));}
  catch{report.finance_status_error=true;}
  try{Object.assign(report,await require('./hosxp-authen-report.cjs').reconcile({source,db}));}
  catch{report.authen_report_error=true;}
  try{Object.assign(report,await require('./hosxp-authen-write.cjs').reconcile({source,db}));}
  catch{report.authen_write_error=true;}
  return report;
 }finally{await db.end();}
}
if(require.main===module){
 const {readConfig}=require('./refresh-hosxp-review.cjs');
 const file=process.argv.find(x=>x.startsWith('--options='))?.slice(10);
 if(!file){console.error('AUTO_OPTIONS_REQUIRED');process.exitCode=1;}
 else run(readConfig(path.resolve(__dirname,'../.env.sync')),path.resolve(file)).then(r=>console.log(JSON.stringify({at:new Date().toISOString(),...r}))).catch(e=>{console.error(/^[A-Z][A-Z0-9_]+$/.test(e.message)?e.message:'AUTO_CYCLE_FAILED');process.exitCode=1;});
}
module.exports={settings,due,failure,processJobs,run};
