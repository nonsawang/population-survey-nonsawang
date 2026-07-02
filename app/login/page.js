'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase'; 
import liff from '@line/liff';

function LoginContent() {
  const [loginMode, setLoginMode] = useState('vhv'); 
  const [cid, setCid] = useState(''); 
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(true); // 🟢 ให้โหลดตั้งแต่เริ่มเพื่อรอ LIFF

  // 🟢 State สำหรับเก็บข้อมูลจาก LIFF โดยตรง
  const [liffData, setLiffData] = useState(null);

  const { login, loginWithLine, user } = useAuth(); 
  const router = useRouter();

  // 🚀 เริ่มต้นระบบ LIFF ทันทีที่โหลดหน้าเว็บ
  useEffect(() => {
    const initLiff = async () => {
      try {
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID });
        
        // ถ้าเปิดผ่านแอป LINE (Rich Menu) หรือเคยล็อกอินไว้แล้ว มันจะเข้าเงื่อนไขนี้ทันที!
        if (liff.isLoggedIn()) {
          setSuccessMsg('กำลังเชื่อมต่อฐานข้อมูล รพ.สต....');
          const profile = await liff.getProfile();
          
          const currentLineId = profile.userId;
          const currentPicUrl = profile.pictureUrl;
          
          // เช็กกับ Supabase ว่าเคยผูกบัญชีหรือยัง
          const res = await loginWithLine(currentLineId);
          
          if (res && res.success) {
            // ถ้าเคยผูกแล้ว -> อัปเดตรูปเผื่อเปลี่ยนใหม่ แล้วพุ่งเข้าหน้าหลักเลย
            if (currentPicUrl) {
              await supabase.from('app_users').update({ avatar_url: currentPicUrl }).eq('line_user_id', currentLineId);
            }
            // 🎯 เปลี่ยนเป็น window.location.href เพื่อป้องกันหน้าจอค้าง
            setSuccessMsg('เข้าสู่ระบบสำเร็จ กำลังพาไปหน้าหลัก...');
            window.location.href = '/';
          } else {
            // 🔴 ถ้ายังไม่เคยผูกบัญชี -> โชว์หน้ากรอกเลขบัตร
            setLiffData({
              lineId: currentLineId,
              lineName: profile.displayName,
              pictureUrl: currentPicUrl
            });
            setSubmitting(false);
            setSuccessMsg('');
          }
        } else {
          // ถ้าไม่ได้ล็อกอิน (เปิดใน Chrome แบบปกติ) ให้โชว์ปุ่มสีเขียว
          setSubmitting(false);
        }
      } catch (err) {
        console.error('LIFF Init Error:', err);
        setError('ไม่สามารถเรียกใช้งาน LINE ได้ กรุณารีเฟรชหน้าจอ');
        setSubmitting(false);
      }
    };

    if (!user) {
      initLiff();
    } else {
      // 🎯 เปลี่ยนเป็น window.location.href เพื่อป้องกันหน้าจอค้าง
      window.location.href = '/';
    }
  }, [loginWithLine, router, user]);

  const handleLogin = async () => {
    let finalUser = '', finalPass = '';
    if (loginMode === 'vhv') {
      const cleanCid = cid.replace(/\D/g, '');
      if (cleanCid.length !== 13) { setError('กรุณากรอกเลขบัตร 13 หลัก'); return; }
      finalUser = 'vhv' + cleanCid.slice(-6); finalPass = cleanCid;
    } else {
      if (!username || !password) { setError('กรุณากรอกข้อมูลให้ครบ'); return; }
      finalUser = username.trim().toLowerCase(); finalPass = password;
    }

    setSubmitting(true); 
    setError('');
    setSuccessMsg('กำลังตรวจสอบข้อมูล...');

    // 🟢 ถ้ากำลังอยู่ในขั้นตอนการผูกบัญชี (มี liffData) ให้บันทึกลง Supabase
    if (liffData) {
      setSuccessMsg('กำลังผูกบัญชี LINE...');
      const { error: updateError } = await supabase
        .from('app_users')
        .update({ 
          line_user_id: liffData.lineId, 
          avatar_url: liffData.pictureUrl 
        })
        .eq('username', finalUser);
        
      if (updateError) {
        setError('ไม่สามารถบันทึกข้อมูลการผูกบัญชีได้ เลขบัตรอาจไม่ถูกต้อง');
        setSubmitting(false);
        setSuccessMsg('');
        return;
      }
    }

    setSuccessMsg('กำลังเข้าสู่ระบบ...');
    const res = await login(finalUser, finalPass);
    if (res.success) {
      // 🎯 เปลี่ยนเป็น window.location.href เพื่อป้องกันหน้าจอค้าง
      setSuccessMsg('สำเร็จ! กำลังพาท่านเข้าสู่หน้าหลัก...');
      window.location.href = '/';
    } else {
      setSubmitting(false);
      setSuccessMsg('');
      setError(loginMode === 'vhv' ? 'ไม่พบข้อมูล อสม. ในระบบ' : res.error);
    }
  };

  // ฟังก์ชันกดปุ่ม LINE (กรณีไม่ได้เปิดผ่านแอป LINE)
  const handleLineLogin = () => {
    if (!liff.isLoggedIn()) {
      liff.login(); // คำสั่งของ LIFF จะจัดการล็อกอินให้อัตโนมัติ ปลอดภัยกว่า
    }
  };

  return (
    <div className="login-bg pb-5">
      <div className="login-card" style={{maxWidth: '420px', margin: '0 auto'}}>
        <div className="text-center mb-4">
          <div className="logo-circle"><i className="fa-solid fa-hospital fa-2x text-white" /></div>
          <h5 className="fw-bold mt-3" style={{color: '#1a237e'}}>ระบบสำรวจประชากร</h5>
          <p className="text-muted small">รพ.สต.บ้านโนนสว่าง จ.ร้อยเอ็ด</p>
        </div>

        {error && <div className="alert alert-danger small mb-3 border-0 shadow-sm">{error}</div>}
        
        {/* 🎯 เพิ่มการแสดงข้อความสถานะระหว่างโหลด */}
        {successMsg && (
          <div className="alert alert-primary small mb-3 border-0 shadow-sm">
            <span className="spinner-border spinner-border-sm me-2" />{successMsg}
          </div>
        )}

        {/* 🟢 หน้าแรก: โชว์ปุ่ม LINE (เฉพาะกรณีที่ยังไม่ได้ล็อกอิน LIFF) */}
        {!liffData && !submitting && (
          <div className="text-center py-4 fade-in">
            <p className="mb-4" style={{color: '#546e7a', fontWeight: 500}}>กรุณาเข้าสู่ระบบด้วย LINE เพื่อดำเนินการต่อ</p>
            <button className="btn w-100 py-3 fw-bold text-white shadow-sm" onClick={handleLineLogin} style={{background:'#00B900', borderRadius:16, fontSize: '1.1rem'}}>
              <i className="fa-brands fa-line me-2 fa-lg" /> เข้าสู่ระบบด้วย LINE
            </button>
          </div>
        )}

        {/* 🟢 หน้าผูกบัญชี: จะแสดงเมื่อ LIFF ดึงข้อมูลได้ แต่ไม่เจอในฐานข้อมูลเรา */}
        {liffData && !submitting && (
          <div className="fade-in">
            <div className="d-flex align-items-center p-3 mb-4 shadow-sm" style={{borderRadius: 15, backgroundColor: '#f5f5f5'}}>
              {liffData.pictureUrl ? (
                <img src={liffData.pictureUrl} alt="Profile" className="rounded-circle me-3 shadow-sm" style={{width: '50px', height: '50px', border: '2px solid white'}} />
              ) : (
                <i className="fa-solid fa-circle-user fa-3x text-secondary me-3" />
              )}
              <div>
                <div className="small text-muted">ยินดีต้อนรับคุณ</div>
                <div className="fw-bold text-primary">{liffData.lineName}</div>
              </div>
            </div>

            <p className="small text-center text-muted mb-4">ระบบตรวจพบการใช้งานครั้งแรก<br/>กรุณาระบุเลขบัตรประชาชนเพื่อ <b>ผูกบัญชี</b></p>

            <div className="d-flex mb-4 p-1 rounded-pill bg-light">
              <button className={`btn w-50 rounded-pill fw-bold ${loginMode === 'vhv' ? 'btn-primary' : 'btn-light text-muted'}`} onClick={() => setLoginMode('vhv')}>อสม.</button>
              <button className={`btn w-50 rounded-pill fw-bold ${loginMode === 'staff' ? 'btn-primary' : 'btn-light text-muted'}`} onClick={() => setLoginMode('staff')}>เจ้าหน้าที่</button>
            </div>

            <div className="mb-4">
              {loginMode === 'vhv' ? (
                <input type="text" maxLength="13" className="form-control form-control-lg text-center shadow-sm" placeholder="เลขบัตรประชาชน 13 หลัก" value={cid} onChange={e => setCid(e.target.value.replace(/\D/g, ''))} style={{borderRadius: 12}} />
              ) : (
                <div className="mb-3">
                  <input type="text" className="form-control mb-2 shadow-sm" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} style={{borderRadius: 12}} />
                  <input type="password" className="form-control shadow-sm" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} style={{borderRadius: 12}} />
                </div>
              )}
            </div>

            <button className="btn btn-primary w-100 py-3 fw-bold shadow-sm" onClick={handleLogin} style={{borderRadius: 16, background: 'linear-gradient(45deg, #1a237e, #3949ab)', border: 'none'}}>
              ยืนยันการผูกบัญชี LINE
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="login-bg d-flex justify-content-center align-items-center"><div className="spinner-border text-white"></div></div>}>
      <LoginContent />
    </Suspense>
  );
}