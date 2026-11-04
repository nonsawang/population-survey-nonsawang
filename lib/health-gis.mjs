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
    const conditions = new Set(
      (r.chronicList || [])
        .flatMap(value => (/จิตเวช\s*\+\s*ยาเสพติด/.test(value) ? [value] : value.split('+')))
        .map(value => value.trim())
        .filter(Boolean)
    );
    if ((r.adlScore != null && r.adlScore >= 0 && r.adlScore <= 4) || conditions.size >= 2) return 'red';
    if (/เบาหวาน|ความดัน|\b(?:DM|HT)\b/i.test(r.chronicRaw)) ncd = true;
    if (conditions.size) other = true;
  }
  return ncd ? 'orange' : other ? 'gray' : 'green';
}
