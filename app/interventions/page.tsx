'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Role } from '@/lib/types';
import type { Intervention } from '@/lib/types';
import { interventionStore, studentStore, userStore } from '@/lib/storage';
import Navbar from '@/components/Navbar';

type FilterStatus = 'all' | 'open' | 'in_progress' | 'completed';

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  open:        { bg: '#FEF9C3', color: '#854D0E', label: 'Open' },
  in_progress: { bg: '#EFF6FF', color: '#0033A0', label: 'In Progress' },
  completed:   { bg: '#DCFCE7', color: '#008751', label: 'Done' },
};

export default function InterventionsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [filter, setFilter]               = useState<FilterStatus>('all');
  const [showForm, setShowForm]           = useState(false);

  // new intervention form
  const [newStudentId, setNewStudentId] = useState('');
  const [newDesc,      setNewDesc]      = useState('');
  const [newDue,       setNewDue]       = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10);
  });

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }
    loadInterventions();
  }, [user, isLoading, router]);

  function loadInterventions() {
    if (!user) return;
    if (user.role === Role.TEACHER) {
      setInterventions(interventionStore.getByTeacher(user.id));
    } else if (user.role === Role.HEADTEACHER || user.role === Role.SCHOOLADMIN) {
      setInterventions(interventionStore.getBySchool(user.schoolId ?? ''));
    } else {
      setInterventions(interventionStore.getAll());
    }
  }

  function markComplete(id: string) {
    interventionStore.complete(id);
    loadInterventions();
  }

  function markInProgress(id: string) {
    const all = interventionStore.getAll();
    const idx = all.findIndex((i) => i.id === id);
    if (idx >= 0) {
      all[idx].status = 'in_progress';
      const updated = all[idx];
      interventionStore.save(updated);
      loadInterventions();
    }
  }

  function addIntervention() {
    if (!user || !newDesc.trim()) return;
    const iv: Intervention = {
      id: `iv-${Date.now()}`,
      studentId: newStudentId || undefined,
      schoolId: user.schoolId,
      assignedBy: user.id,
      assignedTo: user.id,
      description: newDesc.trim(),
      dueDate: newDue,
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    interventionStore.save(iv);
    setNewDesc(''); setNewStudentId(''); setShowForm(false);
    loadInterventions();
  }

  const myStudents = user?.schoolId
    ? studentStore.getBySchool(user.schoolId)
    : [];

  const filtered = interventions.filter((i) => filter === 'all' || i.status === filter);
  const openCnt  = interventions.filter((i) => i.status === 'open').length;
  const inProgCnt = interventions.filter((i) => i.status === 'in_progress').length;

  if (isLoading || !user) return null;

  return (
    <div className="min-h-screen" style={{ background: '#F5F7FA' }}>
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-5 pb-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-xs font-bold" style={{ color: '#9CA3AF' }}>Intervention Tracker</p>
            <h1 className="text-xl font-black" style={{ color: '#0033A0' }}>Interventions</h1>
            <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>
              {openCnt} open · {inProgCnt} in progress
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 rounded-xl text-sm font-bold text-white"
            style={{ background: '#0033A0' }}
          >
            + New
          </button>
        </div>

        {/* New intervention form */}
        {showForm && (
          <div className="rounded-2xl p-4 mb-5" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
            <h2 className="font-bold text-sm mb-3" style={{ color: '#0033A0' }}>Log New Intervention</h2>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: '#374151' }}>Student (optional)</label>
                <select className="w-full rounded-xl px-3 py-2 text-sm" style={{ border: '1.5px solid #E5E7EB' }}
                  value={newStudentId} onChange={(e) => setNewStudentId(e.target.value)}>
                  <option value="">General / No specific student</option>
                  {myStudents.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: '#374151' }}>Description</label>
                <textarea
                  className="w-full rounded-xl px-3 py-2 text-sm resize-none"
                  style={{ border: '1.5px solid #E5E7EB' }}
                  rows={3}
                  placeholder="Describe the intervention plan…"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: '#374151' }}>Due Date</label>
                <input type="date" className="w-full rounded-xl px-3 py-2 text-sm" style={{ border: '1.5px solid #E5E7EB' }}
                  value={newDue} onChange={(e) => setNewDue(e.target.value)} />
              </div>
              <button onClick={addIntervention} disabled={!newDesc.trim()}
                className="py-3 rounded-xl font-bold text-sm text-white"
                style={{ background: newDesc.trim() ? '#008751' : '#D1D5DB' }}>
                Save Intervention
              </button>
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-1 mb-4 p-1 rounded-xl" style={{ background: '#E5E7EB' }}>
          {(['all', 'open', 'in_progress', 'completed'] as FilterStatus[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: filter === f ? 'white' : 'transparent', color: filter === f ? '#0033A0' : '#6B7280' }}>
              {f === 'all' ? 'All' : f === 'in_progress' ? 'In Progress' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex flex-col gap-3">
          {filtered.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: '#9CA3AF' }}>
              {filter === 'all' ? 'No interventions yet. Log one above.' : `No ${filter} interventions.`}
            </p>
          ) : (
            filtered.map((iv) => <InterventionCard key={iv.id} iv={iv}
              onComplete={() => markComplete(iv.id)}
              onInProgress={() => markInProgress(iv.id)}
            />)
          )}
        </div>
      </main>
    </div>
  );
}

