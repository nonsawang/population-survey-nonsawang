const assert=require('node:assert/strict');
const {requestFor,submitClose,SCHEMA_CONFIRMED}=require('../scripts/nhso-close-rights.cjs');
function cid(seed){let sum=0;for(let i=0;i<12;i++)sum+=Number(seed[i])*(13-i);return seed+(11-sum%11)%10;}
const input={zone:'test',token:'mock-only',personalId:cid('123456789012'),recorderPid:cid('987654321098'),hcode:'05080',department:{code:'001',name:'OPD'},mainInsclCode:'UCS',transactionId:'mock-1',claimServiceCode:'unverified',sourceId:'mock-source',visitNumber:'mock-visit',serviceDateTime:Date.UTC(2026,9,7),invoiceDateTime:Date.UTC(2026,9,7),totalAmount:300,paidAmount:0,privilegeAmount:300};
(async()=>{
 assert.equal(SCHEMA_CONFIRMED,false);
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
 const timeout=await submitClose(input,{mode:'mock',timeoutMs:5,fetchImpl:(_,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('aborted'))))});
 assert.equal(timeout.reason,'TIMEOUT');
 console.log('PASS: mock-only transport, validation, ambiguous outcomes, no automatic retry');
})().catch(e=>{console.error(e);process.exitCode=1;});
