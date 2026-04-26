'use client';
import { useAuth, ROLE_LABELS } from '@/lib/auth';
import { useRouter } from 'next/navigation';

export default function TopBar({ showAdmin = false, showLogoutConfirm = false }) {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    if (showLogoutConfirm) {
      if (!confirm('ออกจากระบบ?')) return;
    }
    logout();
    router.push('/login');
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
