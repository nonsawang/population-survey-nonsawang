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

  // ดึงค่าที่ LINE ส่งกลับมาผ่าน URL
  const autoLogin = searchParams.get('auto_login');
  const lineId = searchParams.get('line_id');
  const lineName = searchParams.get('line_name');
  const pictureUrl = searchParams.get('picture_url');
  const linkLineId = searchParams.get('link_line_id');

  useEffect(() => {
    const handleLineAuth = async () => {
      if (autoLogin === 'true' && lineId) {
        setSubmitting(true);
        setSuccessMsg('กำลังตรวจสอบบัญชี LINE...');
        
        try {
          const res = await loginWithLine(lineId);
          
          if (res && res.success) {
            // 🟢 ถ้าผูกไว้แล้ว -> อัปเดตรูปโปรไฟล์ให้เป็นปัจจุบัน แล้วเข้าหน้าหลัก
            if (pictureUrl) {
              await supabase.from('app_users').update({ avatar_url: pictureUrl }).eq('line_user_id', lineId);
            }
            router.push('/');
          } else {
            // 🔴 ถ้ายังไม่เคยผูก -> เปลี่ยนสถานะหน้าจอให้แสดงช่องกรอกเลขบัตรเพื่อ "ผูกบัญชี"
            setSubmitting(false);
            setSuccessMsg('');
            router.replace(`/login?link_line_id=${lineId}&line_name=${encodeURIComponent(lineName || 'LINE')}&picture_url=${encodeURIComponent(pictureUrl || '')}`);
          }
        } catch (err) {
          setError('การเชื่อมต่อผิดพลาด');
          setSubmitting(false);
        }
      }
    };
    handleLineAuth();
  }, [autoLogin, lineId, router]);

  const handleLogin = async () => {
    let finalUser = '', finalPass = '';
    if (loginMode === 'vhv') {
      const cleanCid = cid.replace(/\D/g, '');
      if (cleanCid.length !== 13) { setError('กรุณากรอกเลขบัตรให้ครบ 13 หลัก'); return; }
      finalUser = 'vhv' + cleanCid.slice(-6); finalPass = cleanCid;
    } else {
      if (!username || !password) { setError('กรุณากรอกข้อมูลให้ครบ'); return; }
      finalUser = username.trim().toLowerCase(); finalPass = password;
    }

    setSubmitting(true); setError('');
    const res = await login(finalUser, finalPass);
    
    if (res.success) {
      if (linkLineId) {
        // 🟢 จังหวะสำคัญ: บันทึก LINE ID และรูปโปรไฟล์ลงฐานข้อมูลพร้อมกับการ Login ครั้งแรก
        await supabase.from('app_users').update({ 
          line_user_id: linkLineId, 
          avatar_url: pictureUrl 
        }).eq('username', finalUser);
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

        {error && <div className="alert alert-danger small mb-3 border-0 shadow-sm">{error}</div>}
        {successMsg && <div className="alert alert-primary small mb-3 border-0 shadow-sm">{successMsg}</div>}

        {/* หน้าแรก: บังคับกด LINE */}
        {!linkLineId && !submitting && (
          <div className="text-center py-4">
            <p className="mb-4" style={{color: '#546e7a', fontWeight: 500}}>กรุณาเข้าสู่ระบบด้วย LINE เพื่อดำเนินการต่อ</p>
            <button className="btn w-100 py-3 fw-bold text-white shadow-sm" onClick={handleLineLogin} style={{background:'#00B900', borderRadius:16, fontSize: '1.1rem'}}>
              <i className="fa-brands fa-line me-2 fa-lg" /> เข้าสู่ระบบด้วย LINE
            </button>
          </div>
        )}

        {/* หน้าผูกบัญชี: จะแสดงรูปโปรไฟล์ที่ดึงมาจาก LINE ให้เห็นด้วย */}
        {linkLineId && (
          <div className="fade-in">
            <div className="d-flex align-items-center p-3 mb-4 shadow-sm" style={{borderRadius: 15, backgroundColor: '#f5f5f5'}}>
              <img src={pictureUrl} alt="Profile" className="rounded-circle me-3 shadow-sm" style={{width: '50px', height: '50px', border: '2px solid white'}} />
              <div>
                <div className="small text-muted">ยินดีต้อนรับคุณ</div>
                <div className="fw-bold text-primary">{lineName}</div>
              </div>
            </div>

            <p className="small text-center text-muted mb-4">กรุณาระบุเลขบัตรประชาชนเพื่อผูกบัญชีเข้ากับระบบ</p>

            <div className="d-flex mb-4 p-1 rounded-pill bg-light">
              <button className={`btn w-50 rounded-pill fw-bold ${loginMode === 'vhv' ? 'btn-primary' : 'btn-light'}`} onClick={() => setLoginMode('vhv')} disabled={submitting}>อสม.</button>
              <button className={`btn w-50 rounded-pill fw-bold ${loginMode === 'staff' ? 'btn-primary' : 'btn-light'}`} onClick={() => setLoginMode('staff')} disabled={submitting}>เจ้าหน้าที่</button>
            </div>

            <div className="mb-4">
              {loginMode === 'vhv' ? (
                <input type="text" maxLength="13" className="form-control form-control-lg text-center shadow-sm" placeholder="เลขบัตรประชาชน 13 หลัก" value={cid} onChange={e => setCid(e.target.value.replace(/\D/g, ''))} disabled={submitting} style={{borderRadius: 12}} />
              ) : (
                <div className="mb-3">
                  <input type="text" className="form-control mb-2" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} disabled={submitting} />
                  <input type="password" className="form-control" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} disabled={submitting} />
                </div>
              )}
            </div>

            <button className="btn btn-primary w-100 py-3 fw-bold shadow-sm" onClick={handleLogin} disabled={submitting} style={{borderRadius: 16, background: 'linear-gradient(45deg, #1a237e, #3949ab)', border: 'none'}}>
              {submitting ? 'กำลังประมวลผล...' : 'ยืนยันการผูกบัญชี LINE'}
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