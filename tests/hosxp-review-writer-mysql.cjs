const mysql=require('mysql2/promise'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {randomUUID}=require('node:crypto');
const {writeApproved,dispatch,recoverReceipt}=require('../scripts/hosxp-review-writer.cjs');
const config={host:'127.0.0.1',port:33317,user:'root',password:'local-fixture-only',dateStrings:true,connectTimeout:3000};
(async()=>{
 const db=await mysql.createConnection(config);
 try{
 const database='person_review_test_'+Date.now();await db.query('CREATE DATABASE `'+database+'`');await db.query('USE `'+database+'`');
 await db.query('CREATE TABLE person(person_id INT PRIMARY KEY,cid VARCHAR(13),house_regist_type_id INT,person_discharge_id INT,last_update DATETIME) ENGINE=InnoDB');
 await db.query(fs.readFileSync(path.join(__dirname,'../scripts/hosxp-review-receipts.sql'),'utf8').replace(/^\uFEFF/,''));
 await db.query("INSERT INTO person VALUES(1,'1234567890121',1,9,'2026-01-01 00:00:00')");
 const job=()=>({id:randomUUID(),fingerprint:'a'.repeat(64),target_person_id:'1',cid:'1234567890121',old_values:{house_regist_type_id:'1',person_discharge_id:'9',last_update:'2026-01-01 00:00:00'},changes:{house_regist_type_id:3}});
 await assert.rejects(dispatch({db,client:{},id:'x'}),/DISPATCH_DISABLED/);
 await assert.rejects(writeApproved(db,{...job(),target_person_id:'2'}),/IDENTITY_CONFLICT/);
 await assert.rejects(writeApproved(db,{...job(),old_values:{...job().old_values,house_regist_type_id:2}}),/BASELINE_CHANGED/);
 await db.query("INSERT INTO person VALUES(2,'1234567890121',1,9,NULL)");
 await assert.rejects(writeApproved(db,job()),/IDENTITY_CONFLICT/);await db.query('DELETE FROM person WHERE person_id=2');
 const j=job();await writeApproved(db,j);
 await assert.rejects(recoverReceipt(db,{rpc:async()=>({error:true})},j.id,j.fingerprint),/ACK_PENDING/);
 assert.equal((await recoverReceipt(db,{rpc:async()=>({})},j.id,j.fingerprint)).status,'sent');
 await assert.rejects(writeApproved(db,j),e=>e.code==='ER_DUP_ENTRY');
 const [rows]=await db.query('SELECT house_regist_type_id FROM person');assert.equal(rows[0].house_regist_type_id,3);
 const [counts]=await db.query('SELECT COUNT(*) n FROM survey_person_review_receipts');assert.equal(counts[0].n,1);
 await assert.rejects(recoverReceipt(db,{},randomUUID(),'a'.repeat(64)),/RECONCILIATION_REQUIRED/);
 console.log('PASS: disabled default, identity/duplicate CID/baseline conflict rollback, atomic receipt, failed acknowledgement recovery, duplicate write blocked, missing receipt held');
 console.log('Isolated database: '+database);
 }finally{await db.end();}
})().catch(e=>{console.error(e.code||e.message);process.exitCode=1;});
