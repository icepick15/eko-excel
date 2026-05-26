'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Role } from '@/lib/types';
import type { Hotspot, Student, Class, User } from '@/lib/types';
import { hotspotStore, studentStore, classStore, tcsStore, interventionStore, userStore } from '@/lib/storage';
import Navbar from '@/components/Navbar';

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2 };
const SEVERITY_STYLES = {
  critical: { bg: '#FEE2E2', color: '#E30613',  border: '#FECACA', label: 'Critical' },
  high:     { bg: '#FFF7ED', color: '#EA580C',  border: '#FDBA74', label: 'High' },
  medium:   { bg: '#FEF9C3', color: '#854D0E',  border: '#FDE047', label: 'Medium' },
};

const TREND_ICON: Record<string, string> = { up: '↑', down: '↓', stable: '→' };
const TREND_COLOR: Record<string, string> = { up: '#008751', down: '#E30613', stable: '#6B7280' };

type SortBy = 'severity' | 'readiness' | 'subject';

export default function HotspotsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [studentMap, setStudentMap] = useState<Record<string, Student>>({});
  const [classMap, setClassMap]   = useState<Record<string, Class>>({});
  const [sortBy, setSortBy]       = useState<SortBy>('severity');
  const [filterSubject, setFilterSubject] = useState('');
  const [resolving,      setResolving]      = useState<string | null>(null);
  const [assigning,      setAssigning]      = useState<Hotspot | null>(null);
  const [schoolTeachers, setSchoolTeachers] = useState<User[]>([]);
  const [assignForm, setAssignForm] = useState({
    assignedTo:  '',
    description: '',
    dueDate:     new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  });

  function load() {
    if (!user) return;

    let myStudentIds: Set<string>;
    if (user.role === Role.TEACHER || user.role === Role.HEADTEACHER) {
      const tcs = tcsStore.getByTeacher(user.id);
      const classIds = [...new Set(tcs.map((t) => t.classId))];
      const studs = classIds.flatMap((cId) => studentStore.getByClass(cId));
      myStudentIds = new Set(studs.map((s) => s.id));
    } else {
      // School admin or other school role
      const studs = studentStore.getBySchool(user.schoolId ?? '');
      myStudentIds = new Set(studs.map((s) => s.id));
    }

    const all = hotspotStore.getAll().filter((h) => myStudentIds.has(h.studentId));

    // Build student + class maps
    const sMap: Record<string, Student> = {};
    const cMap: Record<string, Class>   = {};
    for (const h of all) {
      if (!sMap[h.studentId]) {
        const s = studentStore.getById(h.studentId);
        if (s) {
          sMap[h.studentId] = s;
          const c = classStore.getById(s.classId);
          if (c) cMap[s.classId] = c;
        }
      }
    }

    setStudentMap(sMap);
    setClassMap(cMap);
    setHotspots(all);
  }

  function openAssignForm(hotspot: Hotspot) {
    setAssigning(hotspot);
    const student = studentMap[hotspot.studentId];
    setAssignForm({
      assignedTo:  user?.id ?? '',
      description: `Remedial support for ${hotspot.subject} — readiness at ${Math.round(hotspot.readinessScore)}%`,
      dueDate:     new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    });
    setSchoolTeachers(userStore.getTeachers(student?.schoolId ?? user?.schoolId ?? ''));
  }

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }
    load();
  }, [user, isLoading, router]);

  const open   = hotspots.filter((h) => !h.resolvedAt);
  const closed = hotspots.filter((h) => !!h.resolvedAt);

  const subjects = [...new Set(open.map((h) => h.subject))].sort();

  const filtered = open
    .filter((h) => !filterSubject || h.subject === filterSubject)
    .sort((a, b) => {
      if (sortBy === 'severity')  return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      if (sortBy === 'readiness') return a.readinessScore - b.readinessScore;
      return a.subject.localeCompare(b.subject);
    });

  function handleResolve(id: string) {
    setResolving(id);
    hotspotStore.resolve(id);
    load();
    setResolving(null);
  }

  function handleAssignSubmit() {
    if (!user || !assigning || !assignForm.assignedTo || !assignForm.description) return;
    const student = studentMap[assigning.studentId];
    interventionStore.save({
      id:          uid(),
      hotspotId:   assigning.id,
      studentId:   assigning.studentId,
      schoolId:    student?.schoolId ?? user.schoolId,
      assignedBy:  user.id,
      assignedTo:  assignForm.assignedTo,
      description: assignForm.description,
      dueDate:     assignForm.dueDate,
      status:      'open',
      createdAt:   new Date().toISOString(),
    });
    setAssigning(null);
  }

  if (isLoading) return null;

  return (
    <div className="min-h-screen" style={{ background: '#F5F7FA' }}>
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-5 pb-10">

        {/* Header */}
        <div className="flex items-center gap-2 mb-5">
          <button onClick={() => router.back()} style={{ color: '#0033A0' }} className="text-sm font-medium">←</button>
          <h1 className="text-xl font-black" style={{ color: '#0033A0' }}>Learning Hotspots</h1>
          {open.length > 0 && (
            <span
              className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center"
              style={{ background: '#E30613', color: 'white' }}
            >
              {open.length}
            </span>
          )}
        </div>

        {/* Sort + Filter row */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {(['severity', 'readiness', 'subject'] as SortBy[]).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className="px-3 py-1.5 rounded-full text-xs font-bold capitalize"
              style={{
                background: sortBy === s ? '#0033A0' : 'white',
                color: sortBy === s ? 'white' : '#374151',
                border: `1.5px solid ${sortBy === s ? '#0033A0' : '#E5E7EB'}`,
              }}
            >
              {s === 'readiness' ? 'Lowest First' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
          <select
            className="ml-auto px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ border: '1.5px solid #E5E7EB', background: 'white', color: '#374151' }}
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
          >
            <option value="">All Subjects</option>
            {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Open hotspots */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 rounded-2xl" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
            <p className="text-4xl mb-3">✅</p>
            <p className="font-semibold" style={{ color: '#374151' }}>No active hotspots</p>
            <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>All students are above the 70% readiness threshold</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 mb-6">
            {filtered.map((h) => {
              const student = studentMap[h.studentId];
              const cls = student ? classMap[student.classId] : null;
              const sev = SEVERITY_STYLES[h.severity];
              const isResolving = resolving === h.id;

              return (
                <div
                  key={h.id}
                  className="rounded-2xl p-4"
                  style={{ background: 'white', border: `1.5px solid ${sev.border}` }}
                >
                  <div className="flex items-start gap-3">
                    {/* Severity badge */}
                    <div
                      className="px-2 py-1 rounded-lg text-xs font-bold shrink-0 mt-0.5"
                      style={{ background: sev.bg, color: sev.color }}
                    >
                      {sev.label}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-bold text-sm" style={{ color: '#111827' }}>
                          {student?.name ?? 'Unknown'}
                        </p>
                        <span className="text-xs" style={{ color: '#6B7280' }}>
                          {cls?.level}{cls?.section}
                        </span>
                      </div>
                      <p className="text-xs mb-1" style={{ color: '#6B7280' }}>{h.subject}</p>

                      {/* Score + trend */}
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: '#F3F4F6' }}>
                          <div
                            className="h-2 rounded-full"
                            style={{
                              width: `${h.readinessScore}%`,
                              background: h.readinessScore < 40 ? '#E30613' : '#F97316',
                            }}
                          />
                        </div>
                        <span className="text-sm font-black" style={{ color: sev.color }}>
                          {(h.readinessScore ?? 0).toFixed(0)}%
                        </span>
                        <span
                          className="text-base font-black"
                          style={{ color: TREND_COLOR[h.trend] }}
                          title={`Trend: ${h.trend}`}
                        >
                          {TREND_ICON[h.trend]}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => router.push(`/students/${h.studentId}`)}
                      className="flex-1 py-2 rounded-xl text-xs font-bold"
                      style={{ background: '#EFF6FF', color: '#0033A0', border: '1.5px solid #BFDBFE' }}
                    >
                      View Profile →
                    </button>
                    <button
                      onClick={() => openAssignForm(h)}
                      className="flex-1 py-2 rounded-xl text-xs font-bold"
                      style={{ background: '#FFF7ED', color: '#EA580C', border: '1.5px solid #FDBA74' }}
                    >
                      Log Intervention
                    </button>
                    <button
                      onClick={() => handleResolve(h.id)}
                      disabled={isResolving}
                      className="flex-1 py-2 rounded-xl text-xs font-bold"
                      style={{ background: '#F0FDF4', color: '#008751', border: '1.5px solid #86EFAC' }}
                    >
                      {isResolving ? '...' : 'Resolve ✓'}
                    </button>
                  </div>

                  <p className="text-xs mt-2" style={{ color: '#9CA3AF' }}>
                    Detected {new Date(h.detectedAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Resolved hotspots */}
        {closed.length > 0 && (
          <div>
            <h2 className="text-sm font-bold mb-3" style={{ color: '#6B7280' }}>
              Resolved ({closed.length})
            </h2>
            <div className="flex flex-col gap-2">
              {closed.slice(0, 5).map((h) => {
                const student = studentMap[h.studentId];
                return (
                  <div
                    key={h.id}
                    className="flex items-center gap-3 p-3 rounded-xl opacity-60"
                    style={{ background: 'white', border: '1.5px solid #E5E7EB' }}
                  >
                    <span className="text-base">✅</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{student?.name ?? '—'}</p>
                      <p className="text-xs" style={{ color: '#6B7280' }}>{h.subject}</p>
                    </div>
                    <p className="text-xs" style={{ color: '#9CA3AF' }}>
                      Resolved {new Date(h.resolvedAt!).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Log Intervention modal — bottom sheet */}
      {assigning && (
        <div
          className="fixed inset-0 flex items-end justify-center z-50"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setAssigning(null); }}
        >
          <div className="w-full max-w-lg rounded-t-3xl p-6" style={{ background: 'white', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="mb-4">
              <h2 className="font-black text-lg" style={{ color: '#0033A0' }}>Log Intervention</h2>
              <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
                {studentMap[assigning.studentId]?.name} · {assigning.subject}
              </p>
            </div>

            <label className="text-xs font-bold mb-1 block" style={{ color: '#374151' }}>Assign To</label>
            <select
              className="w-full rounded-xl px-3 py-2.5 text-sm mb-3"
              style={{ border: '1.5px solid #E5E7EB' }}
              value={assignForm.assignedTo}
              onChange={(e) => setAssignForm({ ...assignForm, assignedTo: e.target.value })}
            >
              <option value="">Select teacher…</option>
              {schoolTeachers.map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({t.role})</option>
              ))}
            </select>

            <label className="text-xs font-bold mb-1 block" style={{ color: '#374151' }}>Action Description</label>
            <textarea
              className="w-full rounded-xl px-3 py-2.5 text-sm mb-3"
              style={{ border: '1.5px solid #E5E7EB', resize: 'none' }}
              rows={3}
              value={assignForm.description}
              onChange={(e) => setAssignForm({ ...assignForm, description: e.target.value })}
            />

            <label className="text-xs font-bold mb-1 block" style={{ color: '#374151' }}>Due Date</label>
            <input
              type="date"
              className="w-full rounded-xl px-3 py-2.5 text-sm mb-5"
              style={{ border: '1.5px solid #E5E7EB' }}
              value={assignForm.dueDate}
              onChange={(e) => setAssignForm({ ...assignForm, dueDate: e.target.value })}
            />

            <div className="flex gap-3">
              <button
                onClick={() => setAssigning(null)}
                className="flex-1 py-3 rounded-xl text-sm font-bold"
                style={{ background: '#F3F4F6', color: '#374151' }}
              >
                Cancel
              </button>
              <button
                onClick={handleAssignSubmit}
                disabled={!assignForm.assignedTo || !assignForm.description}
                className="flex-1 py-3 rounded-xl text-sm font-bold"
                style={{
                  background: (!assignForm.assignedTo || !assignForm.description) ? '#E5E7EB' : '#EA580C',
                  color:      (!assignForm.assignedTo || !assignForm.description) ? '#9CA3AF' : 'white',
                }}
              >
                Log Intervention
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
