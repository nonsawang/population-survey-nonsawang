// ─── ระบบคัดกรองภาวะสุขภาพประจำปีงบประมาณ 2570 รพ.สต.บ้านโนนสว่าง ───
// Pure scoring, eligibility, PP Special code calculation, and 7-page A4 print layout generator

export const FISCAL_YEAR_2570 = 2570;

export const CHRONIC_HISTORY_OPTIONS = [
  { id: 'dm', label: 'โรคเบาหวาน' },
  { id: 'ht', label: 'โรคความดันโลหิตสูง' },
  { id: 'cad', label: 'โรคหลอดเลือดหัวใจ' },
  { id: 'copd', label: 'โรคถุงลมโป่งพอง/หอบหืด' },
];

export const SYMPTOM_HISTORY_12 = [
  { id: 's1', no: 1, label: 'มีแผลที่เท้า / ตัดขาจากโรคเบาหวาน' },
  { id: 's2', no: 2, label: 'ดื่มน้ำบ่อยและมาก' },
  { id: 's3', no: 3, label: 'กินจุแต่ผอม' },
  { id: 's4', no: 4, label: 'เป็นแผลที่ริมฝีปากบ่อยและหายยาก' },
  { id: 's5', no: 5, label: 'ตาพร่ามัวต้องเปลี่ยนแว่นบ่อย' },
  { id: 's6', no: 6, label: 'มีรอยพับที่คอ ใต้รักแร้ดำ' },
  { id: 's7', no: 7, label: 'คลอดบุตร นน.เกิน 4 กก.' },
  { id: 's8', no: 8, label: 'ปัสสาวะกลางคืน 3 ครั้งขึ้นไป' },
  { id: 's9', no: 9, label: 'น้ำหนักลด' },
  { id: 's10', no: 10, label: 'คันตามผิวหนัง' },
  { id: 's11', no: 11, label: 'ชาปลายมือ ปลายเท้า' },
  { id: 's12', no: 12, label: 'มีประวัติน้ำตาลในเลือดสูง' },
];

export const ASSIST_Q2_QUESTIONS = [
  {
    id: 'q2_1',
    label: '2.1 คุณดื่มเครื่องดื่มแอลกอฮอล์บ่อยเพียงไร (ถ้าตอบ "ไม่เคย" ให้ข้ามไปถามข้อ 3 ต่อ)',
    options: [
      { value: 'never', label: 'ไม่เคย', score: 0 },
      { value: 'once_twice', label: 'ครั้งสองครั้ง', score: 2 },
      { value: 'monthly', label: 'ทุกเดือน', score: 3 },
      { value: 'weekly', label: 'ทุกสัปดาห์', score: 4 },
      { value: 'daily', label: 'เกือบทุกวัน', score: 6 },
    ],
  },
  {
    id: 'q2_2',
    label: '2.2 คุณเคยรู้สึกอยากดื่มเครื่องดื่มแอลกอฮอล์บ่อยเพียงไร',
    options: [
      { value: 'never', label: 'ไม่เคย', score: 0 },
      { value: 'once_twice', label: 'ครั้งสองครั้ง', score: 3 },
      { value: 'monthly', label: 'ทุกเดือน', score: 4 },
      { value: 'weekly', label: 'ทุกสัปดาห์', score: 5 },
      { value: 'daily', label: 'เกือบทุกวัน', score: 6 },
    ],
  },
  {
    id: 'q2_3',
    label: '2.3 การดื่มเครื่องดื่มแอลกอฮอล์ ทำให้คุณเกิดปัญหาสุขภาพ การเงิน ครอบครัวบ่อยเพียงไร',
    options: [
      { value: 'never', label: 'ไม่เคย', score: 0 },
      { value: 'once_twice', label: 'ครั้งสองครั้ง', score: 4 },
      { value: 'monthly', label: 'ทุกเดือน', score: 5 },
      { value: 'weekly', label: 'ทุกสัปดาห์', score: 6 },
      { value: 'daily', label: 'เกือบทุกวัน', score: 7 },
    ],
  },
  {
    id: 'q2_4',
    label: '2.4 คุณไม่สามารถทำกิจกรรมที่ควรทำได้ตามปกติ เนื่องจากการดื่มแอลกอฮอล์บ่อยเพียงไร',
    options: [
      { value: 'never', label: 'ไม่เคย', score: 0 },
      { value: 'once_twice', label: 'ครั้งสองครั้ง', score: 5 },
      { value: 'monthly', label: 'ทุกเดือน', score: 6 },
      { value: 'weekly', label: 'ทุกสัปดาห์', score: 7 },
      { value: 'daily', label: 'เกือบทุกวัน', score: 8 },
    ],
  },
];

export const ASSIST_Q3_QUESTIONS = [
  {
    id: 'q3_1',
    label: '3.1 ญาติ เพื่อนฝูง เคยแสดงความกังวลหรือตักเตือนเกี่ยวกับการดื่มหรือไม่',
    options: [
      { value: 'never', label: 'ไม่เคย', score: 0 },
      { value: 'recent_3m', label: 'เคย ในช่วง 3 เดือน', score: 6 },
      { value: 'before_3m', label: 'เคย ก่อน 3 เดือน', score: 3 },
    ],
  },
  {
    id: 'q3_2',
    label: '3.2 คุณเคยพยายามหยุดหรือลด การดื่มเครื่องดื่มแอลกอฮอล์หรือไม่',
    options: [
      { value: 'never', label: 'ไม่เคย', score: 0 },
      { value: 'recent_3m', label: 'เคย ในช่วง 3 เดือน', score: 6 },
      { value: 'before_3m', label: 'เคย ก่อน 3 เดือน', score: 3 },
    ],
  },
];

export const TB_SYMPTOM_QUESTIONS = [
  { id: 'tb1', label: '3.1 ไอทุกวัน นาน 2 สัปดาห์', weight: 3 },
  { id: 'tb2', label: '3.2 ไอเสมหะมีเลือดปน', weight: 3 },
  { id: 'tb3', label: '3.3 มีไข้ ตอนบ่าย หรือ ตอนเย็น หรือ ตอนกลางคืน บ่อยๆ ในรอบ 1 เดือนที่ผ่านมา', weight: 2 },
  { id: 'tb4', label: '3.4 น้ำหนักลด 2–4 กก. โดยไม่ทราบสาเหตุ ในรอบ 1 เดือนที่ผ่านมา', weight: 1 },
  { id: 'tb5', label: '3.5 เหงื่อออกมาก ตอนกลางคืน ในรอบ 1 เดือนที่ผ่านมา (ลักษณะเหงื่อออกชุ่มตัว)', weight: 1 },
  { id: 'tb6', label: '3.6 ต่อมน้ำเหลืองโต', weight: 2 },
];

export const KNEE_SYMPTOM_QUESTIONS = [
  { id: 'k1', label: '1. ข้อเข่าฝืดตึงหลังตื่นนอนตอนเช้านาน < 30 นาที' },
  { id: 'k2', label: '2. เสียงดังกรอบแกรบในข้อเข่าขณะเคลื่อนไหว' },
  { id: 'k3', label: '3. กดเจ็บที่กระดูกข้อเข่า' },
  { id: 'k4', label: '4. ข้อใหญ่ผิดรูป' },
  { id: 'k5', label: '5. จับไม่พบข้อเข่าอุ่น' },
];

export const MNA_QUESTIONS = [
  {
    id: 'mna1',
    label: '1. ในช่วง 3 เดือนที่ผ่านมา ทานอาหารได้น้อยลงหรือไม่',
    options: [
      { score: 0, label: '0 = ทานน้อยลงอย่างมาก' },
      { score: 1, label: '1 = ทานน้อยลงปานกลาง' },
      { score: 2, label: '2 = ไม่มีความเปลี่ยนแปลง' },
    ],
  },
  {
    id: 'mna2',
    label: '2. ในช่วง 3 เดือนที่ผ่านมา น้ำหนักลดลงหรือไม่',
    options: [
      { score: 0, label: '0 = ลดลงมากกว่า 3 กก.' },
      { score: 1, label: '1 = ไม่ทราบ' },
      { score: 2, label: '2 = ลดลง 1–3 กก.' },
      { score: 3, label: '3 = น้ำหนักไม่ลดลง' },
    ],
  },
  {
    id: 'mna3',
    label: '3. สามารถเคลื่อนไหวได้เองหรือไม่',
    options: [
      { score: 0, label: '0 = นอนบนเตียงหรือนั่งบนรถเข็นตลอดเวลา' },
      { score: 1, label: '1 = ลุกจากเตียงได้แต่ออกไปข้างนอกไม่ได้' },
      { score: 2, label: '2 = เดินเคลื่อนไหวได้ปกติ' },
    ],
  },
  {
    id: 'mna4',
    label: '4. ใน 3 เดือนที่ผ่านมา มีความเครียดรุนแรงหรือป่วยเฉียบพลันหรือไม่',
    options: [
      { score: 0, label: '0 = มี' },
      { score: 2, label: '2 = ไม่มี' },
    ],
  },
  {
    id: 'mna5',
    label: '5. มีปัญหาทางสุขภาพจิตหรือไม่',
    options: [
      { score: 0, label: '0 = ความจำเสื่อมหรือซึมเศร้ารุนแรง' },
      { score: 1, label: '1 = ความจำเสื่อมเล็กน้อย' },
      { score: 2, label: '2 = ไม่มีปัญหาทางประสาท' },
    ],
  },
  {
    id: 'mna6',
    label: '6. ดัชนีมวลกาย BMI (คำนวณจากข้อ 1 อัตโนมัติ หรือเลือกเอง)',
    options: [
      { score: 0, label: '0 = BMI น้อยกว่า 19' },
      { score: 1, label: '1 = BMI 19–20' },
      { score: 2, label: '2 = BMI 21–22' },
      { score: 3, label: '3 = BMI 23 ขึ้นไป' },
    ],
  },
  {
    id: 'mna7',
    label: '7. เส้นรอบวงน่อง (หน่วยเป็นเซนติเมตร)',
    options: [
      { score: 0, label: '0 = น้อยกว่า 31 ซม.' },
      { score: 3, label: '3 = ตั้งแต่ 31 ซม. ขึ้นไป' },
    ],
  },
];

