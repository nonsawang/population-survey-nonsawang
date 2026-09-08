export const BOUNDARY_COLORS = ['#2563eb','#d97706','#16a34a','#9333ea','#dc2626','#0891b2','#be185d','#4f46e5'];
export const emptyBoundaries = () => ({ type: 'FeatureCollection', features: [] });
const same = (a,b) => a[0] === b[0] && a[1] === b[1];
const turn = (a,b,c) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function intersects(a,b,c,d) {
  const on = (a,b,p) => Math.abs(turn(a,b,p))<1e-12 && p[0]>=Math.min(a[0],b[0]) && p[0]<=Math.max(a[0],b[0]) && p[1]>=Math.min(a[1],b[1]) && p[1]<=Math.max(a[1],b[1]);
  return (turn(a,b,c)*turn(a,b,d)<0 && turn(c,d,a)*turn(c,d,b)<0) || on(a,b,c) || on(a,b,d) || on(c,d,a) || on(c,d,b);
}
function validRing(ring) {
  if (!Array.isArray(ring) || ring.length<4 || ring.length>1000 || !ring.every(p=>Array.isArray(p) && p.length===2 && p.every(Number.isFinite) && Math.abs(p[0])<=180 && Math.abs(p[1])<=90)) throw Error('พิกัดต้องเป็น longitude, latitude และวงปิดอย่างน้อย 3 จุด');
  if (!same(ring[0],ring[ring.length-1])) throw Error('แนวเขตต้องเป็นวงปิด');
  let area=0;
  for(let i=0;i<ring.length-1;i++) {
    if(same(ring[i],ring[i+1])) throw Error('มีจุดพิกัดติดกันซ้ำ');
    area+=ring[i][0]*ring[i+1][1]-ring[i+1][0]*ring[i][1];
    for(let j=i+2;j<ring.length-1;j++) {
      if(i===0 && j===ring.length-2) continue;
      if(intersects(ring[i],ring[i+1],ring[j],ring[j+1])) throw Error('เส้นแนวเขตตัดกัน กรุณาแก้จุดวาด');
    }
  }
  if(Math.abs(area)<1e-10) throw Error('แนวเขตต้องมีพื้นที่ ไม่ใช่เส้นตรง');
}
export function parseBoundaries(value, allowedMoos) {
  if(value?.type!=='FeatureCollection' || !Array.isArray(value.features) || value.features.length>100) throw Error('ต้องเป็น GeoJSON FeatureCollection ไม่เกิน 100 พื้นที่');
  const seen=new Set(); let points=0;
  return {type:'FeatureCollection',features:value.features.map(f=>{
    const moo=String(f?.properties?.moo || '').trim();
    if(f?.type!=='Feature' || !allowedMoos.includes(moo)) throw Error('กรุณาระบุ properties.moo เป็นหมู่ในพื้นที่รับผิดชอบ');
    if(seen.has(moo)) throw Error(`หมู่ ${moo} ซ้ำ ให้รวมพื้นที่แยกเป็น MultiPolygon`);
    seen.add(moo);
    const g=f.geometry;
    if(!g || !['Polygon','MultiPolygon'].includes(g.type)) throw Error('รองรับเฉพาะ Polygon และ MultiPolygon');
    const polygons=g.type==='Polygon'?[g.coordinates]:g.coordinates;
    if(!Array.isArray(polygons) || !polygons.length) throw Error('ไม่มีวงแนวเขต');
    for(const polygon of polygons) {
      if(!Array.isArray(polygon) || !polygon.length) throw Error('ไม่มีวงแนวเขต');
      for(const ring of polygon) { points+=ring?.length || 0; if(points>10000) throw Error('จำนวนจุดรวมเกิน 10,000 จุด'); validRing(ring); }
    }
    return {type:'Feature',properties:{moo,name:String(f.properties.name||`หมู่ ${moo}`).slice(0,120),source:String(f.properties.source||'ยังไม่ระบุแหล่งที่มา').slice(0,300),status:'draft',updated_at:String(f.properties.updated_at||'').slice(0,40)},geometry:JSON.parse(JSON.stringify(g))};
  })};
}
export function makeBoundary(moo,name,source,latlngs,allowedMoos) {
  if(!source.trim()) throw Error('กรุณาระบุที่มาหรือผู้จัดทำแนวเขตร่าง');
  const ring=latlngs.map(p=>[p.lng,p.lat]);
  if(ring.length) ring.push([...ring[0]]);
  return parseBoundaries({type:'FeatureCollection',features:[{type:'Feature',properties:{moo,name,source,updated_at:new Date().toISOString()},geometry:{type:'Polygon',coordinates:[ring]}}]},allowedMoos).features[0];
}
export function leafletPositions(geometry) {
  const convert=ring=>ring.map(([lng,lat])=>[lat,lng]);
  return geometry.type==='Polygon'?geometry.coordinates.map(convert):geometry.coordinates.map(p=>p.map(convert));
}
