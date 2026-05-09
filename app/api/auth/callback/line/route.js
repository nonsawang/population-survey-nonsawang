import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET(request) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');

  if (!code) return NextResponse.redirect(new URL('/login?error=no_code', request.url));

  try {
    const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: 'https://population-survey-nonsawang.vercel.app/api/auth/callback/line', // อย่าลืมแก้ตอนขึ้น Vercel นะครับ
        client_id: process.env.NEXT_PUBLIC_LINE_CLIENT_ID,
        client_secret: process.env.LINE_CLIENT_SECRET,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.access_token) {
      const profileResponse = await fetch('https://api.line.me/v2/profile', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const profileData = await profileResponse.json();
      
      const lineUserId = profileData.userId;
      const lineName = profileData.displayName;
      const linePicture = profileData.pictureUrl; // 🟢 ดึง URL รูปโปรไฟล์มาด้วย

      const { data: user } = await supabase
        .from('app_users')
        .select('*')
        .eq('line_user_id', lineUserId)
        .single();

      if (user) {
        // 🟢 ถ้าเคยผูกบัญชีไว้แล้ว ให้อัปเดตรูปภาพล่าสุดจาก LINE เข้าไปใหม่ด้วยเลย
        await supabase.from('app_users').update({ avatar_url: linePicture }).eq('line_user_id', lineUserId);
        return NextResponse.redirect(new URL(`/login?auto_login=true&line_id=${lineUserId}`, request.url));
      } else {
        // 🟢 ถ้ายังไม่เคยผูกบัญชี ให้ส่ง URL รูปไปรอที่หน้า Login ด้วย
        return NextResponse.redirect(new URL(`/login?link_line_id=${lineUserId}&line_name=${encodeURIComponent(lineName)}&picture_url=${encodeURIComponent(linePicture)}`, request.url));
      }
    }
  } catch (error) {
    console.error("LINE Auth Error:", error);
  }
  return NextResponse.redirect(new URL('/login?error=login_failed', request.url));
}