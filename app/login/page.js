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
  // 🎯 1. ดึง loading มาจาก useAuth เพื่อใช้เป็นตัวกั้น Race Condition
  const { login, loginWithLine, user, loading } = useAuth(); 
  const router = useRouter();

  // 🚀 2. ควบคุม Flow การทำงานด้วย useEffect ตัวเดียว
  useEffect(() => {
    // 🎯 กฎข้อที่ 1: ถ้าระบบ Auth ยังเช็ค sessionStorage ไม่เสร็จ ให้หยุดรอ
    if (loading) return;

    // 🎯 กฎข้อที่ 2: ถ้าเช็คเสร็จแล้วพบว่า "มีบัญชีอยู่แล้ว" (ล็อกอินสำเร็จ) ให้ย้ายหน้าทันที
    if (user) {
      setSuccessMsg('เข้าสู่ระบบสำเร็จ กำลังพาท่านเข้าสู่หน้าหลัก...');
      setSubmitting(true);
      window.location.replace('/');
      return; 
    }

    // 🎯 กฎข้อที่ 3: ถ้า "ไม่มีบัญชี" จริงๆ ถึงจะเรียกใช้งาน LIFF
    const initLiff = async () => {
      try {
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID });
        
        if (liff.isLoggedIn()) {
          setSuccessMsg('กำลังเชื่อมต่อฐานข้อมูล รพ.สต....');
          const profile = await liff.getProfile();
          
          const currentLineId = profile.userId;
          const currentPicUrl = profile.pictureUrl;
          
          const res = await loginWithLine(currentLineId);
          
          // ถ้า loginWithLine สำเร็จ ตัวแปร user ใน AuthContext จะเปลี่ยนค่าเอง
          // และจะทำให้ useEffect ตัวนี้ถูกเรียกซ้ำ เข้าสู่ "กฎข้อที่ 2" อัตโนมัติ!
          if (res && res.success) {
            if (currentPicUrl) {
              await supabase.from('app_users').update({ avatar_url: currentPicUrl }).eq('line_user_id', currentLineId);
            }
          } else {
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
          setSuccessMsg('');
        }
      } catch (err) {
        console.error('LIFF Init Error:', err);
        setError('ไม่สามารถเรียกใช้งาน LINE ได้ กรุณารีเฟรชหน้าจอ');
        setSubmitting(false);
        setSuccessMsg('');
      }
    };

    initLiff();
  }, [user, loading, loginWithLine]); // เฝ้าดูการเปลี่ยนแปลงของ user และ loading

  // 🎯 3. ฟังก์ชันล็อกอิน
  const handleLogin = async () => {
    let finalUser = '', finalPass = '';
    
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

    // ผูกบัญชี LINE ก่อน
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

    setSuccessMsg('กำลังตรวจสอบข้อมูลเข้าสู่ระบบ...');
    
    // เรียกฟังก์ชันล็อกอิน
    const res = await login(finalUser, finalPass);
    
    // 🎯 ไม่ต้องสั่ง window.location ตรงนี้แล้ว!
    // ถ้า login สำเร็จ (res.success === true) ตัวแปร user จะมีค่า -> useEffect ด้านบนจะเตะผู้ใช้ไปหน้า '/' ทันที
    if (!res || !res.success) {
      setSubmitting(false);
      setSuccessMsg('');
      setError(loginMode === 'vhv' ? 'ไม่พบข้อมูล อสม. ในระบบ หรือเลขบัตรไม่ถูกต้อง' : res.error);
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

        {/* หน้าจอโหลด */}
        {submitting && (
          <div className="text-center py-5 fade-in">
            <span className="spinner-border text-primary mb-3" style={{width: '2.5rem', height: '2.5rem'}} />
            <p className="text-muted small fw-bold mb-0">{successMsg}</p>
          </div>
        )}

        {/* ปุ่มเข้าสู่ระบบด้วย LINE */}
        {!liffData && !submitting && (
          <div className="text-center py-4 fade-in">
            <p className="mb-4" style={{color: '#546e7a', fontWeight: 500}}>กรุณาเข้าสู่ระบบด้วย LINE เพื่อดำเนินการต่อ</p>
            <button className="btn w-100 py-3 fw-bold text-white shadow-sm" onClick={handleLineLogin} style={{background:'#00B900', borderRadius:16, fontSize: '1.1rem'}}>
              <i className="fa-brands fa-line me-2 fa-lg" /> เข้าสู่ระบบด้วย LINE
            </button>
          </div>
        )}

        {/* ฟอร์มผูกบัญชี */}
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