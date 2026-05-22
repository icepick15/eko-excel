'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Role, ColorStatus, CORE_SUBJECTS } from '@/lib/types';
import type { District, School, Student } from '@/lib/types';
import { districtStore, schoolStore, studentStore, metricsStore, hotspotStore } from '@/lib/storage';
import { getSchoolReadinessAvg } from '@/lib/calculations';
import Navbar from '@/components/Navbar';

// Lagos LGA list mapped to districts
const DISTRICT_LGA: Record<string, string[]> = {
  'dist-1': ['Lagos Island', 'Eti-Osa', 'Apapa'],
  'dist-2': ['Badagry', 'Amuwo-Odofin', 'Ojo'],
  'dist-3': ['Ikorodu', 'Kosofe', 'Somolu'],
  'dist-4': ['Mushin', 'Surulere', 'Agege'],
  'dist-5': ['Alimosho', 'Ifako-Ijaiye', 'Ikeja'],
};

export default function MinistryDashboard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [districts,   setDistricts]   = useState<District[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [allSchools,  setAllSchools]  = useState<School[]>([]);

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.role !== Role.MINISTRY) { router.replace('/dashboard'); return; }

    setDistricts(districtStore.getAll());
    setAllStudents(studentStore.getAll().filter((s) => s.isActive !== false));
    setAllSchools(schoolStore.getAll());
  }, [user, isLoading, router]);

  function getStudentAvg(studentId: string, subject?: string): number {
    const ms = metricsStore.getByStudent(studentId);
    const filtered = subject ? ms.filter((m) => m.subject === subject) : ms;
    if (filtered.length === 0) return 0;
    return Math.round(filtered.reduce((a, m) => a + m.readinessScore, 0) / filtered.length);
  }

  function districtAvg(districtId: string, subject?: string): number {
    const studs = studentStore.getByDistrict(districtId);
    if (studs.length === 0) return 0;
    return Math.round(studs.reduce((a, s) => a + getStudentAvg(s.id, subject), 0) / studs.length);
  }

  const stateAvg = allStudents.length > 0
    ? Math.round(allStudents.reduce((a, s) => a + getStudentAvg(s.id), 0) / allStudents.length)
    : 0;

  const greenCnt = allStudents.filter((s) => getStudentAvg(s.id) >= 75).length;
  const yellowCnt= allStudents.filter((s) => { const a = getStudentAvg(s.id); return a >= 55 && a < 75; }).length;
  const redCnt   = allStudents.filter((s) => getStudentAvg(s.id) < 55).length;
  const totalHs  = allStudents.reduce((a, s) => a + hotspotStore.getByStudent(s.id).length, 0);

  const stateColor = stateAvg >= 75 ? '#008751' : stateAvg >= 55 ? '#FFCC00' : '#E30613';

  // Gender equity
  const maleStudents   = allStudents.filter((s) => s.gender === 'M');
  const femaleStudents = allStudents.filter((s) => s.gender === 'F');
  const maleAvg   = maleStudents.length > 0 ? Math.round(maleStudents.reduce((a, s) => a + getStudentAvg(s.id), 0) / maleStudents.length) : 0;
  const femaleAvg = femaleStudents.length > 0 ? Math.round(femaleStudents.reduce((a, s) => a + getStudentAvg(s.id), 0) / femaleStudents.length) : 0;

  // Subject ranking (state-wide avg per subject)
  const subjectRanking = CORE_SUBJECTS.map((subject) => ({
    subject,
    avg: allStudents.length > 0
      ? Math.round(allStudents.reduce((a, s) => a + getStudentAvg(s.id, subject), 0) / allStudents.length)
      : 0,
  })).sort((a, b) => b.avg - a.avg);

  if (isLoading) return null;

  return (
    <div className="min-h-screen" style={{ background: '#F5F7FA' }}>
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-5 pb-10">
        {/* Header */}
        <div className="mb-5">
          <span className="text-xs font-bold px-2 py-0.5 rounded-full inline-block mb-1" style={{ background: '#FEF9C3', color: '#854D0E' }}>
            Ministry of Education · Lagos State
          </span>
          <h1 className="text-xl font-black" style={{ color: '#0033A0' }}>State-Wide Education Overview</h1>
          <p className="text-sm" style={{ color: '#6B7280' }}>
            {districts.length} districts · {allSchools.length} schools · {allStudents.length} students
          </p>
        </div>

        {/* State readiness banner */}
        <div
          className="rounded-2xl p-5 mb-5 relative overflow-hidden"
          style={{ background: '#0033A0', color: 'white' }}
        >
          <div className="relative z-10">
            <p className="text-sm font-medium opacity-70 mb-1">State-Wide WAEC Readiness</p>
            <div className="flex items-end gap-4 mb-3">
              <span className="text-5xl font-black" style={{ color: stateColor === '#FFCC00' ? '#FFCC00' : 'white' }}>
                {stateAvg}%
              </span>
              <div className="flex-1 pb-1">
                <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.2)' }}>
                  <div className="h-3 rounded-full" style={{ width: `${stateAvg}%`, background: stateColor }} />
                </div>
                <div className="flex justify-between text-xs mt-1 opacity-50">
                  <span>0%</span><span>55%</span><span>75%</span><span>100%</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { v: String(allStudents.length), l: 'Students',  c: 'white' },
                { v: String(greenCnt),  l: 'On Track',  c: '#6EE7B7' },
                { v: String(yellowCnt), l: 'Watch',      c: '#FDE047' },
                { v: String(redCnt),    l: 'At Risk',    c: '#FCA5A5' },
              ].map(({ v, l, c }) => (
                <div key={l} className="text-center px-2 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.1)' }}>
                  <p className="text-xl font-black" style={{ color: c }}>{v}</p>
                  <p className="text-xs opacity-60">{l}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full opacity-10" style={{ background: '#FFCC00' }} />
        </div>

        {/* District comparison */}
        <div className="rounded-2xl p-4 mb-5" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
          <h2 className="font-bold text-sm mb-3" style={{ color: '#0033A0' }}>District Readiness</h2>
          <div className="flex flex-col gap-3">
            {districts
              .map((d) => ({ d, avg: districtAvg(d.id), studs: studentStore.getByDistrict(d.id), hs: hotspotStore.getByDistrict(d.id).length }))
              .sort((a, b) => b.avg - a.avg)
              .map(({ d, avg, studs, hs }, rank) => {
                const color = avg >= 75 ? '#008751' : avg >= 55 ? '#FFCC00' : '#E30613';
                return (
                  <div key={d.id} className="flex items-center gap-3">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                      style={{ background: rank === 0 ? '#DCFCE7' : rank === districts.length - 1 ? '#FEE2E2' : '#F3F4F6', color: rank === 0 ? '#008751' : rank === districts.length - 1 ? '#E30613' : '#6B7280' }}
                    >
                      #{rank + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: '#374151' }}>
                        {d.name.split('(')[0].trim()}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: '#F3F4F6' }}>
                          <div className="h-2 rounded-full" style={{ width: `${avg}%`, background: color }} />
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-black" style={{ color }}>{avg}%</p>
                      <p className="text-xs" style={{ color: '#9CA3AF' }}>
                        {studs.length}stu {hs > 0 && <span style={{ color: '#E30613' }}>·{hs}🔥</span>}
                      </p>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Subject ranking */}
        <div className="rounded-2xl p-4 mb-5" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
          <h2 className="font-bold text-sm mb-3" style={{ color: '#0033A0' }}>Subject Performance Ranking</h2>
          {subjectRanking.map(({ subject, avg }, i) => {
            const color = avg >= 75 ? '#008751' : avg >= 55 ? '#FFCC00' : '#E30613';
            return (
              <div key={subject} className="flex items-center gap-3 mb-3">
                <div className="w-6 text-xs font-black text-right shrink-0" style={{ color: '#9CA3AF' }}>#{i + 1}</div>
                <p className="text-sm font-semibold flex-1" style={{ color: '#374151' }}>{subject}</p>
                <div className="w-32 h-2 rounded-full overflow-hidden" style={{ background: '#F3F4F6' }}>
                  <div className="h-2 rounded-full" style={{ width: `${avg}%`, background: color }} />
                </div>
                <p className="text-sm font-black w-10 text-right shrink-0" style={{ color }}>{avg}%</p>
              </div>
            );
          })}
        </div>

        {/* Gender equity panel */}
        <div className="rounded-2xl p-4 mb-5" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
          <h2 className="font-bold text-sm mb-3" style={{ color: '#0033A0' }}>Gender Equity</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl p-4 text-center" style={{ background: '#EFF6FF' }}>
              <p className="text-3xl font-black" style={{ color: '#0033A0' }}>{maleAvg}%</p>
              <p className="text-sm font-bold mt-1" style={{ color: '#374151' }}>Male</p>
              <p className="text-xs" style={{ color: '#9CA3AF' }}>{maleStudents.length} students</p>
            </div>
            <div className="rounded-xl p-4 text-center" style={{ background: '#FDF4FF' }}>
              <p className="text-3xl font-black" style={{ color: '#7C3AED' }}>{femaleAvg}%</p>
              <p className="text-sm font-bold mt-1" style={{ color: '#374151' }}>Female</p>
              <p className="text-xs" style={{ color: '#9CA3AF' }}>{femaleStudents.length} students</p>
            </div>
          </div>
          {Math.abs(maleAvg - femaleAvg) > 5 && (
            <div className="mt-3 p-3 rounded-xl" style={{ background: '#FEF9C3', border: '1.5px solid #FDE047' }}>
              <p className="text-xs font-bold" style={{ color: '#854D0E' }}>
                ⚠ Gender gap of {Math.abs(maleAvg - femaleAvg)}% detected — {maleAvg > femaleAvg ? 'Female' : 'Male'} students are underperforming
              </p>
            </div>
          )}
        </div>

        {/* District × Subject heatmap */}
        <div className="rounded-2xl overflow-hidden mb-5" style={{ border: '1.5px solid #E5E7EB' }}>
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
              <thead>
                <tr style={{ background: '#0033A0', color: 'white' }}>
                  <th className="text-left text-xs font-bold px-3 py-3" style={{ minWidth: 120 }}>District</th>
                  {CORE_SUBJECTS.map((s) => (
                    <th key={s} className="text-center text-xs font-bold px-2 py-3" style={{ minWidth: 72 }}>
                      {s.split(' ')[0].slice(0, 5)}
                    </th>
                  ))}
                  <th className="text-center text-xs font-bold px-3 py-3">Overall</th>
                </tr>
              </thead>
              <tbody>
                {districts.map((d, ri) => {
                  const overall = districtAvg(d.id);
                  return (
                    <tr key={d.id} style={{ background: ri % 2 === 0 ? 'white' : '#F9FAFB' }}>
                      <td className="px-3 py-2.5 text-xs font-semibold" style={{ color: '#374151' }}>
                        {d.name.split('(')[0].trim().split(' ').slice(-1)[0]}
                      </td>
                      {CORE_SUBJECTS.map((subject) => {
                        const avg = districtAvg(d.id, subject);
                        const bg  = avg >= 75 ? '#DCFCE7' : avg >= 55 ? '#FEF9C3' : avg > 0 ? '#FEE2E2' : '#F3F4F6';
                        const col = avg >= 75 ? '#008751' : avg >= 55 ? '#854D0E' : avg > 0 ? '#E30613' : '#9CA3AF';
                        return (
                          <td key={subject} className="px-2 py-2.5 text-center">
                            <span className="text-xs font-black px-1.5 py-0.5 rounded-full" style={{ background: bg, color: col }}>
                              {avg > 0 ? `${avg}%` : '—'}
                            </span>
                          </td>
                        );
                      })}
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className="text-xs font-black px-2 py-0.5 rounded-full"
                          style={{
                            background: overall >= 75 ? '#DCFCE7' : overall >= 55 ? '#FEF9C3' : '#FEE2E2',
                            color: overall >= 75 ? '#008751' : overall >= 55 ? '#854D0E' : '#E30613',
                          }}
                        >
                          {overall > 0 ? `${overall}%` : '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Critical hotspots */}
        {totalHs > 0 && (
          <div className="rounded-2xl p-4" style={{ background: 'white', border: '1.5px solid #FECACA' }}>
            <h2 className="font-bold text-sm mb-3" style={{ color: '#E30613' }}>
              Critical Alerts State-Wide ({totalHs})
            </h2>
            <div className="grid sm:grid-cols-2 gap-2">
              {allStudents
                .flatMap((s) => hotspotStore.getByStudent(s.id).filter((h) => h.severity === 'critical').map((h) => ({ ...h, s })))
                .slice(0, 8)
                .map(({ s, id, subject, readinessScore, studentId }) => {
                  const school = allSchools.find((sc) => sc.id === s.schoolId);
                  return (
                    <button
                      key={id}
                      onClick={() => router.push(`/students/${studentId}`)}
                      className="flex items-start gap-2 p-3 rounded-xl w-full text-left"
                      style={{ background: '#FEF2F2', border: '1.5px solid #FECACA' }}
                    >
                      <span className="text-base">🔴</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate" style={{ color: '#E30613' }}>{s.name}</p>
                        <p className="text-xs" style={{ color: '#9CA3AF' }}>
                          {subject} · {(readinessScore ?? 0).toFixed(0)}% · {school?.name?.split(',')[0]}
                        </p>
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