export const ADL_QUESTIONS = [
  {
    id: 'adl1',
    label: '1. กินอาหาร เมื่อเตรียมสำรับไว้ให้ต่อหน้า',
    options: [
      { score: 0, label: 'ทำไม่ได้ (0)' },
      { score: 1, label: 'ทำได้เองบ้างแต่ต้องมีคนช่วย (1)' },
      { score: 2, label: 'ทำได้เอง (2)' },
    ],
  },
  {
    id: 'adl2',
    label: '2. ล้างหน้า หวีผม แปรงฟัน โกนหนวด',
    options: [
      { score: 0, label: 'ต้องการความช่วยเหลือ (0)' },
      { score: 1, label: 'ทำได้เอง (1)' },
    ],
  },
  {
    id: 'adl3',
    label: '3. การลุกนั่งจากที่นอน ไปยังเก้าอี้',
    options: [
      { score: 0, label: 'ทำไม่ได้ (0)' },
      { score: 1, label: 'ต้องการความช่วยเหลืออย่างมาก (1)' },
      { score: 2, label: 'ต้องการความช่วยเหลือบ้าง (2)' },
      { score: 3, label: 'ทำได้เอง (3)' },
    ],
  },
  {
    id: 'adl4',
    label: '4. การใช้ห้องน้ำห้องส้วม',
    options: [
      { score: 0, label: 'ช่วยตัวเองไม่ได้ (0)' },
      { score: 1, label: 'ทำเองได้บ้าง (1)' },
      { score: 2, label: 'ช่วยตัวเองได้ดี (2)' },
    ],
  },
  {
    id: 'adl5',
    label: '5. การเคลื่อนที่ภายในห้องหรือบ้าน',
    options: [
      { score: 0, label: 'เคลื่อนที่ไปไหนไม่ได้ (0)' },
      { score: 1, label: 'ต้องใช้รถเข็นแต่ไม่ต้องช่วย (1)' },
      { score: 2, label: 'เดินได้ต้องมีคนพยุง (2)' },
      { score: 3, label: 'เดินได้เอง (3)' },
    ],
  },
  {
    id: 'adl6',
    label: '6. การสวมใส่เสื้อผ้า',
    options: [
      { score: 0, label: 'ต้องมีคนสวมใส่ให้ (0)' },
      { score: 1, label: 'ช่วยตัวเองได้ประมาณครึ่งหนึ่งที่เหลือต้องช่วย (1)' },
      { score: 2, label: 'ทำได้เอง (2)' },
    ],
  },
  {
    id: 'adl7',
    label: '7. การขึ้นลงบันได 1 ขั้น',
    options: [
      { score: 0, label: 'ไม่สามารถทำได้ (0)' },
      { score: 1, label: 'ต้องการคนช่วย (1)' },
      { score: 2, label: 'ขึ้นลงได้เอง ถ้าใช้เครื่องช่วยจะต้องเอาขึ้นลงได้ด้วย (2)' },
    ],
  },
  {
    id: 'adl8',
    label: '8. การอาบน้ำ',
    options: [
      { score: 0, label: 'ต้องมีคนช่วยหรือทำให้ (0)' },
      { score: 1, label: 'อาบน้ำเองได้ (1)' },
    ],
  },
  {
    id: 'adl9',
    label: '9. การกลั้นอุจจาระ ในระยะ 1 สัปดาห์ที่ผ่านมา',
    options: [
      { score: 0, label: 'กลั้นไม่ได้ (0)' },
      { score: 1, label: 'กลั้นไม่ได้บางครั้ง น้อยกว่า 1 ครั้ง/สัปดาห์ (1)' },
      { score: 2, label: 'กลั้นได้ปกติ (2)' },
    ],
  },
  {
    id: 'adl10',
    label: '10. การกลั้นปัสสาวะ ในระยะ 1 สัปดาห์ที่ผ่านมา',
    options: [
      { score: 0, label: 'กลั้นไม่ได้ (0)' },
      { score: 1, label: 'กลั้นไม่ได้บางครั้ง น้อยกว่า 1 ครั้ง/สัปดาห์ (1)' },
      { score: 2, label: 'กลั้นได้ปกติ (2)' },
    ],
  },
];

export function inferPersonProfile(person = {}) {
  const rawAge = Number(person.age);
  let birthYearCE = null;
  const bStr = String(person.birthDate || person.birth_date || '').trim();
  if (bStr && bStr !== '-') {
    if (/^\d{4}-\d{2}-\d{2}/.test(bStr)) {
      birthYearCE = parseInt(bStr.slice(0, 4), 10);
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(bStr)) {
      birthYearCE = parseInt(bStr.split('/')[2], 10);
    }
    if (birthYearCE && birthYearCE > 2400) birthYearCE -= 543;
  }
  const nowYear = new Date().getFullYear();
  const age = Number.isFinite(rawAge) && rawAge >= 0
    ? rawAge
    : birthYearCE
    ? Math.max(0, nowYear - birthYearCE)
    : 40;
  const effectiveBirthYearCE = birthYearCE || nowYear - age;
  const birthYearBE = effectiveBirthYearCE + 543;

  const fullTitle = String(person.title || person.fullname || person.name || '').trim();
  const isMale = /^(นาย|ด\.ช\.|เด็กชาย|ด\.ช|พระ|สามเณร)/.test(fullTitle);
  const isFemale = !isMale;

  return {
    age,
    birthYearCE: effectiveBirthYearCE,
    birthYearBE,
    isMale,
    isFemale,
    bornBefore2535: birthYearBE < 2535,
  };
}

export function getApplicableSections(person = {}) {
  const p = inferPersonProfile(person);
  return {
    s1_anthropometry: true,
    s2_blood_pressure: p.age >= 35,
    s3_diabetes: p.age >= 35,
    s4_hepatitis_bc: p.bornBefore2535,
    s5_breast_cancer: p.isFemale && p.age >= 30 && p.age <= 70,
    s6_cervical_cancer: p.isFemale && p.age >= 30 && p.age <= 59,
    s7_colorectal_cancer: p.age >= 50 && p.age <= 70,
    s8_smoking: p.age >= 15,
    s9_alcohol: p.age >= 15,
    s10_exercise: p.age >= 15,
    s11_tuberculosis: true,
    s12_depression_2q: p.age >= 15,
    s13_oral_health: p.age >= 60,
    s14_hearing: p.age >= 60,
    s15_vision: p.age >= 60,
    s16_minicog: p.age >= 60,
    s17_knee_oa: p.age >= 60,
    s18_incontinence: p.age >= 60,
    s19_fall_tugt: p.age >= 60,
    s20_sleep: p.age >= 60,
    s21_nutrition_mna: p.age >= 60,
    s22_adl: p.age >= 60,
  };
}

