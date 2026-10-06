 'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import TopBar from '@/components/TopBar';
import SurveyWorkPanel from '@/components/SurveyWorkPanel';

export default function TrackingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!loading && !user) router.replace('/login'); }, [user, loading, router]);
  if (loading) return <p className="text-center py-5" role="status">กำลังโหลด…</p>;
  if (!user) return null;
  return <><TopBar /><main className="container survey-page py-4">
    <header className="survey-heading"><div><p className="survey-eyebrow">ระบบสุขภาพโนนสว่าง</p><h1>ติดตามงานสำรวจ</h1><p>ดูความก้าวหน้าและบ้านที่ยังสำรวจไม่ครบ แล้วเลือกบ้านเพื่อดำเนินการต่อ</p></div><a className="btn btn-primary" href="/">ค้นหาบ้านเพื่อสำรวจ</a></header>
    <SurveyWorkPanel user={user} refreshKey={0} opening={false} onOpenHouse={(moo, house) => router.push('/?' + new URLSearchParams({ moo: String(moo), house: String(house) }).toString())} />
  </main></>;
}
