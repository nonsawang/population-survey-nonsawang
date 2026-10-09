const assert=require('node:assert/strict');
const {sendReserved,retryRecord,fingerprint,testLedger}=require('../scripts/nhso-close-dispatch.cjs');
function cid(s){let n=0;for(let i=0;i<12;i++)n+=Number(s[i])*(13-i);return s+(11-n%11)%10;}
const input={zone:'test',token:'mock',personalId:cid('123456789012'),recorderPid:cid('987654321098'),hcode:'05080',department:{code:'01',name:'test'},mainInsclCode:'UCS',claimServiceCode:'fixture',sourceId:'fixture',visitNumber:'fixture',serviceDateTime:Date.UTC(2026,9,7),invoiceDateTime:Date.UTC(2026,9,7),totalAmount:1,paidAmount:0,privilegeAmount:1};
(async()=>{
 assert.equal(fingerprint(input),fingerprint({...input,token:'rotated',transactionId:'ignored'}));
 assert.notEqual(fingerprint(input),fingerprint({...input,totalAmount:2}));
 let reserved=false,calls=0,records=0,fail=true,recorded;
 const ledger={reserve:async()=>{const acquired=!reserved;reserved=true;return {id:'fixture-id',transactionId:'fixture-transaction',acquired};},record:async r=>{records++;if(fail)throw Error('storage offline');recorded=r;}};
 const fetchImpl=async(_,opts)=>{calls++;assert.equal(JSON.parse(opts.body).transactionId,'05080fixture-transaction');return new Response(JSON.stringify({seq:1,authenCode:'SIMULATED'}),{headers:{'content-type':'application/json'}});};
 const first=await sendReserved(input,{ledger,fetchImpl,mode:'mock'});
 assert.equal(first.status,'ack_pending');assert.equal(first.receipt.state,'confirmed');assert.equal(calls,1);
 assert.equal((await sendReserved(input,{ledger,fetchImpl,mode:'mock'})).status,'already_reserved');assert.equal(calls,1);
 fail=false;assert.equal((await retryRecord(first.receipt,{ledger})).status,'recorded');assert.equal(calls,1);assert.equal(recorded.code,'SIMULATED');
 // Lost acknowledgement after the database committed: retry only the acknowledgement.
 const uncertain={record:async r=>{recorded=r;throw Error('lost reply');}};
 assert.equal((await retryRecord(first.receipt,{ledger:uncertain})).status,'ack_pending');
 assert.equal((await retryRecord(first.receipt,{ledger})).status,'recorded');assert.equal(calls,1);
 const broken={reserve:async()=>{throw Error('lost reservation response');}};
 assert.equal((await sendReserved(input,{ledger:broken,fetchImpl,mode:'mock'})).status,'reservation_unconfirmed');assert.equal(calls,1);
 assert.throws(()=>testLedger({}),/ISOLATED/);
 await assert.rejects(()=>sendReserved(input,{ledger,fetchImpl}),/LIVE_DISABLED/);
 console.log('PASS: remote success / acknowledgement failure; record-only retry; no second submission; lost reservation blocks sending');
})().catch(e=>{console.error(e);process.exitCode=1;});

