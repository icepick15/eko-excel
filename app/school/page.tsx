'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Role, ColorStatus, WAEC_SUBJECTS } from '@/lib/types';
import type { Student, Hotspot } from '@/lib/types';
import { studentStore, metricsStore, hotspotStore, schoolStore } from '@/lib/storage';
import { recomputeStudent } from '@/lib/calculations';
import Navbar from '@/components/Navbar';

type SortKey = 'name' | 'readiness' | 'class';
type FilterStatus = 'all' | 'green' | 'yellow' | 'red';

export default function SchoolDashboard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [students, setStudents] = useState<Student[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('readiness');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterSubject, setFilterSubject] = useState('');
  const [computed, setComputed] = useState(false);
  const [schoolName, setSchoolName] = useState('');

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.role !== Role.TEACHER && user.role !== Role.HEADTEACHER) {
      router.replace('/dashboard'); return;
    }

    const school = schoolStore.getById(user.schoolId!);
    setSchoolName(school?.name ?? 'School');

    const myStudents = studentStore.getBySchool(user.schoolId!);
    setStudents(myStudents);

    if (!computed) {
      myStudents.forEach((s) => recomputeStudent(s.id));
      setComputed(true);
    }

    setHotspots(hotspotStore.getBySchool(user.schoolId!));
  }, [user, isLoading, computed, router]);

  function getAvgReadiness(studentId: string, subject?: string): number {
    const metrics = metricsStore.getByStudent(studentId);
    const filtered = subject ? metrics.filter((m) => m.subject === subject) : metrics;
    if (filtered.length === 0) return 0;
    return filtered.reduce((a, m) => a + m.readinessScore, 0) / filtered.length;
  }

  function getStatus(studentId: string, subject?: string): ColorStatus {
    const avg = getAvgReadiness(studentId, subject);
    return avg >= 75 ? ColorStatus.GREEN : avg >= 55 ? ColorStatus.YELLOW : ColorStatus.RED;
  }

  const processedStudents = students
    .filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.class.toLowerCase().includes(search.toLowerCase()))
    .filter((s) => filterStatus === 'all' || getStatus(s.id, filterSubject || undefined) === filterStatus)
    .sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'class') return a.class.localeCompare(b.class);
      return getAvgReadiness(b.id) - getAvgReadiness(a.id);
    });

  const greenCount = students.filter((s) => getStatus(s.id) === ColorStatus.GREEN).length;
  const yellowCount = students.filter((s) => getStatus(s.id) === ColorStatus.YELLOW).length;
  const redCount = students.filter((s) => getStatus(s.id) === ColorStatus.RED).length;

  const STATUS_CONFIG: Record<FilterStatus, { color: string; bg: string; label: string }> = {
    all: { color: 'var(--lagos-blue)', bg: 'var(--lagos-blue-light)', label: 'All' },
    green: { color: 'var(--lagos-green)', bg: 'var(--lagos-green-light)', label: 'On Track' },
    yellow: { color: 'var(--lagos-gold)', bg: '#FEF9C3', label: 'Watch' },
    red: { color: 'var(--lagos-red)', bg: '#FEE2E2', label: 'At Risk' },
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--lagos-blue)' }}>{schoolName}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>School Overview · {students.length} Students</p>
        </div>

        {/* Stats summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="card text-center">
            <div className="text-2xl font-black mb-1" style={{ color: 'var(--lagos-blue)' }}>{students.length}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Total Students</div>
          </div>
          <div className="card text-center">
            <div className="text-2xl font-black mb-1" style={{ color: 'var(--lagos-green)' }}>{greenCount}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>On Track</div>
          </div>
          <div className="card text-center">
            <div className="text-2xl font-black mb-1" style={{ color: 'var(--lagos-gold)' }}>{yellowCount}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Needs Attention</div>
          </div>
          <div className="card text-center">
            <div className="text-2xl font-black mb-1" style={{ color: 'var(--lagos-red)' }}>{redCount}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>At Risk</div>
          </div>
        </div>

        {/* Hotspots section */}
        {hotspots.length > 0 && (
          <div id="hotspots" className="card mb-6">
            <h2 className="font-bold text-sm mb-3" style={{ color: 'var(--lagos-red)' }}>
              ⚠ Active Hotspots ({hotspots.length})
            </h2>
            <div className="grid sm:grid-cols-2 gap-2">
              {hotspots.slice(0, 6).map((h) => {
                const s = studentStore.getById(h.studentId);
                return (
                  <div
                    key={h.id}
                    className="flex items-center gap-2 p-3 rounded-xl cursor-pointer hover:opacity-80"
                    style={{
                      background: h.severity === 'critical' ? '#FEE2E2' : h.severity === 'high' ? '#FEF9C3' : 'var(--lagos-blue-light)',
                    }}
                    onClick={() => router.push(`/students/${h.studentId}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-xs">{s?.name}</div>
                      <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{h.description}</div>
                    </div>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded font-bold capitalize shrink-0"
                      style={{
                        background: h.severity === 'critical' ? 'var(--lagos-red)' : h.severity === 'high' ? 'var(--lagos-gold)' : 'var(--lagos-blue)',
                        color: 'white',
                      }}
                    >
                      {h.severity}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Filters + Search */}
        <div className="card mb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              className="input flex-1"
              placeholder="Search students by name or class..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className="input sm:w-40" value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}>
              <option value="">All Subjects</option>
              {WAEC_SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="input sm:w-32" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              <option value="readiness">By Readiness</option>
              <option value="name">By Name</option>
              <option value="class">By Class</option>
            </select>
          </div>
          {/* Status filter pills */}
          <div className="flex gap-2 mt-3 flex-wrap">
            {(['all', 'green', 'yellow', 'red'] as FilterStatus[]).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className="text-xs px-3 py-1.5 rounded-full font-semibold transition-all"
                style={{
                  background: filterStatus === status ? STATUS_CONFIG[status].color : STATUS_CONFIG[status].bg,
                  color: filterStatus === status ? 'white' : STATUS_CONFIG[status].color,
                }}
              >
                {STATUS_CONFIG[status].label}
                {status !== 'all' && (
                  <span className="ml-1.5 opacity-70">
                    ({status === 'green' ? greenCount : status === 'yellow' ? yellowCount : redCount})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Student table */}
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--lagos-blue)', color: 'white' }}>
                  <th className="text-left text-xs font-bold px-4 py-3">Student</th>
                  <th className="text-left text-xs font-bold px-4 py-3">Class</th>
                  {WAEC_SUBJECTS.map((s) => (
                    <th key={s} className="text-center text-xs font-bold px-2 py-3">{s.slice(0, 4)}.</th>
                  ))}
                  <th className="text-center text-xs font-bold px-4 py-3">Overall</th>
                </tr>
              </thead>
              <tbody>
                {processedStudents.map((student, idx) => {
                  const metrics = metricsStore.getByStudent(student.id);
                  const avg = getAvgReadiness(student.id);
                  const status = getStatus(student.id);
                  return (
                    <tr
                      key={student.id}
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ background: idx % 2 === 0 ? 'white' : 'var(--background)' }}
                      onClick={() => router.push(`/students/${student.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                            style={{ background: 'var(--lagos-blue-light)', color: 'var(--lagos-blue)' }}
                          >
                            {student.name.charAt(0)}
                          </div>
                          <span className="text-sm font-medium">{student.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{student.class}</td>
                      {WAEC_SUBJECTS.map((subject) => {
                        const m = metrics.find((x) => x.subject === subject);
                        const score = m?.readinessScore ?? 0;
                        const sc = m?.colorStatus ?? ColorStatus.RED;
                        return (
                          <td key={subject} className="px-2 py-3 text-center">
                            <span
                              className="text-xs font-bold px-2 py-0.5 rounded-full"
                              style={{
                                background: sc === ColorStatus.GREEN ? '#D1FAE5' : sc === ColorStatus.YELLOW ? '#FEF9C3' : '#FEE2E2',
                                color: sc === ColorStatus.GREEN ? '#065F46' : sc === ColorStatus.YELLOW ? '#854D0E' : '#991B1B',
                              }}
                            >
                              {score.toFixed(0)}
                            </span>
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-center">
                        <span
                          className="text-sm font-black px-3 py-1 rounded-full"
                          style={{
                            background: status === ColorStatus.GREEN ? '#D1FAE5' : status === ColorStatus.YELLOW ? '#FEF9C3' : '#FEE2E2',
                            color: status === ColorStatus.GREEN ? '#065F46' : status === ColorStatus.YELLOW ? '#854D0E' : '#991B1B',
                          }}
                        >
                          {avg.toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {processedStudents.length === 0 && (
            <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>
              <div className="text-2xl mb-2">🔍</div>
              <div className="text-sm">No students match your filters</div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
