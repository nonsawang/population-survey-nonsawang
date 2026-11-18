const path=require('node:path'),{randomUUID}=require('node:crypto');
const {readAgent,sendAgent}=require('./nhso-agent-transport.cjs');
async function rpc(client,name,args){const r=await client.rpc(name,args);if(r.error)throw Error('AGENT_QUEUE_RPC_FAILED');return r.data;}
async function agentPass({client,db,station,hcode,enabled=false,receipts,fetchImpl=fetch}){
 if(!station||!/^\d{5}$/.test(hcode))throw Error('STATION_CONFIG_REQUIRED');
 const owner=randomUUID(),job=await rpc(client,'nhso_agent_read_claim',{p_station:station,p_owner:owner});
 if(job){let evidence=null;try{evidence=await readAgent(fetchImpl);}catch{}await rpc(client,'nhso_agent_read_finish',{p_id:job.id,p_owner:owner,p_data:evidence});}
 if(!enabled)return;
 const r=await client.from('nhso_agent_reads').select('intent_id,pid,main_inscl,correlation_id,claim_types,expires_at,state,fit_close_intents!inner(state,transport)').eq('fit_close_intents.state','pending').eq('fit_close_intents.transport','agent').eq('station',station).eq('state','ready').not('intent_id','is',null).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:true}).limit(20);
 if(r.error)throw Error('AGENT_EVIDENCE_READ_FAILED');
 for(const evidence of r.data||[]){
 const status=await client.from('fit_close_intents').select('state,transport').eq('id',evidence.intent_id).single();if(status.error)throw Error('INTENT_READ_FAILED');if(status.data.state!=='pending'||status.data.transport!=='agent')continue;
 const {loadCloseInput}=require('./nhso-close-live-loader.cjs');
 const {input,snapshot}=await loadCloseInput({client,db,intentId:evidence.intent_id,config:{hcode},agentEvidence:evidence});
 const ledger={reserveManualIntent:(id,hash,owner)=>rpc(client,'nhso_agent_reserve',{p_intent:id,p_expected:snapshot,p_hash:hash,p_owner:owner,p_hcode:hcode,p_service:input.claimServiceCode,p_station:station}),record:r=>rpc(client,'nhso_close_record',{p_id:r.id,p_owner:r.owner,p_state:r.state,p_seq:r.seq,p_code:r.code})};
 const result=await sendAgent(input,{pid:evidence.pid,mainInscl:evidence.main_inscl,correlationId:evidence.correlation_id,claimTypes:evidence.claim_types,expiresAt:Date.parse(evidence.expires_at)},{enabled:true,ledger,receipts,fetchImpl});
 if(['confirmed','outcome_unknown'].includes(result.status))await rpc(client,'nhso_agent_sync_outcome',{p_intent:evidence.intent_id});
 console.log('AGENT_CLOSE_'+result.status.toUpperCase());
 }
}
async function recoverAgentReceipt({client,intentId,station,receipts}){
 const i=await client.from('fit_close_intents').select('closure_id,transport,state').eq('id',intentId).single();
 const e=await client.from('nhso_agent_reads').select('station').eq('intent_id',intentId).single();
 if(i.error||e.error||i.data.transport!=='agent'||e.data.station!==station||!i.data.closure_id)throw Error('RECEIPT_RECONCILIATION_REQUIRED');
 const r=receipts.load(i.data.closure_id);if(r.zone!=='production'||r.simulated!==false)throw Error('INVALID_RECEIPT');
 await rpc(client,'nhso_close_record',{p_id:r.id,p_owner:r.owner,p_state:r.state,p_seq:r.seq,p_code:r.code});
 await rpc(client,'nhso_agent_sync_outcome',{p_intent:intentId});return {status:'recorded',retrySendAllowed:false};
}
async function main(){
 const {readConfig}=require('./refresh-hosxp-review.cjs'),{createClient}=require('@supabase/supabase-js'),mysql=require('mysql2/promise');
 const c=readConfig(path.resolve(__dirname,'../.env.sync'));
 if(c.NHSO_AGENT_READ_ENABLED!=='true')throw Error('AGENT_READ_DISABLED');
 const client=createClient(c.SUPABASE_URL,c.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
 const enabled=c.NHSO_AGENT_SEND_ENABLED==='true'&&c.NHSO_AGENT_PRODUCTION_VERIFIED==='true';let receipts;
 if(enabled||process.argv[2]==='recover'){const {protectedKey}=require('./nhso-receipt-key.cjs'),{receiptStore}=require('./nhso-close-receipts.cjs');const base=path.join(process.env.LOCALAPPDATA,'Nonsawang','CloseRights');receipts=receiptStore(path.join(base,'production-receipts'),protectedKey(path.join(base,'production-receipt.key.dpapi')),{production:true});}
 if(process.argv[2]==='recover'){if(!receipts)throw Error('RECEIPTS_REQUIRED');await recoverAgentReceipt({client,intentId:process.argv[3],station:c.NHSO_AGENT_STATION_ID,receipts});console.log('AGENT_RECEIPT_RECORDED_NO_SEND');return;}
 do{let db;try{if(enabled)db=await mysql.createConnection({host:c.HOSXP_DB_HOST,port:Number(c.HOSXP_DB_PORT||3306),database:c.HOSXP_DB_NAME,user:c.HOSXP_DB_USER,password:c.HOSXP_DB_PASSWORD,dateStrings:true});await agentPass({client,db,station:c.NHSO_AGENT_STATION_ID,hcode:c.NHSO_HCODE,enabled,receipts});}catch{console.error('AGENT_PASS_FAILED_CHECK_STATUS');if(!process.argv.includes('--watch'))process.exitCode=1;}finally{if(db)await db.end();}
 if(!process.argv.includes('--watch'))break;await new Promise(r=>setTimeout(r,5000));}while(true);
}
if(require.main===module)main().catch(()=>{console.error('AGENT_CONFIG_FAILED');process.exitCode=1;});
module.exports={agentPass,recoverAgentReceipt};
