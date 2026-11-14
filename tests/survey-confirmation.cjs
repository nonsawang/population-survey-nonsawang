const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const db=new PGlite();
 try {
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA app_private;
 CREATE TABLE app_users(id uuid PRIMARY KEY);
 CREATE TABLE population(person_id text PRIMARY KEY,moo text,house text,vhv text,title text,fname text,lname text,
 latitude double precision,longitude double precision,relation text,chronic text,residency_type text,person_discharge_id integer,status_model_version integer);
 CREATE FUNCTION app_current_user() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.actor',true),'')::jsonb $$;
 INSERT INTO app_users VALUES ('11111111-1111-4111-8111-111111111111');
 INSERT INTO population VALUES ('p1','1','24/1','สมศรี','นาง','สมใจ','ทดสอบ',NULL,NULL,'ผู้อาศัย','ปกติ (ไม่มีโรค)','1',9,1),
 ('p2','2','10','สมศรี','นาย','สมใจ','ทดสอบ',NULL,NULL,'ผู้อาศัย','-','1',9,1),
 ('p3','1','24/1','คนอื่น','นาย','อื่น','ทดสอบ',NULL,NULL,'ผู้อาศัย','-','1',9,1);`);
 const sql=fs.readFileSync('migrations/20261113_survey_confirmation.sql','utf8');
 await db.exec(sql); await db.exec(sql);
 const actor={userId:'11111111-1111-4111-8111-111111111111',role:'vhv',displayName:'สมศรี',moo:'1',username:'test'};
 const setActor=a=>db.query("SELECT set_config('test.actor',$1,false)",[JSON.stringify(a)]);
 await setActor(actor);
 const list=async()=> (await db.query('SELECT survey_progress_list() data')).rows[0].data;
 let rows=await list();assert.equal(rows.length,1);assert.equal(rows[0].status,'notStarted');assert.equal(rows[0].cid,undefined);
 const snap=rows[0].expected;
 await db.query('SELECT survey_confirm_person($1,$2)', ['p1',snap]);
 await db.query('SELECT survey_confirm_person($1,$2)', ['p1',snap]);
 assert.equal((await db.query('SELECT count(*)::int n FROM survey_person_reviews')).rows[0].n,1);
 rows=await list();assert.equal(rows[0].status,'complete');assert.equal(rows[0].reviewed_by,'สมศรี');
 await db.exec("UPDATE population SET chronic='เบาหวาน (DM)' WHERE person_id='p1'");
 assert.equal((await list())[0].status,'partial');
 await assert.rejects(db.query('SELECT survey_confirm_person($1,$2)',['p1',snap]),/SURVEY_CHANGED/);
 await assert.rejects(db.query('SELECT survey_confirm_person($1,$2)',['p3',snap]),/SURVEY_FORBIDDEN/);
 await setActor({...actor,role:'manager'});assert.equal((await list()).length,0);
 await assert.rejects(db.query('SELECT survey_confirm_person($1,$2)',['p1',snap]),/SURVEY_FORBIDDEN/);
 await setActor({...actor,role:'staff'});
 rows=await list(); const incomplete=rows.find(r=>r.person_id==='p2');
 await assert.rejects(db.query('SELECT survey_confirm_person($1,$2)',['p2',incomplete.expected]),/SURVEY_INCOMPLETE/);
 await db.exec('SET ROLE anon');
 await assert.rejects(db.exec('SELECT * FROM survey_person_reviews'),/permission denied/);
 await assert.rejects(db.exec("UPDATE survey_person_reviews SET confirmed=true"),/permission denied/);
 await db.exec('RESET ROLE');
 const {surveyHouses,surveyLink,summarizeSurveyMembers,inProgressScope}=await import('../lib/survey-progress.mjs');
 const houses=surveyHouses(rows);
 assert.equal(houses.reduce((n,h)=>n+h.members.length,0),3);
 const h24=houses.find(h=>h.house==='24/1');
 assert.equal(h24.status,'partial');
 assert.equal(h24.notStartedCount,1);
 assert.equal(h24.incompleteCount,1);
 assert.equal(h24.awaitingConfirmCount,1);
 assert.equal(inProgressScope({status_model_version:0,residency_type:'0',person_discharge_id:null}),true);
 assert.equal(inProgressScope({status_model_version:1,residency_type:'1',person_discharge_id:null}),true);
 assert.equal(inProgressScope({status_model_version:1,residency_type:'1',person_discharge_id:1}),false);
 assert.equal(inProgressScope({status_model_version:1,residency_type:'4',person_discharge_id:9}),false);
 assert.equal(summarizeSurveyMembers(h24.members).pending,2);
 assert.equal(new URL(surveyLink('1','24/1','p1'),'http://test').searchParams.get('person'),'p1');
 console.log('PASS: migration rerun, no imported auto-confirm, scope, required fields, snapshot conflict, edit invalidation, idempotency, evidence access, house grouping and links');
 } finally {await db.close();}
})().catch(e=>{console.error(e);process.exit(1);});
