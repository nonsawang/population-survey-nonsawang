const assert=require('node:assert/strict');const {settings,due,processJobs}=require('../scripts/hosxp-fit-auto.cjs');
(async()=>{
 assert.throws(()=>settings({enabled:true}),/AUTO_NOT_CONFIGURED/);
 assert.throws(()=>settings({enabled:false,scope:'new_only',startAt:new Date().toISOString()}));
 const jobs=[{id:'done'},{id:'a'},{id:'b'}],done=new Set(['done']),state={};let calls=[],saves=0;
 const base={jobs,done,state,limit:1,now:1000,save:async()=>{saves++;},importJob:async id=>{calls.push(id);return {import_status:'imported'};}};
 assert.equal((await processJobs(base)).imported,1);assert.deepEqual(calls,['a']);assert(done.has('a'));assert.equal(saves,2);
 calls=[];await processJobs(base);assert.deepEqual(calls,['b']);
 const failed={};let attempts=0;
 const bad={...base,jobs:[{id:'x'}],done:new Set(),state:failed,importJob:async()=>{attempts++;throw Error('COMMITTED_ACK_PENDING');}};
 await processJobs(bad);await processJobs(bad);assert.equal(attempts,1);assert.equal(failed.x.code,'COMMITTED_ACK_PENDING');
 for(let i=1;i<5;i++)await processJobs({...bad,now:failed.x.nextAt});
 assert.equal(attempts,5);assert(!due({id:'x'},new Set(),failed,Infinity));
 let savedBefore=false;await processJobs({...base,jobs:[{id:'recovery'}],done:new Set(),state:{},save:async()=>{savedBefore=true;},importJob:async()=>{assert(savedBefore);return {import_status:'imported',replayed:true};}});
 console.log('PASS: explicit scope, bounded batch, skip completed, persisted cooldown, five-attempt cap, committed-result recovery');
})().catch(e=>{console.error(e);process.exitCode=1;});
