// Privacy-preserving Local AI helper: accepts ONLY aggregate statistics and
// village/household counts. Never forwards citizen IDs, names, or raw patient rows.

const DEFAULT_AI_URL = 'http://127.0.0.1:11434';
const DEFAULT_AI_MODEL = 'qwen2.5:7b';

export function isLocalAiUrlAllowed(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const h = parsed.hostname.toLowerCase();
    if (['127.0.0.1', 'localhost', '[::1]', 'host.docker.internal'].includes(h)) return true;
    // Allow RFC1918 private LAN & Tailscale CGNAT (100.64.0.0/10) inside facility network
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
    if (/^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  } catch {}
  return false;
}

export function getLocalAiConfig(env = process.env) {
  const url = (env.LOCAL_AI_URL || DEFAULT_AI_URL).replace(/\/+$/, '');
  if (!isLocalAiUrlAllowed(url)) {
    throw new Error('LOCAL_AI_URL_MUST_BE_LOCAL_OR_PRIVATE_LAN');
  }
  const model = (env.LOCAL_AI_MODEL || DEFAULT_AI_MODEL).trim();
  const provider = (env.LOCAL_AI_PROVIDER || 'ollama').toLowerCase();
  return { url, model, provider };
}

export function maskSensitiveText(text) {
  return String(text || '')
    .replace(/\b\d{13}\b/g, '[REDACTED_CID]')
    .replace(/\b\d[\s-]?\d{4}[\s-]?\d{5}[\s-]?\d{2}[\s-]?\d\b/g, '[REDACTED_CID]')
    .slice(0, 1200);
}

const pct = (done, total) => (total > 0 ? Number(((done / total) * 100).toFixed(1)) : 0);
const num = v => Number(v || 0);

