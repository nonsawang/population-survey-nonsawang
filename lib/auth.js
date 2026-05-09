'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';

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
    const cleanUsername = username.trim().toLowerCase();
    
    // 🕵️‍♂️ เบาะแสที่ 1: ดูว่าระบบกำลังพยายามค้นหาใคร
    console.log("👉 1. กำลังค้นหา User:", cleanUsername);

    const { data: users, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('username', cleanUsername)
      .eq('is_active', true); // 🚨 ด่านสำคัญ: ในฐานข้อมูล ช่อง is_active ต้องเป็น true เท่านั้น!

    if (error) console.error("❌ Supabase Error:", error);
    
    // 🕵️‍♂️ เบาะแสที่ 2: ดูว่า Supabase ค้นหาเจอไหม?
    console.log("👉 2. ข้อมูลที่เจอใน Supabase:", users);

    if (error || !users?.length) {
      return { success: false, error: 'ไม่พบชื่อผู้ใช้ (หรือลืมติ๊ก is_active หรือติด RLS)' };
    }

    const u = users[0];
    const encoder = new TextEncoder();
    const data256 = await crypto.subtle.digest('SHA-256', encoder.encode(password));
    const hash256 = Array.from(new Uint8Array(data256)).map(b => b.toString(16).padStart(2, '0')).join('');
    
    // 🕵️‍♂️ เบาะแสที่ 3: เทียบ Hash รหัสผ่านให้เห็นจะๆ
    console.log("👉 3. รหัส Hash ที่แปลงจากการพิมพ์:", hash256);
    console.log("👉 4. รหัส Hash ในฐานข้อมูล:", u.password_hash);

    if (hash256 !== u.password_hash) {
      return { success: false, error: 'รหัสผ่านไม่ถูกต้อง (Hash ไม่ตรงกัน)' };
    }
    
    const newToken = crypto.randomUUID();
    const session = { token: newToken, username: u.username, displayName: u.display_name, role: u.role, moo: u.moo || '', userId: u.id, avatarUrl: u.avatar_url };
    sessionStorage.setItem('authToken', newToken);
    sessionStorage.setItem('authUser', JSON.stringify(session));
    setToken(newToken);
    setUser(session);
    return { success: true, user: session };
  }, []);

  const loginWithLine = useCallback(async (lineId) => {
    const { data: users, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('line_user_id', lineId)
      .eq('is_active', true);
    
    if (error || !users?.length) return { success: false, error: 'ไม่พบบัญชีที่ผูกกับ LINE นี้' };

    const u = users[0];
    const newToken = crypto.randomUUID();
    const session = { token: newToken, username: u.username, displayName: u.display_name, role: u.role, moo: u.moo || '', userId: u.id, avatarUrl: u.avatar_url };
    sessionStorage.setItem('authToken', newToken);
    sessionStorage.setItem('authUser', JSON.stringify(session));
    setToken(newToken);
    setUser(session);
    return { success: true, user: session };
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