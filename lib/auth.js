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

  // 🎯 1. ฟังก์ชันล็อกอินด้วยรหัสผ่าน (ที่อัปเดตใหม่)
  const login = useCallback(async (username, password) => {
    try {
      const { data: users, error } = await supabase
        .from('app_users')
        .select('*')
        .eq('username', username);
      
      if (error || !users?.length) {
        return { success: false, status: 'NOT_FOUND', error: 'ไม่พบข้อมูล อสม. หรือเจ้าหน้าที่ในระบบ' };
      }

      const u = users[0];

      if (!u.is_active) {
        return { success: false, status: 'INACTIVE', error: 'บัญชีนี้รอการอนุมัติ หรือถูกระงับการใช้งาน' };
      }

      if (u.password_hash !== password) {
        return { success: false, status: 'WRONG_PASSWORD', error: 'รหัสผ่านหรือเลขบัตรประชาชนไม่ถูกต้อง' };
      }

      const newToken = crypto.randomUUID();
      const session = { 
        token: newToken, 
        username: u.username, 
        displayName: u.display_name, 
        role: u.role, 
        moo: u.moo || '', 
        userId: u.id, 
        avatarUrl: u.avatar_url 
      };
      
      sessionStorage.setItem('authToken', newToken);
      sessionStorage.setItem('authUser', JSON.stringify(session));
      setToken(newToken);
      setUser(session);

      await writeLog(u.id, u.username, 'LOGIN', 'เข้าสู่ระบบสำเร็จ (รหัสผ่าน)');

      let targetUrl = '/survey';
      if (u.role === 'admin' || u.role === 'manager') {
        targetUrl = '/dashboard';
      }

      return { success: true, user: session, redirectUrl: targetUrl };

    } catch (err) {
      console.error('System Login Error:', err);
      return { success: false, error: 'เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล' };
    }
  }, []);

  // 🎯 2. ฟังก์ชันล็อกอินด้วย LINE (นำกลับมาใส่ให้ครบถ้วน)
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