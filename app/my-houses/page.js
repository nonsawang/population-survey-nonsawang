'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import TopBar from '@/components/TopBar';
import SurveyWorkPanel from '@/components/SurveyWorkPanel';
import MyHouseSurveyProgress from '@/components/MyHouseSurveyProgress';
import PendingTransfersBanner from '@/components/PendingTransfersBanner';

export default function MyHousesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    else if (user && user.role !== 'vhv') router.replace('/tracking');
  }, [user, loading, router]);

  if (loading) {
    return (
      <p role="status" className="text-center py-5 fw-bold">
        กำลังโหลดรายชื่อบ้านที่รับผิดชอบ…
      </p>
    );
  }
  if (!user || user.role !== 'vhv') return null;

  const openHouse = (moo, house) =>
    router.push('/?' + new URLSearchParams({ moo: String(moo), house: String(house) }).toString());

  return (
    <>
      <TopBar />
      <main className="container survey-page py-3 py-md-4">
        {/* ส่วนหัวต้อนรับ อสม. ตัวหนังสือใหญ่ ปุ่มดูวิดีโอสอนใช้งานกดง่าย */}
        <div
          className="card border-0 shadow-sm mb-3"
          style={{ borderRadius: 16, background: 'white' }}
        >
          <div className="card-body p-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div>
              <h1 className="h4 fw-bold text-dark mb-1">
                👩‍⚕️ บ้านที่ฉันรับผิดชอบ
              </h1>
              <div className="text-muted" style={{ fontSize: '.96rem' }}>
                อสม. <strong className="text-primary">{user.displayName}</strong>{' '}
                {user.moo && <span>(หมู่ที่ {user.moo})</span>}
              </div>
            </div>
            <a
              href="/vhv-guide"
              className="btn btn-outline-success rounded-pill px-3 fw-bold d-flex align-items-center"
              style={{ minHeight: 44, fontSize: '.95rem' }}
            >
              <i className="fa-solid fa-circle-play me-2" /> วิดีโอสอนใช้งาน อสม.
            </a>
          </div>
        </div>

        <PendingTransfersBanner
          user={user}
          onResolved={() => setRefreshKey((k) => k + 1)}
          onOpenHouse={openHouse}
        />

        <MyHouseSurveyProgress user={user} refreshKey={refreshKey} />

        <details className="mt-4">
          <summary
            className="text-muted small py-2"
            style={{ cursor: 'pointer' }}
          >
            🖨️ พิมพ์ใบงานกระดาษ / ดูตารางแยกตามประเภทอยู่อาศัย (สำหรับพิมพ์ออกกระดาษ)
          </summary>
          <SurveyWorkPanel
            user={user}
            personal
            refreshKey={refreshKey}
            opening={false}
            onOpenHouse={openHouse}
          />
        </details>
      </main>
    </>
  );
}
