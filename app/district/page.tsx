'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Role, ColorStatus, CORE_SUBJECTS } from '@/lib/types';
import type { School, Student, Class } from '@/lib/types';
import {
  schoolStore, studentStore, metricsStore, hotspotStore,
  districtStore, classStore, userStore,
} from '@/lib/storage';
import { getSchoolReadinessAvg, getTeacherComplianceThisWeek } from '@/lib/calculations';
import Navbar from '@/components/Navbar';

type SortKey = 'readiness' | 'name' | 'hotspots';

export default function DistrictDashboard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [schools,      setSchools]      = useState<School[]>([]);
  const [allStudents,  setAllStudents]  = useState<Student[]>([]);
  const [districtName, setDistrictName] = useState('');
  const [search,       setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'green' | 'yellow' | 'red'>('all');
  const [sortSchool,   setSortSchool]   = useState<SortKey>('readiness');
  const [selectedSchool, setSelectedSchool] = useState('');

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.role !== Role.DISTRICT) { router.replace('/dashboard'); return; }

    const district = districtStore.getById(user.districtId!);
    setDistrictName(district?.name ?? 'District');

    const mySchools = schoolStore.getByDistrict(user.districtId!);
    setSchools(mySchools);
    setAllStudents(studentStore.getByDistrict(user.districtId!));
  }, [user, isLoading, router]);

  function getStudentAvg(studentId: string, subject?: string): number {
    const ms = metricsStore.getByStudent(studentId);
    const filtered = subject ? ms.filter((m) => m.subject === subject) : ms;
    if (filtered.length === 0) return 0;
    return Math.round(filtered.reduce((a, m) => a + m.readinessScore, 0) / filtered.length);
  }

  function getStatus(avg: number): ColorStatus {
    return avg >= 75 ? ColorStatus.GREEN : avg >= 55 ? ColorStatus.YELLOW : ColorStatus.RED;
  }

  // School-level stats
  const schoolStats = schools.map((school) => {
    const studs = studentStore.getBySchool(school.id);
    const avg = getSchoolReadinessAvg(school.id);
    const hs  = hotspotStore.getBySchool(school.id).length;
    const teachers = userStore.getTeachers(school.id);
    const compliance = teachers.length > 0
      ? Math.round(teachers.reduce((a, t) => a + getTeacherComplianceThisWeek(t.id).rate, 0) / teachers.length)
      : 0;
    return { school, studs, avg, hs, compliance };
  }).sort((a, b) => {
    if (sortSchool === 'name')      return a.school.name.localeCompare(b.school.name);
    if (sortSchool === 'hotspots')  return b.hs - a.hs;
    return a.avg - b.avg; // lowest readiness first by default
  });

  // District totals
  const districtAvg = allStudents.length > 0
    ? Math.round(allStudents.reduce((a, s) => a + getStudentAvg(s.id), 0) / allStudents.length)
    : 0;
  const totalHs  = allStudents.reduce((a, s) => a + hotspotStore.getByStudent(s.id).length, 0);
  const greenCnt = allStudents.filter((s) => getStatus(getStudentAvg(s.id)) === ColorStatus.GREEN).length;
  const redCnt   = allStudents.filter((s) => getStatus(getStudentAvg(s.id)) === ColorStatus.RED).length;

  // Subject heatmap by school
  const heatmap = CORE_SUBJECTS.map((subject) => ({
    subject,
    schools: schools.map((sc) => {
      const studs = studentStore.getBySchool(sc.id);
      const avg = studs.length > 0
        ? Math.round(studs.reduce((a, s) => a + getStudentAvg(s.id, subject), 0) / studs.length)
        : 0;
      return { school: sc, avg };
    }),
  }));

  // Filtered student list
  const filteredStudents = allStudents
    .filter((s) => !selectedSchool || s.schoolId === selectedSchool)
    .filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase()))
    .filter((s) => {
      if (filterStatus === 'all') return true;
      const st = getStatus(getStudentAvg(s.id));
      return st === filterStatus;
    })
    .sort((a, b) => getStudentAvg(a.id) - getStudentAvg(b.id))
    .slice(0, 40);

  if (isLoading) return null;

  return (
    <div className="min-h-screen" style={{ background: '#F5F7FA' }}>
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-5 pb-10">
        {/* Header */}
        <div className="mb-5">
          <span className="text-xs font-bold px-2 py-0.5 rounded-full mb-1 inline-block" style={{ background: '#EFF6FF', color: '#0033A0' }}>
            District View
          </span>
          <h1 className="text-xl font-black" style={{ color: '#0033A0' }}>{districtName}</h1>
          <p className="text-sm" style={{ color: '#6B7280' }}>
            {schools.length} schools · {allStudents.length} students
          </p>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          <KPICard value={`${districtAvg}%`}  label="District Avg" color={districtAvg >= 75 ? '#008751' : districtAvg >= 55 ? '#FFCC00' : '#E30613'} />
          <KPICard value={String(greenCnt)}    label="On Track"     color="#008751" />
          <KPICard value={String(redCnt)}      label="At Risk"      color={redCnt > 0 ? '#E30613' : '#008751'} />
          <KPICard value={String(totalHs)}     label="Hotspots"     color={totalHs > 0 ? '#E30613' : '#008751'} />
        </div>

        {/* School leaderboard */}
        <div className="rounded-2xl p-4 mb-5" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm" style={{ color: '#0033A0' }}>School Performance</h2>
            <select
              className="text-xs rounded-lg px-2 py-1"
              style={{ border: '1.5px solid #E5E7EB', color: '#374151' }}
              value={sortSchool}
              onChange={(e) => setSortSchool(e.target.value as SortKey)}
            >
              <option value="readiness">Sort: Lowest First</option>
              <option value="hotspots">Sort: Most Hotspots</option>
              <option value="name">Sort: Name</option>
            </select>
          </div>
          <div className="flex flex-col gap-3">
            {schoolStats.map(({ school, studs, avg, hs, compliance }, rank) => {
              const color = avg >= 75 ? '#008751' : avg >= 55 ? '#FFCC00' : '#E30613';
              return (
                <button
                  key={school.id}
                  onClick={() => setSelectedSchool(selectedSchool === school.id ? '' : school.id)}
                  className="flex items-center gap-3 w-full text-left"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0"
                    style={{ background: rank === 0 ? '#FEE2E2' : rank === 1 ? '#FEF9C3' : '#F3F4F6', color: rank === 0 ? '#E30613' : rank === 1 ? '#854D0E' : '#6B7280' }}
                  >
                    #{rank + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: '#111827' }}>{school.name.split(',')[0]}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: '#F3F4F6' }}>
                        <div className="h-2 rounded-full" style={{ width: `${avg}%`, background: color }} />
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-black text-sm" style={{ color }}>{avg}%</p>
                    <p className="text-xs" style={{ color: '#9CA3AF' }}>
                      {studs.length} stu {hs > 0 && <span style={{ color: '#E30613' }}>· {hs}🔥</span>}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Subject × School heatmap */}
        <div className="rounded-2xl overflow-hidden mb-5" style={{ border: '1.5px solid #E5E7EB' }}>
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
              <thead>
                <tr style={{ background: '#0033A0', color: 'white' }}>
                  <th className="text-left text-xs font-bold px-3 py-3">Subject</th>
                  {schools.map((sc) => (
                    <th key={sc.id} className="text-center text-xs font-bold px-2 py-3">
                      {sc.name.split(' ').slice(-1)[0].slice(0, 6)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmap.map(({ subject, schools: schoolData }, ri) => (
                  <tr key={subject} style={{ background: ri % 2 === 0 ? 'white' : '#F9FAFB' }}>
                    <td className="px-3 py-2 text-xs font-semibold" style={{ color: '#374151', whiteSpace: 'nowrap' }}>
                      {subject}
                    </td>
                    {schoolData.map(({ school, avg }) => {
                      const bg  = avg >= 75 ? '#DCFCE7' : avg >= 55 ? '#FEF9C3' : avg > 0 ? '#FEE2E2' : '#F3F4F6';
                      const col = avg >= 75 ? '#008751' : avg >= 55 ? '#854D0E' : avg > 0 ? '#E30613' : '#9CA3AF';
                      return (
                        <td key={school.id} className="px-2 py-2 text-center">
                          <span className="text-xs font-black px-1.5 py-0.5 rounded-full" style={{ background: bg, color: col }}>
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

        {/* Student drill-down */}
        <div className="rounded-2xl p-4" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
          <h2 className="font-bold text-sm mb-3" style={{ color: '#0033A0' }}>
            Students ({filteredStudents.length} showing)
            {selectedSchool && (
              <button onClick={() => setSelectedSchool('')} className="ml-2 text-xs" style={{ color: '#9CA3AF' }}>
                · Clear filter ×
              </button>
            )}
          </h2>

          <div className="flex gap-2 mb-3">
            <input
              className="flex-1 rounded-xl px-3 py-2 text-sm"
              style={{ border: '1.5px solid #E5E7EB' }}
              placeholder="Search name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="rounded-xl px-3 py-2 text-xs"
              style={{ border: '1.5px solid #E5E7EB' }}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'all' | 'green' | 'yellow' | 'red')}
            >
              <option value="all">All</option>
              <option value="green">On Track</option>
              <option value="yellow">Needs Help</option>
              <option value="red">At Risk</option>
            </select>
          </div>

          <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
            {filteredStudents.map((s) => {
              const avg = getStudentAvg(s.id);
              const sc  = schools.find((x) => x.id === s.schoolId);
              const cls = classStore.getById(s.classId);
              const col = avg >= 75 ? '#008751' : avg >= 55 ? '#FFCC00' : '#E30613';
              const hs  = hotspotStore.getByStudent(s.id).length;
              return (
                <button
                  key={s.id}
                  onClick={() => router.push(`/students/${s.id}`)}
                  className="flex items-center gap-3 p-2 rounded-xl w-full text-left"
                  style={{ background: '#F9FAFB', border: '1.5px solid #E5E7EB' }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: '#EFF6FF', color: '#0033A0' }}
                  >
                    {s.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{s.name}</p>
                    <p className="text-xs" style={{ color: '#9CA3AF' }}>
                      {sc?.name?.split(',')[0]} · {cls?.level}{cls?.section}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    {hs > 0 && <span className="text-xs" style={{ color: '#E30613' }}>🔥{hs}</span>}
                    <span className="font-black text-sm" style={{ color: col }}>{avg}%</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </main>
    </div>
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
