// Read-only catalog verification. Never creates visits or allocates serials.
const path = require('node:path');
const {readConfig} = require('./refresh-hosxp-review.cjs');
const mysql = require('mysql2/promise');
const mapping = Object.freeze({lab:10214,fee:'3905544',department:'048',specialty:'15',doctor:'0029',diagnosis:'Z121'});
function verify(catalog) {
  const issues=[];
  const exact=(rows,check,label)=>{if(rows.length!==1||!check(rows[0]))issues.push(label);};
  exact(catalog.lab,r=>r.active_status==='Y'&&r.icode===mapping.fee&&r.lab_items_name.trim().toLowerCase()==='fit test'&&['Negative','Positive'].every(v=>String(r.possible_value).split(/\r?\n/).map(x=>x.trim()).includes(v)),'FIT_LAB_MAPPING');
  exact(catalog.fee,r=>r.istatus==='Y'&&/fit test/i.test(r.name),'FIT_FEE_MAPPING');
  exact(catalog.department,r=>r.department.trim()==='ฝ่ายส่งเสริมสุขภาพ','DEPARTMENT_MAPPING');
  exact(catalog.specialty,r=>r.name.replace(/\s/g,'')==='อื่นๆ','SPECIALTY_MAPPING');
  exact(catalog.doctor,r=>r.name.trim()==='กฤตพล'&&r.active==='Y','DOCTOR_MAPPING');
  exact(catalog.diagnosis,r=>r.code===mapping.diagnosis,'DIAGNOSIS_MAPPING');
  for(const name of ['ovst','vn_stat','lab_head','lab_order','opitemrece','ovstdiag','serial']) {
    if(!catalog.engines.some(r=>r.table_name===name&&r.engine==='InnoDB'))issues.push('TRANSACTION_ENGINE_'+name);
  }
  return {mode:'read_only',catalogVerified:issues.length===0,importEnabled:false,mapping,issues};
}
async function inspect(config) {
  const db=await mysql.createConnection({host:config.HOSXP_DB_HOST,port:Number(config.HOSXP_DB_PORT||3306),user:config.HOSXP_DB_USER,password:config.HOSXP_DB_PASSWORD,database:config.HOSXP_DB_NAME,connectTimeout:8000});
  try {
    await db.query('START TRANSACTION READ ONLY');
    const queries={
      lab:['SELECT lab_items_name,icode,active_status,possible_value FROM lab_items WHERE lab_items_code=?',[mapping.lab]],
      fee:['SELECT name,istatus FROM nondrugitems WHERE icode=?',[mapping.fee]],
      department:['SELECT department FROM kskdepartment WHERE depcode=?',[mapping.department]],
      specialty:['SELECT name FROM spclty WHERE spclty=?',[mapping.specialty]],
      doctor:['SELECT name,active FROM doctor WHERE code=?',[mapping.doctor]],
      diagnosis:['SELECT code FROM icd101 WHERE code=?',[mapping.diagnosis]],
      engines:["SELECT table_name,engine FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('ovst','vn_stat','lab_head','lab_order','opitemrece','ovstdiag','serial')",[]]
    };
    const catalog={};
    for(const [key,[sql,args]] of Object.entries(queries)){const [rows]=await db.execute(sql,args);catalog[key]=rows;}
    return verify(catalog);
  } finally {await db.rollback();await db.end();}
}
if(require.main===module)inspect(readConfig(path.resolve(__dirname,'../.env.sync'))).then(report=>{
  console.log(JSON.stringify(report,null,2));if(!report.catalogVerified)process.exitCode=2;
}).catch(()=>{console.error('HOSXP_PREFLIGHT_FAILED: ตรวจการเชื่อมต่อและสิทธิ์อ่านฐานข้อมูล');process.exitCode=1;});
module.exports={mapping,verify,inspect};
