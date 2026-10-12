const mysql=require('mysql2/promise'),assert=require('node:assert/strict');
const {processAuthJob}=require('../scripts/hosxp-fit-auth-queue.cjs');
const config={host:'127.0.0.1',port:33317,user:'root',password:'local-fixture-only',connectTimeout:5000};
const database='fit_auth_test_'+Date.now();let admin;const connections=[];
const evidence={id:'closure',state:'confirmed',zone:'test',hcode:'05080',visit_number:'fixture-vn',seq:'fixture-seq',authen_code:'fixture-auth'};
const job={id:'job',closure_id:'closure',preparation_id:'preparation',state:'pending'};
function client({failAck=false,closure=evidence}={}){return {from(table){let update=false;return {select(){return this},eq(){return this},single:async()=>({data:table==='fit_auth_writeback_queue'?job:closure}),update(){update=true;return this},then(resolve,reject){return Promise.resolve(update?(failAck?{error:true}:{data:[{id:'job'}]}):{}).then(resolve,reject)}}}}}
async function connection(){const db=await mysql.createConnection({...config,database});connections.push(db);return db;}
async function run(db,c=client()){return processAuthJob({client:c,db,jobId:'job',hcode:'05080',isolatedTestDatabase:true});}
(async()=>{
 admin=await mysql.createConnection(config);await admin.query('CREATE DATABASE `'+database+'`');await admin.query('USE `'+database+'`');
 await admin.query('CREATE TABLE survey_fit_import_ledger (preparation_id VARCHAR(50) PRIMARY KEY,vn VARCHAR(30)) ENGINE=InnoDB');
 await admin.query('CREATE TABLE visit_pttype (vn VARCHAR(30),pttype VARCHAR(2),auth_code VARCHAR(20),PRIMARY KEY(vn,pttype)) ENGINE=InnoDB');
 await admin.query("INSERT INTO survey_fit_import_ledger VALUES ('preparation','fixture-vn')");
 await admin.query("INSERT INTO visit_pttype VALUES ('fixture-vn','PP',NULL)");
 const db=await connection();assert.equal((await run(db,client({failAck:true}))).status,'ack_pending');
 assert.equal((await run(db)).replayed,true);
 console.log('PASS: real MariaDB write + failed queue acknowledgement + replay');
 await admin.query('UPDATE visit_pttype SET auth_code=NULL');
 const workers=await Promise.all(Array.from({length:8},()=>connection()));
 const results=await Promise.all(workers.map(d=>run(d)));assert.equal(results.filter(x=>!x.replayed).length,1);
 console.log('PASS: 8 concurrent connections, exactly one initial write');
 await assert.rejects(run(db,client({closure:{...evidence,state:'reserved'}})),/CONFIRMED/);
 await assert.rejects(run(db,client({closure:{...evidence,visit_number:'wrong'}})),/VISIT/);
 await assert.rejects(run(db,client({closure:{...evidence,authen_code:'different'}})),/CONFLICT/);
 console.log('PASS: pending evidence, wrong visit and conflicting code blocked');
 const lost={execute:db.execute.bind(db),beginTransaction:db.beginTransaction.bind(db),rollback:db.rollback.bind(db),commit:async()=>{await db.commit();throw Error('LOST_ACK')}};
 await admin.query('UPDATE visit_pttype SET auth_code=NULL');
 await assert.rejects(run(lost),/LOST_ACK/);assert.equal((await run(db)).replayed,true);
 console.log('PASS: real commit then lost acknowledgement recovers without second write');
 console.log('DATABASE '+database+'; no NHSO requests; evidence/queue client simulated');
})().catch(e=>{console.error(e.code||e.message);process.exitCode=1}).finally(async()=>{await Promise.all(connections.map(c=>c.end()));if(admin)await admin.end()});
