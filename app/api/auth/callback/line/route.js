import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) return NextResponse.redirect(`${origin}/login?error=no_code`);

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
    if (tokenData.error) return NextResponse.redirect(`${origin}/login?error=token_failed`);

    const profileResponse = await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileResponse.json();

    // 🟢 ส่งกลับหน้า login พร้อมบอกว่าให้ลอง auto_login ดูก่อน
    const lineId = profile.userId;
    const name = encodeURIComponent(profile.displayName);
    const pic = encodeURIComponent(profile.pictureUrl || '');
    
    return NextResponse.redirect(`${origin}/login?auto_login=true&line_id=${lineId}&line_name=${name}&picture_url=${pic}`);

  } catch (error) {
    return NextResponse.redirect(`${origin}/login?error=server_error`);
  }
}