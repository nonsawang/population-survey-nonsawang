import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { currentUser, authResponse, sameOrigin, isReadOnly, getSessionToken, readBody } from '@/lib/server-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CONFIG_PATH = path.join(process.cwd(), 'config', 'nhso-close-services.json');
const ENV_SYNC_PATH = path.join(process.cwd(), '.env.sync');
const DEFAULT_API_URL = 'https://authenucws.nhso.go.th/authencodestatus/api/check-authen-status';
const DEFAULT_CLOSE_URL = 'https://nhsoapi.nhso.go.th/nhsoendpoint/api/nhso-claim-detail';

function readSyncEnv() {
  const out = {};
  try {
    if (fs.existsSync(ENV_SYNC_PATH)) {
      const lines = fs.readFileSync(ENV_SYNC_PATH, 'utf8').split(/\r?\n/);
      for (const line of lines) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (m) out[m[1].trim()] = m[2].trim();
      }
    }
  } catch {}
  return out;
}

function readServiceConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      const fobt = raw?.services?.FOBT || {};
      return {
        hcode: raw.hcode || '05080',
        zone: raw.zone || 'production',
        serviceCode: fobt.code || 'PG0060001',
        apiUrl: raw.authenStatusUrl || DEFAULT_API_URL,
        closeUrl: raw.closeRightsUrl || DEFAULT_CLOSE_URL,
      };
    }
  } catch {}
  return {
    hcode: '05080',
    zone: 'production',
    serviceCode: 'PG0060001',
    apiUrl: DEFAULT_API_URL,
    closeUrl: DEFAULT_CLOSE_URL,
  };
}

async function inspectHosxpTokens() {
  const syncEnv = readSyncEnv();
  const host = process.env.HOSXP_DB_HOST || syncEnv.HOSXP_DB_HOST;
  const port = Number(process.env.HOSXP_DB_PORT || syncEnv.HOSXP_DB_PORT || 3306);
  const user = process.env.HOSXP_DB_USER || syncEnv.HOSXP_DB_USER;
  const password = process.env.HOSXP_DB_PASSWORD || syncEnv.HOSXP_DB_PASSWORD;
  const database = process.env.HOSXP_DB_NAME || syncEnv.HOSXP_DB_NAME;

  const envConfirmToken = String(process.env.NHSO_CLOSE_TOKEN || syncEnv.NHSO_CLOSE_TOKEN || '').trim();

  if (!host || !user || !database) {
    return {
      hosxpConnected: false,
      confirmToken: envConfirmToken,
      feeScheduleToken: '',
      authenStatusToken: envConfirmToken,
      confirmSource: envConfirmToken ? 'Environment' : 'Not configured',
      feeScheduleSource: 'Not configured',
    };
  }

  let db;
  try {
    db = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
      connectTimeout: 4000,
    });
    const [rows] = await db.execute(
      "SELECT sys_name, TRIM(COALESCE(sys_value,'')) AS val FROM sys_var WHERE sys_name IN ('NHSO-CONFIRM-PRIVIVLEGE-API-TOKEN','NHSO-CONFIRM-PRIVILEGE-API-TOKEN','NHSO-13FILE-FEE-SCHEDULE-API-TOKEN','NHSO-CHECK-AUTHEN-CODE-STATUS-TOKEN','Authen_Token')"
    );
    const map = Object.fromEntries((rows || []).map(r => [r.sys_name, r.val]));
    const confirmVal =
      map['NHSO-CONFIRM-PRIVIVLEGE-API-TOKEN'] ||
      map['NHSO-CONFIRM-PRIVILEGE-API-TOKEN'] ||
      envConfirmToken ||
      '';
    const feeVal = map['NHSO-13FILE-FEE-SCHEDULE-API-TOKEN'] || '';
    const authenVal =
      map['NHSO-CHECK-AUTHEN-CODE-STATUS-TOKEN'] ||
      map['Authen_Token'] ||
      confirmVal ||
      feeVal ||
      '';
    return {
      hosxpConnected: true,
      confirmToken: confirmVal,
      feeScheduleToken: feeVal,
      authenStatusToken: authenVal,
      confirmSource: confirmVal ? 'HOSxP (sys_var)' : 'ไม่พบใน HOSxP',
      feeScheduleSource: feeVal ? 'HOSxP (sys_var)' : 'ไม่พบใน HOSxP',
    };
  } catch (err) {
    return {
      hosxpConnected: false,
      hosxpError: err.message,
      confirmToken: envConfirmToken,
      feeScheduleToken: '',
      authenStatusToken: envConfirmToken,
      confirmSource: envConfirmToken ? 'Environment' : 'เชื่อมต่อ HOSxP ไม่ได้',
      feeScheduleSource: 'เชื่อมต่อ HOSxP ไม่ได้',
    };
  } finally {
    if (db) await db.end().catch(() => {});
  }
}

