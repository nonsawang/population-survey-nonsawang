'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { calculateAge, sanitizeInput, validateCID, VALID_MOOS, CHRONIC_LIST } from '@/lib/utils';
import TopBar from '@/components/TopBar';
import { writeLog } from '@/lib/logger';
import { populationStatus, statusUpdate, RESIDENCY_TYPES, DISCHARGE_TYPES } from '@/lib/population-status';

import { readCard } from '@/lib/eform-card.mjs';
import PersonCard from '@/components/survey/PersonCard';
import ModalShell from '@/components/survey/ModalShell';
import { getSwal, swal, Toast, showLoading, closeLoading } from '@/lib/survey-feedback';
import { surveyErrorMessage } from '@/lib/survey-errors.mjs';

export default function SurveyPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [moo, setMoo] = useState('');
  const [house, setHouse] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    if (results !== null) document.getElementById('survey-house-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [results]);
  const [showGuide, setShowGuide] = useState(false);
  const [vhvData, setVhvData] = useState({});
  const [moveTarget, setMoveTarget] = useState(null);
  const [moveMoo, setMoveMoo] = useState('');
  const [moveHouse, setMoveHouse] = useState('');
  // ✅ VHV change modal
  const [showVhvModal, setShowVhvModal] = useState(false);
  const [selectedVhv, setSelectedVhv] = useState('');
  const [vhvHouse, setVhvHouse] = useState('');
  const [vhvMoo, setVhvMoo] = useState('');
  // ✅ Add person modal
  const cardLock = useRef(false);
  const [readingCard, setReadingCard] = useState(false);
  const [cardNotice, setCardNotice] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ cid:'', title:'นาย', fname:'', lname:'', birth_day:'', birth_month:'', birth_year:'', relation:'ผู้อาศัย', type:'3', chronic:'ปกติ (ไม่มีโรค)', chronicOther:'', vhv:'' });

  // 🟢 เพิ่ม State สำหรับสถานะปุ่มดึงพิกัด GPS
  const [savingGps, setSavingGps] = useState(false);

  // ✅ จำกัดหมู่สำหรับ vhv
  const allowedMoos = user?.role === 'vhv' ? String(user.moo || '').split(',').map(m => m.trim()).filter(Boolean) : null;
  const visibleMoos = allowedMoos ? VALID_MOOS.filter(m => allowedMoos.includes(m)) : VALID_MOOS;

  useEffect(() => { if (!loading && !user) router.push('/login'); }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      supabase.from('vhv_data').select('name,moo').limit(1000).then(({ data }) => {
        const map = {};
        (data || []).forEach(r => { const m = String(r.moo).trim(); if (!map[m]) map[m] = []; map[m].push(String(r.name).trim()); });
        Object.keys(map).forEach(m => map[m].sort());
        setVhvData(map);
      });
      // ✅ Auto-select first moo for vhv role
      if (allowedMoos && allowedMoos[0]) setMoo(allowedMoos[0]);
    }
  }, [user]);

 const searchData = async (targetMoo = moo, targetHouse = house) => {
    if (!targetMoo || !targetHouse.trim()) { swal({icon:'warning',title:'กรุณาระบุข้อมูลให้ครบ'}); return; }
    if (allowedMoos && !allowedMoos.includes(targetMoo)) { swal({icon:'error',title:'ไม่มีสิทธิ์เข้าถึงหมู่ ' + targetMoo}); return; }
    setMoo(targetMoo); setHouse(targetHouse.trim()); setResults(null);
    setSearching(true); showLoading('กำลังค้นหา...');

    const { data, error } = await supabase.from('population').select('*').eq('house', targetHouse.trim()).eq('moo', targetMoo).order('fname');

    closeLoading(); setSearching(false);
    if (error) { swal({icon:'error',title:'ค้นหาไม่สำเร็จ',text:surveyErrorMessage(error)}); return; }

    const mapped = (data || []).map(r => {
      let fa = {}; try { if (r.fagerstrom_answers) fa = JSON.parse(r.fagerstrom_answers); } catch(e) {}
      let aa = {}; try { if (r.assist_answers) aa = JSON.parse(r.assist_answers); } catch(e) {}

      // 🎯 สิ่งที่เพิ่มเข้ามา: ดึงข้อมูล OV จากฐานข้อมูล (ถ้าเป็น null ให้แปลงเป็นค่าว่าง)
      const ov = {
        q1: r.ov_q1 || '',
        q2: r.ov_q2 || '',
        q3: r.ov_q3 || '',
        q4: r.ov_q4 || '',
        q5: r.ov_q5 || ''
      };

      return {
        personId: r.person_id,
        cid: r.cid||'-',
        fullname: (r.title||'')+(r.fname||'')+' '+(r.lname||''),
        age: calculateAge(r.birth_date),
        relation: r.relation||'ไม่ระบุ',
        residencyType: populationStatus(r).residencyType,
        dischargeCode: populationStatus(r).dischargeCode,
        needsStatusReview: populationStatus(r).needsReview,
        legacyDischarge: populationStatus(r).legacyDischarge,
        statusSchemaReady: Object.prototype.hasOwnProperty.call(r, 'status_model_version'),
        chronic: r.chronic||'-',
        vhv: r.vhv||'ไม่ระบุ',
        smokingStatus: r.smoking_status||'',
        alcoholStatus: r.alcohol_status||'',
        fagerstromScore: r.fagerstrom_score,
        assistScore: r.assist_score,
        fagerstromAnswers: fa,
        assistAnswers: aa,
        // 🎯 สิ่งที่เพิ่มเข้ามา: ส่งข้อมูล OV ที่จัดแล้วเข้าไปใน prop ของ PersonCard
        ovAnswers: ov
      };
    });
    setResults(mapped);
    setShowGuide(false);
  };
  // ✅ Refresh เงียบๆ — ไม่แสดง Swal loading (ใช้หลังบันทึก Type)
