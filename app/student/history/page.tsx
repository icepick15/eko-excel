'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Role } from '@/lib/types';
import type { Student, Class, AcademicHistoryRecord } from '@/lib/types';
import { studentStore, classStore, schoolStore } from '@/lib/storage';
import { getAcademicHistory } from '@/lib/history';
import { formatStudentId } from '@/lib/format';
import Navbar from '@/components/Navbar';

const TERM_LABELS = ['1st Term', '2nd Term', '3rd Term'];

export default function AcademicHistoryPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [student, setStudent] = useState<Student | null>(null);
  const [cls,     setCls]     = useState<Class | null>(null);
  const [schoolName, setSchoolName] = useState('');
  const [records, setRecords] = useState<AcademicHistoryRecord[]>([]);

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.role !== Role.STUDENT || !user.studentId) { router.replace('/dashboard'); return; }

    const s = studentStore.getById(user.studentId);
    setStudent(s ?? null);
    if (s) {
      setCls(classStore.getById(s.classId) ?? null);
      setSchoolName(schoolStore.getById(s.schoolId)?.name ?? '');
      setRecords(getAcademicHistory(s.id));
    }
  }, [user, isLoading, router]);

  if (isLoading || !student) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0033A0' }}>
        <div className="text-white text-center">
          <div className="text-2xl font-black mb-2">Eko Learn</div>
          <div className="text-sm opacity-60 animate-pulse">Loading academic history...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#F5F7FA' }}>
      <Navbar />

      <main className="max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto px-4 md:px-6 py-5 md:py-8 pb-10">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="rounded-2xl p-5 md:p-7 mb-4 relative overflow-hidden" style={{ background: '#0033A0', color: 'white' }}>
          <div className="relative z-10">
            <button onClick={() => router.push('/student')} className="text-xs font-semibold opacity-70 mb-2">
              ← Back to Dashboard
            </button>
            <h1 className="text-xl font-black">Academic History</h1>
            <p className="text-sm font-medium mt-1">{student.name}</p>
            <p className="text-xs mt-0.5" style={{ color: '#FFCC00' }}>
              Student ID: {formatStudentId(student.id)}
            </p>
            {schoolName && <p className="text-xs opacity-50 mt-0.5">{schoolName}</p>}
          </div>
          <div className="absolute -bottom-8 -right-8 w-36 h-36 rounded-full opacity-10" style={{ background: '#FFCC00' }} />
        </div>

        {/* ── Current class ───────────────────────────────────────────── */}
        {cls && (
          <div className="rounded-2xl p-4 mb-4 flex items-center gap-3" style={{ background: '#EFF6FF', border: '1.5px solid #BFDBFE' }}>
            <span className="text-2xl">📘</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-black text-base" style={{ color: '#111827' }}>{cls.level}{cls.section}</p>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#0033A0', color: 'white' }}>
                  CURRENT
                </span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
                {cls.academicYear} session · In progress
              </p>
            </div>
          </div>
        )}

        {/* ── Completed levels ────────────────────────────────────────── */}
        {records.length === 0 ? (
          <div className="rounded-2xl p-8 text-center" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
            <p className="text-2xl mb-2">🌱</p>
            <p className="text-sm font-semibold" style={{ color: '#374151' }}>No past records yet</p>
            <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>
              Your academic history will build up from JSS1 as you progress through each class.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            {records.map((rec) => {
              const color = rec.finalAverage >= 75 ? '#16A34A' : rec.finalAverage >= 55 ? '#D97706' : '#DC2626';
              return (
                <div key={rec.id} className="rounded-2xl p-4" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
                  {/* Level + year row */}
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-black text-base" style={{ color: '#111827' }}>{rec.classLevel}</p>
                      <p className="text-xs" style={{ color: '#9CA3AF' }}>{rec.academicYear} session · {rec.schoolName}</p>
                    </div>
                    {rec.promoted && (
                      <span className="text-xs font-bold px-2 py-1 rounded-full shrink-0" style={{ background: '#DCFCE7', color: '#008751' }}>
                        Promoted ✓
                      </span>
                    )}
                  </div>

                  {/* Term averages */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {rec.termAverages.map((avg, i) => (
                      <div key={i} className="rounded-xl p-2 text-center" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                        <p className="text-xs" style={{ color: '#9CA3AF' }}>{TERM_LABELS[i]}</p>
                        <p className="text-sm font-black" style={{ color: '#111827' }}>{avg}%</p>
                      </div>
                    ))}
                  </div>

                  {/* Summary row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black" style={{ color }}>{rec.finalAverage}%</span>
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: color + '22', color }}>
                        {rec.remark}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: '#6B7280' }}>
                      Position: <span className="font-bold" style={{ color: '#111827' }}>{rec.positionInClass}</span> of {rec.classSize}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