export function buildRuleBasedAnalysis({ dashboard, tracking, focus = 'overview' }) {
  const lines = [];

  if (dashboard && typeof dashboard === 'object') {
    const total = num(dashboard.total);
    const unsurveyed = num(dashboard.unsurveyed);
    const surveyed = Math.max(0, total - unsurveyed);
    const surveyRate = pct(surveyed, total);

    lines.push(`### 1. ภาพรวมประชากรและความก้าวหน้างานสำรวจ`);
    lines.push(
      `- **ประชากรในเขตรับผิดชอบ**: ${total.toLocaleString('th-TH')} คน (${num(dashboard.totalHouses).toLocaleString('th-TH')} หลังคาเรือน) | สำรวจสถานะอยู่อาศัยแล้ว **${surveyed.toLocaleString('th-TH')} คน (${surveyRate}%)** | คงค้าง **${unsurveyed.toLocaleString('th-TH')} คน**`
    );
    if (dashboard.insight) {
      lines.push(
        `- **โครงสร้างวัย**: วัยเด็ก (0–14 ปี) ${num(dashboard.insight.children).toLocaleString('th-TH')} คน • วัยทำงาน (15–59 ปี) ${num(dashboard.insight.working).toLocaleString('th-TH')} คน • ผู้สูงอายุ (60+ ปี) ${num(dashboard.insight.elderly).toLocaleString('th-TH')} คน • อัตราพึ่งพิง **${dashboard.insight.dependencyRatio}%**`
      );
    }

    const mooEntries = Object.entries(dashboard.byMoo || {})
      .map(([moo, m]) => ({
        moo,
        total: num(m.total),
        unsurveyed: num(m.unsurveyed),
        rate: pct(num(m.total) - num(m.unsurveyed), num(m.total)),
      }))
      .sort((a, b) => b.unsurveyed - a.unsurveyed);

    const pendingMoos = mooEntries.filter(m => m.unsurveyed > 0).slice(0, 5);
    if (pendingMoos.length > 0) {
      lines.push(
        `- **หมู่บ้านที่มีประชากรคงค้างสำรวจสูงสุด**: ${pendingMoos
          .map(m => `หมู่ ${m.moo} (ค้าง ${m.unsurveyed.toLocaleString('th-TH')} คน, สำรวจแล้ว ${m.rate}%)`)
          .join(' • ')}`
      );
    } else if (mooEntries.length > 0) {
      lines.push(`- **สถานะรายหมู่บ้าน**: สำรวจประเภทการอยู่อาศัยครบทุกหมู่บ้านแล้ว`);
    }

    if (dashboard.kpi && focus !== 'tracking') {
      const kpiList = [
        { code: 'HEP', name: 'ไวรัสตับอักเสบ B/C', done: num(dashboard.kpi.hep?.screened), total: num(dashboard.kpi.hep?.total) },
        { code: 'FOBT', name: 'มะเร็งลำไส้ใหญ่ (FIT Test)', done: num(dashboard.kpi.fobt?.screened), total: num(dashboard.kpi.fobt?.total) },
        { code: 'HPV', name: 'มะเร็งปากมดลูก (HPV DNA)', done: num(dashboard.kpi.hpv?.screened), total: num(dashboard.kpi.hpv?.total) },
        { code: 'CHILD', name: 'พัฒนาการเด็ก 0–5 ปี', done: num(dashboard.kpi.child?.normal), total: num(dashboard.kpi.child?.total) },
      ].map(k => ({ ...k, pending: Math.max(0, k.total - k.done), rate: pct(k.done, k.total) }));

      lines.push(`\n### 2. การวิเคราะห์คิวคัดกรองสุขภาพ 4 KPI`);
      for (const k of kpiList.sort((a, b) => a.rate - b.rate)) {
        lines.push(
          `- **${k.name} (${k.code})**: คัดกรองแล้ว ${k.done.toLocaleString('th-TH')} / ${k.total.toLocaleString('th-TH')} คน (**${k.rate}%**) — คงเหลือต้องติดตาม **${k.pending.toLocaleString('th-TH')} คน**`
        );
      }

      if (Array.isArray(dashboard.kpiByMoo) && dashboard.kpiByMoo.length > 0) {
        const fobtGap = [...dashboard.kpiByMoo]
          .map(m => ({ moo: m.moo, pending: Math.max(0, num(m.fobtTotal) - num(m.fobtScreened)), rate: pct(num(m.fobtScreened), num(m.fobtTotal)) }))
          .filter(m => m.pending > 0)
          .sort((a, b) => b.pending - a.pending)
          .slice(0, 3);
        if (fobtGap.length > 0) {
          lines.push(
            `- **พื้นที่เร่งรัดตรวจ FIT Test (FOBT)**: ${fobtGap.map(m => `หมู่ ${m.moo} (รอตรวจ ${m.pending} คน, ได้ ${m.rate}%)`).join(' • ')}`
          );
        }
      }
    }

    if (dashboard.risk && (focus === 'overview' || focus === 'risk')) {
      const r = dashboard.risk;
      const target15 = num(r.target15plus);
      const smokePending = Math.max(0, target15 - num(r.smokeSurveyed));
      const alcPending = Math.max(0, target15 - num(r.alcSurveyed));
      lines.push(`\n### 3. พฤติกรรมเสี่ยงและกลุ่มที่ต้องดูแลต่อเนื่อง`);
      lines.push(
        `- **สูบบุหรี่ (อายุ 15+ ปี)**: คัดกรองแล้ว ${pct(num(r.smokeSurveyed), target15)}% (ค้าง ${smokePending.toLocaleString('th-TH')} คน) • สูบปัจจุบัน **${num(r.smoking?.current).toLocaleString('th-TH')} คน** (ติดระดับสูง Fagerstrom 7–10 จำนวน **${num(r.fagerstrom?.high)} คน**)`
      );
      lines.push(
        `- **ดื่มสุรา (อายุ 15+ ปี)**: คัดกรองแล้ว ${pct(num(r.alcSurveyed), target15)}% (ค้าง ${alcPending.toLocaleString('th-TH')} คน) • ดื่มปัจจุบัน **${num(r.alcohol?.current).toLocaleString('th-TH')} คน** (เสี่ยงสูง ASSIST 27+ จำนวน **${num(r.assist?.high)} คน**)`
      );
    }
  }

  if (tracking && typeof tracking === 'object') {
    lines.push(`\n### ${lines.length ? '4' : '1'}. การจัดลำดับคิวติดตามงานสำรวจรายหมู่บ้านและ อสม.`);
    if (tracking.totals) {
      lines.push(
        `- **ขอบเขตที่เลือก**: บ้านทั้งหมด ${num(tracking.totals.houses).toLocaleString('th-TH')} หลัง • บ้านที่ยังสำรวจไม่ครบ **${num(tracking.totals.incomplete).toLocaleString('th-TH')} หลัง** (${num(tracking.totals.pending).toLocaleString('th-TH')} คน)`
      );
    }
    if (Array.isArray(tracking.topVillages) && tracking.topVillages.length > 0) {
      lines.push(
        `- **หมู่บ้านที่ควรเร่งติดตามก่อน**: ${tracking.topVillages
          .slice(0, 5)
          .map(v => `หมู่ ${v.moo} (ค้าง ${num(v.incomplete)} หลัง: ยังไม่เริ่ม ${num(v.notStarted)}, บางส่วน ${num(v.partial)})`)
          .join(' • ')}`
      );
    }
    if (Array.isArray(tracking.topOwners) && tracking.topOwners.length > 0) {
      lines.push(
        `- **คิวงานรายผู้รับผิดชอบ (อสม.) ที่ค้างสูงสุด**: ${tracking.topOwners
          .slice(0, 5)
          .map(o => `ม.${o.moo} (${o.incomplete} หลัง / ${o.pendingPeople} คน)`)
          .join(' • ')}`
      );
    }
  }

  return lines.join('\n');
}

