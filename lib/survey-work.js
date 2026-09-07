const clean = value => String(value ?? '').trim();
export const vhvName = value => !clean(value) || clean(value) === '-' ? 'ไม่ระบุ' : clean(value);

// Match the dashboard: types 0 and 4 are excluded; types 1–3 are surveyed.
export function summarizeSurvey(rows, moo = '', vhv = '', status = 'all') {
  const groups = new Map();
  for (const row of rows) {
    const type = clean(row.residency_type);
    if (type === '0' || type === '4') continue;
    const village = clean(row.moo), house = clean(row.house), owner = vhvName(row.vhv);
    if (moo && village !== moo) continue;
    if (vhv && owner !== vhv) continue;
    const key = JSON.stringify([village, house]);
    if (!groups.has(key)) groups.set(key, { key, moo: village, house, owners: new Set(), total: 0, done: 0, pending: 0 });
    const group = groups.get(key);
    group.owners.add(owner);
    group.total++;
    if (['1', '2', '3'].includes(type)) group.done++; else group.pending++;
  }
  const houses = [...groups.values()].map(group => ({ ...group, owners: [...group.owners], status: group.done === 0 ? 'notStarted' : group.pending ? 'partial' : 'complete' }));
  houses.sort((a, b) => b.pending - a.pending || a.moo.localeCompare(b.moo, 'th', { numeric: true }) || a.house.localeCompare(b.house, 'th', { numeric: true }));
  const totals = houses.reduce((sum, h) => ({ people: sum.people + h.total, pending: sum.pending + h.pending, houses: sum.houses + Number(Boolean(h.house) && h.house !== '-'), incomplete: sum.incomplete + Number(Boolean(h.house) && h.house !== '-' && h.pending > 0) }), { people: 0, pending: 0, houses: 0, incomplete: 0 });
  return { totals, houses: houses.filter(h => status === 'all' || (status === 'pending' ? h.pending > 0 : h.status === status)) };
}

// A household is counted once per village. Owner totals describe only the
// people assigned to that owner; shared households must not be added together.
export function summarizeStaffSurvey(rows) {
  const villages = new Map(), owners = new Map();
  const create = (key, moo, owner) => ({ key, moo, owner, people: 0, pendingPeople: 0, missingHousePeople: 0, missingHousePending: 0, homes: new Map() });
  const add = (group, row, done) => {
    group.people++;
    if (!done) group.pendingPeople++;
    const house = clean(row.house);
    if (!house || house === '-') {
      group.missingHousePeople++;
      if (!done) group.missingHousePending++;
      return;
    }
    if (!group.homes.has(house)) group.homes.set(house, { total: 0, done: 0 });
    const home = group.homes.get(house);
    home.total++;
    if (done) home.done++;
  };
  for (const row of rows) {
    const type = clean(row.residency_type);
    if (type === '0' || type === '4') continue;
    const moo = clean(row.moo), owner = vhvName(row.vhv);
    const ownerKey = JSON.stringify([moo, owner]);
    if (!villages.has(moo)) villages.set(moo, create(moo, moo));
    if (!owners.has(ownerKey)) owners.set(ownerKey, create(ownerKey, moo, owner));
    const done = ['1', '2', '3'].includes(type);
    add(villages.get(moo), row, done);
    add(owners.get(ownerKey), row, done);
  }
  const finish = group => {
    const { homes, ...summary } = group;
    const list = [...homes.values()];
    const notStarted = list.filter(h => h.done === 0).length;
    const partial = list.filter(h => h.done > 0 && h.done < h.total).length;
    return { ...summary, houses: list.length, notStarted, partial, incomplete: notStarted + partial, complete: list.filter(h => h.done === h.total).length };
  };
  const byPending = (a, b) => b.incomplete - a.incomplete || b.pendingPeople - a.pendingPeople || a.moo.localeCompare(b.moo, 'th', { numeric: true }) || (a.owner || '').localeCompare(b.owner || '', 'th');
  return { villages: [...villages.values()].map(finish).sort(byPending), owners: [...owners.values()].map(finish).sort(byPending) };
}
