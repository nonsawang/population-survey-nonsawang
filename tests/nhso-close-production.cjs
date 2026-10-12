const assert=require('node:assert/strict');
const {sendProduction}=require('../scripts/nhso-close-production.cjs');
function cid(s){let n=0;for(let i=0;i<12;i++)n+=Number(s[i])*(13-i);return s+(11-n%11)%10}
const input={zone:'production',intentId:'fixture',token:'fixture',hcode:'05080',personalId:cid('123456789012'),recorderPid:cid('987654321098'),department:{code:'01',name:'fixture'},mainInsclCode:'UCS',claimServiceCode:'PG0060001',sourceId:'fixture',visitNumber:'fixture',serviceDateTime:Date.now()-1000,invoiceDateTime:Date.now()-1000,totalAmount:60,paidAmount:0,privilegeAmount:60};
(async()=>{
 let sent=0,saved,recorded,acquired=false,failAck=true;
 const ledger={async reserveManualIntent(){if(acquired)return {acquired:false};acquired=true;return {acquired:true,id:'fixture',transactionId:'suffix'}},async record(r){if(failAck)throw Error();recorded=r}};
 const options={enabled:true,ledger,receipts:{async save(r){saved=r}},fetchImpl:async(url,req)=>{sent++;assert.equal(url,'https://nhsoapi.nhso.go.th/nhsoendpoint/api/nhso-claim-detail');assert.equal(JSON.parse(req.body).transactionId,'05080suffix');return {ok:true,headers:{get:()=> 'application/json'},json:async()=>({seq:12345678,authenCode:'fixture-auth'})}}};
 await assert.rejects(sendProduction(input),/DISABLED/);
 assert.equal((await sendProduction(input,options)).status,'ack_pending');assert.equal(saved.simulated,false);assert.equal(saved.state,'confirmed');
 assert.equal((await sendProduction(input,options)).status,'already_reserved');assert.equal(sent,1);
 failAck=false;await ledger.record(saved);assert.equal(recorded.code,'fixture-auth');assert.equal(sent,1);
 await assert.rejects(sendProduction({...input,serviceDateTime:Date.now()-86400000},options),/SAME_DAY/);
 acquired=false;options.fetchImpl=async()=>{sent++;throw Error('timeout')};
 assert.equal((await sendProduction(input,options)).status,'outcome_unknown');assert.equal(saved.state,'outcome_unknown');
 assert.equal((await sendProduction(input,options)).status,'already_reserved');assert.equal(sent,2);
 console.log('PASS: production URL construction using mocked HTTP; same-day guard, durable receipt, acknowledgement recovery, no retransmit');
})().catch(e=>{console.error(e);process.exitCode=1});
