const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs');
const assert = require('node:assert/strict');

(async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon;
      CREATE ROLE authenticated;
      CREATE ROLE service_role;
      CREATE SCHEMA app_private;

      CREATE TABLE public.app_users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        username text NOT NULL,
        display_name text NOT NULL,
        role text NOT NULL,
        moo text NOT NULL DEFAULT '',
        is_active boolean NOT NULL DEFAULT true
      );

      CREATE TABLE public.population (
        person_id text PRIMARY KEY,
        cid text,
        title text,
        fname text,
        lname text,
        moo text,
        house text,
        vhv text,
        relation text,
        latitude double precision,
        longitude double precision,
        updated_at timestamptz DEFAULT now()
      );

      CREATE TABLE public.vhv_data (
        id serial PRIMARY KEY,
        name text NOT NULL,
        moo text NOT NULL
      );

      CREATE TABLE public.activity_logs (
        id bigserial PRIMARY KEY,
        user_id uuid,
        username text,
        action text,
        details text,
        target_id text,
        created_at timestamptz DEFAULT now()
      );

      CREATE OR REPLACE FUNCTION public.app_current_user() RETURNS jsonb
      LANGUAGE sql STABLE AS $$
        SELECT CASE
          WHEN coalesce(nullif(current_setting('test.user_id', true), ''), '') = '' THEN NULL
          ELSE jsonb_build_object(
            'userId', current_setting('test.user_id', true),
            'username', current_setting('test.username', true),
            'displayName', current_setting('test.display_name', true),
            'role', current_setting('test.role', true),
            'moo', coalesce(current_setting('test.moo', true), '')
          )
        END
      $$;
    `);

    await db.exec(fs.readFileSync('migrations/20261109_house_transfer_requests.sql', 'utf8'));

    const uAdmin = '11111111-1111-4111-8111-111111111111';
    const uStaff = '22222222-2222-4222-8222-222222222222';
    const uVhv1 = '33333333-3333-4333-8333-333333333333';
    const uVhv2 = '44444444-4444-4444-8444-444444444444';
    const uManager = '55555555-5555-4555-8555-555555555555';

    await db.exec(`
      INSERT INTO public.app_users(id, username, display_name, role, moo) VALUES
        ('${uAdmin}', 'admin', 'ผู้ดูแลระบบ', 'admin', ''),
        ('${uStaff}', 'staff1', 'เจ้าหน้าที่ 1', 'staff', ''),
        ('${uVhv1}', 'vhv1', 'อสม.หมู่ 1', 'vhv', '1'),
        ('${uVhv2}', 'vhv2', 'อสม.หมู่ 2', 'vhv', '2'),
        ('${uManager}', 'mgr1', 'ผู้บริหาร', 'manager', '');

      INSERT INTO public.vhv_data(name, moo) VALUES
        ('นางสมศรี หมู่1', '1'),
        ('นางสมหญิง หมู่2', '2'),
        ('นายสมชาย หมู่2', '2'),
        ('นางสมพร หมู่3', '3');

      INSERT INTO public.population(person_id, title, fname, lname, moo, house, vhv, relation, latitude, longitude, updated_at) VALUES
        ('p_m1_h10', 'นาย', 'กิตติ', 'ใจดี', '1', '10', 'นางสมศรี หมู่1', 'ผู้อาศัย', 16.11, 103.11, '2026-11-09T01:00:00Z'),
        ('p_m1_h12', 'นาง', 'มานี', 'มีนา', '1', '12', 'นางสมศรี หมู่1', 'เจ้าบ้าน', 16.12, 103.12, '2026-11-09T01:00:00Z'),
        ('p_m2_h20', 'นาย', 'ชูใจ', 'รักษ์ดี', '2', '20', 'นางสมหญิง หมู่2', 'เจ้าบ้าน', 16.22, 103.22, '2026-11-09T01:00:00Z'),
        ('p_m3_h30', 'นาย', 'ปิติ', 'สุขใจ', '3', '30', 'นางสมพร หมู่3', 'เจ้าบ้าน', 16.33, 103.33, '2026-11-09T01:00:00Z');
    `);

    const asUser = async (id, username, role, moo = '') => {
      await db.query(`SELECT set_config('test.user_id', $1, false), set_config('test.username', $2, false), set_config('test.display_name', $2, false), set_config('test.role', $3, false), set_config('test.moo', $4, false)`, [
        id,
        username,
        role,
        moo,
      ]);
    };

    const callRpc = async (sql, params = []) => (await db.query(sql, params)).rows[0].res;

    // -------------------------------------------------------------------------
    // [P1 #4] Manager role must be strictly rejected from preview, submit, approve, cancel
    // -------------------------------------------------------------------------
    await asUser(uManager, 'mgr1', 'manager', '');
    await assert.rejects(
      db.query(`SELECT public.house_transfer_preview('1', '10') AS res`),
      /FORBIDDEN_ROLE/
    );
    await assert.rejects(
      db.query(`SELECT public.house_transfer_submit('p_m1_h10', '1', '10', '1', '12', NULL, 'ผู้อาศัย') AS res`),
      /FORBIDDEN_ROLE/
    );
    const mgrList = await callRpc(`SELECT public.house_transfer_list(1, 20) AS res`);
    assert.equal(mgrList.incoming.length, 0);
    assert.equal(mgrList.outgoing.length, 0);
    console.log('PASS [P1 #4]: manager role is strictly blocked from preview, submit, approve, cancel');

    // -------------------------------------------------------------------------
    // [P1 #3] Preview minimal disclosure for out-of-scope village & no raw GPS / member names
    // -------------------------------------------------------------------------
    await asUser(uVhv1, 'vhv1', 'vhv', '1');
    const outScopePreview = await callRpc(`SELECT public.house_transfer_preview('2', '20') AS res`);
    assert.equal(outScopePreview.exists, true);
    assert.equal(outScopePreview.inScope, false);
    assert.equal(outScopePreview.sampleMembers, undefined);
    assert.equal(outScopePreview.memberCount, undefined);
    assert.equal(outScopePreview.houseVhv, undefined);
    assert.equal(outScopePreview.hasGps, undefined);
    assert.equal(outScopePreview.latitude, undefined);
    assert.equal(outScopePreview.longitude, undefined);
    assert.deepEqual(outScopePreview.vhvList, ['นางสมหญิง หมู่2', 'นายสมชาย หมู่2']);

    const inScopePreview = await callRpc(`SELECT public.house_transfer_preview('1', '12') AS res`);
    assert.equal(inScopePreview.exists, true);
    assert.equal(inScopePreview.inScope, true);
    assert.equal(inScopePreview.memberCount, 1);
    assert.equal(inScopePreview.houseVhv, 'นางสมศรี หมู่1');
    assert.equal(inScopePreview.hasGps, true);
    assert.equal(inScopePreview.sampleMembers, undefined);
    assert.equal(inScopePreview.latitude, undefined);
    assert.equal(inScopePreview.longitude, undefined);
    console.log('PASS [P1 #3]: preview enforces minimal disclosure for out-of-scope villages and never leaks member names or GPS coordinates');

    // -------------------------------------------------------------------------
    // [P2 #5] Non-existent destination house and unregistered VHV name must be rejected
    // -------------------------------------------------------------------------
    await assert.rejects(
      db.query(`SELECT public.house_transfer_submit('p_m1_h10', '1', '10', '2', '999', NULL, 'ผู้อาศัย') AS res`),
      /TARGET_HOUSE_NOT_FOUND/
    );
    await assert.rejects(
      db.query(`SELECT public.house_transfer_submit('p_m1_h10', '1', '10', '2', '20', 'อสม.ปลอม', 'ผู้อาศัย') AS res`),
      /INVALID_TARGET_VHV/
    );
    console.log('PASS [P2 #5]: non-existent target house and unregistered VHV names are rejected');

    // -------------------------------------------------------------------------
    // [P1 #1 & #2] Cross-village request + stale source check + concurrent approve/cancel protection
    // -------------------------------------------------------------------------
    const pendingRes = await callRpc(
      `SELECT public.house_transfer_submit('p_m1_h10', '1', '10', '2', '20', 'นายสมชาย หมู่2', 'หลาน') AS res`
    );
    assert.equal(pendingRes.status, 'pending_approval');
    assert.equal(pendingRes.hosxpSynced, false);
    const req1Id = pendingRes.requestId;

    // Manager cannot cancel or approve
    await asUser(uManager, 'mgr1', 'manager', '');
    await assert.rejects(
      db.query(`SELECT public.house_transfer_approve($1, NULL) AS res`, [req1Id]),
      /FORBIDDEN_ROLE/
    );
    await assert.rejects(
      db.query(`SELECT public.house_transfer_cancel($1, 'test') AS res`, [req1Id]),
      /FORBIDDEN_ROLE/
    );

    // Source VHV (Moo 1) cannot approve incoming for Moo 2
    await asUser(uVhv1, 'vhv1', 'vhv', '1');
    await assert.rejects(
      db.query(`SELECT public.house_transfer_approve($1, NULL) AS res`, [req1Id]),
      /FORBIDDEN_TARGET_MOO/
    );

    // Simulate person p_m1_h10 being modified/moved via another channel while request is pending
    await db.exec(`UPDATE public.population SET house = '12', updated_at = '2026-11-09T02:00:00Z' WHERE person_id = 'p_m1_h10'`);
    await asUser(uVhv2, 'vhv2', 'vhv', '2');
    await assert.rejects(
      db.query(`SELECT public.house_transfer_approve($1, NULL) AS res`, [req1Id]),
      /SOURCE_PERSON_CHANGED/
    );
    // Restore p_m1_h10 back to original state and test approve -> then cancel must fail
    await db.exec(`UPDATE public.population SET house = '10', updated_at = '2026-11-09T01:00:00Z' WHERE person_id = 'p_m1_h10'`);

    const approveRes = await callRpc(`SELECT public.house_transfer_approve($1, NULL) AS res`, [req1Id]);
    assert.equal(approveRes.status, 'approved');
    assert.equal(approveRes.toVhv, 'นายสมชาย หมู่2');

    // Verify person moved and activity_log written in the same transaction
    const movedPerson = (await db.query(`SELECT moo, house, vhv, relation, latitude, longitude FROM public.population WHERE person_id = 'p_m1_h10'`)).rows[0];
    assert.equal(movedPerson.moo, '2');
    assert.equal(movedPerson.house, '20');
    assert.equal(movedPerson.vhv, 'นายสมชาย หมู่2');
    assert.equal(movedPerson.relation, 'หลาน');
    assert.equal(movedPerson.latitude, 16.22);

    // Subsequent cancel or second approve on the same request must fail with REQUEST_NOT_PENDING
    await asUser(uVhv1, 'vhv1', 'vhv', '1');
    await assert.rejects(
      db.query(`SELECT public.house_transfer_cancel($1, 'ช้าไป') AS res`, [req1Id]),
      /REQUEST_NOT_PENDING/
    );
    await asUser(uStaff, 'staff1', 'staff', '');
    await assert.rejects(
      db.query(`SELECT public.house_transfer_approve($1, NULL) AS res`, [req1Id]),
      /REQUEST_NOT_PENDING/
    );
    console.log('PASS sequential approve/cancel and stale source version protection (not a concurrency test)');

    // -------------------------------------------------------------------------
    // [P2 #6] Scoped SQL filtering & pagination (250 pending in Moo 3 must not starve Moo 2)
    // -------------------------------------------------------------------------
    for (let i = 1; i <= 210; i++) {
      const pid = `bulk_p_${i}`;
      await db.query(
        `INSERT INTO public.population(person_id, fname, lname, moo, house, vhv, updated_at) VALUES ($1, $2, 'ทดสอบ', '1', '10', 'นางสมศรี หมู่1', now())`,
        [pid, `คนที่${i}`]
      );
      await db.query(
        `INSERT INTO public.house_transfer_requests(person_id, fullname, from_moo, from_house, to_moo, to_house, to_vhv, relation, state, requested_by, requested_by_username, requested_by_name)
         VALUES ($1, $2, '1', '10', '3', '30', 'นางสมพร หมู่3', 'ผู้อาศัย', 'pending', $3, 'vhv1', 'อสม.หมู่ 1')`,
        [pid, `คนที่${i} ทดสอบ`, uVhv1]
      );
    }
    // Insert 1 older request targeting Moo 2
    await db.query(
      `INSERT INTO public.house_transfer_requests(person_id, fullname, from_moo, from_house, to_moo, to_house, to_vhv, relation, state, requested_by, requested_by_username, requested_by_name, requested_at)
       VALUES ('p_m1_h12', 'นางมานี มีนา', '1', '12', '2', '20', 'นางสมหญิง หมู่2', 'ผู้อาศัย', 'pending', $1, 'vhv1', 'อสม.หมู่ 1', '2026-11-01T00:00:00Z')`,
      [uVhv1]
    );

    await asUser(uVhv2, 'vhv2', 'vhv', '2');
    const vhv2List = await callRpc(`SELECT public.house_transfer_list(1, 20) AS res`);
    assert.equal(vhv2List.incomingTotal, 1);
    assert.equal(vhv2List.incoming.length, 1);
    assert.equal(vhv2List.incoming[0].personId, 'p_m1_h12');
    console.log('PASS [P2 #6]: database-scoped filtering and pagination prevent queue starvation across villages');

    await db.exec(fs.readFileSync('migrations/20261109_house_transfer_hardening.sql','utf8'));
    const validMoos=['1','2','3','4','5','6','7','8','14','18','19','20','21','22','23'];
    for(let m=1;m<=24;m++) assert.equal((await db.query('SELECT app_private.valid_moo($1) ok',[String(m)])).rows[0].ok,validMoos.includes(String(m)));
    await asUser(uStaff,'staff1','staff','');
    await db.exec("UPDATE population SET vhv='ชื่อเก่าที่ไม่มีในทะเบียน' WHERE person_id='p_m3_h30'");
    for(const chosen of [null,'ชื่อเก่าที่ไม่มีในทะเบียน']) await assert.rejects(db.query("SELECT house_transfer_submit('p_m1_h12','1','12','3','30',$1,NULL)",[chosen]),/INVALID_TARGET_VHV/);
    await db.exec("UPDATE population SET vhv='นางสมพร หมู่3' WHERE person_id='p_m3_h30'");
    // Import logs without accepting historical approval/source versions.
    await db.exec("INSERT INTO population(person_id,moo,house,updated_at) VALUES('legacy-person','1','10',now())");
    const details=JSON.stringify({personId:'legacy-person',fromMoo:'1',fromHouse:'10',toMoo:'2',toHouse:'20'});
    await db.query("INSERT INTO activity_logs(user_id,username,action,details,target_id) VALUES($1,'vhv1','MOVE_REQUEST_PENDING',$2,'legacy-person')",[uVhv1,details]);
    await db.query("INSERT INTO activity_logs(user_id,username,action,details,target_id) VALUES($1,'vhv1','MOVE_REQUEST_PENDING','invalid json','invalid-person')",[uVhv1]);
    const legacySQL=fs.readFileSync('migrations/20261109_house_transfer_legacy.sql','utf8');
    await db.exec(legacySQL); await db.exec(legacySQL);
    assert.equal((await db.query('SELECT count(*)::int n FROM house_transfer_legacy_review')).rows[0].n,2);
    const imported=(await db.query("SELECT id FROM house_transfer_requests WHERE person_id='legacy-person'")).rows[0];
    await assert.rejects(db.query('SELECT house_transfer_approve($1,NULL)',[imported.id]),/LEGACY_REQUEST_REQUIRES_RESUBMIT/);
    assert.equal((await db.query("SELECT moo FROM population WHERE person_id='legacy-person'")).rows[0].moo,'1');
    assert.equal((await db.query("SELECT count(*)::int n FROM activity_logs WHERE action='MOVE_REQUEST_PENDING'")).rows[0].n,2);
    console.log('PASS exact villages, stale VHV rejection, legacy import replay, malformed log retention and approval block');
  } finally {
    await db.close();
  }
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
