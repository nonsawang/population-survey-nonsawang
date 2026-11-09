export function parseChronicList(chronicRaw) {
  const s = String(chronicRaw ?? '').trim();
  if (!s || s === '-' || s === 'ปกติ' || s === 'ปกติ (ไม่มีโรค)') return [];
  const protectedSlash = s
    .replace(/หัวใจ\s*\/\s*หลอดเลือด/g, 'หัวใจ__SLASH__หลอดเลือด')
    .replace(/ถุงลมโป่งพอง\s*\/\s*หอบหืด/g, 'ถุงลมโป่งพอง__SLASH__หอบหืด')
    .replace(/จิตเวช\s*\+\s*ยาเสพติด/g, 'จิตเวช__PLUS__ยาเสพติด');

  const rawParts = protectedSlash
    .split(/[,/]+/)
    .map(part => part.trim())
    .filter(part => part && part !== '-' && part !== 'ปกติ' && part !== 'ปกติ (ไม่มีโรค)');

  const expanded = [];
  for (const part of rawParts) {
    if (/ความดัน\s*\+\s*เบาหวาน|เบาหวาน\s*\+\s*ความดัน|\bHT\s*\+\s*DM\b|\bDM\s*\+\s*HT\b/i.test(part)) {
      expanded.push('ความดันโลหิตสูง (HT)', 'เบาหวาน (DM)');
    } else if (part.includes('+')) {
      for (const sub of part.split('+').map(x => x.trim()).filter(Boolean)) {
        expanded.push(sub.replace(/__SLASH__/g, '/').replace(/__PLUS__/g, '+'));
      }
    } else {
      expanded.push(part.replace(/__SLASH__/g, '/').replace(/__PLUS__/g, '+'));
    }
  }
  return Array.from(new Set(expanded));
}


export const NORMAL = 'ปกติ (ไม่มีโรค)';
export const CHRONIC_CHOICES = ['ความดันโลหิตสูง (HT)','เบาหวาน (DM)','ไขมันในเลือดสูง (DLP)','โรคไตเรื้อรัง (CKD)','หัวใจ/หลอดเลือด','หลอดเลือดสมอง (Stroke)','ถุงลมโป่งพอง/หอบหืด','มะเร็ง','จิตเวช+ยาเสพติด','ผู้ป่วยติดเตียง'];
export function diseaseCount(list) { return new Set(list.filter(x => x !== 'ผู้ป่วยติดเตียง')).size; }
export function chronicDraft(raw) {
 const list=parseChronicList(raw);
 return {normal:['ปกติ',NORMAL].includes(String(raw).trim()),selected:list.filter(x=>CHRONIC_CHOICES.includes(x)),other:list.filter(x=>!CHRONIC_CHOICES.includes(x)).join(', ')};
}
export function serializeChronic(draft) {
 const list=parseChronicList([...draft.selected,draft.other].join(', '));
 return list.length ? list.join(', ') : draft.normal ? NORMAL : '-';
}
