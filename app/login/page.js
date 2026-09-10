'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import liff from '@line/liff';
import ProfileAvatar from '@/components/ProfileAvatar';

export default function LoginPage() {
  const { user, loading, authError, login, loginWithLine } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState('vhv');
  const [cid, setCid] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [profile, setProfile] = useState(null);
  const [lineReady, setLineReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!loading && user) router.replace(['admin','manager'].includes(user.role) ? '/dashboard' : '/');
  }, [user, loading, router]);
  useEffect(() => {
    if (loading || user || !process.env.NEXT_PUBLIC_LIFF_ID) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID });
        if (cancelled) return;
        setLineReady(true);
        if (liff.isLoggedIn() && !sessionStorage.getItem('authManualLogout')) {
          const result = await loginWithLine(liff.getAccessToken());
          if (!result.success && !cancelled) {
            if (result.status === 'NOT_LINKED') setProfile(await liff.getProfile());
            else setError(result.error);
          }
        }
      } catch { if (!cancelled) setError('เชื่อมต่อ LINE ไม่สำเร็จ สามารถใช้บัญชีเข้าสู่ระบบด้านล่างได้'); }
      finally { if (!cancelled) setBusy(false); }
    })();
    return () => { cancelled = true; };
  }, [loading, user, loginWithLine]);
  const submit = async event => {
    event.preventDefault(); if (busy) return;
    const cleanCid = cid.replace(/[^0-9]/g, '');
    if (mode === 'vhv' && cleanCid.length !== 13) { setError('กรุณากรอกเลขบัตร 13 หลัก'); return; }
    if (mode === 'staff' && (!username.trim() || !password)) { setError('กรุณากรอกบัญชีและรหัสผ่าน'); return; }
    setBusy(true); setError('');
    const result = await login(mode === 'vhv' ? `vhv${cleanCid.slice(-6)}` : username.trim().toLowerCase(), mode === 'vhv' ? cleanCid : password, profile ? liff.getAccessToken() : undefined);
    setBusy(false);
    if (!result.success) setError(result.error);
    else { setPassword(''); setCid(''); }
  };
  return <div className="login-bg pb-5"><div className="login-card" style={{ maxWidth:420, margin:'0 auto' }}>
    <div className="text-center mb-4"><div className="logo-circle"><i className="fa-solid fa-hospital fa-2x text-white" /></div><h1 className="h5 fw-bold mt-3">ระบบสำรวจประชากร</h1><p className="text-muted small">รพ.สต.บ้านโนนสว่าง จ.ร้อยเอ็ด</p></div>
    {(error || authError) && <div className="alert alert-danger small" role="alert">{error || authError}</div>}
    {(loading || busy) && <p className="text-center" role="status"><span className="spinner-border spinner-border-sm me-2" />กำลังตรวจสอบ...</p>}
    {!profile && <button type="button" className="btn w-100 py-3 fw-bold text-white mb-4" style={{background:'#00B900'}} disabled={!lineReady || busy || loading} onClick={async () => {
      if (!liff.isLoggedIn()) { liff.login(); return; }
      setBusy(true); setError('');
      try {
        const result = await loginWithLine(liff.getAccessToken());
        if (result.status === 'NOT_LINKED') setProfile(await liff.getProfile());
        else if (!result.success) setError(result.error);
      } catch { setError('เชื่อมต่อ LINE ไม่สำเร็จ กรุณาลองใหม่'); }
      finally { setBusy(false); }
    }}>เข้าสู่ระบบด้วย LINE</button>}
    {profile && <div className="d-flex align-items-center bg-light rounded p-3 mb-3"><ProfileAvatar src={profile.pictureUrl} name={profile.displayName} size={45} className="me-3" /><div><strong>{profile.displayName}</strong><div className="small">ยืนยันบัญชีเพื่อผูก LINE</div></div></div>}
    <form onSubmit={submit}>
      <fieldset disabled={busy || loading}><legend className="h6">{profile ? 'ยืนยันบัญชี' : 'เข้าสู่ระบบด้วยบัญชี'}</legend>
        <div className="d-flex gap-2 mb-3">{[['vhv','อสม.'],['staff','เจ้าหน้าที่ / ผู้บริหาร']].map(([key,label])=><button key={key} type="button" className={`btn flex-fill ${mode===key?'btn-primary':'btn-outline-primary'}`} aria-pressed={mode===key} onClick={()=>{setMode(key);setError('');}}>{label}</button>)}</div>
        {mode==='vhv' ? <div className="mb-3"><label htmlFor="cid" className="form-label">เลขบัตรประชาชน</label><input id="cid" type="password" inputMode="numeric" maxLength={13} autoComplete="current-password" className="form-control form-control-lg" value={cid} onChange={e=>setCid(e.target.value.replace(/[๐-๙]/g,c=>String(c.charCodeAt(0)-3664)).replace(/\D/g,''))} required /></div> : <><div className="mb-3"><label htmlFor="username" className="form-label">ชื่อบัญชี</label><input id="username" autoComplete="username" autoCapitalize="none" className="form-control" value={username} onChange={e=>setUsername(e.target.value)} required /></div><div className="mb-3"><label htmlFor="password" className="form-label">รหัสผ่าน</label><input id="password" type="password" autoComplete="current-password" className="form-control" value={password} onChange={e=>setPassword(e.target.value)} required /></div></>}
        <button type="submit" className="btn btn-primary w-100 py-3 fw-bold">{profile ? 'ยืนยันและผูกบัญชี LINE' : 'เข้าสู่ระบบ'}</button>
      </fieldset>
    </form>
  </div></div>;
}