export function createDefaultScreening2570Form(person = {}, todayStr = '') {
  const screenDate =
    todayStr ||
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

  const chronicStr = String(person.chronic || '');
  const personalChronic = {
    dm: /เบาหวาน|DM/i.test(chronicStr),
    ht: /ความดัน|HT/i.test(chronicStr),
    cad: /หัวใจ/i.test(chronicStr),
    copd: /ถุงลม|หอบหืด/i.test(chronicStr),
    other: '',
  };

  return {
    screenDate,
    phone: person.phone || '',
    personalChronic,
    familyChronic: {
      dm: false,
      ht: false,
      cad: false,
      copd: false,
      other: '',
    },
    pastSymptoms: {
      s1: false, s2: false, s3: false, s4: false,
      s5: false, s6: false, s7: false, s8: false,
      s9: false, s10: false, s11: false, s12: false,
    },
    // 1. น้ำหนัก ส่วนสูง รอบเอว BMI
    s1: {
      weightKg: '',
      heightCm: '',
      waistCm: '',
    },
    // 2. ความดันโลหิต (35+)
    s2: {
      sbp1: '',
      dbp1: '',
      sbp2: '',
      dbp2: '',
    },
    // 3. เบาหวาน (35+)
    s3: {
      fastingType: 'fasting', // 'fasting' (ก่อนอาหาร งด 6-8 ชม.) | 'postprandial' (หลังอาหาร)
      dtxMgDl: '',
    },
    // 4. ไวรัสตับอักเสบ B/C (เกิดก่อน พ.ศ.2535)
    s4: {
      hbvResult: '', // 'negative' | 'positive' | ''
      hbcResult: '', // 'negative' | 'positive' | ''
    },
    // 5. มะเร็งเต้านมด้วยตนเอง (30-70 ปี)
    s5: {
      result: '', // 'normal' | 'abnormal' | ''
      abnormalDetail: '',
    },
    // 6. มะเร็งปากมดลูก (30-59 ปี)
    s6: {
      everScreened: '', // 'ever' | 'never' | ''
      screenedYearBE: '',
    },
    // 7. มะเร็งลำไส้ (50-70 ปี)
    s7: {
      everScreened: '', // 'ever' | 'never' | ''
      screenedYearBE: '',
    },
    // 8. คัดกรองบุหรี่
    s8: {
      status: 'never', // 'never' (1B52) | 'quit' (1B51) | 'current' (1B50)
      cigsPerDay: '', // '1_10' (1B501) | '11_19' (1B502) | '20_up' (1B503)
      firstCigWait: '', // 'lt_30m' (1B504) | 'gt_30m' (1B505) | 'gte_1h' (1B506)
      staffCare: 'advice', // 'advice' (1B530) | 'counseling' (1B531) | 'counseling_med' (1B532)
    },
    // 9. คัดกรองสุรา ASSIST
    s9: {
      status: 'never', // 'never' (1B600) | 'quit_1y' (1B601) | 'current'
      q2_1: 'never',
      q2_2: 'never',
      q2_3: 'never',
      q2_4: 'never',
      q3_1: 'never',
      q3_2: 'never',
    },
    // 10. การออกกำลังกาย
    s10: {
      frequency: '3_per_week', // 'daily_30m' | 'gt_3_per_week' | '3_per_week' | 'lt_3_per_week' | 'none'
    },
    // 11. คัดกรองวัณโรค
    s11: {
      hasFamilyTb: false,
      familyTbDetail: '',
      isTbCaregiver: false,
      tbCaregiverDetail: '',
      everHadTb: 'never', // 'never' | 'ever'
      tbYear: '',
      tbHospital: '',
      symptoms: {
        tb1: false,
        tb2: false,
        tb3: false,
        tb4: false,
        tb5: false,
        tb6: false,
      },
    },
    // 12. คัดกรองโรคซึมเศร้า 2Q
    s12: {
      q1_sad: false,
      q2_bored: false,
    },
    // 13. สุขภาพช่องปาก (60+)
    s13: {
      naturalTeethCount: '24',
      lessThan20Teeth: false,
      hasDecay: false,
      hasGumAbscessLoose: false,
      hasDenture: false,
      hasOralUlcerOver2W: false,
      hasDryMouth: false,
      cleanliness: 'clean', // 'clean' (1B1260) | 'unclean' (1B1261)
    },
    // 14. การได้ยิน (60+)
    s14: {
      leftEar: 'hear', // 'hear' | 'not_hear'
      rightEar: 'hear', // 'hear' | 'not_hear'
    },
    // 15. สุขภาพทางตา 5 ข้อ (60+)
    s15: {
      nearVision: 'normal', // 'normal' (1B1240) | 'problem' (1B1241) | 'refer' (1B1242)
      farVision: 'normal',  // 'normal' (1B1243) | 'problem' (1B1244) | 'refer' (1B1245)
      cataract: 'normal',   // 'normal' (1B1250) | 'problem' (1B1251) | 'refer' (1B1252)
      cataractEye: '',      // 'left' | 'right' | 'both' | ''
      glaucoma: 'normal',   // 'normal' (1B1253) | 'problem' (1B1254) | 'refer' (1B1255)
      glaucomaEye: '',
      amd: 'normal',        // 'normal' (1B1256) | 'problem' (1B1257) | 'refer' (1B1258)
      amdEye: '',
    },
    // 16. การทดสอบสภาพสมอง Mini-Cog (60+)
    s16: {
      repeatWords: { w1: true, w2: true, w3: true },
      clockScore: 2, // 0 or 2
      recallWords: { w1: true, w2: true, w3: true },
    },
    // 17. คัดกรองโรคข้อเข่าเสื่อม (60+)
    s17: {
      hasKneePain: false,
      symptoms: {
        k1: false,
        k2: false,
        k3: false,
        k4: false,
        k5: false,
      },
    },
    // 18. คัดกรองภาวะกลั้นปัสสาวะ (60+)
    s18: {
      hasIncontinence: false,
    },
    // 19. คัดกรองภาวะหกล้ม TUGT (60+)
    s19: {
      fellLast6Months: false,
      walkMinutes: 0,
      walkSeconds: 9,
    },
    // 20. ปัญหาการนอน (60+)
    s20: {
      hasSleepProblem: false,
      problems: {
        insomnia: false,
        oversleep: false,
        snoring: false,
        sleepwalking: false,
        other: '',
      },
      durationYears: '',
      avgHoursPerNight: '7',
      daytimeFatigue: false,
    },
    // 21. ภาวะขาดสารอาหาร MNA (60+)
    s21: {
      mna1: 2,
      mna2: 3,
      mna3: 2,
      mna4: 2,
      mna5: 2,
      mna6Override: null, // null = คำนวณจาก BMI ข้อ 1 อัตโนมัติ
      calfCm: '33',
      mna7: 3,
    },
    // 22. การประเมิน ADL 10 ข้อ (60+)
    s22: {
      adl1: 2,
      adl2: 1,
      adl3: 3,
      adl4: 2,
      adl5: 3,
      adl6: 2,
      adl7: 2,
      adl8: 1,
      adl9: 2,
      adl10: 2,
    },
    consent: {
      accepted: true,
      staffName: '',
      staffPosition: '',
      patientSignatureDataUrl: '',
    },
  };
}

export function calculateBmi(weightKg, heightCm) {
  const w = Number(weightKg);
  const h = Number(heightCm);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 40) return null;
  const hM = h / 100;
  const bmi = w / (hM * hM);
  return Math.round(bmi * 10) / 10;
}

export function classifyBmi(bmi) {
  if (!Number.isFinite(bmi)) return { label: '-', level: 'unknown', mnaScore: 3 };
  const mnaScore = bmi < 19 ? 0 : bmi < 21 ? 1 : bmi < 23 ? 2 : 3;
  if (bmi < 18.5) return { label: 'ผอม (< 18.5)', level: 'warning', mnaScore };
  if (bmi < 23) return { label: 'ปกติ (18.5–22.9)', level: 'normal', mnaScore };
  if (bmi < 25) return { label: 'ท้วม (23.0–24.9)', level: 'risk', mnaScore };
  if (bmi < 30) return { label: 'อ้วนระดับ 1 (25.0–29.9)', level: 'abnormal', mnaScore };
  return { label: 'อ้วนระดับ 2 (≥ 30.0)', level: 'danger', mnaScore };
}

export function evaluateBloodPressure(s2 = {}) {
  const sbp1 = Number(s2.sbp1);
  const dbp1 = Number(s2.dbp1);
  const sbp2 = Number(s2.sbp2);
  const dbp2 = Number(s2.dbp2);

  const hasFirst = Number.isFinite(sbp1) && sbp1 > 0 && Number.isFinite(dbp1) && dbp1 > 0;
  const needsSecond = hasFirst && (sbp1 > 140 || dbp1 > 90);
  const hasSecond = Number.isFinite(sbp2) && sbp2 > 0 && Number.isFinite(dbp2) && dbp2 > 0;

  const activeSbp = hasSecond ? sbp2 : hasFirst ? sbp1 : null;
  const activeDbp = hasSecond ? dbp2 : hasFirst ? dbp1 : null;

  if (!activeSbp || !activeDbp) {
    return { hasReading: false, needsSecond: false, label: 'ยังไม่ได้วัด', level: 'unknown' };
  }

  const sbpRank = activeSbp >= 180 ? 3 : activeSbp >= 140 ? 2 : activeSbp >= 130 ? 1 : 0;
  const dbpRank = activeDbp >= 110 ? 3 : activeDbp >= 90 ? 2 : activeDbp >= 80 ? 1 : 0;
  const maxRank = Math.max(sbpRank, dbpRank);

  const map = [
    { label: 'ปกติ (SBP 50–129 / DBP 50–79)', level: 'normal' },
    { label: 'เสี่ยง (SBP 130–139 / DBP 80–89)', level: 'risk' },
    { label: 'สงสัยป่วย (SBP 140–179 / DBP 90–109)', level: 'abnormal' },
    { label: 'ป่วย / สูงมาก (SBP ≥ 180 / DBP ≥ 110)', level: 'danger' },
  ];

  return {
    hasReading: true,
    needsSecond,
    activeSbp,
    activeDbp,
    ...map[maxRank],
  };
}

export function evaluateBloodSugar(s3 = {}) {
  const dtx = Number(s3.dtxMgDl);
  if (!Number.isFinite(dtx) || dtx <= 0) {
    return { hasReading: false, label: 'ยังไม่ได้เจาะน้ำตาล', level: 'unknown' };
  }
  if (dtx < 70) return { hasReading: true, dtx, label: 'น้ำตาลต่ำ (< 70 mg/dL)', level: 'warning' };
  if (dtx <= 99) return { hasReading: true, dtx, label: 'ปกติ (70–99 mg/dL)', level: 'normal' };
  if (dtx <= 125) return { hasReading: true, dtx, label: 'เสี่ยง (100–125 mg/dL)', level: 'risk' };
  return { hasReading: true, dtx, label: 'สงสัยป่วย (≥ 126 mg/dL)', level: 'danger' };
}

