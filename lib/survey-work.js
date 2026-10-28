import { populationStatus } from './population-status.js';
const clean = value => String(value ?? '').trim();
const thNumeric = new Intl.Collator('th', { numeric: true });
const thText = new Intl.Collator('th');
const rowCache = new WeakMap();

function normalizedRow(row) {
  if (row && typeof row === 'object') {
    const cached = rowCache.get(row);
    if (cached) return cached;
  }
  const state = populationStatus(row);
  const type = state.residencyType;
  const scoped = state.active && type !== '4';
  const entry = {
    scoped,
    type,
    done: type === '0' || type === '1' || type === '2' || type === '3',
    moo: clean(row?.moo),
    house: clean(row?.house),
    owner: vhvName(row?.vhv),
  };
  if (row && typeof row === 'object') rowCache.set(row, entry);
  return entry;
}

export const vhvName = value => !clean(value) || clean(value) === '-' ? 'ไม่ระบุ' : clean(value);

export function filterSurveyHouses(houses, status = 'all') {
  if (status === 'all') return houses;
  if (status === 'pending') return houses.filter(h => h.pending > 0);
  return houses.filter(h => h.status === status);
}

// Active residents in types 0–3 are surveyed; outside-area and discharged people are excluded.
export function summarizeSurvey(rows, moo = '', vhv = '', status = 'all') {
  const groups = new Map();
  for (const row of rows) {
    const r = normalizedRow(row);
    if (!r.scoped) continue;
    const { moo: village, house, owner, done } = r;
    if (moo && village !== moo) continue;
    if (vhv && owner !== vhv) continue;
    const key = JSON.stringify([village, house]);
    let group = groups.get(key);
    if (!group) {
      group = { key, moo: village, house, owners: new Set(), total: 0, done: 0, pending: 0 };
      groups.set(key, group);
    }
    group.owners.add(owner);
    group.total++;
    if (done) group.done++; else group.pending++;
  }
  const houses = [...groups.values()].map(group => ({ ...group, owners: [...group.owners], status: group.done === 0 ? 'notStarted' : group.pending ? 'partial' : 'complete' }));
  houses.sort((a, b) => b.pending - a.pending || thNumeric.compare(a.moo, b.moo) || thNumeric.compare(a.house, b.house));
  const totals = houses.reduce((sum, h) => ({ people: sum.people + h.total, pending: sum.pending + h.pending, houses: sum.houses + Number(Boolean(h.house) && h.house !== '-'), incomplete: sum.incomplete + Number(Boolean(h.house) && h.house !== '-' && h.pending > 0) }), { people: 0, pending: 0, houses: 0, incomplete: 0 });
  return { totals, houses: filterSurveyHouses(houses, status) };
}

// A household is counted once per village. Owner totals describe only the
// people assigned to that owner; shared households must not be added together.
export function summarizeStaffSurvey(rows) {
  const villages = new Map(), owners = new Map();
  const create = (key, moo, owner) => ({ key, moo, owner, people: 0, pendingPeople: 0, missingHousePeople: 0, missingHousePending: 0, homes: new Map() });
  const add = (group, house, done) => {
    group.people++;
    if (!done) group.pendingPeople++;
    if (!house || house === '-') {
      group.missingHousePeople++;
      if (!done) group.missingHousePending++;
      return;
    }
    let home = group.homes.get(house);
    if (!home) {
      home = { total: 0, done: 0 };
      group.homes.set(house, home);
    }
    home.total++;
    if (done) home.done++;
  };
  for (const row of rows) {
    const r = normalizedRow(row);
    if (!r.scoped) continue;
    const { moo, house, owner, done } = r;
    const ownerKey = JSON.stringify([moo, owner]);
    let villageGroup = villages.get(moo);
    if (!villageGroup) {
      villageGroup = create(moo, moo);
      villages.set(moo, villageGroup);
    }
    let ownerGroup = owners.get(ownerKey);
    if (!ownerGroup) {
      ownerGroup = create(ownerKey, moo, owner);
      owners.set(ownerKey, ownerGroup);
    }
    add(villageGroup, house, done);
    add(ownerGroup, house, done);
  }
  const finish = group => {
    const { homes, ...summary } = group;
    const list = [...homes.values()];
    const notStarted = list.filter(h => h.done === 0).length;
    const partial = list.filter(h => h.done > 0 && h.done < h.total).length;
    return { ...summary, houses: list.length, notStarted, partial, incomplete: notStarted + partial, complete: list.filter(h => h.done === h.total).length };
  };
  const byPending = (a, b) => b.incomplete - a.incomplete || b.pendingPeople - a.pendingPeople || thNumeric.compare(a.moo, b.moo) || thText.compare(a.owner || '', b.owner || '');
  return { villages: [...villages.values()].map(finish).sort(byPending), owners: [...owners.values()].map(finish).sort(byPending) };
}
