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
  const totals = houses.reduce((sum, h) => ({ people: sum.people + h.total, pending: sum.pending + h.pending, houses: sum.houses + 1, incomplete: sum.incomplete + Number(h.pending > 0) }), { people: 0, pending: 0, houses: 0, incomplete: 0 });
  return { totals, houses: houses.filter(h => status === 'all' || (status === 'pending' ? h.pending > 0 : h.status === status)) };
}