export function evaluateAssistAlcohol(s9 = {}) {
  if (s9.status === 'never') {
    return { score: 0, label: 'ไม่เคยดื่ม', level: 'normal', codes: ['1B600'] };
  }
  if (s9.status === 'quit_1y') {
    return { score: 0, label: 'เคยดื่มแต่หยุดแล้ว 1 ปีขึ้นไป', level: 'normal', codes: ['1B601'] };
  }

  let score = 0;
  const q2_1Obj = ASSIST_Q2_QUESTIONS[0].options.find((o) => o.value === s9.q2_1);
  score += q2_1Obj ? q2_1Obj.score : 0;

  // ถ้าข้อ 2.1 ตอบ "ไม่เคย" ให้ข้ามข้อ 2.2-2.4 ไปถามข้อ 3 ต่อตามแบบฟอร์ม
  if (s9.q2_1 !== 'never') {
    for (const q of ASSIST_Q2_QUESTIONS.slice(1)) {
      const opt = q.options.find((o) => o.value === s9[q.id]);
      score += opt ? opt.score : 0;
    }
  }

  for (const q of ASSIST_Q3_QUESTIONS) {
    const opt = q.options.find((o) => o.value === s9[q.id]);
    score += opt ? opt.score : 0;
  }

  if (score <= 10) {
    return {
      score,
      label: `ดื่มระดับความเสี่ยงต่ำ (${score} คะแนน: 1–10 คะแนน)`,
      level: 'risk',
      codes: ['1B602', '1B610'],
    };
  }
  if (score <= 26) {
    return {
      score,
      label: `ดื่มระดับความเสี่ยงปานกลาง (${score} คะแนน: 11–26 คะแนน)`,
      level: 'abnormal',
      codes: ['1B603', '1B611'],
    };
  }
  return {
    score,
    label: `ดื่มระดับความเสี่ยงสูง (${score} คะแนน: > 26 คะแนน)`,
    level: 'danger',
    codes: ['1B604', '1B611', '1B612'],
  };
}

export function evaluateSmoking(s8 = {}) {
  if (s8.status === 'never') {
    return { label: 'ไม่เคยสูบเลย', level: 'normal', codes: ['1B52'] };
  }
  if (s8.status === 'quit') {
    return { label: 'เคยสูบแต่เลิกแล้ว', level: 'normal', codes: ['1B51'] };
  }
  const codes = ['1B50'];
  if (s8.cigsPerDay === '1_10') codes.push('1B501');
  else if (s8.cigsPerDay === '11_19') codes.push('1B502');
  else if (s8.cigsPerDay === '20_up') codes.push('1B503');

  if (s8.firstCigWait === 'lt_30m') codes.push('1B504');
  else if (s8.firstCigWait === 'gt_30m') codes.push('1B505');
  else if (s8.firstCigWait === 'gte_1h') codes.push('1B506');

  if (s8.staffCare === 'advice') codes.push('1B530');
  else if (s8.staffCare === 'counseling') codes.push('1B531');
  else if (s8.staffCare === 'counseling_med') codes.push('1B532');

  return {
    label: 'ยังสูบอยู่',
    level: 'abnormal',
    codes,
  };
}

export function evaluateTb(s11 = {}) {
  let score = 0;
  for (const q of TB_SYMPTOM_QUESTIONS) {
    if (s11?.symptoms?.[q.id]) score += q.weight;
  }
  const suspect = score >= 3;
  return {
    score,
    suspect,
    label: suspect ? `สงสัยวัณโรค (${score} คะแนน ≥ 3 ส่งตรวจวินิจฉัย)` : `ปกติ (${score} คะแนน < 3)`,
    level: suspect ? 'danger' : 'normal',
  };
}

export function evaluateDepression2Q(s12 = {}, age = 40) {
  const positive = Boolean(s12.q1_sad || s12.q2_bored);
  const isElderly = Number(age) >= 60;
  const code = isElderly ? (positive ? '1B0281' : '1B0280') : positive ? '1B0211' : '1B0210';
  return {
    positive,
    code,
    label: positive ? 'ผิดปกติ (เสี่ยงซึมเศร้า — ประเมิน 9Q ต่อ)' : 'ปกติ (ไม่พบความเสี่ยง 2Q)',
    level: positive ? 'abnormal' : 'normal',
  };
}

export function evaluateOralHealth(s13 = {}) {
  const hasPathology = Boolean(
    s13.lessThan20Teeth ||
      s13.hasDecay ||
      s13.hasGumAbscessLoose ||
      s13.hasOralUlcerOver2W ||
      s13.hasDryMouth
  );
  const isClean = s13.cleanliness !== 'unclean';
  const code = isClean ? '1B1260' : '1B1261';
  return {
    code,
    hasPathology,
    isClean,
    label:
      isClean && !hasPathology
        ? 'ช่องปากสะอาด ไม่พบปัญหา (1B1260)'
        : !isClean
        ? 'พฤติกรรมทำความสะอาดไม่เหมาะสม / ไม่สะอาด (1B1261)'
        : 'ช่องปากสะอาด แต่มีปัญหาในช่องปากควรส่งต่อทันตกรรม (1B1260)',
    level: !isClean || hasPathology ? 'warning' : 'normal',
  };
}

export function evaluateHearing(s14 = {}) {
  const leftOk = s14.leftEar !== 'not_hear';
  const rightOk = s14.rightEar !== 'not_hear';
  if (leftOk && rightOk) {
    return { code: '1B1140', label: 'การได้ยินปกติทั้ง 2 ข้าง (1B1140)', level: 'normal' };
  }
  if (leftOk || rightOk) {
    return { code: '1B1141', label: 'เฝ้าระวัง — ไม่ได้ยิน 1 ข้าง (1B1141)', level: 'warning' };
  }
  return { code: '1B1142', label: 'ผิดปกติ — ไม่ได้ยินทั้ง 2 ข้าง (1B1142)', level: 'danger' };
}

export function evaluateVision(s15 = {}) {
  const mapCode = (val, cNormal, cProb, cRefer) =>
    val === 'refer' ? cRefer : val === 'problem' ? cProb : cNormal;

  const codes = [
    mapCode(s15.nearVision, '1B1240', '1B1241', '1B1242'),
    mapCode(s15.farVision, '1B1243', '1B1244', '1B1245'),
    mapCode(s15.cataract, '1B1250', '1B1251', '1B1252'),
    mapCode(s15.glaucoma, '1B1253', '1B1254', '1B1255'),
    mapCode(s15.amd, '1B1256', '1B1257', '1B1258'),
  ];

  const hasProblem = [s15.nearVision, s15.farVision, s15.cataract, s15.glaucoma, s15.amd].some(
    (v) => v === 'problem' || v === 'refer'
  );

  return {
    codes,
    hasProblem,
    label: hasProblem ? 'พบปัญหาสายตา / ส่งต่อตรวจตา' : 'สายตาปกติทั้ง 5 รายการ',
    level: hasProblem ? 'warning' : 'normal',
  };
}

export function evaluateMiniCog(s16 = {}) {
  const clock = Number(s16.clockScore) === 2 ? 2 : 0;
  const recall =
    (s16?.recallWords?.w1 ? 1 : 0) +
    (s16?.recallWords?.w2 ? 1 : 0) +
    (s16?.recallWords?.w3 ? 1 : 0);
  const total = clock + recall;
  const abnormal = total <= 3;
  return {
    clock,
    recall,
    total,
    abnormal,
    code: abnormal ? '1B1221' : '1B1220',
    label: abnormal
      ? `ผิดปกติ (${total}/5 คะแนน ≤ 3 มีภาวะการรู้คิดบกพร่อง 1B1221)`
      : `ปกติ (${total}/5 คะแนน 1B1220)`,
    level: abnormal ? 'abnormal' : 'normal',
  };
}

export function evaluateKneeOa(s17 = {}) {
  if (!s17.hasKneePain) {
    return {
      yesCount: 0,
      abnormal: false,
      code: '1B1270',
      label: 'ไม่ปวดเข่า / ปกติ (1B1270)',
      level: 'normal',
    };
  }
  const yesCount = KNEE_SYMPTOM_QUESTIONS.reduce(
    (acc, q) => acc + (s17?.symptoms?.[q.id] ? 1 : 0),
    0
  );
  const abnormal = yesCount >= 2;
  return {
    yesCount,
    abnormal,
    code: abnormal ? '1B1271' : '1B1270',
    label: abnormal
      ? `ผิดปกติ — ปวดเข่าและเข้าเกณฑ์ ${yesCount}/5 ข้อ (มีโอกาสข้อเข่าเสื่อม 1B1271)`
      : `ปวดเข่าแต่เข้าเกณฑ์ ${yesCount}/5 ข้อ (< 2 ข้อ 1B1270)`,
    level: abnormal ? 'abnormal' : 'warning',
  };
}

