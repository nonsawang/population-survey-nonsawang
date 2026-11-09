const path=require('node:path');
const {requestFor}=require('./nhso-close-rights.cjs');
async function rpc(client,name,args){const r=await client.rpc(name,args);if(r.error||!r.data)throw Error('CLOSE_DATABASE_UNAVAILABLE');return r.data;}
async function loadCloseInput({client,db,intentId,config,now=Date.now(),allowPatientEntitlementFallback=false}){
 const snapshot=await rpc(client,'fit_close_load',{p_intent:intentId});
 const [rows]=await db.execute(`SELECT l.vn,l.screen_date,l.lab_result,p.cid,o.vsttime,
 (SELECT COUNT(*) FROM lab_order b WHERE b.lab_order_number=l.lab_order_number AND b.lab_items_code=10214 AND b.lab_order_result=l.lab_result) labs,
 (SELECT COUNT(*) FROM opitemrece f WHERE f.vn=l.vn AND f.icode='3905544' AND f.qty=1 AND f.unitprice=60 AND f.sum_price=60) fees,
 (SELECT SUM(f.sum_price) FROM opitemrece f WHERE f.vn=l.vn) total,
 (SELECT COUNT(*) FROM visit_pttype v WHERE v.vn=l.vn AND v.pttype='PP') rights,
 (SELECT COUNT(*) FROM nhso_confirm_privilege c WHERE c.vn=l.vn AND c.nhso_status='Y') closed
 FROM survey_fit_import_ledger l JOIN ovst o ON o.vn=l.vn AND o.hn=l.hn AND o.vstdate=l.screen_date JOIN patient p ON p.hn=o.hn
 WHERE l.preparation_id=?`,[snapshot.preparation_id]);
 const row=rows[0],result=snapshot.result==='ปกติ'?'Negative':'Positive';
 if(rows.length!==1||row.vn!==snapshot.vn||row.cid!==snapshot.cid||String(row.screen_date)!==snapshot.screen_date||row.lab_result!==result||Number(row.labs)!==1||Number(row.fees)!==1||Number(row.total)!==60||Number(row.rights)!==1||Number(row.closed)!==0)throw Error('LIVE_VISIT_MISMATCH_OR_ALREADY_CLOSED');
 // Require actual same-day entitlement evidence; PP is not an insurance code.
 let [rights]=await db.execute("SELECT DISTINCT maininscl FROM nhso_authencode WHERE pid=? AND created_date>=? AND created_date<DATE_ADD(?,INTERVAL 1 DAY) AND maininscl IS NOT NULL AND maininscl<>''",[snapshot.cid,snapshot.screen_date,snapshot.screen_date]);
 if((!rights||rights.length===0)&&allowPatientEntitlementFallback){
  const [ptRows]=await db.execute("SELECT DISTINCT COALESCE(NULLIF(TRIM(t.nhso_code),''),TRIM(p.pttype)) AS maininscl FROM patient p LEFT JOIN pttype t ON t.pttype=p.pttype WHERE p.cid=?",[snapshot.cid]);
  if(ptRows?.length===1&&['UCS','WEL','OFC','LGO','SSS','OTH','COR'].includes(ptRows[0].maininscl))rights=ptRows;
 }
 if(rights.length!==1||!['UCS','WEL','OFC','LGO','SSS','OTH','COR'].includes(rights[0].maininscl))throw Error('SAME_DAY_ENTITLEMENT_REQUIRED');
 const serviceDateTime=Date.parse(snapshot.screen_date+'T'+row.vsttime+'+07:00');
 const input={zone:'production',intentId,token:config.token,hcode:config.hcode,department:config.department,sourceId:config.sourceId,
 personalId:snapshot.cid,recorderPid:config.recorders?.[snapshot.actor_id],visitNumber:snapshot.vn,claimServiceCode:'PG0060001',mainInsclCode:rights[0].maininscl,
 serviceDateTime,invoiceDateTime:serviceDateTime,totalAmount:60,paidAmount:0,privilegeAmount:60};
 // Verify paid/privilege amounts in this visit, not just the site fee catalogue.
 const [amounts]=await db.execute('SELECT paid_money,uc_money FROM vn_stat WHERE vn=?',[snapshot.vn]);
 if(amounts.length!==1||Number(amounts[0].paid_money)!==0||Number(amounts[0].uc_money)!==60)throw Error('LIVE_AMOUNT_SPLIT_MISMATCH');
 requestFor({...input,transactionId:config.hcode+'validation'},{allowProduction:true,now});
 return {input,snapshot};
}
function productionLedger(client,snapshot,input){return {
 reserveManualIntent:async(id,hash,owner)=>{
  if(id!==snapshot.intent_id||id!==input.intentId)throw Error('INTENT_MISMATCH');
  return rpc(client,'fit_close_reserve',{p_intent:id,p_expected:snapshot,p_hash:hash,p_owner:owner,p_hcode:input.hcode,p_service:input.claimServiceCode});
 },
 record:async r=>{
  if(r.simulated!==false||r.zone!=='production')throw Error('PRODUCTION_EVIDENCE_REQUIRED');
  return rpc(client,'nhso_close_record',{p_id:r.id,p_owner:r.owner,p_state:r.state,p_seq:r.seq,p_code:r.code});
 }
};}
async function processCloseIntent({client,db,intentId,config,receipts,enabled=false,allowAnyPermittedStaff=false,allowPatientEntitlementFallback=false}){
 if(enabled!==true)throw Error('PRODUCTION_DISABLED');
 // Resolve the protected recorder only from the server-authenticated intent actor.
 // Never accept a recorder ID or actor ID supplied by the browser.
 const initial=await rpc(client,'fit_close_load',{p_intent:intentId});
 const {resolveRecorder}=require('./nhso-recorder.cjs');
 const recorderPid=await resolveRecorder(client,initial.actor_id,{allowAnyPermittedStaff});
 const {input,snapshot}=await loadCloseInput({client,db,intentId,config:{...config,recorders:{[initial.actor_id]:recorderPid}},allowPatientEntitlementFallback});
 const {sendProduction}=require('./nhso-close-production.cjs');
 return sendProduction(input,{enabled:true,receipts,ledger:productionLedger(client,snapshot,input)});
}
async function readHosxpNhsoToken(db){
 try{
  const [rows]=await db.execute(
   "SELECT sys_name, TRIM(sys_value) AS val FROM sys_var WHERE sys_name IN ('NHSO-CONFIRM-PRIVIVLEGE-API-TOKEN','NHSO-CONFIRM-PRIVILEGE-API-TOKEN','NHSO-13FILE-FEE-SCHEDULE-API-TOKEN','Authen_Token') AND sys_value IS NOT NULL AND TRIM(sys_value)<>''"
  );
  const byName=Object.fromEntries((rows||[]).map(r=>[r.sys_name,r.val]));
  return (
   byName['NHSO-CONFIRM-PRIVIVLEGE-API-TOKEN']||
   byName['NHSO-CONFIRM-PRIVILEGE-API-TOKEN']||
   byName['NHSO-13FILE-FEE-SCHEDULE-API-TOKEN']||
   byName['Authen_Token']||
   ''
  );
 }catch{
  return '';
 }
}
async function reconcile({source,db,config}={}){
 const summary={close_sent:0,close_written:0};
 if(!source||!db)return summary;
 const hcode=config?.NHSO_HCODE||'05080';
 let token=String(config?.NHSO_CLOSE_TOKEN||config?.NHSO_TOKEN||'').trim();
 if(!token){
  token=await readHosxpNhsoToken(db);
 }
 const liveEnabled=config?.NHSO_CLOSE_LIVE_ENABLED==='true' && Boolean(token);

 // 1. Process pending fit_close_intents when NHSO_CLOSE_LIVE_ENABLED=true and token is configured
 if(liveEnabled){
  const {protectedKey}=require('./nhso-receipt-key.cjs');
  const {receiptStore}=require('./nhso-close-receipts.cjs');
  const baseDir=path.join(process.env.LOCALAPPDATA||path.join(__dirname,'..'),'Nonsawang','CloseRights');
  const keyFile=path.join(baseDir,'production-receipt.key.dpapi');
  const receiptsDir=path.join(baseDir,'production-receipts');
  const key=protectedKey(keyFile);
  const receipts=receiptStore(receiptsDir,key,{production:true});

  const {data:pendingIntents}=await source
   .from('fit_close_intents')
   .select('id,preparation_id,vn,state')
   .eq('state','pending')
   .order('requested_at',{ascending:true})
   .limit(3);

  for(const intent of pendingIntents||[]){
   try{
    const res=await processCloseIntent({
     client:source,
     db,
     intentId:intent.id,
     config:{
      hcode,
      token,
      department:{code:'048',name:'ฝ่ายส่งเสริมสุขภาพ'},
      sourceId:config?.NHSO_SOURCE_ID||'HOSxP_PCU_05080',
     },
     receipts,
     enabled:true,
     allowAnyPermittedStaff:true,
     allowPatientEntitlementFallback:true,
    });
    if(res.status==='confirmed'){
     await source.from('fit_close_intents').update({state:'confirmed'}).eq('id',intent.id);
     summary.close_sent++;
    }else if(res.status==='outcome_unknown'){
     await source.from('fit_close_intents').update({state:'reconcile'}).eq('id',intent.id);
    }
   }catch{/* keep pending or reserved for operator inspection */}
  }
 }

 // 2. Write confirmed NHSO closure authen_code back to HOSxP visit_pttype.auth_code
 const {writeFitAuth}=require('./hosxp-fit-auth-writeback.cjs');
 const {data:readyIntents}=await source
  .from('fit_close_intents')
  .select('id,preparation_id,vn,state,closure_id')
  .in('state',['reserved','confirmed'])
  .not('closure_id','is',null)
  .limit(10);

 for(const intent of readyIntents||[]){
  try{
   const {data:closure}=await source
    .from('nhso_close_submissions')
    .select('id,state,zone,hcode,visit_number,seq,authen_code')
    .eq('id',intent.closure_id)
    .maybeSingle();
   if(!closure||closure.state!=='confirmed'||!closure.authen_code)continue;
   if(intent.state==='reserved'){
    await source.from('fit_close_intents').update({state:'confirmed'}).eq('id',intent.id);
   }
   const writeRes=await writeFitAuth(db,{
    closure,
    preparationId:intent.preparation_id,
    hcode:closure.hcode||hcode,
    allowProduction:closure.zone==='production',
    isolatedTestDatabase:closure.zone==='test',
   });
   if(writeRes.status==='written'){
    await source.from('fit_close_intents').update({state:'written'}).eq('id',intent.id);
    summary.close_written++;
   }
  }catch{/* retry on next LAN cycle */}
 }

 return summary;
}
module.exports={loadCloseInput,productionLedger,processCloseIntent,readHosxpNhsoToken,reconcile};
