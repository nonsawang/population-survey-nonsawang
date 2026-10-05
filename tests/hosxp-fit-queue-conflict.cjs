const assert=require('node:assert/strict');
const {queueConflict}=require('../scripts/hosxp-fit-queue-conflict.cjs');
function source(tables,fail=false){return {from(table){let rows=tables[table]||[];const q={select(){return q},eq(k,v){rows=rows.filter(r=>r[k]===v);return q},in(k,v){rows=rows.filter(r=>v.includes(r[k]));return q},order(){return q},range(a,b){rows=rows.slice(a,b+1);return q},then(resolve){return Promise.resolve({data:rows,error:fail?{}:null}).then(resolve)}};return q}}}
(async()=>{
const job={id:'a',person_id:'p1',screen_date:'2026-10-05'};
const tables={population:[{person_id:'p1',cid:'test'},{person_id:'p2',cid:'test'}],hosxp_fit_preparations:[{...job,state:'awaiting_lan_validation'},{id:'b',person_id:'p2',screen_date:job.screen_date,state:'awaiting_lan_validation'}]};
assert.equal(await queueConflict(source(tables),job,{cid:'test'}),'QUEUE_CONFLICT');
assert.equal(await queueConflict(source(tables),{...job,id:'b',person_id:'p2'},{cid:'test'}),'QUEUE_CONFLICT');
assert.equal(await queueConflict(source({...tables,hosxp_fit_import_results:[{preparation_id:'b',import_status:'imported'}]}),job,{cid:'test'}),null);
tables.hosxp_fit_preparations[1].screen_date='2026-10-04';
assert.equal(await queueConflict(source(tables),job,{cid:'test'}),null);
await assert.rejects(()=>queueConflict(source(tables,true),job,{cid:'test'}),/QUEUE_CONFLICT_CHECK_FAILED/);
console.log('PASS queue collision: same CID across IDs, both jobs blocked, imported excluded, different dates, fail closed');
})().catch(e=>{console.error(e);process.exitCode=1});
