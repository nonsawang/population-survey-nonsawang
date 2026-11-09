import {
  sameOrigin,
  isReadOnly,
  readOnlyResponse,
  authResponse,
  readBody,
  getSessionToken,
  databaseConfig,
} from '@/lib/server-auth';
import { VALID_MOOS, sanitizeInput } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ERROR_CATALOG = {
  LEGACY_REQUEST_REQUIRES_RESUBMIT: {status:409,message:'คำขอจากระบบเดิมต้องตรวจบ้านต้นทางและปลายทาง แล้วส่งคำขอย้ายใหม่ก่อนอนุมัติ'},
  FORBIDDEN_ROLE: {
    status: 403,
    message: 'บัญชีของคุณไม่มีสิทธิ์ใช้งานระบบย้ายบ้าน (อนุญาตเฉพาะ เจ้าหน้าที่/Admin และ อสม.)',
  },
  FORBIDDEN_SOURCE_MOO: {
    status: 403,
    message: 'คุณไม่มีสิทธิ์ย้ายประชากรของหมู่บ้านต้นทางนี้',
  },
  FORBIDDEN_TARGET_MOO: {
    status: 403,
    message: 'เฉพาะเจ้าหน้าที่ หรือ อสม. หมู่บ้านปลายทางเท่านั้นที่สามารถกดยืนยันรับเข้าบ้านได้',
  },
  FORBIDDEN_SCOPE: {
    status: 403,
    message: 'คุณไม่มีสิทธิ์ยกเลิกหรือปฏิเสธคำขอย้ายบ้านรายการนี้',
  },
  PERSON_NOT_FOUND: {
    status: 404,
    message: 'ไม่พบข้อมูลประชากรรายนี้ในระบบ',
  },
  REQUEST_NOT_FOUND: {
    status: 404,
    message: 'ไม่พบคำขอย้ายบ้านรายการนี้ในระบบ',
  },
  REQUEST_NOT_PENDING: {
    status: 409,
    message: 'คำขอย้ายบ้านรายการนี้ถูกอนุมัติหรือยกเลิกไปแล้ว กรุณารีเฟรชหน้าจอ',
  },
  SOURCE_PERSON_CHANGED: {
    status: 409,
    message: 'ข้อมูลที่อยู่หรือสถานะของบุคคลนี้เปลี่ยนแปลงไปแล้วหลังส่งคำขอ จึงไม่สามารถใช้คำขอเดิมย้ายทับได้ กรุณาตรวจสอบข้อมูลล่าสุดแล้วทำรายการใหม่',
  },
  TARGET_HOUSE_NOT_FOUND: {
    status: 400,
    message: 'ไม่พบบ้านเลขที่ปลายทางในหมู่บ้านที่เลือก (ไม่อนุญาตให้ย้ายเข้าบ้านเลขที่ที่ยังไม่มีในระบบ)',
  },
  INVALID_TARGET_HOUSE: {
    status: 400,
    message: 'กรุณาระบุหมู่และบ้านเลขที่ปลายทางให้ถูกต้อง',
  },
  INVALID_TARGET_VHV: {
    status: 400,
    message: 'ชื่อ อสม. ที่เลือกไม่อยู่ในทะเบียน อสม. ของหมู่บ้านปลายทาง',
  },
  INVALID_RELATION: {
    status: 400,
    message: 'สถานะในบ้านไม่ถูกต้อง',
  },
  SAME_HOUSE: {
    status: 400,
    message: 'ประชากรรายนี้อยู่บ้านเลขที่และหมู่นี้อยู่แล้ว',
  },
};

