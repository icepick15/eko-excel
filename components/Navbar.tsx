'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import { Role } from '@/lib/types';
import { notificationStore } from '@/lib/storage';
import Image from 'next/image';

const ROLE_LABELS: Record<Role, string> = {
  [Role.TEACHER]:     'Teacher',
  [Role.HEADTEACHER]: 'Head Teacher',
  [Role.SCHOOLADMIN]: 'School Admin',
  [Role.DISTRICT]:    'District Officer',
  [Role.MINISTRY]:    'Ministry Official',
  [Role.PARENT]:      'Parent',
  [Role.STUDENT]:     'Student',
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();

  if (!user) return null;

  const unread = notificationStore.getUnread(user.id).length;

  function handleLogout() {
    logout();
    router.push('/login');
  }

  function navItems() {
    if (user!.role === Role.TEACHER) {
      return [
        { label: 'Dashboard',   href: '/dashboard' },
        { label: 'Diary',       href: '/diary' },
        { label: 'Homework',    href: '/homework' },
        { label: 'Hotspots',    href: '/hotspots' },
        { label: 'Interventions', href: '/interventions' },
      ];
    }
    if (user!.role === Role.HEADTEACHER || user!.role === Role.SCHOOLADMIN) {
      return [
        { label: 'School',        href: '/school' },
        { label: 'Interventions', href: '/interventions' },
      ];
    }
    if (user!.role === Role.DISTRICT) {
      return [
        { label: 'District', href: '/district' },
        { label: 'Reports',  href: '/reports'  },
      ];
    }
    if (user!.role === Role.MINISTRY) {
      return [
        { label: 'Ministry', href: '/ministry' },
        { label: 'Reports',  href: '/reports'  },
      ];
    }
    if (user!.role === Role.STUDENT) {
      return [
        { label: 'Dashboard', href: '/student' },
        { label: 'Homework',  href: '/homework' },
        { label: 'Quiz',      href: '/quiz' },
        { label: 'AI Tutor',  href: '/tutor' },
      ];
    }
    if (user!.role === Role.PARENT) {
      return [{ label: 'Report', href: '/parent' }];
    }
    return [];
  }

  const items = navItems();

  return (
    <nav style={{ background: '#0033A0' }} className="text-white shadow-lg">
      {/* Top banner */}
      <div style={{ background: '#008751', fontSize: '0.7rem' }} className="text-center py-1 font-medium tracking-wide">
        LAGOS STATE GOVERNMENT &nbsp;|&nbsp; MINISTRY OF EDUCATION &nbsp;|&nbsp; Justice and Progress
      </div>

      {/* Main navbar */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3 cursor-pointer shrink-0" onClick={() => router.push('/dashboard')}>
          <div className="w-9 h-9 rounded-full overflow-hidden shrink-0" style={{ border: '2px solid #FFCC00' }}>
            <Image src="/logo.png" alt="Lagos State" width={36} height={36} className="w-full h-full object-cover" priority />
          </div>
          <div className="hidden sm:block">
            <div className="font-bold text-base leading-none tracking-tight">Eko Excel</div>
            <div style={{ color: '#A8C4F0', fontSize: '0.65rem' }}>Student Excellence Platform</div>
          </div>
        </div>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-1 overflow-x-auto">
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap transition-colors"
              style={{
                background: pathname.startsWith(item.href) && item.href !== '/dashboard' ? 'rgba(255,255,255,0.15)' :
                  pathname === item.href ? 'rgba(255,255,255,0.15)' : 'transparent',
                color: 'rgba(255,255,255,0.85)',
              }}
            >
              {item.label}
            </a>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Notification bell */}
          <button
            onClick={() => router.push('/notifications')}
            className="relative w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.1)' }}
          >
            <span style={{ fontSize: 16 }}>🔔</span>
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-white font-bold flex items-center justify-center"
                style={{ background: '#E30613', fontSize: '10px' }}>
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {/* User avatar */}
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-xs font-semibold leading-none">{user.name.split(' ')[0]}</span>
            <span style={{ color: '#A8C4F0', fontSize: '0.6rem' }}>{ROLE_LABELS[user.role]}</span>
          </div>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
            style={{ background: '#FFCC00', color: '#0033A0' }}
          >
            {user.name.charAt(0)}
          </div>

          <button
            onClick={handleLogout}
            className="text-xs px-2 py-1.5 rounded-md border transition-colors hidden sm:block"
            style={{ borderColor: 'rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.8)' }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Mobile nav (shown below md) */}
      {items.length > 0 && (
        <div className="md:hidden flex overflow-x-auto gap-1 px-4 pb-2">
          {items.map((item) => (
            <a key={item.href} href={item.href}
              className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0"
              style={{
                background: pathname === item.href ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.9)',
              }}>
              {item.label}
            </a>
          ))}
          <a href="/notifications"
            className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.9)' }}>
            🔔{unread > 0 ? ` ${unread}` : ''}
          </a>
        </div>
      )}
    </nav>
  );
}
