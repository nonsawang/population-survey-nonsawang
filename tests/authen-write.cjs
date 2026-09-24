const assert=require('node:assert/strict');const {write}=require('../scripts/hosxp-authen-write.cjs');
const {matchRows}=require('../lib/authen-report.cjs');
const row={row:2,cid:'1000000000009',hcode:'05080',name:'Test Person',code:'EP123',serviceCode:'PG0060001',serviceDate:'2026-09-21',issues:[],statusUnconfirmed:true,hn:''};
const visit={fitPreparationId:'prep',fitResult:'Negative',fitScreenDate:'2026-09-21',labOrderNumber:1,vn:'690921000001',hn:'0000001',cid:row.cid,name:row.name,service_date:row.serviceDate,authCodes:[]};
const snapshot=matchRows([row],[visit])[0];const job={id:'job',batch_id:'batch',row_number:2,vn:visit.vn,fingerprint:snapshot.fingerprint,approved_by:'staff',approved_at:new Date().toISOString()};
const batch={rows:[row],results:[snapshot],approved_rows:[2]};
function database({old='',many=false,name=row.name,engine='InnoDB',readbackFail=false}={}){
 const state={old,updates:0,commits:0,rollbacks:0,receipts:[]};
 const db={beginTransaction:async()=>{},commit:async()=>{state.commits++;},rollback:async()=>{state.rollbacks++;state.old=old;},
 query:async sql=>{if(sql.includes('information_schema.tables'))return [['ovst','patient','visit_pttype','survey_authen_import_ledger'].map(table_name=>({table_name,engine}))];if(sql.includes('information_schema.columns'))return [[{size:50}]];return [[]];},
 execute:async(sql,args)=>{
  if(sql.includes('GET_LOCK'))return [[{acquired:1}]];if(sql.includes('RELEASE_LOCK'))return [[]];
  if(sql.startsWith('SELECT * FROM survey_authen'))return [state.receipts];
  if(sql.startsWith('SELECT hn FROM patient'))return [[{hn:visit.hn}]];
  if(sql.startsWith('SELECT o.vn'))return [[{...visit,name}]];
  if(sql.startsWith('SELECT auth_code'))return [many?[{auth_code:''},{auth_code:''}]:[{auth_code:readbackFail&&state.updates?'wrong':state.old}]];
  if(sql.startsWith('SELECT vn FROM visit_pttype'))return [[]];
  if(sql.startsWith('UPDATE visit_pttype')){state.updates++;state.old=args[0];return [{affectedRows:1}];}
  if(sql.startsWith('INSERT INTO survey_authen')){state.receipts.push({vn:args[3],fingerprint:args[4],code_hash:args[5],outcome:args[7]});return [{}];}
  throw Error('Unexpected SQL '+sql);
 }};return {db,state};
}
(async()=>{
 let t=database();assert.equal((await write(t.db,job,batch)).state,'written');assert.equal(t.state.updates,1);assert.equal(t.state.commits,1);
 assert.equal((await write(t.db,job,batch)).state,'written');assert.equal(t.state.updates,1);
 t=database({old:row.code});assert.equal((await write(t.db,job,batch)).state,'already_present');assert.equal(t.state.updates,0);
 for(const options of [{old:'OTHER'},{many:true},{engine:'MyISAM'},{readbackFail:true}]){t=database(options);await assert.rejects(()=>write(t.db,job,batch));assert.equal(t.state.commits,0);assert.equal(t.state.old,options.old||'');}
 t=database();await assert.rejects(()=>write(t.db,{...job,approved_at:'2020-01-01'},batch),/EXPIRED/);assert.equal(t.state.updates,0);
 await assert.rejects(()=>write(t.db,job,{...batch,approved_rows:[]}),/APPROVAL_CHANGED/);
 await assert.rejects(()=>write(t.db,job,{...batch,results:[{...snapshot,fitPreparationId:null}]}),/APPROVAL_CHANGED/);
 await assert.rejects(()=>write(t.db,job,{...batch,results:[{...snapshot,fitResult:'Positive'}]}),/VISIT_CHANGED/);
 console.log('PASS: transactional fill-only write, existing-code no-op, replay recovery, conflict/identity/insurance/engine/stale-approval guards and rollback');
})().catch(e=>{console.error(e);process.exitCode=1;});
