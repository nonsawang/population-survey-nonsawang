const assert=require('node:assert/strict');const {batchRows}=require('../scripts/hosxp-fit-batch.cjs');
(async()=>{let calls=0;const source={from(){let ids,lo,hi;const q={select(){return q},in(k,v){ids=v;return q},order(){return q},range(a,b){lo=a;hi=b;return q},then(resolve){calls++;return Promise.resolve({data:ids.map(id=>({id})).slice(lo,hi+1),error:null}).then(resolve)}};return q}};
assert.deepEqual(await batchRows(source,'x','id',[],'id'),[]);assert.equal(calls,0);
const ids=Array.from({length:205},(_,i)=>i);assert.equal((await batchRows(source,'x','id',[...ids,1],'id')).length,205);
assert.equal(calls,5);console.log('PASS batch pagination, deduplication, empty input');})();
