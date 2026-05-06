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
      <div><i className="fa-solid fa-hospital me-2" style={{opacity:.7}} /><strong>รพ.สต.บ้านโนนสว่าง</strong></div>
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        {user && (
          <span style={{opacity:.9,fontSize:'.85rem'}}>
            <i className="fa-solid fa-circle-user me-1" />
            {user.displayName || user.username}{' '}
            <span style={{opacity:.6,fontSize:'.78em'}}>({ROLE_LABELS[user.role] || user.role})</span>
          </span>
        )}
        {showAdmin && user?.role === 'admin' && (
          <span style={{cursor:'pointer',color:'rgba(255,255,255,.7)',fontSize:'.8rem'}} onClick={() => router.push('/admin')}>
            <i className="fa-solid fa-users-gear" /> Admin
          </span>
        )}
        <button onClick={handleLogout} className="btn-topbar-logout">
          <i className="fa-solid fa-right-from-bracket" /> ออก
        </button>
      </div>
    </div>
  );
}
