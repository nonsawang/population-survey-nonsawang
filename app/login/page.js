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
  const [successMsg, setSuccessMsg] = useState('กำลังเตรียมระบบ...');
  const [submitting, setSubmitting] = useState(true);

  const [liffData, setLiffData] = useState(null);
  const { login, loginWithLine, user } = useAuth(); 
  const router = useRouter();

  // 🚀 เริ่มต้นระบบ LIFF ทันทีที่โหลดหน้าเว็บ
  useEffect(() => {
    const initLiff = async () => {
      try {
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID });
        
        if (liff.isLoggedIn()) {
          setSuccessMsg('กำลังเชื่อมต่อฐานข้อมูล รพ.สต....');
          const profile = await liff.getProfile();
          
          const currentLineId = profile.userId;
          const currentPicUrl = profile.pictureUrl;
          
          // เช็กกับ Supabase ว่าเคยผูกบัญชีหรือยัง
          const res = await loginWithLine(currentLineId);
          
          if (res && res.success) {
            // ถ้าเคยผูกแล้ว -> อัปเดตรูปเผื่อเปลี่ยนใหม่ แล้วเข้าหน้าหลัก
            if (currentPicUrl) {
              await supabase.from('app_users').update({ avatar_url: currentPicUrl }).eq('line_user_id', currentLineId);
            }
            window.location.replace('/'); // ใช้ window.location ชัวร์กว่าในการโหลดข้อมูลใหม่
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
      window.location.replace('/');
    }
  }, [loginWithLine, user]);

  // 🎯 ฟังก์ชันจัดการเมื่อกดปุ่ม "ยืนยันการผูกบัญชี"
  const handleLogin = async () => {
    try {
      let finalUser = '', finalPass = '';
      
      // 1. จัดเตรียมข้อมูลก่อน
      if (loginMode === 'vhv') {
        const cleanCid = cid.replace(/\D/g, '');
        if (cleanCid.length !== 13) { setError('กรุณากรอกเลขบัตร 13 หลัก'); return; }
        finalUser = 'vhv' + cleanCid.slice(-6); 
        finalPass = cleanCid;
      } else {
        if (!username || !password) { setError('กรุณากรอกข้อมูลให้ครบ'); return; }
        finalUser = username.trim().toLowerCase(); 
        finalPass = password;
      }

      setSubmitting(true); 
      setError('');
      setSuccessMsg('กำลังตรวจสอบข้อมูลของคุณ...');

      // 2. ล็อกอินด้วยระบบปกติก่อน เพื่อยืนยันว่าเลขบัตร/รหัสผ่าน ถูกต้องจริงๆ
      const res = await login(finalUser, finalPass);

      if (res && res.success) {
        // 3. ถ้ารหัสถูกต้อง และมาจากการใช้งาน LINE -> ทำการผูกบัญชี
        if (liffData) {
          setSuccessMsg('รหัสถูกต้อง กำลังผูกบัญชีเข้ากับ LINE...');
          const { error: updateError } = await supabase
            .from('app_users')
            .update({ 
              line_user_id: liffData.lineId, 
              avatar_url: liffData.pictureUrl 
            })
            .eq('username', finalUser);

          if (updateError) {
            console.error('Update LINE ID Error:', updateError);
            // อนุโลมให้ผ่านไปได้แม้จะอัปเดต LINE ID ไม่สำเร็จ (ระบบหลักเข้าได้แล้ว)
          }
        }

        // 4. พาไปหน้าหลัก
        window.location.replace('/');
      } else {
        // ถ้ารหัสผิด ให้หยุดหมุน และโชว์ Error
        setSubmitting(false);
        setSuccessMsg('');
        setError(loginMode === 'vhv' ? 'ไม่พบข้อมูล อสม. หรือเลขบัตรไม่ถูกต้อง' : res.error);
      }
    } catch (err) {
      // 🎯 ดักจับ Error ขั้นรุนแรง เพื่อไม่ให้หน้าจอค้าง
      console.error('Login Process Error:', err);
      setError('เกิดข้อผิดพลาดของระบบ: ' + (err.message || 'ไม่ทราบสาเหตุ'));
      setSubmitting(false);
      setSuccessMsg('');
    }
  };

  const handleLineLogin = () => {
    if (!liff.isLoggedIn()) {
      liff.login(); 
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
        
        {/* 🟢 หน้ากำลังโหลด */}
        {submitting && (
          <div className="text-center py-5 fade-in">
            <span className="spinner-border text-primary mb-3" style={{width: '3rem', height: '3rem'}} />
            <h6 className="text-muted fw-bold">{successMsg}</h6>
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