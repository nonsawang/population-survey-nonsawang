import {
  authResponse,
  currentUser,
  databaseConfig,
  sameOrigin,
  readBody,
  isReadOnly,
  readOnlyResponse,
} from '@/lib/server-auth';
import { calculateAge } from '@/lib/utils';
import {
  FISCAL_YEAR_2570,
  createDefaultScreening2570Form,
  evaluateFullScreening2570,
  getApplicableSections,
  inferPersonProfile,
} from '@/lib/health-screening-2570.mjs';

export const dynamic = 'force-dynamic';

function bangkokToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function getAllowedMoos(user) {
  if (user?.role !== 'vhv') return null;
  return new Set(
    String(user.moo || '')
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean)
  );
}

function isActivePopulation(row) {
  const discharge = Number(row.person_discharge_id);
  if ([1, 2, 3].includes(discharge)) return false;
  if (Number(row.status_model_version) !== 1 && String(row.residency_type) === '4') return false;
  if (String(row.residency_type) === '4' && discharge !== 9) return false;
  return true;
}

function mapPerson(row) {
  return {
    personId: row.person_id,
    cid: row.cid || '-',
    title: row.title || '',
    fname: row.fname || '',
    lname: row.lname || '',
    fullname: `${row.title || ''}${row.fname || ''} ${row.lname || ''}`.trim(),
    birthDate: row.birth_date || '',
    age: calculateAge(row.birth_date),
    moo: String(row.moo || '').trim(),
    house: String(row.house || '').trim(),
    vhv: String(row.vhv || '').trim() || 'ไม่ระบุ',
    chronic: row.chronic || '-',
    residencyType: String(row.residency_type ?? ''),
  };
}

function parseLogDetails(details) {
  if (!details) return null;
  if (typeof details === 'object') return details;
  try {
    const parsed = JSON.parse(details);
    if (parsed && typeof parsed === 'object' && parsed.formData) return parsed;
  } catch {
    // ignore non-JSON log
  }
  return null;
}

