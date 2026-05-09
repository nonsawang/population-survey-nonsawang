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
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { login, loginWithLine, user } = useAuth(); 
  const router = useRouter();
  const searchParams = useSearchParams(); 

  const autoLogin = searchParams.get('auto_login');
  const lineId = searchParams.get('line_id');
  const lineName = searchParams.get('line_name');
  const pictureUrl = searchParams.get('picture_url');
  const linkLineId = searchParams.get('link_line_id');

  useEffect(() => {
    const handleLineAuth = async () => {
      if (autoLogin === 'true' && lineId) {
        setSubmitting(true);
        setSuccessMsg('กำลังตรวจสอบบัญชีในระบบ...');
        
        try {
          const res = await loginWithLine(lineId);
          
          if (res && res.success) {
            router.push('/');
          } else {
            setSubmitting(false);
            setSuccessMsg('');
            router.replace(`/login?link_line_id=${lineId}&line_name=${encodeURIComponent(lineName || 'LINE')}&picture_url=${encodeURIComponent(pictureUrl || '')}`);
          }
        } catch (err) {
          setError('เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่');
          setSubmitting(false);
        }
      }
    };

    handleLineAuth();
  }, [autoLogin, lineId]); 

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

    setSubmitting(true); setError('');
    const res = await login(finalUser, finalPass);
    
    if (res.success) {
      if (linkLineId) {
        await supabase.from('app_users').update({ line_user_id: linkLineId, avatar_url: pictureUrl }).eq('username', finalUser);
      }
      router.push('/');
    } else {
      setSubmitting(false);
      setError(loginMode === 'vhv' ? 'ไม่พบข้อมูล อสม. ในระบบ' : res.error);
    }
  };

  const handleLineLogin = () => {
    const clientId = process.env.NEXT_PUBLIC_LINE_CLIENT_ID;
    const redirectUri = encodeURIComponent(`${window.location.origin}/api/auth/callback/line`);
    window.location.href = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&state=secure&scope=profile%20openid`;
  };

  return (
    <div className="login-bg pb-5">
      <div className="login-card" style={{maxWidth: '420px', margin: '0 auto'}}>
        <div className="text-center mb-4">
          <div className="logo-circle"><i className="fa-solid fa-hospital fa-2x text-white" /></div>
          <h5 className="fw-bold mt-3" style={{color: '#1a237e'}}>ระบบสำรวจประชากร</h5>
          <p className="text-muted small">รพ.สต.บ้านโนนสว่าง จ.ร้อยเอ็ด</p>
        </div>

        {error && <div className="alert alert-danger small mb-3 border-0 shadow-sm" style={{borderRadius: 12}}><i className="fa-solid fa-circle-exclamation me-2" />{error}</div>}
        {successMsg && <div className="alert alert-primary small mb-3 border-0 shadow-sm" style={{borderRadius: 12}}><i className="fa-solid fa-circle-info me-2" />{successMsg}</div>}

        {!linkLineId && !submitting && (
          <div className="text-center py-4">
            <p className="mb-4" style={{color: '#546e7a', fontWeight: 500}}>กรุณาเข้าสู่ระบบด้วย LINE เพื่อดำเนินการต่อ</p>
            <button className="btn w-100 py-3 fw-bold text-white shadow-sm mb-2" onClick={handleLineLogin} style={{background:'#00B900', borderRadius:16, fontSize: '1.1rem'}}>
              <i className="fa-brands fa-line me-2 fa-lg" /> เข้าสู่ระบบด้วย LINE
            </button>
            <small className="text-muted mt-3 d-block">การเข้าใช้งานต้องได้รับการยืนยันตัวตนผ่าน LINE</small>
          </div>
        )}

        {linkLineId && (
          <div className="fade-in">
            <div className="alert alert-info small mb-4 border-0 shadow-sm" style={{borderRadius: 12, backgroundColor: '#e8eaf6', color: '#1a237e'}}>
              <i className="fa-solid fa-link me-2" />
              เชื่อมต่อ LINE สำเร็จ! <b>กรุณาระบุตัวตน</b> เพื่อผูกบัญชี
            </div>

            <div className="d-flex mb-4 p-1 rounded-pill bg-light shadow-sm">
              <button className={`btn w-50 rounded-pill fw-bold ${loginMode === 'vhv' ? 'btn-primary shadow-sm' : 'btn-light text-muted'}`} onClick={() => setLoginMode('vhv')} disabled={submitting}>อสม.</button>
              <button className={`btn w-50 rounded-pill fw-bold ${loginMode === 'staff' ? 'btn-primary shadow-sm' : 'btn-light text-muted'}`} onClick={() => setLoginMode('staff')} disabled={submitting}>เจ้าหน้าที่</button>
            </div>

            {loginMode === 'vhv' ? (
              <div className="mb-4">
                <label className="form-label small fw-bold text-secondary">เลขบัตรประชาชน 13 หลัก</label>
                <input type="text" maxLength="13" className="form-control form-control-lg text-center shadow-sm" placeholder="กรอกเลข 13 หลัก" value={cid} onChange={e => setCid(e.target.value.replace(/\D/g, ''))} disabled={submitting} style={{borderRadius: 12, letterSpacing: '2px', fontWeight: 'bold'}} />
              </div>
            ) : (
              <div className="mb-4">
                <label className="form-label small fw-bold text-secondary">ชื่อผู้ใช้งาน</label>
                <input type="text" className="form-control shadow-sm mb-3" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} disabled={submitting} style={{borderRadius: 12}} />
                
                <label className="form-label small fw-bold text-secondary">รหัสผ่าน</label>
                <input type="password" className="form-control shadow-sm" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} disabled={submitting} style={{borderRadius: 12}} />
              </div>
            )}

            <button className="btn btn-primary w-100 py-3 fw-bold shadow-sm" onClick={handleLogin} disabled={submitting} style={{borderRadius: 16, background: 'linear-gradient(45deg, #1a237e, #3949ab)', border: 'none'}}>
              {submitting ? <><span className="spinner-border spinner-border-sm me-2"/>กำลังประมวลผล...</> : <><i className="fa-solid fa-user-check me-2"/>ยืนยันการผูกบัญชี</>}
            </button>
          </div>
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