'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Role, ColorStatus, CORE_SUBJECTS } from '@/lib/types';
import type { Student, Class, User } from '@/lib/types';
import {
  studentStore, metricsStore, hotspotStore, schoolStore,
  classStore, userStore, tcsStore, messageStore,
} from '@/lib/storage';
import { getTeacherComplianceThisWeek, getClassReadinessAvg, getSchoolReadinessAvg, scoreColor, SCORE_GREEN, SCORE_YELLOW, getSchoolTrend, getClassTrend } from '@/lib/calculations';
import { generateAlerts } from '@/lib/alerts';
import TrendChart from '@/components/TrendChart';
import Navbar from '@/components/Navbar';

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

type Tab = 'overview' | 'heatmap' | 'trends' | 'teachers' | 'students';

function SchoolContent() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const paramId = params.get('id');

  const [students,   setStudents]   = useState<Student[]>([]);
  const [classes,    setClasses]    = useState<Class[]>([]);
  const [teachers,   setTeachers]   = useState<User[]>([]);
  const [schoolName, setSchoolName] = useState('');
  const [schoolAvg,  setSchoolAvg]  = useState(0);
  const [activeTab,  setActiveTab]  = useState<Tab>('overview');
  const [search,     setSearch]     = useState('');
  const [nudging,    setNudging]    = useState<string | null>(null);

  const viewSchoolId = paramId ?? user?.schoolId ?? '';

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }

    const staffRoles = [Role.HEADTEACHER, Role.SCHOOLADMIN, Role.TEACHER];
    const viewerRoles = [Role.DISTRICT, Role.MINISTRY];
    if (!staffRoles.includes(user.role) && !viewerRoles.includes(user.role)) {
      if (user.role === Role.STUDENT) router.replace('/student');
      else if (user.role === Role.PARENT) router.replace('/parent');
      else router.replace('/dashboard');
      return;
    }
    // District/Ministry without an explicit id param go back to their own dashboard
    if (viewerRoles.includes(user.role) && !paramId) {
      router.replace(user.role === Role.DISTRICT ? '/district' : '/ministry');
      return;
    }

    const sId = viewSchoolId;
    const school = schoolStore.getById(sId);
    setSchoolName(school?.name ?? 'School');

    setStudents(studentStore.getBySchool(sId));
    setClasses(classStore.getBySchool(sId));
    setTeachers(userStore.getTeachers(sId));
    setSchoolAvg(getSchoolReadinessAvg(sId));

    // Generate proactive alerts for school-level roles
    if (!viewerRoles.includes(user.role)) generateAlerts(user);
  }, [user, isLoading, router, viewSchoolId, paramId]);

  if (isLoading) return null;
  if (!user) return null;

  const schoolId = viewSchoolId;
  const atRisk  = students.filter((s) => metricsStore.getByStudent(s.id).some((m) => m.colorStatus === ColorStatus.RED)).length;
  const onTrack = students.filter((s) => metricsStore.getByStudent(s.id).every((m) => m.colorStatus !== ColorStatus.RED)).length;
  const hotspotCount = hotspotStore.getBySchool(schoolId).length;

  // Teacher compliance
  const teacherStats = teachers.map((t) => ({
    teacher: t,
    compliance: getTeacherComplianceThisWeek(t.id),
    tcs: tcsStore.getByTeacher(t.id),
  }));

  function sendNudge(teacherId: string, teacherName: string) {
    if (!user) return;
    setNudging(teacherId);
    messageStore.save({
      id: uid(),
      fromUserId: user.id,
      fromRole: user.role,
      fromName: user.name,
      toUserId: teacherId,
      subject: 'Diary Submission Reminder',
      body: `Dear ${teacherName.split(' ').pop()}, please ensure your class diary is submitted daily. This week's compliance is below the 90% target. Thank you.`,
      severity: 'warning',
      isRead: false,
      sentAt: new Date().toISOString(),
    });
    setTimeout(() => setNudging(null), 800);
    alert(`Nudge sent to ${teacherName}`);
  }

  // Subject × Class heatmap data
  const heatmapData = CORE_SUBJECTS.map((subject) => ({
    subject,
    classes: classes.map((cls) => {
      const classStudents = studentStore.getByClass(cls.id);
      if (classStudents.length === 0) return { cls, avg: 0 };
      const scores = classStudents
        .map((s) => metricsStore.getByStudent(s.id).find((m) => m.subject === subject)?.readinessScore ?? 0);
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      return { cls, avg: Math.round(avg) };
    }),
  }));

  const filteredStudents = students.filter((s) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => {
    const aAvg = metricsStore.getByStudent(a.id).reduce((s, m) => s + m.readinessScore, 0) / (metricsStore.getByStudent(a.id).length || 1);
    const bAvg = metricsStore.getByStudent(b.id).reduce((s, m) => s + m.readinessScore, 0) / (metricsStore.getByStudent(b.id).length || 1);
    return aAvg - bAvg; // worst first
  });

  const TAB_LABELS: Record<Tab, string> = {
    overview: 'Overview',
    heatmap:  'Heatmap',
    trends:   'Trends',
    teachers: 'Teachers',
    students: 'Students',
  };

  return (
    <div className="min-h-screen" style={{ background: '#F5F7FA' }}>
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-5 pb-10">
        {/* Header */}
        <div className="mb-5">
          <button onClick={() => router.back()} className="text-sm font-medium mb-2" style={{ color: '#0033A0' }}>←</button>
          <h1 className="text-xl font-black" style={{ color: '#0033A0' }}>{schoolName}</h1>
          <p className="text-sm" style={{ color: '#6B7280' }}>
            {students.length} students · {classes.length} classes · {teachers.length} teachers
          </p>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          <KPICard value={`${schoolAvg}%`}  label="School Avg"   color={scoreColor(schoolAvg)} />
          <KPICard value={String(atRisk)}    label="At-Risk"      color={atRisk > 0 ? '#E30613' : '#008751'} />
          <KPICard value={String(hotspotCount)} label="Hotspots"  color={hotspotCount > 0 ? '#E30613' : '#008751'} />
          <KPICard value={String(teachers.filter((t) => getTeacherComplianceThisWeek(t.id).rate >= 90).length) + '/' + teachers.length}
            label="Compliant" color="#0033A0" />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl mb-5" style={{ background: '#E5E7EB' }}>
          {(Object.keys(TAB_LABELS) as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
              style={{
                background: activeTab === tab ? 'white' : 'transparent',
                color: activeTab === tab ? '#0033A0' : '#6B7280',
                boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {/* ── Overview Tab ─────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div>
            {/* Class readiness summary */}
            <div className="rounded-2xl p-4 mb-4" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
              <h3 className="font-bold text-sm mb-3" style={{ color: '#0033A0' }}>Class Readiness</h3>
              <div className="flex flex-col gap-2">
                {classes.map((cls) => {
                  const avg = getClassReadinessAvg(cls.id);
                  const color = scoreColor(avg);
                  const studs = studentStore.getByClass(cls.id);
                  return (
                    <div key={cls.id} className="flex items-center gap-3">
                      <div className="w-16 text-xs font-bold" style={{ color: '#0033A0' }}>
                        {cls.level}{cls.section}
                      </div>
                      <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: '#F3F4F6' }}>
                        <div className="h-3 rounded-full" style={{ width: `${avg}%`, background: color }} />
                      </div>
                      <div className="text-xs font-black w-10 text-right" style={{ color }}>{avg}%</div>
                      <div className="text-xs w-16 text-right" style={{ color: '#9CA3AF' }}>{studs.length} stu</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top hotspots */}
            {/* Curriculum coverage shortcut */}
            <button
              onClick={() => router.push('/curriculum')}
              className="w-full rounded-2xl p-4 mb-4 flex items-center justify-between"
              style={{ background: '#EFF6FF', border: '1.5px solid #BFDBFE' }}
            >
              <div>
                <p className="font-bold text-sm" style={{ color: '#0033A0' }}>📋 Curriculum Coverage</p>
                <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>Check syllabus progress across all classes</p>
              </div>
              <span className="text-lg" style={{ color: '#0033A0' }}>→</span>
            </button>

            {hotspotStore.getBySchool(schoolId).slice(0, 5).length > 0 && (
              <div className="rounded-2xl p-4 mb-4" style={{ background: 'white', border: '1.5px solid #FECACA' }}>
                <h3 className="font-bold text-sm mb-3" style={{ color: '#E30613' }}>
                  Active Hotspots ({hotspotCount})
                </h3>
                <div className="flex flex-col gap-2">
                  {hotspotStore.getBySchool(schoolId).slice(0, 5).map((h) => {
                    const stu = studentStore.getById(h.studentId);
                    const cls = stu ? classStore.getById(stu.classId) : null;
                    return (
                      <button
                        key={h.id}
                        onClick={() => router.push(`/students/${h.studentId}`)}
                        className="flex items-center gap-3 w-full text-left"
                      >
                        <span className="text-base">{h.severity === 'critical' ? '🔴' : h.severity === 'high' ? '🟠' : '🟡'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{stu?.name}</p>
                          <p className="text-xs" style={{ color: '#9CA3AF' }}>
                            {cls?.level}{cls?.section} · {h.subject} · {(h.readinessScore ?? 0).toFixed(0)}%
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => router.push('/hotspots')}
                  className="text-xs font-semibold mt-3"
                  style={{ color: '#0033A0' }}
                >
                  View all →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Heatmap Tab ──────────────────────────────────────────────── */}
        {activeTab === 'heatmap' && (
          <div className="rounded-2xl overflow-hidden" style={{ border: '1.5px solid #E5E7EB' }}>
            <div className="overflow-x-auto">
              <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
                <thead>
                  <tr style={{ background: '#0033A0', color: 'white' }}>
                    <th className="text-left text-xs font-bold px-3 py-3">Subject</th>
                    {classes.map((cls) => (
                      <th key={cls.id} className="text-center text-xs font-bold px-2 py-3">
                        {cls.level}{cls.section}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmapData.map(({ subject, classes: clsData }, ri) => (
                    <tr key={subject} style={{ background: ri % 2 === 0 ? 'white' : '#F9FAFB' }}>
                      <td className="px-3 py-2.5 text-xs font-semibold" style={{ color: '#374151', whiteSpace: 'nowrap' }}>
                        {subject}
                      </td>
                      {clsData.map(({ cls, avg }) => {
                        const bg  = avg >= SCORE_GREEN ? '#DCFCE7' : avg >= SCORE_YELLOW ? '#FEF9C3' : avg > 0 ? '#FEE2E2' : '#F3F4F6';
                        const col = avg >= SCORE_GREEN ? '#008751' : avg >= SCORE_YELLOW ? '#854D0E' : avg > 0 ? '#E30613' : '#9CA3AF';
                        return (
                          <td key={cls.id} className="px-2 py-2.5 text-center">
                            <span
                              className="text-xs font-black px-2 py-0.5 rounded-full"
                              style={{ background: bg, color: col }}
                            >
                              {avg > 0 ? `${avg}%` : '—'}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Trends Tab ───────────────────────────────────────────────── */}
        {activeTab === 'trends' && (
          <div className="flex flex-col gap-4">
            {/* School-wide trend */}
            <div className="rounded-2xl p-4" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
              <p className="font-bold text-sm mb-1" style={{ color: '#0033A0' }}>School-Wide Performance (8 weeks)</p>
              <p className="text-xs mb-3" style={{ color: '#9CA3AF' }}>Weekly average class score across all subjects</p>
              <TrendChart data={getSchoolTrend(schoolId)} height={80} />
            </div>

            {/* Per-subject trends */}
            {CORE_SUBJECTS.map((subject) => {
              const trendData = getSchoolTrend(schoolId, subject);
              const hasData = trendData.some((p) => p.score > 0);
              if (!hasData) return null;
              const latest = trendData.filter((p) => p.score > 0).slice(-1)[0]?.score ?? 0;
              return (
                <div key={subject} className="rounded-2xl p-4" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-bold text-sm" style={{ color: '#374151' }}>{subject}</p>
                    <span className="font-black text-sm" style={{ color: scoreColor(latest) }}>{latest}%</span>
                  </div>
                  <p className="text-xs mb-3" style={{ color: '#9CA3AF' }}>Weekly average class score</p>
                  <TrendChart data={trendData} height={56} showLabels={false} />
                </div>
              );
            })}

            {/* Per-class trends */}
            <div className="rounded-2xl p-4" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
              <p className="font-bold text-sm mb-3" style={{ color: '#0033A0' }}>By Class</p>
              <div className="flex flex-col gap-4">
                {classes.map((cls) => {
                  const trendData = getClassTrend(cls.id);
                  const latest = trendData.filter((p) => p.score > 0).slice(-1)[0]?.score ?? 0;
                  return (
                    <div key={cls.id}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-semibold" style={{ color: '#374151' }}>
                          {cls.level}{cls.section}
                        </p>
                        <span className="text-xs font-black" style={{ color: scoreColor(latest) }}>
                          {latest > 0 ? `${latest}%` : '—'}
                        </span>
                      </div>
                      <TrendChart data={trendData} height={44} showLabels={false} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Teachers Tab ─────────────────────────────────────────────── */}
        {activeTab === 'teachers' && (
          <div className="flex flex-col gap-3">
            {teacherStats.map(({ teacher, compliance, tcs }) => {
              const compColor = compliance.rate >= 90 ? '#008751' : compliance.rate >= 70 ? '#FFCC00' : '#E30613';
              return (
                <div
                  key={teacher.id}
                  className="rounded-2xl p-4"
                  style={{ background: 'white', border: '1.5px solid #E5E7EB' }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shrink-0"
                      style={{ background: '#EFF6FF', color: '#0033A0' }}
                    >
                      {teacher.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate" style={{ color: '#111827' }}>{teacher.name}</p>
                      <p className="text-xs" style={{ color: '#9CA3AF' }}>
                        {tcs.map((t) => `${classStore.getById(t.classId)?.level ?? '?'}${classStore.getById(t.classId)?.section ?? ''} ${t.subject}`).join(' · ')}
                      </p>
                    </div>
                    <div className="text-center shrink-0">
                      <p className="text-lg font-black" style={{ color: compColor }}>{compliance.rate}%</p>
                      <p className="text-xs" style={{ color: '#9CA3AF' }}>compliance</p>
                    </div>
                  </div>

                  {/* Compliance bar */}
                  <div className="h-2 rounded-full overflow-hidden mb-3" style={{ background: '#F3F4F6' }}>
                    <div className="h-2 rounded-full" style={{ width: `${compliance.rate}%`, background: compColor }} />
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-xs" style={{ color: '#6B7280' }}>
                      {compliance.submitted}/{compliance.required} diaries this week
                    </p>
                    <div className="flex gap-2">
                      {compliance.rate < 90 && (
                        <button
                          onClick={() => sendNudge(teacher.id, teacher.name)}
                          disabled={nudging === teacher.id}
                          className="text-xs font-bold px-2 py-1 rounded-lg"
                          style={{ background: '#FEF9C3', color: '#854D0E' }}
                        >
                          {nudging === teacher.id ? 'Sent!' : '🔔 Nudge'}
                        </button>
                      )}
                      <button
                        onClick={() => router.push('/messages')}
                        className="text-xs font-bold px-2 py-1 rounded-lg"
                        style={{ background: '#EFF6FF', color: '#0033A0' }}
                      >
                        ✉ Message
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {teachers.length === 0 && (
              <div className="text-center py-12 rounded-2xl" style={{ background: 'white' }}>
                <p className="text-2xl mb-2">👩‍🏫</p>
                <p className="text-sm" style={{ color: '#6B7280' }}>No teachers found</p>
              </div>
            )}
          </div>
        )}

        {/* ── Students Tab ─────────────────────────────────────────────── */}
        {activeTab === 'students' && (
          <div>
            <input
              className="w-full rounded-xl px-4 py-3 text-sm mb-4"
              style={{ border: '1.5px solid #E5E7EB', background: 'white' }}
              placeholder="Search students..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex flex-col gap-2">
              {filteredStudents.map((s) => {
                const ms  = metricsStore.getByStudent(s.id);
                const avg = ms.length > 0 ? Math.round(ms.reduce((a, m) => a + m.readinessScore, 0) / ms.length) : 0;
                const col = scoreColor(avg);
                const cls = classStore.getById(s.classId);
                const hs  = hotspotStore.getByStudent(s.id).length;
                return (
                  <button
                    key={s.id}
                    onClick={() => router.push(`/students/${s.id}`)}
                    className="w-full text-left flex items-center gap-3 p-3 rounded-xl"
                    style={{ background: 'white', border: '1.5px solid #E5E7EB' }}
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                      style={{ background: '#EFF6FF', color: '#0033A0' }}
                    >
                      {s.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: '#111827' }}>{s.name}</p>
                      <p className="text-xs" style={{ color: '#9CA3AF' }}>
                        {cls?.level}{cls?.section} · {s.gender === 'M' ? 'Male' : 'Female'}
                        {hs > 0 && <span style={{ color: '#E30613' }}> · {hs} hotspot{hs > 1 ? 's' : ''}</span>}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-base" style={{ color: col }}>{avg}%</p>
                      <p className="text-xs" style={{ color: '#9CA3AF' }}>avg</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function SchoolDashboard() {
  return (
    <Suspense fallback={null}>
      <SchoolContent />
    </Suspense>
  );
}

function KPICard({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className="rounded-2xl p-3 text-center" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
      <p className="text-xl font-black leading-none" style={{ color }}>{value}</p>
      <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>{label}</p>
    </div>
  );
}
