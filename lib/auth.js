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
    try {
      // 1. ค้นหาผู้ใช้จากตาราง app_users โดยใช้ username
      const { data: users, error } = await supabase
        .from('app_users')
        .select('*')
        .eq('username', username);
      
      // 2. ถ้ามี Error หรือไม่พบผู้ใช้ในระบบ
      if (error || !users?.length) {
        return { success: false, status: 'NOT_FOUND', error: 'ไม่พบข้อมูล อสม. หรือเจ้าหน้าที่ในระบบ' };
      }

      const u = users[0];

      // 3. ตรวจสอบสถานะการใช้งาน
      if (!u.is_active) {
        return { success: false, status: 'INACTIVE', error: 'บัญชีนี้รอการอนุมัติ หรือถูกระงับการใช้งาน' };
      }

      // 🎯 4. ตรวจสอบรหัสผ่าน (นำ password ที่รับมาเทียบกับ password_hash ในฐานข้อมูล)
      if (u.password_hash !== password) {
        return { success: false, status: 'WRONG_PASSWORD', error: 'รหัสผ่านหรือเลขบัตรประชาชนไม่ถูกต้อง' };
      }

      // 5. เมื่อข้อมูลถูกต้องทั้งหมด -> สร้าง Session
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
      
      // บันทึกลง Storage
      sessionStorage.setItem('authToken', newToken);
      sessionStorage.setItem('authUser', JSON.stringify(session));
      setToken(newToken);
      setUser(session);

      // 🎯 6. บันทึก Log การเข้าสู่ระบบแบบปกติ
      await writeLog(u.id, u.username, 'LOGIN', 'เข้าสู่ระบบสำเร็จ (รหัสผ่าน)');

      // 7. กำหนดหน้าที่จะย้ายไป (เหมือน loginWithLine)
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