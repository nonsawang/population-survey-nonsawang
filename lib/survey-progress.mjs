export const SURVEY_LABELS = { notStarted: '⚪ ยังไม่สำรวจ', partial: '🟠 ข้อมูลยังไม่ครบ / รอยืนยัน', complete: '✅ สำรวจครบ' };
export function inProgressScope(row) {
  return Number(row.status_model_version) === 1 && Number(row.person_discharge_id) === 9 && String(row.residency_type ?? '') !== '4';
}
export function surveyHouses(rows) {
  const houses = new Map();
  for (const row of rows) {
    if (!inProgressScope(row)) continue;
    const key = JSON.stringify([row.moo, row.house]);
    if (!houses.has(key)) houses.set(key, { key, moo: row.moo, house: row.house, members: [], pinned: false });
    const house = houses.get(key);
    house.members.push(row);
    const lat = Number(row.latitude), lon = Number(row.longitude);
    house.pinned ||= Number.isFinite(lat) && Number.isFinite(lon) && lat !== 0 && lon !== 0 && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  }
  const order = { notStarted: 0, partial: 1, complete: 2 };
  return [...houses.values()].map(h => {
    h.members.sort((a,b) => order[a.status] - order[b.status] || String(a.fname || '').localeCompare(String(b.fname || ''),'th'));
    h.done = h.members.filter(p => p.status === 'complete').length;
    h.pending = h.members.length - h.done;
    h.status = h.done === h.members.length ? 'complete' : h.members.every(p => p.status === 'notStarted') ? 'notStarted' : 'partial';
    return h;
  }).sort((a,b) => b.pending-a.pending || String(a.moo).localeCompare(String(b.moo),'th',{numeric:true}) || String(a.house).localeCompare(String(b.house),'th',{numeric:true}));
}
export function surveyLink(moo, house, personId) {
  return '/?' + new URLSearchParams({ moo: String(moo), house: String(house), ...(personId ? {person: String(personId), edit: '1'} : {}) });
}
export async function loadSurveyProgress(client, moo = null, house = null) {
  const rows = []; let after = null;
  for (;;) {
    const { data, error } = await client.rpc('survey_progress_list', { p_moo: moo, p_house: house, p_after: after });
    if (error) throw new Error(['PGRST202','42883'].includes(error.code) ? 'ต้องติดตั้ง migration 20261113_survey_confirmation.sql ก่อนใช้สถานะยืนยันสำรวจ' : 'โหลดหลักฐานสำรวจไม่สำเร็จ กรุณาลองใหม่');
    if (!Array.isArray(data)) throw new Error('รูปแบบหลักฐานสำรวจไม่ถูกต้อง');
    rows.push(...data);
    if (data.length < 500) return rows;
    const next = data.at(-1).person_id;
    if (!next || next === after) throw new Error('โหลดหลักฐานสำรวจไม่ครบ กรุณาลองใหม่');
    after = next;
  }
}