function InterventionCard({
  iv, onComplete, onInProgress,
}: {
  iv: Intervention;
  onComplete: () => void;
  onInProgress: () => void;
}) {
  const student  = iv.studentId ? studentStore.getById(iv.studentId) : null;
  const assignee = userStore.getById(iv.assignedTo);
  const style    = STATUS_STYLE[iv.status];
  const daysLeft = Math.ceil((new Date(iv.dueDate).getTime() - Date.now()) / 86400000);
  const overdue  = daysLeft < 0 && iv.status !== 'completed';

  return (
    <div className="rounded-2xl p-4" style={{ background: 'white', border: `1.5px solid ${overdue ? '#FCA5A5' : '#E5E7EB'}` }}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: style.bg, color: style.color }}>
              {style.label}
            </span>
            {overdue && (
              <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: '#FEE2E2', color: '#E30613' }}>
                Overdue
              </span>
            )}
          </div>
          <p className="text-sm font-semibold" style={{ color: '#111827' }}>
            {student ? student.name : 'General Intervention'}
          </p>
          <p className="text-xs mt-1" style={{ color: '#6B7280' }}>{iv.description}</p>
          <p className="text-xs mt-2" style={{ color: '#9CA3AF' }}>
            Due {new Date(iv.dueDate).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
            {assignee && ` · ${assignee.name}`}
            {iv.completedAt && ` · Completed ${new Date(iv.completedAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}`}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      {iv.status !== 'completed' && (
        <div className="flex gap-2 mt-3">
          {iv.status === 'open' && (
            <button onClick={onInProgress}
              className="flex-1 py-2 rounded-xl text-xs font-bold"
              style={{ background: '#EFF6FF', color: '#0033A0', border: '1.5px solid #BFDBFE' }}>
              Start →
            </button>
          )}
          <button onClick={onComplete}
            className="flex-1 py-2 rounded-xl text-xs font-bold"
            style={{ background: '#DCFCE7', color: '#008751', border: '1.5px solid #86EFAC' }}>
            Mark Done ✓
          </button>
          {student && (
            <button onClick={() => window.location.href = `/students/${student.id}`}
              className="flex-1 py-2 rounded-xl text-xs font-bold"
              style={{ background: '#F9FAFB', color: '#374151', border: '1.5px solid #E5E7EB' }}>
              View Profile
            </button>
          )}
        </div>
      )}
    </div>
  );
}
