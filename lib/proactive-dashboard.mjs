// Proactive Dashboard & GIS Worklist Engine
// Computes:
// 1. Vulnerability Watchlist (Bedridden ADL 0-4, Homebound ADL 5-11, Elderly Living Alone, Child 0-5 Pending Dev, Multi-Chronic, Missing GPS Houses)
// 2. Village-filterable Population Pyramid & 4-tier Age Group Breakdown (0-5, 6-14, 15-59, 60+)
// 3. VHV Leaderboard with House GPS Coverage % + 4-KPI Screening Completion %
// 4. Drill-down Worklists for any KPI / Moo / Vulnerability / VHV (zero CID exposure)

const MALE_TITLES = new Set(['นาย', 'ด.ช.', 'เด็กชาย', 'ด.ช']);
const PYRAMID_LABELS = [
  '0-4', '5-9', '10-14', '15-19', '20-24', '25-29',
  '30-34', '35-39', '40-44', '45-49', '50-54', '55-59',
  '60-64', '65-69', '70-74', '75-79', '80+',
];

const thCollator = typeof Intl !== 'undefined'
  ? new Intl.Collator('th', { numeric: true, sensitivity: 'base' })
  : null;

export function compareThaiNumeric(a, b) {
  const sa = String(a ?? '').trim();
  const sb = String(b ?? '').trim();
  if (thCollator) return thCollator.compare(sa, sb);
  return sa.localeCompare(sb);
}

export function parseBirthInfo(birthDateStr, nowDate = new Date()) {
  if (!birthDateStr) return { years: null, byear: null };
  const str = String(birthDateStr).trim();
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return { years: null, byear: null };
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const byear = y > 2400 ? y - 543 : y;
  const nowY = nowDate.getFullYear();
  const nowM = nowDate.getMonth() + 1;
  const nowD = nowDate.getDate();
  let age = nowY - byear;
  if (nowM < mo || (nowM === mo && nowD < d)) age -= 1;
  if (age < 0 || age > 150) return { years: null, byear };
  return { years: age, byear };
}

export function parseChronicList(chronicRaw) {
  const s = String(chronicRaw ?? '').trim();
  if (!s || s === '-' || s === 'ปกติ' || s === 'ปกติ (ไม่มีโรค)') return [];
  const protectedSlash = s
    .replace(/หัวใจ\s*\/\s*หลอดเลือด/g, 'หัวใจ__SLASH__หลอดเลือด')
    .replace(/ถุงลมโป่งพอง\s*\/\s*หอบหืด/g, 'ถุงลมโป่งพอง__SLASH__หอบหืด')
    .replace(/จิตเวช\s*\+\s*ยาเสพติด/g, 'จิตเวช__PLUS__ยาเสพติด');

  const rawParts = protectedSlash
    .split(/[,/]+/)
    .map(part => part.trim())
    .filter(part => part && part !== '-' && part !== 'ปกติ' && part !== 'ปกติ (ไม่มีโรค)');

  const expanded = [];
  for (const part of rawParts) {
    if (/ความดัน\s*\+\s*เบาหวาน|เบาหวาน\s*\+\s*ความดัน|\bHT\s*\+\s*DM\b|\bDM\s*\+\s*HT\b/i.test(part)) {
      expanded.push('ความดันโลหิตสูง (HT)', 'เบาหวาน (DM)');
    } else if (part.includes('+')) {
      for (const sub of part.split('+').map(x => x.trim()).filter(Boolean)) {
        expanded.push(sub.replace(/__SLASH__/g, '/').replace(/__PLUS__/g, '+'));
      }
    } else {
      expanded.push(part.replace(/__SLASH__/g, '/').replace(/__PLUS__/g, '+'));
    }
  }
  return Array.from(new Set(expanded));
}

