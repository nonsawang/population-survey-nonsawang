'use client';
import { useAuth, ROLE_LABELS } from '@/lib/auth';
import { useRouter } from 'next/navigation';

export default function TopBar({ showAdmin = false }) {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    const S = typeof window !== 'undefined' ? window.Swal : null;
    if (S) {
      S.fire({
        title: 'ออกจากระบบ?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'ออกจากระบบ',
        cancelButtonText: 'ยกเลิก'
      }).then(r => {
        if (r.isConfirmed) { logout(); router.push('/login'); }
      });
    } else {
      if (confirm('ออกจากระบบ?')) { logout(); router.push('/login'); }
    }
  };

  return (
    <div className="top-bar">
      <a className="top-bar-brand" href="/">
        <i className="fa-solid fa-hospital me-2" style={{opacity:.7}} /><strong>รพ.สต.บ้านโนนสว่าง</strong>
      </a>
      <div className="top-bar-actions">
        {user && (
          // 🟢 ปรับให้ใช้ flex เพื่อให้รูปภาพและข้อความอยู่กึ่งกลางบรรทัดเดียวกัน
          <span style={{opacity:.9, fontSize:'.85rem', display:'flex', alignItems:'center', gap:'6px'}}>
            
            {/* 🟢 เช็กว่ามีรูปโปรไฟล์ LINE หรือไม่ */}
            {user.avatarUrl ? (
              <img 
                src={user.avatarUrl} 
                alt="Profile" 
                className="rounded-circle shadow-sm" 
                style={{ width: '28px', height: '28px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.5)' }} 
              />
            ) : (
              <i className="fa-solid fa-circle-user fa-lg" />
            )}

            <span>
              {user.displayName || user.username}{' '}
              <span style={{opacity:.6,fontSize:'.78em'}}>({ROLE_LABELS[user.role] || user.role})</span>
            </span>
          </span>
        )}

        {/* 🟢 ปุ่มลิงก์ไปหน้าแผนที่ (แสดงเมื่อล็อกอินแล้ว) */}
        {user && (
          <a className="top-bar-link" href="/map" title="ดูแผนที่พิกัดบ้าน">
            <i className="fa-solid fa-map-location-dot" /> แผนที่
          </a>
        )}

        {showAdmin && user?.role === 'admin' && (
          <a className="top-bar-link" href="/admin">
            <i className="fa-solid fa-users-gear" /> ผู้ดูแล
          </a>
        )}
        <button onClick={handleLogout} className="btn-topbar-logout">
          <i className="fa-solid fa-right-from-bracket" /> ออกจากระบบ
        </button>
      </div>
    </div>
  );
}