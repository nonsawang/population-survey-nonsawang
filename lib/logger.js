import { supabase } from './supabase'; // ปรับ path ให้ตรงกับไฟล์ supabase ของคุณ

export async function writeLog(userId, username, action, detail, targetId = null) {
  try {
    const { error } = await supabase.from('activity_logs').insert({
      user_id: userId || null,
      username: username || 'system',
      action: action,
      details: detail || '', // ใช้คำว่า details หรือ detail ตามคอลัมน์ใน Supabase ของคุณ
      target_id: targetId ? String(targetId) : null,
      // created_at ไม่ต้องใส่ก็ได้ครับ ปกติ Supabase จะสร้างเวลาปัจจุบันให้อัตโนมัติ (Default value: now())
    });

    if (error) throw error;
  } catch (error) {
    console.error('writeLog error:', error.message);
  }
}