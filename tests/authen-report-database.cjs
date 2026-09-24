const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const db=new PGlite();try{
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
 CREATE TABLE app_users(id uuid PRIMARY KEY);
 CREATE TABLE activity_logs(user_id uuid,username text,action text,details text,target_id text);
 CREATE FUNCTION app_current_user() RETURNS jsonb LANGUAGE sql AS $$ SELECT coalesce(nullif(current_setting('test.actor',true),''),'null')::jsonb $$;`);
 await db.exec(fs.readFileSync(path.join(__dirname,'../migrations/20260923_authen_report.sql'),'utf8'));
 await db.exec(fs.readFileSync(path.join(__dirname,'../migrations/20260924_authen_fit_source.sql'),'utf8'));
 const actor='00000000-0000-0000-0000-000000000001';await db.query('INSERT INTO app_users VALUES($1)',[actor]);
 const setActor=async role=>{await db.exec('RESET ROLE');await db.query("SELECT set_config('test.actor',$1,false)",[JSON.stringify({userId:actor,username:'tester',role})]);await db.exec('SET ROLE anon');};
 await setActor('vhv');await assert.rejects(()=>db.query('SELECT authen_report_list()'),/STAFF_REQUIRED/);
 await setActor('staff');await assert.rejects(()=>db.query('SELECT * FROM authen_report_batches'),/permission denied/);
 await db.exec('RESET ROLE');const {rows:[b]}=await db.query(`INSERT INTO authen_report_batches(file_hash,uploaded_by,rows,state,results,checked_at) VALUES($1,$2,'[{}]','matched',$3,now()) RETURNING id`,['a'.repeat(64),actor,JSON.stringify([{row:2,status:'matched',fingerprint:'good',vn:null,matchVersion:'fit-source-v1',fitPreparationId:'prep'}])]);
 await setActor('staff');assert.equal((await db.query('SELECT authen_report_list() AS r')).rows[0].r.length,1);
 const accept=(items,confirm=true)=>db.query('SELECT authen_report_accept($1,$2,$3) AS r',[b.id,JSON.stringify(items),confirm]);
 await assert.rejects(()=>accept([{row:2,fingerprint:'good'}],false),/REPORT_CONFIRM_REQUIRED/);
 await assert.rejects(()=>accept([{row:2,fingerprint:'bad'}]),/REPORT_CHANGED/);
 await assert.rejects(()=>accept([{row:99,fingerprint:'good'}]),/REPORT_CHANGED/);
 const result=(await accept([{row:2,fingerprint:'good'}])).rows[0].r;assert.equal(result.accepted,1);assert.equal(result.hosxp_written,false);
 assert.equal((await accept([{row:2,fingerprint:'good'}])).rows[0].r.accepted,1);
 await assert.rejects(()=>db.query('SELECT authen_report_refresh($1)',[b.id]),/REPORT_REFRESH_NOT_ALLOWED/);
 await db.exec('RESET ROLE');await db.query("UPDATE authen_report_batches SET checked_at=now()-interval '25 hours' WHERE id=$1",[b.id]);
 await setActor('staff');await assert.rejects(()=>accept([{row:2,fingerprint:'good'}]),/REPORT_REFRESH_REQUIRED/);
 console.log('PASS: migration SQL, role enforcement, private rows, confirmation, fingerprint, idempotence, stale snapshots and queued approval');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
