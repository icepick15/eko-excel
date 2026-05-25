'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Role, CORE_SUBJECTS } from '@/lib/types';
import type { Student, Message } from '@/lib/types';
import {
  studentStore, metricsStore, hotspotStore, diaryStore,
  schoolStore, classStore, attendanceStore, messageStore, auth,
} from '@/lib/storage';
import Navbar from '@/components/Navbar';

// ── helpers ───────────────────────────────────────────────────────────────────

function lastFriday(): string {
  const d = new Date();
  const dow = d.getDay(); // 0=Sun … 6=Sat
  // days back to reach Friday: Sun=2, Mon=3, Tue=4, Wed=5, Thu=6, Fri=0, Sat=1
  const back = dow === 5 ? 0 : dow === 6 ? 1 : dow + 2;
  d.setDate(d.getDate() - back);
  return d.toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function attendanceRate(studentId: string, classId: string): number {
  const diaries = diaryStore.getByClass(classId).slice(0, 20);
  if (diaries.length === 0) return 100;
  const present = diaries.filter((d) => (d.presentStudentIds ?? []).includes(studentId)).length;
  return Math.round((present / diaries.length) * 100);
}

// ── component ─────────────────────────────────────────────────────────────────

export default function ParentDashboard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [children, setChildren]           = useState<Student[]>([]);
  const [activeIdx, setActiveIdx]         = useState(0);
  const [messages, setMessages]           = useState<Message[]>([]);
  const [activeThread, setActiveThread]   = useState<Message | null>(null);
  const [replyText, setReplyText]         = useState('');
  const [view, setView]                   = useState<'report' | 'messages'>('report');

  const reportDate = lastFriday();

  useEffect(() => {
    if (isLoading) return;
    if (!user)                     { router.replace('/login'); return; }
    if (user.role !== Role.PARENT) { router.replace('/login'); return; }

    const ids = user.childIds ?? [];
    if (ids.length === 0) { setChildren([]); return; }

    const kids = ids.map((id) => studentStore.getById(id)).filter(Boolean) as Student[];
    setChildren(kids);
    setMessages(messageStore.getForUser(user.id));
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0033A0' }}>
        <div className="text-white text-center">
          <div className="text-xl font-bold mb-2">Eko Excel</div>
          <div className="text-sm" style={{ color: '#BFDBFE' }}>Loading report…</div>
        </div>
      </div>
    );
  }

  if (!isLoading && user && children.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0033A0' }}>
        <div className="text-white text-center px-6">
          <div className="text-xl font-bold mb-2">No children linked</div>
          <div className="text-sm mb-4" style={{ color: '#BFDBFE' }}>
            Your account has no students linked to it. Please contact your school administrator.
          </div>
          <button
            onClick={() => { auth.logout(); router.replace('/login'); }}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  const child = children[activeIdx];
  const cls   = classStore.getById(child.classId);
  const school = schoolStore.getById(child.schoolId);
  const subjectMetrics = metricsStore.getByStudent(child.id);
  const hotspots = hotspotStore.getByStudent(child.id).filter((h) => !h.resolvedAt);
  const attend   = attendanceRate(child.id, child.classId);

  const overallAvg = subjectMetrics.length > 0
    ? Math.round(subjectMetrics.reduce((a, m) => a + m.readinessScore, 0) / subjectMetrics.length)
    : 0;

  const statusColor = overallAvg >= 75 ? '#008751' : overallAvg >= 55 ? '#FFCC00' : '#E30613';
  const statusLabel = overallAvg >= 75 ? 'On Track' : overallAvg >= 55 ? 'Needs Support' : 'At Risk';
  const criticalHs  = hotspots.filter((h) => h.severity === 'critical');

  const unreadCount = messages.filter((m) => !m.isRead).length;

  function openThread(msg: Message) {
    messageStore.markRead(msg.id);
    setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, isRead: true } : m));
    setActiveThread({ ...msg, isRead: true });
  }

  function sendReply() {
    if (!activeThread || !replyText.trim() || !user) return;
    const reply = {
      id: `reply-${Date.now()}`,
      fromUserId: user.id,
      fromName: user.name,
      body: replyText.trim(),
      sentAt: new Date().toISOString(),
    };
    messageStore.addReply(activeThread.id, reply);
    setActiveThread((prev) => prev ? { ...prev, replies: [...(prev.replies ?? []), reply] } : prev);
    setReplyText('');
  }

  // ── THREAD VIEW ─────────────────────────────────────────────────────────────
  if (activeThread) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#F5F7FA' }}>
        <Navbar />
        <div className="max-w-2xl mx-auto w-full px-4 py-4 flex flex-col flex-1">
          <button onClick={() => setActiveThread(null)} className="flex items-center gap-1 text-sm mb-4" style={{ color: '#0033A0' }}>
            ← Back
          </button>
          <div className="rounded-2xl p-4 mb-4" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
            <p className="font-bold text-sm" style={{ color: '#0033A0' }}>{activeThread.subject}</p>
            <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>
              From {activeThread.fromName} · {new Date(activeThread.sentAt).toLocaleDateString('en-NG')}
            </p>
            <p className="text-sm mt-3" style={{ color: '#111827' }}>{activeThread.body}</p>
          </div>

          {/* Replies */}
          {(activeThread.replies ?? []).map((r) => (
            <div
              key={r.id}
              className={`max-w-xs rounded-2xl px-4 py-2 mb-2 text-sm ${r.fromUserId === user?.id ? 'ml-auto' : 'mr-auto'}`}
              style={{
                background: r.fromUserId === user?.id ? '#0033A0' : '#F3F4F6',
                color: r.fromUserId === user?.id ? 'white' : '#111827',
              }}
            >
              <p>{r.body}</p>
              <p className="text-xs mt-1 opacity-60">{r.fromName}</p>
            </div>
          ))}

          {/* Reply box */}
          <div className="flex gap-2 mt-4">
            <input
              className="flex-1 rounded-xl px-3 py-2 text-sm"
              style={{ border: '1.5px solid #E5E7EB' }}
              placeholder="Reply to teacher…"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendReply()}
            />
            <button
              onClick={sendReply}
              disabled={!replyText.trim()}
              className="px-4 py-2 rounded-xl text-sm font-bold"
              style={{ background: '#0033A0', color: 'white', opacity: replyText.trim() ? 1 : 0.4 }}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── MAIN DASHBOARD ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: '#F5F7FA' }}>
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 py-5 pb-10">
        {/* Header */}
        <div className="mb-4">
          <p className="text-xs font-bold" style={{ color: '#9CA3AF' }}>Parent Portal</p>
          <h1 className="text-xl font-black" style={{ color: '#0033A0' }}>
            Welcome, {user?.name.split(' ').slice(-1)[0]}
          </h1>
        </div>

        {/* Child switcher (shown only if multiple children) */}
        {children.length > 1 && (
          <div className="flex gap-2 mb-4 overflow-x-auto">
            {children.map((kid, i) => (
              <button
                key={kid.id}
                onClick={() => setActiveIdx(i)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold shrink-0"
                style={{
                  background: activeIdx === i ? '#0033A0' : 'white',
                  color: activeIdx === i ? 'white' : '#374151',
                  border: '1.5px solid #E5E7EB',
                }}
              >
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: activeIdx === i ? 'rgba(255,255,255,0.2)' : '#EFF6FF', color: activeIdx === i ? 'white' : '#0033A0' }}
                >
                  {kid.name.charAt(0)}
                </span>
                {kid.name.split(' ')[0]}
              </button>
            ))}
          </div>
        )}

        {/* View toggle */}
        <div className="flex gap-1 mb-4 p-1 rounded-xl" style={{ background: '#E5E7EB' }}>
          {(['report', 'messages'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="flex-1 py-1.5 rounded-lg text-sm font-semibold relative"
              style={{
                background: view === v ? 'white' : 'transparent',
                color: view === v ? '#0033A0' : '#6B7280',
              }}
            >
              {v === 'report' ? 'Weekly Report' : 'Messages'}
              {v === 'messages' && unreadCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-xs flex items-center justify-center text-white font-bold"
                  style={{ background: '#E30613', fontSize: '10px' }}
                >
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── MESSAGES VIEW ───────────────────────────────────────────────────── */}
        {view === 'messages' && (
          <div className="rounded-2xl p-4" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
            {messages.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: '#9CA3AF' }}>No messages yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {messages.map((msg) => (
                  <button
                    key={msg.id}
                    onClick={() => openThread(msg)}
                    className="flex items-start gap-3 p-3 rounded-xl w-full text-left"
                    style={{ background: msg.isRead ? '#F9FAFB' : '#EFF6FF', border: '1.5px solid #E5E7EB' }}
                  >
                    {!msg.isRead && (
                      <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: '#E30613' }} />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: '#111827' }}>{msg.subject}</p>
                      <p className="text-xs truncate mt-0.5" style={{ color: '#6B7280' }}>{msg.fromName}</p>
                      <p className="text-xs truncate mt-1" style={{ color: '#9CA3AF' }}>{msg.body.slice(0, 60)}…</p>
                    </div>
                    <span className="text-xs shrink-0" style={{ color: '#9CA3AF' }}>
                      {new Date(msg.sentAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── REPORT VIEW ─────────────────────────────────────────────────────── */}
        {view === 'report' && (
          <>
            {/* Critical alert */}
            {criticalHs.length > 0 && (
              <div className="rounded-xl p-4 mb-4 flex items-start gap-3" style={{ background: '#FEE2E2', border: '1.5px solid #FCA5A5' }}>
                <span className="text-xl shrink-0">🚨</span>
                <div>
                  <p className="font-bold text-sm" style={{ color: '#E30613' }}>Urgent — Action Required</p>
                  <p className="text-xs mt-1" style={{ color: '#991B1B' }}>
                    {child.name.split(' ')[0]} has {criticalHs.length} critical issue{criticalHs.length > 1 ? 's' : ''}. Please contact the school this week.
                  </p>
                </div>
              </div>
            )}

            {/* Report card */}
            <div className="rounded-2xl p-4 mb-4" style={{ background: 'white', border: '2px solid #0033A0' }}>
              {/* Card header */}
              <div className="flex items-center justify-between pb-3 mb-3" style={{ borderBottom: '1px solid #E5E7EB' }}>
                <div>
                  <p className="text-xs font-bold tracking-widest uppercase" style={{ color: '#9CA3AF' }}>Weekly Progress Report</p>
                  <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{reportDate}</p>
                </div>
                <span
                  className="px-2 py-1 rounded-full text-xs font-bold"
                  style={{ background: overallAvg >= 75 ? '#DCFCE7' : overallAvg >= 55 ? '#FEF9C3' : '#FEE2E2', color: statusColor }}
                >
                  {statusLabel}
                </span>
              </div>

              {/* Student info */}
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center font-black text-lg shrink-0"
                  style={{ background: '#0033A0', color: 'white' }}
                >
                  {child.name.charAt(0)}
                </div>
                <div>
                  <p className="font-bold" style={{ color: '#0033A0' }}>{child.name}</p>
                  <p className="text-xs" style={{ color: '#6B7280' }}>
                    Class {cls?.level}{cls?.section} · {school?.name?.split(',')[0]}
                  </p>
                </div>
              </div>

              {/* Key metrics */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <MetricBox value={`${overallAvg}%`} label="WAEC Readiness" color={statusColor} />
                <MetricBox
                  value={`${attend}%`}
                  label="Attendance"
                  color={attend >= 80 ? '#008751' : attend >= 60 ? '#FFCC00' : '#E30613'}
                />
                <MetricBox
                  value={String(hotspots.length)}
                  label="Open Alerts"
                  color={hotspots.length === 0 ? '#008751' : hotspots.length <= 2 ? '#FFCC00' : '#E30613'}
                />
              </div>

              {/* Subject breakdown */}
              <div className="mb-4">
                <p className="text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Subject Readiness</p>
                <div className="flex flex-col gap-2">
                  {CORE_SUBJECTS.map((subject) => {
                    const metric = subjectMetrics.find((m) => m.subject === subject);
                    const score  = metric?.readinessScore ?? 0;
                    const barCol = score >= 75 ? '#008751' : score >= 55 ? '#FFCC00' : score > 0 ? '#E30613' : '#D1D5DB';
                    return (
                      <div key={subject} className="flex items-center gap-3">
                        <p className="text-xs font-medium shrink-0" style={{ width: 120, color: '#374151' }}>{subject}</p>
                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: '#F3F4F6' }}>
                          <div className="h-2 rounded-full" style={{ width: `${score}%`, background: barCol }} />
                        </div>
                        <p className="text-xs font-bold w-8 text-right shrink-0" style={{ color: barCol }}>
                          {score > 0 ? `${Math.round(score)}%` : '—'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Hotspot alerts */}
              {hotspots.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Areas Needing Attention</p>
                  <div className="flex flex-col gap-1.5">
                    {hotspots.slice(0, 3).map((h) => (
                      <div
                        key={h.id}
                        className="flex items-start gap-2 p-2 rounded-lg"
                        style={{ background: h.severity === 'critical' ? '#FEE2E2' : '#FEF9C3' }}
                      >
                        <span className="shrink-0">{h.severity === 'critical' ? '🔴' : '🟡'}</span>
                        <p className="text-xs" style={{ color: h.severity === 'critical' ? '#991B1B' : '#854D0E' }}>
                          {h.subject} — readiness at {h.readinessScore}%
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer advice */}
              <p className="text-xs pt-3" style={{ borderTop: '1px solid #E5E7EB', color: '#6B7280' }}>
                {overallAvg >= 75
                  ? `${child.name.split(' ')[0]} is performing well — keep encouraging daily study!`
                  : overallAvg >= 55
                    ? `${child.name.split(' ')[0]} needs consistent study time this week. Ask about the highlighted subjects.`
                    : `Please speak with ${child.name.split(' ')[0]}'s teacher urgently — extra support is needed now.`}
              </p>
            </div>

            {/* Action tips */}
            <div className="rounded-xl p-4" style={{ background: '#EFF6FF', border: '1.5px solid #BFDBFE' }}>
              <p className="font-bold text-sm mb-2" style={{ color: '#0033A0' }}>What you can do this week</p>
              <div className="flex flex-col gap-1.5 text-xs" style={{ color: '#1E40AF' }}>
                {hotspots.length === 0 ? (
                  <p>✓ Ask {child.name.split(' ')[0]} to explain one topic from class — it reinforces learning.</p>
                ) : (
                  <>
                    <p>① Ask {child.name.split(' ')[0]} to spend 20 min on the highlighted weak subject tonight.</p>
                    <p>② Confirm they attend every class this week — attendance directly impacts WAEC readiness.</p>
                    {criticalHs.length > 0 && <p>③ Contact the school to arrange extra support this week.</p>}
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function MetricBox({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className="text-center p-3 rounded-xl" style={{ background: '#F9FAFB' }}>
      <p className="text-2xl font-black leading-none" style={{ color }}>{value}</p>
      <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>{label}</p>
    </div>
  );
}
