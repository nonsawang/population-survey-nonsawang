const {requestFor}=require('./nhso-close-rights.cjs');
async function rpc(client,name,args){const r=await client.rpc(name,args);if(r.error||!r.data)throw Error('CLOSE_DATABASE_UNAVAILABLE');return r.data;}
async function loadCloseInput({client,db,intentId,config,now=Date.now()}){
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
 const [rights]=await db.execute("SELECT DISTINCT maininscl FROM nhso_authencode WHERE pid=? AND created_date>=? AND created_date<DATE_ADD(?,INTERVAL 1 DAY) AND maininscl IS NOT NULL AND maininscl<>''",[snapshot.cid,snapshot.screen_date,snapshot.screen_date]);
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
async function processCloseIntent({client,db,intentId,config,receipts,enabled=false}){
 if(enabled!==true)throw Error('PRODUCTION_DISABLED');
 // Resolve the protected recorder only from the server-authenticated intent actor.
 // Never accept a recorder ID or actor ID supplied by the browser.
 const initial=await rpc(client,'fit_close_load',{p_intent:intentId});
 const {resolveRecorder}=require('./nhso-recorder.cjs');
 const recorderPid=await resolveRecorder(client,initial.actor_id);
 const {input,snapshot}=await loadCloseInput({client,db,intentId,config:{...config,recorders:{[initial.actor_id]:recorderPid}}});
 const {sendProduction}=require('./nhso-close-production.cjs');
 return sendProduction(input,{enabled:true,receipts,ledger:productionLedger(client,snapshot,input)});
}
module.exports={loadCloseInput,productionLedger,processCloseIntent};
