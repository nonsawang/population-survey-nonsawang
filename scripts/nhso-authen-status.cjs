// Read existing Authen only. Never creates a code or changes HOSxP.
const {validCid}=require('./validate-hosxp-fit-queue.cjs');
const endpoints=Object.freeze({test:'https://test.nhso.go.th/authencodestatus/api/check-authen-status',production:'https://nhso.go.th/authencodestatus/api/check-authen-status'});
function requestFor({zone,token,personalId,serviceDate,serviceCode}){
 if(!Object.hasOwn(endpoints,zone))throw Error('AUTHEN_ZONE_REQUIRED');
 if(typeof token!=='string'||!token.trim()||/[\r\n]/.test(token))throw Error('AUTHEN_TOKEN_REQUIRED');
 if(!validCid(personalId))throw Error('AUTHEN_INVALID_CID');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(serviceDate||'')||!Number.isFinite(Date.parse(serviceDate))||new Date(serviceDate).toISOString().slice(0,10)!==serviceDate)throw Error('AUTHEN_INVALID_DATE');
 if(!/^[A-Z0-9]{3,30}$/.test(serviceCode||''))throw Error('AUTHEN_SERVICE_CODE_REQUIRED');
 const url=new URL(endpoints[zone]);url.search=new URLSearchParams({personalId,serviceDate,serviceCode}).toString();
 return {url,options:{method:'GET',headers:{Authorization:'Bearer '+token.trim(),Accept:'application/json'},redirect:'error',cache:'no-store'}};
}
async function checkStatus(input,{fetchImpl=fetch,timeoutMs=15000}={}){
 const {url,options}=requestFor(input),abort=new AbortController(),timer=setTimeout(()=>abort.abort(),timeoutMs);
 try{
  let response;try{response=await fetchImpl(url,{...options,signal:abort.signal});}catch{throw Error(abort.signal.aborted?'AUTHEN_TIMEOUT':'AUTHEN_NETWORK_FAILED');}
  if(!response.ok)throw Error(response.status===401||response.status===403?'AUTHEN_ACCESS_DENIED':response.status===429?'AUTHEN_RATE_LIMITED':'AUTHEN_HTTP_FAILED');
  if(!/application\/(?:[\w.+-]*\+)?json/i.test(response.headers.get('content-type')||''))throw Error('AUTHEN_RESPONSE_NOT_JSON');
  // Response fields have not yet been confirmed against the current NHSO service.
  // Keep data in memory only; callers must not log it or treat it as approved for import.
  let data;try{data=await response.json();}catch{throw Error('AUTHEN_INVALID_JSON');}
  return {status:'received_requires_mapping_review',data,checkedAt:new Date().toISOString(),writeAllowed:false};
 }finally{clearTimeout(timer);}
}
module.exports={requestFor,checkStatus};
