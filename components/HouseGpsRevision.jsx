'use client';
import { useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, CircleMarker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const pinIcon = L.divIcon({className:'',html:'<span style="display:block;background:#2563eb;border:3px solid white;border-radius:50%;width:24px;height:24px;box-shadow:0 0 4px #333"></span>',iconSize:[24,24],iconAnchor:[12,12]});
export default function HouseGpsRevision({ row, context, onClose, onSaved }) {
  const [point, setPoint] = useState([row.latitude, row.longitude]);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [checked, setChecked] = useState(false);
  const attempt = useRef(null);
  const lock = useRef(false);
  const reference = [context.latitude, context.longitude];
  const hasReference = reference.every(v => v !== null && v !== '' && Number.isFinite(Number(v))) && Math.abs(Number(reference[0])) <= 90 && Math.abs(Number(reference[1])) <= 180;
  async function save() {
    if (lock.current || !checked || reason.trim().length < 3) return;
    lock.current = true; setBusy(true); setError('');
    const payload = {action:'revise',oldId:row.id,batchId:context.batchId,expectedState:context.state,latitude:point[0],longitude:point[1],reason:reason.trim()};
    const signature = JSON.stringify(payload);
    if (attempt.current?.signature !== signature) attempt.current = {signature,id:crypto.randomUUID()};
    try {
      const response = await fetch('/api/house-gps-review', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,id:attempt.current.id})});
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'บันทึกไม่สำเร็จ');
      onSaved();
    } catch (e) { setError(e.message || 'ติดต่อระบบไม่ได้ กรุณาตรวจคิว'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="border rounded p-3 my-3" aria-label="แก้ไขพิกัดบ้าน">
    <h3 className="h5">แก้ไขบ้าน {row.address} หมู่ {row.moo}</h3>
    <p>พิกัดที่บันทึกเดิม {row.latitude}, {row.longitude}<br/>พิกัด HOSxP {hasReference ? reference.join(', ') : 'ยังไม่มีพิกัด'}<br/>อ่านข้อมูลเมื่อ {new Date(context.capturedAt).toLocaleString('th-TH')}</p>
    <MapContainer center={point} zoom={19} style={{height:300}}>
      <TileLayer attribution="© Esri" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"/>
      <CircleMarker center={[row.latitude,row.longitude]} radius={7} pathOptions={{color:'#d97706'}}><Popup>พิกัดที่บันทึกเดิม</Popup></CircleMarker>
      {hasReference && <CircleMarker center={reference.map(Number)} radius={9} pathOptions={{color:'#16a34a'}}><Popup>พิกัดอ้างอิง HOSxP</Popup></CircleMarker>}
      <Marker icon={pinIcon} position={point} draggable={!busy} eventHandlers={{dragend:e=>{const p=e.target.getLatLng();setPoint([p.lat,p.lng]);setChecked(false);}}}/>
    </MapContainer>
    <p className="small mt-2">ลากหมุดสีน้ำเงินไปตำแหน่งใหม่ • {point.map(v=>Number(v).toFixed(6)).join(', ')}</p>
    <label className="d-block">เหตุผลการแก้ไข<textarea className="form-control" minLength={3} maxLength={500} disabled={busy} value={reason} onChange={e=>{setReason(e.target.value);setChecked(false);}}/></label>
    <label className="d-block my-2"><input type="checkbox" checked={checked} disabled={busy} onChange={e=>setChecked(e.target.checked)}/> ตรวจบ้าน พิกัด HOSxP และตำแหน่งใหม่แล้ว</label>
    {error && <p role="alert" className="text-danger">{error}</p>}
    <button className="btn btn-primary me-2" disabled={busy || !checked || reason.trim().length<3} onClick={save}>ยืนยันแก้ไขและเข้าคิว</button>
    <button className="btn btn-outline-secondary" disabled={busy} onClick={onClose}>ปิด</button>
  </section>;
}
