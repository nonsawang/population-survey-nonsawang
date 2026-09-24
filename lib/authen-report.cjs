// Shared by the server parser and LAN matcher. Never infer dates or missing identifiers.
const {createHash}=require('node:crypto');
const text=v=>String(v??'').trim();
function date(v){
 const m=text(v).match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+\d{2}:\d{2}:\d{2})?$/);
 if(!m)return null;let y=Number(m[3]);if(y>=2400)y-=543;
 const iso=`${y}-${m[2]}-${m[1]}`;
 return y>=1900&&y<=2200&&Number.isFinite(Date.parse(iso))&&new Date(iso).toISOString().slice(0,10)===iso?iso:null;
}
function cidValid(v){if(!/^\d{13}$/.test(v))return false;let sum=0;for(let i=0;i<12;i++)sum+=Number(v[i])*(13-i);return (11-sum%11)%10===Number(v[12]);}
const columns={hcode:'รหัสหน่วย',cid:'เลขบัตร',name:'ชื่อ-สกุล',code:'CLAIM CODE',serviceCode:'รหัสบริการ',serviceName:'บริการ',hn:'HN CODE',serviceDate:'วันที่เข้ารับบริการ',recordedAt:'วันที่บันทึก Authen Code',status:'สถานะใช้งาน',cancelNote:'หมายเหตุการยกเลิก'};
function normalize(matrix){
 if(!Array.isArray(matrix)||matrix.length<2||matrix.length>501)throw Error('REPORT_ROW_LIMIT');
 const headers=matrix[0].map(text),indexes={};
 for(const [k,label] of Object.entries(columns)){if(headers.filter(h=>h===label).length!==1)throw Error('REPORT_HEADERS');indexes[k]=headers.indexOf(label);}
 const rows=[];
 for(let i=1;i<matrix.length;i++){
  if(matrix[i].every(v=>!text(v)))continue;
  const r={row:i+1};for(const k of Object.keys(columns)){r[k]=text(matrix[i][indexes[k]]);if(r[k].length>250)throw Error('REPORT_CELL_LIMIT');}
  r.serviceDate=date(r.serviceDate);r.issues=[];
  if(!cidValid(r.cid))r.issues.push('invalid_cid');
  if(r.hcode!=='05080')r.issues.push('other_provider');
  if(!r.serviceDate)r.issues.push('invalid_date');
  if(!/^[A-Za-z0-9-]{1,50}$/.test(r.code))r.issues.push('invalid_code');
  if(!/^[A-Z0-9]{3,30}$/.test(r.serviceCode))r.issues.push('invalid_service');
  if(r.cancelNote&&r.cancelNote!=='-'||/ยกเลิก|cancel|void|inactive/i.test(r.status))r.issues.push('cancelled');
  if(r.status&&!['ใช้งาน','ใช้งานอยู่','Y','ACTIVE','Active'].includes(r.status))r.issues.push('unknown_status');
  r.statusUnconfirmed=!r.status;
  rows.push(r);
 }
 if(!rows.length)throw Error('REPORT_EMPTY');
 const codes=new Map();for(const r of rows)codes.set(r.code,(codes.get(r.code)||0)+1);
 for(const r of rows)if(codes.get(r.code)>1)r.issues.push('duplicate_code');
 return rows;
}
function matchRows(rows,visits){
 const results=rows.map(r=>{
  const base={row:r.row,status:'blocked',reasons:[...r.issues],statusUnconfirmed:r.statusUnconfirmed};
  if(r.issues.length)return base;
  const matches=visits.filter(v=>text(v.cid)===r.cid&&v.service_date===r.serviceDate);
  if(matches.length!==1)return {...base,status:matches.length?'ambiguous':'unmatched',reasons:[matches.length?'multiple_visits':'no_visit']};
  const v=matches[0],reasons=[];
  if(r.hn&&r.hn!==text(v.hn))reasons.push('hn_conflict');
  // Names are a second identity check. Only whitespace is normalized, never fuzzy matching.
  if(r.name.replace(/\s/g,'')!==text(v.name).replace(/\s/g,''))reasons.push('name_conflict');
  if(v.authCodes.length>1)reasons.push('multiple_insurance_codes');
  if(v.authCodes.some(c=>c!==r.code))reasons.push('existing_code_conflict');
  if(v.codeElsewhere?.includes(r.code))reasons.push('code_used_elsewhere');
  const snapshot={vn:v.vn,hn:v.hn,name:v.name,serviceDate:v.service_date,existingCode:v.authCodes[0]||'',serviceCode:r.serviceCode};
  return {...base,...snapshot,status:reasons.length?'blocked':v.authCodes.includes(r.code)?'already_present':'matched',reasons,
   fingerprint:createHash('sha256').update(JSON.stringify([r,snapshot])).digest('hex')};
 });
 const counts=new Map();for(const r of results)if(r.vn)counts.set(r.vn,(counts.get(r.vn)||0)+1);
 return results.map(r=>r.vn&&counts.get(r.vn)>1?{...r,status:'ambiguous',reasons:[...r.reasons,'multiple_report_rows_for_visit']}:r);
}
module.exports={normalize,matchRows,date,cidValid};
