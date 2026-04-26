// ─── Age Calculation ───
export function calculateAge(birthDate) {
  if (!birthDate || birthDate === '' || birthDate === '-') return '-';
  let dob;
  const s = String(birthDate).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const p = s.split('/');
    dob = new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
  } else {
    dob = new Date(birthDate);
  }
  if (isNaN(dob.getTime())) return '-';
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return (age < 0 || age > 150) ? '-' : age;
}

export function getBirthYear(birthDate) {
  if (!birthDate || birthDate === '-') return null;
  const s = String(birthDate).trim();
  let year;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    year = parseInt(s.split('/')[2]);
  } else {
    const dob = new Date(birthDate);
    if (isNaN(dob.getTime())) return null;
    year = dob.getFullYear();
  }
  if (year > 2400) year -= 543;
  return year;
}

export function parseBirthToISO(birthStr) {
  if (!birthStr || birthStr === '' || birthStr === '-') return null;
  if (birthStr instanceof Date) {
    return birthStr.toISOString().split('T')[0];
  }
  const parts = String(birthStr).split('/');
  if (parts.length === 3) {
    let year = parseInt(parts[2]);
    if (year > 2400) year -= 543;
    return `${year}-${parts[1]}-${parts[0]}`;
  }
  return birthStr;
}

// ─── Input Validation ───
export function sanitizeInput(str) {
  if (!str) return '';
  return String(str).trim().replace(/[<>]/g, '').replace(/['"`;]/g, '');
}

export function validateCID(cid) {
  if (!cid) return { valid: false, clean: null };
  const clean = String(cid).replace(/\D/g, '');
  if (clean.length !== 13) return { valid: false, clean: null };
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(clean[i]) * (13 - i);
  const check = (11 - (sum % 11)) % 10;
  if (check !== parseInt(clean[12])) return { valid: false, clean: null };
  return { valid: true, clean };
}

export const VALID_MOOS = ['1','2','3','4','5','6','7','8','14','18','19','20','21','22','23'];

export const CHRONIC_LIST = [
  'ปกติ (ไม่มีโรค)', 'ความดันโลหิตสูง (HT)', 'เบาหวาน (DM)',
  'ความดัน+เบาหวาน (HT+DM)', 'ไขมันในเลือดสูง (DLP)', 'โรคไตเรื้อรัง (CKD)',
  'หัวใจ/หลอดเลือด', 'หลอดเลือดสมอง (Stroke)', 'ถุงลมโป่งพอง/หอบหืด',
  'มะเร็ง', 'ผู้ป่วยติดเตียง', 'จิตเวช'
];

export const MALE_TITLES = ['นาย', 'ด.ช.', 'เด็กชาย', 'ด.ช'];
