// Guarded FIT writer. The default mode is a read-only plan.
// Do not enable production writes until the required HOSxP visit workflow has
// been validated with the local HOSxP vendor/backup procedure.
const path=require('node:path');
const mysql=require('mysql2/promise');
const {createClient}=require('@supabase/supabase-js');
const {readConfig}=require('./refresh-hosxp-review.cjs');
const {requireServiceKey}=require('./lan-service-key.cjs');
const {mapping}=require('./hosxp-fit-preflight.cjs');
function writeEnabled(c){return c.HOSXP_IMPORT_ENABLED==='true'&&process.argv.includes('--write')&&process.argv.includes('--confirm-fit-write');}
async function plan(config){
 requireServiceKey(config.SUPABASE_SERVICE_ROLE_KEY);
 const source=createClient(config.SUPABASE_URL,config.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:jobs,error}=await source.from('hosxp_fit_preparations').select('id,history_id,person_id,screen_date,payload,state').eq('state','awaiting_lan_validation').order('id').limit(1);
 if(error)throw new Error('QUEUE_READ_FAILED');
 return {mode:'plan_only',write_enabled:false,job_count:jobs?.length||0,required_before_write:[
  'verify patient/person/HN and current snapshot immediately before transaction',
  'allocate VN and all HOSxP serials using the supported HOSxP registration workflow',
  'insert ovst/vn_stat/ovstdiag/lab_head/lab_order/opitemrece with local required fields',
  'commit and acknowledge VN idempotently to Supabase',
  'reconcile committed VN when acknowledgement fails'
 ],mapping:{...mapping,pttype:'PP',visit_time:'import_time',date_source:'screen_date'},jobs:jobs||[]};
}
async function main(config){
 if(writeEnabled(config))throw new Error('WRITER_DISABLED_UNTIL_SCHEMA_SIGNOFF');
 return plan(config);
}
if(require.main===module)main(readConfig(path.resolve(__dirname,'../.env.sync'))).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e.message==='WRITER_DISABLED_UNTIL_SCHEMA_SIGNOFF'?e.message:'HOSXP_IMPORT_PLAN_FAILED');process.exitCode=1;});
module.exports={writeEnabled,plan,main};
