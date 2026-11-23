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
      pulse1: '',
      sbp2: '',
      dbp2: '',
      pulse2: '',
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
      clockDrawingDataUrl: '',
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
  const hasOverride =
    s21.mna6Override !== null && s21.mna6Override !== undefined && s21.mna6Override !== '';
  const hasBmi = Number.isFinite(bmi) && bmi > 0;
  const bmiClass = classifyBmi(bmi);
  const mna6 = hasOverride ? Number(s21.mna6Override) : bmiClass.mnaScore;

  const calfVal = Number(s21.calfCm);
  const mna7 = Number.isFinite(calfVal) && calfVal > 0 ? (calfVal >= 31 ? 3 : 0) : Number(s21.mna7 ?? 3);

  // มาตรฐาน MNA-SF (คะแนนเต็ม 14): ใช้ข้อ 6 (BMI) เป็นหลัก หากไม่มีค่า BMI จึงใช้ข้อ 7 (เส้นรอบวงน่อง) แทน
  const useBmi = hasOverride || hasBmi;
  const total =
    Number(s21.mna1 ?? 2) +
    Number(s21.mna2 ?? 3) +
    Number(s21.mna3 ?? 2) +
    Number(s21.mna4 ?? 2) +
    Number(s21.mna5 ?? 2) +
    (useBmi ? mna6 : mna7);

  if (total >= 12) {
    return {
      total,
      mna6,
      mna7,
      usedField: useBmi ? 'bmi' : 'calf',
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
      usedField: useBmi ? 'bmi' : 'calf',
      code: '1K11',
      label: `เสี่ยงต่อภาวะขาดสารอาหาร (${total}/14 คะแนน — 1K11)`,
      level: 'warning',
    };
  }
  return {
    total,
    mna6,
    mna7,
    usedField: useBmi ? 'bmi' : 'calf',
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s || '';
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
  return `${d} ${months[m] || m} ${y + 543}`;
}

function chkBox(checked, label = '', cls = '') {
  return `<span class="chk-wrap ${cls}"><span class="sq">${checked ? '<span class="tick">✓</span>' : ''}</span>${label ? `<span class="chk-lbl">${escapeHtml(label)}</span>` : ''}</span>`;
}

function chkBoxRaw(checked, innerHtml = '', cls = '') {
  return `<span class="chk-wrap ${cls}"><span class="sq">${checked ? '<span class="tick">✓</span>' : ''}</span>${innerHtml ? `<span class="chk-lbl">${innerHtml}</span>` : ''}</span>`;
}

function parenChk(checked, label) {
  return `<span class="pchk">(&nbsp;<span class="pchk-in">${checked ? '<span class="tick">✓</span>' : '&nbsp;'}</span>&nbsp;)&nbsp;<b>${escapeHtml(label)}</b></span>`;
}

function numBox(num, checked, label = '') {
  return `<span class="num-wrap"><span class="nbox ${checked ? 'is-on' : ''}">${num}${checked ? '<span class="ntick">✓</span>' : ''}</span>${label ? `<span class="num-lbl">${escapeHtml(label)}</span>` : ''}</span>`;
}

function dotVal(val, minW = 70, align = 'center') {
  const str = String(val ?? '').trim();
  return `<span class="dot" style="min-width:${minW}px;text-align:${align};">${str ? `<span class="filled">${escapeHtml(str)}</span>` : '&nbsp;'}</span>`;
}

function circleScore(text, selected) {
  return `<span class="cscore ${selected ? 'is-on' : ''}">(${text})</span>`;
}

