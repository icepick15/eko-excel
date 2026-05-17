'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Role, ColorStatus, WAEC_SUBJECTS } from '@/lib/types';
import type { Student, DiaryEntry } from '@/lib/types';
import { studentStore, diaryStore, metricsStore, hotspotStore } from '@/lib/storage';
import { recomputeStudent } from '@/lib/calculations';
import Navbar from '@/components/Navbar';
import ReadinessBadge from '@/components/ReadinessBadge';

export default function TeacherDashboard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [recentDiaries, setRecentDiaries] = useState<DiaryEntry[]>([]);
  const [computed, setComputed] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.role !== Role.TEACHER) { router.replace('/school'); return; }

    const myStudents = studentStore.getBySchool(user.schoolId!);
    setStudents(myStudents);

    // Compute metrics for all students if not done
    if (!computed) {
      myStudents.forEach((s) => recomputeStudent(s.id));
      setComputed(true);
    }

    const allDiaries = diaryStore.getByTeacher(user.id).slice(0, 10);
    setRecentDiaries(allDiaries);
  }, [user, isLoading, computed, router]);

  if (isLoading) return <LoadingScreen />;

  const hotspotCount = students.reduce((acc, s) => acc + hotspotStore.getByStudent(s.id).length, 0);
  const redCount = students.filter((s) => {
    const metrics = metricsStore.getByStudent(s.id);
    return metrics.some((m) => m.colorStatus === ColorStatus.RED);
  }).length;

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--lagos-blue)' }}>
            Good morning, {user?.name.split(' ')[1]} 👋
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Lagos Model College, Meiran &nbsp;·&nbsp; {new Date().toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard value={students.length} label="My Students" color="var(--lagos-blue)" />
          <StatCard value={recentDiaries.length} label="Diary Entries" color="var(--lagos-green)" />
          <StatCard value={redCount} label="At-Risk Students" color="var(--lagos-red)" />
          <StatCard value={hotspotCount} label="Active Hotspots" color="var(--lagos-gold)" />
        </div>

        {/* CTA */}
        <div
          className="rounded-2xl p-6 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          style={{ background: 'var(--lagos-blue)', color: 'white' }}
        >
          <div>
            <div className="font-bold text-lg">Submit Today&apos;s Diary</div>
            <div style={{ color: '#A8C4F0' }} className="text-sm mt-0.5">
              Takes &lt;2 minutes · Your students are waiting for feedback
            </div>
          </div>
          <button
            className="px-6 py-3 rounded-xl font-bold text-sm shrink-0 hover:opacity-90 transition-opacity"
            style={{ background: 'var(--lagos-gold)', color: 'white' }}
            onClick={() => router.push('/diary')}
          >
            + New Diary Entry
          </button>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Student readiness list */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-base" style={{ color: 'var(--lagos-blue)' }}>Student Readiness</h2>
              <button
                className="text-xs font-medium px-3 py-1.5 rounded-lg"
                style={{ background: 'var(--lagos-blue-light)', color: 'var(--lagos-blue)' }}
                onClick={() => router.push('/school')}
              >
                View All →
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {students.slice(0, 6).map((student) => {
                const metrics = metricsStore.getByStudent(student.id);
                const avg = metrics.length > 0
                  ? metrics.reduce((a, m) => a + m.readinessScore, 0) / metrics.length
                  : 0;
                const worst = metrics.reduce((w, m) => m.readinessScore < (w?.readinessScore ?? 999) ? m : w, metrics[0]);
                return (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-3 rounded-xl cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ background: 'var(--background)' }}
                    onClick={() => router.push(`/students/${student.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                        style={{ background: 'var(--lagos-blue-light)', color: 'var(--lagos-blue)' }}
                      >
                        {student.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{student.name}</div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{student.class}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className="text-sm font-bold"
                        style={{
                          color: worst?.colorStatus === ColorStatus.GREEN ? 'var(--lagos-green)'
                            : worst?.colorStatus === ColorStatus.YELLOW ? 'var(--lagos-gold)'
                            : 'var(--lagos-red)',
                        }}
                      >
                        {avg.toFixed(0)}%
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>avg readiness</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent diary entries */}
          <div className="card">
            <h2 className="font-bold text-base mb-4" style={{ color: 'var(--lagos-blue)' }}>Recent Diary Entries</h2>
            {recentDiaries.length === 0 ? (
              <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                <div className="text-3xl mb-2">📓</div>
                <div className="text-sm">No diary entries yet</div>
                <button className="btn-primary mt-3 text-sm" onClick={() => router.push('/diary')}>
                  Submit First Entry
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {recentDiaries.map((diary) => {
                  const student = students.find((s) => s.id === diary.studentId);
                  return (
                    <div key={diary.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--background)' }}>
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0"
                        style={{
                          background: diary.classScore >= 75 ? 'var(--lagos-green-light)' : diary.classScore >= 55 ? '#FEF9C3' : '#FEE2E2',
                          color: diary.classScore >= 75 ? 'var(--lagos-green)' : diary.classScore >= 55 ? '#854D0E' : 'var(--lagos-red)',
                        }}
                      >
                        {diary.classScore}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{student?.name ?? 'Unknown'}</div>
                        <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                          {new Date(diary.createdAt).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="card text-center">
      <div className="text-3xl font-black mb-1" style={{ color }}>{value}</div>
      <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--lagos-blue)' }}>
      <div className="text-white text-center">
        <div className="text-xl font-bold mb-2">Eko Excel</div>
        <div className="text-blue-200 text-sm animate-pulse">Loading...</div>
      </div>
    </div>
  );
}
