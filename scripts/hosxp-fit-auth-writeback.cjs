// Accept closure evidence only from a trusted ledger loader, never browser JSON.
// Isolated-test adapter until the authenticated production workflow is connected.
async function writeFitAuth(db, {closure, preparationId, hcode, isolatedTestDatabase=false}) {
 if(!isolatedTestDatabase)throw Error('AUTH_WRITEBACK_LIVE_DISABLED');
 if(closure?.state!=='confirmed'||closure.zone!=='test'||closure.hcode!==hcode||
    !closure.id||!closure.seq||!closure.visit_number||
    typeof closure.authen_code!=='string'||!closure.authen_code.trim()||
    closure.authen_code.length>20||/\s/.test(closure.authen_code))throw Error('CONFIRMED_CLOSURE_REQUIRED');
 const [engines]=await db.execute("SELECT ENGINE FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('visit_pttype','survey_fit_import_ledger')");
 if(engines.length!==2||engines.some(r=>r.ENGINE!=='InnoDB'))throw Error('TRANSACTION_ENGINE_REQUIRED');
 await db.beginTransaction();
 let committed=false;
 try {
  const [imports]=await db.execute('SELECT vn FROM survey_fit_import_ledger WHERE preparation_id=? FOR UPDATE',[preparationId]);
  if(imports.length!==1||imports[0].vn!==closure.visit_number)throw Error('FIT_VISIT_MISMATCH');
  const [rights]=await db.execute("SELECT auth_code FROM visit_pttype WHERE vn=? AND pttype='PP' FOR UPDATE",[closure.visit_number]);
  if(rights.length!==1)throw Error('FIT_RIGHT_ROW_AMBIGUOUS');
  const previous=rights[0].auth_code;
  const replayed=previous===closure.authen_code;
  if(previous!==null&&previous!==''&&!replayed)throw Error('EXISTING_AUTH_CODE_CONFLICT');
  if(!replayed){
   const [result]=await db.execute("UPDATE visit_pttype SET auth_code=? WHERE vn=? AND pttype='PP' AND (auth_code IS NULL OR auth_code='')",[closure.authen_code,closure.visit_number]);
   if(result.affectedRows!==1)throw Error('AUTH_WRITE_COUNT_MISMATCH');
  }
  const [saved]=await db.execute("SELECT auth_code FROM visit_pttype WHERE vn=? AND pttype='PP' FOR UPDATE",[closure.visit_number]);
  if(saved.length!==1||saved[0].auth_code!==closure.authen_code)throw Error('AUTH_READBACK_MISMATCH');
  await db.commit();committed=true;
  return {status:'written',replayed,closureId:closure.id,retryCloseAllowed:false,exportVerified:false};
 } finally {if(!committed)await db.rollback();}
}
module.exports={writeFitAuth};
