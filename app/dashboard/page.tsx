'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Role, ColorStatus, BEHAVIORAL_TRAIT_LABELS } from '@/lib/types';
import type { Student, DiaryEntry, TeacherClassSubject, Class, Notification, Message } from '@/lib/types';
import {
  studentStore, diaryStore, metricsStore, hotspotStore,
  tcsStore, classStore, timetableStore, notificationStore, messageStore,
  schoolStore, interventionStore,
} from '@/lib/storage';
import type { Intervention } from '@/lib/types';
import { getTeacherComplianceThisWeek, SCORE_GREEN, SCORE_YELLOW } from '@/lib/calculations';
import { generateAlerts } from '@/lib/alerts';
import Navbar from '@/components/Navbar';

function timeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function todayDow(): number {
  // 1=Mon…5=Fri, 0/6=weekend → 0
  const d = new Date().getDay();
  return d === 0 ? 0 : d;
}

export default function TeacherDashboard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [myTcs, setMyTcs]         = useState<TeacherClassSubject[]>([]);
  const [myClasses, setMyClasses] = useState<Class[]>([]);
  const [recentDiaries, setRecentDiaries] = useState<DiaryEntry[]>([]);
  const [unreadMsgs, setUnreadMsgs]  = useState(0);
  const [unreadNotes, setUnreadNotes]= useState(0);
  const [compliance, setCompliance]  = useState({ submitted: 0, required: 0, rate: 0 });
  const [hotspotCount,    setHotspotCount]    = useState(0);
  const [myInterventions, setMyInterventions] = useState<Intervention[]>([]);

  // students in MY classes
  const [classStudents,  setClassStudents]  = useState<Record<string, Student[]>>({});
  const [atRiskCount,    setAtRiskCount]    = useState(0);
  const [atRiskStudents, setAtRiskStudents] = useState<{ student: Student; subject: string; score: number; cls: Class | null }[]>([]);

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.role !== Role.TEACHER && user.role !== Role.HEADTEACHER) {
      // redirect non-teachers
      if (user.role === Role.STUDENT)   router.replace('/student');
      else if (user.role === Role.PARENT) router.replace('/parent');
      else if (user.role === Role.DISTRICT) router.replace('/district');
      else if (user.role === Role.MINISTRY) router.replace('/ministry');
      else if (user.role === Role.SCHOOLADMIN || user.role === Role.HEADTEACHER) router.replace('/school');
      return;
    }

    const tcs = tcsStore.getByTeacher(user.id);
    setMyTcs(tcs);

    const classes = tcs.map((t) => classStore.getById(t.classId)).filter(Boolean) as Class[];
    setMyClasses(classes);

    // Build per-class student lists
    const byClass: Record<string, Student[]> = {};
    for (const cls of classes) {
      byClass[cls.id] = studentStore.getByClass(cls.id);
    }
    setClassStudents(byClass);

    // Compliance
    setCompliance(getTeacherComplianceThisWeek(user.id));

    // Recent diaries (class-level)
    setRecentDiaries(diaryStore.getByTeacher(user.id).slice(0, 8));

    // Unread counts
    setUnreadMsgs(messageStore.getUnreadCount(user.id));
    setUnreadNotes(notificationStore.getUnread(user.id).length);

    // Load metrics and hotspots once for this teacher's students
    const allStudentList = classes.flatMap((c) => byClass[c.id] ?? []);
    const studentIdSet   = new Set(allStudentList.map((s) => s.id));
    const allMetrics     = metricsStore.getAll().filter((m) => studentIdSet.has(m.studentId));

    // Hotspot count — one read, no per-student calls
    setHotspotCount(hotspotStore.getAll().filter((h) => studentIdSet.has(h.studentId)).length);

    // At-risk students — precomputed for render
    const reds = allStudentList
      .flatMap((s) => {
        const ms  = allMetrics.filter((m) => m.studentId === s.id);
        const red = ms.filter((m) => m.colorStatus === ColorStatus.RED);
        if (red.length === 0) return [];
        const worst = red.sort((a, b) => a.readinessScore - b.readinessScore)[0];
        return [{ student: s, subject: worst.subject, score: Math.round(worst.readinessScore), cls: classStore.getById(s.classId) ?? null }];
      })
      .slice(0, 5);
    setAtRiskCount(reds.length);
    setAtRiskStudents(reds);

    // My assigned interventions (open + in_progress)
    const myTasks = interventionStore.getByTeacher(user.id).filter(
      (iv) => iv.status === 'open' || iv.status === 'in_progress'
    );
    setMyInterventions(myTasks);

    // Generate proactive alerts
    generateAlerts(user);
  }, [user, isLoading, router]);

  if (isLoading) return <LoadingScreen />;
  if (!user) return null;

  const school = schoolStore.getById(user.schoolId ?? '');
  const dow = todayDow();
  const totalStudents = Object.values(classStudents).reduce((a, arr) => a + arr.length, 0);

  return (
    <div className="min-h-screen" style={{ background: '#F5F7FA' }}>
      <Navbar />

      <main className="max-w-3xl lg:max-w-6xl mx-auto px-4 md:px-6 py-5 md:py-8 pb-10">

        {/* ── Header ────────────────────────────────────────────────── */}
        <div
          className="rounded-2xl px-5 py-5 md:px-7 md:py-7 mb-5 relative overflow-hidden"
          style={{ background: '#0033A0', color: 'white' }}
        >
          <div className="relative z-10">
            <p className="text-sm font-medium opacity-80">{timeOfDay()},</p>
            <h1 className="text-xl font-black mt-0.5">{user.name.split(' ').slice(-1)[0]}</h1>
            <p className="text-xs opacity-60 mt-1">
              {school?.name ?? 'Lagos State Secondary School'} &nbsp;·&nbsp;{' '}
              {new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          {/* Notification bell */}
          <button
            onClick={() => router.push('/messages')}
            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.15)' }}
          >
            <span className="text-lg">🔔</span>
            {(unreadMsgs + unreadNotes) > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center"
                style={{ background: '#FFCC00', color: '#0033A0' }}
              >
                {unreadMsgs + unreadNotes}
              </span>
            )}
          </button>
          {/* decorative circle */}
          <div
            className="absolute -bottom-8 -right-8 w-36 h-36 rounded-full opacity-10"
            style={{ background: '#FFCC00' }}
          />
        </div>

        {/* ── Weekly Impact Strip ────────────────────────────────────── */}
        <div
          className="rounded-2xl p-4 mb-5 flex items-center gap-4"
          style={{ background: 'white', border: '1.5px solid #E5E7EB' }}
        >
          <ImpactPill
            value={`${compliance.rate}%`}
            label="Weekly Compliance"
            color={compliance.rate >= 90 ? '#008751' : compliance.rate >= 70 ? '#FFCC00' : '#E30613'}
          />
          <div style={{ width: 1, background: '#E5E7EB', alignSelf: 'stretch' }} />
          <ImpactPill value={`${compliance.submitted}/${compliance.required}`} label="Diaries Logged" color="#0033A0" />
          <div style={{ width: 1, background: '#E5E7EB', alignSelf: 'stretch' }} />
          <ImpactPill value={String(hotspotCount)} label="Hotspots" color={hotspotCount > 0 ? '#E30613' : '#008751'} />
          <div style={{ width: 1, background: '#E5E7EB', alignSelf: 'stretch' }} />
          <ImpactPill value={String(atRiskCount)} label="At-Risk" color={atRiskCount > 0 ? '#F97316' : '#008751'} />
        </div>

        {/* ── Primary CTAs ──────────────────────────────────────────── */}
        <div className="flex gap-3 mb-5">
          <button
            onClick={() => router.push('/diary')}
            className="flex-1 rounded-2xl p-4 flex items-center justify-between transition-all active:scale-98"
            style={{ background: '#008751', color: 'white', boxShadow: '0 4px 14px rgba(0,135,81,0.35)' }}
          >
            <div className="text-left">
              <p className="font-black text-sm">+ Log Diary</p>
              <p className="text-xs opacity-75 mt-0.5">Under 2 min</p>
            </div>
            <span className="text-2xl">📓</span>
          </button>
          <button
            onClick={() => router.push('/curriculum')}
            className="flex-1 rounded-2xl p-4 flex items-center justify-between transition-all active:scale-98"
            style={{ background: '#0033A0', color: 'white', boxShadow: '0 4px 14px rgba(0,51,160,0.25)' }}
          >
            <div className="text-left">
              <p className="font-black text-sm">Coverage</p>
              <p className="text-xs opacity-75 mt-0.5">Syllabus audit</p>
            </div>
            <span className="text-2xl">📋</span>
          </button>
        </div>

        {/* Sections flow into two columns on desktop */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-x-5 lg:items-start">

        {/* ── Today's Timetable ──────────────────────────────────────── */}
        {dow > 0 && (
          <Section title="Today's Classes" action={{ label: 'All Classes', href: '/school' }}>
            {myTcs.length === 0 ? (
              <EmptyState icon="📅" text="No class assignments found" />
            ) : (
              <div className="flex flex-col gap-2">
                {myTcs.map((tcs) => {
                  const cls = classStore.getById(tcs.classId);
                  const todaySlots = timetableStore.getByDay(tcs.classId, dow);
                  const stuCount = (classStudents[tcs.classId] ?? []).length;
                  const todayDiaries = diaryStore.getByClassAndDate(
                    tcs.classId,
                    new Date().toISOString().slice(0, 10)
                  ).filter((d) => d.subject === tcs.subject);
                  const logged = todayDiaries.length > 0;

                  return (
                    <div
                      key={tcs.id}
                      className="flex items-center gap-3 p-3 rounded-xl"
                      style={{ background: logged ? '#F0FDF4' : '#F9FAFB', border: `1.5px solid ${logged ? '#86EFAC' : '#E5E7EB'}` }}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shrink-0"
                        style={{ background: logged ? '#008751' : '#0033A0', color: 'white' }}
                      >
                        {cls ? `${cls.level}${cls.section}` : '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm" style={{ color: '#0033A0' }}>{tcs.subject}</p>
                        <p className="text-xs" style={{ color: '#6B7280' }}>
                          {stuCount} students ·{' '}
                          {todaySlots.length > 0
                            ? `Period ${todaySlots[0].period} · ${todaySlots[0].startTime}`
                            : 'No period today'}
                        </p>
                      </div>
                      {logged ? (
                        <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: '#DCFCE7', color: '#008751' }}>✓ Logged</span>
                      ) : (
                        <button
                          onClick={() => router.push('/diary')}
                          className="text-xs font-bold px-2 py-1 rounded-full"
                          style={{ background: '#EFF6FF', color: '#0033A0' }}
                        >
                          Log →
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        )}

        {/* ── At-Risk Students ──────────────────────────────────────── */}
        {atRiskCount > 0 && (
          <Section title="At-Risk Students" action={{ label: 'All Hotspots', href: '/hotspots' }}>
            <div className="flex flex-col gap-2">
              {atRiskStudents.map(({ student: s, subject, score, cls }) => (
                <button
                  key={s.id}
                  onClick={() => router.push(`/students/${s.id}`)}
                  className="flex items-center gap-3 p-3 rounded-xl w-full text-left"
                  style={{ background: '#FFF5F5', border: '1.5px solid #FECACA' }}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                    style={{ background: '#FEE2E2', color: '#E30613' }}
                  >
                    {s.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{s.name}</p>
                    <p className="text-xs" style={{ color: '#6B7280' }}>
                      {cls?.level}{cls?.section} · {subject}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black" style={{ color: '#E30613' }}>{score}%</p>
                    <p className="text-xs" style={{ color: '#6B7280' }}>readiness</p>
                  </div>
                </button>
              ))}
            </div>
          </Section>
        )}

        {/* ── My Intervention Tasks ─────────────────────────────────── */}
        {myInterventions.length > 0 && (
          <Section title="My Tasks" action={{ label: 'All Tasks', href: '/interventions' }}>
            <div className="flex flex-col gap-2">
              {myInterventions.slice(0, 4).map((iv) => {
                const today = new Date().toISOString().slice(0, 10);
                const overdue = iv.dueDate < today;
                const student = iv.studentId ? studentStore.getById(iv.studentId) : null;
                return (
                  <button
                    key={iv.id}
                    onClick={() => router.push('/interventions')}
                    className="flex items-center gap-3 p-3 rounded-xl w-full text-left"
                    style={{
                      background: overdue ? '#FFF5F5' : '#F9FAFB',
                      border: `1.5px solid ${overdue ? '#FECACA' : '#E5E7EB'}`,
                    }}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black shrink-0"
                      style={{
                        background: iv.status === 'in_progress' ? '#FFF7ED' : '#EFF6FF',
                        color:      iv.status === 'in_progress' ? '#EA580C' : '#0033A0',
                      }}
                    >
                      {iv.status === 'in_progress' ? '▶' : '○'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: '#111827' }}>
                        {student?.name ?? 'General'}
                      </p>
                      <p className="text-xs truncate" style={{ color: '#6B7280' }}>{iv.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold" style={{ color: overdue ? '#E30613' : '#9CA3AF' }}>
                        {overdue ? 'Overdue' : `Due ${iv.dueDate.slice(5)}`}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </Section>
        )}

        {/* ── Recent Diary Entries ──────────────────────────────────── */}
        <Section title="Recent Diary Entries" action={{ label: 'New Entry', href: '/diary' }}>
          {recentDiaries.length === 0 ? (
            <EmptyState icon="📓" text="No diary entries yet — log your first class!" />
          ) : (
            <div className="flex flex-col gap-2">
              {recentDiaries.map((d) => {
                const cls = classStore.getById(d.classId);
                return (
                  <div
                    key={d.id}
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ background: '#F9FAFB', border: '1.5px solid #E5E7EB' }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0"
                      style={{
                        background: d.classScore >= SCORE_GREEN ? '#DCFCE7' : d.classScore >= SCORE_YELLOW ? '#FEF9C3' : '#FEE2E2',
                        color: d.classScore >= SCORE_GREEN ? '#008751' : d.classScore >= SCORE_YELLOW ? '#854D0E' : '#E30613',
                      }}
                    >
                      {d.classScore}%
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm" style={{ color: '#111827' }}>
                        {d.subject} · {cls?.level}{cls?.section}
                      </p>
                      <p className="text-xs" style={{ color: '#6B7280' }}>
                        {(d.presentStudentIds ?? []).length} present ·{' '}
                        {new Date(d.submittedAt).toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        </div>{/* end section grid */}

        {/* ── Quick Nav ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-3 mt-5">
          <QuickNav icon="✉️" label="Messages"      badge={unreadMsgs}            onClick={() => router.push('/messages')} />
          <QuickNav icon="🔥" label="Hotspots"      badge={hotspotCount}          onClick={() => router.push('/hotspots')} />
          <QuickNav icon="📋" label="Tasks"         badge={myInterventions.length} onClick={() => router.push('/interventions')} />
          <QuickNav icon="📊" label="Scores"        badge={0}                     onClick={() => router.push('/broadsheet')} />
        </div>
      </main>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function ImpactPill({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className="flex-1 text-center min-w-0">
      <p className="text-lg font-black leading-none" style={{ color }}>{value}</p>
      <p className="text-xs mt-0.5 leading-tight" style={{ color: '#6B7280' }}>{label}</p>
    </div>
  );
}

function Section({
  title, action, children,
}: { title: string; action?: { label: string; href: string }; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="font-bold text-sm" style={{ color: '#111827' }}>{title}</h2>
        {action && (
          <button
            onClick={() => router.push(action.href)}
            className="text-xs font-semibold"
            style={{ color: '#0033A0' }}
          >
            {action.label} →
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function QuickNav({
  icon, label, badge, onClick,
}: { icon: string; label: string; badge: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl p-4 flex flex-col items-center gap-1 relative"
      style={{ background: 'white', border: '1.5px solid #E5E7EB' }}
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-xs font-semibold" style={{ color: '#374151' }}>{label}</span>
      {badge > 0 && (
        <span
          className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center"
          style={{ background: '#E30613', color: 'white' }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="text-center py-8 rounded-xl" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
      <p className="text-3xl mb-2">{icon}</p>
      <p className="text-sm" style={{ color: '#6B7280' }}>{text}</p>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0033A0' }}>
      <div className="text-white text-center">
        <div className="text-2xl font-black mb-2">Eko Learn</div>
        <div className="text-sm opacity-60 animate-pulse">Loading...</div>
      </div>
    </div>
  );
}
