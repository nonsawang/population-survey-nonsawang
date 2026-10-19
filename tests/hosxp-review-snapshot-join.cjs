const {PGlite}=require('@electric-sql/pglite');
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
(async()=>{
 const db=new PGlite();
 await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE TABLE population(person_id text,cid text,title text,fname text,lname text,moo text,house text,updated_at timestamptz,residency_type text,person_discharge_id integer,status_model_version integer);");
 await db.exec(fs.readFileSync(path.join(__dirname,'../migrations/20260907_hosxp_review.sql'),'utf8'));
 await db.exec(`INSERT INTO population SELECT i::text,'1234567890121','','fixture',i::text,'1','1',now(),'1',9,1 FROM generate_series(1,5)i;
 INSERT INTO population VALUES('unique','1101700207030','','fixture','unique','1','1',now(),'1',9,1);
 INSERT INTO hosxp_review_batches VALUES('old','test',now()-interval '2 days',2,now()),('new','test',now(),2,now()),('incomplete','test',now()+interval '1 hour',2,NULL);
 INSERT INTO hosxp_review_snapshot VALUES('old','unique','1101700207030','1','9','old'),('new','unique','1101700207030','3','9','new'),('new','1','1234567890121','1','9','new');`);
 const before=(await db.query('SELECT to_jsonb(v) r FROM hosxp_review_candidates v ORDER BY population_id')).rows;
 await db.exec(fs.readFileSync(path.join(__dirname,'../migrations/20261019_hosxp_review_snapshot_join.sql'),'utf8'));
 const after=(await db.query('SELECT to_jsonb(v) r FROM hosxp_review_candidates v ORDER BY population_id')).rows;
 assert.deepEqual(after,before);assert.equal(after.length,6);assert.ok(after.every(x=>x.r.batch_id==='new'));
 await db.exec('UPDATE hosxp_review_batches SET completed_at=NULL');
 assert.ok((await db.query('SELECT review_status FROM hosxp_review_candidates')).rows.every(x=>x.review_status==='no_snapshot'));
 await db.exec('SET ROLE anon');await assert.rejects(()=>db.query('SELECT * FROM hosxp_review_candidates'));
 await db.close();console.log('PASS: identical rows/fingerprints/status; latest complete snapshot; no snapshot; denied direct anon access');
})().catch(e=>{console.error(e);process.exitCode=1});
