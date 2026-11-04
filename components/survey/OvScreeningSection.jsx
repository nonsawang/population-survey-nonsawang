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
  return <details key={person.person_id ?? person.personId} className="border rounded p-3 mt-3">
    <summary className="fw-bold">ดูผลคัดกรองพยาธิใบไม้ตับและความเสี่ยงมะเร็งท่อน้ำดี (ปี 2569)</summary>
    <p className="small text-muted mb-0">ไม่เปิดรับการบันทึกคัดกรองปี 2569 ข้อมูลเดิมยังเก็บไว้</p>
    {hasData ? <dl className="small mb-0 mt-2">{QUESTIONS.map(([key, label]) => <div key={key}>
        <dt>{label}</dt><dd>{answers[key] || 'ยังไม่มีข้อมูล'}</dd>
      </div>)}</dl> : <p className="small mb-0 mt-2">ยังไม่มีผลคัดกรอง</p>}
  </details>;
}
