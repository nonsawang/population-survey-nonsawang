const {PGlite}=require('@electric-sql/pglite'),fs=require('fs'),assert=require('node:assert/strict'),{randomUUID}=require('crypto');
(async()=>{const db=new PGlite();try{
await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE FUNCTION app_current_user() RETURNS jsonb LANGUAGE sql AS $$SELECT '{"role":"staff","userId":"test"}'::jsonb$$;
CREATE TABLE house_gps_batches(id uuid PRIMARY KEY,captured_at timestamptz DEFAULT now(),completed_at timestamptz);
CREATE TABLE house_gps_snapshot(batch_id uuid REFERENCES house_gps_batches,house_id text,village_id text,moo text,address text,latitude text,longitude text,PRIMARY KEY(batch_id,house_id));
CREATE TABLE house_gps_queue(reference_captured_at timestamptz);`);
await db.exec(fs.readFileSync('migrations/20261115_house_gps_refresh.sql','utf8'));
await db.exec(fs.readFileSync('migrations/20261115_house_gps_snapshot_storage.sql','utf8'));
let rows=[{house_id:'1',village_id:'1',moo:'1',address:'1',latitude:'16',longitude:'103'}];
const publish=async(r=rows)=>(await db.query('SELECT house_gps_snapshot_publish($1,clock_timestamp(),$2::jsonb,$3) r',[randomUUID(),JSON.stringify(r),'fixture'])).rows[0].r;
assert.equal((await publish()).status,'created');assert.equal((await publish()).status,'unchanged');assert.equal((await db.query('SELECT count(*)::int n FROM house_gps_batches')).rows[0].n,1);
await db.exec('INSERT INTO house_gps_queue SELECT captured_at FROM house_gps_batches');await publish();rows[0].latitude='17';await publish();assert.equal((await db.query('SELECT count(*)::int n FROM house_gps_batches')).rows[0].n,2);
rows[0].latitude='18';assert.equal((await publish()).deleted_batches,1);assert.equal((await db.query('SELECT count(*)::int n FROM house_gps_queue')).rows[0].n,1);
await db.exec(`CREATE FUNCTION fail_cleanup() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'TEST_CLEANUP_FAILED';END$$;CREATE TRIGGER fail_cleanup BEFORE DELETE ON house_gps_snapshot FOR EACH ROW EXECUTE FUNCTION fail_cleanup();`);
rows[0].latitude='19';await assert.rejects(publish(),/TEST_CLEANUP_FAILED/);assert.equal((await db.query("SELECT count(*)::int n FROM house_gps_snapshot WHERE latitude='19'")).rows[0].n,0);
await db.exec('DROP TRIGGER fail_cleanup ON house_gps_snapshot');await assert.rejects(publish([...rows,...rows]),/INVALID_SNAPSHOT_COUNT/);
await db.exec('SET ROLE authenticated');await assert.rejects(publish(),/permission denied/);await db.exec('RESET ROLE');
console.log('PASS: GPS dedup, pinned evidence, checked cleanup rollback, duplicate rejection, ACL');
}finally{await db.close()}})().catch(e=>{console.error(e);process.exitCode=1});