export function normalizePersonRecord(row, nowDate = new Date()) {
  const typ = String(row.residency_type ?? '').trim();
  const statusModel = Number(row.status_model_version ?? 0);
  const dischargeId = row.person_discharge_id == null ? null : Number(row.person_discharge_id);
  const active = statusModel === 1 ? dischargeId === 9 : !['0', '4'].includes(typ);
  const deceased = statusModel === 1 ? dischargeId === 1 : typ === '4';
  const moo = String(row.moo ?? '').trim();
  const house = String(row.house ?? '').trim();
  const vhv = String(row.vhv ?? '').trim();
  const title = String(row.title ?? '').trim();
  const fname = String(row.fname ?? '').trim();
  const lname = String(row.lname ?? '').trim();
  const fullName = `${title}${fname} ${lname}`.trim() || 'ไม่ระบุชื่อ';
  const male = MALE_TITLES.has(title);
  const { years, byear } = parseBirthInfo(row.birth_date, nowDate);

  const rawAdl = row.adl_score;
  const adlScore =
    rawAdl !== null && rawAdl !== undefined && String(rawAdl).trim() !== '' && Number.isFinite(Number(rawAdl))
      ? Number(rawAdl)
      : null;

  const lat = Number(row.latitude);
  const lng = Number(row.longitude);
  const hasGps = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;

  const chronicList = parseChronicList(row.chronic);
  const inKpiScope = active && (typ === '1' || typ === '3');

  const hepScreen = String(row.hep_screen ?? '').trim();
  const fobtScreen = String(row.fobt_screen ?? '').trim();
  const hpvScreen = String(row.hpv_screen ?? '').trim();
  const childDev = String(row.child_dev ?? '').trim();

  const hepEligible = inKpiScope && byear !== null && byear < 1992;
  const hepDone = hepEligible && hepScreen !== '' && hepScreen !== '-';

  const fobtEligible = inKpiScope && years !== null && years >= 50 && years <= 70;
  const fobtDone = fobtEligible && fobtScreen !== '' && fobtScreen !== '-';

  const hpvEligible = inKpiScope && !male && years !== null && years >= 30 && years <= 60;
  const hpvDone = hpvEligible && hpvScreen !== '' && hpvScreen !== '-';

  const childEligible = inKpiScope && years !== null && years >= 0 && years <= 5;
  const childDone = childEligible && childDev !== '' && childDev !== '-' && childDev !== 'รอผล';

  const chronicRaw = String(row.chronic ?? '').trim() || '-';

  return {
    person_id: String(row.person_id ?? ''),
    personId: String(row.person_id ?? ''),
    fullName,
    fullname: fullName,
    title,
    fname,
    lname,
    moo,
    house,
    houseKey: moo && moo !== '-' && house && house !== '-' ? `${moo}|${house}` : '',
    vhv: vhv && vhv !== '-' ? vhv : 'ยังไม่มอบหมาย',
    typ,
    active: active && typ !== '4',
    deceased,
    male,
    years,
    age: years,
    byear,
    adlScore,
    hasGps,
    latitude: hasGps ? lat : null,
    longitude: hasGps ? lng : null,
    chronicRaw,
    chronic: chronicRaw,
    chronicList,
    hepEligible,
    hepDone,
    hepScreen,
    fobtEligible,
    fobtDone,
    fobtScreen,
    hpvEligible,
    hpvDone,
    hpvScreen,
    childEligible,
    childDone,
    childDev,
  };
}

export function isMultiChronicResident(r) {
  return Boolean(r.active && (r.typ === '1' || r.typ === '3') && r.chronicList.length >= 2);
}

export function isBedriddenElder(r) {
  return Boolean(r.active && (r.typ === '1' || r.typ === '3') && r.years >= 60 && r.adlScore != null && r.adlScore >= 0 && r.adlScore <= 4);
}

export function isHomeboundElder(r) {
  return Boolean(r.active && (r.typ === '1' || r.typ === '3') && r.years >= 60 && r.adlScore != null && r.adlScore >= 5 && r.adlScore <= 11);
}

