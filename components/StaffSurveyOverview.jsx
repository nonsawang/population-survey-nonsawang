'use client';
import { useMemo, useState, useEffect } from 'react';
import { summarizeStaffSurvey } from '@/lib/survey-work';

const OWNER_PAGE_SIZE = 10;
const number = value => value.toLocaleString('th-TH');

export default function StaffSurveyOverview({ rows, moo, vhv, onSelect }) {
  const summary = useMemo(() => summarizeStaffSurvey(rows), [rows]);
  const [pendingOnly, setPendingOnly] = useState(true);
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [moo, pendingOnly]);
  const ownerRows = summary.owners.filter(o => (!moo || o.moo === moo) && (!pendingOnly || o.pendingPeople > 0));
  const totalPages = Math.max(1, Math.ceil(ownerRows.length / OWNER_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const total = summary.villages.reduce((s, v) => ({ houses: s.houses + v.houses, incomplete: s.incomplete + v.incomplete, notStarted: s.notStarted + v.notStarted, partial: s.partial + v.partial, missing: s.missing + v.missingHousePeople }), { houses: 0, incomplete: 0, notStarted: 0, partial: 0, missing: 0 });
  const ownerCount = new Set(summary.owners.filter(o => o.pendingPeople > 0 && o.owner !== 'ไม่ระบุ').map(o => o.owner)).size;

  return <div className="staff-overview">
    <div className="staff-overview-heading"><div><span className="staff-eyebrow">มุมมองเจ้าหน้าที่</span><h3 className="h5 fw-bold mt-1 mb-2">ภาพรวมงานสำรวจทุกหมู่</h3></div><span className="small text-muted">เรียงงานคงค้างมากก่อน</span></div>
    <div className="staff-summary" aria-live="polite">
      {[
        ['บ้านที่ยังไม่ครบ', total.incomplete, 'หลัง', `จากทั้งหมด ${number(total.houses)} หลัง`],
        ['ยังไม่เริ่มสำรวจ', total.notStarted, 'หลัง', 'ทุกคนในบ้านยังไม่มี Type'],
        ['สำรวจบางส่วน', total.partial, 'หลัง', 'ยังมีคนในบ้านรอระบุ Type'],
        ['อสม. ที่มีงานค้าง', ownerCount, 'ชื่อ', 'นับตามชื่อผู้รับผิดชอบในข้อมูล']
      ].map(([label, value, unit, detail]) => <div className="staff-summary-item" key={label}><div className="small">{label}</div><div className="staff-summary-number">{number(value)} <small>{unit}</small></div><div className="small text-muted">{detail}</div></div>)}
    </div>
    {total.missing > 0 && <p className="alert alert-warning small mt-3 mb-0">มีข้อมูลไม่ระบุเลขที่บ้าน {number(total.missing)} คน แสดงงานคงค้างราย อสม. ได้ แต่ไม่นับเป็นจำนวนหลัง</p>}

    <section className="mt-4" aria-labelledby="staff-villages-title">
      <h4 className="h6 fw-bold" id="staff-villages-title">1. หมู่ไหนเหลือกี่หลัง</h4>
      <p className="small text-muted">ยอดทุกหมู่ในข้อมูลประชากร • เลือกหมู่เพื่อดู อสม. และบ้านคงค้างด้านล่าง</p>
      {!summary.villages.length ? <p className="text-muted">ยังไม่มีประชากรที่อยู่ในขอบเขตการสำรวจ</p> : <div className="staff-village-grid">
        {summary.villages.map(v => <button type="button" className="staff-village" key={v.key} aria-pressed={moo === v.moo && !vhv} onClick={() => onSelect(v.moo, '', 'pending', false)}>
          <span className="d-flex justify-content-between gap-2"><strong>หมู่ {v.moo || 'ไม่ระบุ'}</strong><span className={v.incomplete ? 'text-danger fw-bold' : 'text-success fw-bold'}>เหลือ {number(v.incomplete)} หลัง</span></span>
          <span className="small text-muted">ยังไม่เริ่ม {number(v.notStarted)} · บางส่วน {number(v.partial)}</span>
          <span className="small">ครบ {number(v.complete)} / {number(v.houses)} หลัง</span>
          {v.missingHousePending > 0 && <span className="small text-danger">ค้างไม่ระบุบ้าน {number(v.missingHousePending)} คน</span>}
        </button>)}
      </div>}
    </section>

    <section className="mt-4" aria-labelledby="staff-owners-title">
      <div className="staff-overview-heading"><h4 className="h6 fw-bold mb-0" id="staff-owners-title">2. อสม. คนไหนยังมีงานค้าง{moo ? ` — หมู่ ${moo}` : ' — ทุกหมู่'}</h4><label className="staff-pending-toggle"><input type="checkbox" checked={pendingOnly} onChange={e => setPendingOnly(e.target.checked)} /> เฉพาะที่มีงานค้าง</label></div>
      <p className="small text-muted mt-2">เฉพาะผู้รับผิดชอบที่มีประชากรมอบหมาย แยกชื่อเดียวกันตามหมู่ • บ้านที่มีหลาย อสม. นับตามคนที่แต่ละคนรับผิดชอบ จึงไม่ควรบวกยอดหลังราย อสม. เป็นยอดหมู่</p>
      {!ownerRows.length ? <p className="bg-light rounded p-3" role="status">ไม่พบ อสม. ตามเงื่อนไขที่เลือก</p> : <>
        <div className="table-responsive survey-work-table staff-owner-table"><table className="table align-middle"><caption>พบ {number(ownerRows.length)} รายการผู้รับผิดชอบตามหมู่</caption><thead><tr><th scope="col">อสม. / หมู่</th><th scope="col">ยังไม่เริ่ม</th><th scope="col">บางส่วน</th><th scope="col">เหลือ / ทั้งหมด</th><th scope="col">คนคงค้าง</th><th scope="col">ดำเนินการ</th></tr></thead><tbody>
          {ownerRows.slice((currentPage - 1) * OWNER_PAGE_SIZE, currentPage * OWNER_PAGE_SIZE).map(o => <tr key={o.key} className={moo === o.moo && vhv === o.owner ? 'staff-owner-selected' : ''}>
            <td data-label="อสม. / หมู่"><div><strong>{o.owner === 'ไม่ระบุ' ? 'ยังไม่ระบุ อสม.' : o.owner}</strong><div className="small text-muted">หมู่ {o.moo || 'ไม่ระบุ'}</div></div></td>
            <td data-label="ยังไม่เริ่ม">{number(o.notStarted)} หลัง</td><td data-label="บางส่วน">{number(o.partial)} หลัง</td><td data-label="เหลือ / ทั้งหมด"><span><strong>{number(o.incomplete)}</strong> / {number(o.houses)} หลัง</span></td>
            <td data-label="คนคงค้าง"><div>{number(o.pendingPeople)} คน{o.missingHousePending > 0 && <div className="small text-danger">ไม่ระบุบ้าน {number(o.missingHousePending)} คน</div>}</div></td>
            <td className="survey-work-action"><button type="button" className="btn btn-sm btn-outline-primary" onClick={() => onSelect(o.moo, o.owner, o.pendingPeople ? 'pending' : 'all', true)} aria-label={`ดูบ้านของ ${o.owner} หมู่ ${o.moo}`}>{o.pendingPeople ? 'ดูงานค้าง' : 'ดูบ้าน'}</button></td>
          </tr>)}
        </tbody></table></div>
        {totalPages > 1 && <div className="d-flex justify-content-between align-items-center gap-2"><button type="button" className="btn btn-sm btn-outline-secondary" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>อสม. ก่อนหน้า</button><span className="small" aria-live="polite">{currentPage} / {totalPages}</span><button type="button" className="btn btn-sm btn-outline-secondary" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>อสม. ถัดไป</button></div>}
      </>}
    </section>
  </div>;
}
