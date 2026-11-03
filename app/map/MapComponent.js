'use client';
import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { supabase } from '@/lib/supabase';
import { normalizePersonRecord, compareThaiNumeric, isBedriddenElder, isHomeboundElder } from '@/lib/proactive-dashboard.mjs';
import VillageBoundaries from './VillageBoundaries';

const FETCH_LIMIT = 1000;
const ICON_CACHE = {};

const FILTER_LABELS = {
  ALL: 'ทุกหลังคาเรือนที่มีพิกัด',
  bedridden: 'ผู้สูงอายุติดเตียง (ADL 0–4)',
  homebound: 'ผู้สูงอายุติดบ้าน (ADL 5–11)',
  living_alone: 'ผู้สูงอายุ 60+ ปี อาศัยอยู่คนเดียว',
  child_pending: 'เด็กเล็ก 0–5 ปี ค้างตรวจพัฒนาการ',
  hep_pending: 'ค้างตรวจไวรัสตับอักเสบ B/C (เกิดก่อน 2535)',
  fobt_pending: 'ค้างตรวจมะเร็งลำไส้ใหญ่ FIT Test (50–70 ปี)',
  hpv_pending: 'ค้างตรวจมะเร็งปากมดลูก HPV DNA (สตรี 30–60 ปี)',
  multi_chronic: 'ผู้ป่วยโรคเรื้อรังซับซ้อน (ตั้งแต่ 2 โรคขึ้นไป)',
  vhv_pending: 'บ้านในใบงานที่ค้างคัดกรอง 4 KPI',
};

// 🟢 ฟังก์ชันสร้างไอคอนหมุดตามสี (แคชไว้ตามสีเพื่อไม่ให้สร้าง L.Icon ใหม่ทุกครั้งที่ render)
const createIcon = (color) => ICON_CACHE[color] || (ICON_CACHE[color] = new L.Icon({
  iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
}));

// 🟢 ฟังก์ชันคำนวณสีหมุดของบ้าน (จัดลำดับความสำคัญของโรคและภาวะพึ่งพิงในบ้าน)
const getHouseMarkerColor = (members) => {
  let isBedridden = false;
  let isPsych = false;
  let isSevereNCD = false;
  let hasHTDM = false;
  let hasDM = false;
  let hasHT = false;
  let hasDLP = false;
  let hasOther = false;

  members.forEach(p => {
    const c = p.chronic || '';
    const adl = p.norm?.adlScore;
    if (c.includes('ผู้ป่วยติดเตียง') || (adl !== null && adl !== undefined && adl <= 4)) isBedridden = true;
    else if (c.includes('จิตเวช')) isPsych = true;
    else if (c.includes('มะเร็ง') || c.includes('หลอดเลือดสมอง') || c.includes('หัวใจ') || c.includes('ไตเรื้อรัง') || c.includes('ถุงลมโป่งพอง')) isSevereNCD = true;
    else if (c.includes('ความดัน+เบาหวาน') || (c.includes('HT') && c.includes('DM'))) hasHTDM = true;
    else if (c.includes('เบาหวาน')) hasDM = true;
    else if (c.includes('ความดันโลหิตสูง')) hasHT = true;
    else if (c.includes('ไขมันในเลือดสูง')) hasDLP = true;
    else if (c !== '-' && c !== '' && !c.includes('ปกติ')) hasOther = true;
  });

  if (isBedridden) return 'black';
  if (isPsych) return 'grey';
  if (isSevereNCD) return 'red';
  if (hasHTDM) return 'violet';
  if (hasDM) return 'orange';
  if (hasHT) return 'blue';
  if (hasDLP) return 'gold';
  if (hasOther) return 'yellow';

  return 'green';
};

function houseMatchesFilter(house, filterMode) {
  if (!filterMode || filterMode === 'ALL') return true;
  const norms = house.members.map(m => m.norm).filter(Boolean);
  switch (filterMode) {
    case 'bedridden':
      return norms.some(isBedriddenElder);
    case 'homebound':
      return norms.some(isHomeboundElder);
    case 'living_alone': {
      const residing = norms.filter(r => r.active && (r.typ === '1' || r.typ === '3'));
      return residing.length === 1 && residing[0].typ === '1' && residing[0].years !== null && residing[0].years >= 60;
    }
    case 'child_pending':
      return norms.some(r => r.childEligible && !r.childDone);
    case 'hep_pending':
      return norms.some(r => r.hepEligible && !r.hepDone);
    case 'fobt_pending':
      return norms.some(r => r.fobtEligible && !r.fobtDone);
    case 'hpv_pending':
      return norms.some(r => r.hpvEligible && !r.hpvDone);
    case 'multi_chronic':
      return norms.some(r => r.chronicList.length >= 2);
    case 'vhv_pending':
      return norms.some(
        r =>
          (r.hepEligible && !r.hepDone) ||
          (r.fobtEligible && !r.fobtDone) ||
          (r.hpvEligible && !r.hpvDone) ||
          (r.childEligible && !r.childDone)
      );
    default:
      return true;
  }
}

