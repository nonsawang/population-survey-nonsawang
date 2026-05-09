import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: "ไม่พบ Code จาก LINE", details: "LINE ไม่ได้ส่ง Code กลับมาให้" });
  }

  try {
    const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${origin}/api/auth/callback/line`,
        client_id: process.env.NEXT_PUBLIC_LINE_CLIENT_ID,
        client_secret: process.env.LINE_CLIENT_SECRET,
      }),
    });

    const tokenData = await tokenResponse.json();
    
    // 🔴 จุดจับผิด: ถ้าแลก Token ไม่ผ่าน ให้โชว์ออกมาเลยว่าพลาดเพราะอะไร
    if (tokenData.error) {
      return NextResponse.json({ 
        error: "แลก Token จาก LINE ไม่สำเร็จ", 
        line_error_message: tokenData.error_description,
        check_client_id: process.env.NEXT_PUBLIC_LINE_CLIENT_ID ? "มีค่า" : "ว่างเปล่า",
        check_client_secret: process.env.LINE_CLIENT_SECRET ? "มีค่า" : "ว่างเปล่า",
        used_redirect_uri: `${origin}/api/auth/callback/line`
      });
    }

    const profileResponse = await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileResponse.json();

    const lineId = profile.userId;
    const name = encodeURIComponent(profile.displayName);
    const pic = encodeURIComponent(profile.pictureUrl || '');
    
    return NextResponse.redirect(`${origin}/login?auto_login=true&line_id=${lineId}&line_name=${name}&picture_url=${pic}`);

  } catch (error) {
    return NextResponse.json({ error: "ระบบหลังบ้านพัง (Server Crash)", message: error.message });
  }
}