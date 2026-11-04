import {useState} from 'react';
import {MapContainer,TileLayer,Marker} from 'react-leaflet';
import {queueHouseGps} from '@/lib/house-gps.mjs';
import {supabase} from '@/lib/supabase';
import {swal} from '@/lib/survey-feedback';
import {distanceMeters} from '@/lib/health-gis.mjs';

export default function SmartPin({house,icon,onSaved,onClose}) {
  const [fix,setFix]=useState(null), [point,setPoint]=useState(null);
  const [busy,setBusy]=useState(false), [message,setMessage]=useState('');
  function locate(){
    if(!navigator.geolocation){setMessage('อุปกรณ์นี้ไม่รองรับ GPS');return;}
    setBusy(true);setMessage('');
    navigator.geolocation.getCurrentPosition(({coords})=>{
      setBusy(false);
      if(coords.accuracy>100){setMessage('ความแม่นยำ ±'+Math.round(coords.accuracy)+' เมตร กรุณาลองใหม่ในที่โล่ง');return;}
      const p={latitude:coords.latitude,longitude:coords.longitude,accuracy:coords.accuracy};
      setFix(p);setPoint(p);
    },()=>{setBusy(false);setMessage('อ่านพิกัดไม่ได้ กรุณาตรวจสิทธิ์ตำแหน่งแล้วลองอีกครั้ง');},{enableHighAccuracy:true,maximumAge:0,timeout:20000});
  }
  async function save(){
    setBusy(true);setMessage('');
    try {
      if(await queueHouseGps({supabase,swal,moo:house.moo,house:house.house,coords:{...point,accuracy:fix.accuracy}})) onSaved();
    } catch {setMessage('บันทึกไม่ได้ กรุณาตรวจสิทธิ์ คิวเดิม และอายุข้อมูลอ้างอิงบ้าน');}
    finally{setBusy(false);}
  }
  return <section className="border rounded-3 bg-white shadow-sm p-3 mt-2">
    <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
      <strong className="text-primary">ปักหมุดบ้าน {house.house} หมู่ {house.moo}</strong>
      <div className="d-flex gap-2">
        <button type="button" className="btn btn-sm btn-primary rounded-pill" disabled={busy} onClick={locate}>ดึงพิกัดปัจจุบัน (GPS ความแม่นยำสูง)</button>
        <button type="button" className="btn btn-sm btn-outline-secondary rounded-pill" disabled={busy} onClick={onClose}>ปิด</button>
      </div>
    </div>
    {fix && <>
      <p className="small text-muted mb-1">GPS ±{Math.round(fix.accuracy)} เมตร • ลากหมุดไปที่หลังคาบ้าน</p>
      <div className="rounded-3 overflow-hidden border my-2">
        <MapContainer key={fix.latitude+','+fix.longitude} center={[fix.latitude,fix.longitude]} zoom={19} style={{height:240}}>
          <TileLayer attribution="Imagery © Esri and contributors" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"/>
          <Marker draggable={!busy} icon={icon} position={[point.latitude,point.longitude]} eventHandlers={{dragend:e=>{const ll=e.target.getLatLng();setPoint({latitude:ll.lat,longitude:ll.lng});}}}/>
        </MapContainer>
      </div>
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-2">
        <small className="text-secondary">ปรับจากจุดที่เครื่องวัด {Math.round(distanceMeters(fix,point))} เมตร</small>
        <button type="button" className="btn btn-sm btn-success rounded-pill fw-bold" disabled={busy} onClick={save}>ตรวจพิกัดและยืนยันเข้าคิว HOSxP</button>
      </div>
    </>}
    {message && <p role="alert" className="alert alert-warning py-1 px-2 small mt-2 mb-0">{message}</p>}
  </section>;
}
