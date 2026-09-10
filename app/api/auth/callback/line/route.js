import { NextResponse } from 'next/server';
// LIFF is the supported login flow. Never accept identity from callback query parameters.
export async function GET(request) {
  return NextResponse.redirect(new URL('/login', request.url));
}
