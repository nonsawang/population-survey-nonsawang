const path=require('node:path'),mysql=require('mysql2/promise'),{createClient}=require('@supabase/supabase-js');
const {readConfig}=require('./refresh-hosxp-review.cjs'),{writeGps,hash}=require('./house-gps-writer.cjs');
const {randomUUID}=require('node:crypto');
async function run(){
 const c=readConfig(path.resolve(__dirname,'../.env.sync')),mode=process.argv[2],id=process.argv[3];
 if(!['snapshot','send','recover'].includes(mode))throw Error('USE_snapshot_send_recover');
 if(mode!=='snapshot'&&c.HOSXP_HOUSE_GPS_WRITE_ENABLED!=='true')throw Error('GPS_WRITE_DISABLED');
 const db=await mysql.createConnection({host:c.HOSXP_DB_HOST,port:Number(c.HOSXP_DB_PORT||3306),database:c.HOSXP_DB_NAME,user:c.HOSXP_DB_USER,password:c.HOSXP_DB_PASSWORD,dateStrings:true});
 const client=createClient(c.SUPABASE_URL,c.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
 const checked=async p=>{const r=await p;if(r.error)throw Error('QUEUE_REQUEST_FAILED');return r.data;};
 try{
 if(mode==='snapshot'){
 await db.query('START TRANSACTION READ ONLY');
 const [rows]=await db.query('SELECT h.house_id,h.village_id,TRIM(h.address) address,h.latitude,h.longitude,TRIM(v.village_moo) moo FROM house h JOIN village v ON v.village_id=h.village_id');await db.commit();
 if(!rows.length)throw Error('EMPTY_SNAPSHOT');const batch=randomUUID();
 await checked(client.from('house_gps_batches').insert({id:batch}));
 for(let i=0;i<rows.length;i+=500)await checked(client.from('house_gps_snapshot').insert(rows.slice(i,i+500).map(r=>({...r,house_id:String(r.house_id),village_id:String(r.village_id),batch_id:batch}))));
 const count=await client.from('house_gps_snapshot').select('house_id',{head:true,count:'exact'}).eq('batch_id',batch);
 if(count.error||count.count!==rows.length)throw Error('SNAPSHOT_INCOMPLETE');
 await checked(client.from('house_gps_batches').update({completed_at:new Date().toISOString()}).eq('id',batch));
 await client.from('house_gps_snapshot').delete().neq('batch_id',batch);
 await client.from('house_gps_batches').delete().neq('id',batch);
 console.log('SNAPSHOT_READY '+rows.length);return;
 }
 if(!/^[0-9a-f-]{36}$/i.test(id||''))throw Error('JOB_ID_REQUIRED');
 if(mode==='recover'){
 const q=await checked(client.from('house_gps_queue').select('*').eq('id',id).single());
 const [r]=await db.execute('SELECT payload_hash FROM survey_house_gps_receipts WHERE id=?',[id]);
 if(r.length!==1||r[0].payload_hash!==hash(q))throw Error('RECONCILIATION_REQUIRED');
 }else{
 const q=await checked(client.rpc('house_gps_claim',{p_id:id}));
 try{await writeGps(db,q);}catch(e){
 if(['HOUSE_CHANGED','GPS_CHANGED'].includes(e.message))await checked(client.rpc('house_gps_finish',{p_id:id,p_state:'conflict'}));
 throw e;
 }
 }
 await checked(client.rpc('house_gps_finish',{p_id:id,p_state:'sent'}));console.log('GPS_SENT');
 }finally{await db.end();}
}
if(require.main===module)run().catch(()=>{console.error('GPS_JOB_STOPPED: check queue and receipt; do not blindly resend');process.exitCode=1});
