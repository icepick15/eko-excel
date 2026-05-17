'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Role, ColorStatus, WAEC_SUBJECTS } from '@/lib/types';
import type { District, School, Student } from '@/lib/types';
import { districtStore, schoolStore, studentStore, metricsStore, hotspotStore } from '@/lib/storage';
import { recomputeStudent } from '@/lib/calculations';
import Navbar from '@/components/Navbar';

export default function MinistryDashboard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [districts, setDistricts] = useState<District[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [computed, setComputed] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.role !== Role.MINISTRY) { router.replace('/dashboard'); return; }

    const d = districtStore.getAll();
    setDistricts(d);

    const students = studentStore.getAll();
    setAllStudents(students);

    if (!computed) {
      students.forEach((s) => recomputeStudent(s.id));
      setComputed(true);
    }
  }, [user, isLoading, computed, router]);

  function getAvg(studentId: string, subject?: string): number {
    const metrics = metricsStore.getByStudent(studentId);
    const filtered = subject ? metrics.filter((m) => m.subject === subject) : metrics;
    if (filtered.length === 0) return 0;
    return filtered.reduce((a, m) => a + m.readinessScore, 0) / filtered.length;
  }

  function getStatus(studentId: string): ColorStatus {
    const avg = getAvg(studentId);
    return avg >= 75 ? ColorStatus.GREEN : avg >= 55 ? ColorStatus.YELLOW : ColorStatus.RED;
  }

  function districtAvg(districtId: string, subject?: string): number {
    const students = studentStore.getByDistrict(districtId);
    if (students.length === 0) return 0;
    return students.reduce((a, s) => a + getAvg(s.id, subject), 0) / students.length;
  }

  const stateAvg = allStudents.length > 0
    ? allStudents.reduce((a, s) => a + getAvg(s.id), 0) / allStudents.length
    : 0;

  const greenCount = allStudents.filter((s) => getStatus(s.id) === ColorStatus.GREEN).length;
  const yellowCount = allStudents.filter((s) => getStatus(s.id) === ColorStatus.YELLOW).length;
  const redCount = allStudents.filter((s) => getStatus(s.id) === ColorStatus.RED).length;
  const totalHotspots = allStudents.reduce((acc, s) => acc + hotspotStore.getByStudent(s.id).length, 0);

  const stateStatus = stateAvg >= 75 ? ColorStatus.GREEN : stateAvg >= 55 ? ColorStatus.YELLOW : ColorStatus.RED;
  const stateBarColor = stateStatus === ColorStatus.GREEN ? 'var(--lagos-green)' : stateStatus === ColorStatus.YELLOW ? 'var(--lagos-gold)' : 'var(--lagos-red)';

  const allSchools = schoolStore.getAll();

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-xs px-2 py-1 rounded font-medium"
              style={{ background: 'var(--lagos-gold-light)', color: 'var(--lagos-gold)' }}>
              Ministry of Education
            </div>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--lagos-blue)' }}>Lagos State Education Overview</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {districts.length} Districts &nbsp;·&nbsp; {allSchools.length} Schools &nbsp;·&nbsp; {allStudents.length} Students
          </p>
        </div>

        {/* State readiness banner */}
        <div
          className="rounded-2xl p-6 mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-5"
          style={{ background: 'var(--lagos-blue)', color: 'white' }}
        >
          <div className="flex-1">
            <div className="text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.7)' }}>State-Wide WAEC Readiness</div>
            <div className="text-5xl font-black mb-2">{stateAvg.toFixed(0)}%</div>
            <div className="progress-bar" style={{ background: 'rgba(255,255,255,0.2)', height: '8px' }}>
              <div className="progress-bar-fill" style={{ width: `${stateAvg}%`, background: stateBarColor, height: '8px' }} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center sm:shrink-0">
            <div className="px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <div className="text-2xl font-black" style={{ color: '#6EE7B7' }}>{greenCount}</div>
              <div className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>On Track</div>
            </div>
            <div className="px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <div className="text-2xl font-black" style={{ color: '#FDE047' }}>{yellowCount}</div>
              <div className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>Watch</div>
            </div>
            <div className="px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <div className="text-2xl font-black" style={{ color: '#FCA5A5' }}>{redCount}</div>
              <div className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>At Risk</div>
            </div>
          </div>
        </div>

        {/* District heatmap */}
        <div className="card mb-6">
          <h2 className="font-bold text-sm mb-4" style={{ color: 'var(--lagos-blue)' }}>District × Subject Heatmap</h2>
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th className="text-left text-xs font-bold px-3 py-2" style={{ color: 'var(--text-muted)' }}>District</th>
                  {WAEC_SUBJECTS.map((s) => (
                    <th key={s} className="text-center text-xs font-bold px-2 py-2" style={{ color: 'var(--text-muted)' }}>{s}</th>
                  ))}
                  <th className="text-center text-xs font-bold px-3 py-2" style={{ color: 'var(--text-muted)' }}>Overall</th>
                </tr>
              </thead>
              <tbody>
                {districts.map((district, idx) => {
                  const overall = districtAvg(district.id);
                  return (
                    <tr key={district.id} style={{ background: idx % 2 === 0 ? 'white' : 'var(--background)' }}>
                      <td className="px-3 py-3 text-sm font-semibold">{district.name.split('(')[0].trim()}</td>
                      {WAEC_SUBJECTS.map((subject) => {
                        const avg = districtAvg(district.id, subject);
                        const bg = avg >= 75 ? '#D1FAE5' : avg >= 55 ? '#FEF9C3' : '#FEE2E2';
                        const color = avg >= 75 ? '#065F46' : avg >= 55 ? '#854D0E' : '#991B1B';
                        return (
                          <td key={subject} className="px-2 py-3 text-center">
                            <div
                              className="mx-auto w-12 py-1 rounded-lg text-xs font-bold text-center"
                              style={{ background: bg, color }}
                            >
                              {avg.toFixed(0)}%
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-3 py-3 text-center">
                        <span
                          className="text-sm font-black px-3 py-1 rounded-full"
                          style={{
                            background: overall >= 75 ? '#D1FAE5' : overall >= 55 ? '#FEF9C3' : '#FEE2E2',
                            color: overall >= 75 ? '#065F46' : overall >= 55 ? '#854D0E' : '#991B1B',
                          }}
                        >
                          {overall.toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Districts detail */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {districts.map((district) => {
            const dStudents = studentStore.getByDistrict(district.id);
            const dSchools = schoolStore.getByDistrict(district.id);
            const avg = districtAvg(district.id);
            const dHotspots = dStudents.reduce((acc, s) => acc + hotspotStore.getByStudent(s.id).length, 0);
            const dStatus = avg >= 75 ? ColorStatus.GREEN : avg >= 55 ? ColorStatus.YELLOW : ColorStatus.RED;
            const barColor = dStatus === ColorStatus.GREEN ? 'var(--lagos-green)' : dStatus === ColorStatus.YELLOW ? 'var(--lagos-gold)' : 'var(--lagos-red)';

            return (
              <div key={district.id} className="card">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-bold text-sm" style={{ color: 'var(--lagos-blue)' }}>
                      {district.name.split('(')[0].trim()}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {dSchools.length} schools · {dStudents.length} students
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-black" style={{ color: barColor }}>{avg.toFixed(0)}%</div>
                  </div>
                </div>
                <div className="progress-bar mb-3">
                  <div className="progress-bar-fill" style={{ width: `${avg}%`, background: barColor }} />
                </div>
                <div className="flex justify-between text-xs">
                  <span style={{ color: 'var(--lagos-green)' }}>
                    ✓ {dStudents.filter((s) => getStatus(s.id) === ColorStatus.GREEN).length} on track
                  </span>
                  <span style={{ color: 'var(--lagos-red)' }}>
                    ✗ {dStudents.filter((s) => getStatus(s.id) === ColorStatus.RED).length} at risk
                  </span>
                  {dHotspots > 0 && (
                    <span style={{ color: 'var(--lagos-gold)' }}>⚠ {dHotspots} alerts</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Alerts summary */}
        <div className="card">
          <h2 className="font-bold text-sm mb-3" style={{ color: 'var(--lagos-blue)' }}>
            State-Wide Alerts &nbsp;
            <span className="font-normal text-xs" style={{ color: 'var(--text-muted)' }}>
              ({totalHotspots} active)
            </span>
          </h2>
          <div className="grid sm:grid-cols-2 gap-2">
            {allStudents
              .flatMap((s) => hotspotStore.getByStudent(s.id).filter((h) => h.severity === 'critical').map((h) => ({ ...h, studentName: s.name, school: allSchools.find((sc) => sc.id === s.schoolId)?.name })))
              .slice(0, 8)
              .map((h) => (
                <div
                  key={h.id}
                  className="flex items-start gap-2 p-3 rounded-xl cursor-pointer hover:opacity-80"
                  style={{ background: '#FEE2E2' }}
                  onClick={() => router.push(`/students/${h.studentId}`)}
                >
                  <div className="text-red-600 font-black text-xs pt-0.5 shrink-0">CRITICAL</div>
                  <div>
                    <div className="text-xs font-bold text-red-800">{h.studentName}</div>
                    <div className="text-xs text-red-700">{h.description}</div>
                    <div className="text-xs text-red-500 mt-0.5">{h.school?.split(',')[0]}</div>
                  </div>
                </div>
              ))}
          </div>
          {totalHotspots === 0 && (
            <div className="text-center py-6" style={{ color: 'var(--text-muted)' }}>
              <div className="text-2xl mb-1">✓</div>
              <div className="text-sm">No active critical alerts state-wide</div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
