'use client';
import {useEffect,useState} from 'react';
import dynamic from 'next/dynamic';
import HouseGpsBatchApproval from './HouseGpsBatchApproval';
const HouseGpsRevision = dynamic(() => import('./HouseGpsRevision'), {ssr:false});

const labels = {pending:'รอเจ้าหน้าที่ตรวจสอบ', processing:'กำลังส่ง', sent:'เขียนเข้า HOSxP แล้ว', conflict:'ข้อมูลบ้านเปลี่ยน ต้องตรวจสอบ',superseded:'ยกเลิกและแทนที่แล้ว',cancelled:'ยกเลิก — ล้างพิกัดบนเว็บเพื่อปักใหม่'};
export default function HouseGpsReview() {
  const [page,setPage] = useState(1);
  const [refresh,setRefresh] = useState(0);
  const [data,setData] = useState(null);
  const [failed,setFailed] = useState(false);
  const [editing,setEditing] = useState(null);
  const [preparing,setPreparing] = useState(false);
  const [message,setMessage] = useState('');
  async function approve(row) {
    if (!window.confirm('ยืนยันส่งบ้าน '+row.address+' หมู่ '+row.moo+'\nพิกัดเดิม '+row.old_latitude+', '+row.old_longitude+'\nพิกัดใหม่ '+row.latitude+', '+row.longitude+'\nตัวส่ง LAN จะตรวจค่าเดิมก่อนเขียนจริง')) return;
    setPreparing(true); setMessage('');
    try {
      const response = await fetch('/api/house-gps-review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'approve',id:row.id,latitude:row.latitude,longitude:row.longitude})});
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'ยืนยันไม่สำเร็จ');
      setMessage('ยืนยันแล้ว รอตัวส่ง LAN'); setRefresh(n=>n+1);
    } catch(e) { setMessage(e.message); } finally { setPreparing(false); }
  }
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
    <p>เจ้าหน้าที่ตรวจพิกัดและกดส่งก่อน ตัวส่ง LAN จึงเขียนเข้า HOSxP อัตโนมัติ</p>
    <div><button className="btn btn-outline-primary" disabled={preparing} onClick={()=>setRefresh(n=>n+1)}>โหลดรายการใหม่</button></div>
    {data?.revisionAvailable === false && <p role="status" className="alert alert-warning mt-2">แสดงคิวพิกัดเดิมได้แล้ว การแก้ไขและส่งใหม่ต้องติดตั้ง migration 20261105_house_gps_revision.sql ก่อน</p>}
    {message && <p role="status" className="alert alert-info mt-2">{message}</p>}
    {editing && <HouseGpsRevision key={editing.row.id} {...editing} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null);setMessage('บันทึกพิกัดใหม่บนเว็บและเข้าคิวแล้ว รอตัวส่งเขียนเข้า HOSxP');setRefresh(n=>n+1);}}/>}
    {failed ? <p role="alert">โหลดรายการพิกัดไม่สำเร็จ กรุณาลองใหม่</p> : !data ? <p role="status">กำลังโหลดรายการพิกัด…</p> : <>
      <HouseGpsBatchApproval key={`${page}-${refresh}`} rows={data.rows} busy={preparing} setBusy={setPreparing} onApproved={()=>setMessage('อนุมัติเป็นชุดเสร็จแล้ว ตรวจผลด้านล่าง หรือกดโหลดรายการใหม่เพื่อดูสถานะตัวส่ง LAN')}/>
      {data.rows.length ? <div className="table-responsive"><table className="table"><thead><tr><th>วันที่เข้าคิว</th><th>หมู่</th><th>บ้านเลขที่</th><th>สถานะ</th><th>ดำเนินการ / ประวัติ</th></tr></thead>
      <tbody>{data.rows.map(row=><tr key={row.id}><td>{new Date(row.created_at).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</td><td>{row.moo}</td><td>{row.address}</td><td>{row.state==='pending' && row.approved_at ? 'ยืนยันแล้ว รอตัวส่ง LAN' : labels[row.state] || row.state}</td><td>
        {row.state==='pending' && !row.approved_at && <button className="btn btn-sm btn-primary me-2" disabled={preparing} onClick={()=>approve(row)}>ตรวจสอบและส่ง</button>}
        {data.revisionAvailable !== false && ['pending','sent','conflict'].includes(row.state) && <button className="btn btn-sm btn-outline-primary" disabled={preparing} onClick={()=>edit(row)}>แก้ไขพิกัดและส่งใหม่</button>}
        {row.state==='processing' && <span>ต้องให้ผู้ดูแลตรวจ receipt ใน HOSxP และยืนยันผลผ่านตัวส่ง LAN ก่อนแก้ไข</span>}
        <details><summary>ประวัติพิกัด</summary><small>คิว {row.id}<br/>ผู้บันทึก {row.actor}<br/>ผู้ยืนยันส่ง {row.approved_by || '-'}<br/>เวลายืนยัน {row.approved_at ? new Date(row.approved_at).toLocaleString('th-TH') : '-'}<br/>HOSxP เดิม {row.old_latitude ?? '-'}, {row.old_longitude ?? '-'}<br/>พิกัดใหม่ {row.latitude}, {row.longitude}<br/>อ้างอิงคิวเดิม {row.replaces_id || '-'}<br/>เหตุผล {row.revision_reason || '-'}</small></details>
      </td></tr>)}</tbody></table></div> : <p>ไม่มีรายการพิกัดในหน้านี้</p>}
      <div className="d-flex align-items-center gap-3"><button className="btn btn-outline-secondary" disabled={preparing||page===1} onClick={()=>setPage(page-1)}>ก่อนหน้า</button>หน้า {page}<button className="btn btn-outline-secondary" disabled={preparing||!data.more} onClick={()=>setPage(page+1)}>ถัดไป</button></div>
    </>}
  </section>;
}
