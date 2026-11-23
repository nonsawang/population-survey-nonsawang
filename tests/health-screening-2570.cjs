const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

(async () => {
  const modUrl = pathToFileURL(
    path.join(__dirname, '../lib/health-screening-2570.mjs')
  ).href;
  const mod = await import(modUrl);

  const {
    FISCAL_YEAR_2570,
    inferPersonProfile,
    getApplicableSections,
    createDefaultScreening2570Form,
    calculateBmi,
    classifyBmi,
    evaluateBloodPressure,
    evaluateBloodSugar,
    evaluateSmoking,
    evaluateAssistAlcohol,
    evaluateTb,
    evaluateDepression2Q,
    evaluateOralHealth,
    evaluateHearing,
    evaluateVision,
    evaluateMiniCog,
    evaluateKneeOa,
    evaluateIncontinence,
    evaluateFallTugt,
    evaluateSleep,
    evaluateMna,
    evaluateAdl,
    evaluateFullScreening2570,
    buildScreening2570PrintHtml,
  } = mod;

  assert.equal(FISCAL_YEAR_2570, 2570);

  // 1. Target eligibility by age and gender
  const youngMan = { fullname: 'นายสมชาย ทดสอบ', age: 25, birthDate: '2001-05-10' };
  const youngTargets = getApplicableSections(youngMan);
  assert.equal(youngTargets.s1_anthropometry, true);
  assert.equal(youngTargets.s2_blood_pressure, false);
  assert.equal(youngTargets.s4_hepatitis_bc, false);
  assert.equal(youngTargets.s5_breast_cancer, false);
  assert.equal(youngTargets.s8_smoking, true);
  assert.equal(youngTargets.s13_oral_health, false);

  const middleWoman = { fullname: 'นางสมหญิง ดีงาม', age: 52, birthDate: '1974-03-01' };
  const midTargets = getApplicableSections(middleWoman);
  assert.equal(midTargets.s2_blood_pressure, true);
  assert.equal(midTargets.s3_diabetes, true);
  assert.equal(midTargets.s4_hepatitis_bc, true);
  assert.equal(midTargets.s5_breast_cancer, true);
  assert.equal(midTargets.s6_cervical_cancer, true);
  assert.equal(midTargets.s7_colorectal_cancer, true);
  assert.equal(midTargets.s13_oral_health, false);

  const elderMan = { fullname: 'นายบุญมี รักษ์ดี', age: 68, birthDate: '1958-01-20' };
  const elderProfile = inferPersonProfile(elderMan);
  const elderTargets = getApplicableSections(elderMan);
  assert.equal(elderProfile.isMale, true);
  assert.equal(elderProfile.bornBefore2535, true);
  assert.equal(elderTargets.s5_breast_cancer, false);
  assert.equal(elderTargets.s6_cervical_cancer, false);
  assert.equal(elderTargets.s7_colorectal_cancer, true);
  assert.equal(elderTargets.s13_oral_health, true);
  assert.equal(elderTargets.s22_adl, true);

  // 2. BMI, BP, Blood sugar
  const bmi = calculateBmi(65, 160);
  assert.equal(bmi, 25.4);
  assert.equal(classifyBmi(bmi).mnaScore, 3);
  assert.equal(classifyBmi(18.0).mnaScore, 0);

  const bp1 = evaluateBloodPressure({ sbp1: 145, dbp1: 88, sbp2: '', dbp2: '' });
  assert.equal(bp1.needsSecond, true);
  assert.equal(bp1.level, 'abnormal');
  const bp2 = evaluateBloodPressure({ sbp1: 145, dbp1: 88, sbp2: 125, dbp2: 75 });
  assert.equal(bp2.level, 'normal');
  assert.equal(evaluateBloodPressure({ sbp1: 185, dbp1: 95 }).level, 'danger');

  assert.equal(evaluateBloodSugar({ dtxMgDl: 92 }).level, 'normal');
  assert.equal(evaluateBloodSugar({ dtxMgDl: 112 }).level, 'risk');
  assert.equal(evaluateBloodSugar({ dtxMgDl: 140 }).level, 'danger');

  // 3. Smoking & Alcohol ASSIST
  assert.deepEqual(evaluateSmoking({ status: 'never' }).codes, ['1B52']);
  assert.deepEqual(evaluateSmoking({ status: 'quit' }).codes, ['1B51']);
  assert.deepEqual(
    evaluateSmoking({
      status: 'current',
      cigsPerDay: '11_19',
      firstCigWait: 'lt_30m',
      staffCare: 'counseling_med',
    }).codes,
    ['1B50', '1B502', '1B504', '1B532']
  );

  assert.deepEqual(evaluateAssistAlcohol({ status: 'never' }).codes, ['1B600']);
  assert.deepEqual(evaluateAssistAlcohol({ status: 'quit_1y' }).codes, ['1B601']);
  // Skip Q2.2-Q2.4 when Q2.1 === 'never'
  const assistSkipped = evaluateAssistAlcohol({
    status: 'current',
    q2_1: 'never',
    q2_2: 'daily',
    q3_1: 'recent_3m',
    q3_2: 'never',
  });
  assert.equal(assistSkipped.score, 6);
  assert.deepEqual(assistSkipped.codes, ['1B602', '1B610']);

  const assistHigh = evaluateAssistAlcohol({
    status: 'current',
    q2_1: 'daily',    // 6
    q2_2: 'daily',    // 6
    q2_3: 'daily',    // 7
    q2_4: 'daily',    // 8
    q3_1: 'recent_3m',// 6
    q3_2: 'never',    // 0
  });
  assert.equal(assistHigh.score, 33);
  assert.deepEqual(assistHigh.codes, ['1B604', '1B611', '1B612']);

  // 4. TB & Depression 2Q
  assert.equal(evaluateTb({ symptoms: { tb1: true } }).suspect, true);
  assert.equal(evaluateTb({ symptoms: { tb4: true, tb5: true } }).suspect, false);
  assert.equal(evaluateDepression2Q({ q1_sad: false, q2_bored: false }, 40).code, '1B0210');
  assert.equal(evaluateDepression2Q({ q1_sad: true, q2_bored: false }, 40).code, '1B0211');
  assert.equal(evaluateDepression2Q({ q1_sad: false, q2_bored: false }, 65).code, '1B0280');
  assert.equal(evaluateDepression2Q({ q1_sad: false, q2_bored: true }, 65).code, '1B0281');

  // 5. Elderly 13-22
  assert.equal(evaluateOralHealth({ cleanliness: 'clean' }).code, '1B1260');
  assert.equal(evaluateOralHealth({ cleanliness: 'unclean' }).code, '1B1261');

  assert.equal(evaluateHearing({ leftEar: 'hear', rightEar: 'hear' }).code, '1B1140');
  assert.equal(evaluateHearing({ leftEar: 'hear', rightEar: 'not_hear' }).code, '1B1141');
  assert.equal(evaluateHearing({ leftEar: 'not_hear', rightEar: 'not_hear' }).code, '1B1142');

  assert.deepEqual(
    evaluateVision({
      nearVision: 'normal',
      farVision: 'problem',
      cataract: 'refer',
      glaucoma: 'normal',
      amd: 'problem',
    }).codes,
    ['1B1240', '1B1244', '1B1252', '1B1253', '1B1257']
  );

  assert.equal(
    evaluateMiniCog({ clockScore: 2, recallWords: { w1: true, w2: true, w3: false } }).code,
    '1B1220'
  );
  assert.equal(
    evaluateMiniCog({ clockScore: 0, recallWords: { w1: true, w2: true, w3: true } }).code,
    '1B1221'
  );

  assert.equal(evaluateKneeOa({ hasKneePain: false }).code, '1B1270');
  assert.equal(
    evaluateKneeOa({ hasKneePain: true, symptoms: { k1: true, k2: false } }).code,
    '1B1270'
  );
  assert.equal(
    evaluateKneeOa({ hasKneePain: true, symptoms: { k1: true, k3: true } }).code,
    '1B1271'
  );

  assert.equal(evaluateIncontinence({ hasIncontinence: false }).code, '1B1284');
  assert.equal(evaluateIncontinence({ hasIncontinence: true }).code, '1B1285');

  assert.equal(evaluateFallTugt({ fellLast6Months: false, walkMinutes: 0, walkSeconds: 11 }).code, '1B1200');
  assert.equal(evaluateFallTugt({ fellLast6Months: false, walkMinutes: 0, walkSeconds: 12 }).code, '1B1201');
  assert.equal(evaluateFallTugt({ fellLast6Months: true, walkMinutes: 0, walkSeconds: 8 }).code, '1B1201');

  assert.deepEqual(evaluateSleep({ hasSleepProblem: false, daytimeFatigue: false }).codes, []);
  assert.deepEqual(evaluateSleep({ hasSleepProblem: true, daytimeFatigue: false }).codes, ['1B1213']);

  const mnaNorm = evaluateMna({ mna1: 2, mna2: 3, mna3: 2, mna4: 2, mna5: 2, calfCm: '32' }, 24);
  assert.equal(mnaNorm.total, 14);
  assert.equal(mnaNorm.code, '1K10');
  assert.equal(evaluateMna({ mna1: 2, mna2: 3, mna3: 2, mna4: 2, mna5: 2, calfCm: '32' }, null).total, 14);
  assert.equal(evaluateMna({ mna1: 1, mna2: 2, mna3: 1, mna4: 2, mna5: 1, calfCm: '32' }, 20).code, '1K11');
  assert.equal(evaluateMna({ mna1: 0, mna2: 0, mna3: 0, mna4: 0, mna5: 1, calfCm: '28' }, 17).code, '1K12');

  const adlSocial = evaluateAdl({
    adl1: 2, adl2: 1, adl3: 3, adl4: 2, adl5: 3, adl6: 2, adl7: 2, adl8: 1, adl9: 2, adl10: 2,
  });
  assert.equal(adlSocial.total, 20);
  assert.equal(adlSocial.code, '1B1280');

  const adlHome = evaluateAdl({
    adl1: 2, adl2: 1, adl3: 2, adl4: 1, adl5: 1, adl6: 1, adl7: 0, adl8: 0, adl9: 1, adl10: 1,
  });
  assert.equal(adlHome.total, 10);
  assert.equal(adlHome.code, '1B1281');

  const adlBed = evaluateAdl({ adl1: 1, adl2: 0, adl3: 0, adl4: 0, adl5: 0, adl6: 0, adl7: 0, adl8: 0, adl9: 1, adl10: 1 });
  assert.equal(adlBed.total, 3);
  assert.equal(adlBed.code, '1B1282');

  // 6. Full evaluation & Print HTML (4-page exact layout + XSS escaping)
  const fullForm = createDefaultScreening2570Form(elderMan, '2026-11-23');
  fullForm.s1 = { weightKg: '62', heightCm: '165', waistCm: '80' };
  fullForm.s2 = { sbp1: '146', dbp1: '86', pulse1: '78', sbp2: '132', dbp2: '76', pulse2: '74' };
  fullForm.s3 = { fastingType: 'fasting', dtxMgDl: '108' };
  fullForm.personalChronic.other = '<script>alert(1)</script>';
  const sampleClockPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  fullForm.s16.clockDrawingDataUrl = sampleClockPng;
  fullForm.consent.staffName = 'อสม.ใจดี <b>รักชุมชน</b>';
  fullForm.consent.patientSignatureDataUrl = 'javascript:alert(1)';
  const fullEval = evaluateFullScreening2570(fullForm, elderMan);
  assert.ok(fullEval.ppSpecialCodes.includes('1B52'));
  assert.ok(fullEval.ppSpecialCodes.includes('1B600'));
  assert.ok(fullEval.ppSpecialCodes.includes('1B0280'));
  assert.ok(fullEval.ppSpecialCodes.includes('1B1280'));
  assert.ok(fullEval.ppSpecialCodes.includes('1K10'));

  const html = buildScreening2570PrintHtml(fullForm, elderMan, fullEval);
  assert.ok(html.includes('แบบฟอร์มสำหรับคัดกรองภาวะสุขภาพประจำปีงบประมาณ 2570'));
  assert.ok(html.includes('นายบุญมี รักษ์ดี'));
  assert.equal((html.match(/class="a4-page"/g) || []).length, 4, 'ต้องมีครบ 4 หน้า A4');
  assert.ok(html.includes('ชีพจร'));
  assert.ok(html.includes('>78<') && html.includes('>74<'));
  assert.ok(html.includes('<span class="val-hit">146</span>'));
  assert.ok(html.includes('<span class="val-hit">132</span>'));
  assert.ok(html.includes('<span class="val-hit">108</span>'));
  assert.ok(html.includes('class="clock-circle"'));
  assert.ok(html.includes(`<img class="clock-draw-img" src="${sampleClockPng}"`));
  assert.ok(html.includes('<svg viewBox="0 0 460') && html.includes('เดินไประยะ 3 เมตร'));
  assert.ok(html.includes('class="nbox is-on"'));
  assert.ok(html.includes('class="adl-tbl"'));
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(!html.includes('javascript:alert(1)'));

  // Reject unsafe clockDrawingDataUrl
  const unsafeClockForm = createDefaultScreening2570Form(elderMan, '2026-11-23');
  unsafeClockForm.s16.clockDrawingDataUrl = 'javascript:alert(1)';
  const unsafeClockHtml = buildScreening2570PrintHtml(unsafeClockForm, elderMan);
  assert.ok(!unsafeClockHtml.includes('<img class="clock-draw-img"'));
  assert.ok(!unsafeClockHtml.includes('javascript:alert(1)'));

  // Under-60 person should NOT have elderly sections 13-22 pre-checked when showAll22 is false
  const youngForm = createDefaultScreening2570Form(youngMan, '2026-11-23');
  youngForm.s16.clockDrawingDataUrl = sampleClockPng;
  const youngHtml = buildScreening2570PrintHtml(youngForm, youngMan);
  assert.equal((youngHtml.match(/class="a4-page"/g) || []).length, 4);
  assert.ok(!youngHtml.includes('<img class="clock-draw-img"'), 'คนอายุ < 60 ปี (ไม่เปิด showAll22) ต้องไม่แสดงภาพวาดนาฬิกา');
  const page4Start = youngHtml.lastIndexOf('class="a4-page"');
  const youngPage4 = youngHtml.slice(page4Start);
  assert.ok(!youngPage4.includes('class="nbox is-on"'), 'คนอายุ < 60 ปีต้องไม่ติ๊กช่องคะแนน MNA แทน');
  assert.ok(!youngPage4.includes('<span class="tick">✓</span>'), 'คนอายุ < 60 ปีต้องไม่ติ๊กช่อง ADL แทน');

  // 7. Static check that migration SQL exists
  const sql = fs.readFileSync(
    path.join(__dirname, '../migrations/20261123_annual_health_screening_2570.sql'),
    'utf8'
  );
  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.annual_health_screenings_2570'));
  assert.ok(sql.includes('ENABLE ROW LEVEL SECURITY'));

  console.log('PASS: annual health screening 2570 (22 sections, age/sex targets, scoring, PP Special codes, print HTML & SQL migration)');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