export function evaluateIncontinence(s18 = {}) {
  const abnormal = Boolean(s18.hasIncontinence);
  return {
    abnormal,
    code: abnormal ? '1B1285' : '1B1284',
    label: abnormal ? 'ผิดปกติ — มีปัสสาวะเล็ด/ราด (1B1285)' : 'ปกติ — กลั้นปัสสาวะได้ (1B1284)',
    level: abnormal ? 'abnormal' : 'normal',
  };
}

export function evaluateFallTugt(s19 = {}) {
  const mins = Math.max(0, Number(s19.walkMinutes) || 0);
  const secs = Math.max(0, Number(s19.walkSeconds) || 0);
  const totalSeconds = mins * 60 + secs;
  const risk = totalSeconds >= 12 || Boolean(s19.fellLast6Months);
  return {
    totalSeconds,
    risk,
    code: risk ? '1B1201' : '1B1200',
    label: risk
      ? `มีความเสี่ยงต่อภาวะหกล้ม (เดิน ${totalSeconds} วินาที${s19.fellLast6Months ? ' / เคยหกล้ม' : ''} — 1B1201)`
      : `เดินได้ปกติ ไม่เสี่ยง (เดิน ${totalSeconds} วินาที — 1B1200)`,
    level: risk ? 'abnormal' : 'normal',
  };
}

export function evaluateSleep(s20 = {}) {
  const hasProblem = Boolean(s20.hasSleepProblem || s20.daytimeFatigue);
  return {
    hasProblem,
    codes: hasProblem ? ['1B1213'] : [],
    label: hasProblem ? 'มีปัญหาการนอน / ง่วงกลางวัน (1B1213)' : 'การนอนปกติ',
    level: hasProblem ? 'warning' : 'normal',
  };
}

export function evaluateMna(s21 = {}, bmi = null) {
  const bmiClass = classifyBmi(bmi);
  const mna6 =
    s21.mna6Override !== null && s21.mna6Override !== undefined && s21.mna6Override !== ''
      ? Number(s21.mna6Override)
      : bmiClass.mnaScore;

  const calfVal = Number(s21.calfCm);
  const mna7 = Number.isFinite(calfVal) && calfVal > 0 ? (calfVal >= 31 ? 3 : 0) : Number(s21.mna7 ?? 3);

  const total =
    Number(s21.mna1 ?? 2) +
    Number(s21.mna2 ?? 3) +
    Number(s21.mna3 ?? 2) +
    Number(s21.mna4 ?? 2) +
    Number(s21.mna5 ?? 2) +
    mna6 +
    mna7;

  if (total >= 12) {
    return {
      total,
      mna6,
      mna7,
      code: '1K10',
      label: `โภชนาการปกติ (${total}/14 คะแนน — 1K10)`,
      level: 'normal',
    };
  }
  if (total >= 8) {
    return {
      total,
      mna6,
      mna7,
      code: '1K11',
      label: `เสี่ยงต่อภาวะขาดสารอาหาร (${total}/14 คะแนน — 1K11)`,
      level: 'warning',
    };
  }
  return {
    total,
    mna6,
    mna7,
    code: '1K12',
    label: `ขาดสารอาหาร (${total}/14 คะแนน — 1K12)`,
    level: 'danger',
  };
}

export function evaluateAdl(s22 = {}) {
  let total = 0;
  for (const q of ADL_QUESTIONS) {
    total += Number(s22[q.id] ?? 0);
  }
  if (total > 11) {
    return {
      total,
      code: '1B1280',
      group: 'ติดสังคม',
      label: `ติดสังคม (${total}/20 คะแนน — 1B1280)`,
      level: 'normal',
    };
  }
  if (total >= 5) {
    return {
      total,
      code: '1B1281',
      group: 'ติดบ้าน',
      label: `ติดบ้าน (${total}/20 คะแนน — 1B1281)`,
      level: 'warning',
    };
  }
  return {
    total,
    code: '1B1282',
    group: 'ติดเตียง',
    label: `ติดเตียง (${total}/20 คะแนน — 1B1282)`,
    level: 'danger',
  };
}

