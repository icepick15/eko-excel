'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Role } from '@/lib/types';
import type { Intervention, User, Student } from '@/lib/types';
import { interventionStore, userStore, studentStore } from '@/lib/storage';
import Navbar from '@/components/Navbar';

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

type StatusFilter = 'all' | 'open' | 'in_progress' | 'completed' | 'overdue';

const STATUS_STYLES = {
  open:        { bg: '#EFF6FF', color: '#0033A0', label: 'Open' },
  in_progress: { bg: '#FFF7ED', color: '#EA580C', label: 'In Progress' },
  completed:   { bg: '#F0FDF4', color: '#008751', label: 'Completed' },
} as const;

export default function InterventionsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [userMap,       setUserMap]       = useState<Record<string, User>>({});
  const [studentMap,    setStudentMap]    = useState<Record<string, Student>>({});
  const [teachers,      setTeachers]      = useState<User[]>([]);
  const [allStudents,   setAllStudents]   = useState<Student[]>([]);
  const [filterStatus,  setFilterStatus]  = useState<StatusFilter>('all');
  const [showCreate,    setShowCreate]    = useState(false);
  const [form, setForm] = useState({
    studentId:   '',
    assignedTo:  '',
    description: '',
    dueDate:     new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  });

  const today = new Date().toISOString().slice(0, 10);

  function isOverdue(iv: Intervention) {
    return iv.status !== 'completed' && iv.dueDate < today;
  }

  function load() {
    if (!user) return;

    let all: Intervention[];
    if (user.role === Role.TEACHER) {
      all = interventionStore.getByTeacher(user.id);
    } else if (user.role === Role.HEADTEACHER || user.role === Role.SCHOOLADMIN) {
      all = interventionStore.getBySchool(user.schoolId ?? '');
    } else {
      all = interventionStore.getAll();
    }

    const uMap: Record<string, User> = {};
    const sMap: Record<string, Student> = {};
    for (const iv of all) {
      for (const uid of [iv.assignedTo, iv.assignedBy]) {
        if (uid && !uMap[uid]) { const u = userStore.getById(uid); if (u) uMap[uid] = u; }
      }
      if (iv.studentId && !sMap[iv.studentId]) {
        const s = studentStore.getById(iv.studentId);
        if (s) sMap[iv.studentId] = s;
      }
    }

    setUserMap(uMap);
    setStudentMap(sMap);
    setInterventions(all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }

    const sId = user.schoolId ?? '';
    setTeachers(userStore.getTeachers(sId));
    setAllStudents(studentStore.getBySchool(sId));
    if (user.role === Role.TEACHER) {
      setForm((f) => ({ ...f, assignedTo: user.id }));
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isLoading, router]);

  const filtered = interventions.filter((iv) => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'overdue') return isOverdue(iv);
    return iv.status === filterStatus;
  });

  const stats = {
    open:       interventions.filter((iv) => iv.status === 'open').length,
    inProgress: interventions.filter((iv) => iv.status === 'in_progress').length,
    completed:  interventions.filter((iv) => iv.status === 'completed').length,
    overdue:    interventions.filter((iv) => isOverdue(iv)).length,
  };

  function handleStatusChange(iv: Intervention, newStatus: Intervention['status']) {
    interventionStore.save({
      ...iv,
      status: newStatus,
      ...(newStatus === 'completed' ? { completedAt: new Date().toISOString() } : {}),
    });
    load();
  }

  function handleCreate() {
    if (!user || !form.studentId || !form.assignedTo || !form.description || !form.dueDate) return;
    const student = allStudents.find((s) => s.id === form.studentId);
    interventionStore.save({
      id:          uid(),
      studentId:   form.studentId,
      schoolId:    student?.schoolId ?? user.schoolId,
      assignedBy:  user.id,
      assignedTo:  form.assignedTo,
      description: form.description,
      dueDate:     form.dueDate,
      status:      'open',
      createdAt:   new Date().toISOString(),
    });
    setShowCreate(false);
    setForm({
      studentId:   '',
      assignedTo:  user.role === Role.TEACHER ? user.id : '',
      description: '',
      dueDate:     new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    });
    load();
  }

  if (isLoading) return null;

  const canCreate = user?.role !== Role.DISTRICT && user?.role !== Role.MINISTRY;

  return (
    <div className="min-h-screen" style={{ background: '#F5F7FA' }}>
      <Navbar />
      <main className="max-w-2xl md:max-w-4xl lg:max-w-5xl mx-auto px-4 md:px-6 py-5 md:py-8 pb-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <button onClick={() => router.back()} className="text-sm font-medium mb-1 block" style={{ color: '#0033A0' }}>←</button>
            <h1 className="text-xl font-black" style={{ color: '#0033A0' }}>Interventions</h1>
            <p className="text-sm" style={{ color: '#6B7280' }}>
              {user?.role === Role.TEACHER ? 'Tasks assigned to you' : 'School intervention log'}
            </p>
          </div>
          {canCreate && (
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 rounded-xl text-sm font-bold"
              style={{ background: '#0033A0', color: 'white' }}
            >
              + New
            </button>
          )}
        </div>

        {/* Stats row — tappable status filters */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {([
            { label: 'Open',        value: stats.open,       color: '#0033A0', filter: 'open'        },
            { label: 'In Progress', value: stats.inProgress, color: '#EA580C', filter: 'in_progress' },
            { label: 'Completed',   value: stats.completed,  color: '#008751', filter: 'completed'   },
            { label: 'Overdue',     value: stats.overdue,    color: '#E30613', filter: 'overdue'     },
          ] as { label: string; value: number; color: string; filter: StatusFilter }[]).map(({ label, value, color, filter }) => {
            const active = filterStatus === filter;
            return (
              <button
                key={filter}
                onClick={() => setFilterStatus(active ? 'all' : filter)}
                className="rounded-2xl p-3 text-center"
                style={{
                  background: active ? color : 'white',
                  border: `1.5px solid ${active ? color : '#E5E7EB'}`,
                }}
              >
                <p className="text-xl font-black leading-none" style={{ color: active ? 'white' : color }}>{value}</p>
                <p className="text-xs mt-1 leading-tight" style={{ color: active ? 'rgba(255,255,255,0.8)' : '#9CA3AF' }}>{label}</p>
              </button>
            );
          })}
        </div>

        {/* Intervention list */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 rounded-2xl" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
            <p className="text-4xl mb-3">✅</p>
            <p className="font-semibold" style={{ color: '#374151' }}>
              No interventions{filterStatus !== 'all' ? ` (${filterStatus.replace('_', ' ')})` : ''}
            </p>
            {filterStatus === 'all' && canCreate && (
              <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>Log one from a hotspot or tap + New above</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            {filtered.map((iv) => {
              const student  = studentMap[iv.studentId ?? ''];
              const assignee = userMap[iv.assignedTo];
              const assigner = userMap[iv.assignedBy];
              const overdue  = isOverdue(iv);
              const st       = STATUS_STYLES[iv.status];
              const isMyTask = iv.assignedTo === user?.id;
              const canAct   = isMyTask || user?.role === Role.HEADTEACHER || user?.role === Role.SCHOOLADMIN;

              return (
                <div
                  key={iv.id}
                  className="rounded-2xl p-4"
                  style={{ background: 'white', border: `1.5px solid ${overdue ? '#FECACA' : '#E5E7EB'}` }}
                >
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {student ? (
                      <button
                        onClick={() => router.push(`/students/${student.id}`)}
                        className="font-bold text-sm hover:underline"
                        style={{ color: '#111827' }}
                      >
                        {student.name}
                      </button>
                    ) : (
                      <span className="font-bold text-sm" style={{ color: '#111827' }}>General</span>
                    )}
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.color }}>
                      {st.label}
                    </span>
                    {overdue && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#FEE2E2', color: '#E30613' }}>
                        Overdue
                      </span>
                    )}
                  </div>

                  <p className="text-sm mb-2" style={{ color: '#374151' }}>{iv.description}</p>

                  <div className="flex items-center gap-3 text-xs flex-wrap" style={{ color: '#9CA3AF' }}>
                    <span>→ {assignee?.name ?? 'Unknown'}</span>
                    <span>Due {iv.dueDate}</span>
                    {assigner && assigner.id !== iv.assignedTo && (
                      <span>by {assigner.name}</span>
                    )}
                    {iv.completedAt && (
                      <span>
                        completed {new Date(iv.completedAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>

                  {canAct && iv.status !== 'completed' && (
                    <div className="flex gap-2 mt-3">
                      {iv.status === 'open' && (
                        <button
                          onClick={() => handleStatusChange(iv, 'in_progress')}
                          className="flex-1 py-2 rounded-xl text-xs font-bold"
                          style={{ background: '#FFF7ED', color: '#EA580C', border: '1.5px solid #FDBA74' }}
                        >
                          Start →
                        </button>
                      )}
                      <button
                        onClick={() => handleStatusChange(iv, 'completed')}
                        className="flex-1 py-2 rounded-xl text-xs font-bold"
                        style={{ background: '#F0FDF4', color: '#008751', border: '1.5px solid #86EFAC' }}
                      >
                        Mark Complete ✓
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Create modal — bottom sheet */}
      {showCreate && (
        <div
          className="fixed inset-0 flex items-end md:items-center justify-center z-50"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}
        >
          <div className="w-full max-w-lg rounded-t-3xl md:rounded-3xl p-6" style={{ background: 'white', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 className="font-black text-lg mb-4" style={{ color: '#0033A0' }}>Log Intervention</h2>

            <label className="text-xs font-bold mb-1 block" style={{ color: '#374151' }}>Student</label>
            <select
              className="w-full rounded-xl px-3 py-2.5 text-sm mb-3"
              style={{ border: '1.5px solid #E5E7EB' }}
              value={form.studentId}
              onChange={(e) => setForm({ ...form, studentId: e.target.value })}
            >
              <option value="">Select student…</option>
              {allStudents.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            <label className="text-xs font-bold mb-1 block" style={{ color: '#374151' }}>Assign To</label>
            <select
              className="w-full rounded-xl px-3 py-2.5 text-sm mb-3"
              style={{ border: '1.5px solid #E5E7EB' }}
              value={form.assignedTo}
              onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
            >
              <option value="">Select teacher…</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.role})</option>)}
            </select>

            <label className="text-xs font-bold mb-1 block" style={{ color: '#374151' }}>Action Description</label>
            <textarea
              className="w-full rounded-xl px-3 py-2.5 text-sm mb-3"
              style={{ border: '1.5px solid #E5E7EB', resize: 'none' }}
              rows={3}
              placeholder="What remedial action should be taken?"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />

            <label className="text-xs font-bold mb-1 block" style={{ color: '#374151' }}>Due Date</label>
            <input
              type="date"
              className="w-full rounded-xl px-3 py-2.5 text-sm mb-5"
              style={{ border: '1.5px solid #E5E7EB' }}
              value={form.dueDate}
              min={today}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            />

            <div className="flex gap-3">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-3 rounded-xl text-sm font-bold"
                style={{ background: '#F3F4F6', color: '#374151' }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!form.studentId || !form.assignedTo || !form.description}
                className="flex-1 py-3 rounded-xl text-sm font-bold"
                style={{
                  background: (!form.studentId || !form.assignedTo || !form.description) ? '#E5E7EB' : '#0033A0',
                  color:      (!form.studentId || !form.assignedTo || !form.description) ? '#9CA3AF' : 'white',
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
