export const SURVEY_LABELS = {
  notStarted: '⚪ ยังไม่เริ่มสำรวจ',
  partial: '🟠 ข้อมูลยังไม่ครบ / รอยืนยัน',
  complete: '✅ สำรวจครบ',
};

export const PERSON_STAGE_LABELS = {
  complete: '✅ ยืนยันสำรวจแล้ว',
  awaitingConfirm: '🔵 ข้อมูลครบ รอกดยืนยัน',
  incomplete: '🟠 ข้อมูลไม่ครบ',
  notStarted: '⚪ ยังไม่เริ่มยืนยันสำรวจ',
};

export function isLegacyOrMissingStatus(row) {
  return (
    Number(row?.status_model_version) !== 1 ||
    ![1, 2, 3, 9].includes(Number(row?.person_discharge_id))
  );
}

export function inProgressScope(row) {
  if (!row) return false;
  const discharge = Number(row.person_discharge_id);
  const rawType = String(row.residency_type ?? '').trim();
  // ตัดผู้ที่ระบุจำหน่ายชัดเจนแล้ว (1=เสียชีวิต, 2=ย้าย, 3=สาบสูญ)
  if ([1, 2, 3].includes(discharge)) return false;
  // หากแปลงเป็นโมเดลสถานะใหม่แล้ว และระบุเป็น Type 4 (บุคคลนอกเขต) ให้ตัดออก
  if (Number(row.status_model_version) === 1 && rawType === '4') return false;
  // หากยังเป็นข้อมูลสถานะแบบเก่า (status_model_version !== 1) และเป็น Type 4 เดิม (เสียชีวิต) ให้ตัดออก
  // ส่วน Type 0 เดิม หรือคนที่ยังไม่ระบุสถานะจำหน่าย ให้รวมไว้ในยอดค้างเพื่อไม่ให้ตกหล่น
  if (Number(row.status_model_version) !== 1 && rawType === '4') return false;
  return true;
}

export function classifySurveyMember(row) {
  if (row?.status === 'complete') return 'complete';
  const hasMissing = Array.isArray(row?.missing) && row.missing.length > 0;
  if (row?.status === 'notStarted') return 'notStarted';
  if (hasMissing) return 'incomplete';
  return 'awaitingConfirm';
}

export function summarizeSurveyMembers(members) {
  let done = 0;
  let notStarted = 0;
  let incomplete = 0;
  let awaitingConfirm = 0;
  let needsStatusReview = 0;

  for (const p of members) {
    if (p.status === 'complete') {
      done += 1;
      continue;
    }
    const hasMissing = Array.isArray(p.missing) && p.missing.length > 0;
    if (p.status === 'notStarted') {
      notStarted += 1;
    }
    if (hasMissing) {
      incomplete += 1;
    } else {
      awaitingConfirm += 1;
    }
    if (isLegacyOrMissingStatus(p)) {
      needsStatusReview += 1;
    }
  }

  return {
    total: members.length,
    done,
    pending: members.length - done,
    notStarted,
    incomplete,
    awaitingConfirm,
    needsStatusReview,
  };
}

export function surveyHouses(rows) {
  const houses = new Map();
  for (const row of rows) {
    if (!inProgressScope(row)) continue;
    const key = JSON.stringify([row.moo, row.house]);
    if (!houses.has(key)) {
      houses.set(key, { key, moo: row.moo, house: row.house, members: [], pinned: false });
    }
    const house = houses.get(key);
    house.members.push(row);
    const lat = Number(row.latitude);
    const lon = Number(row.longitude);
    house.pinned ||=
      Number.isFinite(lat) &&
      Number.isFinite(lon) &&
      lat !== 0 &&
      lon !== 0 &&
      Math.abs(lat) <= 90 &&
      Math.abs(lon) <= 180;
  }
  const order = { notStarted: 0, partial: 1, complete: 2 };
  return [...houses.values()]
    .map((h) => {
      h.members.sort(
        (a, b) =>
          order[a.status] - order[b.status] ||
          String(a.fname || '').localeCompare(String(b.fname || ''), 'th')
      );
      const summary = summarizeSurveyMembers(h.members);
      h.done = summary.done;
      h.pending = summary.pending;
      h.notStartedCount = summary.notStarted;
      h.incompleteCount = summary.incomplete;
      h.awaitingConfirmCount = summary.awaitingConfirm;
      h.needsStatusReviewCount = summary.needsStatusReview;
      h.status =
        h.done === h.members.length
          ? 'complete'
          : h.members.every((p) => p.status === 'notStarted')
          ? 'notStarted'
          : 'partial';
      return h;
    })
    .sort(
      (a, b) =>
        b.pending - a.pending ||
        String(a.moo).localeCompare(String(b.moo), 'th', { numeric: true }) ||
        String(a.house).localeCompare(String(b.house), 'th', { numeric: true })
    );
}

export function surveyLink(moo, house, personId) {
  return (
    '/?' +
    new URLSearchParams({
      moo: String(moo),
      house: String(house),
      ...(personId ? { person: String(personId), edit: '1' } : {}),
    })
  );
}

export async function loadSurveyProgress(client, moo = null, house = null) {
  const rows = [];
  let after = null;
  for (;;) {
    const { data, error } = await client.rpc('survey_progress_list', {
      p_moo: moo,
      p_house: house,
      p_after: after,
    });
    if (error) {
      throw new Error(
        ['PGRST202', '42883'].includes(error.code)
          ? 'ต้องติดตั้ง migration 20261113_survey_confirmation.sql ก่อนใช้สถานะยืนยันสำรวจ'
          : 'โหลดหลักฐานสำรวจไม่สำเร็จ กรุณาลองใหม่'
      );
    }
    if (!Array.isArray(data)) throw new Error('รูปแบบหลักฐานสำรวจไม่ถูกต้อง');
    rows.push(...data);
    if (data.length < 500) return rows;
    const next = data.at(-1).person_id;
    if (!next || next === after) throw new Error('โหลดหลักฐานสำรวจไม่ครบ กรุณาลองใหม่');
    after = next;
  }
}
