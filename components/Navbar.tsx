'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import { Role } from '@/lib/types';
import Image from 'next/image';

const ROLE_LABELS: Record<Role, string> = {
  [Role.TEACHER]: 'Teacher',
  [Role.HEADTEACHER]: 'Head Teacher',
  [Role.DISTRICT]: 'District Officer',
  [Role.MINISTRY]: 'Ministry Official',
  [Role.PARENT]: 'Parent',
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  if (!user) return null;

  function handleLogout() {
    logout();
    router.push('/login');
  }

  function navItems() {
    if (user!.role === Role.TEACHER) {
      return [
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'New Diary Entry', href: '/diary' },
        { label: 'My Students', href: '/school' },
      ];
    }
    if (user!.role === Role.HEADTEACHER) {
      return [
        { label: 'School Overview', href: '/school' },
        { label: 'Hotspots', href: '/school#hotspots' },
      ];
    }
    if (user!.role === Role.DISTRICT) {
      return [{ label: 'District Dashboard', href: '/district' }];
    }
    if (user!.role === Role.MINISTRY) {
      return [{ label: 'Ministry Overview', href: '/ministry' }];
    }
    return [];
  }

  return (
    <nav style={{ background: 'var(--lagos-blue)' }} className="text-white shadow-lg">
      {/* Top banner */}
      <div style={{ background: 'var(--lagos-green)', fontSize: '0.7rem' }} className="text-center py-1 font-medium tracking-wide">
        LAGOS STATE GOVERNMENT &nbsp;|&nbsp; MINISTRY OF EDUCATION &nbsp;|&nbsp; Justice and Progress
      </div>

      {/* Main navbar */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push('/dashboard')}>
          {/* Lagos coat of arms placeholder (white circle with text) */}
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ background: 'white', color: 'var(--lagos-blue)', lineHeight: '1' }}
          >
            <span style={{ fontSize: '0.55rem', textAlign: 'center', lineHeight: '1.1' }}>LAGOS<br/>STATE</span>
          </div>
          <div>
            <div className="font-bold text-lg leading-none tracking-tight">Eko Excel</div>
            <div style={{ color: '#A8C4F0', fontSize: '0.7rem' }}>Student Excellence Platform</div>
          </div>
        </div>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-1">
          {navItems().map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="px-3 py-2 rounded-md text-sm font-medium transition-colors"
              style={{
                background: pathname === item.href ? 'rgba(255,255,255,0.15)' : 'transparent',
                color: pathname === item.href ? 'white' : 'rgba(255,255,255,0.8)',
              }}
            >
              {item.label}
            </a>
          ))}
        </div>

        {/* User info */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-semibold">{user.name}</div>
            <div style={{ color: '#A8C4F0', fontSize: '0.7rem' }}>
              {ROLE_LABELS[user.role]}
            </div>
          </div>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
            style={{ background: 'var(--lagos-gold)', color: 'white' }}
          >
            {user.name.charAt(0)}
          </div>
          <button
            onClick={handleLogout}
            className="text-xs px-3 py-1.5 rounded-md border border-white/30 hover:bg-white/10 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