function mergeDeepForm(base, incoming) {
  if (!incoming || typeof incoming !== 'object') return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(incoming)) {
    if (
      v &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      base[k] &&
      typeof base[k] === 'object' &&
      !Array.isArray(base[k])
    ) {
      out[k] = mergeDeepForm(base[k], v);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

async function fetchAllPages(url, basePath, headers, pageSize = 1000, maxPages = 10) {
  const all = [];
  let offset = 0;
  for (let i = 0; i < maxPages; i++) {
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

async function loadStatusMap(url, headers, personIds = null) {
  const statusMap = {};

  try {
    let path = `/rest/v1/annual_health_screenings_2570?fiscal_year=eq.${FISCAL_YEAR_2570}&select=person_id,screen_date,pp_special_codes,overall_status,risk_count,bmi,recorded_by,updated_at`;
    if (Array.isArray(personIds) && personIds.length > 0) {
      const encodedIds = personIds.map((id) => `"${String(id).replace(/"/g, '')}"`).join(',');
      path += `&person_id=in.(${encodedIds})`;
    }
    const rows = await fetchAllPages(url, path, headers, 1000, 6);
    for (const r of rows) {
      statusMap[r.person_id] = {
        screened: true,
        screenDate: r.screen_date,
        overallStatus: r.overall_status || 'ปกติ',
        riskCount: Number(r.risk_count || 0),
        ppSpecialCodes: Array.isArray(r.pp_special_codes) ? r.pp_special_codes : [],
        bmi: r.bmi ?? null,
        recordedBy: r.recorded_by || '',
        updatedAt: r.updated_at || null,
        source: 'table',
      };
    }
  } catch {
    // Fallback below if table is not created yet
  }

  try {
    let logPath = `/rest/v1/activity_logs?action=eq.SCREENING_2570&select=target_id,details,username,created_at&order=created_at.desc`;
    if (Array.isArray(personIds) && personIds.length > 0) {
      const encodedIds = personIds.map((id) => `"${String(id).replace(/"/g, '')}"`).join(',');
      logPath += `&target_id=in.(${encodedIds})`;
    }
    const logs = await fetchAllPages(url, logPath, headers, 1000, 6);
    for (const row of logs) {
      const pid = row.target_id;
      if (!pid || statusMap[pid]) continue;
      const parsed = parseLogDetails(row.details);
      if (!parsed) continue;
      if (parsed.fiscalYear && Number(parsed.fiscalYear) !== FISCAL_YEAR_2570) continue;
      statusMap[pid] = {
        screened: true,
        screenDate: parsed.screenDate || String(row.created_at || '').slice(0, 10),
        overallStatus: parsed.overallStatus || 'ปกติ',
        riskCount: Number(parsed.riskCount || 0),
        ppSpecialCodes: Array.isArray(parsed.ppSpecialCodes) ? parsed.ppSpecialCodes : [],
        bmi: parsed.bmi ?? null,
        recordedBy: parsed.recordedBy || row.username || '',
        updatedAt: parsed.updatedAt || row.created_at || null,
        source: 'activity_logs',
      };
    }
  } catch {
    // ignore log fallback read errors
  }

  return statusMap;
}

export async function GET(request) {
  try {
    const user = await currentUser();
    if (!user) return authResponse({ error: 'กรุณาเข้าสู่ระบบ' }, 401);

    const { url, key } = databaseConfig(true);
    const headers = { apikey: key, Authorization: `Bearer ${key}` };
    const { searchParams } = new URL(request.url);
    const allowedMoos = getAllowedMoos(user);

    const personId = String(searchParams.get('personId') || '').trim();
    const personIdsRaw = String(searchParams.get('personIds') || '').trim();
    const mode = String(searchParams.get('mode') || '').trim();

    if (personId) {
      const pq = new URLSearchParams({
        person_id: `eq.${personId}`,
        select: 'person_id,cid,title,fname,lname,birth_date,moo,house,vhv,chronic,residency_type',
        limit: '1',
      });
      const pRes = await fetch(`${url}/rest/v1/population?${pq}`, {
        headers,
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      });
      if (!pRes.ok) return authResponse({ error: 'โหลดข้อมูลบุคคลไม่สำเร็จ' }, 503);
      const pRows = await pRes.json();
      const rawPerson = pRows?.[0];
      if (!rawPerson) return authResponse({ error: 'ไม่พบบุคคลนี้ในระบบ' }, 404);

      if (allowedMoos && !allowedMoos.has(String(rawPerson.moo || '').trim())) {
        return authResponse({ error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลหมู่บ้านนี้' }, 403);
      }

      const personObj = mapPerson(rawPerson);
      let record = null;
      let source = null;

      try {
        const tq = new URLSearchParams({
          person_id: `eq.${personId}`,
          fiscal_year: `eq.${FISCAL_YEAR_2570}`,
          select: '*',
          limit: '1',
        });
        const tRes = await fetch(`${url}/rest/v1/annual_health_screenings_2570?${tq}`, {
          headers,
          cache: 'no-store',
          signal: AbortSignal.timeout(10000),
        });
        if (tRes.ok) {
          const tRows = await tRes.json();
          if (tRows?.[0]) {
            record = tRows[0];
            source = 'table';
          }
        }
      } catch {
        // Fallback to activity_logs below
      }

      if (!record) {
        const lq = new URLSearchParams({
          action: 'eq.SCREENING_2570',
          target_id: `eq.${personId}`,
          select: 'id,username,details,created_at',
          order: 'created_at.desc',
          limit: '1',
        });
        const lRes = await fetch(`${url}/rest/v1/activity_logs?${lq}`, {
          headers,
          cache: 'no-store',
          signal: AbortSignal.timeout(10000),
        });
        if (lRes.ok) {
          const lRows = await lRes.json();
          const parsed = parseLogDetails(lRows?.[0]?.details);
          if (parsed) {
            record = {
              person_id: personId,
              fiscal_year: parsed.fiscalYear || FISCAL_YEAR_2570,
              screen_date: parsed.screenDate || String(lRows[0].created_at || '').slice(0, 10),
              form_data: parsed.formData,
              pp_special_codes: parsed.ppSpecialCodes || [],
              overall_status: parsed.overallStatus || 'ปกติ',
              risk_count: parsed.riskCount || 0,
              bmi: parsed.bmi ?? null,
              recorded_by: parsed.recordedBy || lRows[0].username || '',
              updated_at: parsed.updatedAt || lRows[0].created_at || null,
            };
            source = 'activity_logs';
          }
        }
      }

      const defaults = createDefaultScreening2570Form(personObj, bangkokToday());
      const formData = record?.form_data ? mergeDeepForm(defaults, record.form_data) : defaults;
      if (record?.screen_date) formData.screenDate = record.screen_date;
      const evaluation = evaluateFullScreening2570(formData, personObj);

      return authResponse({
        ok: true,
        fiscalYear: FISCAL_YEAR_2570,
        screened: Boolean(record),
        source,
        record,
        person: personObj,
        formData,
        evaluation,
      });
    }

    if (personIdsRaw) {
      const ids = personIdsRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 200);
      if (ids.length === 0) return authResponse({ ok: true, statuses: {} });
      const statuses = await loadStatusMap(url, headers, ids);
      return authResponse({ ok: true, statuses });
    }

    if (mode === 'search') {
      const qRaw = String(searchParams.get('q') || '').trim();
      const qNorm = qRaw
        .replace(/[๐-๙]/g, (c) => String(c.charCodeAt(0) - 3664))
        .toLowerCase();
      const mooFilter = String(searchParams.get('moo') || '').trim();
      const statusFilter = String(searchParams.get('filter') || 'all').trim();
      const ageFilter = String(searchParams.get('ageGroup') || 'all').trim();
      const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
      const pageSize = 24;

      if (allowedMoos && mooFilter && !allowedMoos.has(mooFilter)) {
        return authResponse({ error: 'ไม่มีสิทธิ์ดูข้อมูลหมู่บ้านนี้' }, 403);
      }

      let popPath =
        '/rest/v1/population?select=person_id,cid,title,fname,lname,birth_date,moo,house,vhv,chronic,residency_type,person_discharge_id,status_model_version&order=moo.asc,house.asc,fname.asc';
      if (mooFilter) {
        popPath += `&moo=eq.${encodeURIComponent(mooFilter)}`;
      } else if (allowedMoos && allowedMoos.size > 0) {
        const list = [...allowedMoos].map((m) => `"${m.replace(/"/g, '')}"`).join(',');
        popPath += `&moo=in.(${list})`;
      }

      const [rawPop, statusMap] = await Promise.all([
        fetchAllPages(url, popPath, headers, 1000, 8),
        loadStatusMap(url, headers, null),
      ]);

      const activePeople = [];
      const villagesSet = new Set();

      for (const r of rawPop) {
        if (!isActivePopulation(r)) continue;
        const p = mapPerson(r);
        if (p.moo) villagesSet.add(p.moo);

        if (qNorm) {
          const hay = `${p.fullname} ${p.cid} ${p.house} ม.${p.moo} ${p.vhv}`.toLowerCase();
          const digitsOnlyQ = qNorm.replace(/\D/g, '');
          const cidMatch = digitsOnlyQ.length >= 4 && String(p.cid || '').includes(digitsOnlyQ);
          if (!hay.includes(qNorm) && !cidMatch) continue;
        }

        const profile = inferPersonProfile(p);
        if (ageFilter === '35plus' && profile.age < 35) continue;
        if (ageFilter === 'elderly60' && profile.age < 60) continue;
        if (ageFilter === 'working15_59' && (profile.age < 15 || profile.age >= 60)) continue;
        if (ageFilter === 'child0_14' && profile.age >= 15) continue;

        const st = statusMap[p.personId] || null;
        activePeople.push({
          ...p,
          profile,
          targetCount: Object.values(getApplicableSections(p)).filter(Boolean).length,
          screening: st,
        });
      }

      const stats = {
        total: activePeople.length,
        screened: activePeople.filter((x) => x.screening?.screened).length,
        pending: activePeople.filter((x) => !x.screening?.screened).length,
        withRisk: activePeople.filter((x) => (x.screening?.riskCount || 0) > 0).length,
      };

      const filteredRows = activePeople.filter((x) => {
        if (statusFilter === 'pending') return !x.screening?.screened;
        if (statusFilter === 'screened') return Boolean(x.screening?.screened);
        if (statusFilter === 'risk') return (x.screening?.riskCount || 0) > 0;
        return true;
      });

      const collator = new Intl.Collator('th', { numeric: true });
      filteredRows.sort(
        (a, b) =>
          collator.compare(a.moo, b.moo) ||
          collator.compare(a.house, b.house) ||
          collator.compare(a.fname, b.fname)
      );

      const start = (page - 1) * pageSize;
      const rows = filteredRows.slice(start, start + pageSize);
      const villages = [...villagesSet].sort(collator.compare);

      return authResponse({
        ok: true,
        fiscalYear: FISCAL_YEAR_2570,
        stats,
        totalFiltered: filteredRows.length,
        page,
        pageSize,
        villages,
        rows,
      });
    }

    return authResponse({ error: 'กรุณาระบุ personId, personIds หรือ mode=search' }, 400);
  } catch {
    return authResponse({ error: 'โหลดข้อมูลคัดกรอง 2570 ไม่สำเร็จ' }, 503);
  }
}

export async function POST(request) {
  try {
    if (!sameOrigin(request)) return authResponse({ error: 'FORBIDDEN' }, 403);
    if (isReadOnly()) return readOnlyResponse();

    const user = await currentUser();
    if (!user) return authResponse({ error: 'กรุณาเข้าสู่ระบบ' }, 401);
    if (!['admin', 'staff', 'vhv'].includes(user.role)) {
      return authResponse({ error: 'ไม่มีสิทธิ์บันทึกผลการคัดกรอง' }, 403);
    }

    const body = await readBody(request, 524288);
    const personId = String(body?.personId || '').trim();
    const rawForm = body?.formData;

    if (!personId || !rawForm || typeof rawForm !== 'object') {
      return authResponse({ error: 'ข้อมูลไม่ครบถ้วน กรุณาลองใหม่' }, 400);
    }

    const { url, key } = databaseConfig(true);
    const headers = {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    };

    const pq = new URLSearchParams({
      person_id: `eq.${personId}`,
      select: 'person_id,cid,title,fname,lname,birth_date,moo,house,vhv,chronic,residency_type',
      limit: '1',
    });
    const pRes = await fetch(`${url}/rest/v1/population?${pq}`, {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    if (!pRes.ok) return authResponse({ error: 'ค้นหาข้อมูลบุคคลไม่สำเร็จ' }, 503);
    const pRows = await pRes.json();
    const rawPerson = pRows?.[0];
    if (!rawPerson) return authResponse({ error: 'ไม่พบรายชื่อนี้ในฐานข้อมูล' }, 404);

    const allowedMoos = getAllowedMoos(user);
    if (allowedMoos && !allowedMoos.has(String(rawPerson.moo || '').trim())) {
      return authResponse({ error: 'บันทึกได้เฉพาะประชากรในหมู่บ้านที่รับผิดชอบ' }, 403);
    }

    const personObj = mapPerson(rawPerson);
    const screenDateRaw = String(rawForm.screenDate || bangkokToday()).trim();
    const screenDate = /^\d{4}-\d{2}-\d{2}$/.test(screenDateRaw) ? screenDateRaw : bangkokToday();
    const cleanFormData = mergeDeepForm(createDefaultScreening2570Form(personObj, screenDate), {
      ...rawForm,
      screenDate,
    });

    const evaluation = evaluateFullScreening2570(cleanFormData, personObj);
    const recordedBy = user.displayName || user.username || 'staff';
    const nowIso = new Date().toISOString();

    const storedPayload = {
      fiscalYear: FISCAL_YEAR_2570,
      personId,
      fullname: personObj.fullname,
      moo: personObj.moo,
      house: personObj.house,
      screenDate,
      ppSpecialCodes: evaluation.ppSpecialCodes,
      overallStatus: evaluation.overallStatus,
      riskCount: evaluation.risks.length,
      risks: evaluation.risks,
      bmi: evaluation.bmi,
      recordedBy,
      recordedRole: user.role,
      updatedAt: nowIso,
      formData: cleanFormData,
    };

    let storedInTable = false;
    try {
      const tableRes = await fetch(
        `${url}/rest/v1/annual_health_screenings_2570?on_conflict=person_id,fiscal_year`,
        {
          method: 'POST',
          headers: {
            ...headers,
            Prefer: 'resolution=merge-duplicates,return=representation',
          },
          body: JSON.stringify({
            person_id: personId,
            fiscal_year: FISCAL_YEAR_2570,
            screen_date: screenDate,
            form_data: cleanFormData,
            pp_special_codes: evaluation.ppSpecialCodes,
            overall_status: evaluation.overallStatus,
            risk_count: evaluation.risks.length,
            bmi: evaluation.bmi,
            recorded_by: recordedBy,
            recorded_role: user.role,
            updated_at: nowIso,
          }),
          signal: AbortSignal.timeout(12000),
        }
      );
      storedInTable = tableRes.ok;
    } catch {
      storedInTable = false;
    }

    let storedInLog = false;
    try {
      const logRes = await fetch(`${url}/rest/v1/activity_logs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          user_id: user.userId || null,
          username: recordedBy,
          action: 'SCREENING_2570',
          details: JSON.stringify(storedPayload),
          target_id: personId,
        }),
        signal: AbortSignal.timeout(12000),
      });
      storedInLog = logRes.ok;
    } catch {
      storedInLog = false;
    }

    if (!storedInTable && !storedInLog) {
      return authResponse({ error: 'บันทึกผลการคัดกรองไม่สำเร็จ กรุณาลองใหม่' }, 503);
    }

    // Best-effort sync of key fields to population table for dashboard compatibility
    try {
      const popPatch = { updated_at: nowIso };
      if (evaluation.targets.s8_smoking) {
        popPatch.smoking_status =
          cleanFormData.s8.status === 'current'
            ? 'สูบ'
            : cleanFormData.s8.status === 'quit'
            ? 'เคยสูบ เลิกแล้ว'
            : 'ไม่สูบ ไม่เคย';
      }
      if (evaluation.targets.s9_alcohol) {
        popPatch.alcohol_status =
          cleanFormData.s9.status === 'current'
            ? 'ดื่ม'
            : cleanFormData.s9.status === 'quit_1y'
            ? 'เคยดื่ม หยุดแล้ว'
            : 'ไม่ดื่ม';
        popPatch.assist_score =
          cleanFormData.s9.status === 'current' ? evaluation.alcoholInfo.score : 0;
      }
      if (Object.keys(popPatch).length > 1) {
        await fetch(`${url}/rest/v1/population?person_id=eq.${encodeURIComponent(personId)}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(popPatch),
          signal: AbortSignal.timeout(8000),
        });
      }
    } catch {
      // Best-effort only
    }

    return authResponse({
      ok: true,
      storedInTable,
      storedInLog,
      summary: {
        screened: true,
        screenDate,
        overallStatus: evaluation.overallStatus,
        riskCount: evaluation.risks.length,
        ppSpecialCodes: evaluation.ppSpecialCodes,
        bmi: evaluation.bmi,
        recordedBy,
        updatedAt: nowIso,
      },
      evaluation,
    });
  } catch (err) {
    if (err?.message === 'INVALID_BODY') {
      return authResponse({ error: 'ข้อมูลฟอร์มขนาดใหญ่เกินกำหนดหรือไม่ถูกต้อง' }, 400);
    }
    return authResponse({ error: 'เชื่อมต่อระบบบันทึกผลไม่สำเร็จ กรุณาลองใหม่' }, 503);
  }
}
