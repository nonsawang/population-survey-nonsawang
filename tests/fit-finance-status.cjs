const assert=require('node:assert/strict');
const importer=require('../scripts/hosxp-fit-import.cjs');
let calls=0;importer.acknowledge=async()=>{calls++;};
const {reconcile}=require('../scripts/hosxp-fit-finance-status.cjs');
function source(rows){const q={select:()=>q,eq:()=>q,order:()=>q,limit:async()=>({data:rows})};return {from:()=>q};}
const record={preparation_id:'test',vn:'690914093057',payload_hash:'hash',policy_version:'version'};
(async()=>{
 let rolled=0;const db={query:async sql=>assert.equal(sql,'START TRANSACTION READ ONLY'),execute:async sql=>{assert(sql.startsWith('SELECT '));return [[record]];},rollback:async()=>{rolled++;}};
 assert.equal((await reconcile({source:source([]),db})).finance_status_refreshed,0);
 assert.equal((await reconcile({source:source([record]),db})).finance_status_refreshed,1);assert.equal(calls,1);assert.equal(rolled,1);
 await assert.rejects(()=>reconcile({source:source([{...record,vn:'wrong'}]),db}),/LEDGER_MISMATCH/);assert.equal(calls,1);assert.equal(rolled,2);
 console.log('PASS: read-only HOSxP transaction, exact ledger match, no acknowledgement on mismatched visit');
})().catch(e=>{console.error(e);process.exitCode=1;});