export function buildProactiveAnalytics(rawRows = [], nowDate = new Date()) {
  const records = rawRows.map(r => normalizePersonRecord(r, nowDate)).filter(r => r.active);

  // Build houseMap keyed by "moo|house"
  const houseMap = new Map();
  for (const r of records) {
    if (!r.houseKey) continue;
    if (!houseMap.has(r.houseKey)) {
      houseMap.set(r.houseKey, {
        key: r.houseKey,
        moo: r.moo,
        house: r.house,
        vhv: r.vhv,
        hasGps: false,
        members: [],
      });
    }
    const h = houseMap.get(r.houseKey);
    h.members.push(r);
    if (r.hasGps) h.hasGps = true;
    if ((h.vhv === 'ยังไม่มอบหมาย' || !h.vhv) && r.vhv && r.vhv !== 'ยังไม่มอบหมาย') {
      h.vhv = r.vhv;
    }
  }

  // Propagate house-level GPS availability and Living Alone detection
  // Living Alone: house where active Type 1 residents count === 1 (and no other Type 1/3 residents), age >= 60
  for (const h of houseMap.values()) {
    const residingMembers = h.members.filter(m => m.typ === '1' || m.typ === '3');
    const type1Members = h.members.filter(m => m.typ === '1');
    const isSingleType1House = type1Members.length === 1 && residingMembers.length === 1;
    for (const m of h.members) {
      m.houseHasGps = h.hasGps;
      m.hasGps = h.hasGps;
      if (isSingleType1House && m.typ === '1' && m.years !== null && m.years >= 60) {
        m.isLivingAlone = true;
      } else {
        m.isLivingAlone = false;
      }
    }
  }

  // Distinct sorted moos
  const mooSet = new Set();
  for (const r of records) {
    if (r.moo && r.moo !== '-') mooSet.add(r.moo);
  }
  const mooList = Array.from(mooSet).sort(compareThaiNumeric);

  // Build KPI & Vulnerability Pending Matrix by Moo
  const kpiPendingByMoo = mooList.map(moo => {
    const mooRecs = records.filter(r => r.moo === moo && (r.typ === '1' || r.typ === '3'));
    const mooHouses = Array.from(houseMap.values()).filter(h => h.moo === moo);
    let hepTarget = 0, hepPending = 0;
    let fobtTarget = 0, fobtPending = 0;
    let hpvTarget = 0, hpvPending = 0;
    let childTarget = 0, childPending = 0;
    let bedridden = 0, homebound = 0, livingAlone = 0;

    for (const r of mooRecs) {
      if (r.hepEligible) { hepTarget++; if (!r.hepDone) hepPending++; }
      if (r.fobtEligible) { fobtTarget++; if (!r.fobtDone) fobtPending++; }
      if (r.hpvEligible) { hpvTarget++; if (!r.hpvDone) hpvPending++; }
      if (r.childEligible) { childTarget++; if (!r.childDone) childPending++; }
      if (isBedriddenElder(r)) bedridden++;
      else if (isHomeboundElder(r)) homebound++;
      if (r.isLivingAlone) livingAlone++;
    }

    const missingGps = mooHouses.filter(h => !h.hasGps).length;

    return {
      moo,
      totalActive: mooRecs.length,
      multiChronic: mooRecs.filter(isMultiChronicResident).length,
      hepTarget,
      hepPending,
      fobtTarget,
      fobtPending,
      hpvTarget,
      hpvPending,
      childTarget,
      childPending,
      bedridden,
      homebound,
      livingAlone,
      missingGps,
    };
  });

  // VHV Leaderboard aggregation
  const vhvMap = new Map();
  for (const r of records) {
    const key = r.vhv;
    if (!vhvMap.has(key)) {
      vhvMap.set(key, {
        name: key,
        moos: new Set(),
        houses: new Set(),
        gpsHouses: new Set(),
        people: 0,
        elderly: 0,
        chronicPeople: 0,
        kpiTotal: 0,
        kpiDone: 0,
        hepPending: 0,
        fobtPending: 0,
        hpvPending: 0,
        childPending: 0,
      });
    }
    const v = vhvMap.get(key);
    if (r.moo && r.moo !== '-') v.moos.add(r.moo);
    if (r.houseKey) {
      v.houses.add(r.houseKey);
      if (r.houseHasGps) v.gpsHouses.add(r.houseKey);
    }
    v.people += 1;
    if (r.years !== null && r.years >= 60) v.elderly += 1;
    if (r.chronicList.length > 0) v.chronicPeople += 1;

    if (r.hepEligible) {
      v.kpiTotal += 1;
      if (r.hepDone) v.kpiDone += 1;
      else v.hepPending += 1;
    }
    if (r.fobtEligible) {
      v.kpiTotal += 1;
      if (r.fobtDone) v.kpiDone += 1;
      else v.fobtPending += 1;
    }
    if (r.hpvEligible) {
      v.kpiTotal += 1;
      if (r.hpvDone) v.kpiDone += 1;
      else v.hpvPending += 1;
    }
    if (r.childEligible) {
      v.kpiTotal += 1;
      if (r.childDone) v.kpiDone += 1;
      else v.childPending += 1;
    }
  }

  const vhvLeaderboard = Array.from(vhvMap.values())
    .map(v => {
      const houseCount = v.houses.size;
      const gpsHouseCount = v.gpsHouses.size;
      const missingGpsHouses = Math.max(0, houseCount - gpsHouseCount);
      const gpsPct = houseCount > 0 ? Number(((gpsHouseCount / houseCount) * 100).toFixed(1)) : 0;
      const kpiPct = v.kpiTotal > 0 ? Number(((v.kpiDone / v.kpiTotal) * 100).toFixed(1)) : 100;
      const kpiPending = Math.max(0, v.kpiTotal - v.kpiDone);
      const moos = Array.from(v.moos).sort(compareThaiNumeric);
      const overallScore = Number((gpsPct * 0.4 + kpiPct * 0.6).toFixed(1));
      return {
        name: v.name,
        moos,
        mooList: moos,
        mooLabel: moos.length ? moos.join(', ') : '-',
        houseCount,
        gpsHouseCount,
        missingGpsHouses,
        gpsPct,
        people: v.people,
        peopleCount: v.people,
        elderly: v.elderly,
        chronicPeople: v.chronicPeople,
        kpiTotal: v.kpiTotal,
        kpiTargetCount: v.kpiTotal,
        kpiDone: v.kpiDone,
        kpiCompleteCount: v.kpiDone,
        kpiPending,
        kpiPct,
        hepPending: v.hepPending,
        fobtPending: v.fobtPending,
        hpvPending: v.hpvPending,
        childPending: v.childPending,
        overallScore,
      };
    })
    .sort((a, b) => {
      if (a.name === 'ยังไม่มอบหมาย') return 1;
      if (b.name === 'ยังไม่มอบหมาย') return -1;
      return b.overallScore - a.overallScore || b.houseCount - a.houseCount || compareThaiNumeric(a.name, b.name);
    });

  let totalGpsHouses = 0;
  for (const h of houseMap.values()) {
    if (h.hasGps) totalGpsHouses++;
  }

  return {
    records,
    houseMap,
    moos: mooList,
    mooList,
    kpiPendingByMoo,
    vhvLeaderboard,
    totalGpsHouses,
    totalDistinctHouses: houseMap.size,
  };
}

