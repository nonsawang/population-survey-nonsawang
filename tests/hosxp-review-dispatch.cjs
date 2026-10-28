const {PGlite}=require('@electric-sql/pglite'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const db=new PGlite();try{
 await db.exec('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE TABLE population(person_id text,cid text,title text,fname text,lname text,moo text,house text,updated_at timestamptz,residency_type text,person_discharge_id integer,status_model_version integer)');
 for(const name of ['20260907_hosxp_review.sql','20261019_hosxp_review_snapshot_join.sql','20261022_hosxp_review_dispatch.sql'])await db.exec(fs.readFileSync(path.join(__dirname,'../migrations',name),'utf8'));
 await db.exec(`INSERT INTO population VALUES('web','1234567890121','','fixture','','1','1',now(),'3',9,1);
 INSERT INTO hosxp_review_batches VALUES('test','test',now(),1,now());
 INSERT INTO hosxp_review_snapshot VALUES('test','1','1234567890121','1','9','2026-01-01 00:00:00');
 INSERT INTO hosxp_review_approvals(population_id,target_person_id,batch_id,fingerprint,old_values,changes,approved_by) SELECT population_id,target_id,batch_id,fingerprint,'{}',changes,'fixture' FROM hosxp_review_candidates;`);
 const id=(await db.query('SELECT id FROM hosxp_review_approvals')).rows[0].id;
 await db.exec("UPDATE population SET residency_type='2'");
 await assert.rejects(db.query('SELECT hosxp_review_reserve($1)',[id]),/REVIEW_CHANGED/);
 await db.exec("UPDATE population SET residency_type='3'");
 const job=(await db.query('SELECT hosxp_review_reserve($1) job',[id])).rows[0].job;assert.equal(job.cid,'1234567890121');
 await assert.rejects(db.query('SELECT hosxp_review_reserve($1)',[id]),/unique|duplicate/);
 await db.query("SELECT hosxp_review_finish($1,'sent')",[id]);await db.query("SELECT hosxp_review_finish($1,'sent')",[id]);
 await assert.rejects(db.query("SELECT hosxp_review_finish($1,'failed')",[id]),/OUTCOME_CONFLICT/);
 for(const role of ['anon','authenticated']){await db.exec('SET ROLE '+role);await assert.rejects(db.query('SELECT hosxp_review_reserve($1)',[id]),/permission denied/);await db.exec('RESET ROLE');}
 console.log('PASS: migration, changed source rejected, one reservation, idempotent acknowledgement, immutable outcome, browser roles denied');
 }finally{await db.close();}})().catch(e=>{console.error(e.message);process.exitCode=1});
