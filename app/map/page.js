'use client';
import dynamic from 'next/dynamic';
import TopBar from '@/components/TopBar';

// 🟢 โหลด Map แบบ "ปิด SSR" (แก้ปัญหาหน้าจอขาว)
const MapWithNoSSR = dynamic(
  () => import('./MapComponent'),
  { 
    ssr: false, 
    loading: () => <div className="text-center py-5"><span className="spinner-border text-primary me-2" /> กำลังโหลดข้อมูลแผนที่...</div> 
  }
);

export default function MapPage() {
  return (
    <>
      <TopBar showAdmin />
      <MapWithNoSSR />
    </>
  );
}