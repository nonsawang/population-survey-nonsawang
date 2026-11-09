'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import TopBar from '@/components/TopBar';
import SurveyWorkPanel from '@/components/SurveyWorkPanel';
import PendingTransfersBanner from '@/components/PendingTransfersBanner';

export default function MyHousesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    else if (user && user.role !== 'vhv') router.replace('/tracking');
  }, [user, loading, router]);

  if (loading) return <p role="status" className="text-center py-5">กำลังโหลดบ้านที่รับผิดชอบ…</p>;
  if (!user || user.role !== 'vhv') return null;

  const openHouse = (moo, house) =>
    router.push('/?' + new URLSearchParams({ moo: String(moo), house: String(house) }).toString());

  return (
    <>
      <TopBar />
      <main className="container survey-page py-4">
        <h1>บ้านที่ฉันรับผิดชอบ</h1>
        <p>{user.displayName} • เลือก “สำรวจครบ” เพื่อดูบ้านที่บันทึกครบแล้ว หรือเลือกงานที่ยังไม่ครบเพื่อติดตามต่อ</p>
        <PendingTransfersBanner
          user={user}
          onResolved={() => setRefreshKey((k) => k + 1)}
          onOpenHouse={openHouse}
        />
        <SurveyWorkPanel
          user={user}
          personal
          refreshKey={refreshKey}
          opening={false}
          onOpenHouse={openHouse}
        />
      </main>
    </>
  );
}
