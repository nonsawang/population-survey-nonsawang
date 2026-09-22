const {randomUUID,createHash}=require('node:crypto');
const {mapping}=require('./hosxp-fit-preflight.cjs');
const {targetCheck}=require('./validate-hosxp-fit-queue.cjs');
const POLICY='fit-visit-20260917';
const guid=()=>'{'+randomUUID().toUpperCase()+'}';
const fail=code=>{throw new Error(code);};
function stamp(now=new Date()) {
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(now).map(x=>[x.type,x.value]));
 return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}:${p.second}`};
}
function payloadHash(job){return createHash('sha256').update(JSON.stringify({id:job.id,history:job.history_id,person:job.person_id,date:job.screen_date,result:job.payload.lab_result,mapping,policy:POLICY})).digest('hex');}
function vnFor(date,time){return String(Number(date.slice(0,4))+543).slice(-2)+date.slice(5,7)+date.slice(8,10)+time.replaceAll(':','');}
async function insert(db,table,values){
 // All identifiers originate in this module, never from a request.
 const keys=Object.keys(values);await db.execute(`INSERT INTO \`${table}\` (${keys.map(k=>'`'+k+'`').join(',')}) VALUES (${keys.map(()=>'?').join(',')})`,Object.values(values));
}
async function serial(db,name){
 const [rows]=await db.execute('SELECT serial_no FROM serial WHERE name=? FOR UPDATE',[name]);
 if(rows.length!==1||!Number.isSafeInteger(Number(rows[0].serial_no)))fail('SERIAL_NOT_CONFIGURED');
 const n=Number(rows[0].serial_no)+1;
 if(n<1||n>2147483647)fail('SERIAL_OUT_OF_RANGE');
 await db.execute('UPDATE serial SET serial_no=? WHERE name=?',[n,name]);return n;
}
async function addFitPP(db,{vn,hn,date,time,result}){
 const code=result==='Negative'?'1B0060':result==='Positive'?'1B0061':null;
 if(!code)fail('INVALID_PP_RESULT');
 const [types]=await db.execute("SELECT pp_special_type_id FROM pp_special_type WHERE pp_special_code=? AND is_active='Y'",[code]);
 if(types.length!==1)fail('PP_MAPPING_CHANGED');
 const [existing]=await db.execute("SELECT p.pp_special_id FROM pp_special p JOIN pp_special_type t ON t.pp_special_type_id=p.pp_special_type_id WHERE p.vn=? AND t.pp_special_code IN ('1B0060','1B0061') FOR UPDATE",[vn]);
 if(existing.length)fail('EXISTING_PP_REQUIRES_REVIEW');
 const id=await serial(db,'pp_special_id');
 await insert(db,'pp_special',{pp_special_id:id,vn,hn,pp_special_type_id:types[0].pp_special_type_id,pp_special_code:code,doctor:mapping.doctor,pp_special_service_place_type_id:1,dest_hospcode:'05080',entry_datetime:date+' '+time,hos_guid:guid()});
 const [saved]=await db.execute('SELECT pp_special_code,doctor,dest_hospcode,pp_special_service_place_type_id,entry_datetime FROM pp_special WHERE pp_special_id=? AND vn=?',[id,vn]);
 if(saved.length!==1||saved[0].pp_special_code!==code||saved[0].doctor!==mapping.doctor||saved[0].dest_hospcode!=='05080'||Number(saved[0].pp_special_service_place_type_id)!==1||saved[0].entry_datetime!==date+' '+time)fail('PP_READBACK_MISMATCH');
}
async function readBack(db,ledger){
 const [rows]=await db.execute(`SELECT o.hn,o.vstdate,o.pttype,o.doctor,o.spclty,o.main_dep,
 h.lab_order_number,h.order_date,l.lab_items_code,l.lab_order_result,
 (SELECT count(*) FROM ovstdiag d WHERE d.vn=o.vn AND d.icd10=? AND d.diagtype='1') dx,
 (SELECT count(*) FROM opitemrece f WHERE f.vn=o.vn AND f.icode=? AND f.qty=1) fee,
 (SELECT count(*) FROM opdscreen s WHERE s.vn=o.vn AND length(trim(s.cc))>0) screen,
 (SELECT count(*) FROM vn_stat s WHERE s.vn=o.vn AND s.hn=o.hn AND s.pdx=?) stat,
 (SELECT count(*) FROM ovst_seq s WHERE s.vn=o.vn) seq
 FROM ovst o JOIN lab_head h ON h.vn=o.vn JOIN lab_order l ON l.lab_order_number=h.lab_order_number
 WHERE o.vn=? AND h.lab_order_number=? AND l.lab_items_code=?`,[mapping.diagnosis,mapping.fee,mapping.diagnosis,ledger.vn,ledger.lab_order_number,mapping.lab]);
 const r=rows[0];
 if(rows.length!==1||r.hn!==ledger.hn||r.vstdate!==ledger.screen_date||r.order_date!==ledger.screen_date||r.pttype!=='PP'||r.doctor!==mapping.doctor||r.spclty!==mapping.specialty||r.main_dep!==mapping.department||r.lab_order_result!==ledger.lab_result||[r.dx,r.fee,r.screen,r.stat,r.seq].some(n=>Number(n)!==1))fail('READBACK_MISMATCH');
 return ledger;
}
async function claimChecks(db,vn){
 const [[fee]]=await db.execute('SELECT billcode,nhso_adp_type_id,nhso_adp_code FROM nondrugitems WHERE icode=?',[mapping.fee]);
 const [rights]=await db.execute("SELECT 1 FROM visit_pttype WHERE vn=? AND pttype='PP' AND length(trim(auth_code))>0 LIMIT 1",[vn]);
 // Finance evidence is diagnostic only: a receipt is NOT proof of valid NDP export.
 const [invoices]=await db.execute("SELECT 1 FROM opitemrece WHERE vn=? AND icode=? AND length(trim(finance_number))>0 LIMIT 1",[vn,mapping.fee]);
 return {mapping:String(fee?.billcode)==='31209'&&Number(fee?.nhso_adp_type_id)===15&&String(fee?.nhso_adp_code)==='31209',auth:rights.length===1,invoice:invoices.length===1,export_verified:false};
}
async function writeVisit(db,{job,person,snapshot,revalidate,now=()=>new Date()}){
 const hash=payloadHash(job),lock='survey-fit:'+job.id;
 const [[acquired]]=await db.execute('SELECT GET_LOCK(?,5) ok',[lock]);
 if(Number(acquired.ok)!==1)fail('IMPORT_BUSY');
 let committed=false;
 try{
  await db.beginTransaction();
  const [old]=await db.execute('SELECT * FROM survey_fit_import_ledger WHERE preparation_id=? FOR UPDATE',[job.id]);
  if(old.length){
   if(old[0].payload_hash!==hash||old[0].policy_version!==POLICY)fail('REPLAY_PAYLOAD_CHANGED');
   await readBack(db,old[0]);await db.commit();committed=true;return {...old[0],replayed:true};
  }
  await revalidate();
  // Lock patient rows before checking identity and existing FIT entries.
  await db.execute('SELECT hn FROM patient WHERE cid=? FOR UPDATE',[person.cid]);
  await db.execute('SELECT person_id FROM person WHERE cid=? FOR UPDATE',[person.cid]);
  const status=await targetCheck(db,person,job.screen_date,snapshot);
  if(status!=='VALIDATED_NOT_IMPORTED')fail(status);
  const [[patient]]=await db.execute('SELECT hn,sex,birthday,cid FROM patient WHERE cid=?',[person.cid]);
  const [[lab]]=await db.execute('SELECT lab_items_name,lab_items_group,active_status,icode,possible_value FROM lab_items WHERE lab_items_code=?',[mapping.lab]);
  const [[group]]=await db.execute('SELECT lab_items_group_name FROM lab_items_group WHERE lab_items_group_code=?',[lab?.lab_items_group]);
  if(!group?.lab_items_group_name)fail('LAB_FORM_MISSING');
  const [[fee]]=await db.execute('SELECT name,price,income,istatus,paidst,unitcost,billcode,nhso_adp_type_id,nhso_adp_code FROM nondrugitems WHERE icode=?',[mapping.fee]);
  if(fee?.income!=='07'||String(fee.billcode)!=='31209'||Number(fee.nhso_adp_type_id)!==15||String(fee.nhso_adp_code)!=='31209')fail('FIT_BILLING_MAPPING_CHANGED');
  const [[right]]=await db.execute('SELECT paidst,pcode,isuse FROM pttype WHERE pttype=?',['PP']);
  if(lab?.active_status!=='Y'||lab.icode!==mapping.fee||!String(lab.possible_value).split(/\r?\n/).includes(job.payload.lab_result)||fee?.istatus!=='Y'||Number(fee.price)!==60||fee.paidst!=='02'||right?.isuse!=='Y'||right.paidst!=='02')fail('CATALOG_CHANGED');
  const at=stamp(now()),vn=vnFor(job.screen_date,at.time),hn=patient.hn,date=job.screen_date;
  const [[exists]]=await db.execute('SELECT count(*) n FROM ovst WHERE vn=?',[vn]);if(Number(exists.n))fail('VN_COLLISION_RETRY');
  const labNumber=await serial(db,'lab_order_number'),diagNumber=await serial(db,'ovst_diag_id'),seqNumber=await serial(db,'ovst_seq_id');
  const [[age]]=await db.execute('SELECT TIMESTAMPDIFF(YEAR,?,?) y,TIMESTAMPDIFF(MONTH,?,?) % 12 m,DATEDIFF(?,DATE_ADD(?,INTERVAL TIMESTAMPDIFF(MONTH,?,?) MONTH)) d',[patient.birthday,date,patient.birthday,date,date,patient.birthday,patient.birthday,date]);
  if(age.y<0)fail('INVALID_BIRTH_DATE');
  const common={vn,hn,vstdate:date,vsttime:at.time};
  // Match the local One Stop Service visit classification; NULL is not 'N'.
  await insert(db,'ovst',{...common,hos_guid:guid(),doctor:mapping.doctor,pttype:'PP',spclty:mapping.specialty,main_dep:mapping.department,cur_dep:mapping.department,ovstist:'01',ovstost:'99',visit_type:'I',pt_subtype:1});
  await insert(db,'ovst_seq',{vn,seq_id:seqNumber,hos_guid:guid(),pcu_person_id:Number(snapshot.hosxp_person_id),register_depcode:mapping.department,promote_visit:'N'});
  await insert(db,'opdscreen',{...common,hos_guid:guid(),cc:'คัดกรองมะเร็งลำไส้ใหญ่และลำไส้ตรง (FIT)',screen_dep:mapping.department});
  await insert(db,'ovstdiag',{...common,ovst_diag_id:diagNumber,hos_guid:guid(),icd10:mapping.diagnosis,diagtype:'1',doctor:mapping.doctor});
  await insert(db,'vn_stat',{vn,hn,vstdate:date,hos_guid:guid(),pdx:mapping.diagnosis,dx_doctor:mapping.doctor,pttype:'PP',pcode:right.pcode,spclty:mapping.specialty,sex:patient.sex,age_y:age.y,age_m:age.m,age_d:age.d,cid:patient.cid,income:Number(fee.price),item_money:Number(fee.price),uc_money:Number(fee.price),inc_nondrug:Number(fee.price),paid_money:0,remain_money:0});
  await insert(db,'visit_pttype',{vn,pttype:'PP',pttype_number:1,hos_guid:guid()});
  await insert(db,'lab_head',{vn,hn,lab_order_number:labNumber,hos_guid:guid(),lab_order_number_guid:guid(),doctor_code:mapping.doctor,lab_items_group_code:lab.lab_items_group,department:'OPD',form_name:group.lab_items_group_name,order_date:date,order_time:at.time,report_date:date,order_department:mapping.department,spclty:mapping.specialty,order_note:'Survey FIT '+job.id,item_count:1,confirm_report:'N'});
  // Preserve the reviewed result, without fabricating lab certification or specimen receipt.
  await insert(db,'lab_order',{lab_order_number:labNumber,lab_items_code:mapping.lab,lab_order_result:job.payload.lab_result,lab_items_name_ref:lab.lab_items_name,lab_order_remark:'Survey history '+job.history_id,hos_guid:guid(),order_type:'A',confirm:'N'});
  await insert(db,'opitemrece',{...common,hos_guid:guid(),icode:mapping.fee,qty:1,unitprice:Number(fee.price),sum_price:Number(fee.price),cost:Number(fee.unitcost||0),doctor:mapping.doctor,pttype:'PP',paidst:right.paidst,income:fee.income,item_type:'P',sub_type:'3',dep_code:mapping.department,rxdate:date,rxtime:at.time});
  const ledger={preparation_id:job.id,payload_hash:hash,vn,hn,screen_date:date,lab_order_number:labNumber,lab_result:job.payload.lab_result,imported_at:at.date+' '+at.time,policy_version:POLICY};
  await addFitPP(db,{vn,hn,date,time:at.time,result:job.payload.lab_result});
  await insert(db,'survey_fit_import_ledger',ledger);
  await readBack(db,ledger);await revalidate();
  await db.commit();committed=true;return {...ledger,replayed:false};
 }finally{
  if(!committed)await db.rollback();
  await db.execute('SELECT RELEASE_LOCK(?)',[lock]);
 }
}
module.exports={POLICY,stamp,payloadHash,vnFor,serial,readBack,claimChecks,writeVisit,addFitPP};
