import {parseChronicList} from './chronic.mjs';
import {isMultiChronicResident} from './proactive-dashboard.mjs';
export const DISEASE_PINS = [
  { key:'bedridden', label:'ผู้ป่วยติดเตียง', color:'#292d32' },
  { key:'mental', label:'จิตเวช+ยาเสพติด', color:'#737d85' },
  { key:'major', label:'สโตรก/หัวใจ/ไต/มะเร็ง', color:'#ed334e' },
  { key:'dmht', label:'ความดัน+เบาหวาน', color:'#e879ef' },
  { key:'dm', label:'เบาหวาน (DM)', color:'#f59e0b' },
  { key:'ht', label:'ความดันโลหิตสูง (HT)', color:'#1976ff' },
  { key:'dlp', label:'ไขมันในเลือดสูง (DLP)', color:'#f5da00' },
  { key:'normal', label:'ปกติ (ไม่มีโรคทั้งบ้าน)', color:'#168652' },
  { key:'other', label:'โรคอื่น / ข้อมูลยังไม่ครบ', color:'#8b75a7' },
];
export function houseDiseasePin(members) {
  const people = members.map(m => m.norm).filter(r => r?.active);
  const has = pattern => people.some(r => pattern.test(r.chronicRaw || ''));
  let key;
  if (has(/ผู้ป่วยติดเตียง/) || people.some(r => r.years >= 60 && ['1','3'].includes(r.typ) && r.adlScore != null && r.adlScore >= 0 && r.adlScore <= 4)) key='bedridden';
  else if (has(/จิตเวช|ยาเสพติด/)) key='mental';
  else if (has(/Stroke|สโตรก|หลอดเลือดสมอง|หัวใจ|หลอดเลือด|โรคไต|CKD|มะเร็ง/i)) key='major';
  else if (people.some(r => /เบาหวาน|\bDM\b/i.test(r.chronicRaw) && /ความดัน|\bHT\b/i.test(r.chronicRaw))) key='dmht';
  else if (has(/เบาหวาน|\bDM\b/i)) key='dm';
  else if (has(/ความดัน|\bHT\b/i)) key='ht';
  else if (has(/ไขมัน|\bDLP\b/i)) key='dlp';
  else if (people.length && people.every(r => ['ปกติ','ปกติ (ไม่มีโรค)'].includes(String(r.chronicRaw).trim()))) key='normal';
  else key='other';
  return DISEASE_PINS.find(pin => pin.key === key);
}

export function distanceMeters(a,b) {
  const rad = Math.PI / 180;
  const dLat = (b.latitude-a.latitude)*rad, dLng = (b.longitude-a.longitude)*rad;
  const h = Math.sin(dLat/2)**2 + Math.cos(a.latitude*rad)*Math.cos(b.latitude*rad)*Math.sin(dLng/2)**2;
  return 12742000*Math.asin(Math.sqrt(Math.min(1,h)));
}

// Keep the first chosen house as the starting point.
export function visitOrder(selected) {
  const remaining = [...selected], route = remaining.splice(0,1);
  while (remaining.length) {
    const last = route[route.length-1];
    remaining.sort((a,b)=>distanceMeters(last,a)-distanceMeters(last,b));
    route.push(remaining.shift());
  }
  return route;
}
export function severity(members) {
  let ncd = false, other = false;
  for (const {norm:r} of members) {
    if (!r) continue;
    const conditions = new Set(r.chronicList || parseChronicList(r.chronicRaw));
    if (conditions.has('ผู้ป่วยติดเตียง') || (r.adlScore != null && r.adlScore >= 0 && r.adlScore <= 4) || isMultiChronicResident({...r,chronicList:[...conditions]})) return 'red';
    if (/เบาหวาน|ความดัน|\b(?:DM|HT)\b/i.test(r.chronicRaw)) ncd = true;
    if (conditions.size) other = true;
  }
  return ncd ? 'orange' : other ? 'gray' : 'green';
}