export function buildSafePromptContext({ dashboard, tracking }) {
  const safe = {};
  if (dashboard && typeof dashboard === 'object') {
    safe.population = {
      total: num(dashboard.total),
      totalHouses: num(dashboard.totalHouses),
      unsurveyed: num(dashboard.unsurveyed),
      type0: num(dashboard.type0),
      type1: num(dashboard.type1),
      type2: num(dashboard.type2),
      type3: num(dashboard.type3),
      outside: num(dashboard.outside),
      discharged: num(dashboard.discharged),
      deceased: num(dashboard.deceased),
      chronicCount: num(dashboard.chronicCount),
      ageGroups: dashboard.insight || dashboard.population || null,
    };
    safe.kpi = dashboard.kpi || null;
    safe.kpiByMoo = Array.isArray(dashboard.kpiByMoo) ? dashboard.kpiByMoo.slice(0, 25) : [];
    safe.byMoo = dashboard.byMoo || {};
    if (dashboard.risk) {
      safe.risk = {
        target15plus: num(dashboard.risk.target15plus),
        smokeSurveyed: num(dashboard.risk.smokeSurveyed),
        alcSurveyed: num(dashboard.risk.alcSurveyed),
        smoking: dashboard.risk.smoking,
        alcohol: dashboard.risk.alcohol,
        fagerstrom: dashboard.risk.fagerstrom,
        assist: dashboard.risk.assist,
      };
    }
  }
  if (tracking && typeof tracking === 'object') {
    safe.tracking = {
      selectedMoo: tracking.selectedMoo || 'ทุกหมู่',
      totals: tracking.totals || null,
      topVillages: Array.isArray(tracking.topVillages)
        ? tracking.topVillages.slice(0, 17).map(v => ({
            moo: v.moo,
            houses: num(v.houses),
            incomplete: num(v.incomplete),
            notStarted: num(v.notStarted),
            partial: num(v.partial),
            pendingPeople: num(v.pendingPeople),
          }))
        : [],
      topOwnersCount: Array.isArray(tracking.topOwners) ? tracking.topOwners.length : 0,
    };
  }
  return safe;
}

