'use client';
import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { supabase } from '@/lib/supabase';

// 🟢 ฟังก์ชันสร้างไอคอนหมุดตามสี
const createIcon = (color) => new L.Icon({
  iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

export default function MapComponent() {
  const [houses, setHouses] = useState([]);

  useEffect(() => {
    const fetchMapData = async () => {
      const { data, error } = await supabase
        .from('population')
        .select('house, moo, title, fname, lname, chronic, latitude, longitude')
        .not('latitude', 'is', null);
      
      if (!error && data) {
        // จัดกลุ่มรวมกันตาม "บ้านเลขที่" และ "หมู่"
        const groupedHouses = {};
        data.forEach(person => {
          const houseKey = `หมู่${person.moo}-${person.house}`;
          if (!groupedHouses[houseKey]) {
            groupedHouses[houseKey] = {
              moo: person.moo,
              house: person.house,
              latitude: person.latitude,
              longitude: person.longitude,
              members: []
            };
          }
          groupedHouses[houseKey].members.push(person);
        });
        setHouses(Object.values(groupedHouses));
      }
    };
    fetchMapData();
  }, []);

  // 🟢 ฟังก์ชันคำนวณสีหมุดของบ้าน (จัดลำดับความสำคัญของโรคในบ้าน)
  const getHouseMarkerColor = (members) => {
    let isBedridden = false;
    let isPsych = false;
    let isSevereNCD = false;
    let hasHTDM = false;
    let hasDM = false;
    let hasHT = false;
    let hasDLP = false;
    let hasOther = false;

    // เช็กโรคของทุกคนในบ้าน
    members.forEach(p => {
      const c = p.chronic || '';
      if (c.includes('ผู้ป่วยติดเตียง')) isBedridden = true;
      else if (c.includes('จิตเวช')) isPsych = true;
      else if (c.includes('มะเร็ง') || c.includes('หลอดเลือดสมอง') || c.includes('หัวใจ') || c.includes('ไตเรื้อรัง') || c.includes('ถุงลมโป่งพอง')) isSevereNCD = true;
      else if (c.includes('ความดัน+เบาหวาน') || (c.includes('HT') && c.includes('DM'))) hasHTDM = true;
      else if (c.includes('เบาหวาน')) hasDM = true;
      else if (c.includes('ความดันโลหิตสูง')) hasHT = true;
      else if (c.includes('ไขมันในเลือดสูง')) hasDLP = true;
      else if (c !== '-' && !c.includes('ปกติ')) hasOther = true;
    });

    // 🏆 แสดงสีตาม Priority ความรุนแรง (ใครป่วยหนักสุด บ้านนั้นได้สีนั้น)
    if (isBedridden) return 'black'; // ดำ: ติดเตียง
    if (isPsych) return 'grey'; // เทา: จิตเวช
    if (isSevereNCD) return 'red'; // แดง: กลุ่มโรครุนแรง (สโตรก, หัวใจ, ไต, มะเร็ง, ปอด)
    if (hasHTDM) return 'violet'; // ม่วง: ความดัน+เบาหวาน
    if (hasDM) return 'orange'; // ส้ม: เบาหวาน
    if (hasHT) return 'blue'; // น้ำเงิน: ความดันโลหิตสูง
    if (hasDLP) return 'gold'; // เหลืองทอง: ไขมันในเลือดสูง
    if (hasOther) return 'yellow'; // เหลืองสว่าง: โรคอื่นๆ ที่ไม่ได้ระบุ
    
    return 'green'; // เขียว: ปกติ (ไม่มีโรคทั้งบ้าน)
  };

  return (
    <>
      <div className="container-fluid p-0" style={{ height: 'calc(100vh - 60px)', width: '100%' }}>
        <MapContainer center={[16.102000, 103.678235]} zoom={15} style={{ height: '100%', width: '100%', zIndex: 0 }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          
          {houses.map((h, idx) => (
            <Marker key={idx} position={[h.latitude, h.longitude]} icon={createIcon(getHouseMarkerColor(h.members))}>
              <Popup>
                <div style={{ fontSize: '0.9rem', minWidth: '220px', maxHeight: '250px', overflowY: 'auto' }}>
                  <div className="fw-bold text-primary mb-2 border-bottom pb-1" style={{ position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
                    <i className="fa-solid fa-house me-1"/> บ้านเลขที่ {h.house} ม.{h.moo}
                    <div className="small text-muted fw-normal mt-1">จำนวนสมาชิก {h.members.length} คน</div>
                  </div>
                  
                  {h.members.map((m, i) => {
                    const isSick = m.chronic && m.chronic !== '-' && !m.chronic.includes('ปกติ');
                    return (
                      <div key={i} className="mb-2 pb-1 border-bottom" style={{ borderColor: '#f0f0f0' }}>
                        <div className="fw-bold">{m.title}{m.fname} {m.lname}</div>
                        <div className={`small ${isSick ? 'text-danger fw-bold' : 'text-success'}`}>
                          <i className={`fa-solid ${isSick ? 'fa-virus' : 'fa-check-circle'} me-1`} /> 
                          {m.chronic || 'ปกติ'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      
      {/* 🟢 กล่องคำอธิบายสัญลักษณ์ (Legend) */}
      <div style={{ position: 'absolute', bottom: '20px', left: '20px', zIndex: 1000, background: 'white', padding: '10px 15px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
        <div className="small fw-bold mb-2 border-bottom pb-1">ระดับความรุนแรงของบ้าน</div>
        <div className="small mb-1"><i className="fa-solid fa-location-dot text-dark me-2"/> ผู้ป่วยติดเตียง</div>
        <div className="small mb-1"><i className="fa-solid fa-location-dot text-secondary me-2"/> จิตเวช+ยาเสพติด</div>
        <div className="small mb-1"><i className="fa-solid fa-location-dot text-danger me-2"/> สโตรก/หัวใจ/ไต/มะเร็ง</div>
        <div className="small mb-1"><i className="fa-solid fa-location-dot me-2" style={{color: 'violet'}}/> ความดัน+เบาหวาน</div>
        <div className="small mb-1"><i className="fa-solid fa-location-dot me-2" style={{color: 'orange'}}/> เบาหวาน (DM)</div>
        <div className="small mb-1"><i className="fa-solid fa-location-dot text-primary me-2"/> ความดันโลหิตสูง (HT)</div>
        <div className="small mb-1"><i className="fa-solid fa-location-dot me-2" style={{color: '#ffd700'}}/> ไขมันในเลือดสูง (DLP)</div>
        <div className="small"><i className="fa-solid fa-location-dot text-success me-2"/> ปกติ (ไม่มีโรคทั้งบ้าน)</div>
      </div>
    </>
  );
}