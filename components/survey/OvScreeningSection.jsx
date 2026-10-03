'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { writeLog } from '@/lib/logger';
import { swal, showLoading, closeLoading } from '@/lib/survey-feedback';
import { surveyErrorMessage } from '@/lib/survey-errors.mjs';
import ScreeningSection from './ScreeningSection';
export default function OvScreeningSection({person, user, onRefresh, saving, setSaving}) {
  // 🎯 State ของคัดกรองพยาธิใบไม้ตับ
  const [ovAnswers, setOvAnswers] = useState({ q1: '', q2: '', q3: '', q4: '', q5: '' });
  const [ovOpen, setOvOpen] = useState(true);

  // 🎯 เพิ่ม useEffect เพื่อดึงข้อมูลเดิมมาแสดงเสมอเมื่อเปิดบ้าน
  useEffect(() => {
    const newOv = person.ovAnswers || { q1: '', q2: '', q3: '', q4: '', q5: '' };
    setOvAnswers(newOv);
    const hasData = !!newOv.q1;
    setOvOpen(!hasData); // ถ้ามีข้อมูลแล้วให้พับกล่อง (false) ถ้าไม่มีให้เปิด (true)
  }, [JSON.stringify(person.ovAnswers)]);

  // เช็คว่าเคยมีข้อมูลถูกกรอกไว้ไหม
  const hasOvData = !!ovAnswers.q1;

  // ฟังก์ชันเช็คความเสี่ยง (ตอบ "เคย" หรือ "พบ" ในข้อ 1-3 ถือว่าเสี่ยงทันที)
  const checkOvRisk = () => {
    const isQ1Risk = ovAnswers.q1 === 'ตรวจแล้วพบไข่พยาธิ';
    const isQ2Risk = typeof ovAnswers.q2 === 'string' && ovAnswers.q2.includes('เคย') && ovAnswers.q2 !== 'ไม่เคย';
    const isQ3Risk = ovAnswers.q3 === 'เคย';
    return isQ1Risk || isQ2Risk || isQ3Risk;
  };
  const isAtRisk = checkOvRisk();

  const saveOvScreening = async (ovData) => {
    setSaving(true);
    showLoading('กำลังบันทึกข้อมูลคัดกรอง...');
    
    const { error } = await supabase.from('population').update({
      ov_q1: ovData.q1, ov_q2: ovData.q2, ov_q3: ovData.q3, ov_q4: ovData.q4, ov_q5: ovData.q5,
      ov_date: new Date().toISOString(), updated_at: new Date().toISOString()
    }).eq('person_id', person.personId);

    closeLoading();
    setSaving(false);

    if (!error) {
      const riskText = isAtRisk ? 'มีความเสี่ยง' : 'ไม่มีความเสี่ยง';
      await writeLog(user?.userId, user?.username, 'SCREENING_OV', `คัดกรองพยาธิฯ | Q5: ${ovData.q5} | ประเมิน: ${riskText}`, person.personId);
      
      swal({ icon: 'success', title: 'บันทึกสำเร็จ!', text: 'บันทึกข้อมูลคัดกรองเรียบร้อย', timer: 2000, showConfirmButton: false }).then(() => {
        setOvOpen(false); 
        onRefresh();
      });
    } else {
      swal({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: surveyErrorMessage(error) });
    }
  };

  return <ScreeningSection title="คัดกรองพยาธิใบไม้ตับ (ปี 69)" icon="fa-microscope" titleClassName="text-danger" open={ovOpen} onToggle={() => setOvOpen(!ovOpen)} hasData={hasOvData} badge={hasOvData && <span className={`badge ms-2 ${isAtRisk ? "bg-danger" : "bg-success"}`}>{isAtRisk ? "มีความเสี่ยง" : "ไม่มีความเสี่ยง"}</span>} disabled={saving}>
              <div className="mt-3">
                <div className="mb-2">
                  <label className="small text-muted mb-1">1. คุณเคยตรวจพบพยาธิใบไม้ตับหรือไม่?</label>
                  <select className="form-select form-select-sm" value={ovAnswers.q1} onChange={e => setOvAnswers({ ...ovAnswers, q1: e.target.value })}>
                    <option value="">เลือก</option>
                    <option value="ไม่เคยตรวจ">ไม่เคยตรวจ</option>
                    <option value="ตรวจแต่ไม่พบ">ตรวจแต่ไม่พบ</option>
                    <option value="ตรวจแล้วพบไข่พยาธิ">ตรวจแล้วพบไข่พยาธิ</option>
                    <option value="จำไม่ได้">จำไม่ได้</option>
                  </select>
                </div>

                <div className="mb-2">
                  <label className="small text-muted mb-1">2. คุณเคยได้รับการรักษาด้วยยาฆ่าพยาธิใบไม้ตับหรือไม่?</label>
                  <select className="form-select form-select-sm" value={ovAnswers.q2} onChange={e => setOvAnswers({ ...ovAnswers, q2: e.target.value })}>
                    <option value="">เลือก</option>
                    {['ไม่เคย', 'เคย 1 ครั้ง', 'เคย 2 ครั้ง', 'เคย 3 ครั้ง', 'เคยมากกว่า 3 ครั้ง', 'จำไม่ได้'].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>

                <div className="mb-2">
                  <label className="small text-muted mb-1">3. คุณเคยรับประทานปลาน้ำจืดที่มีเกล็ดดิบๆสุกๆ หรือปลาร้าไม่ต้มสุก หรือไม่?</label>
                  <select className="form-select form-select-sm" value={ovAnswers.q3} onChange={e => setOvAnswers({ ...ovAnswers, q3: e.target.value })}>
                    <option value="">เลือก</option>
                    <option value="ไม่เคย">ไม่เคย</option>
                    <option value="เคย">เคย</option>
                  </select>
                </div>

                <div className="mb-2">
                  <label className="small text-muted mb-1">4. คุณได้รับการวินิจฉัยจากแพทย์ว่าเป็นโรคใดบ้างต่อไปนี้?</label>
                  <select className="form-select form-select-sm" value={ovAnswers.q4} onChange={e => setOvAnswers({ ...ovAnswers, q4: e.target.value })}>
                    <option value="">เลือก</option>
                    <option value="ไม่เป็น">ไม่เป็น</option>
                    <option value="ตับอักเสบ บี">ตับอักเสบ บี</option>
                    <option value="ตับอักเสบ ซี">ตับอักเสบ ซี</option>
                    <option value="เบาหวาน">เบาหวาน</option>
                    <option value="อื่นๆ">อื่นๆ</option>
                  </select>
                </div>

                <div className="mb-3">
                  <label className="small text-muted mb-1">5. ท่านต้องการตรวจหาพยาธิใบไม้ตับ ด้วยวิธีตรวจจากปัสสาวะ ด้วยชุดตรวจ OV-ATK หรือไม่?</label>
                  <select className="form-select form-select-sm" value={ovAnswers.q5} onChange={e => setOvAnswers({ ...ovAnswers, q5: e.target.value })}>
                    <option value="">เลือก</option>
                    <option value="ต้องการตรวจ">ต้องการตรวจ</option>
                    <option value="ไม่ต้องการตรวจ">ไม่ต้องการตรวจ</option>
                  </select>
                </div>

                <button onClick={() => saveOvScreening(ovAnswers)} className="btn btn-sm btn-danger w-100 rounded-pill fw-bold" disabled={saving}>
                  <i className="fa-solid fa-save me-1" /> บันทึกข้อมูลคัดกรอง
                </button>
              </div>

</ScreeningSection>;
}
