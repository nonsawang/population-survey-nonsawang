'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { supabase } from '@/lib/supabase';
import { normalizePersonRecord, compareThaiNumeric, isBedriddenElder, isHomeboundElder, isMultiChronicResident } from '@/lib/proactive-dashboard.mjs';
import SmartPin from './SmartPin';
import {severity,distanceMeters,visitOrder} from '@/lib/health-gis.mjs';
import { villageCenter } from '@/lib/village-centers';
import VillageBoundaries from './VillageBoundaries';

const FETCH_LIMIT = 1000;
const FETCH_CONCURRENCY = 4;
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
  missing_gps: 'บ้านยังไม่มีพิกัด GPS (รอปักหมุด)',
};

const BASE_MAPS = {
  street: {
    label: 'แผนที่ถนน (OSM)',
    shortLabel: 'แผนที่ถนน',
    icon: 'fa-map',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  satellite: {
    label: 'ภาพถ่ายดาวเทียม (Esri)',
    shortLabel: 'ดาวเทียม',
    icon: 'fa-satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community',
  },
  hybrid: {
    label: 'ไฮบริด (ดาวเทียม + ถนน/ขอบเขต)',
    shortLabel: 'ไฮบริด',
    icon: 'fa-layer-group',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    roadsUrl: 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
    labelsUrl: 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery &amp; Labels &copy; Esri and contributors',
  },
};

// 🟢 ฟังก์ชันสร้างไอคอนหมุดตามสี (แคชไว้ตามสีเพื่อไม่ให้สร้าง L.Icon ใหม่ทุกครั้งที่ render)
const villageColors=['#2453ae','#79319d','#008275','#b24611','#a52d65','#475d20','#516cb0','#8f4b36'];
function icon(color,pulse=false){
  const key=color+String(pulse);
  return ICON_CACHE[key] ||= L.divIcon({className:'',iconSize:[18,18],iconAnchor:[9,9],html:'<span class="health-gis-pin '+(pulse?'health-gis-pulse':'')+'" style="background:'+color+'"></span>'});
}

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
      return norms.some(isMultiChronicResident);
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

function Viewport({onBounds, onZoom, onDrawerClose}) {
  const map=useMap();
  useEffect(()=>{
    const update=()=>{onBounds(map.getBounds().pad(0.1));onZoom(map.getZoom());};
    update();
    map.on('moveend resize',update);
    const close = () => onDrawerClose(false);
    map.on('click', close);
    return ()=>{map.off('moveend resize',update);map.off('click',close);};
  },[map,onBounds,onZoom,onDrawerClose]);
  return null;
}

function VillageClusterMarkers({ clusters }) {
  const map = useMap();
  return clusters.map(c => {
    const bubbleHtml = `
      <div class="health-gis-cluster ${c.hasRed ? 'health-gis-pulse' : ''}" style="border-color:${c.color};">
        <div class="health-gis-cluster-title" style="background:${c.color};">
          ม.${c.moo}${c.villageName ? ` ${c.villageName}` : ''} (${c.houseCount} หลัง)
        </div>
        <div class="health-gis-cluster-sub">
          <span>เปราะบาง <b>${c.vulnerableCount}</b></span>
          ${c.pendingCount > 0 ? `<span>• ค้างตรวจ <b>${c.pendingCount}</b></span>` : ''}
        </div>
      </div>
    `;
    const clusterIcon = L.divIcon({
      className: '',
      html: bubbleHtml,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
    return (
      <Marker
        key={`cluster-moo-${c.moo}`}
        position={[c.lat, c.lng]}
        icon={clusterIcon}
        title={`คลิกเพื่อซูมดูหมู่ ${c.moo} (${c.houseCount} หลัง | เปราะบาง ${c.vulnerableCount})`}
        eventHandlers={{
          click: () => {
            map.flyTo([c.lat, c.lng], 16, { duration: 0.75 });
          },
        }}
      />
    );
  });
}

export default function MapComponent() {
  const [zoom, setZoom] = useState(13);
  const labelIcons = useRef(new WeakMap());
  function houseIcon(house, color) {
    if (zoom < 17) return icon(color, layer === 'severity' && color === 'red');
    let cached = labelIcons.current.get(house);
    if (!cached) { cached = new Map(); labelIcons.current.set(house, cached); }
    if (cached.has(color)) return cached.get(color);
    const badges = [];
    const descriptions = [];
    if (houseMatchesFilter(house, 'bedridden') || houseMatchesFilter(house, 'homebound')) {
      badges.push('🛏️'); descriptions.push('มีผู้สูงอายุติดเตียงหรือติดบ้าน');
    }
    if (houseMatchesFilter(house, 'living_alone')) {
      badges.push('👴'); descriptions.push('ผู้สูงอายุอยู่คนเดียว');
    }
    if (houseMatchesFilter(house, 'vhv_pending')) {
      badges.push('📋'); descriptions.push('ค้างคัดกรอง');
    }
    const label = document.createElement('span');
    label.style.cssText = 'display:block;width:max-content;white-space:nowrap;background:white;color:#172554;border:2px solid;border-radius:7px;padding:3px 7px;font:bold 13px sans-serif;box-shadow:0 1px 4px #555;transform:translate(-50%,-50%);';
    label.style.borderColor = color;
    label.textContent = [house.house, ...badges].join(' ');
    label.title = ['บ้าน ' + house.house + ' หมู่ ' + house.moo, ...descriptions].join(' • ');
    label.setAttribute('aria-label', label.title);
    const result = L.divIcon({className:'', html:label, iconSize:[0,0], iconAnchor:[0,0], popupAnchor:[0,-15]});
    cached.set(color, result);
    return result;
  }
  const [bounds,setBounds]=useState(null);
  const [preview,setPreview]=useState([]);
  const [missingOpen,setMissingOpen]=useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const missingSection = useRef(null);
  useEffect(() => {
    if (drawerOpen && missingOpen) missingSection.current?.scrollIntoView({block:'nearest'});
  }, [drawerOpen, missingOpen]);
  const fullReady=useRef(false);
  const [houses, setHouses] = useState([]);
  const [selectedMoo, setSelectedMoo] = useState('ALL');
  const [selectedFilter, setSelectedFilter] = useState('ALL');
  const [selectedVhv, setSelectedVhv] = useState('ALL');
  const [selectedHouse, setSelectedHouse] = useState('');

  const [layer,setLayer]=useState('village'), [focus,setFocus]=useState(null);
  const [baseMap, setBaseMap] = useState('street');
  const [visits,setVisits]=useState([]), [pin,setPin]=useState(null), [reload,setReload]=useState(0);
  const [loadState,setLoadState]=useState('loading');
  const [loadedPeople, setLoadedPeople] = useState(0);
  const route=useMemo(()=>visitOrder(visits),[visits]);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const mooParam = params.get('moo');
      const filterParam = params.get('filter');
      const vhvParam = params.get('vhv');
      const houseParam = params.get('house');
      const baseMapParam = params.get('basemap');
      if (mooParam) setSelectedMoo(mooParam.toLowerCase() === 'all' ? 'ALL' : mooParam);
      if (filterParam && FILTER_LABELS[filterParam]) {
        setSelectedFilter(filterParam);
        if (filterParam === 'missing_gps') {setMissingOpen(true);setDrawerOpen(true);}
      }
      if (vhvParam) setSelectedVhv(vhvParam);
      if (houseParam) setSelectedHouse(houseParam);
      if (baseMapParam && BASE_MAPS[baseMapParam]) {
        setBaseMap(baseMapParam);
      } else {
        try {
          const savedBase = window.localStorage.getItem('health-gis-basemap');
          if (savedBase && BASE_MAPS[savedBase]) setBaseMap(savedBase);
        } catch {}
      }
    }
  }, []);

  const selectBaseMap = (nextMode) => {
    if (!BASE_MAPS[nextMode]) return;
    setBaseMap(nextMode);
    if (typeof window !== 'undefined') {
      try { window.localStorage.setItem('health-gis-basemap', nextMode); } catch {}
    }
  };

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const fetchMapData = async () => {
      fullReady.current=false;setPreview([]);setHouses([]);setLoadedPeople(0);setLoadState('loading');
      const allData = [];
      const fetchPage = async (offset) => {
        let query = supabase
          .from('population')
          .select('person_id, house, moo, vhv, title, fname, lname, birth_date, residency_type, person_discharge_id, status_model_version, chronic, adl_score, hep_screen, fobt_screen, hpv_screen, child_dev, latitude, longitude')
          .order('person_id', { ascending: true })
          .range(offset, offset + FETCH_LIMIT - 1);
        if (typeof query.abortSignal === 'function') query = query.abortSignal(controller.signal);

        const { data, error } = await query;
        if(error)throw error;
        return data || [];
      };
      for (let offset = 0; ; offset += FETCH_LIMIT * FETCH_CONCURRENCY) {
        const pages = await Promise.all(Array.from({ length: FETCH_CONCURRENCY },
          (_, index) => fetchPage(offset + index * FETCH_LIMIT)));
        if (cancelled) return;
        for (const page of pages) allData.push(...page);
        setLoadedPeople(allData.length);
        if (pages.some(page => page.length < FETCH_LIMIT)) break;
      }

      const now = new Date();
      const groupedHouses = {};
      allData.forEach(person => {
        const norm = normalizePersonRecord(person, now);
        if (!norm.active || !norm.moo || !norm.house) return;
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

      if (!cancelled) {
        const completedHouses = Object.values(groupedHouses).map(house => ({
          ...house,
          severityColor: severity(house.members),
        }));
        fullReady.current=true;setPreview([]);setHouses(completedHouses);setLoadState('ready');
      }
    };

    fetchMapData().catch(()=>{controller.abort();if(!cancelled)setLoadState('error');});
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [reload]);

  // Fetch only pin positions in view while the full household records are loading.
  useEffect(()=>{
    if(!bounds || loadState!=='loading' || layer!=='village' || selectedFilter!=='ALL' || selectedVhv!=='ALL') return;
    const controller=new AbortController();
    let query=supabase.from('population')
      .select('moo,house,latitude,longitude,residency_type,person_discharge_id,status_model_version')
      .gte('latitude',bounds.getSouth()).lte('latitude',bounds.getNorth())
      .gte('longitude',bounds.getWest()).lte('longitude',bounds.getEast()).limit(FETCH_LIMIT);
    if(selectedMoo!=='ALL') query=query.eq('moo',selectedMoo);
    if(selectedHouse) query=query.eq('house',selectedHouse);
    query.abortSignal(controller.signal).then(({data,error})=>{
      if(controller.signal.aborted || fullReady.current || error) return;
      const pins=new Map();
      for(const row of data || []){
        const r=normalizePersonRecord(row);
        if(!r.active || !r.hasGps || !r.moo || !r.house) continue;
        pins.set(JSON.stringify([r.moo,r.house]),r);
      }
      setPreview([...pins.values()]);
    }).catch(()=>{});
    return ()=>controller.abort();
  },[bounds,loadState,layer,selectedMoo,selectedFilter,selectedVhv,selectedHouse]);

  const mooOptions = useMemo(() => {
    const s = new Set(houses.map(h => h.moo).filter(Boolean));
    return Array.from(s).sort(compareThaiNumeric);
  }, [houses]);

  const villageStatsByMoo = useMemo(() => {
    const stats = {};
    for (const h of houses) {
      if (!h.moo) continue;
      const key = String(h.moo);
      if (!stats[key]) {
        stats[key] = {
          moo: key,
          totalHouses: 0,
          gpsHouses: 0,
          kpiTarget: 0,
          kpiDone: 0,
          pendingHouses: 0,
          vulnerableHouses: 0,
          redHouses: 0,
        };
      }
      const s = stats[key];
      s.totalHouses += 1;
      if (h.latitude !== null) s.gpsHouses += 1;
      if (houseMatchesFilter(h, 'vhv_pending')) s.pendingHouses += 1;
      if (
        houseMatchesFilter(h, 'bedridden') ||
        houseMatchesFilter(h, 'homebound') ||
        houseMatchesFilter(h, 'living_alone') ||
        houseMatchesFilter(h, 'multi_chronic')
      ) {
        s.vulnerableHouses += 1;
      }
      if (h.severityColor === 'red') s.redHouses += 1;
      for (const m of h.members) {
        const n = m.norm;
        if (!n) continue;
        if (n.hepEligible) {
          s.kpiTarget += 1;
          if (n.hepDone) s.kpiDone += 1;
        }
        if (n.fobtEligible) {
          s.kpiTarget += 1;
          if (n.fobtDone) s.kpiDone += 1;
        }
        if (n.hpvEligible) {
          s.kpiTarget += 1;
          if (n.hpvDone) s.kpiDone += 1;
        }
        if (n.childEligible) {
          s.kpiTarget += 1;
          if (n.childDone) s.kpiDone += 1;
        }
      }
    }
    for (const s of Object.values(stats)) {
      s.gpsPct = s.totalHouses > 0 ? Number(((s.gpsHouses / s.totalHouses) * 100).toFixed(1)) : 0;
      s.kpiPct = s.kpiTarget > 0 ? Number(((s.kpiDone / s.kpiTarget) * 100).toFixed(1)) : 100;
      s.overallCoveragePct = Number(((s.gpsPct + s.kpiPct) / 2).toFixed(1));
      s.vulnerablePct = s.totalHouses > 0 ? Number(((s.vulnerableHouses / s.totalHouses) * 100).toFixed(1)) : 0;
    }
    return stats;
  }, [houses]);

  const filteredHouses = useMemo(() => {
    return houses.filter(h => {
      if (selectedMoo !== 'ALL' && String(h.moo) !== String(selectedMoo)) return false;
      if (selectedVhv !== 'ALL' && !h.members.some(m => m.norm?.vhv === selectedVhv)) return false;
      if (selectedHouse && String(h.house).trim() !== String(selectedHouse).trim()) return false;
      return houseMatchesFilter(h, selectedFilter);
    });
  }, [houses, selectedMoo, selectedVhv, selectedHouse, selectedFilter]);

  const visibleHouses=filteredHouses.filter(h=>h.latitude!==null && (layer!=='pending'||houseMatchesFilter(h,'vhv_pending')));
  const isClusterMode = zoom <= 14 && selectedMoo === 'ALL' && !selectedHouse && layer !== 'radius';
  const villageClusters = useMemo(() => {
    if (!isClusterMode) return [];
    const byMoo = new Map();
    for (const h of visibleHouses) {
      let group = byMoo.get(h.moo);
      if (!group) {
        group = {
          moo: h.moo,
          houseCount: 0,
          vulnerableCount: 0,
          pendingCount: 0,
          hasRed: false,
          latSum: 0,
          lngSum: 0,
        };
        byMoo.set(h.moo, group);
      }
      group.houseCount += 1;
      group.latSum += h.latitude;
      group.lngSum += h.longitude;
      if (
        houseMatchesFilter(h, 'bedridden') ||
        houseMatchesFilter(h, 'homebound') ||
        houseMatchesFilter(h, 'living_alone') ||
        houseMatchesFilter(h, 'multi_chronic')
      ) {
        group.vulnerableCount += 1;
      }
      if (houseMatchesFilter(h, 'vhv_pending')) {
        group.pendingCount += 1;
      }
      if (h.severityColor === 'red') {
        group.hasRed = true;
      }
    }
    return Array.from(byMoo.values())
      .sort((a, b) => compareThaiNumeric(a.moo, b.moo))
      .map(g => {
        const refCenter = villageCenter(g.moo);
        const avgLat = g.latSum / g.houseCount;
        const avgLng = g.lngSum / g.houseCount;
        const colorIdx = Math.max(0, mooOptions.indexOf(g.moo));
        const baseColor =
          layer === 'severity'
            ? g.hasRed
              ? '#dc2626'
              : g.vulnerableCount > 0
              ? '#ea580c'
              : '#16a34a'
            : layer === 'pending'
            ? '#d97706'
            : villageColors[colorIdx % villageColors.length];
        return {
          ...g,
          villageName: refCenter?.name || '',
          lat: refCenter ? refCenter.lat : avgLat,
          lng: refCenter ? refCenter.lng : avgLng,
          color: baseColor,
        };
      });
  }, [isClusterMode, visibleHouses, mooOptions, layer]);
  const onScreen=useMemo(()=>bounds ? visibleHouses.filter(h=>bounds.contains([h.latitude,h.longitude])) : [],[visibleHouses,bounds]);
  const missing=filteredHouses.filter(h=>h.latitude===null);
  const vhvs=useMemo(()=>Array.from(new Set(houses.flatMap(h=>h.members.map(m=>m.norm.vhv)).filter(Boolean))).sort(compareThaiNumeric),[houses]);
  const nearby=layer==='radius'&&focus ? houses.filter(h=>h.latitude!==null && h.key!==focus.key && distanceMeters(h,focus)<=100) : [];
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
        <div className="gis-mobile-summary">
          <span>{selectedMoo === 'ALL' ? 'ทุกหมู่' : 'ม.' + selectedMoo} • {selectedFilter === 'ALL' ? 'ทุกกลุ่ม' : FILTER_LABELS[selectedFilter]} • {loadState === 'ready' ? visibleHouses.length + ' หลัง' : 'กำลังโหลด'}</span>
          <button type="button" aria-controls="gis-drawer" aria-expanded={drawerOpen} onClick={()=>{setMissingOpen(false);setDrawerOpen(v=>!v);}}>ตัวกรอง ▾</button>
          <button type="button" aria-controls="gis-drawer" onClick={()=>{setMissingOpen(true);setDrawerOpen(true);}}>ขาดพิกัด {loadState === 'ready' ? missing.length : '…'}</button>
        </div>
        <div
          id="gis-drawer"
          className={'gis-drawer' + (drawerOpen ? ' is-open' : '')}
          onKeyDown={e=>{if(e.key==='Escape')setDrawerOpen(false);}}
          style={{
            position: 'absolute',
            top: '12px',
            left: '55px',
            right: '15px',
            zIndex: 1000,
            background: 'rgba(255,255,255,0.96)',
            padding: '10px 14px', maxHeight:'44%', overflowY:'auto',
            borderRadius: '12px',
            boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
          }}
        >
          <div className="gis-mobile-heading"><strong>ตัวกรองและรายการบ้าน</strong><button type="button" className="btn btn-sm btn-outline-secondary" onClick={()=>setDrawerOpen(false)}>พับเก็บ ✕</button></div>
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
            <div className="d-flex flex-wrap align-items-center gap-2">
              <label className="small fw-bold d-inline-flex align-items-center gap-1">มุมมอง <select className="form-select form-select-sm w-auto" value={layer} onChange={e=>{setLayer(e.target.value);setFocus(null);}}>
                <option value="village">แยกสีตามหมู่บ้าน</option><option value="severity">โรคเรื้อรัง / ความรุนแรง</option>
                <option value="pending">บ้านค้างคัดกรอง</option><option value="radius">สำรวจรัศมี 100 เมตร</option></select></label>
              <label className="small fw-bold d-inline-flex align-items-center gap-1">อสม. <select className="form-select form-select-sm w-auto" value={selectedVhv} onChange={e=>setSelectedVhv(e.target.value)}><option value="ALL">ทุกคน</option>{vhvs.map(v=><option key={v}>{v}</option>)}</select></label>
            </div>
            <div className="btn-group btn-group-sm" role="group" aria-label="สลับพื้นหลังแผนที่">
              {Object.entries(BASE_MAPS).map(([mode, cfg]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => selectBaseMap(mode)}
                  aria-pressed={baseMap === mode}
                  title={cfg.label}
                  className={`btn ${baseMap === mode ? 'btn-primary fw-bold' : 'btn-outline-secondary'}`}
                >
                  <i className={`fa-solid ${cfg.icon} me-1`} />
                  {cfg.shortLabel}
                </button>
              ))}
            </div>
          </div>
          {loadState==='loading' && <p role="status" className="small text-muted mb-1">กำลังโหลดรายละเอียดบ้านและงานคัดกรอง… {loadedPeople.toLocaleString()} คน</p>}
          {loadState==='error' && <p role="alert" className="small text-danger mb-1">โหลดทะเบียนบ้านไม่สำเร็จ <button className="btn btn-sm btn-outline-danger py-0" onClick={()=>setReload(n=>n+1)}>ลองใหม่</button></p>}
          {layer==='severity' && <small className="d-block mb-1 text-secondary">แดง ติดเตียงหรือมีโรคเรื้อรังตั้งแต่ 2 โรค • ส้ม เบาหวาน/ความดัน • เทา โรคอื่น • เขียว ไม่มีโรคเรื้อรังที่บันทึก</small>}
          {layer==='village' && <div className="small mb-1">{mooOptions.map((m,i)=><span key={m} className="me-2"><b style={{color:villageColors[i%villageColors.length]}}>●</b> หมู่ {m}</span>)}</div>}
          {layer==='pending' && <small className="d-block mb-1 text-secondary">ค้าง HEP, FIT, HPV หรือพัฒนาการเด็ก ตามกลุ่มเป้าหมาย</small>}
          {layer==='radius' && <p className="small mb-1">เลือกบ้านบนแผนที่ แล้วกด “ตีวง 100 เมตร” {focus && <>รอบบ้าน {focus.house} หมู่ {focus.moo} พบ {nearby.length} หลัง <details><summary>ดูรายชื่อบ้านในวง</summary>{nearby.map(h=><div key={h.key}>หมู่ {h.moo} บ้าน {h.house}</div>)}</details></>}</p>}
          {isClusterMode && villageClusters.length > 0 && (
            <div className="small text-primary fw-semibold mb-1">
              <i className="fa-solid fa-circle-nodes me-1" />
              โหมดสรุปรายหมู่บ้าน ({villageClusters.length} หมู่) • คลิกที่ป้ายหมู่บ้านบนแผนที่เพื่อซูมกางหมุดรายบ้านทันที
            </div>
          )}
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
                onChange={e => {
                  const val = e.target.value;
                  setSelectedFilter(val);
                  if (val === 'missing_gps') setMissingOpen(true);
                }}
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
          <details ref={missingSection} className="mt-2" open={missingOpen} onToggle={e=>setMissingOpen(e.currentTarget.open)}><summary className="small fw-bold text-secondary" style={{cursor:'pointer'}}>บ้านขาดพิกัด ({missing.length} หลัง)</summary>
            {!missingOpen ? null : pin ? <SmartPin key={pin.key} house={pin} icon={icon('blue')} onClose={()=>setPin(null)} onSaved={()=>{setPin(null);setReload(n=>n+1);}}/> :
            <div className="mt-1" style={{maxHeight:180,overflow:'auto'}}>{missing.map(h=><div key={h.key} className="d-flex justify-content-between align-items-center py-1 border-bottom small"><span>หมู่ {h.moo} บ้าน {h.house} • {h.vhv || 'ยังไม่มอบหมาย'}</span> <button className="btn btn-sm btn-outline-primary py-0 px-2 rounded-pill" onClick={()=>setPin(h)}>ปักหมุด</button></div>)}</div>}
          </details>
          {route.length>0 && <details open className="mt-2"><summary className="small fw-bold text-success">เส้นทางเยี่ยมบ้าน {route.length}/10 หลัง</summary><small className="d-block text-muted">เริ่มจากบ้านแรกที่เลือก แล้วเรียงบ้านใกล้สุดตามระยะเส้นตรง</small><ol className="small mb-0 ps-3">{route.map(h=><li key={h.key} className="py-1">บ้าน {h.house} หมู่ {h.moo} <button className="btn btn-sm btn-outline-danger py-0 px-2 ms-1 rounded-pill" onClick={()=>setVisits(v=>v.filter(x=>x.key!==h.key))}>เอาออก</button></li>)}</ol></details>}
          {selectedVhv !== 'ALL' && (
            <div className="small text-primary mt-1">
              <i className="fa-solid fa-user-nurse me-1" />
              กำลังกรองเฉพาะเขตรับผิดชอบของ อสม.: <strong>{selectedVhv}</strong>
            </div>
          )}
        </div>

        <MapContainer center={[16.102000, 103.678235]} zoom={15} maxZoom={19} style={{ height: '100%', width: '100%', zIndex: 0 }}>
          <TileLayer
            key={`base-${baseMap}`}
            url={BASE_MAPS[baseMap].url}
            attribution={BASE_MAPS[baseMap].attribution}
            maxZoom={19}
          />
          {baseMap === 'hybrid' && (
            <>
              <TileLayer
                key="hybrid-roads"
                url={BASE_MAPS.hybrid.roadsUrl}
                maxZoom={19}
                opacity={0.85}
              />
              <TileLayer
                key="hybrid-labels"
                url={BASE_MAPS.hybrid.labelsUrl}
                maxZoom={19}
                opacity={0.95}
              />
            </>
          )}
          <Viewport onBounds={setBounds} onZoom={setZoom} onDrawerClose={setDrawerOpen}/>
          {loadState==='loading' && !houses.length && layer==='village' && selectedFilter==='ALL' && selectedVhv==='ALL' && preview.filter(r=>bounds?.contains([r.latitude,r.longitude]) && (selectedMoo==='ALL'||r.moo===selectedMoo) && (!selectedHouse||r.house===selectedHouse)).map(r=>
            <Marker key={JSON.stringify([r.moo,r.house])} position={[r.latitude,r.longitude]} icon={icon('#557998')}><Popup>บ้าน {r.house} หมู่ {r.moo} • กำลังโหลดรายละเอียด</Popup></Marker>)}
          <VillageBoundaries baseMap={baseMap} villageStats={villageStatsByMoo} layer={layer} />

          {layer==='radius'&&focus && <Circle center={[focus.latitude,focus.longitude]} radius={100}/>}
          {route.length>1 && <Polyline positions={route.map(h=>[h.latitude,h.longitude])} pathOptions={{dashArray:'6 6'}}/>}
          {isClusterMode ? (
            <VillageClusterMarkers clusters={villageClusters} />
          ) : (
          onScreen.map((h) => (
            <Marker key={h.key} position={[h.latitude, h.longitude]} title={`บ้าน ${h.house} หมู่ ${h.moo}`} icon={houseIcon(h, layer==='severity'?h.severityColor:layer==='village'?villageColors[mooOptions.indexOf(h.moo)%villageColors.length]:layer==='pending'?'orange':'#376b92')}>
              <Popup>
                <div style={{ fontSize: '0.9rem', minWidth: '240px', maxHeight: '280px', overflowY: 'auto' }}>
                  <div className="fw-bold text-primary mb-2 border-bottom pb-1" style={{ position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
                    <i className="fa-solid fa-house me-1"/> บ้านเลขที่ {h.house} ม.{h.moo}
                    <div className="small text-muted fw-normal mt-1">
                      สมาชิก {h.members.length} คน • อสม.: {h.vhv}
                    </div>
                  </div>

                  <div className="d-flex gap-1 my-2">
                    {layer==='radius' && <button className="btn btn-sm btn-outline-danger flex-fill" onClick={()=>setFocus(h)}>ตีวง 100 เมตร</button>}
                    <button className="btn btn-sm btn-outline-primary flex-fill" disabled={visits.length>=10||visits.some(v=>v.key===h.key)} onClick={()=>setVisits(v=>v.length<10&&!v.some(x=>x.key===h.key)?[...v,h]:v)}>เลือกเยี่ยมบ้าน</button>
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
          ))
          )}
        </MapContainer>
      </div>

      <style jsx global>{`
        .gis-mobile-summary,.gis-mobile-heading{display:none}
        @media(max-width:767px){
          .gis-mobile-summary{display:flex;align-items:center;gap:4px;position:absolute;top:10px;left:50px;right:8px;z-index:1000;background:white;border-radius:10px;padding:4px;box-shadow:0 2px 8px #0003;font-size:12px}
          .gis-mobile-summary span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
          .gis-mobile-summary button{flex-shrink:0;min-height:40px;border:1px solid #dbe3ef;border-radius:7px;background:#f8fafc;color:#17356b;padding:4px}
          .gis-drawer{display:none;top:auto!important;bottom:0;left:0!important;right:0!important;max-height:65%!important;border-radius:16px 16px 0 0!important;padding-bottom:calc(12px + env(safe-area-inset-bottom))!important;overscroll-behavior:contain}
          .gis-drawer.is-open{display:block}
          .gis-mobile-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
        }
        .health-gis-pin{display:block;width:18px;height:18px;border:2px solid white;border-radius:50%;box-shadow:0 0 3px #222}
        .health-gis-cluster{transform:translate(-50%,-50%);background:rgba(255,255,255,0.96);border:2.5px solid #2453ae;border-radius:14px;box-shadow:0 4px 12px rgba(15,23,42,0.28);overflow:hidden;white-space:nowrap;cursor:pointer;transition:transform .15s ease}
        .health-gis-cluster:hover{transform:translate(-50%,-50%) scale(1.06)}
        .health-gis-cluster-title{color:#fff;font:700 12px/1.2 'Sarabun',sans-serif;padding:4px 10px;text-align:center}
        .health-gis-cluster-sub{color:#1e293b;font:600 11px/1.2 'Sarabun',sans-serif;padding:4px 10px;text-align:center;background:#f8fafc}
        .health-gis-pulse{animation:gisPulse 1.7s infinite}
        @keyframes gisPulse{50%{box-shadow:0 0 0 6px #ef444455}}
        @media(prefers-reduced-motion:reduce){.health-gis-pulse{animation:none}}
      `}</style>
    </>
  );
}
