'use client';
import {useEffect,useState} from 'react';

const labels = {pending:'รอส่ง', processing:'กำลังส่ง', sent:'ส่งแล้ว', conflict:'ข้อมูลบ้านเปลี่ยน ต้องตรวจสอบ'};
export default function HouseGpsReview() {
  const [page,setPage] = useState(1);
  const [refresh,setRefresh] = useState(0);
  const [data,setData] = useState(null);
  const [failed,setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setFailed(false);
    fetch('/api/house-gps-review?page='+page,{signal:controller.signal,cache:'no-store'})
      .then(async response => {
        if (!response.ok) throw Error();
        const result = await response.json();
        if (!controller.signal.aborted) setData(result);
      }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  },[page,refresh]);
  return <section id="house-gps" className="card p-3">
    <h2 className="h4">รายการพิกัดบ้าน</h2>
    <p>เมื่อผู้สำรวจยืนยันพิกัด รายการจะรอตัวส่งบนเครื่อง LAN เขียนเข้า HOSxP</p>
    <div><button className="btn btn-outline-primary" onClick={()=>setRefresh(n=>n+1)}>โหลดรายการใหม่</button></div>
    {failed ? <p role="alert">โหลดรายการพิกัดไม่สำเร็จ กรุณาลองใหม่</p> : !data ? <p role="status">กำลังโหลดรายการพิกัด…</p> : <>
      {data.rows.length ? <div className="table-responsive"><table className="table"><thead><tr><th>วันที่เข้าคิว</th><th>หมู่</th><th>บ้านเลขที่</th><th>สถานะ</th></tr></thead>
      <tbody>{data.rows.map(row=><tr key={row.id}><td>{new Date(row.created_at).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</td><td>{row.moo}</td><td>{row.address}</td><td>{labels[row.state] || row.state}</td></tr>)}</tbody></table></div> : <p>ไม่มีรายการพิกัดในหน้านี้</p>}
      <div className="d-flex align-items-center gap-3"><button className="btn btn-outline-secondary" disabled={page===1} onClick={()=>setPage(page-1)}>ก่อนหน้า</button>หน้า {page}<button className="btn btn-outline-secondary" disabled={!data.more} onClick={()=>setPage(page+1)}>ถัดไป</button></div>
    </>}
  </section>;
}
