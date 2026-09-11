export const screeningFields = {
  HEP: ['hep_screen','hep_date'], FOBT: ['fobt_screen','fobt_date'],
  HPV: ['hpv_screen','hpv_date'], CHILD: ['child_dev','child_date'],
};
export const screeningToday = () => new Intl.DateTimeFormat('en-CA', {
  timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit',
}).format(new Date());
export function screeningPayload(type, result, date, today=screeningToday()) {
  if (!screeningFields[type]) throw new Error('กรุณาเลือกประเภทคัดกรอง');
  if (!(type==='CHILD'?['สมวัย','ไม่สมวัย']:['ปกติ','ผิดปกติ']).includes(result)) throw new Error('กรุณาเลือกผลการคัดกรองที่ถูกต้อง');
  const parsed=new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10)!==date) throw new Error('กรุณาระบุวันที่คัดกรองที่ถูกต้อง');
  if (date>today) throw new Error('วันที่คัดกรองต้องไม่เกินวันนี้');
  const [valueField,dateField]=screeningFields[type];
  return {[valueField]:result,[dateField]:date,updated_at:new Date().toISOString()};
}
// One in-flight save per form, including the read-back verification.
export function createScreeningSaver(client) {
  let busy=false;
  return async ({personId,type,result,date}) => {
    if (busy) return null;
    busy=true;
    try {
      if (!personId) throw new Error('ไม่พบผู้รับการคัดกรอง');
      const payload=screeningPayload(type,result,date);
      const [valueField,dateField]=screeningFields[type];
      const {data:changed,error}=await client.from('population').update(payload).eq('person_id',personId).select('person_id');
      if(error) throw new Error('บันทึกไม่สำเร็จ กรุณาลองใหม่ ข้อมูลที่กรอกยังอยู่');
      if(!Array.isArray(changed)||changed.length!==1) throw new Error('ไม่พบรายการที่บันทึก หรือไม่มีสิทธิ์แก้ไข');
      const {data:row,error:readError}=await client.from('population').select(`person_id,${valueField},${dateField}`).eq('person_id',personId).single();
      if(readError || !row || row[valueField]!==result || row[dateField]!==date) throw new Error('ส่งข้อมูลแล้ว แต่ยังยืนยันผลไม่ได้ กรุณาเปิดตรวจสอบอีกครั้ง ข้อมูลที่กรอกยังอยู่');
      return row;
    } finally { busy=false; }
  };
}
