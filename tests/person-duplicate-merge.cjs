const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { PGlite } = require('@electric-sql/pglite');

(async () => {
  const mergeMod = await import(
    pathToFileURL(path.join(__dirname, '../lib/person-duplicate-merge.mjs')).href
  );
  const {
    isTempNewPersonId,
    isHosxpPersonId,
    isValid13DigitCid,
    findDuplicateMatches,
    mapHouseDuplicatesByDupId,
    buildMergedPopulationPatch,
  } = mergeMod;

  // ---------------------------------------------------------------------------
  // 1. Pure matching & merge logic (including real house 220 Moo 5 case)
  // ---------------------------------------------------------------------------
  assert.equal(isTempNewPersonId('P-1794722500731'), true);
  assert.equal(isTempNewPersonId('0008602'), false);
  assert.equal(isHosxpPersonId('0008602'), true);
  assert.equal(isHosxpPersonId('P-1794722500731'), false);
  assert.equal(isValid13DigitCid('1000000000009'), true);
  assert.equal(isValid13DigitCid('1000000000000'), false);

  const house220Members = [
    { person_id: '0008602', cid: '1000000000009', title: 'นาง', fname: 'ทองใบ', lname: 'มัชชิมะ', birth_date: '1957-04-03', moo: '5', house: '220', relation: 'ผู้อาศัย', residency_type: '', chronic: '-' },
    { person_id: 'P-1794722500731', cid: null, title: 'นาง', fname: 'ทองใบ', lname: 'มัชชิมะ', birth_date: '1957-04-03', moo: '5', house: '220', relation: 'ผู้อาศัย', residency_type: '1', chronic: 'ปกติ (ไม่มีโรค)' },
    { person_id: '0020591', cid: null, title: 'น.ส.', fname: 'ปนัดดา', lname: 'สุวรรณพัฒน์', birth_date: '2006-04-11', moo: '5', house: '220', relation: 'ผู้อาศัย', residency_type: '', chronic: '-' },
    { person_id: 'P-1794728942384', cid: null, title: 'น.ส.', fname: 'ปนัดดา', lname: 'สุวรรณพัฒน์', birth_date: '2006-04-11', moo: '5', house: '220', relation: 'ผู้อาศัย', residency_type: '2', chronic: 'ปกติ (ไม่มีโรค)' },
    { person_id: '0024585', cid: null, title: 'ด.ญ.', fname: 'เพชรจิรา', lname: 'แก้วทอง', birth_date: '2011-07-10', moo: '5', house: '220', relation: 'ผู้อาศัย', residency_type: '', chronic: '-' },
    { person_id: 'P-1794726608067', cid: null, title: 'ด.ญ.', fname: 'เพชรจิรา', lname: 'แก้วทอง', birth_date: '2011-07-10', moo: '5', house: '220', relation: 'ผู้อาศัย', residency_type: '1', chronic: 'ปกติ (ไม่มีโรค)' },
    { person_id: '0010851', cid: null, title: 'น.ส.', fname: 'เพชรา', lname: 'จันทร์ทาพูน', birth_date: '1975-08-10', moo: '5', house: '220', relation: 'ผู้อาศัย', residency_type: '', chronic: '-' },
    { person_id: 'P-1794722354476', cid: null, title: 'น.ส.', fname: 'เพชรา', lname: 'จันทาพูน', birth_date: '1975-08-10', moo: '5', house: '220', relation: 'ผู้อาศัย', residency_type: '1', chronic: 'ปกติ (ไม่มีโรค)' },
    { person_id: '0008603', cid: null, title: 'นาง', fname: 'มยุรา', lname: 'จันทร์ทาพูล', birth_date: '1977-01-31', moo: '5', house: '220', relation: 'ผู้อาศัย', residency_type: '', chronic: '-' },
    { person_id: 'P-1794726460592', cid: null, title: 'น.ส.', fname: 'มยุรา', lname: 'จันทาพูน', birth_date: '1977-01-31', moo: '5', house: '220', relation: 'ผู้อาศัย', residency_type: '1', chronic: 'ปกติ (ไม่มีโรค)' },
    { person_id: '0008604', cid: null, title: 'น.ส.', fname: 'รจนา', lname: 'จันทราพูล', birth_date: '1982-08-12', moo: '5', house: '220', relation: 'ผู้อาศัย', residency_type: '', chronic: '-' },
    { person_id: 'P-1794726272817', cid: null, title: 'น.ส.', fname: 'รจนา', lname: 'จันทร์มาพูน', birth_date: '1982-08-12', moo: '5', house: '220', relation: 'เจ้าบ้าน', residency_type: '3', chronic: 'ปกติ (ไม่มีโรค)' },
    { person_id: '0008605', cid: null, title: 'นาย', fname: 'ศุภากร', lname: 'จิตรศิริพจน์', birth_date: '1999-12-09', moo: '5', house: '220', relation: 'ผู้อาศัย', residency_type: '', chronic: '-' },
    { person_id: 'P-1794728866661', cid: null, title: 'นาย', fname: 'ศุภากร', lname: 'จิตรศิริพจน์', birth_date: '1999-12-09', moo: '5', house: '220', relation: 'ผู้อาศัย', residency_type: '2', chronic: 'ปกติ (ไม่มีโรค)' },
    { person_id: 'P-1794726157229', cid: null, title: 'น.ส.', fname: 'อัยดาพร', lname: 'สังฆะโคตร', birth_date: '2001-03-06', moo: '5', house: '220', relation: 'ผู้อาศัย', residency_type: '2', chronic: 'ปกติ (ไม่มีโรค)' },
  ];

  const dupMap = mapHouseDuplicatesByDupId(house220Members);
  assert.equal(Object.keys(dupMap).length, 7);
  assert.equal(dupMap['P-1794722354476'].target.personId, '0010851');
  assert.equal(dupMap['P-1794726272817'].target.personId, '0008604');
  assert.equal(dupMap['P-1794726272817'].matchCode, 'fname_birth');
  assert.equal(dupMap['P-1794726157229'], undefined);

  // Cross-house lookup finds 0015227 in house 129 Moo 5 for P-1794726157229
  const aidaHosxp = { person_id: '0015227', cid: '1000000000009', title: 'นาย', fname: 'อัยดาพร', lname: 'สังฆะโคตร', birth_date: '2001-03-06', moo: '5', house: '129', relation: 'ผู้อาศัย', residency_type: '', chronic: '-' };
  const aidaMatches = findDuplicateMatches(
    house220Members.find((m) => m.person_id === 'P-1794726157229'),
    [aidaHosxp]
  );
  assert.equal(aidaMatches.length, 1);
  assert.equal(aidaMatches[0].personId, '0015227');
  assert.equal(aidaMatches[0].matchCode, 'fname_birth');
  assert.equal(aidaMatches[0].sameHouse, false);

  // CID match takes top priority (score 100)
  const cidMatch = findDuplicateMatches(
    { person_id: 'P-999', cid: '1000000000009', fname: 'สมมติ', lname: 'ใหม่', moo: '1', house: '1' },
    [{ person_id: '000111', cid: '1000000000009', fname: 'สมมติ', lname: 'เดิม', moo: '2', house: '2' }]
  );
  assert.equal(cidMatch[0].matchCode, 'cid_exact');
  assert.equal(cidMatch[0].score, 100);

  // Non-matching twins with exact same birth_date & surname in same house must NOT match
  const twinMatches = findDuplicateMatches(
    { person_id: 'P-twin1', fname: 'สมชาย', lname: 'ใจดี', birth_date: '2015-05-05', moo: '1', house: '10' },
    [{ person_id: '000999', fname: 'สมหญิง', lname: 'ใจดี', birth_date: '2015-05-05', moo: '1', house: '10' }]
  );
  assert.equal(twinMatches.length, 0);

  // Build patch test: fills empty, upgrades relation to เจ้าบ้าน, protects existing target data
  const patchKeepHouse = buildMergedPopulationPatch(
    {
      person_id: '0008604',
      cid: '1000000000009',
      fname: 'รจนา',
      lname: 'จันทราพูล',
      relation: 'ผู้อาศัย',
      residency_type: '',
      status_model_version: 0,
      chronic: 'โรคเบาหวาน',
      smoking_status: 'ไม่สูบ ไม่เคยสูบบุหรี่',
      hep_screen: '-',
      hep_date: null,
      moo: '5',
      house: '129',
    },
    {
      person_id: 'P-1794726272817',
      cid: null,
      fname: 'รจนา',
      lname: 'จันทร์มาพูน',
      relation: 'เจ้าบ้าน',
      residency_type: '3',
      status_model_version: 1,
      chronic: 'ปกติ (ไม่มีโรค)',
      smoking_status: 'สูบอยู่',
      hep_screen: 'ปกติ',
      hep_date: '2026-11-15',
      adl_score: 20,
      adl_answers: '{"total":20}',
      ov_q1: 'ไม่เคย',
      ov_date: '2026-11-15',
      moo: '5',
      house: '220',
      vhv: 'อ้อยใจ  ไกรสุธา',
      latitude: 16.101879,
      longitude: 103.6784794,
    },
    { moveTargetToDupHouse: false }
  );
  assert.equal(patchKeepHouse.patch.relation, 'เจ้าบ้าน');
  assert.equal(patchKeepHouse.patch.residency_type, '3');
  assert.equal(patchKeepHouse.patch.status_model_version, 1);
  assert.equal(patchKeepHouse.patch.chronic, undefined);
  assert.equal(patchKeepHouse.patch.smoking_status, undefined);
  assert.equal(patchKeepHouse.patch.hep_screen, 'ปกติ');
  assert.equal(patchKeepHouse.patch.adl_score, 20);
  assert.equal(patchKeepHouse.patch.ov_q1, 'ไม่เคย');
  assert.equal(patchKeepHouse.patch.moo, undefined);
  assert.equal(patchKeepHouse.patch.house, undefined);

  const patchMoveHouse = buildMergedPopulationPatch(
    { person_id: '0015227', moo: '5', house: '129', relation: 'ผู้อาศัย', residency_type: '', chronic: '-' },
    { person_id: 'P-1794726157229', moo: '5', house: '220', vhv: 'อ้อยใจ  ไกรสุธา', relation: 'ผู้อาศัย', residency_type: '2', chronic: 'ปกติ (ไม่มีโรค)', latitude: 16.101879, longitude: 103.6784794 },
    { moveTargetToDupHouse: true }
  );
  assert.equal(patchMoveHouse.patch.moo, '5');
  assert.equal(patchMoveHouse.patch.house, '220');
  assert.equal(patchMoveHouse.patch.vhv, 'อ้อยใจ  ไกรสุธา');
  assert.equal(patchMoveHouse.patch.latitude, 16.101879);

  // ---------------------------------------------------------------------------
  // 2. Atomic PostgreSQL RPC test in PGlite
  // ---------------------------------------------------------------------------
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon;
      CREATE ROLE authenticated;
      CREATE ROLE service_role;
      CREATE SCHEMA app_private;

      CREATE FUNCTION public.app_current_user() RETURNS jsonb LANGUAGE sql AS $$
        SELECT CASE
          WHEN coalesce(nullif(current_setting('test.role', true), ''), '') = '' THEN NULL
          ELSE jsonb_build_object(
            'userId', coalesce(nullif(current_setting('test.uid', true), ''), '11111111-1111-4111-8111-111111111111'),
            'username', coalesce(nullif(current_setting('test.user', true), ''), 'staff1'),
            'role', current_setting('test.role', true)
          )
        END
      $$;

      CREATE TABLE public.population (
        person_id text PRIMARY KEY,
        cid text,
        title text,
        fname text,
        lname text,
        birth_date date,
        house text,
        moo text,
        relation text,
        residency_type text,
        person_discharge_id integer DEFAULT 9,
        status_model_version integer DEFAULT 1,
        chronic text,
        vhv text,
        latitude double precision,
        longitude double precision,
        hep_screen text,
        hep_date date,
        fobt_screen text,
        fobt_date date,
        hpv_screen text,
        hpv_date date,
        child_dev text,
        child_date date,
        child_dev_date date,
        smoking_status text,
        fagerstrom_score integer,
        fagerstrom_answers text,
        alcohol_status text,
        assist_score integer,
        assist_answers text,
        adl_score integer,
        adl_answers text,
        ov_q1 text,
        ov_q2 text,
        ov_q3 text,
        ov_q4 text,
        ov_q5 text,
        ov_date date,
        updated_at timestamptz DEFAULT now()
      );

      CREATE TABLE public.survey_person_reviews (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        person_id text NOT NULL REFERENCES public.population(person_id) ON DELETE RESTRICT
      );

      CREATE TABLE public.annual_health_screenings_2570 (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        person_id text NOT NULL,
        fiscal_year integer NOT NULL,
        updated_at timestamptz DEFAULT now(),
        UNIQUE (person_id, fiscal_year)
      );

      CREATE TABLE public.house_transfer_requests (
        id bigserial PRIMARY KEY,
        person_id text NOT NULL REFERENCES public.population(person_id) ON DELETE CASCADE,
        state text NOT NULL DEFAULT 'pending'
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
    `);

    await db.exec(
      fs.readFileSync(
        path.join(__dirname, '../migrations/20261124_merge_duplicate_new_person.sql'),
        'utf8'
      )
    );

    await db.exec(`
      INSERT INTO public.population(person_id, cid, title, fname, lname, birth_date, house, moo, relation, residency_type, status_model_version, chronic, vhv)
      VALUES
        ('0008604', '1000000000009', 'น.ส.', 'รจนา', 'จันทราพูล', '1982-08-12', '220', '5', 'ผู้อาศัย', '', 0, '-', 'อ้อยใจ  ไกรสุธา'),
        ('P-1794726272817', NULL, 'น.ส.', 'รจนา', 'จันทร์มาพูน', '1982-08-12', '220', '5', 'เจ้าบ้าน', '3', 1, 'ปกติ (ไม่มีโรค)', 'อ้อยใจ  ไกรสุธา');

      INSERT INTO public.survey_person_reviews(person_id) VALUES ('P-1794726272817');
      INSERT INTO public.house_transfer_requests(person_id) VALUES ('P-1794726272817');
      INSERT INTO public.annual_health_screenings_2570(person_id, fiscal_year) VALUES
        ('0008604', 2569),
        ('P-1794726272817', 2569),
        ('P-1794726272817', 2570);
    `);

    const setRole = (role) => db.query("SELECT set_config('test.role', $1, false)", [role]);

    // Unauthorized roles must fail
    await setRole('vhv');
    await assert.rejects(
      db.query("SELECT public.merge_duplicate_new_person('P-1794726272817', '0008604', '{}'::jsonb, 'test')"),
      /FORBIDDEN/
    );
    await setRole('manager');
    await assert.rejects(
      db.query("SELECT public.merge_duplicate_new_person('P-1794726272817', '0008604', '{}'::jsonb, 'test')"),
      /FORBIDDEN/
    );

    // Guard against deleting non-P- HOSxP records
    await setRole('staff');
    await assert.rejects(
      db.query("SELECT public.merge_duplicate_new_person('0008604', 'P-1794726272817', '{}'::jsonb, 'bad')"),
      /INVALID_MERGE_IDS/
    );
    await assert.rejects(
      db.query("SELECT public.merge_duplicate_new_person('P-missing', '0008604', '{}'::jsonb, 'missing')"),
      /DUP_NOT_FOUND/
    );

    // Atomic merge & delete
    const res = await db.query(
      "SELECT public.merge_duplicate_new_person('P-1794726272817', '0008604', $1::jsonb, 'รวมคนเพิ่มใหม่ที่ซ้ำกัน') AS out",
      [JSON.stringify(patchKeepHouse.patch)]
    );
    assert.deepEqual(res.rows[0].out, {
      ok: true,
      deletedPersonId: 'P-1794726272817',
      targetPersonId: '0008604',
    });

    const popRows = (await db.query('SELECT * FROM public.population')).rows;
    assert.equal(popRows.length, 1);
    assert.equal(popRows[0].person_id, '0008604');
    assert.equal(popRows[0].cid, '1000000000009');
    assert.equal(popRows[0].relation, 'เจ้าบ้าน');
    assert.equal(popRows[0].residency_type, '3');
    assert.equal(popRows[0].status_model_version, 1);

    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.survey_person_reviews')).rows[0].n, 0);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.house_transfer_requests')).rows[0].n, 0);

    const scrRows = (await db.query('SELECT person_id, fiscal_year FROM public.annual_health_screenings_2570 ORDER BY fiscal_year')).rows;
    assert.deepEqual(scrRows, [
      { person_id: '0008604', fiscal_year: 2569 },
      { person_id: '0008604', fiscal_year: 2570 },
    ]);

    const logRows = (await db.query('SELECT action, target_id, details FROM public.activity_logs')).rows;
    assert.equal(logRows.length, 1);
    assert.equal(logRows[0].action, 'MERGE_NEW_PERSON');
    assert.equal(logRows[0].target_id, '0008604');
    assert.match(logRows[0].details, /P-1794726272817/);
  } finally {
    await db.close();
  }

  console.log('PASS: duplicate person matching, fill-if-empty merge patch, atomic RPC cleanup, role/ID guards, and audit log');
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
