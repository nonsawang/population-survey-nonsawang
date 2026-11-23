import {
  authResponse,
  currentUser,
  databaseConfig,
  sameOrigin,
  readBody,
  isReadOnly,
  readOnlyResponse,
} from '@/lib/server-auth';

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

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return authResponse({ error: 'กรุณาเข้าสู่ระบบ' }, 401);

    const { url, key } = databaseConfig(true);
    const headers = { apikey: key, Authorization: `Bearer ${key}` };

    const popQuery = new URLSearchParams({
      person_id: 'like.P-*',
      select:
        'person_id,cid,title,fname,lname,birth_date,moo,house,vhv,relation,residency_type,person_discharge_id,status_model_version,chronic,updated_at',
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

    const [popRes, candRes, batchRes] = await Promise.all([
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
    ]);

    if (!popRes.ok) {
      return authResponse({ error: 'โหลดข้อมูลผู้ที่ถูกเพิ่มใหม่ไม่สำเร็จ' }, 503);
    }

    const rawPop = await popRes.json();
    const rawCands = candRes && candRes.ok ? await candRes.json() : [];
    const rawBatches = batchRes && batchRes.ok ? await batchRes.json() : [];
    const snapshot = rawBatches?.[0] || null;

    const candMap = new Map();
    if (Array.isArray(rawCands)) {
      for (const c of rawCands) {
        candMap.set(c.population_id, c);
      }
    }

    // Also count duplicate CIDs among P- rows in case snapshot is missing
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
    };

    const villagesSet = new Set();
    const ownersSet = new Set();
    const rows = [];

    for (const r of rawPop || []) {
      if (!isActiveRecord(r)) continue;
      const rowMoo = String(r.moo || '').trim();
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

      counts.total += 1;
      counts[category] += 1;
      if (rowMoo) villagesSet.add(rowMoo);
      if (rowVhv) ownersSet.add(rowVhv);

      rows.push({
        person_id: r.person_id,
        cid: validCid ? cid : cid && cid !== '-' ? cid : '',
        valid_cid: validCid,
        title: r.title || '',
        fname: r.fname || '',
        lname: r.lname || '',
        fullname: `${r.title || ''}${r.fname || ''} ${r.lname || ''}`.trim(),
        birth_date: r.birth_date || null,
        moo: rowMoo,
        house: String(r.house || '').trim(),
        vhv: rowVhv || 'ไม่ระบุ',
        relation: r.relation || 'ผู้อาศัย',
        residency_type: String(r.residency_type ?? ''),
        person_discharge_id: Number(r.person_discharge_id || 9),
        chronic: r.chronic || '-',
        updated_at: r.updated_at || null,
        category,
        hosxp_person_id: cand?.target_id || null,
        hosxp_status: cand?.display_status || cand?.base_status || null,
      });
    }

    const collator = new Intl.Collator('th', { numeric: true });
    const villages = [...villagesSet].sort(collator.compare);
    const owners = [...ownersSet].sort(collator.compare);

    return authResponse({
      ok: true,
      counts,
      snapshot,
      villages,
      owners,
      rows,
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

    // 1. ตรวจสอบเลขบัตร 13 หลักทั่วทั้งตำบล เพื่อป้องกันการเพิ่มคนซ้ำ
    if (action === 'check_cid') {
      const cleanCid = String(body.cid || '')
        .replace(/[๐-๙]/g, (c) => String(c.charCodeAt(0) - 3664))
        .replace(/\D/g, '');
      if (!isValidThaiCid(cleanCid)) {
        return authResponse({ ok: false, error: 'เลขบัตรประชาชนไม่ถูกต้อง (ตรวจ 13 หลักและ Checksum)' }, 400);
      }

      const q = new URLSearchParams({
        cid: `eq.${cleanCid}`,
        select: 'person_id,title,fname,lname,birth_date,moo,house,vhv,chronic,residency_type,person_discharge_id',
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

    // 2. บันทึกหรือแก้ไขเลขบัตรประชาชน 13 หลัก และวันเกิด ของผู้ที่ถูกเพิ่มใหม่ (P-...)
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

      // Load target person
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

      // Check VHV scope
      if (user.role === 'vhv') {
        const allowedMoos = String(user.moo || '')
          .split(',')
          .map((m) => m.trim())
          .filter(Boolean);
        if (!allowedMoos.includes(String(target.moo || '').trim())) {
          return authResponse({ ok: false, error: 'แก้ไขได้เฉพาะบุคคลในหมู่ที่รับผิดชอบ' }, 403);
        }
      }

      // Check duplicate CID across entire population
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

      // Log activity
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

    return authResponse({ error: 'INVALID_ACTION' }, 400);
  } catch {
    return authResponse({ error: 'ดำเนินการไม่สำเร็จ กรุณาลองใหม่' }, 503);
  }
}
