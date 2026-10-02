// Link unambiguous existing people; no visits, merges or clinical updates.
const {verify}=require('./person-identity.cjs');
const {cidValid}=require('../lib/authen-report.cjs');
function candidate(web,persons,patients){
 const v=verify(web,persons,patients);
 if(!web.person_id||!/^\d+$/.test(v.hosxp_person_id)||!v.hn)throw Error('IDENTITY_INVALID');
 return {...v,person_id:web.person_id,birth_date:web.birth_date};
}
async function run({source,db,apply=false}){
 const report={checked:0,verified:0,linked:0,existing:0,blocked:0,mode:apply?'apply':'dry-run'};let after='';
 for(;;){const q=await source.from('population').select('person_id,cid,birth_date').gt('person_id',after).order('person_id').limit(100);
 if(q.error)throw Error('REGISTRY_SOURCE_UNAVAILABLE');if(!q.data.length)break;const batch=[];
 for(const web of q.data){report.checked++;if(!cidValid(web.cid)){report.blocked++;continue;}
 if(!apply){const dup=await source.from('population').select('person_id').eq('cid',web.cid).limit(2);if(dup.error)throw Error('REGISTRY_SOURCE_UNAVAILABLE');if(dup.data.length!==1){report.blocked++;continue;}}
 const [persons]=await db.execute('SELECT person_id,cid,patient_hn,birthdate FROM person WHERE cid=? LIMIT 2',[web.cid]);
 const [patients]=await db.execute('SELECT hn,cid,birthday FROM patient WHERE cid=? LIMIT 2',[web.cid]);let row;
 try{row=candidate(web,persons,patients);}catch{report.blocked++;continue;}report.verified++;
 if(apply)batch.push(row);
 }
 if(apply && batch.length){const r=await source.rpc('hosxp_registry_link',{p_rows:batch});if(r.error)throw Error('REGISTRY_LINK_FAILED');report.linked+=r.data.linked;report.existing+=r.data.existing;report.blocked+=r.data.blocked;} if(report.checked%1000===0)console.log(JSON.stringify(report));
 after=q.data.at(-1).person_id;if(q.data.length<100)break;
 }
 return report;
}
if(require.main===module)(async()=>{
 const c=require('./refresh-hosxp-review.cjs').readConfig(require('node:path').resolve(__dirname,'../.env.sync'));
 require('./lan-service-key.cjs').requireServiceKey(c.SUPABASE_SERVICE_ROLE_KEY);
 if(new URL(c.SUPABASE_URL).protocol!=='https:')throw Error('HTTPS_REQUIRED');
 const source=require('@supabase/supabase-js').createClient(c.SUPABASE_URL,c.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const db=await require('mysql2/promise').createConnection({host:c.HOSXP_DB_HOST,port:Number(c.HOSXP_DB_PORT||3306),user:c.HOSXP_DB_USER,password:c.HOSXP_DB_PASSWORD,database:c.HOSXP_DB_NAME,dateStrings:true,connectTimeout:10000});
 try{await db.query('START TRANSACTION READ ONLY');console.log(JSON.stringify(await run({source,db,apply:process.argv.includes('--apply')})));}finally{await db.rollback();await db.end();}
})().catch(()=>{console.error('REGISTRY_LINK_FAILED');process.exitCode=1});
module.exports={candidate,run};