async function callTransferRpc(name, args, token) {
  const { url, key } = databaseConfig(false);
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'x-app-session': token,
    },
    body: JSON.stringify(args),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const rawMsg = String(payload?.message || payload?.error || payload?.details || '');
    const rawCode = String(payload?.code || '');
    if (rawCode === 'PGRST202' || rawMsg.includes('Could not find the function')) {
      const err = new Error('ต้องรัน migration 20261109_house_transfer_requests.sql ใน Supabase ก่อนใช้งานระบบย้ายบ้านข้ามหมู่');
      err.code = 'SCHEMA_NOT_READY';
      err.status = 503;
      throw err;
    }
    const matchedCode = Object.keys(ERROR_CATALOG).find((k) => rawMsg.includes(k));
    if (matchedCode) {
      const err = new Error(ERROR_CATALOG[matchedCode].message);
      err.code = matchedCode;
      err.status = ERROR_CATALOG[matchedCode].status;
      throw err;
    }
    const err = new Error('ไม่สามารถดำเนินการย้ายบ้านได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง');
    err.code = 'TRANSFER_RPC_FAILED';
    err.status = 409;
    throw err;
  }

  return payload;
}

export async function POST(request) {
  if (!sameOrigin(request)) {
    return authResponse({ error: 'ไม่อนุญาตให้ส่งคำขอข้ามโดเมน', code: 'CROSS_ORIGIN' }, 403);
  }

  let body;
  try {
    body = await readBody(request, 8192);
  } catch {
    return authResponse({ error: 'รูปแบบข้อมูลไม่ถูกต้อง', code: 'INVALID_BODY' }, 400);
  }

  const token = await getSessionToken();
  if (!token) {
    return authResponse({ error: 'กรุณาเข้าสู่ระบบก่อนดำเนินการ', code: 'AUTH_REQUIRED' }, 401);
  }

  const action = String(body?.action || '').trim();

  try {
    // 1) PREVIEW DESTINATION HOUSE (Read-only, minimal disclosure for out-of-scope villages)
    if (action === 'preview') {
      const targetMoo = String(body?.targetMoo || '').trim();
      const targetHouse = sanitizeInput(String(body?.targetHouse || '').trim());
      if (!VALID_MOOS.includes(targetMoo) || !targetHouse || targetHouse.length > 50) {
        return authResponse(
          { error: 'กรุณาระบุหมู่และบ้านเลขที่ปลายทางให้ถูกต้อง', code: 'INVALID_TARGET_HOUSE' },
          400
        );
      }

      const result = await callTransferRpc(
        'house_transfer_preview',
        {
          p_target_moo: targetMoo,
          p_target_house: targetHouse,
        },
        token
      );
      return authResponse(result);
    }

    // 2) LIST PENDING CROSS-VILLAGE REQUESTS (Scoped & Paginated in SQL)
    if (action === 'list_pending') {
      const page = Math.max(1, Number.parseInt(String(body?.page ?? '1'), 10) || 1);
      const pageSize = Math.min(50, Math.max(1, Number.parseInt(String(body?.pageSize ?? '20'), 10) || 20));
      const result = await callTransferRpc(
        'house_transfer_list',
        {
          p_page: page,
          p_page_size: pageSize,
        },
        token
      );
      return authResponse(result);
    }

    // Write actions below must respect preview/read-only mode
    if (isReadOnly()) {
      return readOnlyResponse();
    }

    // 3) REQUEST OR EXECUTE MOVE (Atomic single-transaction RPC)
    if (action === 'request_or_move') {
      const personId = String(body?.personId || '').trim();
      const expectedMoo = body?.expectedMoo ? String(body.expectedMoo).trim() : null;
      const expectedHouse = body?.expectedHouse ? sanitizeInput(String(body.expectedHouse).trim()) : null;
      const targetMoo = String(body?.targetMoo || '').trim();
      const targetHouse = sanitizeInput(String(body?.targetHouse || '').trim());
      const targetVhv = body?.targetVhv ? sanitizeInput(String(body.targetVhv).trim()) : null;
      const relation = body?.relation ? sanitizeInput(String(body.relation).trim()) : null;

      if (!personId || personId.length > 100 || !VALID_MOOS.includes(targetMoo) || !targetHouse || targetHouse.length > 50) {
        return authResponse(
          { error: 'กรุณาระบุหมู่และบ้านเลขที่ใหม่ให้ครบถ้วน', code: 'INVALID_TARGET_HOUSE' },
          400
        );
      }

      const result = await callTransferRpc(
        'house_transfer_submit',
        {
          p_person_id: personId,
          p_expected_moo: expectedMoo,
          p_expected_house: expectedHouse,
          p_target_moo: targetMoo,
          p_target_house: targetHouse,
          p_target_vhv: targetVhv,
          p_relation: relation,
        },
        token
      );

      const message =
        result.status === 'pending_approval'
          ? `ส่งคำขอย้ายข้ามหมู่ไปบ้านเลขที่ ${result.toHouse} หมู่ ${result.toMoo} แล้ว รอ อสม.หมู่ ${result.toMoo} หรือเจ้าหน้าที่กดยืนยันรับเข้าบ้าน (รายการนี้จะปรับเฉพาะทะเบียนสำรวจในระบบ ยังไม่ได้เปลี่ยนบ้านใน HOSxP)`
          : `ย้ายที่อยู่ในทะเบียนสำรวจไปบ้านเลขที่ ${result.toHouse} หมู่ ${result.toMoo} เรียบร้อยแล้ว (ยังไม่ได้เปลี่ยนที่อยู่ใน HOSxP)`;

      return authResponse({
        ...result,
        hosxpSynced: false,
        message,
      });
    }

    // 4) APPROVE PENDING CROSS-VILLAGE TRANSFER (Atomic single-transaction RPC)
    if (action === 'approve') {
      const requestId = Number(body?.requestId);
      const toVhv = body?.toVhv ? sanitizeInput(String(body.toVhv).trim()) : null;
      if (!Number.isInteger(requestId) || requestId <= 0) {
        return authResponse({ error: 'ไม่พบรหัสคำขอย้ายบ้าน', code: 'REQUEST_NOT_FOUND' }, 400);
      }

      const result = await callTransferRpc(
        'house_transfer_approve',
        {
          p_request_id: requestId,
          p_to_vhv: toVhv,
        },
        token
      );

      return authResponse({
        ...result,
        hosxpSynced: false,
        message: `ยืนยันรับ ${result.fullname || ''} เข้าบ้านเลขที่ ${result.toHouse} หมู่ ${result.toMoo} ในทะเบียนสำรวจเรียบร้อยแล้ว (ยังไม่ได้เปลี่ยนที่อยู่ใน HOSxP)`,
      });
    }

    // 5) REJECT OR CANCEL PENDING TRANSFER (Atomic single-transaction RPC)
    if (action === 'reject') {
      const requestId = Number(body?.requestId);
      const reason = body?.reason ? sanitizeInput(String(body.reason).trim()) : null;
      if (!Number.isInteger(requestId) || requestId <= 0) {
        return authResponse({ error: 'ไม่พบรหัสคำขอย้ายบ้าน', code: 'REQUEST_NOT_FOUND' }, 400);
      }

      const result = await callTransferRpc(
        'house_transfer_cancel',
        {
          p_request_id: requestId,
          p_reason: reason,
        },
        token
      );

      return authResponse({
        ...result,
        message:
          result.status === 'cancelled'
            ? `ยกเลิกคำขอย้ายบ้านของ ${result.fullname || ''} เรียบร้อยแล้ว`
            : `ปฏิเสธคำขอย้ายบ้านของ ${result.fullname || ''} เรียบร้อยแล้ว`,
      });
    }

    return authResponse({ error: 'ไม่รู้จักคำสั่งที่ร้องขอ', code: 'UNKNOWN_ACTION' }, 400);
  } catch (err) {
    return authResponse(
      {
        error: err?.message || 'เกิดข้อผิดพลาดในการดำเนินการย้ายบ้าน กรุณาลองใหม่',
        code: err?.code || 'TRANSFER_ERROR',
      },
      err?.status || 500
    );
  }
}
