'use client';
import dynamic from 'next/dynamic';
import TopBar from '@/components/TopBar';
import { useAuth } from '@/lib/auth';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// 🟢 โหลด Map แบบ "ปิด SSR" (แก้ปัญหาหน้าจอขาว)
const MapWithNoSSR = dynamic(
  () => import('./MapComponent'),
  { 
    ssr: false, 
    loading: () => <div className="text-center py-5"><span className="spinner-border text-primary me-2" /> กำลังโหลดข้อมูลแผนที่...</div> 
  }
);

export default function MapPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!loading && !user) router.replace('/login'); }, [loading,user,router]);
  if (loading || !user) return <p className="text-center py-5">กำลังตรวจสอบสิทธิ์...</p>;
  return (
    <>
      <TopBar showAdmin />
      <MapWithNoSSR />
    </>
  );
}
