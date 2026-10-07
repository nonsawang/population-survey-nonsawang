const {createHash,randomUUID}=require('node:crypto');
const {requestFor,submitClose}=require('./nhso-close-rights.cjs');
function canonical(value){
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
 return value;
}
function fingerprint(input){
 const body=JSON.parse(requestFor({...input,transactionId:'pending-reservation'}).options.body);
 delete body.transactionId;
 return createHash('sha256').update(JSON.stringify(canonical(body))).digest('hex');
}
// Only use this adapter with an isolated test database; simulation must not become real evidence.
function testLedger(client,{isolatedTestDatabase=false}={}){
 if(!isolatedTestDatabase)throw Error('ISOLATED_TEST_DATABASE_REQUIRED');
 async function rpc(name,args){const {data,error}=await client.rpc(name,args);if(error)throw Error('LEDGER_RPC_FAILED');return data;}
 return {
  reserve:(input,hash,owner)=>rpc('nhso_close_reserve',{p_zone:input.zone,p_hcode:input.hcode,p_visit:input.visitNumber,p_service:input.claimServiceCode,p_hash:hash,p_owner:owner}),
  record:receipt=>rpc('nhso_close_record',{p_id:receipt.id,p_owner:receipt.owner,p_state:receipt.state,p_seq:receipt.seq,p_code:receipt.code})
 };
}
async function retryRecord(receipt,{ledger}={}){
 if(receipt?.simulated!==true)throw Error('SIMULATION_REQUIRED');
 try{await ledger.record(receipt);return {status:'recorded',simulated:true,retrySendAllowed:false};}
 catch{return {status:'ack_pending',simulated:true,retrySendAllowed:false,receipt};}
}
async function sendReserved(input,{ledger,fetchImpl,mode,receipts}={}){
 if(mode!=='mock'||typeof fetchImpl!=='function')throw Error('LIVE_DISABLED');
 const hash=fingerprint(input),owner=randomUUID();
 let reservation;
 try{reservation=await ledger.reserve(input,hash,owner);}catch{return {status:'reservation_unconfirmed',retrySendAllowed:false};}
 if(!reservation?.acquired)return {status:'already_reserved',retrySendAllowed:false};
 if(!reservation.id||!reservation.transactionId) return {status:'reservation_unconfirmed',retrySendAllowed:false};
 const result=await submitClose({...input,transactionId:reservation.transactionId},{mode:'mock',fetchImpl});
 const receipt={id:reservation.id,owner,simulated:true,state:result.status==='simulated_success'?'confirmed':'outcome_unknown',seq:result.seq===undefined?null:String(result.seq),code:result.authenCode??null};
 if(receipts){
  try{await receipts.save(receipt);}catch{return {status:'receipt_storage_failed',simulated:true,retrySendAllowed:false,receipt};}
 }
 return retryRecord(receipt,{ledger});
}
module.exports={fingerprint,testLedger,sendReserved,retryRecord};

