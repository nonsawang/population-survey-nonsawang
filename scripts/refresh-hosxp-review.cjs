// Run on a trusted LAN computer. This script only SELECTs from HOSxP.
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const mysql = require('mysql2/promise');
const { createClient } = require('@supabase/supabase-js');
const {requireServiceKey}=require('./lan-service-key.cjs');

function readConfig(file) {
  const config = { ...process.env };
  if (fs.existsSync(file)) for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || config[match[1]] !== undefined) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1,-1);
    config[match[1]] = value;
  }
  return config;
}
async function refresh(config) {
  requireServiceKey(config.SUPABASE_SERVICE_ROLE_KEY);
  for (const name of ['HOSXP_DB_HOST','HOSXP_DB_USER','HOSXP_DB_NAME','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY']) {
    if (!config[name]) throw new Error(`Missing ${name} in .env.sync`);
  }
  if (new URL(config.SUPABASE_URL).protocol !== 'https:') throw new Error('SUPABASE_URL must use HTTPS');
  const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession:false, autoRefreshToken:false } });
  const check = await supabase.from('hosxp_review_batches').select('id').limit(1);
  if (check.error) throw new Error('Supabase access failed. Check migration and SUPABASE_SERVICE_ROLE_KEY in .env.sync.');
  const conn = await mysql.createConnection({ host:config.HOSXP_DB_HOST,port:Number(config.HOSXP_DB_PORT || 3306),user:config.HOSXP_DB_USER,password:config.HOSXP_DB_PASSWORD || '',database:config.HOSXP_DB_NAME,dateStrings:true,connectTimeout:15000 });
  const rows = []; let captured;
  try {
    await conn.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await conn.query('START TRANSACTION READ ONLY');
    const [clock] = await conn.query('SELECT UTC_TIMESTAMP() AS captured');
    captured = String(clock[0].captured).replace(' ','T')+'Z';
    let after = -1;
    while (true) {
      const [chunk] = await conn.execute('SELECT person_id,cid,house_regist_type_id,person_discharge_id,last_update FROM person WHERE person_id>? ORDER BY person_id LIMIT 1000',[after]);
      rows.push(...chunk);
      if (chunk.length < 1000) break;
      after = chunk[chunk.length-1].person_id;
    }
    await conn.commit();
  } finally { await conn.end(); }
  if (!rows.length) throw new Error('HOSxP returned no people; the previous snapshot is unchanged.');
  const batch = randomUUID();
  const put = await supabase.from('hosxp_review_batches').insert({id:batch,source_name:config.HOSXP_DB_NAME,captured_at:captured,expected_count:rows.length});
  if (put.error) throw new Error('Could not start snapshot batch.');
  const str = v => v == null ? null : String(v).trim();
  for (let i=0;i<rows.length;i+=500) {
    const chunk=rows.slice(i,i+500).map(row=>({batch_id:batch,hosxp_person_id:String(row.person_id),cid:str(row.cid),residency_type:str(row.house_regist_type_id),discharge_code:str(row.person_discharge_id),source_updated_at:str(row.last_update)}));
    const result=await supabase.from('hosxp_review_snapshot').insert(chunk);
    if (result.error) throw new Error('Snapshot upload interrupted; incomplete batch is hidden. Run again to create a new batch.');
  }
  const counted=await supabase.from('hosxp_review_snapshot').select('hosxp_person_id',{count:'exact',head:true}).eq('batch_id',batch);
  if (counted.error || counted.count!==rows.length) throw new Error('Snapshot count mismatch; incomplete batch is hidden.');
  const finish=await supabase.from('hosxp_review_batches').update({completed_at:new Date().toISOString()}).eq('id',batch).is('completed_at',null);
  if (finish.error) throw new Error('Could not activate complete snapshot.');
  console.log(`HOSxP review snapshot refreshed: ${rows.length} records, captured ${captured}. No HOSxP records changed.`);
}
if (require.main===module) refresh(readConfig(path.resolve(__dirname,'../.env.sync'))).catch(error=>{
  // Do not print driver responses, query contents, credentials or citizen IDs.
  const safe=error.code ? `Connection failed (${error.code}). Check LAN/database settings.` : error.message;
  console.error(safe); process.exitCode=1;
});
module.exports={readConfig,refresh};
