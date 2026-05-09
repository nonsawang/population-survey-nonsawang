'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase'; 

function LoginContent() {
  const [loginMode, setLoginMode] = useState('vhv'); 
  const [cid, setCid] = useState(''); 
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [shake, setShake] = useState(false);
  const [isCheckingLine, setIsCheckingLine] = useState(false); 
  
  const cidRef = useRef(null);
  const usernameRef = useRef(null);
  
  const { login, loginWithLine, user } = useAuth(); 
  const router = useRouter();
  const searchParams = useSearchParams(); 

  const linkLineId = searchParams.get('link_line_id');
  const lineName = searchParams.get('line_name');
  const autoLogin = searchParams.get('auto_login');
  const lineIdToLogin = searchParams.get('line_id');
  const pictureUrl = searchParams.get('picture_url'); 

  useEffect(() => {
    const processLineLogin = async () => {
      if (autoLogin === 'true' && lineIdToLogin && !user && !isCheckingLine) {
        setIsCheckingLine(true);
        setSubmitting(true);
        setSuccessMsg('กำลังตรวจสอบบัญชี LINE ในระบบ...');
        
        try {
          const res = await loginWithLine(lineIdToLogin);
          if (res && res.success) {
            router.push('/');
          } else {
            // ปลดล็อคหน้าจอและเข้าสู่โหมดผูกบัญชี
            setSuccessMsg('');
            setSubmitting(false); 
            router.replace(`/login?link_line_id=${lineIdToLogin}&line_name=${encodeURIComponent(lineName || 'LINE')}&picture_url=${encodeURIComponent(pictureUrl || '')}`);
          }
        } catch (err) {
          setSubmitting(false);
          setError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
        }
      }
    };
    processLineLogin();

    if (user && !autoLogin) {
      router.push('/');
    } else if (!autoLogin && !linkLineId) {
      if (loginMode === 'vhv') cidRef.current?.focus();
      else usernameRef.current?.focus();
    }
  }, [user, router, autoLogin, lineIdToLogin, loginWithLine, loginMode, linkLineId, lineName, pictureUrl, isCheckingLine]);

  const handleLogin = async () => {
    let finalUser = '';
    let finalPass = '';

    if (loginMode === 'vhv') {
      const cleanCid = cid.replace(/\D/g, ''); 
      if (cleanCid.length !== 13) {
        setError('กรุณากรอกเลขประจำตัวประชาชนให้ครบ 13 หลัก');
        setShake(true); setTimeout(() => setShake(false), 500);
        return;
      }
      finalUser = 'vhv' + cleanCid.slice(-6);
      finalPass = cleanCid;
    } else {
      if (!username || !password) {
        setError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
        setShake(true); setTimeout(() => setShake(false), 500);
        return;
      }
      finalUser = username.trim().toLowerCase();
      finalPass = password;
    }

    setSubmitting(true); setError('');
    
    const res = await login(finalUser, finalPass);
    
    if (res.success) {
      if (linkLineId) {
        setSuccessMsg('กำลังเชื่อมโยงบัญชี LINE ของคุณ...');
        const { error: updateError } = await supabase
          .from('app_users')
          .update({ line_user_id: linkLineId, avatar_url: pictureUrl }) 
          .eq('username', finalUser);

        if (updateError) console.error("Error updating LINE ID:", updateError);
      }
      setSubmitting(false);
      router.push('/');
    } else {
      setSubmitting(false);
      setError(loginMode === 'vhv' ? 'ไม่พบข้อมูล อสม. หรือเลขบัตรไม่ถูกต้อง' : res.error);
      setShake(true); setTimeout(() => setShake(false), 500);
    }
  };

  const handleLineLogin = () => {
    const clientId = process.env.NEXT_PUBLIC_LINE_CLIENT_ID;
    const currentDomain = window.location.origin; 
    const redirectUri = encodeURIComponent(`${currentDomain}/api/auth/callback/line`);
    const state = "secure_state";
    const lineLoginUrl = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}&scope=profile%20openid`;
    window.location.href = lineLoginUrl;
  };

  return (
    <div className="login-bg">
      <div className={`login-card ${shake ? 'shake' : ''}`} style={{animation: shake ? 'shake 0.45s ease-in-out' : 'fadeInUp 0.6s ease-out'}}>
        <div className="text-center mb-4">
          <div className="logo-circle"><i className="fa-solid fa-hospital fa-2x text-white" /></div>
          <h5 style={{fontFamily:"'Prompt',sans-serif",fontWeight:700,fontSize:'1.35rem',color:'#1a237e'}}>ระบบสำรวจประชากร</h5>
          <p style={{color:'#78909c',fontSize:'0.88rem'}}>รพ.สต.บ้านโนนสว่าง</p>
        </div>

        {linkLineId && (
          <div className="alert alert-info py-2 px-3 small mb-3 d-flex align-items-center" style={{borderRadius:12, backgroundColor:'#e3f2fd', color:'#0d47a1', border:'none'}}>
            {pictureUrl ? (
              <img src={pictureUrl} alt="LINE" className="rounded-circle shadow-sm me-2" style={{width: 32, height: 32}} />
            ) : (
              <i className="fa-brands fa-line me-2 fa-lg text-success" />
            )}
            <span>เชื่อมต่อ LINE <b>{lineName}</b> สำเร็จ<br/>กรุณากรอกข้อมูลเพื่อ <b>ผูกบัญชี</b> ในครั้งแรกครับ</span>
          </div>
        )}

        {error && (
          <div className="alert alert-danger py-2 px-3 small mb-3 d-flex align-items-center" style={{borderRadius:12,border:'none'}}>
            <i className="fa-solid fa-circle-xmark me-2 flex-shrink-0" /><span>{error}</span>
          </div>
        )}
        
        {successMsg && (
          <div className="alert alert-success py-2 px-3 small mb-3 d-flex align-items-center" style={{borderRadius:12,border:'none'}}>
            <i className="fa-solid fa-circle-check me-2 flex-shrink-0" /><span>{successMsg}</span>
          </div>
        )}

        <div className="d-flex mb-4 p-1 rounded-pill shadow-sm" style={{backgroundColor: '#e8eaf6'}}>
          <button 
            className={`btn w-50 rounded-pill fw-bold ${loginMode === 'vhv' ? 'btn-primary shadow-sm' : 'btn-light text-muted border-0'}`} 
            onClick={() => { setLoginMode('vhv'); setError(''); }}
            style={{transition: 'all 0.3s'}}
            disabled={submitting}
          >
            <i className="fa-solid fa-user-nurse me-1"/> อสม.
          </button>
          <button 
            className={`btn w-50 rounded-pill fw-bold ${loginMode === 'staff' ? 'btn-primary shadow-sm' : 'btn-light text-muted border-0'}`} 
            onClick={() => { setLoginMode('staff'); setError(''); }}
            style={{transition: 'all 0.3s'}}
            disabled={submitting}
          >
            <i className="fa-solid fa-user-shield me-1"/> เจ้าหน้าที่
          </button>
        </div>

        {loginMode === 'vhv' ? (
          <div className="mb-4 fade-in">
            <label className="form-label" style={{fontWeight:600,fontSize:'.85rem',color:'#546e7a'}}><i className="fa-solid fa-id-card me-1" /> เลขประจำตัวประชาชน 13 หลัก</label>
            <div className="input-group shadow-sm" style={{borderRadius:8, overflow:'hidden'}}>
              <span className="input-group-text bg-white" style={{borderRight:'none',borderColor:'#c5cae9',color:'#3949ab'}}><i className="fa-solid fa-id-card" /></span>
              <input 
                ref={cidRef} type="text" maxLength="13" inputMode="numeric" className="form-control fw-bold text-center" 
                placeholder="กรอกเลขบัตร 13 หลัก" 
                value={cid} 
                onChange={e => setCid(e.target.value.replace(/\D/g, ''))} 
                onKeyPress={e => e.key === 'Enter' && linkLineId && handleLogin()} 
                style={{borderLeft:'none',borderColor:'#c5cae9',padding:'14px', fontSize:'1.1rem', letterSpacing:'2px'}} 
                disabled={submitting} 
              />
            </div>
          </div>
        ) : (
          <div className="fade-in">
            <div className="mb-3">
              <label className="form-label" style={{fontWeight:600,fontSize:'.85rem',color:'#546e7a'}}><i className="fa-solid fa-user me-1" /> ชื่อผู้ใช้งาน</label>
              <div className="input-group shadow-sm" style={{borderRadius:8, overflow:'hidden'}}>
                <span className="input-group-text bg-white" style={{borderRight:'none',borderColor:'#c5cae9',color:'#3949ab'}}><i className="fa-solid fa-user" /></span>
                <input ref={usernameRef} type="text" className="form-control" placeholder="ระบุชื่อผู้ใช้งาน" value={username} onChange={e => setUsername(e.target.value)} onKeyPress={e => e.key === 'Enter' && document.getElementById('pwd')?.focus()} autoCapitalize="none" style={{borderLeft:'none',borderColor:'#c5cae9',padding:'12px 14px'}} disabled={submitting} />
              </div>
            </div>

            <div className="mb-4">
              <label className="form-label" style={{fontWeight:600,fontSize:'.85rem',color:'#546e7a'}}><i className="fa-solid fa-lock me-1" /> รหัสผ่าน</label>
              <div className="input-group shadow-sm" style={{borderRadius:8, overflow:'hidden'}}>
                <span className="input-group-text bg-white" style={{borderRight:'none',borderColor:'#c5cae9',color:'#3949ab'}}><i className="fa-solid fa-lock" /></span>
                <input id="pwd" type={showPwd ? 'text' : 'password'} className="form-control" placeholder="ระบุรหัสผ่าน" value={password} onChange={e => setPassword(e.target.value)} onKeyPress={e => e.key === 'Enter' && linkLineId && handleLogin()} style={{borderLeft:'none',borderColor:'#c5cae9',padding:'12px 14px'}} disabled={submitting} />
                <button className="btn btn-light bg-white border-start-0" type="button" onClick={() => setShowPwd(!showPwd)} style={{borderColor:'#c5cae9'}} disabled={submitting}>
                  <i className={`fa-solid fa-eye${showPwd ? '-slash' : ''} text-muted`} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 🟢 ส่วนของปุ่มที่ปรับเปลี่ยน: ซ่อนปุ่มเข้าสู่ระบบปกติ และบังคับใช้ LINE */}
        {linkLineId ? (
          // โหมดผูกบัญชี (กลับมาจาก LINE): แสดงปุ่มสีน้ำเงินเพื่อให้กดยืนยันข้อมูล
          <button className="btn btn-primary w-100 text-white mb-3 shadow-sm" onClick={handleLogin} disabled={submitting} style={{background:'linear-gradient(135deg,#1a237e,#3949ab)',border:'none',borderRadius:14,padding:14,fontSize:'1.05rem',fontWeight:700}}>
            {submitting ? <><span className="spinner-border spinner-border-sm me-2" />กำลังตรวจสอบ...</> : <><i className="fa-solid fa-link me-2" />ยืนยันการผูกบัญชี</>}
          </button>
        ) : (
          // โหมดปกติ (หน้าแรก): แสดงแค่ปุ่ม LINE ปุ่มเดียว ไม่มีปุ่มเข้าสู่ระบบปกติ
          <button 
            className="btn w-100 text-white d-flex align-items-center justify-content-center shadow-sm" 
            onClick={handleLineLogin} 
            disabled={submitting}
            style={{background:'#00B900', border:'none', borderRadius:14, padding:14, fontSize:'1.05rem', fontWeight:700}}
          >
            <img src="https://upload.wikimedia.org/wikipedia/commons/4/41/LINE_logo.svg" alt="LINE" className="me-2" style={{width: '24px', height: '24px'}} />
            เข้าสู่ระบบด้วย LINE
          </button>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="login-bg d-flex justify-content-center align-items-center"><div className="spinner-border text-white" role="status"></div></div>}>
      <LoginContent />
    </Suspense>
  );
}