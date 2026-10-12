const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
(async()=>{const db=new PGlite();try{
await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE TABLE app_users(id uuid PRIMARY KEY,role text,is_active boolean);CREATE FUNCTION app_current_user() RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('userId',nullif(current_setting('test.actor',true),'')) $$;`);
await db.exec(fs.readFileSync(path.join(__dirname,'../migrations/20261009_nhso_close_permissions.sql'),'utf8'));
const id='00000000-0000-4000-8000-000000000001';
await db.query('INSERT INTO app_users VALUES($1,$2,true)',[id,'staff']);
await db.query("SELECT set_config('test.actor',$1,false)",[id]);
const allowed=async()=> (await db.query('SELECT nhso_close_allowed() AS ok')).rows[0].ok;
assert.equal(await allowed(),false);
await db.query('INSERT INTO nhso_close_permissions(user_id,enabled) VALUES($1,true)',[id]);
assert.equal(await allowed(),true);
await db.exec("UPDATE app_users SET role='admin'");assert.equal(await allowed(),true);
await db.exec("UPDATE app_users SET role='vhv'");assert.equal(await allowed(),false);
await db.exec("UPDATE app_users SET role='staff',is_active=false");assert.equal(await allowed(),false);
await db.exec('SET ROLE authenticated');
await assert.rejects(()=>db.exec('UPDATE nhso_close_permissions SET enabled=true'),/permission denied/);
console.log('PASS: explicit staff/admin permission, inactive denial, no client self-grant');
}finally{await db.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
