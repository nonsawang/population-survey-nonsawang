const assert=require('node:assert/strict');
const {agentPass,recoverAgentReceipt}=require('../scripts/nhso-agent-worker.cjs');
(async()=>{
 let sends=0,finished,claim=0;
 const client={rpc:async(name,args)=>{
  if(name==='nhso_agent_read_claim'){claim++;return {data:{id:'read-job'}};}
  if(name==='nhso_agent_read_finish'){finished=args;return {data:true};}
  throw Error('unexpected mutation');
 },from:()=>{throw Error('read-only worker must not inspect/send close intents')}};
 await agentPass({client,station:'fixture',hcode:'12345',fetchImpl:async(url,opts)=>{sends++;assert.equal(opts.method,'GET');assert.ok(url.endsWith('readImageFlag=false'));return Response.json({pid:'1234567890123',mainInscl:'LGO',correlationId:'fixture',claimTypes:['PG0060001']})}});
 assert.equal(claim,1);assert.equal(sends,1);assert.equal(finished.p_data.mainInscl,'LGO');assert.ok(finished.p_owner);
 await agentPass({client,station:'fixture',hcode:'12345',fetchImpl:async()=>{throw Error('reader disconnected')}});
 assert.equal(finished.p_data,null);
 const calls=[];
 const recovery={from:table=>({select(){return this},eq(){return this},single:async()=>({data:table==='fit_close_intents'?{transport:'agent',closure_id:'closure'}:{station:'fixture'}})}),rpc:async(name,args)=>{calls.push({name,args});return {data:true}}};
 const receipts={load:id=>{assert.equal(id,'closure');return {id,owner:'owner',zone:'production',simulated:false,state:'confirmed',seq:'123',code:'EP123'}}};
 assert.deepEqual(await recoverAgentReceipt({client:recovery,intentId:'intent',station:'fixture',receipts}),{status:'recorded',retrySendAllowed:false});
 assert.deepEqual(calls.map(c=>c.name),['nhso_close_record','nhso_agent_sync_outcome']);
 await assert.rejects(recoverAgentReceipt({client:recovery,intentId:'intent',station:'other',receipts}),/RECONCILIATION/);
 assert.equal(calls.length,2);
 console.log('PASS Worker read-only card queue, reader failure, station-bound receipt recovery without submission');
})().catch(e=>{console.error(e);process.exitCode=1});
