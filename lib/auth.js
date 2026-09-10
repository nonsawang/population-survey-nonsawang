'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
const AuthContext = createContext(null);
async function authFetch(path, body) {
  const response = await fetch(`/api/auth/${path}`, {
    method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store',
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok && !result.error) throw new Error('ไม่สามารถยืนยันตัวตนได้');
  return result;
}
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const refreshUser = useCallback(async () => {
    try {
      const result = await authFetch('session');
      if (result.error) throw new Error(result.error);
      setUser(result.user || null); setAuthError('');
    } catch { setUser(null); setAuthError('ตรวจสอบการเข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    // Discard the old browser-generated identity; never use it for authorization.
    sessionStorage.removeItem('authToken'); sessionStorage.removeItem('authUser');
    refreshUser();
    window.addEventListener('focus', refreshUser);
    window.addEventListener('population-session-expired', refreshUser);
    return () => { window.removeEventListener('focus', refreshUser); window.removeEventListener('population-session-expired', refreshUser); };
  }, [refreshUser]);
  const login = useCallback(async (username, password, lineAccessToken) => {
    try {
      const result = await authFetch('login', { username, password, lineAccessToken });
      if (result.success) { sessionStorage.removeItem('authManualLogout'); setUser(result.user); setAuthError(''); }
      return result;
    } catch { return { success: false, error: 'เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่' }; }
  }, []);
  const loginWithLine = useCallback(async accessToken => {
    try {
      const result = await authFetch('line', { accessToken });
      if (result.success) { sessionStorage.removeItem('authManualLogout'); setUser(result.user); setAuthError(''); }
      return result;
    } catch { return { success: false, error: 'เชื่อมต่อ LINE ไม่สำเร็จ กรุณาลองใหม่' }; }
  }, []);
  const logout = useCallback(async () => {
    try {
      const result = await authFetch('logout', {});
      if (!result.success) throw new Error(result.error);
      sessionStorage.setItem('authManualLogout','1'); setUser(null); return true;
    } catch { window.alert('ออกจากระบบไม่สำเร็จ กรุณาลองใหม่'); return false; }
  }, []);
  return <AuthContext.Provider value={{ user, loading, authError, refreshUser, login, loginWithLine, logout }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
export const ROLE_LABELS = { admin: 'Admin', staff: 'เจ้าหน้าที่', vhv: 'อสม.', manager: 'ผู้บริหาร' };
