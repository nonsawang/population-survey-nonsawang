const {cidValid}=require('../lib/authen-report.cjs');
const SCHEMA_CONFIRMED=false;
const endpoint='https://test.nhso.go.th/nhsoendpoint/api/nhso-claim-detail';
function requestFor(input,{now=Date.now()}={}){
  if(input.zone!=='test')throw Error('CLOSE_RIGHTS_TEST_ONLY');
  if(typeof input.token!=='string'||!input.token.trim()||/[\r\n]/.test(input.token))throw Error('CLOSE_RIGHTS_TOKEN_REQUIRED');
  if(!cidValid(input.personalId)||!cidValid(input.recorderPid))throw Error('CLOSE_RIGHTS_INVALID_CID');
  if(!/^\d{5}$/.test(input.hcode))throw Error('CLOSE_RIGHTS_INVALID_HCODE');
  if(!Number.isSafeInteger(now))throw Error('CLOSE_RIGHTS_INVALID_CLOCK');
  const body={};
  const limits={transactionId:255,sourceId:50,visitNumber:30};
  for(const key of ['mainInsclCode','transactionId','claimServiceCode','sourceId','visitNumber']){
    if(typeof input[key]!=='string'||!input[key].trim()||input[key].length>(limits[key]||100)||/[\r\n]/.test(input[key]))throw Error('CLOSE_RIGHTS_INVALID_'+key);
    body[key]=input[key].trim();
  }
  if(!body.transactionId.startsWith(input.hcode)||body.transactionId.length<=5)throw Error('CLOSE_RIGHTS_INVALID_TRANSACTION_ID');
  const department=input.department;
  if(!department||!['code','name'].every(k=>typeof department[k]==='string'&&department[k].trim()&&department[k].length<=100))throw Error('CLOSE_RIGHTS_INVALID_DEPARTMENT');
  body.department={code:department.code.trim(),name:department.name.trim()};
  for(const key of ['serviceDateTime','invoiceDateTime']){
    if(!Number.isSafeInteger(input[key])||input[key]<Date.UTC(2000,0,1)||input[key]>=Date.UTC(2200,0,1)||input[key]>now)throw Error('CLOSE_RIGHTS_INVALID_DATETIME');
    body[key]=input[key];
  }
  for(const key of ['totalAmount','paidAmount','privilegeAmount']){
    if(typeof input[key]!=='number'||!Number.isFinite(input[key])||input[key]<0||input[key]>99999999.99||!/^\d{1,8}(?:\.\d{1,2})?$/.test(String(input[key])))throw Error('CLOSE_RIGHTS_INVALID_AMOUNT');
    body[key]=input[key];
  }
  Object.assign(body,{hcode:input.hcode,pid:input.personalId,recorderPid:input.recorderPid});
  return {url:endpoint,options:{method:'POST',headers:{Authorization:'Bearer '+input.token.trim(),Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify(body),redirect:'error',cache:'no-store'}};
}
// Deliberately no default network transport. This scaffold cannot submit live requests.
async function submitClose(input,{fetchImpl,mode,timeoutMs=15000}={}){
  if(mode!=='mock'||typeof fetchImpl!=='function')throw Error('CLOSE_RIGHTS_LIVE_DISABLED');
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)throw Error('CLOSE_RIGHTS_INVALID_TIMEOUT');
  const {url,options}=requestFor(input);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  const unknown=reason=>({status:'outcome_unknown',reason,retryAllowed:false,zone:'test',simulated:true});
  try{
    const response=await fetchImpl(url,{...options,signal:controller.signal});
    if(!response.ok)return unknown(response.status===409?'HTTP_CONFLICT_UNCONFIRMED':response.status===401||response.status===403?'ACCESS_DENIED':'HTTP_ERROR');
    if(!/application\/(?:[\w.+-]*\+)?json/i.test(response.headers.get('content-type')||''))return unknown('NON_JSON');
    const data=await response.json();
    if(data?.dataError!==undefined&&data.dataError!==null&&data.dataError!=='')return unknown('REMOTE_DATA_ERROR');
    if(!data||!(typeof data.seq==='string'&&data.seq.trim()||Number.isSafeInteger(data.seq)&&data.seq>=0)||typeof data.authenCode!=='string'||!data.authenCode.trim()||data.authenCode.length>100)return unknown('INVALID_RESPONSE');
    return {status:'simulated_success',zone:'test',simulated:true,seq:data.seq,authenCode:data.authenCode.trim(),retryAllowed:false};
  }catch{return unknown(controller.signal.aborted?'TIMEOUT':'TRANSPORT_OR_RESPONSE_ERROR');}
  finally{clearTimeout(timer);}
}
module.exports={requestFor,submitClose,SCHEMA_CONFIRMED};


