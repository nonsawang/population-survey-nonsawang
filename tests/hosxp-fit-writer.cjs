const assert=require('node:assert/strict');
const {writeVisit,payloadHash,stamp,vnFor,claimChecks}=require('../scripts/hosxp-fit-writer.cjs');
const {acknowledge}=require('../scripts/hosxp-fit-import.cjs');
const job={id:'11111111-1111-4111-8111-111111111111',history_id:'22222222-2222-4222-8222-222222222222',person_id:'web-test',screen_date:'2026-09-10',payload:{lab_result:'Negative'}};
const person={cid:'synthetic-test',fname:'ทดสอบ',lname:'ระบบ',birth_date:'1960-01-01'};
function fake({failTable,mismatch=false,collision=false}={}){
 let saved={},current={},commits=0,rollbacks=0,inserts=0;
 return {get state(){return saved;},get commits(){return commits;},get rollbacks(){return rollbacks;},get inserts(){return inserts;},
 async beginTransaction(){current=structuredClone(saved);},async commit(){saved=structuredClone(current);commits++;},async rollback(){current=structuredClone(saved);rollbacks++;},
 async execute(sql,args=[]){
  if(sql.startsWith('SELECT GET_LOCK'))return [[{ok:1}]];
  if(sql.startsWith('SELECT RELEASE_LOCK'))return [[{ok:1}]];
  if(sql.startsWith('SELECT * FROM survey_fit_import_ledger'))return [current.survey_fit_import_ledger||[]];
  if(sql.startsWith('INSERT INTO')){
   const table=sql.match(/`([^`]+)`/)[1];if(table===failTable)throw new Error('INJECTED_FAILURE');
   const keys=[...sql.slice(sql.indexOf('('),sql.indexOf(')')).matchAll(/`([^`]+)`/g)].map(m=>m[1]);
   (current[table]??=[]).push(Object.fromEntries(keys.map((k,i)=>[k,args[i]])));inserts++;return [{affectedRows:1}];
  }
  if(sql.startsWith('SELECT o.hn')){
   const ledger=(current.survey_fit_import_ledger||saved.survey_fit_import_ledger)[0];
   return [[{hn:ledger.hn,vstdate:ledger.screen_date,order_date:ledger.screen_date,pttype:'PP',doctor:'0029',spclty:'15',main_dep:'048',lab_order_result:mismatch?'Positive':ledger.lab_result,dx:1,fee:1,screen:1,stat:1,seq:1}]];
  }
  if(sql.startsWith('SELECT person_id,patient_hn'))return [[{person_id:10,patient_hn:'TEST001',death:'N',person_discharge_id:9,fname:person.fname,lname:person.lname,birthdate:person.birth_date}]];
  if(sql.startsWith('SELECT hn,death'))return [[{hn:'TEST001',death:'N',fname:person.fname,lname:person.lname,birthday:person.birth_date}]];
  if(sql.startsWith('SELECT 1 FROM lab_head')||sql.startsWith('SELECT 1 FROM opitemrece'))return [[]];
  if(sql.endsWith('FOR UPDATE')&&(sql.startsWith('SELECT hn FROM patient')||sql.startsWith('SELECT person_id FROM person')))return [[]];
  if(sql.startsWith('SELECT hn,sex'))return [[{hn:'TEST001',sex:'1',birthday:person.birth_date,cid:person.cid}]];
  if(sql.startsWith('SELECT lab_items_name'))return [[{lab_items_name:'fit test',lab_items_group:3,active_status:'Y',icode:'3905544',possible_value:'Negative\r\nPositive'}]];
  if(sql.startsWith('SELECT name,price'))return [[{price:60,income:'18',istatus:'Y',paidst:'02',unitcost:0}]];
  if(sql.startsWith('SELECT paidst,pcode'))return [[{paidst:'02',pcode:'UC',isuse:'Y'}]];
  if(sql.startsWith('SELECT count(*) n FROM ovst'))return [[{n:collision?1:0}]];
  if(sql.startsWith('SELECT serial_no'))return [[{serial_no:100}]];
  if(sql.startsWith('UPDATE serial'))return [{affectedRows:1}];
  if(sql.startsWith('SELECT TIMESTAMPDIFF'))return [[{y:66,m:8,d:9}]];
  if(sql.startsWith('SELECT billcode'))return [[{billcode:null,nhso_adp_type_id:4,nhso_adp_code:'90005'}]];
  if(sql.startsWith('SELECT 1 FROM visit_pttype'))return [[]];
  throw new Error('UNHANDLED_SQL '+sql);
 }};
}
const context={job,person,snapshot:{cid:person.cid,hosxp_person_id:10},revalidate:async()=>{},now:()=>new Date('2026-09-17T04:22:33Z')};
(async()=>{
 assert.deepEqual(stamp(context.now()),{date:'2026-09-17',time:'11:22:33'});
 assert.equal(vnFor(job.screen_date,'11:22:33'),'690910112233');
 const db=fake();const first=await writeVisit(db,context);
 assert.equal(first.vn,'690910112233');assert.equal(db.commits,1);
 assert.equal(db.state.ovst.length,1);assert.equal(db.state.lab_order[0].lab_order_result,'Negative');
 assert.equal(db.state.ovst[0].pttype,'PP');assert.equal(db.state.ovst[0].vstdate,'2026-09-10');
 assert.equal(db.state.opitemrece.length,1);assert.equal(db.state.opitemrece[0].icode,'3905544');
 assert(!Object.hasOwn(db.state.opdscreen[0],'bps'));assert.equal(db.state.lab_head[0].confirm_report,'N');
 const count=db.inserts;const replay=await writeVisit(db,{...context,revalidate:async()=>{throw new Error('must not re-import');}});
 assert.equal(replay.vn,first.vn);assert(replay.replayed);assert.equal(db.inserts,count);
 await assert.rejects(()=>writeVisit(db,{...context,job:{...job,payload:{lab_result:'Positive'}}}),/REPLAY_PAYLOAD_CHANGED/);
 for(const opts of [{failTable:'lab_order'},{mismatch:true},{collision:true}]){
  const broken=fake(opts);await assert.rejects(()=>writeVisit(broken,context));assert.equal(broken.commits,0);assert.deepEqual(broken.state,{});assert.equal(broken.rollbacks,1);
 }
 let calls=0;const stale=fake();await assert.rejects(()=>writeVisit(stale,{...context,revalidate:async()=>{if(++calls===2)throw new Error('SOURCE_CHANGED');}}),/SOURCE_CHANGED/);assert.deepEqual(stale.state,{});
 const checks=await claimChecks(db,first.vn);assert.deepEqual(checks,{mapping:false,auth:false,invoice:false,export_verified:false});
 const badSource={from:()=>({upsert:async()=>({error:{message:'network down'}})})};
 await assert.rejects(()=>acknowledge(badSource,db,first),/COMMITTED_ACK_PENDING/);
 let received;const source={from:()=>({upsert:async(value)=>{received=value;return {error:null};}})};
 const outcome=await acknowledge(source,db,replay);assert.equal(outcome.vn,first.vn);assert.equal(received.claim_status,'not_ready');assert.equal(received.payload_hash,payloadHash(job));
 assert.equal(db.state.ovst.length,1);
 console.log('PASS: atomic visit/lab/fee, rollback, VN collision, stale source, replay, failed acknowledgement recovery, separate claim readiness');
})().catch(e=>{console.error(e);process.exitCode=1;});