export function buildScreening2570PrintHtml(formData = {}, person = {}, evaluation = null) {
  const ev = evaluation || evaluateFullScreening2570(formData, person);
  const showAll22 = Boolean(formData.showAll22);
  const elderlyActive = ev.profile.age >= 60 || showAll22;
  const behaviorActive = ev.profile.age >= 15 || showAll22;
  const dmBpActive = ev.profile.age >= 35 || showAll22;

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

  const fullName =
    person.fullname ||
    person.name ||
    `${person.title || ''}${person.fname || ''} ${person.lname || ''}`.trim() ||
    '';
  const houseNo = person.house || '';
  const mooNo = person.moo || '';
  const ageVal = ev.profile?.age ?? person.age ?? '';
  const screenDateLabel = formatThaiDateLabel(formData.screenDate);

  const safeDataImageUrl = (raw) =>
    /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(String(raw || ''))
      ? raw
      : '';
  const safeSigUrl = safeDataImageUrl(consent.patientSignatureDataUrl);
  const safeClockUrl = safeDataImageUrl(s16.clockDrawingDataUrl);

  // Symptom 12 rows arranged 3 columns x 4 rows matching Page 1
  const symRowPairs = [
    [SYMPTOM_HISTORY_12[0], SYMPTOM_HISTORY_12[4], SYMPTOM_HISTORY_12[8]],
    [SYMPTOM_HISTORY_12[1], SYMPTOM_HISTORY_12[5], SYMPTOM_HISTORY_12[9]],
    [SYMPTOM_HISTORY_12[2], SYMPTOM_HISTORY_12[6], SYMPTOM_HISTORY_12[10]],
    [SYMPTOM_HISTORY_12[3], SYMPTOM_HISTORY_12[7], SYMPTOM_HISTORY_12[11]],
  ];

  // BP helpers
  const numOrNull = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 && String(v ?? '').trim() !== '' ? n : null;
  };
  const sbp1 = numOrNull(s2.sbp1);
  const dbp1 = numOrNull(s2.dbp1);
  const sbp2 = numOrNull(s2.sbp2);
  const dbp2 = numOrNull(s2.dbp2);

  const bpValIn = (val, min, max) => {
    if (val === null) return '';
    if (val >= min && val <= max) return `<span class="val-hit">${val}</span>`;
    return '';
  };

  // DTX helpers
  const dtxVal = numOrNull(s3.dtxMgDl);
  const dmFastChecked = (dmBpActive || dtxVal !== null) && s3.fastingType === 'fasting';
  const dmPostChecked = (dmBpActive || dtxVal !== null) && s3.fastingType === 'postprandial';

  // Behavior section helpers
  const smActive = behaviorActive;
  const smStatus = s8.status;
  const smCurrent = smActive && smStatus === 'current';
  const alcActive = behaviorActive;
  const alcCurrent = alcActive && s9.status === 'current';
  const alcQ2Flow = alcCurrent && s9.q2_1 !== 'never';
  const alcScore = ev.alcoholInfo.score;

  // TB helpers
  const tbHasAnyMark = Boolean(
    s11.hasFamilyTb ||
      s11.isTbCaregiver ||
      s11.everHadTb === 'ever' ||
      Object.values(s11.symptoms || {}).some(Boolean)
  );
  const tbCheckedYes = (id) => Boolean(s11.symptoms?.[id]);
  const tbCheckedNo = (id) => (tbHasAnyMark || showAll22 || formData.s1?.weightKg !== '' ? !s11.symptoms?.[id] : false);

  // Vision row helper (Items 1-5)
  const visRow = (noHtml, val, eyeVal, showEyeCol) => {
    const isNormal = elderlyActive && val === 'normal';
    const isAbnormal = elderlyActive && (val === 'problem' || val === 'refer');
    return `
      <tr>
        <td class="v-desc">${noHtml}</td>
        <td class="v-chk">${isNormal ? '<span class="tick">✓</span>' : ''}</td>
        <td class="v-chk">${isAbnormal ? '<span class="tick">✓</span>' : ''}</td>
        ${
          showEyeCol
            ? `<td class="v-eye">${chkBox(elderlyActive && isAbnormal && (eyeVal === 'ซ้าย' || eyeVal === 'ทั้งสองข้าง'), 'ซ้าย')} ${chkBox(elderlyActive && isAbnormal && (eyeVal === 'ขวา' || eyeVal === 'ทั้งสองข้าง'), 'ขวา')}</td>`
            : `<td class="v-eye gray-cell">&nbsp;</td>`
        }
      </tr>`;
  };

  const renderVisionInline = (noText, labelHtml, val, c0, c1, c2) => {
    const s0 = elderlyActive && val === 'normal';
    const s1v = elderlyActive && val === 'problem';
    const s2v = elderlyActive && val === 'refer';
    return `${noText} ${labelHtml} <span class="code-red">(${s0 ? '<u><b>' : ''}ปกติ ${c0}${s0 ? '</b></u>' : ''} , ${s1v ? '<u><b>' : ''}มีปัญหา${c1}${s1v ? '</b></u>' : ''} , ${s2v ? '<u><b>' : ''}ส่งต่อ ${c2}${s2v ? '</b></u>' : ''})</span>`;
  };

  const kneePain = elderlyActive && Boolean(s17.hasKneePain);
  const kneeNotPain = elderlyActive && !s17.hasKneePain;

  const sleepProb = elderlyActive && Boolean(s20.hasSleepProblem);
  const sleepNoProb = elderlyActive && !s20.hasSleepProblem;

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="utf-8" />
<title>แบบฟอร์มคัดกรองภาวะสุขภาพประจำปีงบประมาณ 2570 — ${escapeHtml(fullName || 'แบบฟอร์มว่าง')}</title>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet" />
<style>
  @page { size: A4 portrait; margin: 5mm 10mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  body {
    font-family: "Sarabun", "TH Sarabun New", "Tahoma", sans-serif;
    color: #000;
    background: #cbd5e1;
    margin: 0;
    font-size: 11.7px;
    line-height: 1.36;
  }
  .toolbar {
    position: sticky; top: 0; z-index: 50;
    background: #0f172a; color: #fff;
    padding: 8px 16px; display: flex; justify-content: space-between; align-items: center; gap: 10px;
    font-family: "Sarabun", sans-serif; font-size: 13px;
  }
  .toolbar button {
    background: #16a34a; color: #fff; border: 0; border-radius: 6px;
    padding: 6px 16px; font-weight: 700; cursor: pointer; font-size: 13px;
  }
  .pages { padding: 12px 0 24px; display: flex; flex-direction: column; align-items: center; gap: 14px; }
  .a4-page {
    width: 210mm;
    min-height: 297mm;
    padding: 5mm 10mm;
    background: #fff;
    box-shadow: 0 4px 16px rgba(0,0,0,.18);
  }
  .bold { font-weight: 700; }
  .sec-red { color: #c00000; font-weight: 700; text-decoration: underline; }
  .code-red { color: #c00000; font-weight: 700; }
  .filled { color: #0b3c8a; font-weight: 700; }
  .tick { color: #0b3c8a; font-weight: 700; font-size: 13px; line-height: 1; }
  .val-hit { color: #0b3c8a; font-weight: 700; font-size: 12.5px; }

  .chk-wrap { display: inline-flex; align-items: center; gap: 3px; margin-right: 6px; vertical-align: middle; }
  .sq {
    display: inline-flex; align-items: center; justify-content: center;
    width: 11px; height: 11px; border: 1px solid #000; background: #fff;
    flex-shrink: 0; line-height: 1;
  }
  .chk-lbl { vertical-align: middle; }
  .pchk { display: inline-block; margin-right: 10px; font-size: 11.5px; }
  .pchk-in { display: inline-block; min-width: 8px; text-align: center; }

  .num-wrap { display: inline-flex; align-items: center; gap: 4px; margin-right: 10px; }
  .nbox {
    display: inline-flex; align-items: center; justify-content: center;
    width: 13px; height: 13px; border: 1px solid #000; font-size: 10px; font-weight: 700;
    position: relative; background: #fff;
  }
  .nbox.is-on { border: 1.5px solid #0b3c8a; background: #dbeafe; color: #0b3c8a; }
  .ntick { position: absolute; right: -4px; top: -6px; font-size: 12px; color: #0b3c8a; font-weight: 700; }

  .dot {
    display: inline-block; border-bottom: 1px dotted #000; padding: 0 3px; line-height: 1.15;
  }
  .cscore {
    display: inline-block; padding: 0 4px; border-radius: 999px; font-size: 11px;
  }
  .cscore.is-on {
    border: 1.5px solid #0b3c8a; background: #dbeafe; color: #0b3c8a; font-weight: 700;
  }

  table.form-tbl {
    width: 100%; border-collapse: collapse; table-layout: fixed;
  }
  table.form-tbl th, table.form-tbl td {
    border: 1px solid #000; padding: 3.5px 6px; vertical-align: middle;
  }
  .head-title { text-align: center; font-weight: 700; font-size: 13px; padding: 4px 4px !important; }
  .sym-tbl th { text-align: center; font-weight: 700; font-size: 11px; background: #fff; padding: 3px 4px !important; }
  .sym-tbl td { font-size: 10.6px; padding: 2.5px 4px !important; }
  .sym-chk { text-align: center; width: 24px; }

  .bp-tbl { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 3px; font-size: 10.8px; }
  .bp-tbl th, .bp-tbl td { border: 1px solid #000; padding: 3.5px 3px; text-align: center; vertical-align: middle; }
  .bg-green { background: #92d050 !important; }
  .bg-yellow { background: #ffff99 !important; }
  .bg-orange { background: #f4b084 !important; }
  .bg-red { background: #ff5050 !important; }
  .bg-gray { background: #d9d9d9 !important; }
  .gray-cell { background: #d9d9d9 !important; }

  .sub-tbl { width: 100%; border-collapse: collapse; }
  .sub-tbl td, .sub-tbl th { border: 1px solid #000; padding: 3px 5px; }

  .v-tbl { width: 100%; border-collapse: collapse; font-size: 11.2px; }
  .v-tbl th, .v-tbl td { border: 1px solid #000; padding: 3.5px 5px; vertical-align: middle; }
  .v-chk { width: 40px; text-align: center; }
  .v-eye { width: 96px; text-align: center; }

  .oral-box { border: 1px solid #000; padding: 6px 8px; font-size: 11.4px; line-height: 1.42; }
  .oral-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .oral-opts { width: 145px; flex-shrink: 0; display: flex; justify-content: space-between; }

  .minicog-box { display: flex; justify-content: space-between; align-items: center; gap: 14px; padding: 6px 2px; }
  .clock-circle {
    width: 128px; height: 128px; border: 2px solid #000; border-radius: 50%;
    flex-shrink: 0; display: flex; align-items: center; justify-content: center;
    font-size: 10px; color: #64748b; margin-right: 16px;
    overflow: hidden; position: relative; background: #fff;
  }
  .clock-draw-img { width: 100%; height: 100%; object-fit: contain; display: block; }

  .mna-box { border: 1px solid #000; padding: 7px 9px; margin-bottom: 10px; font-size: 11.5px; line-height: 1.5; }
  .mna-item { margin: 4px 0; }

  .adl-tbl { width: 100%; border-collapse: collapse; font-size: 11.4px; }
  .adl-tbl th, .adl-tbl td { border: 1px solid #000; padding: 4px 6px; vertical-align: middle; }
  .adl-tbl th { text-align: center; font-weight: 700; }

  .consent-wrap { margin-top: 20px; font-size: 13px; line-height: 1.65; }
  .consent-text { text-indent: 32px; text-align: justify; margin-bottom: 34px; }
  .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .sig-block { line-height: 1.95; }
  .sig-line { position: relative; min-height: 40px; display: flex; align-items: flex-end; gap: 4px; }
  .sig-img { max-height: 48px; max-width: 170px; position: absolute; left: 95px; bottom: 2px; pointer-events: none; }

  @media print {
    body { background: #fff; }
    .toolbar { display: none !important; }
    .pages { padding: 0; gap: 0; display: block; }
    .a4-page {
      width: auto; min-height: auto; padding: 0; margin: 0; box-shadow: none;
      page-break-after: always; break-after: page;
    }
    .a4-page:last-child { page-break-after: auto; break-after: auto; }
  }
</style>
</head>
<body>
  <div class="toolbar">
    <span>แบบฟอร์มคัดกรองภาวะสุขภาพประจำปีงบประมาณ 2570 — ${escapeHtml(fullName || 'ไม่ระบุชื่อ')}</span>
    <button onclick="window.print()">🖨️ สั่งพิมพ์ / บันทึก PDF (4 หน้า A4 เหมือนต้นฉบับ)</button>
  </div>

  <div class="pages">
    <!-- ==================== หน้า 1 ==================== -->
    <div class="a4-page">
      <table class="form-tbl">
        <tr>
          <td colspan="9" class="head-title">แบบฟอร์มสำหรับคัดกรองภาวะสุขภาพประจำปีงบประมาณ 2570 รพ.สต.บ้านโนนสว่าง ตำบลเหนือเมือง อำเภอเมืองร้อยเอ็ด</td>
        </tr>
        <tr>
          <td colspan="9" class="head-title">การคัดกรองและประเมินภาวะสุขภาพ</td>
        </tr>
        <tr>
          <td colspan="9" style="padding:3px 6px;">
            <div>
              <span class="bold">ข้อมูลทั่วไป</span> ชื่อ-สกุล${dotVal(fullName, 175, 'left')}
              อายุ${dotVal(ageVal, 38)}ปี วันที่${dotVal(screenDateLabel, 130)}
            </div>
            <div style="margin-top:2px;">
              ที่อยู่เลขที่${dotVal(houseNo, 78)} หมู่ที่${dotVal(mooNo, 48)} ต.เหนือเมือง อำเภอเมืองร้อยเอ็ด เบอร์โทร${dotVal(formData.phone, 125)}
            </div>
          </td>
        </tr>
        <tr>
          <td colspan="9">
            <span class="bold">ประวัติโรคประจำตัว</span>&nbsp;&nbsp;
            ${chkBox(Boolean(pc.dm), 'โรคเบาหวาน')}
            ${chkBox(Boolean(pc.ht), 'โรคความดันโลหิตสูง')}
            ${chkBox(Boolean(pc.cad), 'โรคหลอดเลือดหัวใจ')}
            ${chkBox(Boolean(pc.copd), 'โรคถุงลมโป่งพอง/หอบหืด')}
            ${chkBoxRaw(Boolean(pc.other), `โรคอื่นๆ${dotVal(pc.other, 70, 'left')}`)}
          </td>
        </tr>
        <tr>
          <td colspan="9">
            <span class="bold">ประวัติบุคคลในครอบครัว</span>&nbsp;
            ${chkBox(Boolean(fc.dm), 'โรคเบาหวาน')}
            ${chkBox(Boolean(fc.ht), 'โรคความดันโลหิตสูง')}
            ${chkBox(Boolean(fc.cad), 'โรคหลอดเลือดหัวใจ')}
            ${chkBox(Boolean(fc.copd), 'โรคถุงลมโป่งพอง/หอบหืด')}
            ${chkBoxRaw(Boolean(fc.other), `โรคอื่นๆ${dotVal(fc.other, 65, 'left')}`)}
          </td>
        </tr>
      </table>

      <!-- ตารางอาการ 12 ข้อ -->
      <table class="form-tbl sym-tbl" style="margin-top:-1px;">
        <colgroup>
          <col style="width:27%;" /><col style="width:3.1%;" /><col style="width:3.2%;" />
          <col style="width:27%;" /><col style="width:3.1%;" /><col style="width:3.2%;" />
          <col style="width:27%;" /><col style="width:3.1%;" /><col style="width:3.2%;" />
        </colgroup>
        <tr>
          <th>อาการที่เคยมีประวัติ</th><th>มี</th><th>ไม่มี</th>
          <th>อาการที่เคยมีประวัติ</th><th>มี</th><th>ไม่มี</th>
          <th>อาการที่เคยมีประวัติ</th><th>มี</th><th>ไม่มี</th>
        </tr>
        ${symRowPairs
          .map(
            (row) => `
          <tr>
            ${row
              .map(
                (item) => `
              <td>${item.no}. ${escapeHtml(item.label)}</td>
              <td class="sym-chk">${sym[item.id] === true ? '<span class="tick">✓</span>' : ''}</td>
              <td class="sym-chk">${sym[item.id] === false ? '<span class="tick">✓</span>' : ''}</td>`
              )
              .join('')}
          </tr>`
          )
          .join('')}
      </table>

      <!-- หมวด 1 - หมวด 9 (ส่วนต้น) -->
      <div style="border:1px solid #000;border-top:0;padding:3px 6px;">
        <!-- หมวด 1 -->
        <div>
          <span class="sec-red">1. น้ำหนัก</span>${dotVal(s1.weightKg, 52)}กก.&nbsp;&nbsp;
          <span class="sec-red">ส่วนสูง</span>${dotVal(s1.heightCm, 52)}ซม.&nbsp;&nbsp;
          <span class="sec-red">รอบเอว</span>${dotVal(s1.waistCm, 52)}ซม.&nbsp;&nbsp;
          <span class="sec-red">BMI</span>${dotVal(ev.bmi ?? '', 65)}
        </div>

        <!-- หมวด 2 -->
        <div style="margin-top:2px;">
          <span class="sec-red">2. ความดันโลหิต</span> : วัด ครั้งที่ 1 ถ้า ตัวบน &gt; 140 หรือ ตัวล่าง &gt; 90 &nbsp;<span class="bold">วัดซ้ำครั้งที่ 2 &nbsp; (( ตรวจเฉพาะอายุ 35 ปี ขึ้นไป ))</span>
          <table class="bp-tbl">
            <colgroup>
              <col style="width:10.5%;" />
              <col style="width:9.5%;" /><col style="width:9.5%;" /><col style="width:10.5%;" /><col style="width:9.5%;" />
              <col style="width:9.5%;" /><col style="width:9.5%;" /><col style="width:10.5%;" /><col style="width:9.5%;" />
              <col style="width:11.5%;" />
            </colgroup>
            <tr>
              <th rowspan="2">ค่าความดัน</th>
              <th colspan="4">ตัวบน</th>
              <th colspan="4">ตัวล่าง</th>
              <th rowspan="2">ชีพจร</th>
            </tr>
            <tr>
              <th class="bg-green">50 – 129<br/>ปกติ</th>
              <th class="bg-yellow">130 – 139<br/>เสี่ยง</th>
              <th class="bg-orange">140 – 179<br/>สงสัยป่วย</th>
              <th class="bg-red">&gt;= 180<br/>ป่วย</th>
              <th class="bg-green">50 – 79<br/>ปกติ</th>
              <th class="bg-yellow">80 – 89<br/>เสี่ยง</th>
              <th class="bg-orange">90 – 109<br/>สงสัยป่วย</th>
              <th class="bg-red">&gt;= 110<br/>ป่วย</th>
            </tr>
            <tr>
              <td class="bold">ครั้งที่ 1</td>
              <td>${bpValIn(sbp1, 1, 129)}</td>
              <td>${bpValIn(sbp1, 130, 139)}</td>
              <td>${bpValIn(sbp1, 140, 179)}</td>
              <td>${bpValIn(sbp1, 180, 999)}</td>
              <td>${bpValIn(dbp1, 1, 79)}</td>
              <td>${bpValIn(dbp1, 80, 89)}</td>
              <td>${bpValIn(dbp1, 90, 109)}</td>
              <td>${bpValIn(dbp1, 110, 999)}</td>
              <td>${s2.pulse1 ? `<span class="val-hit">${escapeHtml(s2.pulse1)}</span>` : ''}</td>
            </tr>
            <tr>
              <td class="bold">ครั้งที่ 2</td>
              <td>${bpValIn(sbp2, 1, 129)}</td>
              <td>${bpValIn(sbp2, 130, 139)}</td>
              <td>${bpValIn(sbp2, 140, 179)}</td>
              <td>${bpValIn(sbp2, 180, 999)}</td>
              <td>${bpValIn(dbp2, 1, 79)}</td>
              <td>${bpValIn(dbp2, 80, 89)}</td>
              <td>${bpValIn(dbp2, 90, 109)}</td>
              <td>${bpValIn(dbp2, 110, 999)}</td>
              <td>${s2.pulse2 ? `<span class="val-hit">${escapeHtml(s2.pulse2)}</span>` : ''}</td>
            </tr>
          </table>
        </div>

        <!-- หมวด 3 -->
        <div style="margin-top:3px;">
          <span class="sec-red">3. เบาหวาน</span> : <span class="bold">(( ตรวจเฉพาะอายุ 35 ปี ขึ้นไป ))</span> (ควรเจาะตอนเช้า และ งดอาหาร 6-8 ชม ) &nbsp;&nbsp;
          ${chkBox(dmFastChecked, 'ก่อนอาหาร')}
          ${chkBox(dmPostChecked, 'หลังอาหาร')}
          <table class="bp-tbl">
            <colgroup>
              <col style="width:22%;" /><col style="width:26%;" /><col style="width:26%;" /><col style="width:26%;" />
            </colgroup>
            <tr>
              <th class="bold">ระดับน้ำตาลในเลือด</th>
              <th class="bg-green">70 - 99 ( ปกติ )</th>
              <th class="bg-orange">100 – 125 ( เสี่ยง )</th>
              <th class="bg-red">&gt;= 126 ( สงสัยป่วย )</th>
            </tr>
            <tr>
              <td class="bold">ผลที่เจาะ</td>
              <td>${dtxVal !== null && dtxVal <= 99 ? `<span class="val-hit">${dtxVal}</span>` : '&nbsp;'}</td>
              <td>${dtxVal !== null && dtxVal >= 100 && dtxVal <= 125 ? `<span class="val-hit">${dtxVal}</span>` : '&nbsp;'}</td>
              <td>${dtxVal !== null && dtxVal >= 126 ? `<span class="val-hit">${dtxVal}</span>` : '&nbsp;'}</td>
            </tr>
          </table>
        </div>

        <!-- หมวด 4 -->
        <div style="margin-top:3px;border-top:1px solid #000;padding-top:2px;">
          <div><span class="sec-red">4. คัดกรองไวรัสตับอักเสบบีซี 1 ครั้งในชีวิต</span> <span class="bold">(( ตรวจเฉพาะคนที่เกิดก่อน พ.ศ.2535 ที่ยังไม่เคยตรวจมาก่อนในชีวิต ))</span></div>
          <div style="padding-left:18px;margin-top:1px;">
            <span class="bold">HBV</span> &nbsp;&nbsp;
            ${chkBox(s4.hbvResult === 'positive', 'ผลบวก')} &nbsp;
            ${chkBox(s4.hbvResult === 'negative', 'ผลลบ')}
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            <span class="bold">HBC</span> &nbsp;&nbsp;
            ${chkBox(s4.hbcResult === 'positive', 'ผลบวก')} &nbsp;
            ${chkBox(s4.hbcResult === 'negative', 'ผลลบ')}
          </div>
        </div>

        <!-- หมวด 5 -->
        <div style="margin-top:2px;border-top:1px solid #000;padding-top:2px;">
          <div><span class="sec-red">5. คัดกรองมะเร็งเต้านมด้วยตนเอง</span> <span class="bold">(( ตรวจเฉพาะอายุ 30-70 ปี ))</span></div>
          <div style="padding-left:18px;margin-top:1px;">
            ${chkBox(s5.result === 'normal', 'ปกติ')} &nbsp;&nbsp;
            ${chkBox(s5.result === 'abnormal', 'ผิดปกติ')} &nbsp;
            อาการผิดปกติที่พบ${dotVal(s5.abnormalDetail, 260, 'left')}
          </div>
        </div>

        <!-- หมวด 6 -->
        <div style="margin-top:2px;border-top:1px solid #000;padding-top:2px;">
          <div><span class="sec-red">6. คัดกรองมะเร็งปากมดลูก</span> <span class="bold">(( ตรวจเฉพาะอายุ 30-59 ปี )) **ตรวจซ้ำได้ทุกๆ 5 ปี**</span></div>
          <div style="padding-left:18px;margin-top:1px;">
            ${chkBox(s6.everScreened === 'ever', 'เคยตรวจ')} &nbsp; ระบุปีที่ตรวจ${dotVal(s6.screenedYearBE, 110)}
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            ${chkBox(s6.everScreened === 'never', 'ไม่เคยตรวจ')}
          </div>
        </div>

        <!-- หมวด 7 -->
        <div style="margin-top:2px;border-top:1px solid #000;padding-top:2px;">
          <div><span class="sec-red">7. คัดกรองมะเร็งลำไส้</span> &nbsp;<span class="bold">(( ตรวจเฉพาะอายุ 50-70 ปี )) **ตรวจซ้ำได้ทุกๆ1-2 ปี**</span></div>
          <div style="padding-left:18px;margin-top:1px;">
            ${chkBox(s7.everScreened === 'ever', 'เคยตรวจ')} &nbsp; ระบุปีที่ตรวจ${dotVal(s7.screenedYearBE, 110)}
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            ${chkBox(s7.everScreened === 'never', 'ไม่เคยตรวจ')}
          </div>
        </div>

        <!-- หมวด 8 -->
        <div style="margin-top:2px;border-top:1px solid #000;padding-top:2px;">
          <div style="font-size:10px;">
            <span class="sec-red">8. คัดกรองบุหรี่</span> <span class="bold">( สำหรับเจ้าหน้าที่</span> &nbsp;
            ${chkBoxRaw(smCurrent && s8.staffCare === 'advice', `ให้คำแนะนำ<span class="code-red">(1B530)</span>`)}
            ${chkBoxRaw(smCurrent && s8.staffCare === 'counseling', `ให้คำปรึกษาเพื่อเลิกบุหรี่ <span class="code-red">(1B50,1B501,1B504-6,1B531)</span>`)}
            ${chkBoxRaw(smCurrent && s8.staffCare === 'counseling_med', `ให้คำปรึกษาและให้ยาเพื่อเลิกบุหรี่ <span class="code-red">(1B50,1B502-3, 1B504-6,1B532)</span>`)}
          </div>
          <table class="sub-tbl" style="margin-top:2px;font-size:10.3px;">
            <colgroup><col style="width:24px;" /><col style="width:170px;" /><col /></colgroup>
            <tr>
              <td style="text-align:center;">1</td>
              <td>ท่านสูบบุหรี่หรือไม่</td>
              <td>
                ${chkBox(smActive && smStatus === 'never', 'ไม่เคยสูบเลย (1B52)')} &nbsp;
                ${chkBox(smActive && smStatus === 'quit', 'เคยสูบแต่เลิกแล้ว (1B51)')} &nbsp;
                ${chkBoxRaw(smCurrent, `ยังสูบอยู่ (1B50) <span class="bold">ถามต่อข้อ 2,3</span>`)}
              </td>
            </tr>
            <tr>
              <td style="text-align:center;">2</td>
              <td>สูบบุหรี่กี่มวน/วัน</td>
              <td>
                ${chkBox(smCurrent && s8.cigsPerDay === '1_10', '1-10 มวน (1B501)')} &nbsp;&nbsp;
                ${chkBox(smCurrent && s8.cigsPerDay === '11_19', '11-19 มวน (1B502)')} &nbsp;&nbsp;
                ${chkBox(smCurrent && s8.cigsPerDay === '20_up', '20 มวนขึ้นไป (1B503)')}
              </td>
            </tr>
            <tr>
              <td style="text-align:center;">3</td>
              <td>ระยะเวลาที่สูบมวนแรกหลังตื่นนอน</td>
              <td>
                ${chkBox(smCurrent && s8.firstCigWait === 'lt_30m', 'น้อยกว่า 30 นาที ( 1B504 )')} &nbsp;
                ${chkBox(smCurrent && s8.firstCigWait === 'gt_30m', 'มากกว่า 30 นาที ( 1B505 )')} &nbsp;
                ${chkBox(smCurrent && s8.firstCigWait === 'gte_1h', '1 ชั่วโมงหรือมากกว่า ( 1B506 )')}
              </td>
            </tr>
          </table>
        </div>

        <!-- หมวด 9 (ส่วนต้น) -->
        <div style="margin-top:2px;">
          <div style="font-size:10.2px;">
            <span class="sec-red">9. คัดกรองสุรา</span> ( <span class="bold">การแปลผล :</span> &nbsp;
            ${chkBoxRaw(alcCurrent && alcScore <= 10, `1 – 10 คะแนน <span class="code-red">( 1B602,1B610 )</span>`)} &nbsp;
            ${chkBoxRaw(alcCurrent && alcScore >= 11 && alcScore <= 26, `11 – 26 คะแนน <span class="code-red">( 1B603,1B611 )</span>`)} &nbsp;
            ${chkBoxRaw(alcCurrent && alcScore > 26, `มากกว่า 26 คะแนน <span class="code-red">( 1B604,1B611,1B612 )</span>`)}
          </div>
          <table class="sub-tbl" style="margin-top:2px;font-size:10px;">
            <colgroup>
              <col style="width:22px;" /><col /><col style="width:52px;" /><col style="width:62px;" /><col style="width:52px;" /><col style="width:52px;" /><col style="width:62px;" />
            </colgroup>
            <tr>
              <td style="text-align:center;">1</td>
              <td colspan="6">
                ท่านเคยดื่ม เครื่องดื่มแอลกอฮอล์หรือไม่ &nbsp;&nbsp;
                ${chkBox(alcActive && s9.status === 'never', 'ไม่เคยดื่ม ( 1B600 )')} &nbsp;
                ${chkBox(alcActive && s9.status === 'quit_1y', 'เคยดื่มแต่หยุดแล้ว 1 ปีขึ้นไป ( 1B601 )')} &nbsp;
                ${chkBoxRaw(alcCurrent, `ดื่ม <span class="bold">ถามต่อข้อ 2,3</span>`)}
              </td>
            </tr>
            <tr class="bg-gray" style="text-align:center;font-weight:700;">
              <td style="background:#fff;">2</td>
              <td style="background:#fff;text-align:left;">ช่วง 3 เดือนที่ผ่านมา</td>
              <td>ไม่เคย</td><td>ครั้งสองครั้ง</td><td>ทุกเดือน</td><td>ทุกสัปดาห์</td><td>เกือบทุกวัน</td>
            </tr>
            <tr>
              <td colspan="2"><span class="bold">2.1</span> คุณดื่ม เครื่องดื่มแอลกอฮอล์บ่อยเพียงไร ( <span class="bold">ถ้าตอบ“ไม่เคย”ให้ ข้ามไปถามข้อ 3 ต่อ)</span></td>
              <td style="text-align:center;">${circleScore(' 0 ', alcCurrent && s9.q2_1 === 'never')}</td>
              <td style="text-align:center;">${circleScore(' 2 ', alcCurrent && s9.q2_1 === 'once_twice')}</td>
              <td style="text-align:center;">${circleScore(' 3 ', alcCurrent && s9.q2_1 === 'monthly')}</td>
              <td style="text-align:center;">${circleScore(' 4 ', alcCurrent && s9.q2_1 === 'weekly')}</td>
              <td style="text-align:center;">${circleScore(' 6 ', alcCurrent && s9.q2_1 === 'daily')}</td>
            </tr>
            <tr>
              <td colspan="2"><span class="bold">2.2 คุณเคยรู้สึกอยากดื่ม</span> เครื่องดื่มแอลกอฮอล์ บ่อยเพียงไร</td>
              <td style="text-align:center;">${circleScore(' 0 ', alcQ2Flow && s9.q2_2 === 'never')}</td>
              <td style="text-align:center;">${circleScore(' 3 ', alcQ2Flow && s9.q2_2 === 'once_twice')}</td>
              <td style="text-align:center;">${circleScore(' 4 ', alcQ2Flow && s9.q2_2 === 'monthly')}</td>
              <td style="text-align:center;">${circleScore(' 5 ', alcQ2Flow && s9.q2_2 === 'weekly')}</td>
              <td style="text-align:center;">${circleScore(' 6 ', alcQ2Flow && s9.q2_2 === 'daily')}</td>
            </tr>
            <tr>
              <td colspan="2"><span class="bold">2.3</span> การดื่มเครื่องดื่มแอลกอฮอล์ ทำให้คุณ <span class="bold">เกิดปัญหา</span> สุขภาพการเงิน ครอบครัวบ่อยเพียงไร</td>
              <td style="text-align:center;">${circleScore(' 0 ', alcQ2Flow && s9.q2_3 === 'never')}</td>
              <td style="text-align:center;">${circleScore(' 4 ', alcQ2Flow && s9.q2_3 === 'once_twice')}</td>
              <td style="text-align:center;">${circleScore(' 5 ', alcQ2Flow && s9.q2_3 === 'monthly')}</td>
              <td style="text-align:center;">${circleScore(' 6 ', alcQ2Flow && s9.q2_3 === 'weekly')}</td>
              <td style="text-align:center;">${circleScore(' 7 ', alcQ2Flow && s9.q2_3 === 'daily')}</td>
            </tr>
          </table>
        </div>
      </div>
    </div>

    <!-- ==================== หน้า 2 ==================== -->
    <div class="a4-page">
      <!-- หมวด 9 (ต่อ) + หมวด 10 -->
      <table class="sub-tbl" style="font-size:10.2px;">
        <colgroup>
          <col style="width:22px;" /><col /><col style="width:52px;" /><col style="width:66px;" /><col style="width:66px;" /><col style="width:52px;" /><col style="width:60px;" />
        </colgroup>
        <tr>
          <td colspan="2"><span class="bold">2.4 คุณ ไม่สามารถทำกิจกรรมที่ควรทำได้ปกติ</span> เนื่องจากการดื่มแอลกอฮอล์บ่อยเพียงไร</td>
          <td style="text-align:center;">${circleScore(' 0 ', alcQ2Flow && s9.q2_4 === 'never')}</td>
          <td style="text-align:center;">${circleScore(' 5 ', alcQ2Flow && s9.q2_4 === 'once_twice')}</td>
          <td style="text-align:center;">${circleScore(' 6 ', alcQ2Flow && s9.q2_4 === 'monthly')}</td>
          <td style="text-align:center;">${circleScore(' 7 ', alcQ2Flow && s9.q2_4 === 'weekly')}</td>
          <td style="text-align:center;">${circleScore(' 8 ', alcQ2Flow && s9.q2_4 === 'daily')}</td>
        </tr>
        <tr style="text-align:center;font-weight:700;">
          <td>3</td>
          <td style="text-align:left;font-weight:400;">ตลอดชีวิตที่ผ่าน</td>
          <td class="bg-gray">ไม่เคย</td>
          <td class="bg-gray">เคย<br/>ในช่วง 3 เดือน</td>
          <td class="bg-gray">เคย<br/>ก่อน 3 เดือน</td>
          <td class="bg-gray" colspan="2">&nbsp;</td>
        </tr>
        <tr>
          <td colspan="2"><span class="bold">3.1</span> ญาติ เพื่อนฝูง <span class="bold">เคยแสดงความกังวลหรือตักเตือน</span> เกี่ยวกับการดื่มหรือไม่</td>
          <td style="text-align:center;">${circleScore(' 0 ', alcCurrent && s9.q3_1 === 'never')}</td>
          <td style="text-align:center;">${circleScore(' 6 ', alcCurrent && s9.q3_1 === 'recent_3m')}</td>
          <td style="text-align:center;">${circleScore(' 3 ', alcCurrent && s9.q3_1 === 'before_3m')}</td>
          <td colspan="2">&nbsp;</td>
        </tr>
        <tr>
          <td colspan="2"><span class="bold">3.2</span> คุณ <span class="bold">เคยพยายามหยุดหรือลด</span> การดื่มเครื่องดื่มแอลกอฮอล์ หรือไม่</td>
          <td style="text-align:center;">${circleScore(' 0 ', alcCurrent && s9.q3_2 === 'never')}</td>
          <td style="text-align:center;">${circleScore(' 6 ', alcCurrent && s9.q3_2 === 'recent_3m')}</td>
          <td style="text-align:center;">${circleScore(' 3 ', alcCurrent && s9.q3_2 === 'before_3m')}</td>
          <td colspan="2">&nbsp;</td>
        </tr>
        <tr>
          <td colspan="7" style="padding:3px 5px;font-size:10.3px;">
            <span class="sec-red">10. การออกกำลังกาย</span> &nbsp;
            ${chkBox(behaviorActive && s10.frequency === 'daily_30m', 'ทุกวัน 30 นาที/ครั้ง')}
            ${chkBox(behaviorActive && s10.frequency === 'gt_3_per_week', 'มากกว่า 3 ครั้ง/สัปดาห์')}
            ${chkBox(behaviorActive && s10.frequency === '3_per_week', 'สัปดาห์ละ 3 ครั้ง')}
            ${chkBox(behaviorActive && s10.frequency === 'lt_3_per_week', 'น้อยกว่า 3 ครั้ง / สัปดาห์')}
            ${chkBox(behaviorActive && s10.frequency === 'none', 'ไม่ออกกำลังกายเลย')}
          </td>
        </tr>
      </table>

      <!-- หมวด 11 -->
      <table class="sub-tbl" style="margin-top:4px;font-size:10.2px;">
        <colgroup><col style="width:24px;" /><col /><col style="width:82px;" /><col style="width:82px;" /></colgroup>
        <tr>
          <td colspan="4"><span class="sec-red">11. คัดกรองวัณโรค</span></td>
        </tr>
        <tr>
          <td style="text-align:center;">1</td>
          <td colspan="3">
            <span class="bold">ประวัติการสัมผัสโรค</span> &nbsp;&nbsp;
            ${chkBoxRaw(Boolean(s11.hasFamilyTb), `มีผู้ป่วยวัณโรคในครอบครัว ระบุ${dotVal(s11.familyTbDetail, 120, 'left')}`)} &nbsp;
            ${chkBoxRaw(Boolean(s11.isTbCaregiver), `เป็นผู้ดูแลผู้ป่วยวัณโรค${dotVal(s11.tbCaregiverDetail, 110, 'left')}`)}
          </td>
        </tr>
        <tr>
          <td style="text-align:center;">2</td>
          <td colspan="3">
            <span class="bold">เคยเป็นวัณโรคหรือไม่</span> &nbsp;&nbsp;
            ${chkBox(s11.everHadTb === 'never' && tbHasAnyMark, 'ไม่เคย')} &nbsp;&nbsp;
            ${chkBoxRaw(s11.everHadTb === 'ever', `เคย เมื่อ${dotVal(s11.tbYear, 75)} รักษาที่${dotVal(s11.tbHospital, 130, 'left')}`)}
          </td>
        </tr>
        <tr>
          <td style="text-align:center;">3</td>
          <td><span class="bold">อาการสงสัยวัณโรค</span> &nbsp; ในระยะเวลา 1 เดือนที่ผ่านมา</td>
          <td colspan="2" style="text-align:center;">การประเมิน</td>
        </tr>
        ${TB_SYMPTOM_QUESTIONS.map(
          (q) => `
          <tr>
            <td>&nbsp;</td>
            <td style="padding-left:14px;">${escapeHtml(q.label)}</td>
            <td>มี ${chkBox(tbCheckedYes(q.id), `(${q.weight})`)}</td>
            <td>ไม่มี ${chkBox(tbCheckedNo(q.id), '(0)')}</td>
          </tr>`
        ).join('')}
        <tr>
          <td colspan="4">
            <span class="bold">การแปลผล :</span> คะแนนรวม มากกว่าหรือ เท่ากับ 3 ส่งตรวจวินิจฉัย
            <span style="float:right;" class="filled">(รวม ${ev.tbInfo.score} คะแนน)</span>
          </td>
        </tr>
      </table>

      <!-- หมวด 12 -->
      <table class="sub-tbl" style="margin-top:3px;font-size:10.3px;">
        <colgroup><col /><col style="width:155px;" /></colgroup>
        <tr>
          <td colspan="2">
            <span class="sec-red">12. การคัดกรองโรคซึมเศร้า : 2คำถาม (2Q)</span> &nbsp;&nbsp;
            <span class="bold">15+ <span class="code-red">(ปกติ 1B0210,1B0211)</span> &nbsp;/&nbsp; 60+ <span class="code-red">(ปกติ 1B0280, 1B0281)</span></span>
          </td>
        </tr>
        <tr>
          <td>1. ใน 2 สัปดาห์ ที่ผ่านมา รวมวันนี้ &nbsp; <span class="bold">ท่านรู้สึกหดหู่ เศร้า หรือท้อแท้ สิ้นหวัง หรือไม่</span></td>
          <td>${parenChk(behaviorActive && Boolean(s12.q1_sad), 'มี')} &nbsp; ${parenChk(behaviorActive && !s12.q1_sad, 'ไม่มี')}</td>
        </tr>
        <tr>
          <td>2. ใน 2 สัปดาห์ ที่ผ่านมา รวมวันนี้ &nbsp; <span class="bold">ท่านรู้สึก เบื่อ ทำอะไรก็ไม่เพลิดเพลิน หรือไม่</span></td>
          <td>${parenChk(behaviorActive && Boolean(s12.q2_bored), 'มี')} &nbsp; ${parenChk(behaviorActive && !s12.q2_bored, 'ไม่มี')}</td>
        </tr>
      </table>

      <!-- หมวด 13 -->
      <div class="oral-box" style="margin-top:3px;">
        <div>
          <span class="sec-red">13. สุขภาพช่องปาก</span> : ประเมินพฤติกรรมการทำความสะอาด &nbsp;
          <span class="code-red">( เหมาะสม1B1260 , ไม่เหมาะสม 1B1261 )</span> &nbsp;
          <span class="bold">(( ตรวจเฉพาะอายุ 60 ปีขึ้นไป ))</span>
        </div>
        <div>1. ปัญหาการเคี้ยวอาหาร</div>
        <div style="padding-left:24px;">1.1 จำนวนฟันแท้ในช่องปาก ${dotVal(elderlyActive ? s13.naturalTeethCount : '', 85)} ซี่</div>
        <div class="oral-row" style="padding-left:24px;">
          <span>1.2 จำนวนฟันแท้ น้อยกว่าเกณฑ์ (<span class="bold">อย่างน้อย 20 ซี่ หรือ 4 คู่สบ</span>) หรือไม่</span>
          <span class="oral-opts">${chkBox(elderlyActive && Boolean(s13.lessThan20Teeth), 'มี')} ${chkBox(elderlyActive && !s13.lessThan20Teeth, 'ไม่มี')}</span>
        </div>
        <div class="oral-row" style="padding-left:24px;">
          <span>1.3 มีฟัน หรือ รากฟันผุ &nbsp; หรือไม่</span>
          <span class="oral-opts">${chkBox(elderlyActive && Boolean(s13.hasDecay), 'มี')} ${chkBox(elderlyActive && !s13.hasDecay, 'ไม่มี')}</span>
        </div>
        <div class="oral-row" style="padding-left:24px;">
          <span>1.4 มีเหงือกบวม เป็นฝีหนอง หรือ ฟันโยก &nbsp; หรือไม่</span>
          <span class="oral-opts">${chkBox(elderlyActive && Boolean(s13.hasGumAbscessLoose), 'มี')} ${chkBox(elderlyActive && !s13.hasGumAbscessLoose, 'ไม่มี')}</span>
        </div>
        <div class="oral-row" style="padding-left:24px;">
          <span>1.5 ฟันปลอมชนิดติดแน่น/ถอดได้</span>
          <span class="oral-opts">${chkBox(elderlyActive && Boolean(s13.hasDenture), 'มี')} ${chkBox(elderlyActive && !s13.hasDenture, 'ไม่มี')}</span>
        </div>
        <div class="oral-row">
          <span>2. มีก้อน รอยแดง รอยขาว แผลเรื้อรังในปาก นานกว่า 2 สัปดาห์ &nbsp; หรือไม่</span>
          <span class="oral-opts">${chkBox(elderlyActive && Boolean(s13.hasOralUlcerOver2W), 'มี')} ${chkBox(elderlyActive && !s13.hasOralUlcerOver2W, 'ไม่มี')}</span>
        </div>
        <div class="oral-row">
          <span>3. มีปัญหาปากแห้ง ลิ้นแห้งติดเพดานบ่อย &nbsp; หรือไม่</span>
          <span class="oral-opts">${chkBox(elderlyActive && Boolean(s13.hasDryMouth), 'มี')} ${chkBox(elderlyActive && !s13.hasDryMouth, 'ไม่มี')}</span>
        </div>
        <div class="oral-row">
          <span>4. สภาพในช่องปากสะอาด &nbsp; หรือไม่</span>
          <span class="oral-opts">${chkBox(elderlyActive && s13.cleanliness !== 'unclean', 'สะอาด')} ${chkBox(elderlyActive && s13.cleanliness === 'unclean', 'ไม่สะอาด')}</span>
        </div>
        <div style="font-size:9.8px;margin-top:2px;">
          <span class="bold">เกณฑ์การประเมิน</span> 1-3 ถ้าประเมินว่า “มี” หรือ “ใช่” ≥1 ข้อ ควรส่งต่อ เพื่อเข้ารับบริการทางทันตกรรม / ถ้าประเมินว่า “ไม่มี” หรือ “ไม่ใช่” ควรแนะนำและบริการส่งเสริม ป้องกัน<br/>
          <span class="bold">ข้อ 4</span> ถ้าประเมินว่า “ไม่สะอาด” ควรฝึกการแปรงฟัน และใช้อุปกรณ์เสริมเพื่อควบคุมคราบจุลินทรีย์
        </div>
      </div>

      <!-- หมวด 14 -->
      <div style="padding:3px 2px;font-size:10.6px;">
        <div>
          <span class="sec-red">14. การได้ยิน</span> &nbsp; <span class="code-red">( ปกติ 1B1140 , เฝ้าระวัง 1B1141 , ผิดปกติ 1B1142 )</span> &nbsp; <span class="bold">(( ตรวจเฉพาะอายุ 60 ปีขึ้นไป ))</span>
        </div>
        <div style="padding-left:14px;">คัดกรองการได้ยิน ด้วยการถูนิ้วโป้ง กับ นิ้วชี้ ห่างจากหู ประมาณ 1 นิ้ว ทำทีละข้าง</div>
        <div style="padding-left:18px;margin-top:1px;">
          <span class="bold">หูซ้าย</span> &nbsp;&nbsp;
          ${chkBox(elderlyActive && s14.leftEar !== 'not_hear', 'ได้ยิน')} &nbsp;
          ${chkBox(elderlyActive && s14.leftEar === 'not_hear', 'ไม่ได้ยิน')}
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
          <span class="bold">หูขวา</span> &nbsp;&nbsp;
          ${chkBox(elderlyActive && s14.rightEar !== 'not_hear', 'ได้ยิน')} &nbsp;
          ${chkBox(elderlyActive && s14.rightEar === 'not_hear', 'ไม่ได้ยิน')}
        </div>
      </div>

      <!-- หมวด 15 (ข้อ 1-4) -->
      <table class="v-tbl">
        <tr>
          <th><span class="sec-red">15. สุขภาพทางตา</span> : การคัดกรองสุขภาวะทางสายตา <span class="bold">(( ตรวจเฉพาะอายุ 60 ปีขึ้นไป ))</span></th>
          <th class="v-chk">ไม่ใช่</th>
          <th class="v-chk">ใช่</th>
          <th class="v-eye">ระบุตา</th>
        </tr>
        ${visRow(
          renderVisionInline('<span class="bold">1. อ่านหนังสือ</span> ในระยะ 1 ฟุต', 'ไม่ได้/ไม่ชัด ( สายตาระยะใกล้)', s15.nearVision, '1B1240', '1B1241', '1B1242'),
          s15.nearVision,
          '',
          false
        )}
        ${visRow(
          renderVisionInline('<span class="bold">2. นับนิ้ว</span> ในระยะ 3 เมตร ได้ถูก น้อยกว่า 3 ใน 4 ครั้ง', '( สายตาระยะไกล)', s15.farVision, '1B1243', '1B1244', '1B1245'),
          s15.farVision,
          '',
          false
        )}
        ${visRow(
          renderVisionInline('<span class="bold">3. ปิดตา</span> ดูทีละข้าง &gt; มองเห็นมัว คล้ายมีหมอกบัง', '(เสี่ยงต้อกระจก)', s15.cataract, '1B1250', '1B1251', '1B1252'),
          s15.cataract,
          s15.cataractEye,
          true
        )}
        ${visRow(
          renderVisionInline('<span class="bold">4. ปิดตา</span> ดูทีละข้าง &gt; มองเห็นชัด เฉพาะตรงกลาง รอบข้างไม่เห็น หรือ มักเดินชนประตู สิ่งของบ่อยๆ<br/>( เสี่ยงต้อหิน )', '', s15.glaucoma, '1B1253', '1B1254', '1B1255'),
          s15.glaucoma,
          s15.glaucomaEye,
          true
        )}
      </table>
    </div>

    <!-- ==================== หน้า 3 ==================== -->
    <div class="a4-page">
      <!-- หมวด 15 (ต่อข้อ 5) -->
      <table class="v-tbl">
        ${visRow(
          renderVisionInline('<span class="bold">5. ปิดตา</span> ดูทีละข้าง &gt; มองเห็นจุดดำกลางภาพหรือเห็นภาพบิดเบี้ยว<br/>(คัดกรองความเสี่ยงโรคจอตาเสื่อมจากอายุ )', '', s15.amd, '1B1256', '1B1257', '1B1258'),
          s15.amd,
          s15.amdEye,
          true
        )}
      </table>

      <!-- หมวด 16 Mini-Cog -->
      <div style="border-bottom:1px solid #000;padding:10px 4px;margin-top:6px;font-size:11.6px;line-height:1.45;">
        <div>
          <span class="sec-red">16. การทดสอบสภาพสมอง : Mini-Cog</span> &nbsp; <span class="code-red">( ปกติ 1B1220 , ผิดปกติ 1B1221 )</span> &nbsp; <span class="bold">(( ตรวจเฉพาะอายุ 60 ปีขึ้นไป ))</span>
        </div>
        <div class="minicog-box">
          <div style="flex:1;">
            <div>1. ผู้ทดสอบบอก ผู้ถูกทดสอบว่า “ ให้ตั้งใจฟังดีๆ เดี๋ยวจะบอกคำ 3 คำ เมื่อพูดจบ แล้วให้พูดตาม และ จำไว้ &nbsp; เดี๋ยวจะกลับมาถามซ้ำ ”</div>
            <div style="padding-left:22px;margin:2px 0;">
              ${chkBox(elderlyActive && Boolean(s16.repeatWords?.w1), 'หลานสาว')} &nbsp;&nbsp;
              ${chkBox(elderlyActive && Boolean(s16.repeatWords?.w2), 'สวรรค์')} &nbsp;&nbsp;
              ${chkBox(elderlyActive && Boolean(s16.repeatWords?.w3), 'ภูเขา')}
            </div>
            <div>2. ให้ผู้ถูกทดสอบ วาดรูปนาฬิกา &nbsp; <span class="bold">โดยใส่ตัวเลข และ เข็มนาฬิกาที่เวลา &nbsp; 11.10 &nbsp; น.</span> (2 คะแนน)
              ${elderlyActive ? `<span class="filled"> [ได้ ${ev.miniCogInfo.clock} คะแนน]</span>` : ''}
            </div>
            <div style="margin-top:2px;">3. ให้ผู้ถูกทดสอบ &nbsp; บอกคำ 3 คำ &nbsp; ที่ให้จำเมื่อสักครู่ว่ามีอะไรบ้าง &nbsp; (3 คะแนน)</div>
            <div style="padding-left:22px;margin:2px 0;">
              ${chkBox(elderlyActive && Boolean(s16.recallWords?.w1), 'หลานสาว')} &nbsp;&nbsp;
              ${chkBox(elderlyActive && Boolean(s16.recallWords?.w2), 'สวรรค์')} &nbsp;&nbsp;
              ${chkBox(elderlyActive && Boolean(s16.recallWords?.w3), 'ภูเขา')}
            </div>
            <div style="margin-top:2px;">
              <span class="code-red">เกณฑ์การประเมิน</span> คะแนนเต็ม 5 &nbsp; ถ้าได้ ≤3 คะแนน ถือว่า มีภาวะการรู้คิดบกพร่อง
              ${elderlyActive ? `<span class="filled"> (รวม ${ev.miniCogInfo.total}/5 คะแนน)</span>` : ''}
            </div>
          </div>
          <div class="clock-circle">${
            elderlyActive && safeClockUrl
              ? `<img class="clock-draw-img" src="${safeClockUrl}" alt="ภาพวาดนาฬิกา Mini-Cog" />`
              : '&nbsp;'
          }</div>
        </div>
      </div>

      <!-- หมวด 17 -->
      <div style="border-bottom:1px solid #000;padding:10px 4px;font-size:11.4px;line-height:1.42;">
        <div>
          <span class="sec-red">17. การคัดกรองโรคข้อเข่าเสื่อม</span> &nbsp; <span class="bold">ข้อคำถาม :</span> ผู้สูงอายุมีอาการปวดเข่าหรือไม่ &nbsp;
          <span class="code-red">( ปกติ 1B1270 , ผิดปกติ 1B1271 )</span> &nbsp; <span class="bold">(( ตรวจเฉพาะอายุ 60 ปีขึ้นไป ))</span>
        </div>
        <div style="padding-left:22px;margin:2px 0;">
          ${chkBox(kneeNotPain, 'ไม่ปวดเข่า (ปกติ)')} &nbsp;&nbsp;&nbsp;&nbsp;
          ${chkBox(kneePain, 'ปวดเข่า')}
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:10.4px;">
          <colgroup><col style="width:36%;" /><col style="width:14%;" /><col style="width:36%;" /><col style="width:14%;" /></colgroup>
          <tr>
            <td>1 ข้อเข่าฝืดตึงหลังตื่นนอนตอนเช้านาน &lt;30 นาที</td>
            <td>${chkBox(kneePain && !s17.symptoms?.k1, 'ไม่ใช่')} ${chkBox(kneePain && Boolean(s17.symptoms?.k1), 'ใช่')}</td>
            <td>4 ข้อใหญ่ผิดรูป</td>
            <td>${chkBox(kneePain && !s17.symptoms?.k4, 'ไม่ใช่')} ${chkBox(kneePain && Boolean(s17.symptoms?.k4), 'ใช่')}</td>
          </tr>
          <tr>
            <td>2 เสียงดังกรอบแกรบในข้อเข่าขณะเคลื่อนไหว</td>
            <td>${chkBox(kneePain && !s17.symptoms?.k2, 'ไม่ใช่')} ${chkBox(kneePain && Boolean(s17.symptoms?.k2), 'ใช่')}</td>
            <td>5 จับไม่พบข้อเข่าอุ่น</td>
            <td>${chkBox(kneePain && !s17.symptoms?.k5, 'ไม่ใช่')} ${chkBox(kneePain && Boolean(s17.symptoms?.k5), 'ใช่')}</td>
          </tr>
          <tr>
            <td>3 กดเจ็บที่กระดูกข้อเข่า</td>
            <td>${chkBox(kneePain && !s17.symptoms?.k3, 'ไม่ใช่')} ${chkBox(kneePain && Boolean(s17.symptoms?.k3), 'ใช่')}</td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
          </tr>
        </table>
        <div style="font-size:10px;margin-top:2px;">
          <span class="code-red">เกณฑ์การประเมิน</span> <i>ถ้าผู้สูงอายุมีอาการ “ปวดเข่า” และตอบว่า “ใช่” 2 ข้อ ถือว่า <span class="bold">มีโอกาสที่จะเป็นโรคข้อเข่าเสื่อมแนะนำและควรส่งต่อเพื่อประเมินข้อเข่าเสื่อมทางคลินิก</span></i>
        </div>
      </div>

      <!-- หมวด 18 -->
      <div style="border-bottom:1px solid #000;padding:10px 4px;font-size:11.6px;line-height:1.42;">
        <div>
          <span class="sec-red">18. การคัดกรองภาวะกลั้นปัสสาวะ</span> &nbsp; <span class="code-red">( ปกติ 1B1284 , ผิดปกติ 1B1285 )</span> &nbsp; <span class="bold">(( ตรวจเฉพาะอายุ 60 ปีขึ้นไป ))</span>
        </div>
        <div style="padding-left:14px;">คำถาม : ผู้สูงอายุมีภาวะ ปัสสาวะเล็ด หรือ ปัสสาวะราด จนทำให้เกิดปัญหาในการใช้ชีวิตประจำวัน</div>
        <div style="padding-left:28px;margin-top:2px;">
          ${chkBox(elderlyActive && !s18.hasIncontinence, 'ไม่มี')} &nbsp;&nbsp;&nbsp;
          ${chkBox(elderlyActive && Boolean(s18.hasIncontinence), 'มี')}
        </div>
      </div>

      <!-- หมวด 19 -->
      <div style="border-bottom:1px solid #000;padding:10px 4px;font-size:11.4px;line-height:1.42;">
        <div>
          <span class="sec-red">19. การคัดกรองภาวะหกล้ม : (TUGT)</span> &nbsp; <span class="code-red">( ไม่เสี่ยง 1B1200 , เสี่ยง 1B1201 )</span> &nbsp; <span class="bold">(( ตรวจเฉพาะอายุ 60 ปีขึ้นไป ))</span>
        </div>
        <div>
          <span class="bold">คำถาม :</span> 6 เดือนที่ผ่านมาเคยหกล้มหรือไม่ &nbsp;&nbsp;&nbsp;
          ${chkBox(elderlyActive && Boolean(s19.fellLast6Months), 'เคยหกล้ม')} &nbsp;&nbsp;&nbsp;&nbsp;
          ${chkBox(elderlyActive && !s19.fellLast6Months, 'ไม่เคยหกล้ม')}
        </div>
        <div style="margin-top:1px;">
          <span class="bold">คำสั่ง :</span> ให้ผู้สูงอายุลุกขึ้นจากเก้าอี้ &nbsp; เดินเป็นเส้นตรง &nbsp; ระยะ 3 เมตร &nbsp; หมุนตัวและเดินกลับ &nbsp; มานั่งที่เดิม &nbsp;
          จับเวลาได้${dotVal(elderlyActive ? (s19.walkMinutes ?? 0) : '', 40)}นาที${dotVal(elderlyActive ? (s19.walkSeconds ?? 0) : '', 40)}วินาที
        </div>
        <div style="padding-left:10px;margin-top:1px;">
          <span class="bold">การพิจารณา :</span> ใช้เวลาเดินตั้งแต่ <span class="bold" style="text-decoration:underline;">12 วินาที</span> ขึ้นไป แสดงว่า <span class="bold">มีความเสี่ยงภาวะหกล้ม</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:2px 48px;margin-top:2px;">
          ${chkBox(elderlyActive && !ev.fallInfo.risk, 'เดินได้ปกติ')}
          ${chkBox(elderlyActive && ev.fallInfo.risk, 'มีความเสี่ยงต่อภาวะหกล้ม')}
        </div>
        <!-- แผนผัง SVG การเดิน 3 เมตรไป-กลับ เหมือนต้นฉบับ -->
        <div style="text-align:center;margin-top:6px;">
          <svg viewBox="0 0 460 94" width="430" height="86" xmlns="http://www.w3.org/2000/svg" style="border:1.5px solid #9bbb59;background:#fff;">
            <defs>
              <marker id="arrR" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#4f6228"/>
              </marker>
            </defs>
            <!-- เก้าอี้ + ผู้สูงอายุด้านซ้าย -->
            <rect x="26" y="40" width="12" height="20" fill="none" stroke="#c00000" stroke-width="2"/>
            <line x1="26" y1="26" x2="26" y2="60" stroke="#c00000" stroke-width="2"/>
            <circle cx="48" cy="22" r="5" fill="#7f1d1d"/>
            <path d="M48,27 L48,45 L56,60 M48,45 L42,60 M48,32 L57,39" stroke="#7f1d1d" stroke-width="2.2" fill="none"/>
            <text x="52" y="73" font-size="8.5" text-anchor="middle" font-family="Sarabun, sans-serif">ผู้ป่วยนั่งแล้วลุกขึ้นยืน</text>
            <!-- เส้นประเดินไป -->
            <line x1="94" y1="30" x2="368" y2="30" stroke="#76933c" stroke-width="1.5" stroke-dasharray="4,2" marker-end="url(#arrR)"/>
            <text x="230" y="23" font-size="9.5" text-anchor="middle" font-family="Sarabun, sans-serif">เดินไประยะ 3 เมตร</text>
            <!-- จุดเลี้ยวกลับด้านขวา -->
            <line x1="395" y1="12" x2="395" y2="80" stroke="#76933c" stroke-width="1.5" stroke-dasharray="3,2"/>
            <path d="M372,30 C412,30 412,56 372,56" fill="none" stroke="#4f6228" stroke-width="1.5" marker-end="url(#arrR)"/>
            <text x="382" y="46" font-size="8.5" text-anchor="middle" font-family="Sarabun, sans-serif">เลี้ยวกลับ</text>
            <!-- เส้นประเดินกลับ -->
            <line x1="366" y1="56" x2="94" y2="56" stroke="#76933c" stroke-width="1.5" stroke-dasharray="4,2" marker-end="url(#arrR)"/>
            <text x="230" y="69" font-size="9.5" text-anchor="middle" font-family="Sarabun, sans-serif">เดินกลับระยะ 3 เมตร</text>
            <text x="52" y="86" font-size="8.5" text-anchor="middle" font-family="Sarabun, sans-serif">กลับมานั่งเก้าอี้อีกครั้ง</text>
          </svg>
        </div>
      </div>

      <!-- หมวด 20 -->
      <div style="border-bottom:1.5px solid #000;padding:10px 4px;font-size:11.5px;line-height:1.45;">
        <div>
          <span class="sec-red">20. ปัญหาการนอน</span> &nbsp; <span class="code-red">( ถ้ามี 1B1213 )</span> &nbsp; <span class="bold">(( ตรวจเฉพาะอายุ 60 ปีขึ้นไป ))</span>
        </div>
        <div class="bold">คำถามที่ 1 ท่านมีปัญหาการนอนหลับหรือไม่</div>
        <div style="padding-left:16px;margin-top:2px;">
          ${chkBox(sleepNoProb, 'ไม่มี')} &nbsp;&nbsp;
          ${chkBox(sleepProb, 'มี')} &nbsp; ได้แก่ &nbsp;
          ${chkBox(sleepProb && Boolean(s20.problems?.insomnia), 'นอนไม่หลับ')}
          ${chkBox(sleepProb && Boolean(s20.problems?.oversleep), 'นอนมากไป')}
          ${chkBox(sleepProb && Boolean(s20.problems?.snoring), 'นอนกรน')}
          ${chkBox(sleepProb && Boolean(s20.problems?.sleepwalking), 'นอนละเมอ')}
          ${chkBoxRaw(sleepProb && Boolean(s20.problems?.other), `อื่นๆระบุ${dotVal(sleepProb ? s20.problems?.other : '', 95, 'left')}`)}
        </div>
        <div style="margin-top:2px;">
          ระยะเวลาที่มีปัญหาการนอนหลับ${dotVal(sleepProb ? s20.durationYears : '', 75)}ปี &nbsp;&nbsp;
          โดยเฉลี่ย นอนคืนละ${dotVal(elderlyActive ? s20.avgHoursPerNight : '', 75)}ชั่วโมง
        </div>
        <div class="bold" style="margin-top:2px;">คำถามที่ 2 ท่านมีอาการง่วง อ่อนเพลีย ตอนกลางวันหรือไม่</div>
        <div style="padding-left:16px;margin-top:1px;">
          ${chkBox(elderlyActive && !s20.daytimeFatigue, 'ไม่มี')} &nbsp;&nbsp;&nbsp;
          ${chkBox(elderlyActive && Boolean(s20.daytimeFatigue), 'มี')}
        </div>
        <div style="margin-top:3px;font-size:10.3px;">
          <span class="bold">การพิจารณา :</span> ถ้าตอบ <span class="bold">“มีปัญหา”</span> ข้อใดข้อหนึ่ง ควรส่งต่อให้แพทย์ตรวจวินิจฉัยเพื่อยืนยันผลและทำการรักษา
        </div>
      </div>
    </div>

    <!-- ==================== หน้า 4 ==================== -->
    <div class="a4-page">
      <!-- หมวด 21 MNA -->
      <div class="mna-box">
        <div>
          <span class="sec-red">21. ภาวะขาดสารอาหาร : MNA</span> &nbsp; <span class="code-red">( ปกติ 1K10 , เสี่ยง 1K11 , ขาด 1K12 )</span> &nbsp; <span class="bold">(( ตรวจเฉพาะอายุ 60 ปีขึ้นไป ))</span>
        </div>
        <div class="mna-item">
          <span class="bold">1. ในช่วง 3 เดือนที่ผ่านมา</span> ทานอาหารได้น้อยลง &nbsp;
          ${numBox(0, elderlyActive && Number(s21.mna1) === 0, 'ทานน้อยลงอย่างมาก')}
          ${numBox(1, elderlyActive && Number(s21.mna1) === 1, 'ทานน้อยลงปานกลาง')}
          ${numBox(2, elderlyActive && Number(s21.mna1) === 2, 'ไม่มีความเปลี่ยนแปลง')}
        </div>
        <div class="mna-item">
          <span class="bold">2. ในช่วง 3 เดือนที่ผ่านมา</span> น้ำหนักลดลงหรือไม่ &nbsp;
          ${numBox(0, elderlyActive && Number(s21.mna2) === 0, 'ลดลงมากกว่า 3 กก.')}
          ${numBox(1, elderlyActive && Number(s21.mna2) === 1, 'ไม่ทราบ')}
          ${numBox(2, elderlyActive && Number(s21.mna2) === 2, 'ลดลง 1 – 3 กก.')}
          ${numBox(3, elderlyActive && Number(s21.mna2) === 3, 'น้ำหนักไม่ลดลง')}
        </div>
        <div class="mna-item">
          <span class="bold">3.</span> สามารถ<span class="bold">เคลื่อนไหวได้เอง</span>หรือไม่ &nbsp;
          ${numBox(0, elderlyActive && Number(s21.mna3) === 0, 'นอนบนเตียงหรือนั่งบนรถเข็นตลอดเวลา')}
          ${numBox(1, elderlyActive && Number(s21.mna3) === 1, 'ลุกจากเตียงได้แต่ออกไปข้างนอกไม่ได้')}
          ${numBox(2, elderlyActive && Number(s21.mna3) === 2, 'เดินเคลื่อนไหวได้ปกติ')}
        </div>
        <div class="mna-item">
          <span class="bold">4. ใน 3 เดือนที่ผ่านมา</span> มีความเครียดรุนแรงหรือป่วยเฉียบพลันหรือไม่ &nbsp;&nbsp;
          ${numBox(0, elderlyActive && Number(s21.mna4) === 0, 'มี')} &nbsp;&nbsp;
          ${numBox(2, elderlyActive && Number(s21.mna4) === 2, 'ไม่มี')}
        </div>
        <div class="mna-item">
          <span class="bold">5.</span> มีปัญหา<span class="bold">ทางสุขภาพจิต</span>หรือไม่ &nbsp;
          ${numBox(0, elderlyActive && Number(s21.mna5) === 0, 'ความจำเสื่อมหรือซึมเศร้ารุนแรง')}
          ${numBox(1, elderlyActive && Number(s21.mna5) === 1, 'ความจำเสื่อมเล็กน้อย')}
          ${numBox(2, elderlyActive && Number(s21.mna5) === 2, 'ไม่มีปัญหาทางประสาท')}
        </div>
        <div class="mna-item">
          <span class="bold">6. ดัชนีมวลกาย</span> นน(กก) / สส (ม.2) &nbsp;
          ${numBox(0, elderlyActive && ev.mnaInfo.mna6 === 0, 'BMI น้อยกว่า 19')}
          ${numBox(1, elderlyActive && ev.mnaInfo.mna6 === 1, 'BMI 19 – 20')}
          ${numBox(2, elderlyActive && ev.mnaInfo.mna6 === 2, 'BMI 21 – 22')}
          ${numBox(3, elderlyActive && ev.mnaInfo.mna6 === 3, 'BMI 23 ขึ้นไป')}
        </div>
        <div class="mna-item">
          <span class="bold">7. เส้นรอบวงน่อง</span> หน่วยเป็น เซนติเมตร (${dotVal(elderlyActive ? s21.calfCm : '', 34)} ซม.) &nbsp;
          ${numBox(0, elderlyActive && ev.mnaInfo.mna7 === 0, 'น้อยกว่า 31')} &nbsp;
          ${numBox(3, elderlyActive && ev.mnaInfo.mna7 === 3, 'ตั้งแต่ 31 ขึ้นไป')}
        </div>
        <div style="margin-top:4px;border-top:1px dashed #9ca3af;padding-top:3px;">
          <span class="bold">เกณฑ์ประเมิน</span> เต็ม 14 คะแนน ${elderlyActive ? `<span class="filled">(ได้ ${ev.mnaInfo.total}/14 คะแนน ${ev.mnaInfo.usedField === 'bmi' ? 'จาก BMI ข้อ 6' : 'จากรอบน่องข้อ 7'})</span>` : ''} &nbsp;&nbsp;
          ${chkBox(elderlyActive && ev.mnaInfo.total >= 12, '12 – 14 โภชนาการปกติ')} &nbsp;
          ${chkBox(elderlyActive && ev.mnaInfo.total >= 8 && ev.mnaInfo.total <= 11, '8 – 11 เสี่ยงต่อขาดสารอาหาร')} &nbsp;
          ${chkBox(elderlyActive && ev.mnaInfo.total <= 7, '0 – 7 ขาดสารอาหาร')}
        </div>
      </div>

      <!-- หมวด 22 ADL -->
      <div style="margin-bottom:2px;">
        <span class="sec-red">22. การประเมินความสามารถในการทำกิจวัตรประจำวัน (ADL)</span>
        <span class="code-red">( ติดสังคม 1B1280, ติดบ้าน 1B1281, ติดเตียง 1B1282 )</span>
        <span class="bold">(( ตรวจเฉพาะอายุ 60 ปีขึ้นไป ))</span>
      </div>
      <table class="adl-tbl">
        <colgroup><col style="width:36%;" /><col style="width:64%;" /></colgroup>
        <tr>
          <th>รายการประเมิน</th>
          <th>ผล / คะแนน</th>
        </tr>
        ${ADL_QUESTIONS.map(
          (q) => `
          <tr>
            <td>${escapeHtml(q.label)}</td>
            <td>
              ${q.options
                .map((opt) => chkBox(elderlyActive && Number(s22[q.id]) === opt.score, opt.label))
                .join(' ')}
            </td>
          </tr>`
        ).join('')}
        <tr>
          <td class="bold">รวม${dotVal(elderlyActive ? ev.adlInfo.total : '', 95)}คะแนน</td>
          <td>
            ${chkBox(elderlyActive && ev.adlInfo.total > 11, 'มากกว่า 11 คะแนน ติดสังคม')} &nbsp;
            ${chkBox(elderlyActive && ev.adlInfo.total >= 5 && ev.adlInfo.total <= 11, '5–11 คะแนน ติดบ้าน')} &nbsp;
            ${chkBox(elderlyActive && ev.adlInfo.total <= 4, '0-4 คะแนน ติดเตียง')}
          </td>
        </tr>
      </table>

      <!-- คำรับรองยินยอม & ลายเซ็น -->
      <div class="consent-wrap">
        <div class="consent-text">
          ${consent.accepted === false ? '☐ ' : ''}ทั้งนี้ขอรับรองว่าผู้มารับบริการ ได้เข้ามารับการตรวจคัดกรองภาวะสุขภาพประจำปี ในเขตรับผิดชอบโรงพยาบาลส่งเสริมสุขภาพตำบลบ้านโนนสว่าง ตำบลเหนือเมือง อำเภอเมือง จังหวัดร้อยเอ็ด ในวันและเวลาดังกล่าวจริงและขออนุญาตนำข้อมูลที่ได้ตรวจคัดกรองสุขภาพประจำปี นำมาบันทึกข้อมูลในระบบหมอพร้อมและระบบของรพ.สต.บ้านโนนสว่าง
        </div>
        <div class="sig-grid">
          <div class="sig-block">
            <div class="sig-line">
              <span>ลงชื่อ (จนท.)</span>
              ${dotVal('', 185)}
            </div>
            <div style="padding-left:52px;">(${dotVal(consent.staffName, 155)})</div>
            <div>ตำแหน่ง ${dotVal(consent.staffPosition, 195, 'left')}</div>
          </div>
          <div class="sig-block">
            <div class="sig-line">
              <span>ลงนาม(ผู้มารับบริการ)</span>
              ${dotVal('', 165)}
              ${safeSigUrl ? `<img class="sig-img" src="${safeSigUrl}" alt="ลายเซ็นผู้มารับบริการ" />` : ''}
            </div>
            <div style="padding-left:82px;">(${dotVal(fullName, 150)})</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}


