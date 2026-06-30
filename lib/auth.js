'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { writeLog } from './logger'; // นำเข้า writeLog

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = sessionStorage.getItem('authToken');
    const savedUser = sessionStorage.getItem('authUser');
    if (savedToken && savedUser) {
      setToken(savedToken);
      try { setUser(JSON.parse(savedUser)); } catch(e) {}
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (username, password) => {
    // ... โค้ดส่วน login ปกติ ...
  }, []);

  // 🟢 ฟังก์ชัน loginWithLine ที่รวมตรรกะใหม่ทั้งหมดไว้ข้างใน
  const loginWithLine = useCallback(async (lineId) => {
    const { data: users, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('line_user_id', lineId);
    
    if (error || !users?.length) {
      return { success: false, status: 'NOT_FOUND', error: 'ไม่พบบัญชีที่ผูกกับ LINE นี้' };
    }

    const u = users[0];

    if (!u.is_active) {
      return { success: false, status: 'INACTIVE', error: 'บัญชีรอการอนุมัติ หรือถูกระงับ' };
    }

    const newToken = crypto.randomUUID();
    const session = { 
      token: newToken, username: u.username, displayName: u.display_name, 
      role: u.role, moo: u.moo || '', userId: u.id, avatarUrl: u.avatar_url 
    };
    
    sessionStorage.setItem('authToken', newToken);
    sessionStorage.setItem('authUser', JSON.stringify(session));
    setToken(newToken);
    setUser(session);

    // 🎯 บันทึก Log เมื่อ Login ผ่าน
    await writeLog(u.id, u.username, 'LOGIN', 'เข้าสู่ระบบสำเร็จ (LINE)');

    let targetUrl = '/survey';
    if (u.role === 'admin' || u.role === 'manager') {
      targetUrl = '/dashboard';
    }

    return { success: true, user: session, redirectUrl: targetUrl };
  }, []);

  const logout = useCallback(() => {
    sessionStorage.clear();
    setUser(null);
    setToken(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, loginWithLine, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export const ROLE_LABELS = { admin: 'Admin', staff: 'เจ้าหน้าที่', vhv: 'อสม.', manager: 'ผู้บริหาร' };