export default function MapComponent() {
  const [houses, setHouses] = useState([]);
  const [selectedMoo, setSelectedMoo] = useState('ALL');
  const [selectedFilter, setSelectedFilter] = useState('ALL');
  const [selectedVhv, setSelectedVhv] = useState('ALL');
  const [selectedHouse, setSelectedHouse] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const mooParam = params.get('moo');
      const filterParam = params.get('filter');
      const vhvParam = params.get('vhv');
      const houseParam = params.get('house');
      if (mooParam) setSelectedMoo(mooParam.toLowerCase() === 'all' ? 'ALL' : mooParam);
      if (filterParam && FILTER_LABELS[filterParam]) setSelectedFilter(filterParam);
      if (vhvParam) setSelectedVhv(vhvParam);
      if (houseParam) setSelectedHouse(houseParam);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const fetchMapData = async () => {
      const allData = [];
      let lastPersonId = null;

      for (;;) {
        let query = supabase
          .from('population')
          .select('person_id, house, moo, vhv, title, fname, lname, birth_date, residency_type, person_discharge_id, status_model_version, chronic, adl_score, hep_screen, fobt_screen, hpv_screen, child_dev, latitude, longitude')
          .order('person_id', { ascending: true })
          .limit(FETCH_LIMIT);
        if (lastPersonId !== null) query = query.gt('person_id', lastPersonId);
        if (typeof query.abortSignal === 'function') query = query.abortSignal(controller.signal);

        const { data, error } = await query;
        if (cancelled || error) return;
        const batch = data || [];
        allData.push(...batch);
        const nextId = batch.length ? String(batch[batch.length - 1].person_id || '') : '';
        if (batch.length < FETCH_LIMIT || !nextId || nextId === lastPersonId) break;
        lastPersonId = nextId;
      }

      const now = new Date();
      const groupedHouses = {};
      allData.forEach(person => {
        const norm = normalizePersonRecord(person, now);
        if (!norm.active) return;
        const houseKey = `หมู่${norm.moo}-${norm.house}`;
        if (!groupedHouses[houseKey]) {
          groupedHouses[houseKey] = {
            key: houseKey,
            moo: norm.moo,
            house: norm.house,
            vhv: norm.vhv,
            latitude: null,
            longitude: null,
            members: []
          };
        }
        if (norm.hasGps && groupedHouses[houseKey].latitude === null) {
          groupedHouses[houseKey].latitude = norm.latitude;
          groupedHouses[houseKey].longitude = norm.longitude;
        }
        const isSick = Boolean(person.chronic && person.chronic !== '-' && !person.chronic.includes('ปกติ'));
        groupedHouses[houseKey].members.push({ ...person, isSick, norm });
      });

      const preparedHouses = Object.values(groupedHouses).filter(h => h.latitude !== null).map(h => ({
        ...h,
        markerColor: getHouseMarkerColor(h.members)
      }));

      if (!cancelled) setHouses(preparedHouses);
    };

    fetchMapData();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const mooOptions = useMemo(() => {
    const s = new Set(houses.map(h => h.moo).filter(Boolean));
    return Array.from(s).sort(compareThaiNumeric);
  }, [houses]);

  const visibleHouses = useMemo(() => {
    return houses.filter(h => {
      if (selectedMoo !== 'ALL' && String(h.moo) !== String(selectedMoo)) return false;
      if (selectedVhv !== 'ALL' && !h.members.some(m => m.norm?.vhv === selectedVhv)) return false;
      if (selectedHouse && String(h.house).trim() !== String(selectedHouse).trim()) return false;
      return houseMatchesFilter(h, selectedFilter);
    });
  }, [houses, selectedMoo, selectedVhv, selectedHouse, selectedFilter]);

  const clearFilters = () => {
    setSelectedMoo('ALL');
    setSelectedFilter('ALL');
    setSelectedVhv('ALL');
    setSelectedHouse('');
  };

  return (
    <>
      <div className="container-fluid p-0" style={{ height: 'calc(100vh - 60px)', width: '100%', position: 'relative' }}>
        {/* 🟢 แถบควบคุมตัวกรองใบงานบนแผนที่ (เชื่อมกับ Dashboard Drill-down) */}
        <div
          style={{
            position: 'absolute',
            top: '12px',
            left: '55px',
            right: '15px',
            zIndex: 1000,
            background: 'rgba(255,255,255,0.96)',
            padding: '10px 14px',
            borderRadius: '12px',
            boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
          }}
        >
          <div className="row g-2 align-items-center">
            <div className="col-6 col-md-2">
              <select
                className="form-select form-select-sm"
                value={selectedMoo}
                onChange={e => setSelectedMoo(e.target.value)}
              >
                <option value="ALL">ทุกหมู่บ้าน</option>
                {mooOptions.map(m => (
                  <option key={m} value={m}>หมู่ที่ {m}</option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-4">
              <select
                className="form-select form-select-sm"
                value={selectedFilter}
                onChange={e => setSelectedFilter(e.target.value)}
              >
                {Object.entries(FILTER_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-2">
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="ค้นหาบ้านเลขที่..."
                value={selectedHouse}
                onChange={e => setSelectedHouse(e.target.value)}
              />
            </div>
            <div className="col-6 col-md-4 d-flex align-items-center justify-content-between gap-2">
              <span className="badge bg-primary rounded-pill px-3 py-2">
                แสดง {visibleHouses.length} / {houses.length} หลังคาเรือน
              </span>
              {(selectedMoo !== 'ALL' || selectedFilter !== 'ALL' || selectedVhv !== 'ALL' || selectedHouse) && (
                <button className="btn btn-sm btn-outline-secondary rounded-pill" onClick={clearFilters}>
                  ล้างตัวกรอง
                </button>
              )}
              <a href="/dashboard" className="btn btn-sm btn-outline-primary rounded-pill">
                <i className="fa-solid fa-chart-line me-1" />Dashboard
              </a>
            </div>
          </div>
          {selectedVhv !== 'ALL' && (
            <div className="small text-primary mt-1">
              <i className="fa-solid fa-user-nurse me-1" />
              กำลังกรองเฉพาะเขตรับผิดชอบของ อสม.: <strong>{selectedVhv}</strong>
            </div>
          )}
        </div>

        <MapContainer center={[16.102000, 103.678235]} zoom={15} style={{ height: '100%', width: '100%', zIndex: 0 }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <VillageBoundaries />

          {visibleHouses.map((h) => (
            <Marker key={h.key} position={[h.latitude, h.longitude]} icon={createIcon(h.markerColor)}>
              <Popup>
                <div style={{ fontSize: '0.9rem', minWidth: '240px', maxHeight: '280px', overflowY: 'auto' }}>
                  <div className="fw-bold text-primary mb-2 border-bottom pb-1" style={{ position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
                    <i className="fa-solid fa-house me-1"/> บ้านเลขที่ {h.house} ม.{h.moo}
                    <div className="small text-muted fw-normal mt-1">
                      สมาชิก {h.members.length} คน • อสม.: {h.vhv}
                    </div>
                  </div>

                  {h.members.map((m, i) => {
                    const n = m.norm;
                    const pendingTags = [];
                    if (n?.hepEligible && !n?.hepDone) pendingTags.push('ค้าง HEP');
                    if (n?.fobtEligible && !n?.fobtDone) pendingTags.push('ค้าง FIT');
                    if (n?.hpvEligible && !n?.hpvDone) pendingTags.push('ค้าง HPV');
                    if (n?.childEligible && !n?.childDone) pendingTags.push('ค้างพัฒนาการ');
                    return (
                      <div key={m.person_id || i} className="mb-2 pb-1 border-bottom" style={{ borderColor: '#f0f0f0' }}>
                        <div className="fw-bold">
                          {m.title}{m.fname} {m.lname}
                          {n?.years !== null && <span className="text-muted fw-normal small ms-1">({n.years} ปี)</span>}
                        </div>
                        <div className={`small ${m.isSick ? 'text-danger fw-bold' : 'text-success'}`}>
                          <i className={`fa-solid ${m.isSick ? 'fa-virus' : 'fa-check-circle'} me-1`} />
                          {m.chronic || 'ปกติ'}
                          {n?.adlScore !== null && <span className="badge bg-dark ms-1">ADL {n.adlScore}</span>}
                        </div>
                        {pendingTags.length > 0 && (
                          <div className="small text-warning fw-bold mt-1">
                            <i className="fa-solid fa-clipboard-list me-1" />
                            {pendingTags.join(' • ')}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <div className="d-flex gap-2 mt-2 pt-1">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${h.latitude},${h.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-sm btn-outline-success flex-fill"
                    >
                      <i className="fa-solid fa-diamond-turn-right me-1" />นำทาง
                    </a>
                    <a
                      href={`/?moo=${encodeURIComponent(h.moo)}&house=${encodeURIComponent(h.house)}`}
                      className="btn btn-sm btn-primary flex-fill text-white"
                    >
                      <i className="fa-solid fa-pen-to-square me-1" />เปิดสำรวจ
                    </a>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* 🟢 กล่องคำอธิบายสัญลักษณ์ (Legend) */}
      <div style={{ position: 'absolute', bottom: '20px', left: '20px', zIndex: 1000, background: 'white', padding: '10px 15px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
        <div className="small fw-bold mb-2 border-bottom pb-1">ระดับความรุนแรงของบ้าน</div>
        <div className="small mb-1"><i className="fa-solid fa-location-dot text-dark me-2"/> ผู้ป่วยติดเตียง (ADL 0–4)</div>
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
