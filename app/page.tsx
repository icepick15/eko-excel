'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Role } from '@/lib/types';

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role === Role.TEACHER) router.replace('/dashboard');
    else if (user.role === Role.HEADTEACHER || user.role === Role.SCHOOLADMIN) router.replace('/school');
    else if (user.role === Role.DISTRICT) router.replace('/district');
    else if (user.role === Role.MINISTRY) router.replace('/ministry');
    else if (user.role === Role.STUDENT) router.replace('/student');
    else if (user.role === Role.PARENT) router.replace('/parent');
    else router.replace('/dashboard');
  }, [user, isLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--lagos-blue)' }}>
      <div className="text-white text-center">
        <div className="text-2xl font-bold mb-2">Eko Learn</div>
        <div className="text-blue-200 text-sm">Loading...</div>
      </div>
    </div>
  );
}
