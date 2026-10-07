// Selected read-only trial. Token stays local; stdout contains no identifiers or codes.
const {checkStatus}=require('./nhso-authen-status.cjs');
(async()=>{
 if(process.env.NHSO_KIOSK_TOKEN_CONFIRMED!=='yes')throw Error('KIOSK_TOKEN_CONFIRMATION_REQUIRED');
 const token=process.env.NHSO_KIOSK_TOKEN;
 if(!token)throw Error('AUTHEN_TOKEN_REQUIRED');
 const c=require('./refresh-hosxp-review.cjs').readConfig(require('node:path').resolve(__dirname,'../.env.sync'));
 const db=await require('mysql2/promise').createConnection({host:c.HOSXP_DB_HOST,port:Number(c.HOSXP_DB_PORT||3306),user:c.HOSXP_DB_USER,password:c.HOSXP_DB_PASSWORD,database:c.HOSXP_DB_NAME,dateStrings:true,connectTimeout:10000});
 let row,existing=[];
 try{
  await db.query('START TRANSACTION READ ONLY');
  const [rows]=await db.execute('SELECT o.hn,o.vstdate,p.cid FROM ovst o JOIN patient p ON p.hn=o.hn WHERE o.vn=?',['690911103821']);
  if(rows.length!==1||rows[0].hn!=='0006422'||rows[0].vstdate!=='2026-09-22')throw Error('VISIT_IDENTITY_OR_DATE_MISMATCH');
  row=rows[0];
  const [codes]=await db.execute('SELECT auth_code FROM visit_pttype WHERE vn=?',['690911103821']);
  existing=codes.map(r=>String(r.auth_code||'').trim()).filter(Boolean);
 }finally{await db.rollback();await db.end();}
 // No service filter until the FIT code has been independently confirmed.
 const result=await checkStatus({zone:'production',token,personalId:String(row.cid).trim(),serviceDate:row.vstdate,hcode:'05080'});
 console.log(JSON.stringify({status:result.status,matchedCount:result.matches.length,serviceCodes:[...new Set(result.matches.map(r=>r.serviceCode))],matchesExistingCode:result.matches.some(r=>existing.includes(r.claimCode)),checkedAt:result.checkedAt,cancellationStatus:result.cancellationStatus,writeAllowed:false}));
})().catch(e=>{console.error(/^[A-Z_]+$/.test(e.message)?e.message:'AUTHEN_READONLY_TRIAL_FAILED');process.exitCode=1;});
