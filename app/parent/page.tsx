'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Role, ColorStatus, WAEC_SUBJECTS } from '@/lib/types';
import type { Student, ReadinessMetric, Hotspot } from '@/lib/types';
import { studentStore, metricsStore, hotspotStore, diaryStore, schoolStore } from '@/lib/storage';
import { recomputeStudent } from '@/lib/calculations';
import Navbar from '@/components/Navbar';

export default function ParentDashboard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [student, setStudent] = useState<Student | null>(null);
  const [metrics, setMetrics] = useState<ReadinessMetric[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [schoolName, setSchoolName] = useState('');
  const [attendanceRate, setAttendanceRate] = useState(0);
  const [reportDate] = useState(() => {
    // Show "last Friday" as the report date
    const d = new Date();
    const day = d.getDay();
    const diff = day === 5 ? 0 : day === 6 ? 1 : day + 2;
    d.setDate(d.getDate() - diff);
    return d.toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  });

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.role !== Role.PARENT) { router.replace('/login'); return; }
    if (!user.childId) { router.replace('/login'); return; }

    recomputeStudent(user.childId);

    const s = studentStore.getById(user.childId);
    if (!s) { router.replace('/login'); return; }
    setStudent(s);

    const school = schoolStore.getById(s.schoolId);
    setSchoolName(school?.name ?? 'School');

    setMetrics(metricsStore.getByStudent(user.childId));
    setHotspots(hotspotStore.getByStudent(user.childId));

    // Attendance rate from last 10 diary entries
    const diaries = diaryStore.getByStudent(user.childId).slice(0, 10);
    if (diaries.length > 0) {
      const rate = diaries.filter((d) => d.attendance.includes(user.childId!)).length / diaries.length;
      setAttendanceRate(Math.round(rate * 100));
    } else {
      setAttendanceRate(100);
    }
  }, [user, isLoading, router]);

  if (isLoading || !student) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--lagos-blue)' }}>
        <div className="text-white text-center">
          <div className="text-xl font-bold mb-2">Eko Excel</div>
          <div className="text-blue-200 text-sm animate-pulse">Loading report...</div>
        </div>
      </div>
    );
  }

  const avgReadiness = metrics.length > 0
    ? metrics.reduce((a, m) => a + m.readinessScore, 0) / metrics.length
    : 0;
  const overallStatus = avgReadiness >= 75 ? ColorStatus.GREEN : avgReadiness >= 55 ? ColorStatus.YELLOW : ColorStatus.RED;
  const statusLabel = overallStatus === ColorStatus.GREEN ? 'On Track' : overallStatus === ColorStatus.YELLOW ? 'Needs Support' : 'At Risk';
  const statusColor = overallStatus === ColorStatus.GREEN ? 'var(--lagos-green)' : overallStatus === ColorStatus.YELLOW ? 'var(--lagos-gold)' : 'var(--lagos-red)';
  const statusBg = overallStatus === ColorStatus.GREEN ? 'var(--lagos-green-light)' : overallStatus === ColorStatus.YELLOW ? '#FEF9C3' : '#FEE2E2';
  const criticalHotspots = hotspots.filter((h) => h.severity === 'critical');

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Parent greeting */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--lagos-blue)' }}>
            Welcome, {user?.name.split(' ')[1]}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Weekly report for <strong>{student.name}</strong> · {schoolName}
          </p>
        </div>

        {/* Critical alert banner */}
        {criticalHotspots.length > 0 && (
          <div className="rounded-xl p-4 mb-6 flex items-start gap-3" style={{ background: '#FEE2E2', border: '1px solid #FCA5A5' }}>
            <span className="text-2xl shrink-0">🚨</span>
            <div>
              <div className="font-bold text-sm" style={{ color: 'var(--lagos-red)' }}>Urgent — Action Required</div>
              <div className="text-xs mt-1" style={{ color: '#991B1B' }}>
                {student.name.split(' ')[0]} has {criticalHotspots.length} critical issue{criticalHotspots.length > 1 ? 's' : ''} that need immediate attention.
                Please speak with the class teacher this week.
              </div>
            </div>
          </div>
        )}

        {/* Friday Report Card */}
        <div className="card mb-6" style={{ border: '2px solid var(--lagos-blue)' }}>
          {/* Card header */}
          <div className="flex items-center justify-between mb-4 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <div>
              <div className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>Weekly Progress Report</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{reportDate}</div>
            </div>
            <div
              className="px-3 py-1.5 rounded-full text-xs font-bold"
              style={{ background: statusBg, color: statusColor }}
            >
              {statusLabel}
            </div>
          </div>

          {/* Student info */}
          <div className="flex items-center gap-3 mb-5">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center font-black text-lg shrink-0"
              style={{ background: 'var(--lagos-blue)', color: 'white' }}
            >
              {student.name.charAt(0)}
            </div>
            <div>
              <div className="font-bold" style={{ color: 'var(--lagos-blue)' }}>{student.name}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Class {student.class} · {schoolName.split(',')[0]}</div>
            </div>
          </div>

          {/* Key metrics row */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="text-center p-3 rounded-xl" style={{ background: 'var(--background)' }}>
              <div className="text-2xl font-black mb-0.5" style={{ color: statusColor }}>{avgReadiness.toFixed(0)}%</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>WAEC Readiness</div>
            </div>
            <div className="text-center p-3 rounded-xl" style={{ background: 'var(--background)' }}>
              <div
                className="text-2xl font-black mb-0.5"
                style={{ color: attendanceRate >= 80 ? 'var(--lagos-green)' : attendanceRate >= 60 ? 'var(--lagos-gold)' : 'var(--lagos-red)' }}
              >
                {attendanceRate}%
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Attendance</div>
            </div>
            <div className="text-center p-3 rounded-xl" style={{ background: 'var(--background)' }}>
              <div
                className="text-2xl font-black mb-0.5"
                style={{ color: hotspots.length === 0 ? 'var(--lagos-green)' : hotspots.length <= 2 ? 'var(--lagos-gold)' : 'var(--lagos-red)' }}
              >
                {hotspots.length}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Open Alerts</div>
            </div>
          </div>

          {/* Subject breakdown */}
          <div className="mb-5">
            <div className="text-xs font-bold mb-3 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Subject Readiness</div>
            <div className="flex flex-col gap-2">
              {WAEC_SUBJECTS.map((subject) => {
                const metric = metrics.find((m) => m.subject === subject);
                const score = metric?.readinessScore ?? 0;
                const sc = metric?.colorStatus ?? ColorStatus.RED;
                const barColor = sc === ColorStatus.GREEN ? 'var(--lagos-green)' : sc === ColorStatus.YELLOW ? 'var(--lagos-gold)' : 'var(--lagos-red)';
                return (
                  <div key={subject} className="flex items-center gap-3">
                    <div className="text-xs font-medium w-24 shrink-0">{subject}</div>
                    <div className="progress-bar flex-1">
                      <div className="progress-bar-fill" style={{ width: `${score}%`, background: barColor }} />
                    </div>
                    <div className="text-xs font-bold w-8 text-right shrink-0" style={{ color: barColor }}>{score.toFixed(0)}%</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hotspot section */}
          {hotspots.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Areas Needing Attention</div>
              <div className="flex flex-col gap-1.5">
                {hotspots.slice(0, 3).map((h) => (
                  <div key={h.id} className="flex items-center gap-2 p-2 rounded-lg"
                    style={{ background: h.severity === 'critical' ? '#FEE2E2' : '#FEF9C3' }}>
                    <span className="text-base shrink-0">{h.severity === 'critical' ? '🔴' : '🟡'}</span>
                    <span className="text-xs" style={{ color: h.severity === 'critical' ? '#991B1B' : '#854D0E' }}>{h.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer message */}
          <div className="pt-4 text-xs" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            {overallStatus === ColorStatus.GREEN
              ? `${student.name.split(' ')[0]} is performing well. Keep encouraging daily study!`
              : overallStatus === ColorStatus.YELLOW
                ? `${student.name.split(' ')[0]} needs consistent study time this week. Ask about the highlighted subjects.`
                : `Please speak with ${student.name.split(' ')[0]}'s teacher urgently. Extra support is needed now.`
            }
          </div>
        </div>

        {/* Tip for parents */}
        <div className="rounded-xl p-4" style={{ background: 'var(--lagos-blue-light)' }}>
          <div className="font-bold text-sm mb-1" style={{ color: 'var(--lagos-blue)' }}>What can you do this week?</div>
          <div className="text-xs flex flex-col gap-1.5" style={{ color: 'var(--lagos-blue)' }}>
            {hotspots.length === 0 ? (
              <div>✓ Ask {student.name.split(' ')[0]} to explain one topic from class today — it reinforces learning.</div>
            ) : (
              <>
                <div>① Ask {student.name.split(' ')[0]} to spend 20 minutes on the highlighted weak subject tonight.</div>
                <div>② Confirm they attend every class this week — attendance directly impacts their WAEC score.</div>
                {criticalHotspots.length > 0 && <div>③ Contact the school to arrange extra support this week.</div>}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