const searchDataSilent = async () => {
    if (!moo || !house.trim()) return;
    const { data } = await supabase.from('population').select('*').eq('house', house.trim()).eq('moo', moo).order('fname');

    const mapped = (data || []).map(r => {
      let fa = {}; try { if (r.fagerstrom_answers) fa = JSON.parse(r.fagerstrom_answers); } catch(e) {}
      let aa = {}; try { if (r.assist_answers) aa = JSON.parse(r.assist_answers); } catch(e) {}

      // 🎯 เพิ่มดึงข้อมูล OV
      const ov = {
        q1: r.ov_q1 || '',
        q2: r.ov_q2 || '',
        q3: r.ov_q3 || '',
        q4: r.ov_q4 || '',
        q5: r.ov_q5 || ''
      };

      return {
        personId: r.person_id,
        cid: r.cid||'-',
        fullname: (r.title||'')+(r.fname||'')+' '+(r.lname||''),
        age: calculateAge(r.birth_date),
        relation: r.relation||'ไม่ระบุ',
        residencyType: populationStatus(r).residencyType,
        dischargeCode: populationStatus(r).dischargeCode,
        needsStatusReview: populationStatus(r).needsReview,
        legacyDischarge: populationStatus(r).legacyDischarge,
        chronic: r.chronic||'-',
        vhv: r.vhv||'ไม่ระบุ',
        smokingStatus: r.smoking_status||'',
        alcoholStatus: r.alcohol_status||'',
        fagerstromScore: r.fagerstrom_score,
        assistScore: r.assist_score,
        fagerstromAnswers: fa,
        assistAnswers: aa,
        ovAnswers: ov // 🎯 ส่งเข้าไปที่ PersonCard
      };
    });
    setResults(mapped);
  };

const handleSave = async (personId, newType, relation, chronic, dischargeCode) => {
    const { error } = await supabase
      .from('population')
      .update({
        ...statusUpdate(newType, dischargeCode),
        relation: sanitizeInput(relation),
        chronic: chronic || '-',
        updated_at: new Date().toISOString()
      })
      .eq('person_id', personId);

    if (error) {
      swal({icon:'error',title:'บันทึกไม่สำเร็จ',text:surveyErrorMessage(error)});
    } else {
      // 🎯 [เพิ่มใหม่] บันทึก Activity Log: UPDATE_STATUS
      const detailStr = `ประเภทอยู่อาศัย->${newType || 'ไม่ระบุ'} | สถานะจำหน่าย->${dischargeCode} | ${relation}`;
      await writeLog(user?.userId, user?.username, 'UPDATE_STATUS', detailStr, personId);
    }

    await searchDataSilent();
  };

  // ✅ เปลี่ยน อสม. — เปิด modal เลือกจาก vhv_data
  const openVhvModal = () => {
    const list = vhvData[moo] || [];
    if (list.length === 0) { swal({icon:'warning',title:'ไม่พบรายชื่อ อสม.',text:'ไม่พบ อสม. ในหมู่ ' + moo}); return; }
    // ✅ จับค่า house/moo ตอนเปิด modal — ไม่เปลี่ยนตามช่องค้นหา
    setVhvHouse(house.trim());
    setVhvMoo(moo);
    setSelectedVhv(results?.[0]?.vhv || '');
    setShowVhvModal(true);
  };
