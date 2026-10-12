const {randomUUID}=require('node:crypto');
const {requestFor}=require('./nhso-close-rights.cjs');
const {fingerprint}=require('./nhso-close-dispatch.cjs');
// Server/LAN only. reserve must atomically validate the persisted manual intent,
// actor permission, same-day service and snapshot hash before returning acquired.
// Never wire this adapter to the existing test-only reservation RPC.
async function sendProduction(input,{enabled=false,ledger,receipts,fetchImpl=globalThis.fetch,now=Date.now()}={}){
 if(enabled!==true||input.zone!=='production')throw Error('PRODUCTION_DISABLED');
 if(!ledger||typeof ledger.reserveManualIntent!=='function'||typeof ledger.record!=='function'||typeof receipts?.save!=='function')throw Error('DURABLE_PRODUCTION_ADAPTERS_REQUIRED');
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'});
 for(const date of [input.serviceDateTime,input.invoiceDateTime])if(!Number.isSafeInteger(date)||today.format(new Date(date))!==today.format(new Date(now)))throw Error('SAME_DAY_SERVICE_REQUIRED');
 // Validate before reservation; the synthetic suffix is excluded from the hash.
 requestFor({...input,transactionId:input.hcode+'validation'},{allowProduction:true,now});
 const hash=fingerprint({...input,zone:'test'}),owner=randomUUID();
 let reservation;
 try{reservation=await ledger.reserveManualIntent(input.intentId,hash,owner);}catch{return {status:'reservation_unconfirmed',retrySendAllowed:false};}
 if(!reservation?.acquired)return {status:'already_reserved',retrySendAllowed:false};
 if(!reservation.id||!reservation.transactionId)return {status:'reservation_unconfirmed',retrySendAllowed:false};
 const receipt={id:reservation.id,owner,simulated:false,zone:'production',state:'outcome_unknown',seq:null,code:null};
 try{
  const request=requestFor({...input,transactionId:input.hcode+reservation.transactionId},{allowProduction:true,now});
  const response=await fetchImpl(request.url,{...request.options,signal:AbortSignal.timeout(15000)});
  if(response.ok&&/application\/(?:[\w.+-]*\+)?json/i.test(response.headers.get('content-type')||'')){
   const data=await response.json();
   if((data.dataError===undefined||data.dataError===null||data.dataError==='')&&
      ((Number.isSafeInteger(data.seq)&&data.seq>0)||(typeof data.seq==='string'&&/^\d{1,100}$/.test(data.seq)))&&
      typeof data.authenCode==='string'&&/^[^\s]{1,20}$/.test(data.authenCode)){
    receipt.state='confirmed';receipt.seq=String(data.seq);receipt.code=data.authenCode;
   }
  }
 }catch{/* No HTTP retries: a lost response can follow a successful remote commit. */}
 try{await receipts.save(receipt);}catch{return {status:'receipt_storage_failed',closureId:receipt.id,retrySendAllowed:false};}
 try{await ledger.record(receipt);}catch{return {status:'ack_pending',closureId:receipt.id,retrySendAllowed:false};}
 return {status:receipt.state,closureId:receipt.id,retrySendAllowed:false};
}
module.exports={sendProduction};
