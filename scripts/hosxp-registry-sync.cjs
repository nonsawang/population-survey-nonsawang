// Explicit opt-in, names only, on previously verified identity links.
const {verify}=require('./person-identity.cjs');
async function sync({source,db,apply=false}){
 let after='',checked=0,updated=0,blocked=0;
 for(;;){
  const q=await source.from('person_identity_links').select('person_id,cid,hn,hosxp_person_id').gt('person_id',after).order('person_id').limit(100);
  if(q.error)throw Error('REGISTRY_LINKS_UNAVAILABLE');if(!q.data.length)break;
  const rows=[];
  for(const link of q.data){
   const [persons]=await db.execute('SELECT person_id,cid,patient_hn,birthdate,fname,lname FROM person WHERE cid=? LIMIT 2',[link.cid]);
   const [patients]=await db.execute('SELECT hn,cid,birthday FROM patient WHERE cid=? LIMIT 2',[link.cid]);
   try{const target={cid:link.cid,birth_date:persons[0]?.birthdate};const v=verify(target,persons,patients);if(v.hn!==link.hn||v.hosxp_person_id!==link.hosxp_person_id)throw Error('IDENTITY_CHANGED');rows.push({...v,person_id:link.person_id,birth_date:target.birth_date,fname:persons[0].fname,lname:persons[0].lname});}catch{blocked++;}
   checked++;
  }
  if(apply&&rows.length){const r=await source.rpc('hosxp_registry_apply',{p_rows:rows});if(r.error)throw Error('REGISTRY_APPLY_FAILED');updated+=r.data.updated;blocked+=r.data.blocked;}
  after=q.data.at(-1).person_id;if(q.data.length<100)break;
 }
 return {checked,updated,blocked,mode:apply?'apply':'dry-run'};
}
if(require.main===module){(async()=>{
 const config=require('./refresh-hosxp-review.cjs').readConfig(require('node:path').resolve(__dirname,'../.env.sync'));
 require('./lan-service-key.cjs').requireServiceKey(config.SUPABASE_SERVICE_ROLE_KEY);
 if(new URL(config.SUPABASE_URL).protocol!=='https:')throw Error('HTTPS_REQUIRED');
 const source=require('@supabase/supabase-js').createClient(config.SUPABASE_URL,config.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const db=await require('mysql2/promise').createConnection({host:config.HOSXP_DB_HOST,port:Number(config.HOSXP_DB_PORT||3306),user:config.HOSXP_DB_USER,password:config.HOSXP_DB_PASSWORD,database:config.HOSXP_DB_NAME,dateStrings:true,connectTimeout:10000,charset:'utf8mb4'});
 try{await db.query('START TRANSACTION READ ONLY');console.log(JSON.stringify(await sync({source,db,apply:process.argv.includes('--apply')})));}finally{await db.rollback();await db.end();}
})().catch(()=>{console.error('REGISTRY_SYNC_FAILED');process.exitCode=1});}
module.exports={sync};
