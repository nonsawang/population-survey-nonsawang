'use client';

// Screening entry is disabled; existing survey results remain available read-only.
export default function RiskScreeningSection({ person }) {
  return <details key={person.person_id ?? person.personId} className="border rounded p-3 mt-3">
    <summary className="fw-bold">ดูผลคัดกรองบุหรี่และสุรา</summary>
    <p className="small text-muted mb-0">ไม่เปิดรับการบันทึกคัดกรองบุหรี่และสุรา ข้อมูลเดิมยังเก็บไว้</p>
    {(person.smokingStatus || person.alcoholStatus) ? <dl className="small mb-0 mt-2">
      <dt>สถานะบุหรี่เดิม</dt><dd>{person.smokingStatus || 'ยังไม่มีข้อมูล'}</dd>
      <dt>สถานะสุราเดิม</dt><dd className="mb-0">{person.alcoholStatus || 'ยังไม่มีข้อมูล'}</dd>
    </dl> : <p className="small mb-0 mt-2">ยังไม่มีผลคัดกรอง</p>}
  </details>;
}
