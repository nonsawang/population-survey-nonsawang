// LAN validation only. No INSERT/UPDATE/DELETE against either database.
const path=require('node:path');
const {createClient}=require('@supabase/supabase-js');
const mysql=require('mysql2/promise');
const {readConfig}=require('./refresh-hosxp-review.cjs');
const {inspect,mapping}=require('./hosxp-fit-preflight.cjs');
const {requireServiceKey}=require('./lan-service-key.cjs');
function validCid(value){
 if(!/^[0-9]{13}$/.test(value||''))return false;
 let sum=0;for(let i=0;i<12;i++)sum+=Number(value[i])*(13-i);
 return (11-sum%11)%10===Number(value[12]);
}
function validateSource(job,history,person,approved,today){
 if(!history||!person||!approved)return 'SOURCE_MISSING';
 const p=job.payload;
 if(job.state!=='awaiting_lan_validation'||history.kpi!=='FOBT'||history.person_id!==job.person_id||person.person_id!==job.person_id||history.id!==job.history_id)return 'SOURCE_MISMATCH';
 if(!history.screen_date||history.screen_date>today||!['ปกติ','ผิดปกติ'].includes(history.result))return 'INVALID_EVENT';
 if(history.result!==person.fobt_screen||history.screen_date!==person.fobt_date)return 'SOURCE_CHANGED';
 const result=history.result==='ปกติ'?'Negative':'Positive';
 if(!p||p.history_id!==history.id||p.person_id!==job.person_id||p.screen_date!==history.screen_date||job.screen_date!==history.screen_date||p.source_result!==history.result||p.lab_result!==result)return 'PAYLOAD_CHANGED';
 if(p.mapping_version!=='fit-20260914'||p.lab_code!==mapping.lab||p.fee_code!==mapping.fee||p.department_code!==mapping.department||p.specialty_code!==mapping.specialty||p.doctor_code!==mapping.doctor||p.diagnosis!==mapping.diagnosis||p.pttype!=='PP'||p.visit_time_policy!=='import_time'||p.visit_policy!=='new_visit_per_screening_type')return 'MAPPING_CHANGED';
 if(!validCid(person.cid))return 'INVALID_CID';
 return null;
}
function snapshotStatus(batch,targets,now=Date.now()){
 const captured=Date.parse(batch?.captured_at);
 if(!batch?.completed_at||!Number.isFinite(captured)||captured>now+60000||now-captured>86400000)return 'SNAPSHOT_STALE';
 if(targets.length!==1)return targets.length?'SNAPSHOT_DUPLICATE_CID':'SNAPSHOT_PERSON_NOT_FOUND';
 return null;
}
const normalized=v=>String(v||'').trim().replace(/\s+/g,' ');
async function targetCheck(db,person,date,snapshot){
 if(!snapshot)return 'SNAPSHOT_PERSON_NOT_FOUND';
 const cid=person.cid;
 const [persons]=await db.execute('SELECT person_id,patient_hn,death,person_discharge_id,fname,lname,birthdate FROM person WHERE cid=? LIMIT 2',[cid]);
 if(persons.length!==1)return persons.length?'DUPLICATE_PERSON_CID':'PERSON_NOT_FOUND';
 const [patients]=await db.execute('SELECT hn,death,fname,lname,birthday FROM patient WHERE cid=? LIMIT 2',[cid]);
 if(patients.length!==1)return patients.length?'DUPLICATE_PATIENT_CID':'PATIENT_NOT_FOUND';
 const target=persons[0],patient=patients[0];
 if(target.death==='Y'||patient.death==='Y'||Number(target.person_discharge_id)===1)return 'DECEASED_REQUIRES_REVIEW';
 // Web IDs and HOSxP IDs belong to different namespaces. Match by verified
 // unique CID, then compare the cached target ID with the live target ID.
 if(snapshot.cid!==cid||String(target.person_id)!==String(snapshot.hosxp_person_id))return 'TARGET_CHANGED_SINCE_SYNC';
 if(!person.fname||!person.lname||!person.birth_date||
 normalized(target.fname)!==normalized(person.fname)||normalized(target.lname)!==normalized(person.lname)||
 normalized(patient.fname)!==normalized(person.fname)||normalized(patient.lname)!==normalized(person.lname)||
 target.birthdate!==person.birth_date||patient.birthday!==person.birth_date)return 'IDENTITY_REQUIRES_REVIEW';
 if(!target.patient_hn||String(target.patient_hn)!==String(patient.hn))return 'HN_LINK_CONFLICT';
 const [labs]=await db.execute('SELECT 1 FROM lab_head h JOIN lab_order o ON o.lab_order_number=h.lab_order_number WHERE h.hn=? AND h.order_date=? AND o.lab_items_code=? LIMIT 1',[patient.hn,date,mapping.lab]);
 if(labs.length)return 'EXISTING_FIT_REQUIRES_REVIEW';
 const [fees]=await db.execute('SELECT 1 FROM opitemrece WHERE hn=? AND vstdate=? AND icode=? LIMIT 1',[patient.hn,date,mapping.fee]);
 if(fees.length)return 'EXISTING_FIT_FEE_REQUIRES_REVIEW';
 return 'VALIDATED_NOT_IMPORTED';
}
async function row(client,table,field,value,columns){
 const {data,error}=await client.from(table).select(columns).eq(field,value).maybeSingle();
 if(error)throw new Error('SOURCE_READ_FAILED');return data;
}
async function run(config){
 requireServiceKey(config.SUPABASE_SERVICE_ROLE_KEY);
 if(!config.SUPABASE_URL||new URL(config.SUPABASE_URL).protocol!=='https:'||!config.SUPABASE_SERVICE_ROLE_KEY)throw new Error('CONFIG_REQUIRED');
 const preflight=await inspect(config);
 if(!preflight.catalogVerified)throw new Error('CATALOG_CHANGED');
 const source=createClient(config.SUPABASE_URL,config.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:batches,error:batchError}=await source.from('hosxp_review_batches').select('id,captured_at,completed_at').not('completed_at','is',null).order('captured_at',{ascending:false}).order('id',{ascending:false}).limit(1);
 if(batchError)throw new Error('SOURCE_READ_FAILED');
 const batch=batches[0];
 const db=await mysql.createConnection({host:config.HOSXP_DB_HOST,port:Number(config.HOSXP_DB_PORT||3306),user:config.HOSXP_DB_USER,password:config.HOSXP_DB_PASSWORD,database:config.HOSXP_DB_NAME,dateStrings:true,connectTimeout:8000});
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const report={mode:'read_only',import_enabled:false,checked_at:new Date().toISOString(),counts:{},jobs:[]};
 try{
  let after=null;
  while(true){
   let query=source.from('hosxp_fit_preparations').select('id,history_id,person_id,screen_date,payload,state').eq('state','awaiting_lan_validation').order('id').limit(100);
   if(after)query=query.gt('id',after);
   const {data:jobs,error}=await query;if(error)throw new Error('QUEUE_READ_FAILED');
   for(const job of jobs){
    const h=await row(source,'screening_history','id',job.history_id,'id,person_id,kpi,result,screen_date,recorded_at');
    const fields='person_id,cid,fname,lname,birth_date,fobt_screen,fobt_date';
    const person=await row(source,'population','person_id',job.person_id,fields);
    const approval=await row(source,'screening_review','history_id',job.history_id,'history_id');
    let status=validateSource(job,h,person,approval,today);
    if(!status){
     const {data:newer,error:newerError}=await source.from('screening_history').select('id').eq('person_id',job.person_id).eq('kpi','FOBT').gt('recorded_at',h.recorded_at).limit(1);
     if(newerError)throw new Error('SOURCE_READ_FAILED');
     if(newer.length)status='SOURCE_CHANGED';
    }
    if(!status){
     const {data:duplicates,error:duplicateError}=await source.from('population').select('person_id').eq('cid',person.cid).limit(2);
     if(duplicateError)throw new Error('SOURCE_READ_FAILED');
     if(duplicates.length!==1)status='DUPLICATE_SOURCE_CID';
    }
    let snapshot;
    if(!status){
     if(!batch)status='SNAPSHOT_STALE';
     else{
      const {data:targets,error:targetError}=await source.from('hosxp_review_snapshot').select('cid,hosxp_person_id').eq('batch_id',batch.id).eq('cid',person.cid).limit(2);
      if(targetError)throw new Error('SOURCE_READ_FAILED');
      status=snapshotStatus(batch,targets);snapshot=targets[0];
     }
    }
    if(!status){
     await db.query('START TRANSACTION READ ONLY');
     try{status=await targetCheck(db,person,job.screen_date,snapshot);}finally{await db.rollback();}
     const current=await row(source,'population','person_id',job.person_id,fields);
     if(!current||JSON.stringify(current)!==JSON.stringify(person))status='SOURCE_CHANGED';
    }
    report.jobs.push({preparation_id:job.id,status});report.counts[status]=(report.counts[status]||0)+1;
   }
   if(jobs.length<100)break;after=jobs[jobs.length-1].id;
  }
 }finally{await db.end();}
 return report;
}
if(require.main===module)run(readConfig(path.resolve(__dirname,'../.env.sync'))).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{
 const safe=['SUPABASE_SERVICE_KEY_REQUIRED','CONFIG_REQUIRED','CATALOG_CHANGED','SOURCE_READ_FAILED','QUEUE_READ_FAILED'].includes(e.message)?e.message:'LAN_VALIDATION_FAILED';
 console.error(safe);process.exitCode=1;
});
module.exports={validCid,validateSource,targetCheck,snapshotStatus,run};