const submitVhvChange = async () => {
    if (!selectedVhv) { swal({icon:'warning',title:'กรุณาเลือก อสม.'}); return; }
    showLoading('กำลังอัปเดต...');

    const { error } = await supabase.from('population').update({
      vhv: selectedVhv,
      updated_at: new Date().toISOString()
    }).eq('house', vhvHouse).eq('moo', vhvMoo);

    closeLoading(); setShowVhvModal(false);

    if (!error) {
      // 🎯 [เพิ่มใหม่] บันทึก Activity Log: CHANGE_VHV
      const detailStr = `เปลี่ยน อสม. บ้านเลขที่ ${vhvHouse} ม.${vhvMoo} เป็น ${selectedVhv}`;
      await writeLog(user?.userId, user?.username, 'CHANGE_VHV', detailStr, `${vhvMoo}-${vhvHouse}`);

      Toast('success','อัปเดต อสม. เรียบร้อย');
      searchDataSilent();
    } else {
      swal({icon:'error',title:'ไม่สำเร็จ',text:surveyErrorMessage(error)});
    }
  };

  // ✅ ย้ายบ้าน
  const handleMove = async () => {
    if (!moveMoo || !moveHouse.trim()) { swal({icon:'warning',title:'ข้อมูลไม่ครบ',text:'กรุณาระบุหมู่และบ้านเลขที่ใหม่'}); return; }
    showLoading('กำลังย้าย...');
    const { data: targetRows } = await supabase.from('population').select('vhv').eq('house', moveHouse.trim()).eq('moo', moveMoo).limit(1);
    const newVhv = (targetRows && targetRows[0]?.vhv) || 'ไม่ระบุ';

    const { error } = await supabase.from('population').update({
      house: moveHouse.trim(),
      moo: moveMoo,
      vhv: newVhv,
      updated_at: new Date().toISOString()
    }).eq('person_id', moveTarget.personId);

    closeLoading();

    if (!error) {
      // 🎯 [เพิ่มใหม่] บันทึก Activity Log: MOVE_HOUSE
      const detailStr = `ย้ายไปบ้านเลขที่ ${moveHouse.trim()} ม.${moveMoo}`;
      await writeLog(user?.userId, user?.username, 'MOVE_HOUSE', detailStr, moveTarget.personId);

      swal({icon:'success',title:'ย้ายที่อยู่เรียบร้อย',showConfirmButton:false,timer:1500}).then(() => {
        setMoveTarget(null);
        searchDataSilent();
      });
    } else {
      setMoveTarget(null);
      swal({icon:'error',title:'ย้ายไม่สำเร็จ',text:surveyErrorMessage(error)});
    }
  };

  // 🟢 ฟังก์ชันดึงพิกัด GPS จากมือถือและบันทึกลงฐานข้อมูล Supabase
  const handleSaveGPS = () => {
    if (!navigator.geolocation) {
      swal({ icon: 'error', title: 'ไม่รองรับ GPS', text: 'เบราว์เซอร์หรือมือถือของคุณไม่รองรับการดึงพิกัด' });
      return;
    }

    setSavingGps(true);
    showLoading('กำลังค้นหาสัญญาณ GPS...');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        // อัปเดตพิกัดให้ "ทุกคน" ที่อยู่ในหมู่และบ้านเลขที่นี้พร้อมกัน (คอลัมน์ house และ moo)
        const { error } = await supabase
          .from('population')
          .update({
            latitude: latitude,
            longitude: longitude,
            updated_at: new Date().toISOString()
          })
          .eq('house', house.trim())
          .eq('moo', moo);

        closeLoading();
        setSavingGps(false);

        if (error) {
          swal({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: surveyErrorMessage(error) });
        } else {
          swal({
            icon: 'success',
            title: 'พิกัดถูกบันทึกแล้ว!',
            text: `Lat: ${latitude.toFixed(5)}, Lng: ${longitude.toFixed(5)}`,
            timer: 2500,
            showConfirmButton: false
          });
        }
      },
      (error) => {
        closeLoading();
        setSavingGps(false);
        let msg = 'เกิดข้อผิดพลาดในการดึงพิกัด';
        if (error.code === 1) msg = 'คุณไม่อนุญาตให้เข้าถึงตำแหน่ง (กรุณาเปิด GPS และอนุญาตให้เว็บเข้าถึง)';
        if (error.code === 2) msg = 'ไม่สามารถระบุตำแหน่งได้ (อาจอยู่ในที่อับสัญญาณ)';
        if (error.code === 3) msg = 'หมดเวลาเชื่อมต่อ GPS';
        swal({ icon: 'error', title: 'ดึงพิกัดไม่สำเร็จ', text: msg });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // ✅ เพิ่มผู้อาศัยใหม่
  const openAddModal = (h, m, vhvName) => {
    setAddForm({ cid:'', title:'นาย', fname:'', lname:'', birth_day:'', birth_month:'', birth_year:'', relation:'ผู้อาศัย', type:'3', chronic:'ปกติ (ไม่มีโรค)', chronicOther:'', vhv: vhvName || '' });
    setShowAddModal(true);
  };
  const submitNewPerson = async () => {
    const f = addForm;
    if (!f.fname?.trim()) { swal({icon:'warning',title:'กรุณากรอกชื่อจริง'}); return; }
    if (!f.lname?.trim()) { swal({icon:'warning',title:'กรุณากรอกนามสกุล'}); return; }
    if (!f.vhv) { swal({icon:'warning',title:'กรุณาเลือก อสม.'}); return; }

    // CID validation
    let cleanCid = null;
    if (f.cid && f.cid.trim() && f.cid.trim() !== '-') {
      const cidResult = validateCID(f.cid);
      if (!cidResult.valid) { swal({icon:'error',title:'เลขบัตรประชาชนไม่ถูกต้อง',text:'ตรวจสอบ 13 หลักและ checksum'}); return; }
      cleanCid = cidResult.clean;
    }

    // Build birth ISO
    let birthISO = null;
    if (f.birth_day && f.birth_month && f.birth_year) {
      const y = parseInt(f.birth_year) - 543;
      birthISO = `${y}-${f.birth_month}-${f.birth_day}`;
    }

    // Chronic
    let chronicVal = f.chronic === '__OTHER__' ? (f.chronicOther?.trim() || '-') : f.chronic;

    if (readingCard) return;
    if (cleanCid && !f.existingPersonId) {
      const { data: duplicates, error: duplicateError } = await supabase.from('population').select('person_id').eq('cid', cleanCid).limit(1);
      if (duplicateError) { swal({icon:'error',title:'ตรวจรายชื่อเดิมไม่สำเร็จ',text:surveyErrorMessage(duplicateError)}); return; }
      if (duplicates?.length) { swal({icon:'warning',title:'มีรายชื่อนี้แล้ว',text:'กรุณาค้นหาข้อมูลเดิมก่อน เพื่อไม่ให้เกิดรายชื่อซ้ำ'}); return; }
    }
    const existingId = f.existingPersonId || null;
    const recordId = existingId || ('P-' + Date.now());
    const isUpdate = !!existingId;
    if (existingId) {
      const { data: current, error: lookupError } = await supabase.from('population').select('*').eq('person_id', existingId).single();
      if (lookupError || !current || !populationStatus(current).active) { swal({ icon:'warning', title:'กรุณาตรวจสถานะบุคคลเดิมก่อนย้ายเข้า', text:'ต้องตรวจสอบสถานะจำหน่ายของบุคคลเดิมในหน้าบ้านเดิมก่อน' }); return; }
    }

    showLoading(isUpdate ? 'กำลังย้ายมาบ้านนี้...' : 'กำลังบันทึก...');
    const { error } = await supabase.from('population').upsert({
      person_id: recordId, cid: cleanCid, title: sanitizeInput(f.title) || 'นาย',
      fname: sanitizeInput(f.fname), lname: sanitizeInput(f.lname || ''),
      birth_date: birthISO, house: house.trim(), moo, relation: sanitizeInput(f.relation) || 'ผู้อาศัย',
      ...statusUpdate(f.type || '3', '9'), chronic: chronicVal || '-', vhv: sanitizeInput(f.vhv),
      updated_at: new Date().toISOString(), status: 'Active'
    });

    closeLoading();
    if (!error) setShowAddModal(false);

    if (!error) {
      // 🎯 [เพิ่มใหม่] บันทึก Activity Log: ADD_PERSON
      const actionType = isUpdate ? 'MOVE_IN' : 'ADD_PERSON';
      const detailStr = isUpdate ? `ย้าย ${f.fname} เข้าบ้านเลขที่ ${house.trim()} ม.${moo}` : `เพิ่มผู้อาศัยใหม่ (${f.fname}) บ้านเลขที่ ${house.trim()} ม.${moo}`;
      await writeLog(user?.userId, user?.username, actionType, detailStr, recordId);

      const msg = isUpdate ? 'ย้ายมาบ้านนี้เรียบร้อย' : 'เพิ่มผู้อาศัยใหม่เรียบร้อย';
      swal({icon:'success',title:'สำเร็จ!',text:msg,showConfirmButton:false,timer:1500}).then(() => searchDataSilent());
    } else swal({icon:'error',title:'ไม่สำเร็จ',text:surveyErrorMessage(error)});
  };
  const handleReadCard = async () => {
    if (cardLock.current) return;
    cardLock.current = true; setReadingCard(true); setCardNotice('กำลังอ่านบัตร…');
    try {
      let card;
      try { card = await readCard(); }
      catch (error) { setCardNotice(error instanceof SyntaxError ? 'ข้อมูลจากเครื่องอ่านไม่สมบูรณ์ กรุณาลองใหม่' : error.message); return; }
      if (!validateCID(card.cid).valid) { setCardNotice('เลขบัตรที่อ่านได้ไม่ผ่านการตรวจสอบ กรุณาลองใหม่'); return; }
      const { data, error } = await supabase.from('population').select('person_id,house,moo').eq('cid', card.cid).limit(2);
      if (error) { setCardNotice(surveyErrorMessage(error)); return; }
      if (data?.length > 1) { setCardNotice('พบเลขบัตรซ้ำหลายรายการ กรุณาให้เจ้าหน้าที่ตรวจสอบก่อนบันทึก'); return; }
      if (data?.length === 1) {
        const found = data[0];
        if (!found.house || !found.moo || (allowedMoos && !allowedMoos.includes(String(found.moo)))) {
          setCardNotice('พบข้อมูลเดิม แต่ไม่สามารถเปิดบ้านนี้ได้ กรุณาติดต่อเจ้าหน้าที่'); return;
        }
        setShowAddModal(false); setMoo(String(found.moo)); setHouse(String(found.house));
        await searchData(String(found.moo), String(found.house));
        setCardNotice('พบรายชื่อเดิมแล้ว เปิดบ้านของบุคคลนี้ให้ตรวจสอบเรียบร้อย');
        return;
      }
      if (!moo || !house.trim()) {
        const notice='ไม่พบรายชื่อในข้อมูลที่บัญชีนี้เข้าถึง กรุณาเลือกหมู่และบ้านที่จะเพิ่ม แล้วกดอ่านบัตรอีกครั้ง หากบุคคลอาจอยู่ต่างพื้นที่ ให้เจ้าหน้าที่ตรวจทะเบียนก่อนเพิ่ม';
        setCardNotice(notice);
        await swal({icon:'info',title:'อ่านบัตรสำเร็จ แต่ไม่พบรายชื่อ',text:notice,confirmButtonText:'เลือกหมู่และบ้าน'});
        document.getElementById('survey-house-search')?.scrollIntoView({behavior:'smooth',block:'start'});
        return;
      }
      await swal({icon:'info',title:'อ่านบัตรสำเร็จ แต่ไม่พบรายชื่อ',text:'ไม่พบในข้อมูลที่บัญชีนี้เข้าถึง จะเปิดแบบฟอร์มพร้อมข้อมูลบัตร กรุณาตรวจสอบก่อนบันทึก',confirmButtonText:'ตรวจข้อมูลเพื่อเพิ่มบุคคล'});
      setAddForm({ ...card, existingPersonId: null, relation:'ผู้อาศัย', type:'3', chronic:'ปกติ (ไม่มีโรค)', chronicOther:'', vhv:'' });
      setShowAddModal(true);
      setCardNotice('เติมข้อมูลจากบัตรแล้ว กรุณาตรวจสอบบ้าน หมู่ และเลือก อสม. ก่อนบันทึก ที่อยู่บนบัตรอาจต่างจากที่อยู่จริง');
    } catch { setCardNotice('ค้นหาข้อมูลไม่สำเร็จ กรุณาลองใหม่ ยังไม่ได้บันทึกข้อมูล'); }
    finally { cardLock.current = false; setReadingCard(false); }
  };

  const searchCidAuto = async () => {
    const cid = (addForm.cid || '').replace(/\D/g, '');
    if (cid.length !== 13) { swal({icon:'warning',title:'เลขบัตรต้องครบ 13 หลัก'}); return; }
    showLoading('กำลังค้นหา...');
    const { data } = await supabase.from('population').select('*').eq('cid', cid);
    closeLoading();
    if (data && data.length > 0) {
      const r = data[0]; const bd = r.birth_date ? new Date(r.birth_date) : null;
      // ✅ เก็บ person_id เดิมไว้ — เมื่อบันทึกจะ update แทน insert ใหม่
      setAddForm(prev => ({...prev,
        existingPersonId: r.person_id,
        title: r.title||prev.title, fname: r.fname||'', lname: r.lname||'',
        birth_day: bd ? String(bd.getDate()).padStart(2,'0') : '',
        birth_month: bd ? String(bd.getMonth()+1).padStart(2,'0') : '',
        birth_year: bd ? String(bd.getFullYear()+543) : '',
        chronic: r.chronic||'ปกติ (ไม่มีโรค)'
      }));
      swal({icon:'success',title:'พบข้อมูลเก่า',text:`เคยอยู่บ้าน ${r.house} ม.${r.moo}\nกดบันทึกเพื่อย้ายมาบ้านนี้`,timer:3000,showConfirmButton:false});
    } else {
      // ✅ ไม่พบ → ล้าง existingPersonId
      setAddForm(prev => ({...prev, existingPersonId: null}));
      swal({icon:'info',title:'ไม่พบข้อมูล',text:'เป็นรายชื่อใหม่',timer:1500,showConfirmButton:false});
    }
  };

  const openedHouse = useRef(false);
  useEffect(() => {
    if (!user || openedHouse.current) return;
    openedHouse.current = true;
    const params = new URLSearchParams(window.location.search);
    const targetMoo = params.get('moo'), targetHouse = params.get('house');
    if (targetMoo && targetHouse && VALID_MOOS.map(String).includes(targetMoo) && targetHouse.length <= 100) {
      searchData(targetMoo, targetHouse);
    }
  }, [user]);

  if (loading) return <div className="text-center py-5"><span className="spinner-border text-primary" /></div>;
  if (!user) return null;

  return (
    <>
      <TopBar showAdmin />
      <div className="container survey-page py-4">
        <header className="survey-heading"><div><p className="survey-eyebrow">รพ.สต.บ้านโนนสว่าง</p><h1>ระบบสุขภาพโนนสว่าง</h1><p>สำรวจรายครัวเรือน • คัดกรองสุขภาพ • เชื่อมโยง HOSxP</p></div><a className="btn btn-primary" href="#survey-house-search"><i className="fa-solid fa-magnifying-glass me-2" aria-hidden="true"/>ค้นหาบ้าน</a></header>

<div className="card p-3 mb-3">
          <button type="button" className="btn btn-outline-primary" disabled={readingCard} onClick={handleReadCard}><i className="fa-solid fa-id-card me-2" />{readingCard ? 'กำลังอ่านและค้นหา…' : 'อ่านบัตรประชาชน'}</button>
          <small className="text-muted mt-2">เสียบบัตร เปิด E-Form Agent แล้วกดปุ่ม “อ่านบัตรประชาชน” — ระบบยังไม่อ่านอัตโนมัติเมื่อเสียบบัตร</small>
          {cardNotice && <p className="alert alert-info mb-0 mt-2" role="status" aria-live="polite">{cardNotice}</p>}
        </div>
<nav className="survey-navigation" aria-label="งานติดตาม"><a href="/tracking" className="survey-nav-link"><i className="fa-solid fa-list-check" aria-hidden="true" /> ติดตามงานสำรวจ</a></nav>



        {/* Search */}
        <div id="survey-house-search" className="card survey-search border-0 shadow-sm mb-4 fade-in" style={{borderRadius:16}}>
          <div className="card-body p-4">
            <h2 className="h5 fw-bold mb-1">ค้นหาบ้านเพื่อสำรวจ</h2><p className="text-muted small mb-3">เลือกหมู่และกรอกเลขที่บ้าน เพื่อดูรายชื่อผู้อาศัย</p>
            <div className="row g-2">
              <div className="col-5">
                <label htmlFor="survey-moo" className="form-label fw-bold">หมู่ที่</label>
                <select id="survey-moo" className="form-select text-center" value={moo} onChange={e => setMoo(e.target.value)}>
                  <option value="" disabled>เลือก</option>
                  {/* ✅ แสดงเฉพาะหมู่ที่มีสิทธิ์ */}
                  {visibleMoos.map(m => <option key={m} value={m}>หมู่ {m}</option>)}
                </select>
              </div>
              <div className="col-7">
                <label htmlFor="survey-house" className="form-label fw-bold">เลขที่บ้าน</label>
                <input id="survey-house" type="text" className="form-control" placeholder="เช่น 24/1" value={house} onChange={e => setHouse(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchData()} />
              </div>
              <div className="col-12 mt-3">
                <button onClick={() => searchData()} className="btn w-100 rounded-pill text-white fw-bold" style={{background:'var(--primary)',padding:10}} disabled={searching}>
                  {searching ? <><span className="spinner-border spinner-border-sm me-1"/>ค้นหา...</> : <><i className="fa-solid fa-magnifying-glass me-1"/> ค้นหาข้อมูล</>}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ✅ คู่มือการใช้งาน — ครบ 4 ขั้นตอน + ปุ่มซ่อน/แสดง */}
        {showGuide && (
          <div className="card border-0 shadow-sm mt-3 fade-in" style={{borderRadius:16,background:'linear-gradient(135deg,#3949ab 0%,#7c4dff 100%)',overflow:'hidden'}}>
            <div className="card-body p-4">
              <h5 className="fw-bold text-white mb-4"><i className="fa-solid fa-book-open me-2"/> คู่มือการใช้งาน</h5>

              <div className="bg-white rounded-3 p-3 mb-3" style={{transition:'transform .2s'}}>
                <div className="d-flex align-items-start gap-3">
                  <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" style={{width:30,height:30,fontSize:'.85rem',fontWeight:'bold',flexShrink:0}}>1</div>
                  <div>
                    <h6 className="fw-bold text-primary mb-1"><i className="fa-solid fa-magnifying-glass me-1"/> ค้นหาข้อมูลบ้าน</h6>
                    <small className="text-muted">เลือกหมู่ → ระบุบ้านเลขที่ → กดค้นหา → ระบบแสดงรายชื่อผู้อาศัย</small>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-3 p-3 mb-3">
                <div className="d-flex align-items-start gap-3">
                  <div className="bg-success text-white rounded-circle d-flex align-items-center justify-content-center" style={{width:30,height:30,fontSize:'.85rem',fontWeight:'bold',flexShrink:0}}>2</div>
                  <div>
                    <h6 className="fw-bold text-success mb-1"><i className="fa-solid fa-user-check me-1"/> ปรับปรุงสถานะ (Type)</h6>
                    <div className="d-flex flex-wrap gap-1 mt-1">
                      <span className="badge bg-secondary">Type 0 ในเขตไม่ตามทะเบียน</span><span className="badge bg-success">Type 1 มีชื่อ+อยู่จริง</span>
                      <span className="badge bg-warning text-dark">Type 2 มีชื่อ+ไม่อยู่</span>
                      <span className="badge bg-danger">Type 3 ไม่มีชื่อ+มาอยู่</span><span className="badge bg-secondary">Type 4 บุคคลนอกเขต</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-3 p-3 mb-3">
                <div className="d-flex align-items-start gap-3">
                  <div className="bg-info text-white rounded-circle d-flex align-items-center justify-content-center" style={{width:30,height:30,fontSize:'.85rem',fontWeight:'bold',flexShrink:0}}>3</div>
                  <div>
                    <h6 className="fw-bold text-info mb-1"><i className="fa-solid fa-user-plus me-1"/> เพิ่มผู้อาศัยใหม่</h6>
                    <small className="text-muted">กดปุ่ม "เพิ่มผู้อาศัย" ด้านล่าง → กรอกข้อมูล → เลือก อสม.</small>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-3 p-3 mb-0">
                <div className="d-flex align-items-start gap-3">
                  <div className="bg-warning text-dark rounded-circle d-flex align-items-center justify-content-center" style={{width:30,height:30,fontSize:'.85rem',fontWeight:'bold',flexShrink:0}}>4</div>
                  <div>
                    <h6 className="fw-bold mb-1" style={{color:'#f59e0b'}}><i className="fa-solid fa-truck-moving me-1"/> ย้ายที่อยู่ / กรณีพิเศษ</h6>
                    <small className="text-muted">ย้ายบ้าน, เสียชีวิต, จำหน่าย, เปลี่ยน อสม. — กดปุ่มบนการ์ดแต่ละคน</small>
                  </div>
                </div>
              </div>

              <div className="text-center mt-3"><small className="text-white-50"><i className="fa-solid fa-headset me-1"/> พบปัญหา ติดต่อเจ้าหน้าที่ รพ.สต.</small></div>
            </div>
          </div>
        )}
        <div className="text-center mt-3 mb-3">
          <button aria-expanded={showGuide} onClick={() => setShowGuide(!showGuide)} className={`btn btn-sm ${showGuide ? 'btn-outline-primary' : 'btn-primary'} rounded-pill px-4`}>
            <i className={`fa-solid fa-eye${showGuide ? '-slash' : ''} me-1`}/> {showGuide ? 'ซ่อนคู่มือ' : 'แสดงคู่มือ'}
          </button>
        </div>

        {/* Results */}
        {results !== null && (
          <div id="survey-house-results">
            {results.length === 0 ? (
              <div className="card border-0 bg-light mt-3 text-center py-5 fade-in" style={{borderRadius:16}}>
                <i className="fa-solid fa-house-chimney-crack fa-4x text-secondary mb-3"/>
                <h5 className="fw-bold">ไม่พบข้อมูล</h5>
                <p className="text-muted">บ้านเลขที่ {house} หมู่ {moo}</p>
                <button onClick={() => openAddModal(house, moo, 'ไม่ระบุ')} className="btn btn-primary mt-2 rounded-pill px-4"><i className="fa-solid fa-plus-circle me-1"/> เพิ่มบ้านใหม่</button>
              </div>
            ) : (
              <>
                {/* 🟢 อัปเดตส่วนหัวข้อบ้าน พร้อมปุ่มบันทึก GPS */}
                <div className="alert border-0 shadow-sm mb-3" style={{background:'white',borderRadius:12}}>
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div>
                      <div className="small text-muted"><i className="fa-solid fa-house text-primary me-1"/> ม.{moo} บ้านเลขที่ <span className="fw-bold text-dark">{house}</span></div>
                      <div className="mt-1"><i className="fa-solid fa-user-nurse text-success me-1"/> อสม: <strong>{results[0]?.vhv || 'ไม่ระบุ'}</strong></div>
                    </div>
                    <button onClick={openVhvModal} className="btn btn-sm btn-light border rounded-pill text-muted" style={{fontSize: '.75rem'}}>เปลี่ยน อสม.</button>
                  </div>

                  <hr className="my-2" style={{opacity: 0.1}}/>

                  <button
                    onClick={handleSaveGPS}
                    disabled={savingGps}
                    className="btn btn-sm w-100 rounded-pill fw-bold d-flex align-items-center justify-content-center"
                    style={{background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', height: '40px'}}
                  >
                    {savingGps ? (
                      <><span className="spinner-border spinner-border-sm me-2"/> กำลังหาพิกัด...</>
                    ) : (
                      <><i className="fa-solid fa-location-crosshairs fa-lg me-2"/> บันทึกพิกัด GPS บ้านหลังนี้</>
                    )}
                  </button>
                </div>
                {/* 🟢 จบส่วนหัวข้อบ้าน */}

                <div className="mb-2 text-muted small">พบ <strong>{results.length}</strong> คน</div>
               {results.map(p => <PersonCard key={p.personId} person={p} onSave={handleSave} onMove={p => setMoveTarget(p)} onRefresh={searchDataSilent} user={user} />)}
                <div className="mt-4 border-top pt-3 fade-in">
                  <button onClick={() => openAddModal(house, moo, results[0]?.vhv || 'ไม่ระบุ')} className="btn btn-outline-primary w-100 dashed-border rounded-pill">
                    <i className="fa-solid fa-user-plus me-1"/> เพิ่มผู้อาศัย
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ✅ Move Modal */}
      {moveTarget && (
        <ModalShell title="ย้ายที่อยู่" icon="fa-truck-moving" onClose={() => setMoveTarget(null)} variant="warning" footer={<><button className="btn btn-secondary rounded-pill" onClick={() => setMoveTarget(null)}>ยกเลิก</button><button className="btn btn-warning rounded-pill fw-bold" onClick={handleMove}><i className="fa-solid fa-check me-1"/> ยืนยันย้าย</button></>}>

                <p>กำลังย้าย: <strong className="text-primary">{moveTarget.fullname}</strong></p>
                <div className="row g-2">
                  <div className="col-5"><label className="small fw-bold">ย้ายไปหมู่ที่</label><select className="form-select text-center" value={moveMoo} onChange={e => setMoveMoo(e.target.value)}><option value="" disabled>เลือก</option>{VALID_MOOS.map(m => <option key={m} value={m}>หมู่ {m}</option>)}</select></div>
                  <div className="col-7"><label className="small fw-bold">เลขที่บ้านใหม่</label><input type="text" className="form-control" value={moveHouse} onChange={e => setMoveHouse(e.target.value)} placeholder="บ้านเลขที่ใหม่" /></div>
                </div>

        </ModalShell>
      )}
      {/* ✅ Add Person Modal */}
      {showAddModal && (
        <ModalShell title="เพิ่มผู้อาศัยใหม่" icon="fa-user-plus" onClose={() => setShowAddModal(false)} scrollable zIndex={1055} bodyClassName="p-4" footer={<>
                <button className="btn btn-outline-secondary rounded-pill px-4" onClick={()=>setShowAddModal(false)}>ยกเลิก</button>
                <button className="btn rounded-pill px-4 text-white" style={{background:'var(--primary)'}} onClick={submitNewPerson} disabled={readingCard}><i className="fa-solid fa-save me-1"/> บันทึก</button>
              </>}>

                <div className="alert alert-light py-2 mb-3 text-center border" style={{borderRadius:10}}><span className="fw-bold text-primary small"><i className="fa-solid fa-location-dot"/> บ้านเลขที่ {house} ม.{moo}</span></div>

                <button type="button" className="btn btn-outline-primary w-100 mb-2" disabled={readingCard} onClick={handleReadCard}>{readingCard ? 'กำลังอ่านและค้นหา…' : 'อ่านบัตรประชาชน'}</button>
                <p className="small text-muted" role="status">{cardNotice}</p>
                {/* อสม. */}
                <div className="mb-3 p-3 rounded-3" style={{background:'#e8eaf6'}}>
                  <label className="small fw-bold mb-2" style={{color:'var(--primary)'}}><i className="fa-solid fa-user-nurse"/> อสม. ผู้รับผิดชอบ</label>
                  <select className="form-select shadow-sm" value={addForm.vhv} onChange={e=>setAddForm({...addForm,vhv:e.target.value})} style={{borderColor:'var(--primary-light)'}}>
                    <option value="">-- เลือก อสม. --</option>
                    {(vhvData[moo]||[]).map(n=><option key={n} value={n}>{n}</option>)}
                  </select>
                </div>

                {/* CID */}
                <div className="mb-3"><label className="small fw-bold text-muted">เลขบัตรประชาชน (13 หลัก)</label>
                  <div className="input-group shadow-sm">
                    <input type="text" className="form-control" placeholder="ระบุเพื่อดึงข้อมูลเก่า" maxLength={13} inputMode="numeric" value={addForm.cid} onChange={e=>setAddForm({...addForm,cid:e.target.value})} />
                    <button className="btn btn-primary" onClick={searchCidAuto}><i className="fa-solid fa-magnifying-glass"/></button>
                  </div>
                </div>

                {/* Name */}
                <div className="row g-2 mb-3">
                  <div className="col-4"><label className="small fw-bold text-muted">คำนำหน้า</label>
                    <select className="form-select" value={addForm.title} onChange={e=>setAddForm({...addForm,title:e.target.value})}>
                      {Array.from(new Set(['นาย','นาง','น.ส.','ด.ช.','ด.ญ.',addForm.title].filter(Boolean))).map(t=><option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="col-8"><label className="small fw-bold text-muted">ชื่อจริง <span className="text-danger">*</span></label>
                    <input type="text" className="form-control" placeholder="ชื่อ" value={addForm.fname} onChange={e=>setAddForm({...addForm,fname:e.target.value})} />
                  </div>
                </div>
                <div className="mb-3"><label className="small fw-bold text-muted">นามสกุล <span className="text-danger">*</span></label>
                  <input type="text" className="form-control" placeholder="นามสกุล" value={addForm.lname} onChange={e=>setAddForm({...addForm,lname:e.target.value})} />
                </div>

                {/* Birth Date (พ.ศ.) */}
                <div className="mb-3"><label className="small fw-bold text-muted">วันเกิด (พ.ศ.)</label>
                  <div className="row g-2">
                    <div className="col-3"><select className="form-select" value={addForm.birth_day} onChange={e=>setAddForm({...addForm,birth_day:e.target.value})}>
                      <option value="">วัน</option>{Array.from({length:31},(_,i)=>{const d=String(i+1).padStart(2,'0');return <option key={d} value={d}>{i+1}</option>;})}
                    </select></div>
                    <div className="col-5"><select className="form-select" value={addForm.birth_month} onChange={e=>setAddForm({...addForm,birth_month:e.target.value})}>
                      <option value="">เดือน</option>{[['01','ม.ค.'],['02','ก.พ.'],['03','มี.ค.'],['04','เม.ย.'],['05','พ.ค.'],['06','มิ.ย.'],['07','ก.ค.'],['08','ส.ค.'],['09','ก.ย.'],['10','ต.ค.'],['11','พ.ย.'],['12','ธ.ค.']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                    </select></div>
                    <div className="col-4"><select className="form-select" value={addForm.birth_year} onChange={e=>setAddForm({...addForm,birth_year:e.target.value})}>
                      <option value="">พ.ศ.</option>{Array.from({length:120},(_,i)=>{const y=new Date().getFullYear()+543-i;return <option key={y} value={y}>{y}</option>;})}
                    </select></div>
                  </div>
                </div>

                {/* Relation + Type */}
                <div className="row g-2 mb-3">
                  <div className="col-6"><label className="small fw-bold text-muted">สถานะในบ้าน</label>
                    <select className="form-select" value={addForm.relation} onChange={e=>setAddForm({...addForm,relation:e.target.value})}>
                      {['ผู้อาศัย','เจ้าบ้าน','เขย/สะใภ้','หลาน','เช่าอาศัย','อื่นๆ'].map(r=><option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="col-6"><label className="small fw-bold" style={{color:'var(--primary)'}}>ประเภทประชากร</label>
                    <select className="form-select fw-bold" value={addForm.type} onChange={e=>setAddForm({...addForm,type:e.target.value})} style={{borderColor:'var(--primary-light)'}}>
                      {RESIDENCY_TYPES.map(item => <option key={item.code} value={item.code}>Type {item.code} — {item.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* Chronic */}
                <div className="mb-1"><label className="small fw-bold text-muted">โรคประจำตัว</label>
                  <select className="form-select" value={addForm.chronic} onChange={e=>setAddForm({...addForm,chronic:e.target.value})}>
                    {CHRONIC_LIST.map(c=><option key={c} value={c}>{c}</option>)}
                    <option value="__OTHER__">อื่นๆ (ระบุ)</option>
                  </select>
                  {addForm.chronic==='__OTHER__' && <input type="text" className="form-control mt-1" placeholder="ระบุโรคประจำตัว..." value={addForm.chronicOther} onChange={e=>setAddForm({...addForm,chronicOther:e.target.value})} />}
                </div>

        </ModalShell>
      )}

      {/* ✅ VHV Change Modal — เลือกจาก vhv_data ใน Supabase */}
      {showVhvModal && (
        <ModalShell title="เปลี่ยน อสม." icon="fa-user-nurse" onClose={() => setShowVhvModal(false)} zIndex={1060} footer={<>
                <button className="btn btn-outline-secondary rounded-pill px-4" onClick={() => setShowVhvModal(false)}>ยกเลิก</button>
                <button className="btn rounded-pill px-4 text-white fw-bold" style={{background:'var(--primary)'}} onClick={submitVhvChange} disabled={!selectedVhv}>
                  <i className="fa-solid fa-save me-1"/> บันทึก
                </button>
              </>}>

                <div className="alert alert-light border py-2 mb-3 text-center" style={{borderRadius:10}}>
                  <small className="text-primary fw-bold"><i className="fa-solid fa-location-dot me-1"/> บ้านเลขที่ {vhvHouse} ม.{vhvMoo}</small>
                </div>
                <label className="small fw-bold text-muted mb-2"><i className="fa-solid fa-user-nurse text-success me-1"/> เลือก อสม. ใหม่</label>
                <select className="form-select form-select-lg" value={selectedVhv} onChange={e => setSelectedVhv(e.target.value)} style={{borderColor:'var(--primary-light)'}}>
                  <option value="">-- เลือก อสม. --</option>
                  {(vhvData[vhvMoo] || []).map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <div className="alert alert-info border-0 mt-3 small mb-0" style={{borderRadius:10}}>
                  <i className="fa-solid fa-info-circle me-1"/> ระบบจะเปลี่ยน อสม. ให้ทุกคนในบ้านนี้
                </div>

        </ModalShell>
      )}
    </>
  );
}
