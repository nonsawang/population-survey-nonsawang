// One bounded pass. Atomic database claim prevents duplicate writes across workers.
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {createClient}=require('@supabase/supabase-js');
const {readConfig}=require('./refresh-hosxp-review.cjs');
async function run(){
 const c=readConfig(path.resolve(__dirname,'../.env.sync'));
 if(c.HOSXP_HOUSE_GPS_WRITE_ENABLED!=='true')throw Error('GPS_WRITE_DISABLED');
 const client=createClient(c.SUPABASE_URL,c.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
 const {data,error}=await client.from('house_gps_queue').select('id').eq('state','pending').not('approved_at','is',null).not('approved_by','is',null).order('approved_at').limit(10);
 if(error)throw Error('APPROVED_QUEUE_READ_FAILED');
 for(const q of data){
  const result=spawnSync(process.execPath,[path.join(__dirname,'house-gps-lan.cjs'),'send',q.id],{stdio:'inherit',windowsHide:true,timeout:60000});
  if(result.status!==0){console.error('GPS_AUTO_STOPPED_CHECK_QUEUE');process.exitCode=1;break;}
 }
 console.log('GPS_AUTO_PASS_COMPLETE');
}
run().catch(()=>{console.error('GPS_AUTO_FAILED');process.exitCode=1;});
