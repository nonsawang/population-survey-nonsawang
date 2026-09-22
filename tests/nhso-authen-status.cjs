const assert=require('node:assert/strict');
const {requestFor,checkStatus}=require('../scripts/nhso-authen-status.cjs');
const first='123456789012';let sum=0;for(let i=0;i<12;i++)sum+=Number(first[i])*(13-i);
const personalId=first+((11-sum%11)%10);
const input={zone:'test',token:'test-only',personalId,serviceDate:'2026-09-22',serviceCode:'TEST001'};
(async()=>{
const req=requestFor(input);assert.equal(req.url.hostname,'test.nhso.go.th');assert.equal(req.options.redirect,'error');assert.equal(req.options.method,'GET');
for(const change of [{zone:'https://other.example'},{token:''},{personalId:'123'},{serviceDate:'2026-02-30'},{serviceCode:''}])assert.throws(()=>requestFor({...input,...change}));
const result=await checkStatus(input,{fetchImpl:async()=>new Response(JSON.stringify({example:true}),{headers:{'content-type':'application/json'}})});assert.equal(result.writeAllowed,false);
await assert.rejects(()=>checkStatus(input,{fetchImpl:async()=>{throw Error('secret '+personalId);}}),e=>e.message==='AUTHEN_NETWORK_FAILED');
await assert.rejects(()=>checkStatus(input,{fetchImpl:async()=>new Response('',{status:401})}),/AUTHEN_ACCESS_DENIED/);
await assert.rejects(()=>checkStatus(input,{fetchImpl:async()=>new Response('<html>login</html>',{headers:{'content-type':'text/html'}})}),/AUTHEN_RESPONSE_NOT_JSON/);
console.log('PASS: fixed destinations, explicit service code, valid identity/date, no redirects, sanitized errors, read-only response');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
