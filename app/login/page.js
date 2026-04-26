'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [shake, setShake] = useState(false);
  const usernameRef = useRef(null);
  const { login, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push(user.role === 'manager' ? '/dashboard' : '/');
    } else {
      usernameRef.current?.focus();
    }
  }, [user, router]);

  const handleLogin = async () => {
    if (!username || !password) {
      setError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
      setShake(true); setTimeout(() => setShake(false), 500);
      return;
    }
    setSubmitting(true); setError('');
    const res = await login(username, password);
    setSubmitting(false);
    if (res.success) {
      router.push(res.user.role === 'manager' ? '/dashboard' : '/');
    } else {
      setError(res.error);
      setShake(true); setTimeout(() => setShake(false), 500);
    }
  };

  return (
    <div className="login-bg">
      <div className={`login-card ${shake ? 'shake' : ''}`} style={{animation: shake ? 'shake 0.45s ease-in-out' : 'fadeInUp 0.6s ease-out'}}>
        <div className="text-center mb-4">
          <div className="logo-circle"><i className="fa-solid fa-hospital fa-2x text-white" /></div>
          <h5 style={{fontFamily:"'Prompt',sans-serif",fontWeight:700,fontSize:'1.35rem',color:'#1a237e'}}>ระบบสำรวจประชากร</h5>
          <p style={{color:'#78909c',fontSize:'0.88rem'}}>รพ.สต.บ้านโนนสว่าง</p>
        </div>

        {error && (
          <div className="alert alert-danger py-2 px-3 small mb-3 d-flex align-items-center" style={{borderRadius:12,border:'none'}}>
            <i className="fa-solid fa-circle-xmark me-2 flex-shrink-0" /><span>{error}</span>
          </div>
        )}

        <div className="mb-3">
          <label className="form-label" style={{fontWeight:600,fontSize:'.85rem',color:'#546e7a'}}><i className="fa-solid fa-user me-1" /> ชื่อผู้ใช้งาน</label>
          <div className="input-group">
            <span className="input-group-text" style={{background:'#e8eaf6',borderRight:'none',borderColor:'#c5cae9',color:'#3949ab'}}><i className="fa-solid fa-user" /></span>
            <input ref={usernameRef} type="text" className="form-control" placeholder="กรอกชื่อผู้ใช้" value={username} onChange={e => setUsername(e.target.value)} onKeyPress={e => e.key === 'Enter' && document.getElementById('pwd')?.focus()} autoCapitalize="none" style={{borderLeft:'none',borderColor:'#c5cae9',padding:'12px 14px'}} />
          </div>
        </div>

        <div className="mb-4">
          <label className="form-label" style={{fontWeight:600,fontSize:'.85rem',color:'#546e7a'}}><i className="fa-solid fa-lock me-1" /> รหัสผ่าน</label>
          <div className="input-group">
            <span className="input-group-text" style={{background:'#e8eaf6',borderRight:'none',borderColor:'#c5cae9',color:'#3949ab'}}><i className="fa-solid fa-lock" /></span>
            <input id="pwd" type={showPwd ? 'text' : 'password'} className="form-control" placeholder="กรอกรหัสผ่าน" value={password} onChange={e => setPassword(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleLogin()} style={{borderLeft:'none',borderColor:'#c5cae9',padding:'12px 14px'}} />
            <button className="btn btn-outline-secondary border-start-0" type="button" onClick={() => setShowPwd(!showPwd)} style={{borderColor:'#c5cae9'}}>
              <i className={`fa-solid fa-eye${showPwd ? '-slash' : ''}`} />
            </button>
          </div>
        </div>

        <button className="btn btn-primary w-100 text-white" onClick={handleLogin} disabled={submitting} style={{background:'linear-gradient(135deg,#1a237e,#3949ab)',border:'none',borderRadius:14,padding:14,fontSize:'1.05rem',fontWeight:700}}>
          {submitting ? <><span className="spinner-border spinner-border-sm me-2" />กำลังตรวจสอบ...</> : <><i className="fa-solid fa-right-to-bracket me-2" />เข้าสู่ระบบ</>}
        </button>

        <div className="text-center" style={{borderTop:'1px solid #eceff1',paddingTop:16,marginTop:24}}>
          <small className="text-muted" style={{fontSize:'.8rem'}}><i className="fa-solid fa-shield-halved text-primary me-1" />เข้าถึงได้เฉพาะเจ้าหน้าที่ที่ได้รับอนุญาต</small>
        </div>
      </div>
    </div>
  );
}
