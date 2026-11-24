import {
  authResponse,
  currentUser,
  databaseConfig,
  getSessionToken,
  sameOrigin,
  readBody,
  isReadOnly,
  readOnlyResponse,
} from '@/lib/server-auth';
import {
  isTempNewPersonId,
  isHosxpPersonId,
  findDuplicateMatches,
  buildMergedPopulationPatch,
} from '@/lib/person-duplicate-merge.mjs';

export const dynamic = 'force-dynamic';

function isValidThaiCid(value) {
  const s = String(value || '').trim();
  if (!/^\d{13}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(s[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(s[12]);
}

function normName(s) {
  return String(s || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function isActiveRecord(row) {
  const discharge = Number(row.person_discharge_id);
  if ([1, 2, 3].includes(discharge)) return false;
  if (Number(row.status_model_version) !== 1 && String(row.residency_type) === '4') return false;
  return true;
}

async function fetchAllPages(url, basePath, keyCol, headers, pageSize = 1000) {
  const all = [];
  let offset = 0;
  for (let i = 0; i < 15; i++) {
    const sep = basePath.includes('?') ? '&' : '?';
    const res = await fetch(`${url}${basePath}${sep}limit=${pageSize}&offset=${offset}`, {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) break;
    const chunk = await res.json();
    if (!Array.isArray(chunk) || !chunk.length) break;
    all.push(...chunk);
    if (chunk.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return authResponse({ error: 'กรุณาเข้าสู่ระบบ' }, 401);

    const { url, key } = databaseConfig(true);
    const headers = { apikey: key, Authorization: `Bearer ${key}` };

    const popQuery = new URLSearchParams({
      person_id: 'like.P-*',
      select:
        'person_id,cid,title,fname,lname,birth_date,moo,house,vhv,relation,residency_type,person_discharge_id,status_model_version,chronic,latitude,longitude,updated_at',
      order: 'moo.asc,house.asc,fname.asc',
      limit: '5000',
    });

    const candQuery = new URLSearchParams({
      population_id: 'like.P-*',
      select: 'population_id,target_id,base_status,display_status',
      limit: '5000',
    });

    const batchQuery = new URLSearchParams({
      completed_at: 'not.is.null',
      select: 'id,source_name,captured_at,expected_count',
      order: 'captured_at.desc',
      limit: '1',
    });

    const houseBatchQuery = new URLSearchParams({
      completed_at: 'not.is.null',
      select: 'id,captured_at',
      order: 'captured_at.desc',
      limit: '1',
    });

    const [popRes, candRes, batchRes, houseBatchRes] = await Promise.all([
      fetch(`${url}/rest/v1/population?${popQuery}`, {
        headers,
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      }),
      fetch(`${url}/rest/v1/hosxp_review_candidates?${candQuery}`, {
        headers,
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      }).catch(() => null),
      fetch(`${url}/rest/v1/hosxp_review_batches?${batchQuery}`, {
        headers,
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      }).catch(() => null),
      fetch(`${url}/rest/v1/house_gps_batches?${houseBatchQuery}`, {
        headers,
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      }).catch(() => null),
    ]);

    if (!popRes.ok) {
      return authResponse({ error: 'โหลดข้อมูลผู้ที่ถูกเพิ่มใหม่ไม่สำเร็จ' }, 503);
    }

    const rawPop = await popRes.json();
    const rawCands = candRes && candRes.ok ? await candRes.json() : [];
    const rawBatches = batchRes && batchRes.ok ? await batchRes.json() : [];
    const rawHouseBatches = houseBatchRes && houseBatchRes.ok ? await houseBatchRes.json() : [];
    const snapshot = rawBatches?.[0] || null;
    const houseBatch = rawHouseBatches?.[0] || null;

    // Load HOSxP house snapshot addresses to detect newly added houses on web that don't exist in HOSxP house table
    const hosxpHouseSet = new Set();
    if (houseBatch?.id) {
      const snapHouses = await fetchAllPages(
        url,
        `/rest/v1/house_gps_snapshot?batch_id=eq.${encodeURIComponent(
          houseBatch.id
        )}&select=moo,address,house_id&order=house_id.asc`,
        'house_id',
        headers,
        1000
      );
      for (const sh of snapHouses) {
        hosxpHouseSet.add(`${String(sh.moo || '').trim()}|${String(sh.address || '').trim()}`);
      }
    }

    const candMap = new Map();
    if (Array.isArray(rawCands)) {
      for (const c of rawCands) {
        candMap.set(c.population_id, c);
      }
    }

    const cidCounts = new Map();
    for (const r of rawPop || []) {
      const c = String(r.cid || '').trim();
      if (isValidThaiCid(c)) cidCounts.set(c, (cidCounts.get(c) || 0) + 1);
    }

    const allowedMoos =
      user.role === 'vhv'
        ? new Set(
            String(user.moo || '')
              .split(',')
              .map((m) => m.trim())
              .filter(Boolean)
          )
        : null;
    const vhvDisplay = normName(user.displayName);

    const counts = {
      total: 0,
      ready_for_hosxp: 0,
      missing_cid: 0,
      duplicate: 0,
      matched_in_hosxp: 0,
      new_houses: 0,
    };

    const villagesSet = new Set();
    const ownersSet = new Set();
    const rows = [];
    const newHousesMap = new Map();

    for (const r of rawPop || []) {
      if (!isActiveRecord(r)) continue;
      const rowMoo = String(r.moo || '').trim();
      const rowHouse = String(r.house || '').trim();
      const rowVhv = normName(r.vhv);

      if (allowedMoos) {
        if (!allowedMoos.has(rowMoo)) continue;
        if (vhvDisplay && rowVhv !== vhvDisplay) continue;
      }

      const cid = String(r.cid || '').trim();
      const validCid = isValidThaiCid(cid);
      const cand = candMap.get(r.person_id);

      let category = 'missing_cid';
      if (!validCid || cand?.base_status === 'invalid_cid') {
        category = 'missing_cid';
      } else if (
        cand?.base_status === 'duplicate' ||
        cand?.base_status === 'id_conflict' ||
        (cidCounts.get(cid) || 0) > 1
      ) {
        category = 'duplicate';
      } else if (cand?.target_id) {
        category = 'matched_in_hosxp';
      } else {
        category = 'ready_for_hosxp';
      }

      const houseKey = `${rowMoo}|${rowHouse}`;
      const houseInHosxp = hosxpHouseSet.size > 0 ? hosxpHouseSet.has(houseKey) : true;

      counts.total += 1;
      counts[category] += 1;
      if (rowMoo) villagesSet.add(rowMoo);
      if (rowVhv) ownersSet.add(rowVhv);

      const personObj = {
        person_id: r.person_id,
        cid: validCid ? cid : cid && cid !== '-' ? cid : '',
        valid_cid: validCid,
        title: r.title || '',
        fname: r.fname || '',
        lname: r.lname || '',
        fullname: `${r.title || ''}${r.fname || ''} ${r.lname || ''}`.trim(),
        birth_date: r.birth_date || null,
        moo: rowMoo,
        house: rowHouse,
        vhv: rowVhv || 'ไม่ระบุ',
        relation: r.relation || 'ผู้อาศัย',
        residency_type: String(r.residency_type ?? ''),
        person_discharge_id: Number(r.person_discharge_id || 9),
        chronic: r.chronic || '-',
        updated_at: r.updated_at || null,
        category,
        house_in_hosxp: houseInHosxp,
        hosxp_person_id: cand?.target_id || null,
        hosxp_status: cand?.display_status || cand?.base_status || null,
      };
      rows.push(personObj);

      // Group newly added houses (houses containing P-... members that do NOT exist in HOSxP house_gps_snapshot)
      if (!houseInHosxp && rowMoo && rowHouse && rowHouse !== '-') {
        if (!newHousesMap.has(houseKey)) {
          newHousesMap.set(houseKey, {
            key: houseKey,
            moo: rowMoo,
            house: rowHouse,
            vhv: rowVhv || 'ไม่ระบุ',
            has_gps: false,
            latitude: null,
            longitude: null,
            members: [],
            ready_members: 0,
            missing_cid_members: 0,
            latest_updated_at: r.updated_at || null,
          });
        }
        const hEntry = newHousesMap.get(houseKey);
        hEntry.members.push(personObj);
        if (validCid) hEntry.ready_members += 1;
        else hEntry.missing_cid_members += 1;
        const lat = Number(r.latitude);
        const lng = Number(r.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
          hEntry.has_gps = true;
          hEntry.latitude = lat;
          hEntry.longitude = lng;
        }
      }
    }

    const collator = new Intl.Collator('th', { numeric: true });
    const newHouses = [...newHousesMap.values()].sort(
      (a, b) => collator.compare(a.moo, b.moo) || collator.compare(a.house, b.house)
    );
    counts.new_houses = newHouses.length;

    const villages = [...villagesSet].sort(collator.compare);
    const owners = [...ownersSet].sort(collator.compare);

    return authResponse({
      ok: true,
      counts,
      snapshot,
      houseSnapshotAt: houseBatch?.captured_at || null,
      villages,
      owners,
      rows,
      newHouses,
    });
  } catch {
    return authResponse({ error: 'เชื่อมต่อฐานข้อมูลไม่สำเร็จ' }, 503);
  }
}

export async function POST(request) {
  try {
    if (!sameOrigin(request)) return authResponse({ error: 'FORBIDDEN' }, 403);
    const user = await currentUser();
    if (!user) return authResponse({ error: 'กรุณาเข้าสู่ระบบ' }, 401);

    const body = await readBody(request);
    const action = body?.action;
    const { url, key } = databaseConfig(true);
    const headers = {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    };

    if (action === 'check_cid') {
      const cleanCid = String(body.cid || '')
        .replace(/[๐-๙]/g, (c) => String(c.charCodeAt(0) - 3664))
        .replace(/\D/g, '');
      if (!isValidThaiCid(cleanCid)) {
        return authResponse(
          { ok: false, error: 'เลขบัตรประชาชนไม่ถูกต้อง (ตรวจ 13 หลักและ Checksum)' },
          400
        );
      }

      const q = new URLSearchParams({
        cid: `eq.${cleanCid}`,
        select:
          'person_id,title,fname,lname,birth_date,moo,house,vhv,chronic,residency_type,person_discharge_id',
        limit: '5',
      });
      const res = await fetch(`${url}/rest/v1/population?${q}`, {
        headers,
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return authResponse({ ok: false, error: 'ตรวจสอบเลขบัตรไม่สำเร็จ' }, 503);
      const found = (await res.json()).filter(
        (r) => !body.excludePersonId || r.person_id !== body.excludePersonId
      );

      if (found.length > 0) {
        const p = found[0];
        return authResponse({
          ok: true,
          exists: true,
          person: {
            person_id: p.person_id,
            title: p.title || '',
            fname: p.fname || '',
            lname: p.lname || '',
            fullname: `${p.title || ''}${p.fname || ''} ${p.lname || ''}`.trim(),
            birth_date: p.birth_date || null,
            moo: String(p.moo || ''),
            house: String(p.house || ''),
            vhv: p.vhv || 'ไม่ระบุ',
            chronic: p.chronic || 'ปกติ (ไม่มีโรค)',
          },
        });
      }
      return authResponse({ ok: true, exists: false });
    }

    if (action === 'update_identity') {
      if (isReadOnly()) return readOnlyResponse();
      if (!['admin', 'staff', 'vhv'].includes(user.role)) {
        return authResponse({ ok: false, error: 'ไม่มีสิทธิ์แก้ไขข้อมูล' }, 403);
      }

      const personId = String(body.personId || '').trim();
      const cleanCid = String(body.cid || '')
        .replace(/[๐-๙]/g, (c) => String(c.charCodeAt(0) - 3664))
        .replace(/\D/g, '');
      const birthDate = body.birthDate ? String(body.birthDate).trim() : null;

      if (!personId) {
        return authResponse({ ok: false, error: 'ไม่พบรหัสบุคคล' }, 400);
      }
      if (!isValidThaiCid(cleanCid)) {
        return authResponse(
          { ok: false, error: 'เลขบัตรประชาชน 13 หลักไม่ถูกต้อง กรุณาตรวจสอบตัวเลขอีกครั้ง' },
          400
        );
      }
      if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
        return authResponse({ ok: false, error: 'รูปแบบวันเกิดไม่ถูกต้อง' }, 400);
      }

      const targetQuery = new URLSearchParams({
        person_id: `eq.${personId}`,
        select: 'person_id,moo,house,vhv,fname,lname',
        limit: '1',
      });
      const targetRes = await fetch(`${url}/rest/v1/population?${targetQuery}`, {
        headers,
        cache: 'no-store',
      });
      const targetRows = targetRes.ok ? await targetRes.json() : [];
      const target = targetRows?.[0];
      if (!target) {
        return authResponse({ ok: false, error: 'ไม่พบรายชื่อนี้ในระบบ' }, 404);
      }

      if (user.role === 'vhv') {
        const allowedMoos = String(user.moo || '')
          .split(',')
          .map((m) => m.trim())
          .filter(Boolean);
        if (!allowedMoos.includes(String(target.moo || '').trim())) {
          return authResponse({ ok: false, error: 'แก้ไขได้เฉพาะบุคคลในหมู่ที่รับผิดชอบ' }, 403);
        }
      }

      const dupQuery = new URLSearchParams({
        cid: `eq.${cleanCid}`,
        person_id: `neq.${personId}`,
        select: 'person_id,title,fname,lname,moo,house',
        limit: '2',
      });
      const dupRes = await fetch(`${url}/rest/v1/population?${dupQuery}`, {
        headers,
        cache: 'no-store',
      });
      const dups = dupRes.ok ? await dupRes.json() : [];
      if (dups.length > 0) {
        const d = dups[0];
        return authResponse(
          {
            ok: false,
            duplicate: true,
            error: `เลขบัตรนี้มีอยู่ในระบบแล้ว คือ "${d.title || ''}${d.fname || ''} ${
              d.lname || ''
            }" (บ้านเลขที่ ${d.house || '-'} หมู่ ${d.moo || '-'})`,
            existing: d,
          },
          409
        );
      }

      const updatePayload = {
        cid: cleanCid,
        ...(birthDate ? { birth_date: birthDate } : {}),
        updated_at: new Date().toISOString(),
      };

      const updateRes = await fetch(
        `${url}/rest/v1/population?person_id=eq.${encodeURIComponent(personId)}`,
        {
          method: 'PATCH',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify(updatePayload),
        }
      );
      if (!updateRes.ok) {
        return authResponse({ ok: false, error: 'บันทึกเลขบัตรไม่สำเร็จ' }, 503);
      }

      await fetch(`${url}/rest/v1/activity_logs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          user_id: user.userId || null,
          username: user.username || user.displayName || 'user',
          action: 'UPDATE_NEW_PERSON_CID',
          details: `บันทึกเลขบัตร 13 หลัก/วันเกิด ให้ผู้เพิ่มใหม่ ${target.fname || ''} (บ้าน ${
            target.house || '-'
          } ม.${target.moo || '-'})`,
          target_id: personId,
        }),
      }).catch(() => {});

      return authResponse({
        ok: true,
        person_id: personId,
        cid: cleanCid,
        birth_date: birthDate,
      });
    }

    if (action === 'find_merge_candidates') {
      if (!['admin', 'staff'].includes(user.role)) {
        return authResponse(
          { ok: false, error: 'อนุญาตเฉพาะเจ้าหน้าที่หรือผู้ดูแลระบบเท่านั้น' },
          403
        );
      }

      const dupPersonId = String(body.dupPersonId || body.personId || '').trim();
      if (!isTempNewPersonId(dupPersonId)) {
        return authResponse(
          { ok: false, error: 'รหัสคนเพิ่มใหม่ไม่ถูกต้อง (ต้องขึ้นต้นด้วย P-)' },
          400
        );
      }

      const dupRes = await fetch(
        `${url}/rest/v1/population?${new URLSearchParams({
          person_id: `eq.${dupPersonId}`,
          select: '*',
          limit: '1',
        })}`,
        { headers, cache: 'no-store', signal: AbortSignal.timeout(10000) }
      );
      if (!dupRes.ok) {
        return authResponse({ ok: false, error: 'โหลดข้อมูลคนเพิ่มใหม่ไม่สำเร็จ' }, 503);
      }
      const dupRows = await dupRes.json();
      const dupRow = dupRows?.[0];
      if (!dupRow) {
        return authResponse({ ok: false, error: 'ไม่พบข้อมูลคนเพิ่มใหม่รหัสนี้ในระบบ' }, 404);
      }

      const dupMoo = String(dupRow.moo || '').trim();
      const dupHouse = String(dupRow.house || '').trim();
      const dupFname = String(dupRow.fname || '').trim();
      const dupBirth = String(dupRow.birth_date || '').trim().slice(0, 10);
      const dupCid = String(dupRow.cid || '').trim();
      const cleanSearch = String(body.search || '')
        .trim()
        .replace(/[^\p{L}\p{N}\s./-]/gu, '')
        .trim()
        .slice(0, 60);

      const queryPool = [];
      const runPopQuery = (paramsObj) =>
        fetch(
          `${url}/rest/v1/population?${new URLSearchParams({
            ...paramsObj,
            person_id: 'not.like.P-*',
            select: '*',
          })}`,
          { headers, cache: 'no-store', signal: AbortSignal.timeout(10000) }
        )
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []);

      if (dupMoo && dupHouse && dupHouse !== '-') {
        queryPool.push(runPopQuery({ moo: `eq.${dupMoo}`, house: `eq.${dupHouse}`, limit: '50' }));
      }
      if (dupFname) {
        queryPool.push(runPopQuery({ fname: `eq.${dupFname}`, limit: '25' }));
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(dupBirth)) {
        queryPool.push(runPopQuery({ birth_date: `eq.${dupBirth}`, limit: '25' }));
      }
      if (isValidThaiCid(dupCid)) {
        queryPool.push(runPopQuery({ cid: `eq.${dupCid}`, limit: '5' }));
      }
      if (cleanSearch.length >= 2) {
        const tokens = cleanSearch.split(/\s+/).filter(Boolean);
        const firstTok = tokens[0] || cleanSearch;
        const restTok = tokens.slice(1).join(' ');
        const orClauses = [`fname.ilike.*${firstTok}*`, `lname.ilike.*${restTok || firstTok}*`];
        if (tokens.length === 1) {
          orClauses.push(`cid.eq.${firstTok}`, `person_id.eq.${firstTok}`);
        }
        queryPool.push(runPopQuery({ or: `(${orClauses.join(',')})`, limit: '20' }));
      }

      const chunks = await Promise.all(queryPool);
      const poolMap = new Map();
      for (const chunk of chunks) {
        for (const row of chunk || []) {
          if (row?.person_id && isHosxpPersonId(row.person_id) && !poolMap.has(row.person_id)) {
            poolMap.set(row.person_id, row);
          }
        }
      }

      const poolRows = [...poolMap.values()];
      const scored = findDuplicateMatches(dupRow, poolRows);
      const scoredIds = new Set(scored.map((m) => m.personId));

      const formatCandidate = (raw, matchMeta) => {
        const cMoo = String(raw.moo || '').trim();
        const cHouse = String(raw.house || '').trim();
        const sameHouse = Boolean(dupMoo && dupHouse && cMoo === dupMoo && cHouse === dupHouse);
        const sameFields = buildMergedPopulationPatch(raw, dupRow, {
          moveTargetToDupHouse: false,
        }).transferredFields;
        const moveFields = buildMergedPopulationPatch(raw, dupRow, {
          moveTargetToDupHouse: true,
        }).transferredFields;
        return {
          person_id: raw.person_id,
          cid: raw.cid || '',
          title: raw.title || '',
          fname: raw.fname || '',
          lname: raw.lname || '',
          fullname: `${raw.title || ''}${raw.fname || ''} ${raw.lname || ''}`.trim(),
          birth_date: raw.birth_date || null,
          moo: cMoo,
          house: cHouse,
          vhv: raw.vhv || 'ไม่ระบุ',
          relation: raw.relation || 'ผู้อาศัย',
          residency_type: String(raw.residency_type ?? ''),
          chronic: raw.chronic || '-',
          sameHouse,
          score: matchMeta.score,
          matchCode: matchMeta.matchCode,
          matchReason: matchMeta.matchReason,
          transferFieldsSameHouse: sameFields,
          transferFieldsWithMove: moveFields,
        };
      };

      const candidates = scored.map((m) => formatCandidate(m.raw, m));
      if (cleanSearch.length >= 2) {
        for (const raw of poolRows) {
          if (scoredIds.has(raw.person_id)) continue;
          candidates.push(
            formatCandidate(raw, {
              score: 10,
              matchCode: 'manual_search',
              matchReason: 'ค้นหาด้วยตนเอง',
            })
          );
        }
      }

      return authResponse({
        ok: true,
        dup: {
          person_id: dupRow.person_id,
          cid: dupRow.cid || '',
          title: dupRow.title || '',
          fname: dupRow.fname || '',
          lname: dupRow.lname || '',
          fullname: `${dupRow.title || ''}${dupRow.fname || ''} ${dupRow.lname || ''}`.trim(),
          birth_date: dupRow.birth_date || null,
          moo: dupMoo,
          house: dupHouse,
          vhv: dupRow.vhv || 'ไม่ระบุ',
          relation: dupRow.relation || 'ผู้อาศัย',
          residency_type: String(dupRow.residency_type ?? ''),
          chronic: dupRow.chronic || '-',
        },
        candidates,
      });
    }

    if (action === 'merge_duplicate') {
      if (isReadOnly()) return readOnlyResponse();
      if (!['admin', 'staff'].includes(user.role)) {
        return authResponse(
          { ok: false, error: 'อนุญาตเฉพาะเจ้าหน้าที่หรือผู้ดูแลระบบเท่านั้น' },
          403
        );
      }

      const dupPersonId = String(body.dupPersonId || '').trim();
      const targetPersonId = String(body.targetPersonId || '').trim();
      const reason = String(body.reason || '').trim().slice(0, 300);
      const moveTargetToDupHouse = Boolean(body.moveTargetToDupHouse);

      if (
        !isTempNewPersonId(dupPersonId) ||
        !isHosxpPersonId(targetPersonId) ||
        dupPersonId === targetPersonId
      ) {
        return authResponse(
          {
            ok: false,
            error: 'รหัสไม่ถูกต้อง — ต้องรวมจากคนเพิ่มใหม่ (P-...) เข้าสู่รหัส HOSxP เท่านั้น',
          },
          400
        );
      }

      const pairRes = await fetch(
        `${url}/rest/v1/population?${new URLSearchParams({
          person_id: `in.(${dupPersonId},${targetPersonId})`,
          select: '*',
          limit: '2',
        })}`,
        { headers, cache: 'no-store', signal: AbortSignal.timeout(10000) }
      );
      if (!pairRes.ok) {
        return authResponse({ ok: false, error: 'ตรวจสอบข้อมูลทั้ง 2 รายการไม่สำเร็จ' }, 503);
      }
      const pairRows = await pairRes.json();
      const dupRow = pairRows.find((r) => r.person_id === dupPersonId);
      const targetRow = pairRows.find((r) => r.person_id === targetPersonId);
      if (!dupRow) {
        return authResponse({ ok: false, error: 'ไม่พบรายชื่อคนเพิ่มใหม่ (P-...) — อาจถูกรวมไปแล้ว' }, 404);
      }
      if (!targetRow) {
        return authResponse({ ok: false, error: 'ไม่พบรหัส HOSxP ปลายทางในระบบ' }, 404);
      }

      const { patch, transferredFields } = buildMergedPopulationPatch(targetRow, dupRow, {
        moveTargetToDupHouse,
      });

      // Prefer atomic PostgreSQL RPC when installed; otherwise fall back cleanly to service-role REST.
      const rpcConfig = databaseConfig(false);
      const token = await getSessionToken();
      if (token) {
        const rpcRes = await fetch(`${rpcConfig.url}/rest/v1/rpc/merge_duplicate_new_person`, {
          method: 'POST',
          cache: 'no-store',
          signal: AbortSignal.timeout(15000),
          headers: {
            apikey: rpcConfig.key,
            Authorization: `Bearer ${rpcConfig.key}`,
            'Content-Type': 'application/json',
            'x-app-session': token,
          },
          body: JSON.stringify({
            p_dup_person_id: dupPersonId,
            p_target_person_id: targetPersonId,
            p_patch: patch,
            p_reason: reason || null,
          }),
        });
        const rpcPayload = await rpcRes.json().catch(() => ({}));
        if (rpcRes.ok) {
          return authResponse({
            ok: true,
            deletedPersonId: dupPersonId,
            targetPersonId,
            transferredFields,
            mode: 'rpc',
          });
        }
        const rawMsg = String(rpcPayload?.message || rpcPayload?.error || '');
        const rawCode = String(rpcPayload?.code || '');
        const rpcMissing =
          rawCode === 'PGRST202' ||
          rawCode === '42883' ||
          rawMsg.includes('Could not find the function');
        if (!rpcMissing) {
          if (rawMsg.includes('FORBIDDEN')) {
            return authResponse({ ok: false, error: 'ไม่มีสิทธิ์รวมรายชื่อ' }, 403);
          }
          if (rawMsg.includes('INVALID_MERGE_IDS')) {
            return authResponse({ ok: false, error: 'รหัสที่ระบุไม่ถูกต้อง' }, 400);
          }
          if (rawMsg.includes('DUP_NOT_FOUND') || rawMsg.includes('TARGET_NOT_FOUND')) {
            return authResponse({ ok: false, error: 'ไม่พบบุคคลที่ต้องการรวมแล้ว กรุณาโหลดหน้าใหม่' }, 404);
          }
          return authResponse({ ok: false, error: 'รวมข้อมูลไม่สำเร็จ กรุณาลองใหม่' }, 503);
        }
      }

      // Zero-migration REST fallback
      const patchRes = await fetch(
        `${url}/rest/v1/population?person_id=eq.${encodeURIComponent(targetPersonId)}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify(patch),
        }
      );
      if (!patchRes.ok) {
        return authResponse(
          { ok: false, error: 'อัปเดตข้อมูลรหัส HOSxP หลักไม่สำเร็จ ยกเลิกการลบรายการซ้ำเพื่อความปลอดภัย' },
          503
        );
      }

      // Best-effort re-point 2570 screening records if table exists
      try {
        const scrRes = await fetch(
          `${url}/rest/v1/annual_health_screenings_2570?${new URLSearchParams({
            person_id: `in.(${dupPersonId},${targetPersonId})`,
            select: 'id,person_id,fiscal_year',
          })}`,
          { headers, cache: 'no-store' }
        );
        if (scrRes.ok) {
          const scrRows = await scrRes.json();
          if (Array.isArray(scrRows) && scrRows.length) {
            const targetYears = new Set(
              scrRows.filter((r) => r.person_id === targetPersonId).map((r) => r.fiscal_year)
            );
            for (const sr of scrRows.filter((r) => r.person_id === dupPersonId)) {
              if (!targetYears.has(sr.fiscal_year)) {
                await fetch(
                  `${url}/rest/v1/annual_health_screenings_2570?id=eq.${encodeURIComponent(sr.id)}`,
                  {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({
                      person_id: targetPersonId,
                      updated_at: new Date().toISOString(),
                    }),
                  }
                ).catch(() => {});
              } else {
                await fetch(
                  `${url}/rest/v1/annual_health_screenings_2570?id=eq.${encodeURIComponent(sr.id)}`,
                  { method: 'DELETE', headers }
                ).catch(() => {});
              }
            }
          }
        }
      } catch {
        // optional table
      }

      await fetch(
        `${url}/rest/v1/house_transfer_requests?person_id=eq.${encodeURIComponent(dupPersonId)}`,
        { method: 'DELETE', headers }
      ).catch(() => {});

      const delRes = await fetch(
        `${url}/rest/v1/population?person_id=eq.${encodeURIComponent(dupPersonId)}`,
        { method: 'DELETE', headers }
      );
      if (!delRes.ok) {
        const delErr = await delRes.json().catch(() => ({}));
        if (delRes.status === 409 || String(delErr?.code || '') === '23503') {
          return authResponse(
            {
              ok: false,
              error:
                'มีประวัติอ้างอิงในระบบ (เช่น ประวัติยืนยันการสำรวจ) กรุณารัน migrations/20261124_merge_duplicate_new_person.sql ใน Supabase SQL Editor ก่อนรวมรายชื่อนี้',
            },
            409
          );
        }
        return authResponse({ ok: false, error: 'ลบรายการซ้ำไม่สำเร็จ กรุณาลองใหม่' }, 503);
      }

      const dupFullname = `${dupRow.title || ''}${dupRow.fname || ''} ${dupRow.lname || ''}`.trim();
      const targetFullname = `${targetRow.title || ''}${targetRow.fname || ''} ${targetRow.lname || ''}`.trim();
      await fetch(`${url}/rest/v1/activity_logs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          user_id: user.userId || null,
          username: user.username || user.displayName || 'staff',
          action: 'MERGE_NEW_PERSON',
          details: `รวมข้อมูลและลบคนเพิ่มใหม่ ${dupFullname} (${dupPersonId}) เข้าสู่รหัส HOSxP ${targetFullname} (${targetPersonId}) บ้านเลขที่ ${
            patch.house || dupRow.house || '-'
          } ม.${patch.moo || dupRow.moo || '-'}${reason ? ` • เหตุผล: ${reason}` : ''}`,
          target_id: targetPersonId,
        }),
      }).catch(() => {});

      return authResponse({
        ok: true,
        deletedPersonId: dupPersonId,
        targetPersonId,
        transferredFields,
        mode: 'rest',
      });
    }

    return authResponse({ error: 'INVALID_ACTION' }, 400);
  } catch {
    return authResponse({ error: 'ดำเนินการไม่สำเร็จ กรุณาลองใหม่' }, 503);
  }
}
