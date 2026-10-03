'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { writeLog } from '@/lib/logger';
import { swal, showLoading, closeLoading } from '@/lib/survey-feedback';
import { surveyErrorMessage } from '@/lib/survey-errors.mjs';
import ScreeningSection from './ScreeningSection';
export default function RiskScreeningSection({person, user, onRefresh, saving, setSaving}) {
  const [riskOpen, setRiskOpen] = useState(false);
  const [smokeStatus, setSmokeStatus] = useState(person.smokingStatus || '');
  const [alcoStatus, setAlcoStatus] = useState(person.alcoholStatus || '');
  const [fagerAnswers, setFagerAnswers] = useState(person.fagerstromAnswers || {});
  const [assistAnswers, setAssistAnswers] = useState(person.assistAnswers || {});
  const doSaveRisk = async () => {
    if (!smokeStatus && !alcoStatus) { swal({ icon: 'warning', title: 'กรุณาเลือกสถานะบุหรี่หรือสุรา', timer: 1500, showConfirmButton: false }); return; }
    setSaving(true);
    showLoading('กำลังบันทึก...');

    const fScore = smokeStatus === 'สูบ' ? ['f1', 'f2', 'f3', 'f4', 'f5', 'f6'].reduce((s, k) => s + (parseInt(fagerAnswers[k]) || 0), 0) : null;
    const aScore = alcoStatus === 'ดื่ม' ? ['a1', 'a2', 'a3', 'a4', 'a5'].reduce((s, k) => s + (parseInt(assistAnswers[k]) || 0), 0) : null;

    const { error } = await supabase.from('population').update({
      smoking_status: smokeStatus || null, alcohol_status: alcoStatus || null,
      fagerstrom_score: fScore, fagerstrom_answers: smokeStatus === 'สูบ' ? JSON.stringify(fagerAnswers) : null,
      assist_score: aScore, assist_answers: alcoStatus === 'ดื่ม' ? JSON.stringify(assistAnswers) : null,
      updated_at: new Date().toISOString()
    }).eq('person_id', person.personId);

    closeLoading(); setSaving(false);

    if (!error) {
      await writeLog(user?.userId, user?.username, 'RISK_BEHAVIOR', `บุหรี่: ${smokeStatus || 'ไม่ระบุ'} | สุรา: ${alcoStatus || 'ไม่ระบุ'}`, person.personId);
      swal({ icon: 'success', title: 'บันทึกสำเร็จ!', timer: 2000, showConfirmButton: false }).then(() => {
        setRiskOpen(false); 
        onRefresh();
      });
    } else swal({ icon: 'error', title: 'ผิดพลาด', text: surveyErrorMessage(error) });
  };

  const fT = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6'].reduce((s, k) => s + (parseInt(fagerAnswers[k]) || 0), 0);
  const aT = ['a1', 'a2', 'a3', 'a4', 'a5'].reduce((s, k) => s + (parseInt(assistAnswers[k]) || 0), 0);
  return <ScreeningSection title="คัดกรองบุหรี่/สุรา" icon="fa-triangle-exclamation text-warning" open={riskOpen} onToggle={() => setRiskOpen(!riskOpen)} hasData={!!(person.smokingStatus || person.alcoholStatus)} disabled={saving}>
            <div className="mt-2"><label className="small fw-bold text-muted mb-1"><i className="fa-solid fa-smoking text-secondary me-1" />การสูบบุหรี่</label>
              <select className="form-select form-select-sm" value={smokeStatus} onChange={e => setSmokeStatus(e.target.value)}>
                <option value="">เลือก</option><option value="ไม่สูบ ไม่เคยสูบบุหรี่">ไม่สูบ ไม่เคยสูบบุหรี่</option><option value="ไม่สูบ เคยสูบบุหรี่แต่เลิกแล้ว">เคยสูบแต่เลิกแล้ว</option><option value="สูบ">สูบ</option>
              </select>
            </div>
            {smokeStatus === 'สูบ' && <div className="sub-test"><div className="d-flex justify-content-between align-items-center mb-2"><span className="text-primary fw-bold" style={{ fontSize: '.78rem' }}>Fagerstrom</span><span className={`score-badge ${fT <= 3 ? 'score-low' : fT <= 6 ? 'score-med' : 'score-high'}`}>คะแนน {fT}</span></div>
              {[{ k: 'f1', q: 'สูบวันละกี่มวน?', o: [['0', '≤10'], ['1', '11-20'], ['2', '21-30'], ['3', '≥31']] }, { k: 'f2', q: 'มวนแรกหลังตื่น?', o: [['3', 'ภายใน 5 นาที'], ['2', '6-30 นาที'], ['1', '31-60 นาที'], ['0', '>60 นาที']] }, { k: 'f3', q: 'สูบจัดชั่วโมงแรก?', o: [['1', 'ใช่'], ['0', 'ไม่ใช่']] }, { k: 'f4', q: 'มวนที่ไม่อยากเลิก?', o: [['1', 'มวนแรกเช้า'], ['0', 'มวนอื่น']] }, { k: 'f5', q: 'ลำบากในเขตปลอดบุหรี่?', o: [['1', 'ลำบาก'], ['0', 'ไม่ลำบาก']] }, { k: 'f6', q: 'สูบแม้เจ็บป่วย?', o: [['1', 'ใช่'], ['0', 'ไม่ใช่']] }].map(({ k, q, o }) => <div key={k}><label>{q}</label><select className="form-select form-select-sm mb-2" value={fagerAnswers[k] || ''} onChange={e => setFagerAnswers({ ...fagerAnswers, [k]: e.target.value })}><option value="">เลือก</option>{o.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>)}
            </div>}
            <div className="mt-2"><label className="small fw-bold text-muted mb-1"><i className="fa-solid fa-wine-bottle text-secondary me-1" />การดื่มสุรา</label>
              <select className="form-select form-select-sm" value={alcoStatus} onChange={e => setAlcoStatus(e.target.value)}>
                <option value="">เลือก</option><option value="ไม่ดื่ม/ตลอดชีวิตไม่เคยดื่มเลย">ไม่ดื่ม/ไม่เคยดื่ม</option><option value="เคยดื่มแต่หยุดแล้ว 1 ปีขึ้นไป">เคยดื่มแต่หยุดแล้ว</option><option value="ดื่ม">ดื่ม</option>
              </select>
            </div>
            {alcoStatus === 'ดื่ม' && <div className="sub-test"><div className="d-flex justify-content-between align-items-center mb-2"><span className="text-success fw-bold" style={{ fontSize: '.78rem' }}>ASSIST</span><span className={`score-badge ${aT <= 10 ? 'score-low' : aT <= 26 ? 'score-med' : 'score-high'}`}>คะแนน {aT}</span></div>
              {[{ k: 'a1', q: 'ดื่มบ่อยแค่ไหน?', o: [['6', 'เกือบทุกวัน'], ['4', 'ทุกสัปดาห์'], ['3', 'ทุกเดือน'], ['2', 'ครั้งสองครั้ง'], ['0', 'ไม่เคย']] }, { k: 'a2', q: 'อยากดื่มมากๆ?', o: [['6', 'เกือบทุกวัน'], ['5', 'ทุกสัปดาห์'], ['4', 'ทุกเดือน'], ['3', 'ครั้งสองครั้ง'], ['0', 'ไม่เคย']] }, { k: 'a3', q: 'เกิดปัญหา?', o: [['7', 'เกือบทุกวัน'], ['6', 'ทุกสัปดาห์'], ['5', 'ทุกเดือน'], ['4', 'ครั้งสองครั้ง'], ['0', 'ไม่เคย']] }, { k: 'a4', q: 'เสียงาน/การเรียน?', o: [['8', 'เกือบทุกวัน'], ['7', 'ทุกสัปดาห์'], ['6', 'ทุกเดือน'], ['5', 'ครั้งสองครั้ง'], ['0', 'ไม่เคย']] }, { k: 'a5', q: 'คนอื่นตักเตือน?', o: [['3', 'เคย (ก่อน 3 เดือน)'], ['6', 'เคย (ใน 3 เดือน)'], ['0', 'ไม่เคย']] }].map(({ k, q, o }) => <div key={k}><label>{q}</label><select className="form-select form-select-sm mb-2" value={assistAnswers[k] || ''} onChange={e => setAssistAnswers({ ...assistAnswers, [k]: e.target.value })}><option value="">เลือก</option>{o.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>)}
            </div>}
            <button onClick={doSaveRisk} className="btn btn-sm btn-primary w-100 rounded-pill mt-3 fw-bold" disabled={saving}><i className="fa-solid fa-save me-1" /> บันทึกคัดกรองบุหรี่/สุรา</button>

</ScreeningSection>;
}
