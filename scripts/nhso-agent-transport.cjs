const {createHash,randomUUID}=require('node:crypto');
const BASE='http://127.0.0.1:8189';
function readEvidence(data){
 if(!data||!/^\d{13}$/.test(data.pid||'')||typeof data.correlationId!=='string'||!data.correlationId||data.correlationId.length>2048||typeof data.mainInscl!=='string'||!data.mainInscl||!Array.isArray(data.claimTypes))throw Error('INVALID_ENTITLEMENT');
 // Unknown claimTypes shapes fail closed; no guessed service-code mapping.
 const types=data.claimTypes.map(t=>typeof t==='string'?t:t?.claimType).filter(t=>typeof t==='string'&&/^[A-Z0-9]{1,30}$/.test(t));
 return {pid:data.pid,correlationId:data.correlationId,mainInscl:data.mainInscl,claimTypes:[...new Set(types)]};
}
async function readAgent(fetchImpl=fetch){const r=await fetchImpl(BASE+'/api/smartcard/read?readImageFlag=false',{method:'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(45000)});if(!r.ok||!r.headers.get('content-type')?.includes('application/json'))throw Error('AGENT_READ_FAILED');return readEvidence(await r.json());}
function agentBody(input,evidence,now=Date.now()){
 const e=readEvidence(evidence);
 if(e.pid!==input.personalId||!e.claimTypes.includes(input.claimServiceCode)||!Number.isFinite(evidence.expiresAt)||evidence.expiresAt<=now)throw Error('FRESH_ENTITLEMENT_REQUIRED');
 if(typeof input.visitNumber!=='string'||!input.visitNumber||input.visitNumber.length>30)throw Error('VISIT_REQUIRED');
 const dt=new Date(input.invoiceDateTime);if(!Number.isSafeInteger(input.invoiceDateTime)||input.invoiceDateTime>now||!Number.isFinite(dt.getTime()))throw Error('INVALID_DATE');
 const thai=d=>new Date(d+7*3600000).toISOString();if(thai(input.invoiceDateTime).slice(0,10)!==thai(now).slice(0,10))throw Error('SAME_DAY_REQUIRED');
 if(input.totalAmount!==60||![input.paidAmount,input.privilegeAmount].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&Number.isInteger(Math.round(n*100))&&Math.abs(n*100-Math.round(n*100))<1e-8)||Math.round((input.paidAmount+input.privilegeAmount)*100)!==6000)throw Error('AMOUNT_MISMATCH');
 return {pid:e.pid,invoiceDate:thai(input.invoiceDateTime).slice(0,10),invoiceTime:thai(input.invoiceDateTime).slice(11,19),paidAmount:input.paidAmount,privilegeAmount:input.privilegeAmount,claimType:input.claimServiceCode,correlationId:e.correlationId,visitNumber:input.visitNumber};
}
async function sendAgent(input,evidence,{enabled=false,ledger,receipts,fetchImpl=fetch,now=Date.now()}={}){
 if(enabled!==true)throw Error('AGENT_SEND_DISABLED');
 const body=agentBody(input,evidence,now);if(!ledger?.reserveManualIntent||!ledger?.record||!receipts?.save)throw Error('DURABLE_ADAPTERS_REQUIRED');
 const hash=createHash('sha256').update(JSON.stringify({transport:'agent',body})).digest('hex'),owner=randomUUID();let reservation;
 try{reservation=await ledger.reserveManualIntent(input.intentId,hash,owner);}catch{return {status:'reservation_unconfirmed',retrySendAllowed:false};}
 if(!reservation?.acquired||!reservation.id)return {status:'already_reserved',retrySendAllowed:false};
 const receipt={id:reservation.id,owner,zone:'production',simulated:false,state:'outcome_unknown',seq:null,code:null};
 try{const r=await fetchImpl(BASE+'/api/nhso-service/save-endpoint',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(20000)});
 if(r.ok&&r.headers.get('content-type')?.includes('application/json')){const d=await r.json();if(!d.dataError&&/^[0-9]{1,100}$/.test(String(d.seq||''))&&typeof d.authenCode==='string'&&/^[^\s]{1,20}$/.test(d.authenCode)){receipt.state='confirmed';receipt.seq=String(d.seq);receipt.code=d.authenCode;}}}catch{}
 try{await receipts.save(receipt);}catch{return {status:'receipt_storage_failed',retrySendAllowed:false};}
 try{await ledger.record(receipt);}catch{return {status:'ack_pending',retrySendAllowed:false};}
 return {status:receipt.state,retrySendAllowed:false};
}
module.exports={readEvidence,readAgent,agentBody,sendAgent};