export function evaluateFullScreening2570(formData = {}, person = {}) {
  const profile = inferPersonProfile(person);
  const targets = getApplicableSections(person);

  const bmi = calculateBmi(formData?.s1?.weightKg, formData?.s1?.heightCm);
  const bmiInfo = classifyBmi(bmi);
  const bpInfo = evaluateBloodPressure(formData?.s2);
  const sugarInfo = evaluateBloodSugar(formData?.s3);
  const smokingInfo = evaluateSmoking(formData?.s8);
  const alcoholInfo = evaluateAssistAlcohol(formData?.s9);
  const tbInfo = evaluateTb(formData?.s11);
  const dep2qInfo = evaluateDepression2Q(formData?.s12, profile.age);

  const oralInfo = evaluateOralHealth(formData?.s13);
  const hearingInfo = evaluateHearing(formData?.s14);
  const visionInfo = evaluateVision(formData?.s15);
  const miniCogInfo = evaluateMiniCog(formData?.s16);
  const kneeInfo = evaluateKneeOa(formData?.s17);
  const incontinenceInfo = evaluateIncontinence(formData?.s18);
  const fallInfo = evaluateFallTugt(formData?.s19);
  const sleepInfo = evaluateSleep(formData?.s20);
  const mnaInfo = evaluateMna(formData?.s21, bmi);
  const adlInfo = evaluateAdl(formData?.s22);

  const ppSpecialCodes = [];
  if (targets.s8_smoking) ppSpecialCodes.push(...smokingInfo.codes);
  if (targets.s9_alcohol) ppSpecialCodes.push(...alcoholInfo.codes);
  if (targets.s12_depression_2q) ppSpecialCodes.push(dep2qInfo.code);

  if (profile.age >= 60) {
    ppSpecialCodes.push(oralInfo.code);
    ppSpecialCodes.push(hearingInfo.code);
    ppSpecialCodes.push(...visionInfo.codes);
    ppSpecialCodes.push(miniCogInfo.code);
    ppSpecialCodes.push(kneeInfo.code);
    ppSpecialCodes.push(incontinenceInfo.code);
    ppSpecialCodes.push(fallInfo.code);
    ppSpecialCodes.push(...sleepInfo.codes);
    ppSpecialCodes.push(mnaInfo.code);
    ppSpecialCodes.push(adlInfo.code);
  }

  const uniqueCodes = Array.from(new Set(ppSpecialCodes.filter(Boolean)));

  const risks = [];
  if (bmiInfo.level === 'abnormal' || bmiInfo.level === 'danger') risks.push(`BMI ${bmi} (${bmiInfo.label})`);
  if (targets.s2_blood_pressure && (bpInfo.level === 'abnormal' || bpInfo.level === 'danger')) {
    risks.push(`ความดัน ${bpInfo.activeSbp}/${bpInfo.activeDbp} (${bpInfo.label})`);
  }
  if (targets.s3_diabetes && (sugarInfo.level === 'risk' || sugarInfo.level === 'danger')) {
    risks.push(`น้ำตาล ${sugarInfo.dtx} mg/dL (${sugarInfo.label})`);
  }
  if (formData?.s4?.hbvResult === 'positive') risks.push('ไวรัสตับอักเสบ B ผลบวก');
  if (formData?.s4?.hbcResult === 'positive') risks.push('ไวรัสตับอักเสบ C ผลบวก');
  if (formData?.s5?.result === 'abnormal') risks.push('ตรวจเต้านมพบความผิดปกติ');
  if (smokingInfo.level !== 'normal') risks.push('สูบบุหรี่');
  if (alcoholInfo.level === 'abnormal' || alcoholInfo.level === 'danger') risks.push(alcoholInfo.label);
  if (tbInfo.suspect) risks.push(tbInfo.label);
  if (dep2qInfo.positive) risks.push('เสี่ยงซึมเศร้า (2Q ผิดปกติ)');
  if (profile.age >= 60) {
    if (hearingInfo.level !== 'normal') risks.push(hearingInfo.label);
    if (visionInfo.hasProblem) risks.push(visionInfo.label);
    if (miniCogInfo.abnormal) risks.push(miniCogInfo.label);
    if (kneeInfo.abnormal) risks.push(kneeInfo.label);
    if (incontinenceInfo.abnormal) risks.push(incontinenceInfo.label);
    if (fallInfo.risk) risks.push(fallInfo.label);
    if (mnaInfo.level !== 'normal') risks.push(mnaInfo.label);
    if (adlInfo.group !== 'ติดสังคม') risks.push(adlInfo.label);
  }

  return {
    profile,
    targets,
    bmi,
    bmiInfo,
    bpInfo,
    sugarInfo,
    smokingInfo,
    alcoholInfo,
    tbInfo,
    dep2qInfo,
    oralInfo,
    hearingInfo,
    visionInfo,
    miniCogInfo,
    kneeInfo,
    incontinenceInfo,
    fallInfo,
    sleepInfo,
    mnaInfo,
    adlInfo,
    ppSpecialCodes: uniqueCodes,
    risks,
    overallStatus: risks.length === 0 ? 'ปกติ' : `พบความเสี่ยง ${risks.length} รายการ`,
  };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatThaiDateLabel(dateStr) {
  const s = String(dateStr || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s || '-';
  const [y, m, d] = s.split('-').map(Number);
  const months = [
    '',
    'มกราคม',
    'กุมภาพันธ์',
    'มีนาคม',
    'เมษายน',
    'พฤษภาคม',
    'มิถุนายน',
    'กรกฎาคม',
    'สิงหาคม',
    'กันยายน',
    'ตุลาคม',
    'พฤศจิกายน',
    'ธันวาคม',
  ];
  return `${d} ${months[m] || m} พ.ศ. ${y + 543}`;
}

function markBox(checked, label) {
  return `<span class="chk">${checked ? '☑' : '☐'} ${escapeHtml(label)}</span>`;
}

export function buildScreening2570PrintHtml(formData = {}, person = {}, evaluation = null) {
  const ev = evaluation || evaluateFullScreening2570(formData, person);
  const pc = formData.personalChronic || {};
  const fc = formData.familyChronic || {};
  const sym = formData.pastSymptoms || {};
  const s1 = formData.s1 || {};
  const s2 = formData.s2 || {};
  const s3 = formData.s3 || {};
  const s4 = formData.s4 || {};
  const s5 = formData.s5 || {};
  const s6 = formData.s6 || {};
  const s7 = formData.s7 || {};
  const s8 = formData.s8 || {};
  const s9 = formData.s9 || {};
  const s10 = formData.s10 || {};
  const s11 = formData.s11 || {};
  const s12 = formData.s12 || {};
  const s13 = formData.s13 || {};
  const s14 = formData.s14 || {};
  const s15 = formData.s15 || {};
  const s16 = formData.s16 || {};
  const s17 = formData.s17 || {};
  const s18 = formData.s18 || {};
  const s19 = formData.s19 || {};
  const s20 = formData.s20 || {};
  const s21 = formData.s21 || {};
  const s22 = formData.s22 || {};
  const consent = formData.consent || {};

  const fullName = person.fullname || person.name || `${person.title || ''}${person.fname || ''} ${person.lname || ''}`.trim() || '-';
  const houseNo = person.house || '-';
  const mooNo = person.moo || '-';
  const ageVal = ev.profile?.age ?? person.age ?? '-';
  const screenDateLabel = formatThaiDateLabel(formData.screenDate);

  const safeSigUrl = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(
    String(consent.patientSignatureDataUrl || '')
  )
    ? consent.patientSignatureDataUrl
    : '';

  const exerciseLabels = {
    daily_30m: 'ทุกวัน 30 นาที/ครั้ง',
    gt_3_per_week: 'มากกว่า 3 ครั้ง/สัปดาห์',
    '3_per_week': 'สัปดาห์ละ 3 ครั้ง',
    lt_3_per_week: 'น้อยกว่า 3 ครั้ง/สัปดาห์',
    none: 'ไม่ออกกำลังกายเลย',
  };

  const visionLabelMap = {
    normal: 'ปกติ / ไม่มีปัญหา',
    problem: 'มีปัญหา',
    refer: 'ส่งต่อ',
  };

  const renderRow = (no, title, targetText, bodyHtml, codeText = '') => `
    <tr>
      <td class="c-no">${no}</td>
      <td class="c-title">
        <div class="t-main">${escapeHtml(title)}</div>
        ${targetText ? `<div class="t-sub">${escapeHtml(targetText)}</div>` : ''}
      </td>
      <td class="c-body">${bodyHtml}</td>
      <td class="c-code">${codeText ? `<span class="code-pill">${escapeHtml(codeText)}</span>` : '-'}</td>
    </tr>`;

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="utf-8" />
<title>แบบฟอร์มคัดกรองภาวะสุขภาพประจำปีงบประมาณ 2570 — ${escapeHtml(fullName)}</title>
<style>
  @page { size: A4 portrait; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: "TH SarabunPSK", "Sarabun", "Tahoma", sans-serif; color: #111827; font-size: 13px; line-height: 1.45; margin: 0; }
  .toolbar { position: sticky; top: 0; background: #1e293b; color: #fff; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; gap: 12px; z-index: 10; }
  .toolbar button { background: #16a34a; color: #fff; border: 0; padding: 8px 18px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 14px; }
  .sheet { max-width: 900px; margin: 14px auto; padding: 8px 12px; background: #fff; }
  h1 { font-size: 17px; text-align: center; margin: 0 0 2px 0; font-weight: 700; }
  h2 { font-size: 14px; text-align: center; margin: 0 0 10px 0; font-weight: 600; color: #374151; }
  .box { border: 1px solid #9ca3af; border-radius: 6px; padding: 8px 10px; margin-bottom: 8px; }
  .box-title { font-weight: 700; background: #f3f4f6; padding: 4px 8px; margin: -8px -10px 8px -10px; border-bottom: 1px solid #d1d5db; border-radius: 5px 5px 0 0; }
  .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px 10px; }
  .chk { display: inline-block; margin-right: 10px; white-space: nowrap; }
  .sym-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px 8px; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 12.5px; }
  th, td { border: 1px solid #9ca3af; padding: 5px 7px; vertical-align: top; }
  th { background: #f3f4f6; text-align: left; font-weight: 700; }
  .c-no { width: 32px; text-align: center; font-weight: 700; }
  .c-title { width: 220px; }
  .c-code { width: 115px; text-align: center; }
  .t-main { font-weight: 700; }
  .t-sub { font-size: 11px; color: #4b5563; }
  .code-pill { display: inline-block; background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; border-radius: 4px; padding: 1px 5px; font-weight: 700; font-size: 11px; }
  .res-bad { color: #b91c1c; font-weight: 700; }
  .res-ok { color: #15803d; font-weight: 700; }
  .sig-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 14px; text-align: center; }
  .sig-img { max-height: 64px; max-width: 220px; border-bottom: 1px dashed #6b7280; margin: 4px auto; display: block; }
  @media print {
    .toolbar { display: none !important; }
    .sheet { margin: 0; padding: 0; max-width: none; }
    tr { break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="toolbar">
    <span>แบบฟอร์มคัดกรองภาวะสุขภาพประจำปีงบประมาณ 2570 — ${escapeHtml(fullName)}</span>
    <button onclick="window.print()">🖨️ สั่งพิมพ์ / บันทึก PDF (A4)</button>
  </div>
  <div class="sheet">
    <h1>แบบฟอร์มสำหรับคัดกรองภาวะสุขภาพประจำปีงบประมาณ 2570 รพ.สต.บ้านโนนสว่าง ตำบลเหนือเมือง อำเภอเมืองร้อยเอ็ด</h1>
    <h2>การคัดกรองและประเมินภาวะสุขภาพ • สถานะภาพรวม: ${escapeHtml(ev.overallStatus)} ${ev.ppSpecialCodes.length ? `• รหัส PP Special: ${escapeHtml(ev.ppSpecialCodes.join(', '))}` : ''}</h2>

    <div class="box">
      <div class="box-title">ข้อมูลทั่วไป</div>
      <div class="info-grid">
        <div><strong>ชื่อ-สกุล:</strong> ${escapeHtml(fullName)}</div>
        <div><strong>อายุ:</strong> ${escapeHtml(ageVal)} ปี (พ.ศ.เกิด ${escapeHtml(ev.profile?.birthYearBE || '-')})</div>
        <div><strong>วันที่ตรวจ:</strong> ${escapeHtml(screenDateLabel)}</div>
        <div><strong>ที่อยู่:</strong> บ้านเลขที่ ${escapeHtml(houseNo)} หมู่ที่ ${escapeHtml(mooNo)} ต.เหนือเมือง</div>
        <div><strong>เบอร์โทร:</strong> ${escapeHtml(formData.phone || '-')}</div>
        <div><strong>เลขบัตรประชาชน:</strong> ${escapeHtml(person.cid || '-')}</div>
      </div>
    </div>

    <div class="box">
      <div class="box-title">ประวัติโรคประจำตัว & ประวัติบุคคลในครอบครัว</div>
      <div><strong>ประวัติโรคประจำตัว:</strong>
        ${markBox(pc.dm, 'โรคเบาหวาน')}
        ${markBox(pc.ht, 'โรคความดันโลหิตสูง')}
        ${markBox(pc.cad, 'โรคหลอดเลือดหัวใจ')}
        ${markBox(pc.copd, 'โรคถุงลมโป่งพอง/หอบหืด')}
        ${pc.other ? `<span>อื่นๆ: ${escapeHtml(pc.other)}</span>` : ''}
      </div>
      <div style="margin-top:4px;"><strong>ประวัติบุคคลในครอบครัว:</strong>
        ${markBox(fc.dm, 'โรคเบาหวาน')}
        ${markBox(fc.ht, 'โรคความดันโลหิตสูง')}
        ${markBox(fc.cad, 'โรคหลอดเลือดหัวใจ')}
        ${markBox(fc.copd, 'โรคถุงลมโป่งพอง/หอบหืด')}
        ${fc.other ? `<span>อื่นๆ: ${escapeHtml(fc.other)}</span>` : ''}
      </div>
    </div>

    <div class="box">
      <div class="box-title">อาการที่เคยมีประวัติ (12 ข้อ)</div>
      <div class="sym-grid">
        ${SYMPTOM_HISTORY_12.map((item) => `<div>${markBox(Boolean(sym[item.id]), `${item.no}. ${item.label}`)}</div>`).join('')}
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th class="c-no">ข้อ</th>
          <th class="c-title">หมวดคัดกรอง / กลุ่มเป้าหมาย</th>
          <th>รายละเอียดและผลการประเมิน</th>
          <th class="c-code">รหัส PP Special</th>
        </tr>
      </thead>
      <tbody>
        ${renderRow(
          1,
          'น้ำหนัก / ส่วนสูง / รอบเอว / BMI',
          'ทุกคน',
          `น้ำหนัก: <strong>${escapeHtml(s1.weightKg || '-')}</strong> กก. | ส่วนสูง: <strong>${escapeHtml(s1.heightCm || '-')}</strong> ซม. | รอบเอว: <strong>${escapeHtml(s1.waistCm || '-')}</strong> ซม. | BMI: <strong>${escapeHtml(ev.bmi ?? '-')}</strong> (${escapeHtml(ev.bmiInfo.label)})`,
          ''
        )}
        ${renderRow(
          2,
          'ความดันโลหิต',
          'เฉพาะอายุ 35 ปีขึ้นไป',
          `ครั้งที่ 1: <strong>${escapeHtml(s2.sbp1 || '-')}/${escapeHtml(s2.dbp1 || '-')}</strong> mmHg | ครั้งที่ 2: <strong>${escapeHtml(s2.sbp2 || '-')}/${escapeHtml(s2.dbp2 || '-')}</strong> mmHg<br/>แปลผล: <span class="${ev.bpInfo.level === 'normal' ? 'res-ok' : 'res-bad'}">${escapeHtml(ev.bpInfo.label)}</span>`,
          ''
        )}
        ${renderRow(
          3,
          'เบาหวาน / น้ำตาลในเลือด',
          'เฉพาะอายุ 35 ปีขึ้นไป',
          `${s3.fastingType === 'postprandial' ? 'หลังอาหาร' : 'ก่อนอาหาร (งดอาหาร 6–8 ชม.)'} | ผลที่เจาะ: <strong>${escapeHtml(s3.dtxMgDl || '-')}</strong> mg/dL<br/>แปลผล: <span class="${ev.sugarInfo.level === 'normal' ? 'res-ok' : 'res-bad'}">${escapeHtml(ev.sugarInfo.label)}</span>`,
          ''
        )}
        ${renderRow(
          4,
          'ไวรัสตับอักเสบ B และ C (1 ครั้งในชีวิต)',
          'เกิดก่อน พ.ศ. 2535',
          `HBV: <strong>${s4.hbvResult === 'positive' ? 'ผลบวก' : s4.hbvResult === 'negative' ? 'ผลลบ' : 'ยังไม่ตรวจ'}</strong> | HBC: <strong>${s4.hbcResult === 'positive' ? 'ผลบวก' : s4.hbcResult === 'negative' ? 'ผลลบ' : 'ยังไม่ตรวจ'}</strong>`,
          ''
        )}
        ${renderRow(
          5,
          'คัดกรองมะเร็งเต้านมด้วยตนเอง',
          'สตรีอายุ 30–70 ปี',
          `ผล: <strong>${s5.result === 'abnormal' ? 'ผิดปกติ' : s5.result === 'normal' ? 'ปกติ' : 'ยังไม่ระบุ'}</strong>${s5.abnormalDetail ? ` (อาการ: ${escapeHtml(s5.abnormalDetail)})` : ''}`,
          ''
        )}
        ${renderRow(
          6,
          'คัดกรองมะเร็งปากมดลูก (ทุก 5 ปี)',
          'สตรีอายุ 30–59 ปี',
          `${s6.everScreened === 'ever' ? `เคยตรวจ (ปี พ.ศ. ${escapeHtml(s6.screenedYearBE || '-')})` : s6.everScreened === 'never' ? 'ไม่เคยตรวจ' : 'ยังไม่ระบุ'}`,
          ''
        )}
        ${renderRow(
          7,
          'คัดกรองมะเร็งลำไส้ (ทุก 1–2 ปี)',
          'อายุ 50–70 ปี',
          `${s7.everScreened === 'ever' ? `เคยตรวจ (ปี พ.ศ. ${escapeHtml(s7.screenedYearBE || '-')})` : s7.everScreened === 'never' ? 'ไม่เคยตรวจ' : 'ยังไม่ระบุ'}`,
          ''
        )}
        ${renderRow(
          8,
          'คัดกรองบุหรี่',
          'อายุ 15 ปีขึ้นไป',
          `สถานะ: <strong>${escapeHtml(ev.smokingInfo.label)}</strong>${s8.status === 'current' ? ` | จำนวน/วัน: ${escapeHtml(s8.cigsPerDay || '-')} | มวนแรกหลังตื่น: ${escapeHtml(s8.firstCigWait || '-')} | การดูแล: ${escapeHtml(s8.staffCare || '-')}` : ''}`,
          ev.targets.s8_smoking ? ev.smokingInfo.codes.join(', ') : ''
        )}
        ${renderRow(
          9,
          'คัดกรองสุรา (ASSIST)',
          'อายุ 15 ปีขึ้นไป',
          `ผลประเมิน: <strong>${escapeHtml(ev.alcoholInfo.label)}</strong> (คะแนนรวม ${ev.alcoholInfo.score})`,
          ev.targets.s9_alcohol ? ev.alcoholInfo.codes.join(', ') : ''
        )}
        ${renderRow(
          10,
          'การออกกำลังกาย',
          'อายุ 15 ปีขึ้นไป',
          `ความถี่: <strong>${escapeHtml(exerciseLabels[s10.frequency] || '-')}</strong>`,
          ''
        )}
        ${renderRow(
          11,
          'คัดกรองวัณโรค',
          'ทุกคน',
          `สัมผัสผู้ป่วยในครอบครัว: ${s11.hasFamilyTb ? `มี (${escapeHtml(s11.familyTbDetail || '-')})` : 'ไม่มี'} | ผู้ดูแลผู้ป่วย: ${s11.isTbCaregiver ? `ใช่ (${escapeHtml(s11.tbCaregiverDetail || '-')})` : 'ไม่ใช่'} | เคยป่วยวัณโรค: ${s11.everHadTb === 'ever' ? `เคย (เมื่อ ${escapeHtml(s11.tbYear || '-')} รักษาที่ ${escapeHtml(s11.tbHospital || '-')})` : 'ไม่เคย'}<br/>สรุปอาการสงสัย 6 ข้อ: <strong>${escapeHtml(ev.tbInfo.label)}</strong>`,
          ''
        )}
        ${renderRow(
          12,
          'คัดกรองโรคซึมเศร้า (2Q)',
          'อายุ 15 ปีขึ้นไป',
          `หดหู่เศร้าท้อแท้: ${s12.q1_sad ? 'มี' : 'ไม่มี'} | เบื่อไม่เพลิดเพลิน: ${s12.q2_bored ? 'มี' : 'ไม่มี'}<br/>แปลผล: <span class="${ev.dep2qInfo.positive ? 'res-bad' : 'res-ok'}">${escapeHtml(ev.dep2qInfo.label)}</span>`,
          ev.targets.s12_depression_2q ? ev.dep2qInfo.code : ''
        )}
        ${renderRow(
          13,
          'สุขภาพช่องปาก',
          'เฉพาะอายุ 60 ปีขึ้นไป',
          ev.profile.age < 60 && !formData.showAll22 ? '<span class="t-sub">อายุน้อยกว่า 60 ปี (ไม่อยู่ในเกณฑ์ผู้สูงอายุ)</span>' : `ฟันแท้: <strong>${escapeHtml(s13.naturalTeethCount || '-')}</strong> ซี่ | ฟัน<20ซี่/4คู่สบ: ${s13.lessThan20Teeth ? 'มี' : 'ไม่มี'} | ผุ: ${s13.hasDecay ? 'มี' : 'ไม่มี'} | เหงือกบวม/ฝี/โยก: ${s13.hasGumAbscessLoose ? 'มี' : 'ไม่มี'} | ฟันปลอม: ${s13.hasDenture ? 'มี' : 'ไม่มี'} | แผลเรื้อรัง>2สัปดาห์: ${s13.hasOralUlcerOver2W ? 'มี' : 'ไม่มี'} | ปากแห้ง: ${s13.hasDryMouth ? 'มี' : 'ไม่มี'} | ความสะอาด: <strong>${s13.cleanliness === 'unclean' ? 'ไม่สะอาด' : 'สะอาด'}</strong>`,
          ev.profile.age >= 60 ? ev.oralInfo.code : ''
        )}
        ${renderRow(
          14,
          'การได้ยิน (ถูนิ้วห่างหู 1 นิ้ว)',
          'เฉพาะอายุ 60 ปีขึ้นไป',
          ev.profile.age < 60 ? '<span class="t-sub">อายุน้อยกว่า 60 ปี</span>' : `หูซ้าย: ${s14.leftEar === 'not_hear' ? 'ไม่ได้ยิน' : 'ได้ยิน'} | หูขวา: ${s14.rightEar === 'not_hear' ? 'ไม่ได้ยิน' : 'ได้ยิน'}<br/>สรุป: <strong>${escapeHtml(ev.hearingInfo.label)}</strong>`,
          ev.profile.age >= 60 ? ev.hearingInfo.code : ''
        )}
        ${renderRow(
          15,
          'สุขภาพทางตา (5 ข้อ)',
          'เฉพาะอายุ 60 ปีขึ้นไป',
          ev.profile.age < 60 ? '<span class="t-sub">อายุน้อยกว่า 60 ปี</span>' : `1) ระยะใกล้ 1 ฟุต: <strong>${escapeHtml(visionLabelMap[s15.nearVision] || 'ปกติ')}</strong> | 2) ระยะไกล 3 เมตร: <strong>${escapeHtml(visionLabelMap[s15.farVision] || 'ปกติ')}</strong><br/>3) ต้อกระจก: <strong>${escapeHtml(visionLabelMap[s15.cataract] || 'ปกติ')}</strong>${s15.cataractEye ? ` (${escapeHtml(s15.cataractEye)})` : ''} | 4) ต้อหิน: <strong>${escapeHtml(visionLabelMap[s15.glaucoma] || 'ปกติ')}</strong>${s15.glaucomaEye ? ` (${escapeHtml(s15.glaucomaEye)})` : ''} | 5) จอตาเสื่อม: <strong>${escapeHtml(visionLabelMap[s15.amd] || 'ปกติ')}</strong>${s15.amdEye ? ` (${escapeHtml(s15.amdEye)})` : ''}`,
          ev.profile.age >= 60 ? ev.visionInfo.codes.join(', ') : ''
        )}
        ${renderRow(
          16,
          'การทดสอบสภาพสมอง Mini-Cog',
          'เฉพาะอายุ 60 ปีขึ้นไป',
          ev.profile.age < 60 ? '<span class="t-sub">อายุน้อยกว่า 60 ปี</span>' : `วาดนาฬิกา 11.10 น.: <strong>${ev.miniCogInfo.clock}/2</strong> | จำคำ 3 คำ (หลานสาว, สวรรค์, ภูเขา): <strong>${ev.miniCogInfo.recall}/3</strong> | รวม: <strong>${ev.miniCogInfo.total}/5</strong> (${escapeHtml(ev.miniCogInfo.label)})`,
          ev.profile.age >= 60 ? ev.miniCogInfo.code : ''
        )}
        ${renderRow(
          17,
          'คัดกรองโรคข้อเข่าเสื่อม',
          'เฉพาะอายุ 60 ปีขึ้นไป',
          ev.profile.age < 60 ? '<span class="t-sub">อายุน้อยกว่า 60 ปี</span>' : `${s17.hasKneePain ? `ปวดเข่า (พบ ${ev.kneeInfo.yesCount}/5 อาการ)` : 'ไม่ปวดเข่า'} | สรุป: <strong>${escapeHtml(ev.kneeInfo.label)}</strong>`,
          ev.profile.age >= 60 ? ev.kneeInfo.code : ''
        )}
        ${renderRow(
          18,
          'คัดกรองภาวะกลั้นปัสสาวะ',
          'เฉพาะอายุ 60 ปีขึ้นไป',
          ev.profile.age < 60 ? '<span class="t-sub">อายุน้อยกว่า 60 ปี</span>' : `${s18.hasIncontinence ? 'มีปัสสาวะเล็ด/ราดจนเกิดปัญหา' : 'ไม่มีปัญหา'} (${escapeHtml(ev.incontinenceInfo.label)})`,
          ev.profile.age >= 60 ? ev.incontinenceInfo.code : ''
        )}
        ${renderRow(
          19,
          'คัดกรองภาวะหกล้ม (TUGT)',
          'เฉพาะอายุ 60 ปีขึ้นไป',
          ev.profile.age < 60 ? '<span class="t-sub">อายุน้อยกว่า 60 ปี</span>' : `หกล้มใน 6 เดือน: ${s19.fellLast6Months ? 'เคยหกล้ม' : 'ไม่เคยหกล้ม'} | เวลาเดิน 3 เมตรไป-กลับ: <strong>${escapeHtml(s19.walkMinutes ?? 0)} นาที ${escapeHtml(s19.walkSeconds ?? 0)} วินาที</strong> (${ev.fallInfo.totalSeconds} วินาที)<br/>สรุป: <strong>${escapeHtml(ev.fallInfo.label)}</strong>`,
          ev.profile.age >= 60 ? ev.fallInfo.code : ''
        )}
        ${renderRow(
          20,
          'ปัญหาการนอน',
          'เฉพาะอายุ 60 ปีขึ้นไป',
          ev.profile.age < 60 ? '<span class="t-sub">อายุน้อยกว่า 60 ปี</span>' : `ปัญหาการนอนหลับ: ${s20.hasSleepProblem ? `มี (${[s20.problems?.insomnia && 'นอนไม่หลับ', s20.problems?.oversleep && 'นอนมากไป', s20.problems?.snoring && 'นอนกรน', s20.problems?.sleepwalking && 'นอนละเมอ', s20.problems?.other].filter(Boolean).join(', ') || 'ระบุ'} • เป็นมา ${escapeHtml(s20.durationYears || '-')} ปี • เฉลี่ย ${escapeHtml(s20.avgHoursPerNight || '-')} ชม./คืน)` : 'ไม่มี'} | ง่วง/อ่อนเพลียกลางวัน: ${s20.daytimeFatigue ? 'มี' : 'ไม่มี'}`,
          ev.profile.age >= 60 && ev.sleepInfo.codes.length ? ev.sleepInfo.codes.join(', ') : '-'
        )}
        ${renderRow(
          21,
          'ภาวะขาดสารอาหาร (MNA)',
          'เฉพาะอายุ 60 ปีขึ้นไป',
          ev.profile.age < 60 ? '<span class="t-sub">อายุน้อยกว่า 60 ปี</span>' : `1.ทานลด: ${s21.mna1 ?? 2} | 2.นน.ลด: ${s21.mna2 ?? 3} | 3.เคลื่อนไหว: ${s21.mna3 ?? 2} | 4.เครียด/ป่วย: ${s21.mna4 ?? 2} | 5.จิต/ความจำ: ${s21.mna5 ?? 2} | 6.BMI: ${ev.mnaInfo.mna6} | 7.รอบน่อง (${escapeHtml(s21.calfCm || '-')} ซม.): ${ev.mnaInfo.mna7}<br/>รวม: <strong>${ev.mnaInfo.total}/14 คะแนน — ${escapeHtml(ev.mnaInfo.label)}</strong>`,
          ev.profile.age >= 60 ? ev.mnaInfo.code : ''
        )}
        ${renderRow(
          22,
          'การประเมินกิจวัตรประจำวัน (ADL)',
          'เฉพาะอายุ 60 ปีขึ้นไป',
          ev.profile.age < 60 ? '<span class="t-sub">อายุน้อยกว่า 60 ปี</span>' : `1.กิน(${s22.adl1 ?? 0}) 2.ล้างหน้า(${s22.adl2 ?? 0}) 3.ลุกนั่ง(${s22.adl3 ?? 0}) 4.ห้องน้ำ(${s22.adl4 ?? 0}) 5.เคลื่อนที่(${s22.adl5 ?? 0}) 6.แต่งตัว(${s22.adl6 ?? 0}) 7.บันได(${s22.adl7 ?? 0}) 8.อาบน้ำ(${s22.adl8 ?? 0}) 9.อุจจาระ(${s22.adl9 ?? 0}) 10.ปัสสาวะ(${s22.adl10 ?? 0})<br/>รวม: <strong>${ev.adlInfo.total}/20 คะแนน — ${escapeHtml(ev.adlInfo.label)}</strong>`,
          ev.profile.age >= 60 ? ev.adlInfo.code : ''
        )}
      </tbody>
    </table>

    <div class="box" style="margin-top:8px;">
      <div style="font-size:12px;">
        ${markBox(Boolean(consent.accepted), 'ทั้งนี้ขอรับรองว่าผู้มารับบริการ ได้เข้ามารับการตรวจคัดกรองภาวะสุขภาพประจำปี ในเขตรับผิดชอบโรงพยาบาลส่งเสริมสุขภาพตำบลบ้านโนนสว่าง ตำบลเหนือเมือง อำเภอเมือง จังหวัดร้อยเอ็ด ในวันและเวลาดังกล่าวจริง และขออนุญาตนำข้อมูลที่ได้ตรวจคัดกรองสุขภาพประจำปี นำมาบันทึกข้อมูลในระบบหมอพร้อมและระบบของ รพ.สต.บ้านโนนสว่าง')}
      </div>
      <div class="sig-row">
        <div>
          <div style="margin-top:26px;">ลงชื่อ (จนท.) ..................................................................</div>
          <div>(${escapeHtml(consent.staffName || '......................................................')})</div>
          <div>ตำแหน่ง ${escapeHtml(consent.staffPosition || '......................................................')}</div>
        </div>
        <div>
          ${safeSigUrl ? `<img class="sig-img" src="${safeSigUrl}" alt="ลายเซ็นผู้มารับบริการ" />` : '<div style="margin-top:26px;">ลงนาม (ผู้มารับบริการ) ..................................................</div>'}
          <div>(${escapeHtml(fullName)})</div>
          <div>วันที่ ${escapeHtml(screenDateLabel)}</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

