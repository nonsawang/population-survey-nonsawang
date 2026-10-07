const {execFileSync,spawnSync}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {sendReserved,retryRecord,testLedger}=require('../scripts/nhso-close-dispatch.cjs');
const {receiptStore}=require('../scripts/nhso-close-receipts.cjs');
const {protectedKey}=require('../scripts/nhso-receipt-key.cjs');
const root=process.env.LEDGER_TEST_ROOT,psql=process.env.LEDGER_TEST_PSQL;
if(!root||!psql||process.env.PGHOST!=='127.0.0.1'||process.env.PGPORT!=='55439')throw Error('ISOLATED_TEST_REQUIRED');
const literal=v=>v===null?'NULL':"'"+String(v).replaceAll("'","''")+"'";
const sql=q=>execFileSync(psql,['-X','-qAt','-v','ON_ERROR_STOP=1','-c',q],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();
const client={rpc:async(name,args)=>{try{return {data:JSON.parse(sql('SET ROLE service_role; SELECT public.'+name+'('+Object.values(args).map(literal).join(',')+');'))};}catch{return {error:true};}}};
const ledger=testLedger(client,{isolatedTestDatabase:true});
function cid(s){let n=0;for(let i=0;i<12;i++)n+=Number(s[i])*(13-i);return s+(11-n%11)%10;}
const input={zone:'test',token:'mock',personalId:cid('123456789012'),recorderPid:cid('987654321098'),hcode:'05080',department:{code:'01',name:'test'},mainInsclCode:'UCS',claimServiceCode:'fixture',sourceId:'fixture',visitNumber:process.argv[3]||'ack-failure',serviceDateTime:Date.UTC(2026,9,7),invoiceDateTime:Date.UTC(2026,9,7),totalAmount:1,paidAmount:0,privilegeAmount:1};
const keyPath=path.join(root,'receipt-key.dpapi');
const fetchImpl=async()=>{fs.appendFileSync(path.join(root,'calls.txt'),'called\n');return new Response(JSON.stringify({seq:1,authenCode:'SIMULATED'}),{headers:{'content-type':'application/json'}});};
(async()=>{
 if(process.argv[2]==='crash'){
  await sendReserved(input,{ledger,fetchImpl,mode:'mock',receipts:{save:()=>process.exit(77)}});throw Error('CRASH_NOT_REACHED');
 }
 protectedKey(keyPath,{create:true});
 assert.throws(()=>protectedKey(keyPath,{create:true}),/ACCESS_FAILED/);
 let key=protectedKey(keyPath),store=receiptStore(path.join(root,'receipts'),key);
 const result=await sendReserved(input,{mode:'mock',fetchImpl,receipts:store,ledger:{reserve:ledger.reserve,record:async()=>{throw Error('simulated database outage');}}});
 assert.equal(result.status,'ack_pending');
 key.fill(0);key=protectedKey(keyPath);store=receiptStore(path.join(root,'receipts'),key);
 const receipt=store.load(result.receipt.id);
 assert.equal((await retryRecord(receipt,{ledger})).status,'recorded');
 assert.equal(sql('SELECT state FROM nhso_close_submissions WHERE id='+literal(receipt.id)),'confirmed');
 assert.equal((await sendReserved(input,{ledger,fetchImpl,mode:'mock',receipts:store})).status,'already_reserved');
 console.log('PASS: DPAPI reload + encrypted receipt + PostgreSQL acknowledgement recovery');
 const child=spawnSync(process.execPath,[__filename,'crash','crash-before-save'],{env:process.env,windowsHide:true,encoding:'utf8'});assert.equal(child.status,77,child.stderr);
 assert.equal(sql("SELECT state FROM nhso_close_submissions WHERE visit_number='crash-before-save'"),'reserved');
 assert.equal((await sendReserved({...input,visitNumber:'crash-before-save'},{ledger,fetchImpl,mode:'mock',receipts:store})).status,'already_reserved');
 assert.equal(fs.readFileSync(path.join(root,'calls.txt'),'utf8').trim().split('\n').length,2);
 key.fill(0);
 console.log('PASS: terminated sender before receipt save stays reserved; restart does not send again; reconciliation required');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