export async function probeLocalAi(env = process.env) {
  const cfg = getLocalAiConfig(env);
  try {
    if (cfg.provider === 'openai') {
      const res = await fetch(`${cfg.url}/v1/models`, { cache: 'no-store', signal: AbortSignal.timeout(3000) });
      if (!res.ok) return { online: false, ...cfg, models: [] };
      const body = await res.json();
      const models = (body?.data || []).map(m => m.id).filter(Boolean);
      return { online: true, ...cfg, activeModel: models.includes(cfg.model) ? cfg.model : models[0] || cfg.model, models };
    }
    const res = await fetch(`${cfg.url}/api/tags`, { cache: 'no-store', signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { online: false, ...cfg, models: [] };
    const body = await res.json();
    const models = (body?.models || []).map(m => m.name).filter(Boolean);
    const matched = models.find(m => m === cfg.model || m.startsWith(cfg.model.split(':')[0])) || models[0] || cfg.model;
    return { online: true, ...cfg, activeModel: matched, models };
  } catch {
    return { online: false, ...cfg, models: [] };
  }
}

export async function askLocalAi({ prompt, focus = 'overview', dashboard, tracking, env = process.env }) {
  const fallback = buildRuleBasedAnalysis({ dashboard, tracking, focus });
  const status = await probeLocalAi(env);
  if (!status.online) {
    return {
      ok: true,
      source: 'local-rules',
      online: false,
      model: 'Built-in Local Analyzer (ยังไม่ได้เปิด Ollama)',
      reply: fallback,
      fallbackInsights: fallback,
    };
  }

  const safeContext = buildSafePromptContext({ dashboard, tracking });
  const systemPrompt = [
    'คุณคือผู้ช่วย AI ประจำโรงพยาบาลส่งเสริมสุขภาพตำบลบ้านโนนสว่าง (รพ.สต.บ้านโนนสว่าง) ที่ทำงานแบบ Offline ภายในเครื่องหน่วยบริการ',
    'หน้าที่ของคุณคือสรุปภาพรวมสถิติประชากร วิเคราะห์ความก้าวหน้าการสำรวจรายหมู่บ้าน และจัดลำดับความสำคัญของคิวคัดกรองสุขภาพ 4 KPI (ไวรัสตับอักเสบ B/C, FIT Test มะเร็งลำไส้ใหญ่, HPV DNA, พัฒนาการเด็ก) รวมถึงพฤติกรรมเสี่ยงบุหรี่/สุรา',
    'กติกาสำคัญ: ใช้เฉพาะตัวเลขจาก JSON ข้อมูลสรุปที่ได้รับเท่านั้น ห้ามแต่งตัวเลขเอง ตอบเป็นภาษาไทยที่กระชับ ชัดเจน แบ่งหัวข้ออ่านง่าย และให้ข้อเสนอแนะเชิงปฏิบัติการสำหรับเจ้าหน้าที่และ อสม.',
  ].join('\n');

  const userMessage = [
    `ข้อมูลสถิติสรุปปัจจุบันของ รพ.สต.บ้านโนนสว่าง (ไม่มีข้อมูลส่วนบุคคล):`,
    JSON.stringify(safeContext),
    `\nผลการคำนวณเบื้องต้น:`,
    fallback,
    `\nคำถาม/หัวข้อที่ต้องการวิเคราะห์: ${maskSensitiveText(prompt || 'สรุปภาพรวมและแนะนำลำดับความสำคัญของงานสำรวจและคัดกรองสุขภาพ')}`,
  ].join('\n');

  try {
    if (status.provider === 'openai') {
      const res = await fetch(`${status.url}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({
          model: status.activeModel,
          temperature: 0.2,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
        }),
      });
      if (!res.ok) throw new Error('LOCAL_AI_HTTP_ERROR');
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error('EMPTY_AI_RESPONSE');
      return { ok: true, source: 'ollama-openai', online: true, model: status.activeModel, reply: text, fallbackInsights: fallback };
    }

    const res = await fetch(`${status.url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(45000),
      body: JSON.stringify({
        model: status.activeModel,
        stream: false,
        options: { temperature: 0.2 },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    });
    if (!res.ok) throw new Error('LOCAL_AI_HTTP_ERROR');
    const data = await res.json();
    const text = data?.message?.content?.trim();
    if (!text) throw new Error('EMPTY_AI_RESPONSE');
    return { ok: true, source: 'ollama', online: true, model: status.activeModel, reply: text, fallbackInsights: fallback };
  } catch {
    return {
      ok: true,
      source: 'local-rules',
      online: false,
      model: 'Built-in Local Analyzer (สลับโหมดอัตโนมัติ)',
      reply: fallback,
      fallbackInsights: fallback,
    };
  }
}
