const assert=require('node:assert/strict');const {retryDeadlock}=require('../scripts/hosxp-deadlock-retry.cjs');
const dead=()=>Object.assign(new Error('deadlock'),{code:'ER_LOCK_DEADLOCK',errno:1213});
(async()=>{let n=0,waits=[];const options={sleep:async ms=>waits.push(ms),random:()=>0};
assert.equal(await retryDeadlock(async()=>{if(++n<3)throw dead();return 'ok'},options),'ok');assert.equal(n,3);assert.deepEqual(waits,[100,200]);
n=0;await assert.rejects(()=>retryDeadlock(async()=>{n++;throw dead()},options),/DEADLOCK_RETRY_EXHAUSTED/);assert.equal(n,3);
for(const code of ['ECONNRESET','ER_LOCK_WAIT_TIMEOUT','SOURCE_CHANGED','ER_DUP_ENTRY']){n=0;await assert.rejects(()=>retryDeadlock(async()=>{n++;throw Object.assign(new Error(code),{code})},options),new RegExp(code));assert.equal(n,1);}
console.log('PASS bounded deadlock retries, backoff, no retry for other failures');})().catch(e=>{console.error(e);process.exitCode=1});