export function computeMooAgeAndVulnerability(records = [], houseMapOrMoo = 'all', maybeMoo = undefined) {
  const selectedMoo =
    typeof houseMapOrMoo === 'string' || typeof houseMapOrMoo === 'number'
      ? String(houseMapOrMoo)
      : String(maybeMoo ?? 'all');
  const isAll = !selectedMoo || selectedMoo.toLowerCase() === 'all';
  const filtered = isAll
    ? records.filter(r => r.typ === '1' || r.typ === '3')
    : records.filter(r => r.moo === selectedMoo && (r.typ === '1' || r.typ === '3'));

  const maleBins = Array(17).fill(0);
  const femaleBins = Array(17).fill(0);
  const ageGroups = {
    child0to5: 0,
    school6to14: 0,
    working15to59: 0,
    elderly60plus: 0,
    earlyChildhood_0_5: 0,
    schoolAge_6_14: 0,
    workingAge_15_59: 0,
    elderly_60_plus: 0,
  };

  const watchlist = {
    bedridden: [],        // ADL 0-4
    homebound: [],        // ADL 5-11
    livingAlone: [],      // Age 60+ living alone (Type 1)
    childPending: [],     // Age 0-5 pending child_dev
    multiChronic: [],     // >= 2 chronic diseases
    missingGpsHouses: [], // Distinct houses without GPS
  };

  const houseSet = new Set();

  for (const r of filtered) {
    if (r.houseKey) houseSet.add(r.houseKey);

    if (r.years !== null) {
      const bin = Math.min(Math.floor(r.years / 5), 16);
      if (r.male) maleBins[bin] += 1;
      else femaleBins[bin] += 1;

      if (r.years <= 5) {
        ageGroups.child0to5 += 1;
        ageGroups.earlyChildhood_0_5 += 1;
      } else if (r.years <= 14) {
        ageGroups.school6to14 += 1;
        ageGroups.schoolAge_6_14 += 1;
      } else if (r.years <= 59) {
        ageGroups.working15to59 += 1;
        ageGroups.workingAge_15_59 += 1;
      } else {
        ageGroups.elderly60plus += 1;
        ageGroups.elderly_60_plus += 1;
      }
    }

    if (isBedriddenElder(r)) {
      watchlist.bedridden.push(r);
    } else if (isHomeboundElder(r)) {
      watchlist.homebound.push(r);
    }

    if (r.isLivingAlone) {
      watchlist.livingAlone.push(r);
    }

    if (r.childEligible && !r.childDone) {
      watchlist.childPending.push(r);
    }

    if (isMultiChronicResident(r)) {
      watchlist.multiChronic.push(r);
    }

      }

  watchlist.missingGpsHouses = buildDrilldownList(records, { filterKey: 'missing_gps', moo: selectedMoo }).items;

return {
    totalFiltered: filtered.length,
    totalActive: filtered.length,
    totalHouses: houseSet.size,
    pyramid: {
      labels: PYRAMID_LABELS,
      male: maleBins,
      female: femaleBins,
    },
    ageGroups,
    watchlist,
  };
}

