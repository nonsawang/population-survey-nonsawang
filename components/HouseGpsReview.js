'use client';
import {useEffect,useState} from 'react';
import dynamic from 'next/dynamic';
const HouseGpsRevision = dynamic(() => import('./HouseGpsRevision'), {ssr:false});

const labels = {pending:'รอส่ง', processing:'กำลังส่ง', sent:'เขียนเข้า HOSxP แล้ว', conflict:'ข้อมูลบ้านเปลี่ยน ต้องตรวจสอบ',superseded:'ยกเลิกและแทนที่แล้ว'};
export default function HouseGpsReview() {
  const [page,setPage] = useState(1);
  const [refresh,setRefresh] = useState(0);
  const [data,setData] = useState(null);
  const [failed,setFailed] = useState(false);
  const [editing,setEditing] = useState(null);
  const [preparing,setPreparing] = useState(false);
  const [message,setMessage] = useState('');
  async function edit(row) {
    setPreparing(true); setMessage(''); setEditing(null);
    try {
      const response = await fetch('/api/house-gps-review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'prepare',oldId:row.id})});
      const context = await response.json();
      if (!response.ok) throw Error(context.error || 'โหลดข้อมูลอ้างอิงไม่สำเร็จ');
      setEditing({row,context});
    } catch(e) { setMessage(e.message); }
    finally { setPreparing(false); }
  }
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
    {message && <p role="status" className="alert alert-info mt-2">{message}</p>}
    {editing && <HouseGpsRevision key={editing.row.id} {...editing} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null);setMessage('บันทึกพิกัดใหม่บนเว็บและเข้าคิวแล้ว รอตัวส่งเขียนเข้า HOSxP');setRefresh(n=>n+1);}}/>}
    {failed ? <p role="alert">โหลดรายการพิกัดไม่สำเร็จ กรุณาลองใหม่</p> : !data ? <p role="status">กำลังโหลดรายการพิกัด…</p> : <>
      {data.rows.length ? <div className="table-responsive"><table className="table"><thead><tr><th>วันที่เข้าคิว</th><th>หมู่</th><th>บ้านเลขที่</th><th>สถานะ</th><th>ดำเนินการ / ประวัติ</th></tr></thead>
      <tbody>{data.rows.map(row=><tr key={row.id}><td>{new Date(row.created_at).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</td><td>{row.moo}</td><td>{row.address}</td><td>{labels[row.state] || row.state}</td><td>
        {['pending','sent','conflict'].includes(row.state) && <button className="btn btn-sm btn-outline-primary" disabled={preparing} onClick={()=>edit(row)}>แก้ไขพิกัดและส่งใหม่</button>}
        {row.state==='processing' && <span>ต้องให้ผู้ดูแลตรวจ receipt ใน HOSxP และยืนยันผลผ่านตัวส่ง LAN ก่อนแก้ไข</span>}
        <details><summary>ประวัติพิกัด</summary><small>คิว {row.id}<br/>ผู้บันทึก {row.actor}<br/>HOSxP เดิม {row.old_latitude ?? '-'}, {row.old_longitude ?? '-'}<br/>พิกัดใหม่ {row.latitude}, {row.longitude}<br/>อ้างอิงคิวเดิม {row.replaces_id || '-'}<br/>เหตุผล {row.revision_reason || '-'}</small></details>
      </td></tr>)}</tbody></table></div> : <p>ไม่มีรายการพิกัดในหน้านี้</p>}
      <div className="d-flex align-items-center gap-3"><button className="btn btn-outline-secondary" disabled={page===1} onClick={()=>setPage(page-1)}>ก่อนหน้า</button>หน้า {page}<button className="btn btn-outline-secondary" disabled={!data.more} onClick={()=>setPage(page+1)}>ถัดไป</button></div>
    </>}
  </section>;
}
