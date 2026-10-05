'use client';
import { useAuth, ROLE_LABELS } from '@/lib/auth';
import { useState, useEffect, useId } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import ProfileAvatar from '@/components/ProfileAvatar';

export default function TopBar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  useEffect(() => setMenuOpen(false), [pathname]);
  const mainLinks = [
    ['/', 'สำรวจครัวเรือน', 'fa-house-user'],
    ['/screening', 'คัดกรองรายบุคคล', 'fa-heart-pulse'],
    ['/map', 'แผนที่', 'fa-map-location-dot'],
    ['/dashboard', 'ภาพรวม', 'fa-chart-pie'],
  ];
  const links = user?.role === 'manager' ? [mainLinks[3], ...mainLinks.slice(0, 3)] : mainLinks;
  const navLink = ([href, label, icon]) => <Link key={href} href={href} onClick={() => setMenuOpen(false)} className={`top-bar-link${pathname === href ? ' is-active' : ''}`} aria-current={pathname === href ? 'page' : undefined}><i className={`fa-solid ${icon}`} aria-hidden="true" />{label}</Link>;


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
      }).then(async r => {
        if (r.isConfirmed && await logout()) router.push('/login');
      });
    } else {
      if (confirm('ออกจากระบบ?')) logout().then(ok => { if (ok) router.push('/login'); });
    }
  };

  return (
    <header className="top-bar app-navigation" onKeyDown={event => { if (event.key === 'Escape') { setMenuOpen(false); document.getElementById(`${menuId}-toggle`)?.focus(); } }}>
      <Link className="top-bar-brand" href={user?.role === 'manager' ? '/dashboard' : '/'}>
        <i className="fa-solid fa-hospital me-2" aria-hidden="true" /><strong>ระบบสุขภาพโนนสว่าง</strong>
      </Link>
      {user && <>
        <button type="button" id={`${menuId}-toggle`} className="top-bar-menu-toggle" aria-expanded={menuOpen} aria-controls={menuId} onClick={() => setMenuOpen(!menuOpen)}><i className={`fa-solid ${menuOpen ? 'fa-xmark' : 'fa-bars'}`} aria-hidden="true" /> {menuOpen ? 'ปิดเมนู' : 'เมนู'}</button>
        <div id={menuId} className={`top-bar-panel${menuOpen ? ' is-open' : ''}`}>
          <nav className="top-bar-main" aria-label="งานหลัก">{links.map(navLink)}</nav>
          {['staff','admin'].includes(user.role) && <nav className="top-bar-tools" aria-label="เครื่องมือเจ้าหน้าที่">
            {navLink(['/hosxp-review', 'ตรวจสอบก่อนส่ง HOSxP', 'fa-list-check'])}
            {user.role === 'admin' && navLink(['/admin', 'ผู้ดูแล', 'fa-users-gear'])}
          </nav>}
          <div className="top-bar-account">
            <ProfileAvatar src={user.avatarUrl} name={user.displayName || user.username} size={32} />
            <span>{user.displayName || user.username}<small className="d-block">{ROLE_LABELS[user.role] || user.role}</small></span>
            <button type="button" onClick={handleLogout} className="btn-topbar-logout"><i className="fa-solid fa-right-from-bracket" aria-hidden="true" /> ออกจากระบบ</button>
          </div>
        </div>
      </>}
    </header>
  );
}
