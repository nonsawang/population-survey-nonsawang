export function cardForm(data) {
  if (typeof data === 'string') data = JSON.parse(data);
  if (data?.rsCode !== 'Y') throw new Error('กรุณาเสียบบัตรให้แน่น แล้วลองอ่านบัตรอีกครั้ง');
  const cid = String(data.pid || '').trim();
  if (!/^\d{13}$/.test(cid)) throw new Error('อ่านเลขบัตรไม่ครบ กรุณาลองใหม่');
  const birth = String(data.birthDate || '');
  let birth_year = '', birth_month = '', birth_day = '';
  if (/^\d{8}$/.test(birth)) {
    const year = Number(birth.slice(0, 4));
    const ce = year > 2400 ? year - 543 : year;
    const month = Number(birth.slice(4, 6)), day = Number(birth.slice(6));
    const date = new Date(Date.UTC(ce, month - 1, day));
    if (date.getUTCFullYear() === ce && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) {
      birth_year = String(ce + 543); birth_month = birth.slice(4, 6); birth_day = birth.slice(6);
    }
  }
  return { cid, title: String(data.titleTh || '').trim(), fname: String(data.firstnameTh || '').trim(), lname: String(data.lastnameTh || '').trim(), birth_year, birth_month, birth_day };
}

async function agentRequest(path) {
  let response;
  try {
    response = await fetch(`http://127.0.0.1:8444${path}`, { signal: AbortSignal.timeout(15000), cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
  } catch {
    throw new Error('เชื่อมต่อเครื่องอ่านไม่ได้ กรุณาเปิด E-Form Agent บนเครื่องที่เปิดเว็บ และอนุญาตการเข้าถึงเครือข่ายภายในเมื่อเบราว์เซอร์ถาม');
  }
  if (!response.ok) throw new Error('E-Form Agent ไม่พร้อมใช้งาน กรุณาตรวจโปรแกรมแล้วลองใหม่');
  return response.json();
}
export async function readCard() {
  const readers = await agentRequest('/getChannelList');
  if (!Array.isArray(readers) || !readers.length) throw new Error('ไม่พบเครื่องอ่านบัตร กรุณาเสียบเครื่องอ่านก่อน');
  if (readers.length !== 1) throw new Error('พบเครื่องอ่านหลายเครื่อง กรุณาเชื่อมต่อเฉพาะเครื่องที่ต้องการอ่าน');
  if (!readers[0].name) throw new Error('ไม่พบชื่อเครื่องอ่านบัตร');
  return cardForm(await agentRequest(`/getDataFromCard?name=${encodeURIComponent(readers[0].name)}`));
}
