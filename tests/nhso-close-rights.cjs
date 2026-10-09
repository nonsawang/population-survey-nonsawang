const assert=require('node:assert/strict');
const {requestFor,submitClose,SCHEMA_CONFIRMED}=require('../scripts/nhso-close-rights.cjs');
function cid(seed){let sum=0;for(let i=0;i<12;i++)sum+=Number(seed[i])*(13-i);return seed+(11-sum%11)%10;}
const input={zone:'test',token:'mock-only',personalId:cid('123456789012'),recorderPid:cid('987654321098'),hcode:'05080',department:{code:'001',name:'OPD'},mainInsclCode:'UCS',transactionId:'05080mock-1',claimServiceCode:'unverified',sourceId:'mock-source',visitNumber:'mock-visit',serviceDateTime:Date.UTC(2026,9,7),invoiceDateTime:Date.UTC(2026,9,7),totalAmount:300,paidAmount:0,privilegeAmount:300};
(async()=>{
 assert.equal(SCHEMA_CONFIRMED,false);
 const now=Date.UTC(2026,9,8);
 for(const key of ['serviceDateTime','invoiceDateTime']){
  assert.doesNotThrow(()=>requestFor({...input,[key]:now},{now}));
  assert.throws(()=>requestFor({...input,[key]:now+1},{now}),/DATETIME/);
 }
 for(const key of ['totalAmount','paidAmount','privilegeAmount']){
  for(const amount of [0,0.01,1.1,99999999.99])assert.doesNotThrow(()=>requestFor({...input,[key]:amount},{now}));
  for(const amount of [-1,0.001,99999999.999,100000000,NaN,Infinity,'1.00'])assert.throws(()=>requestFor({...input,[key]:amount},{now}),/AMOUNT/);
 }
 for(const transactionId of ['mock-1','99999mock','05080'])assert.throws(()=>requestFor({...input,transactionId},{now}),/TRANSACTION_ID/);
 assert.doesNotThrow(()=>requestFor({...input,transactionId:'05080'+'x'.repeat(250)},{now}));
 assert.equal(requestFor(input).options.headers.Authorization,'Bearer mock-only');
 for(const change of [{sourceId:'x'.repeat(51)},{visitNumber:'x'.repeat(31)},{transactionId:'x'.repeat(256)}])assert.throws(()=>requestFor({...input,...change}));
 assert.equal(requestFor(input).options.redirect,'error');
 assert.equal(JSON.parse(requestFor(input).options.body).sourceId,'mock-source');
 for(const change of [{zone:'production'},{token:'x\ny'},{personalId:'123'},{sourceId:''},{serviceDateTime:1759795200},{totalAmount:Infinity}])assert.throws(()=>requestFor({...input,...change}));
 await assert.rejects(()=>submitClose(input),/LIVE_DISABLED/);
 let calls=0;
 const run=fetchImpl=>submitClose(input,{mode:'mock',fetchImpl:async(...args)=>{calls++;return fetchImpl(...args);}});
 assert.equal((await run(async()=>new Response(JSON.stringify({seq:1,authenCode:'MOCK'}),{headers:{'content-type':'application/json'}}))).status,'simulated_success');
 for(const fetchImpl of [async()=>new Response('',{status:409}),async()=>new Response('',{status:500}),async()=>{throw Error('SECRET');},async()=>new Response('bad',{headers:{'content-type':'application/json'}}),async()=>new Response('{}',{headers:{'content-type':'application/json'}})]){
  const before=calls,result=await run(fetchImpl);assert.equal(calls,before+1);assert.equal(result.status,'outcome_unknown');assert.equal(result.retryAllowed,false);assert.ok(!JSON.stringify(result).includes('SECRET'));
 }
 const remoteError=await run(async()=>new Response(JSON.stringify({seq:1,authenCode:'MOCK',dataError:'rejected'}),{headers:{'content-type':'application/json'}}));
 assert.equal(remoteError.status,'outcome_unknown');assert.equal(remoteError.reason,'REMOTE_DATA_ERROR');
 const timeout=await submitClose(input,{mode:'mock',timeoutMs:5,fetchImpl:(_,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('aborted'))))});
 assert.equal(timeout.reason,'TIMEOUT');
 console.log('PASS: mock-only transport, validation, ambiguous outcomes, no automatic retry');
})().catch(e=>{console.error(e);process.exitCode=1;});