export async function POST(request) {
  if (!sameOrigin(request)) return authResponse({ error: 'ไม่มีสิทธิ์เข้าถึง' }, 403);
  try {
    const token = await getSessionToken();
    const user = await currentUser(token);
    if (!user) return authResponse({ error: 'กรุณาเข้าสู่ระบบ' }, 401);
    if (!['staff', 'admin'].includes(user.role)) return authResponse({ error: 'เฉพาะเจ้าหน้าที่และผู้ดูแลระบบ' }, 403);

    let body = {};
    if (request.headers.get('content-type')?.startsWith('application/json')) {
      try { body = (await readBody(request, 4096)) || {}; } catch { body = {}; }
    }
    const action = body.action || 'status';
    const cfg = readServiceConfig();
    const tokens = await inspectHosxpTokens();

    if (action === 'status') {
      return authResponse({
        serviceCode: cfg.serviceCode,
        apiUrl: cfg.apiUrl,
        closeUrl: cfg.closeUrl,
        hcode: cfg.hcode,
        hosxpConnected: tokens.hosxpConnected,
        confirmPrivilegeToken: {
          ok: Boolean(tokens.confirmToken),
          length: tokens.confirmToken.length,
          source: tokens.confirmSource,
        },
        feeScheduleToken: {
          ok: Boolean(tokens.feeScheduleToken),
          length: tokens.feeScheduleToken.length,
          source: tokens.feeScheduleSource,
        },
      });
    }

    if (action === 'save') {
      if (isReadOnly()) return authResponse({ error: 'โหมดอ่านอย่างเดียว ไม่อนุญาตให้บันทึก' }, 403);
      const nextServiceCode = String(body.serviceCode || cfg.serviceCode).trim();
      const nextApiUrl = String(body.apiUrl || cfg.apiUrl).trim();
      if (!/^[A-Z0-9]{3,20}$/.test(nextServiceCode)) {
        return authResponse({ error: 'รหัสบริการ (Service Code) ไม่ถูกต้อง' }, 400);
      }
      if (!/^https:\/\/[^\s]+$/i.test(nextApiUrl)) {
        return authResponse({ error: 'API URL ต้องขึ้นต้นด้วย https://' }, 400);
      }
      const nextData = {
        hcode: cfg.hcode || '05080',
        zone: 'production',
        authenStatusUrl: nextApiUrl,
        closeRightsUrl: cfg.closeUrl || DEFAULT_CLOSE_URL,
        services: {
          FOBT: {
            enabled: true,
            api: 'nhso-claim-detail',
            code: nextServiceCode,
            reference: 'NHSO Dataset v10.1 / 20261012_fit_close_reservation',
            verifiedBy: user.username || 'admin',
          },
        },
      };
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(nextData, null, 2) + '\n', 'utf8');
      return authResponse({
        saved: true,
        serviceCode: nextServiceCode,
        apiUrl: nextApiUrl,
        message: 'บันทึกการตั้งค่า NHSO API เรียบร้อยแล้ว',
      });
    }

    if (action === 'test') {
      const testToken = tokens.confirmToken || tokens.authenStatusToken || tokens.feeScheduleToken;
      if (!testToken) {
        return authResponse({
          ok: false,
          message: 'ไม่พบ Token จาก HOSxP หรือในระบบ กรุณาตรวจสอบการเชื่อมต่อฐานข้อมูล HOSxP (192.168.1.201)',
        }, 400);
      }
      const targetUrl = String(body.apiUrl || cfg.apiUrl || DEFAULT_API_URL).trim();
      const serviceCode = String(body.serviceCode || cfg.serviceCode || 'PG0060001').trim();
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      // Valid 13-digit sample CID with valid check digit (1111111111119) for read-only connectivity probe
      const sampleCid = '1111111111119';
      const probeUrl = new URL(targetUrl);
      probeUrl.search = new URLSearchParams({
        personalId: sampleCid,
        serviceDate: today,
        serviceCode,
      }).toString();

      const started = Date.now();
      try {
        const res = await fetch(probeUrl.toString(), {
          method: 'GET',
          headers: {
            Authorization: 'Bearer ' + testToken,
            Accept: 'application/json',
          },
          cache: 'no-store',
          signal: AbortSignal.timeout(12000),
        });
        const latencyMs = Date.now() - started;
        const contentType = res.headers.get('content-type') || '';
        let payload = null;
        if (contentType.includes('json')) {
          payload = await res.json().catch(() => null);
        }
        if (res.status === 401 || res.status === 403) {
          return authResponse({
            ok: false,
            httpStatus: res.status,
            latencyMs,
            message: `เชื่อมต่อเซิร์ฟเวอร์ สปสช. ได้ แต่ Token ไม่ผ่านการยืนยันตัวตน (HTTP ${res.status}) กรุณาตรวจสอบหรือต่ออายุ Token ใน HOSxP`,
          });
        }
        return authResponse({
          ok: res.ok || res.status === 404 || res.status === 400,
          httpStatus: res.status,
          latencyMs,
          tokenLength: testToken.length,
          serviceCode,
          sampleStatusAuthen: payload?.statusAuthen ?? null,
          message: res.ok
            ? `เชื่อมต่อ NHSO API สำเร็จ (HTTP ${res.status} • ${latencyMs} ms) Token และ URL ใช้งานได้จริง`
            : `ติดต่อเซิร์ฟเวอร์ NHSO API ได้ (HTTP ${res.status} • ${latencyMs} ms)`,
        });
      } catch (err) {
        return authResponse({
          ok: false,
          latencyMs: Date.now() - started,
          message: 'ไม่สามารถเชื่อมต่อ NHSO API ได้ กรุณาตรวจสอบอินเทอร์เน็ตหรือ URL (' + (err.message || 'Network error') + ')',
        });
      }
    }

    return authResponse({ error: 'ไม่รองรับคำสั่งนี้' }, 400);
  } catch {
    return authResponse({ error: 'ตรวจสอบการตั้งค่า NHSO API ไม่สำเร็จ' }, 503);
  }
}