export function buildDrilldownList(records = [], houseMapOrSpec = {}, maybeSpec = undefined) {
  const filterSpec =
    houseMapOrSpec instanceof Map ? (maybeSpec || {}) : (houseMapOrSpec || {});
  const filterKey = filterSpec.filterKey || filterSpec.type || '';
  const moo = filterSpec.moo ?? 'all';
  const vhv = filterSpec.vhv ?? '';

  let base = records;
  if (moo && String(moo).toLowerCase() !== 'all') {
    base = base.filter(r => r.moo === String(moo));
  }
  if (vhv && String(vhv).toLowerCase() !== 'all') {
    base = base.filter(r => r.vhv === String(vhv));
  }

  let items = [];
  let title = '';
  let mapFilter = filterKey;

  switch (filterKey) {
    case 'bedridden':
      title = 'ผู้สูงอายุติดเตียง (ADL 0–4 คะแนน)';
      items = base
        .filter(r => isBedriddenElder(r))
        .map(r => ({ ...r, badge: `ADL ${r.adlScore} (ติดเตียง)` }));
      break;
    case 'homebound':
      title = 'ผู้สูงอายุติดบ้าน (ADL 5–11 คะแนน)';
      items = base
        .filter(r => isHomeboundElder(r))
        .map(r => ({ ...r, badge: `ADL ${r.adlScore} (ติดบ้าน)` }));
      break;
    case 'living_alone':
      title = 'ผู้สูงอายุ 60+ ปี ที่อาศัยอยู่คนเดียว (Living Alone)';
      items = base
        .filter(r => r.isLivingAlone)
        .map(r => ({
          ...r,
          badge: r.chronicList.length ? `อยู่คนเดียว • ${r.chronicList.join(', ')}` : 'อยู่คนเดียว (Type 1)',
        }));
      break;
    case 'child_pending':
      title = 'เด็กเล็ก 0–5 ปี ที่ยังไม่ได้ตรวจพัฒนาการ (DSPM)';
      items = base
        .filter(r => r.childEligible && !r.childDone)
        .map(r => ({ ...r, badge: r.childDev || 'ค้างตรวจพัฒนาการเด็ก' }));
      break;
    case 'multi_chronic':
      title = 'ผู้ป่วยโรคเรื้อรังซับซ้อน (ตั้งแต่ 2 โรคขึ้นไป)';
      items = base
        .filter(isMultiChronicResident)
        .map(r => ({ ...r, badge: r.chronicList.join(' + ') }));
      break;
    case 'missing_gps': {
      title = 'หลังคาเรือนที่ยังไม่ได้ปักหมุดพิกัด GPS';
      const seenHouse = new Set();
      items = [];
      for (const r of base) {
        if (r.houseKey && !r.houseHasGps && !seenHouse.has(r.houseKey)) {
          seenHouse.add(r.houseKey);
          items.push({
            ...r,
            fullname: `บ้านเลขที่ ${r.house} (ตัวแทน: ${r.fullName})`,
            badge: 'ยังไม่มีพิกัด GPS',
            hasGps: false,
          });
        }
      }
      break;
    }
    case 'hep_pending':
      title = 'ค้างคัดกรองไวรัสตับอักเสบ B/C (เกิดก่อน พ.ศ. 2535)';
      items = base
        .filter(r => r.hepEligible && !r.hepDone)
        .map(r => ({ ...r, badge: 'ค้างตรวจ HBV/HCV' }));
      break;
    case 'fobt_pending':
      title = 'ค้างคัดกรองมะเร็งลำไส้ใหญ่ FIT Test (อายุ 50–70 ปี)';
      items = base
        .filter(r => r.fobtEligible && !r.fobtDone)
        .map(r => ({ ...r, badge: 'ค้างตรวจ FIT Test (FOBT)' }));
      break;
    case 'hpv_pending':
      title = 'ค้างคัดกรองมะเร็งปากมดลูก HPV DNA (สตรีอายุ 30–60 ปี)';
      items = base
        .filter(r => r.hpvEligible && !r.hpvDone)
        .map(r => ({ ...r, badge: 'ค้างตรวจ HPV DNA' }));
      break;
    case 'vhv_pending':
    case 'vhv_worklist':
      title = `ใบงานบ้านค้างพิกัด GPS / ค้างคัดกรอง 4 KPI (${vhv || 'อสม.'})`;
      mapFilter = 'vhv_pending';
      items = base
        .filter(
          r =>
            !r.houseHasGps ||
            (r.hepEligible && !r.hepDone) ||
            (r.fobtEligible && !r.fobtDone) ||
            (r.hpvEligible && !r.hpvDone) ||
            (r.childEligible && !r.childDone)
        )
        .map(r => {
          const tags = [];
          if (!r.houseHasGps) tags.push('ไม่มีพิกัด GPS');
          if (r.hepEligible && !r.hepDone) tags.push('ค้าง HEP');
          if (r.fobtEligible && !r.fobtDone) tags.push('ค้าง FIT');
          if (r.hpvEligible && !r.hpvDone) tags.push('ค้าง HPV');
          if (r.childEligible && !r.childDone) tags.push('ค้างพัฒนาการเด็ก');
          return { ...r, badge: tags.join(' • ') };
        });
      break;
    default:
      items = [];
  }

  items.sort(
    (a, b) =>
      compareThaiNumeric(a.moo, b.moo) ||
      compareThaiNumeric(a.house, b.house) ||
      compareThaiNumeric(a.fullName, b.fullName)
  );

  const distinctHouses = new Set();
  for (const item of items) {
    if (item.houseKey) distinctHouses.add(item.houseKey);
    else if (item.moo && item.house) distinctHouses.add(`${item.moo}|${item.house}`);
  }

  return {
    title,
    moo,
    vhv,
    mapFilter,
    items,
    houseSummary: Array.from(distinctHouses),
  };
}
