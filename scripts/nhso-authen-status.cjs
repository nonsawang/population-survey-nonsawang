// Read existing Authen only. Never creates a code or changes HOSxP.
const {cidValid:validCid}=require('../lib/authen-report.cjs');
const endpoints=Object.freeze({test:'https://test.nhso.go.th/authencodestatus/api/check-authen-status',production:'https://authenucws.nhso.go.th/authencodestatus/api/check-authen-status'});
function requestFor({zone,token,personalId,serviceDate,serviceCode}){
 if(!Object.hasOwn(endpoints,zone))throw Error('AUTHEN_ZONE_REQUIRED');
 if(typeof token!=='string'||!token.trim()||/[\r\n]/.test(token))throw Error('AUTHEN_TOKEN_REQUIRED');
 if(!validCid(personalId))throw Error('AUTHEN_INVALID_CID');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(serviceDate||'')||!Number.isFinite(Date.parse(serviceDate))||new Date(serviceDate).toISOString().slice(0,10)!==serviceDate)throw Error('AUTHEN_INVALID_DATE');
 if(serviceCode!=null&&serviceCode!==''&&!/^[A-Z0-9]{3,30}$/.test(serviceCode))throw Error('AUTHEN_SERVICE_CODE_REQUIRED');
 const url=new URL(endpoints[zone]);url.search=new URLSearchParams({personalId,serviceDate,...(serviceCode?{serviceCode}:{})}).toString();
 return {url,options:{method:'GET',headers:{Authorization:'Bearer '+token.trim(),Accept:'application/json'},redirect:'error',cache:'no-store'}};
}
async function checkStatus(input,{fetchImpl=fetch,timeoutMs=15000}={}){
 const {url,options}=requestFor(input),abort=new AbortController(),timer=setTimeout(()=>abort.abort(),timeoutMs);
 try{
  let response;try{response=await fetchImpl(url,{...options,signal:abort.signal});}catch{throw Error(abort.signal.aborted?'AUTHEN_TIMEOUT':'AUTHEN_NETWORK_FAILED');}
  if(!response.ok)throw Error(response.status===401||response.status===403?'AUTHEN_ACCESS_DENIED':response.status===429?'AUTHEN_RATE_LIMITED':'AUTHEN_HTTP_FAILED');
  if(!/application\/(?:[\w.+-]*\+)?json/i.test(response.headers.get('content-type')||''))throw Error('AUTHEN_RESPONSE_NOT_JSON');
  // V1.1 serviceHistories carries claimCode. Cancellation is not documented.
  // Keep data in memory only; callers must not log it or treat it as approved for import.
  let data;try{data=await response.json();}catch{throw Error('AUTHEN_INVALID_JSON');}
  return {...interpretStatus(data,input),checkedAt:new Date().toISOString(),writeAllowed:false};
 }finally{clearTimeout(timer);}
}
function interpretStatus(data,input){
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('AUTHEN_INVALID_SCHEMA');
 const value=data.statusAuthen;
 if(![true,false,'true','false'].includes(value))throw Error('AUTHEN_INVALID_SCHEMA');
 const base={writeAllowed:false,cancellationStatus:'unknown'};
 if(value===false||value==='false')return {...base,status:'not_confirmed',matches:[]};
 // personalId is documented but omitted in the sample: never silently assume it.
 if(!data.personalId)return {...base,status:'identity_missing',matches:[]};
 if(String(data.personalId)!==input.personalId)return {...base,status:'identity_mismatch',matches:[]};
 if(!Array.isArray(data.serviceHistories))throw Error('AUTHEN_INVALID_SCHEMA');
 if(!/^\d{5}$/.test(input.hcode||''))return {...base,status:'provider_required',matches:[]};
 const matches=data.serviceHistories.filter(r=>r&&r.hospital?.hcode===input.hcode&&
 typeof r.serviceDateTime==='string'&&/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(r.serviceDateTime)&&
 r.serviceDateTime.slice(0,10)===input.serviceDate&&(!input.serviceCode||r.service?.code===input.serviceCode)&&
 typeof r.claimCode==='string'&&r.claimCode.trim()&&typeof r.service?.code==='string')
 .map(r=>({claimCode:r.claimCode,serviceCode:r.service.code,serviceDateTime:r.serviceDateTime,hcode:r.hospital.hcode}));
 return {...base,status:matches.length>1?'multiple_matches':matches.length===1?'matched_read_only':'no_matching_service',matches};
}
module.exports={requestFor,checkStatus,interpretStatus};

