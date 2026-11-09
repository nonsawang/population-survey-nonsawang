'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import TopBar from '@/components/TopBar';
import SurveyWorkPanel from '@/components/SurveyWorkPanel';
import PendingTransfersBanner from '@/components/PendingTransfersBanner';

export default function TrackingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  if (loading) return <p className="text-center py-5" role="status">กำลังโหลด…</p>;
  if (!user) return null;

  const openHouse = (moo, house) =>
    router.push('/?' + new URLSearchParams({ moo: String(moo), house: String(house) }).toString());

  return (
    <>
      <TopBar />
      <main className="container survey-page py-4">
        <header className="survey-heading">
          <div>
            <p className="survey-eyebrow">ระบบสุขภาพโนนสว่าง</p>
            <h1>ติดตามงานสำรวจ</h1>
            <p>ดูความก้าวหน้าและบ้านที่ยังสำรวจไม่ครบ แล้วเลือกบ้านเพื่อดำเนินการต่อ</p>
          </div>
          <a className="btn btn-primary" href={user.role === 'vhv' ? '/?survey=1' : '/'}>
            ค้นหาบ้านเพื่อสำรวจ
          </a>
        </header>
        <PendingTransfersBanner
          user={user}
          onResolved={() => setRefreshKey((k) => k + 1)}
          onOpenHouse={openHouse}
        />
        <SurveyWorkPanel
          user={user}
          refreshKey={refreshKey}
          opening={false}
          onOpenHouse={openHouse}
        />
      </main>
    </>
  );
}
