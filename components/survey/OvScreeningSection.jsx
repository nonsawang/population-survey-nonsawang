'use client';

const QUESTIONS = [
  ['q1', 'ประวัติตรวจพบพยาธิใบไม้ตับ'],
  ['q2', 'ประวัติรับยารักษาพยาธิใบไม้ตับ'],
  ['q3', 'ประวัติรับประทานปลาดิบหรือปลาร้าไม่ต้มสุก'],
  ['q4', 'โรคที่แพทย์วินิจฉัย'],
  ['q5', 'ความต้องการตรวจ OV-ATK'],
];

// The 2569 screening form is closed. Keep saved answers available read-only.
export default function OvScreeningSection({ person }) {
  const answers = person.ovAnswers || {};
  const hasData = QUESTIONS.some(([key]) => !!answers[key]);
  return <section className="border rounded p-3 mt-3" aria-label="คัดกรองพยาธิใบไม้ตับ ปี 2569">
    <div className="fw-bold">คัดกรองพยาธิใบไม้ตับ (ปี 69) — ปิดใช้งาน</div>
    <p className="small text-muted mb-0">ไม่เปิดรับการบันทึกคัดกรองปี 2569 ข้อมูลเดิมยังเก็บไว้</p>
    {hasData && <details className="small mt-2">
      <summary>ดูคำตอบเดิม</summary>
      <dl className="mb-0 mt-2">{QUESTIONS.map(([key, label]) => <div key={key}>
        <dt>{label}</dt><dd>{answers[key] || 'ยังไม่มีข้อมูล'}</dd>
      </div>)}</dl>
    </details>}
  </section>;
}
