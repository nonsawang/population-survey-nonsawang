// Explicit single-job LAN command. Production remains disabled in this release.
const path=require('node:path'),mysql=require('mysql2/promise');
const {createClient}=require('@supabase/supabase-js');
const {readConfig}=require('./refresh-hosxp-review.cjs');
const {dispatch,recoverReceipt}=require('./hosxp-review-writer.cjs');
(async()=>{
 const configFile=process.argv[2],id=process.argv[3];
 if(!configFile||!id)throw Error('USAGE: node scripts/send-hosxp-review.cjs test-config-file approval-uuid');
 const c=readConfig(path.resolve(configFile));
 if(c.HOSXP_REVIEW_ZONE!=='test'||c.HOSXP_REVIEW_ENABLE!=='true'||c.HOSXP_DB_HOST!=='127.0.0.1'||!/^person_review_test_\d+$/.test(c.HOSXP_DB_NAME))throw Error('PRODUCTION_DISABLED');
 if(new URL(c.SUPABASE_URL).protocol!=='https:')throw Error('HTTPS_REQUIRED');
 const client=createClient(c.SUPABASE_URL,c.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const db=await mysql.createConnection({host:c.HOSXP_DB_HOST,port:Number(c.HOSXP_DB_PORT),database:c.HOSXP_DB_NAME,user:c.HOSXP_DB_USER,password:c.HOSXP_DB_PASSWORD,dateStrings:true});
 try{
  const fingerprint=process.argv[4];
  const result=fingerprint?await recoverReceipt(db,client,id,fingerprint):await dispatch({db,client,id,enabled:true});
  console.log(JSON.stringify(result));
 }finally{await db.end();}
})().catch(()=>{console.error('REVIEW_SEND_STOPPED: inspect reservation/receipt before retry; no automatic resend');process.exitCode=1;});
