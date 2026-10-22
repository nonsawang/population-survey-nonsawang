'use client';

// Screening entry is disabled; existing survey results remain available read-only.
export default function RiskScreeningSection({ person }) {
  return <section className="border rounded p-3 mt-3" aria-label="คัดกรองบุหรี่และสุรา">
    <div className="fw-bold">คัดกรองบุหรี่/สุรา — ปิดใช้งาน</div>
    <p className="small text-muted mb-0">ไม่เปิดรับการบันทึกคัดกรองบุหรี่และสุรา ข้อมูลเดิมยังเก็บไว้</p>
    {(person.smokingStatus || person.alcoholStatus) && <dl className="small mb-0 mt-2">
      <dt>สถานะบุหรี่เดิม</dt><dd>{person.smokingStatus || 'ยังไม่มีข้อมูล'}</dd>
      <dt>สถานะสุราเดิม</dt><dd className="mb-0">{person.alcoholStatus || 'ยังไม่มีข้อมูล'}</dd>
    </dl>}
  </section>;
}
