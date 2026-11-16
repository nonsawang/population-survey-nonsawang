const assert=require('node:assert/strict');
(async()=>{const {logFilters,activityLogQuery}=await import('../lib/activity-log-query.mjs');
const f=logFilters({start:'2026-11-16',end:'2026-11-16',username:'user_1',action:'LOGIN'});
assert.equal(f.from,'2026-11-15T17:00:00.000Z');assert.equal(f.until,'2026-11-16T17:00:00.000Z');assert.equal(f.username,'user\\_1');
assert.throws(()=>logFilters({start:'2026-11-17',end:'2026-11-16'}));assert.throws(()=>logFilters({start:'2026-02-30'}));assert.equal(logFilters({}).from,undefined);
const calls=[],q=new Proxy({}, {get:(_,name)=>(...args)=>{calls.push([name,...args]);return q;}});activityLogQuery(q,f,7);
assert.deepEqual(calls.find(c=>c[0]==='range'),['range',300,349]);assert.deepEqual(calls.filter(c=>c[0]==='order').map(c=>c[1]),['created_at','id']);assert(calls.some(c=>c[0]==='lt'&&c[2]===f.until));
console.log('PASS Thai date boundaries, invalid dates, literal search, stable ordering, pagination beyond 300');})().catch(e=>{console.error(e);process.exitCode=1});