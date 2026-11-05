const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs');
const assert = require('node:assert/strict');

(async () => {
  const db = new PGlite();
  const oldId = '11111111-1111-4111-8111-111111111111';
  const newId = '22222222-2222-4222-8222-222222222222';
  const thirdId = '33333333-3333-4333-8333-333333333333';
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA app_private;
      CREATE FUNCTION app_current_user() RETURNS jsonb LANGUAGE sql AS $$SELECT jsonb_build_object('userId','fixture','role',coalesce(nullif(current_setting('test.role',true),''),'staff'))$$;
      CREATE FUNCTION app_private.in_scope(text) RETURNS boolean LANGUAGE sql AS $$SELECT $1='1'$$;
      CREATE TABLE population(moo text,house text,latitude double precision,longitude double precision,updated_at timestamptz);
      INSERT INTO population(moo,house) VALUES('1','10');`);
    await db.exec(fs.readFileSync('migrations/20261028_house_gps.sql','utf8'));
    await db.exec(fs.readFileSync('migrations/20261105_house_gps_revision.sql','utf8'));
    await db.exec(`INSERT INTO house_gps_batches(id,completed_at) VALUES('${oldId}',now());
      INSERT INTO house_gps_snapshot VALUES('${oldId}','1','1','1','10','16','103');`);
    await db.query("SELECT house_gps_request($1,'1','10',16.1,103.1,10)",[oldId]);
    const revise = (old, next, batch=oldId, state='pending') => db.query("SELECT house_gps_revise($1,$2,$3,$4,16.2,103.2,'แก้หลังคาบ้าน')",[old,next,batch,state]);
    await db.exec("SET test.role='vhv'");
    await assert.rejects(revise(oldId,newId),/FORBIDDEN/);
    await db.exec("SET test.role='staff'");
    await assert.rejects(revise(oldId,newId,newId),/GPS_REFERENCE_CHANGED/);
    await revise(oldId,newId);
    await revise(oldId,newId);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM house_gps_queue')).rows[0].n,2);
    assert.equal((await db.query('SELECT state FROM house_gps_queue WHERE id=$1',[oldId])).rows[0].state,'superseded');
    await assert.rejects(db.query('SELECT house_gps_claim($1)',[oldId]),/NOT_PENDING/);
    await db.query('SELECT house_gps_claim($1)',[newId]);
    await assert.rejects(revise(newId,thirdId),/REVISION_STATE_CHANGED/);
    await db.query("SELECT house_gps_finish($1,'sent')",[newId]);
    await assert.rejects(revise(newId,thirdId,oldId,'sent'),/GPS_SNAPSHOT_AFTER_RESULT_REQUIRED/);
    await db.exec(`INSERT INTO house_gps_batches(id,completed_at) VALUES('${thirdId}',now());
      INSERT INTO house_gps_snapshot VALUES('${thirdId}','1','1','1','10','16.2','103.2');`);
    await revise(newId,thirdId,thirdId,'sent');
    const child = (await db.query('SELECT * FROM house_gps_queue WHERE id=$1',[thirdId])).rows[0];
    assert.equal(child.old_latitude,'16.2');
    assert.equal(child.replaces_id,newId);
    assert.equal(child.actor,'fixture');
    await assert.rejects(revise(newId,oldId,thirdId,'sent'),/REQUEST_CONFLICT/);
    // A failed replacement must restore both the queue and population transaction.
    await db.exec("DELETE FROM population");
    await assert.rejects(revise(thirdId,'44444444-4444-4444-8444-444444444444',thirdId),/HOUSE_NOT_FOUND/);
    assert.equal((await db.query('SELECT state FROM house_gps_queue WHERE id=$1',[thirdId])).rows[0].state,'pending');
    await db.exec("INSERT INTO population(moo,house) VALUES('1','10')");
    await db.query('SELECT house_gps_claim($1)',[thirdId]);
    await db.query("SELECT house_gps_finish($1,'conflict')",[thirdId]);
    const freshId = '55555555-5555-4555-8555-555555555555';
    await assert.rejects(revise(thirdId,freshId,thirdId,'conflict'),/GPS_SNAPSHOT_AFTER_RESULT_REQUIRED/);
    await db.exec(`INSERT INTO house_gps_batches(id,completed_at) VALUES('${freshId}',now());
      INSERT INTO house_gps_snapshot VALUES('${freshId}','1','1','1','10','16.9','103.9');`);
    await revise(thirdId,freshId,freshId,'conflict');
    assert.equal((await db.query('SELECT old_latitude FROM house_gps_queue WHERE id=$1',[freshId])).rows[0].old_latitude,'16.9');
    console.log('PASS replacement, replay, claim-first/revise-first interleavings, permissions, post-send freshness, evidence and rollback');
  } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
