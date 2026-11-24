/**
 * Pure helpers for detecting duplicate temporary web-added people (`P-...`)
 * against real HOSxP `population` records and computing non-destructive merge patches.
 */

/** Return true when `id` is a temporary web-added person ID (`P-...`). */
export function isTempNewPersonId(id) {
  return /^P-[A-Za-z0-9_-]+$/.test(String(id || '').trim());
}

/** Return true when `id` is a valid non-temporary HOSxP person ID. */
export function isHosxpPersonId(id) {
  const s = String(id || '').trim();
  return Boolean(s) && s.length <= 100 && !s.startsWith('P-');
}

/** Normalize Thai/Latin name strings by trimming and collapsing whitespace. */
export function normPersonText(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/** Extract `YYYY-MM-DD` from a date string, or `''` if absent/invalid. */
export function normBirthDate(value) {
  const m = String(value ?? '')
    .trim()
    .match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}

/** Validate a 13-digit Thai national ID including its mod-11 check digit. */
export function isValid13DigitCid(value) {
  const s = String(value ?? '').trim();
  if (!/^\d{13}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += Number(s[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(s[12]);
}

/** Return true when a survey value is missing or placeholder (`''` / `'-'`). */
export function isEmptySurveyValue(value) {
  if (value === null || value === undefined) return true;
  const s = String(value).trim();
  return s === '' || s === '-';
}

function readRowFields(row) {
  const r = row || {};
  const personId = String(r.person_id ?? r.personId ?? '').trim();
  const cid = String(r.cid ?? '').trim();
  const title = String(r.title ?? '').trim();
  const fname = String(r.fname ?? '').trim();
  const lname = String(r.lname ?? '').trim();
  const fullname =
    String(r.fullname ?? '').trim() || `${title}${fname} ${lname}`.trim();
  const birthDate = normBirthDate(r.birth_date ?? r.birthDate);
  const moo = String(r.moo ?? '').trim();
  const house = String(r.house ?? '').trim();
  const vhv = String(r.vhv ?? '').trim();
  const relation = String(r.relation ?? '').trim();
  const residencyType = String(r.residency_type ?? r.residencyType ?? '').trim();
  const chronic = String(r.chronic ?? '').trim();
  return {
    personId,
    cid,
    title,
    fname,
    lname,
    fullname,
    birthDate,
    moo,
    house,
    vhv,
    relation,
    residencyType,
    chronic,
  };
}

/**
 * Find candidate matches for `source` from `candidates`.
 * Tiers:
 *   1) cid_exact (100)        — both have valid 13-digit CID and match
 *   2) fname_birth (90)       — first name + birth_date match (catches 1-char surname typos)
 *   3) fullname_exact (85)    — first name + last name match
 *   4) same_house_fname (70)  — same moo & house and first name match
 */
export function findDuplicateMatches(
  source,
  candidates,
  { sameHouseOnly = false } = {}
) {
  const src = readRowFields(source);
  if (!src.personId) return [];

  const srcFname = normPersonText(src.fname);
  const srcLname = normPersonText(src.lname);
  const srcCidValid = isValid13DigitCid(src.cid);

  const matches = [];
  for (const candRaw of candidates || []) {
    const cand = readRowFields(candRaw);
    if (!cand.personId || cand.personId === src.personId) continue;

    const sameHouse = Boolean(
      src.moo && src.house && cand.moo === src.moo && cand.house === src.house
    );
    if (sameHouseOnly && !sameHouse) continue;

    const candFname = normPersonText(cand.fname);
    const candLname = normPersonText(cand.lname);
    const candCidValid = isValid13DigitCid(cand.cid);

    let tier = null;
    if (srcCidValid && candCidValid && src.cid === cand.cid) {
      tier = { score: 100, matchCode: 'cid_exact', matchReason: 'เลขบัตร 13 หลักตรงกัน' };
    } else if (
      srcFname !== '' &&
      srcFname === candFname &&
      src.birthDate !== '' &&
      src.birthDate === cand.birthDate
    ) {
      tier = { score: 90, matchCode: 'fname_birth', matchReason: 'ชื่อและวันเกิดตรงกัน' };
    } else if (
      srcFname !== '' &&
      srcLname !== '' &&
      srcFname === candFname &&
      srcLname === candLname
    ) {
      tier = { score: 85, matchCode: 'fullname_exact', matchReason: 'ชื่อ-นามสกุลตรงกัน' };
    } else if (sameHouse && srcFname !== '' && srcFname === candFname) {
      tier = { score: 70, matchCode: 'same_house_fname', matchReason: 'ชื่อตรงกันในบ้านเดียวกัน' };
    }

    if (!tier) continue;

    matches.push({
      raw: candRaw,
      personId: cand.personId,
      fullname: cand.fullname,
      birthDate: cand.birthDate,
      moo: cand.moo,
      house: cand.house,
      cid: cand.cid,
      sameHouse,
      ...tier,
    });
  }

  matches.sort(
    (a, b) =>
      (b.sameHouse ? 1 : 0) - (a.sameHouse ? 1 : 0) ||
      b.score - a.score ||
      a.personId.localeCompare(b.personId)
  );
  return matches;
}

/** Match each temporary `P-...` member in a house against real HOSxP members in the same list. */
export function findHouseDuplicatePairs(houseMembers) {
  const members = Array.isArray(houseMembers) ? houseMembers : [];
  const temps = members.filter((m) => isTempNewPersonId(readRowFields(m).personId));
  const hosxp = members.filter((m) => isHosxpPersonId(readRowFields(m).personId));
  if (!temps.length || !hosxp.length) return [];

  const pairs = [];
  for (const tempRaw of temps) {
    const matches = findDuplicateMatches(tempRaw, hosxp);
    if (!matches.length) continue;
    const dupFields = readRowFields(tempRaw);
    const best = matches[0];
    pairs.push({
      dupPersonId: dupFields.personId,
      dup: dupFields,
      target: best,
      matchCode: best.matchCode,
      matchReason: best.matchReason,
      score: best.score,
    });
  }
  return pairs;
}

/** Map duplicate pairs keyed by temporary `dupPersonId`. */
export function mapHouseDuplicatesByDupId(houseMembers) {
  return Object.fromEntries(
    findHouseDuplicatePairs(houseMembers).map((pair) => [pair.dupPersonId, pair])
  );
}

/**
 * Compute a non-destructive update patch copying survey/screening/address fields
 * from `dupRow` (`P-...`) into `targetRow` (real HOSxP record).
 * Never overwrites non-empty fields on `targetRow` (except upgrading `relation` to `เจ้าบ้าน`,
 * or moving address when `moveTargetToDupHouse` is explicitly enabled).
 */
export function buildMergedPopulationPatch(
  targetRow,
  dupRow,
  { moveTargetToDupHouse = false } = {}
) {
  const t = targetRow || {};
  const d = dupRow || {};
  const patch = {};
  const transferredFields = [];

  if (isEmptySurveyValue(t.residency_type) && !isEmptySurveyValue(d.residency_type)) {
    const rt = String(d.residency_type).trim();
    patch.residency_type = rt;
    if (Number(d.status_model_version) === 1 && Number(t.status_model_version) !== 1) {
      patch.status_model_version = 1;
    }
    transferredFields.push(`ประเภทการอยู่อาศัย: ${rt}`);
  }

  if (isEmptySurveyValue(t.chronic) && !isEmptySurveyValue(d.chronic)) {
    const ch = String(d.chronic).trim();
    patch.chronic = ch;
    transferredFields.push(`โรคประจำตัว: ${ch}`);
  }

  const tRel = String(t.relation ?? '').trim();
  const dRel = String(d.relation ?? '').trim();
  if (dRel === 'เจ้าบ้าน' && tRel !== 'เจ้าบ้าน') {
    patch.relation = 'เจ้าบ้าน';
    transferredFields.push('สถานะในบ้าน: เจ้าบ้าน');
  } else if (
    (isEmptySurveyValue(tRel) || tRel === 'ไม่ระบุ') &&
    !isEmptySurveyValue(dRel) &&
    dRel !== 'ไม่ระบุ'
  ) {
    patch.relation = dRel;
    transferredFields.push(`สถานะในบ้าน: ${dRel}`);
  }

  const tBirth = normBirthDate(t.birth_date);
  const dBirth = normBirthDate(d.birth_date);
  if (!tBirth && dBirth) {
    patch.birth_date = dBirth;
    transferredFields.push(`วันเกิด: ${dBirth}`);
  }

  // Paired screening fields: only fill when target's value is empty
  const screeningPairs = [
    { screenCol: 'hep_screen', dateCol: 'hep_date', label: 'คัดกรอง HBV/HCV' },
    { screenCol: 'fobt_screen', dateCol: 'fobt_date', label: 'คัดกรองลำไส้ (FIT)' },
    { screenCol: 'hpv_screen', dateCol: 'hpv_date', label: 'คัดกรองปากมดลูก (HPV)' },
    { screenCol: 'child_dev', dateCol: 'child_date', label: 'พัฒนาการเด็ก' },
  ];
  for (const { screenCol, dateCol, label } of screeningPairs) {
    let copied = false;
    if (isEmptySurveyValue(t[screenCol]) && !isEmptySurveyValue(d[screenCol])) {
      patch[screenCol] = String(d[screenCol]).trim();
      copied = true;
    }
    const dDate = normBirthDate(d[dateCol]);
    if (!normBirthDate(t[dateCol]) && dDate) {
      patch[dateCol] = dDate;
      copied = true;
    }
    if (screenCol === 'child_dev') {
      const dDevDate = normBirthDate(d.child_dev_date);
      if (!normBirthDate(t.child_dev_date) && dDevDate) {
        patch.child_dev_date = dDevDate;
        copied = true;
      }
    }
    if (copied) transferredFields.push(label);
  }

  if (isEmptySurveyValue(t.smoking_status) && !isEmptySurveyValue(d.smoking_status)) {
    patch.smoking_status = String(d.smoking_status).trim();
    if (t.fagerstrom_score == null && d.fagerstrom_score != null) {
      patch.fagerstrom_score = d.fagerstrom_score;
    }
    if (isEmptySurveyValue(t.fagerstrom_answers) && !isEmptySurveyValue(d.fagerstrom_answers)) {
      patch.fagerstrom_answers = d.fagerstrom_answers;
    }
    transferredFields.push('คัดกรองบุหรี่');
  }

  if (isEmptySurveyValue(t.alcohol_status) && !isEmptySurveyValue(d.alcohol_status)) {
    patch.alcohol_status = String(d.alcohol_status).trim();
    if (t.assist_score == null && d.assist_score != null) {
      patch.assist_score = d.assist_score;
    }
    if (isEmptySurveyValue(t.assist_answers) && !isEmptySurveyValue(d.assist_answers)) {
      patch.assist_answers = d.assist_answers;
    }
    transferredFields.push('คัดกรองสุรา');
  }

  if (t.adl_score == null && d.adl_score != null) {
    patch.adl_score = d.adl_score;
    if (isEmptySurveyValue(t.adl_answers) && !isEmptySurveyValue(d.adl_answers)) {
      patch.adl_answers = d.adl_answers;
    }
    transferredFields.push('ประเมิน ADL');
  }

  const ovCols = ['ov_q1', 'ov_q2', 'ov_q3', 'ov_q4', 'ov_q5'];
  let ovCopied = false;
  for (const col of ovCols) {
    if (isEmptySurveyValue(t[col]) && !isEmptySurveyValue(d[col])) {
      patch[col] = String(d[col]).trim();
      ovCopied = true;
    }
  }
  const dOvDate = normBirthDate(d.ov_date);
  if (!normBirthDate(t.ov_date) && dOvDate) {
    patch.ov_date = dOvDate;
    ovCopied = true;
  }
  if (ovCopied) transferredFields.push('คัดกรองพยาธิใบไม้ตับ (OV)');

  const tMoo = String(t.moo ?? '').trim();
  const tHouse = String(t.house ?? '').trim();
  const dMoo = String(d.moo ?? '').trim();
  const dHouse = String(d.house ?? '').trim();
  if (
    moveTargetToDupHouse &&
    !isEmptySurveyValue(dMoo) &&
    !isEmptySurveyValue(dHouse) &&
    (tMoo !== dMoo || tHouse !== dHouse)
  ) {
    patch.moo = dMoo;
    patch.house = dHouse;
    const dVhv = String(d.vhv ?? '').trim();
    if (!isEmptySurveyValue(dVhv) && dVhv !== 'ไม่ระบุ') {
      patch.vhv = dVhv;
    }
    const lat = Number(d.latitude);
    const lng = Number(d.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
      patch.latitude = lat;
      patch.longitude = lng;
    }
    transferredFields.push(`ย้ายที่อยู่สำรวจมาบ้าน ${dHouse} ม.${dMoo}`);
  }

  patch.updated_at = new Date().toISOString();
  return { patch, transferredFields };
}
