export const normalizeSearch = value => String(value ?? '').normalize('NFKC').replace(/[๐-๙]/g,c=>String(c.charCodeAt(0)-0x0e50)).replace(/[\u200b-\u200d\ufeff]/g,'').trim().toLowerCase();
export function searchScreeningPeople(people,term,mode='auto') {
  const q=normalizeSearch(term),compact=q.replace(/\s+/g,'');
  if(!q)return {rows:[],ready:false,message:'พิมพ์ชื่ออย่างน้อย 2 ตัวอักษร หรือเลขบัตรอย่างน้อย 4 หลัก'};
  const numeric=/^[\d\s-]+$/.test(q),digits=numeric?q.replace(/[\s-]/g,''):'';
  if(mode==='cid' && (!digits || digits.length<4 || digits.length>13))return {rows:[],ready:false,message:'ค้นเลขบัตรด้วยตัวเลข 4–13 หลัก ใส่ขีดหรือช่องว่างได้'};
  if(mode!=='cid' && mode!=='house' && compact.length<2)return {rows:[],ready:false,message:'กรุณาพิมพ์อย่างน้อย 2 ตัวอักษร หรือเลือกค้นบ้านเลขที่'};
  if(mode==='auto' && digits.length>13)return {rows:[],ready:false,message:'เลขบัตรต้องไม่เกิน 13 หลัก'};
  const nameMatch=p=>{
    const name=normalizeSearch(p.name).replace(/\s+/g,'');
    return q.split(/\s+/).every(part=>name.includes(part));
  };
  const cidMatch=p=>{
    if(!digits || digits.length<4 || digits.length>13)return false;
    const cid=normalizeSearch(p.cid).replace(/[\s-]/g,'');
    return /^\d{13}$/.test(cid) && (digits.length===13?cid===digits:cid.includes(digits));
  };
  const houseMatch=p=>normalizeSearch(p.house).replace(/\s+/g,'').includes(compact);
  const rows=people.filter(p=>mode==='name'?nameMatch(p):mode==='cid'?cidMatch(p):mode==='house'?houseMatch(p):numeric?(cidMatch(p)||(digits.length<13&&houseMatch(p))):nameMatch(p)||(/^[\d/]+$/.test(compact)&&houseMatch(p)));
  return {rows,ready:true,message:''};
}
export function maskedScreeningCid(cid) {
  const digits=normalizeSearch(cid).replace(/[\s-]/g,'');
  return /^\d{13}$/.test(digits)?`X-XXXX-XXXX-${digits.slice(-4)}`:'ไม่ระบุเลขบัตรที่ครบ 13 หลัก';
}
