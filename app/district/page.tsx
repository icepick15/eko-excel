'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Role, CORE_SUBJECTS } from '@/lib/types';
import type { School, Student, Class } from '@/lib/types';
import {
  schoolStore, studentStore, metricsStore, hotspotStore,
  districtStore, classStore, userStore,
} from '@/lib/storage';
import { getTeacherComplianceThisWeek, getColorStatus, scoreColor, SCORE_GREEN, SCORE_YELLOW, getDistrictTrend, getSchoolTrend } from '@/lib/calculations';
import { generateAlerts } from '@/lib/alerts';
import TrendChart from '@/components/TrendChart';
import Navbar from '@/components/Navbar';

type SortKey = 'readiness' | 'name' | 'hotspots';

function DistrictContent() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const paramId = params.get('id');

  const [schools,      setSchools]      = useState<School[]>([]);
  const [allStudents,  setAllStudents]  = useState<Student[]>([]);
  const [districtName, setDistrictName] = useState('');
  const [search,       setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'green' | 'yellow' | 'red'>('all');
  const [sortSchool,   setSortSchool]   = useState<SortKey>('readiness');
  const [districtAvg,     setDistrictAvg]     = useState(0);
  const [totalHs,         setTotalHs]         = useState(0);
  const [greenCnt,        setGreenCnt]        = useState(0);
  const [redCnt,          setRedCnt]          = useState(0);
  const [schoolStatsList, setSchoolStatsList] = useState<{ school: School; studs: Student[]; avg: number; hs: number; compliance: number }[]>([]);
  const [heatmapData,     setHeatmapData]     = useState<{ subject: string; schools: { school: School; avg: number }[] }[]>([]);
  const [studentAvgMap,   setStudentAvgMap]   = useState<Map<string, number>>(new Map());
  const [studentHsMap,    setStudentHsMap]    = useState<Map<string, number>>(new Map());
  const [districtTrend,   setDistrictTrend]   = useState<ReturnType<typeof getDistrictTrend>>([]);
  const [schoolTrends,    setSchoolTrends]    = useState<Map<string, ReturnType<typeof getSchoolTrend>>>(new Map());

  const viewDistrictId = paramId ?? user?.districtId ?? '';

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.role !== Role.DISTRICT && user.role !== Role.MINISTRY) { router.replace('/dashboard'); return; }
    if (user.role === Role.MINISTRY && !paramId) { router.replace('/ministry'); return; }

    const district = districtStore.getById(viewDistrictId);
    setDistrictName(district?.name ?? 'District');

    const schoolsList = schoolStore.getByDistrict(viewDistrictId);
    const studsList   = studentStore.getByDistrict(viewDistrictId);
    setSchools(schoolsList);
    setAllStudents(studsList);

    // Build per-student avg maps from a single metricsStore read
    const allMetrics = metricsStore.getAll();
    const studIdSet  = new Set(studsList.map((s) => s.id));

    const studentOverallAvg = new Map<string, number>();
    const studentSubjAvg    = new Map<string, Map<string, number>>();
    for (const s of studsList) {
      const ms      = allMetrics.filter((m) => m.studentId === s.id);
      const overall = ms.length > 0 ? Math.round(ms.reduce((a, m) => a + m.readinessScore, 0) / ms.length) : 0;
      studentOverallAvg.set(s.id, overall);
      const bySubj = new Map<string, number>();
      for (const m of ms) bySubj.set(m.subject, m.readinessScore);
      studentSubjAvg.set(s.id, bySubj);
    }
    setStudentAvgMap(studentOverallAvg);

    // Group students by school for O(1) lookup in school stats + heatmap
    const studentsBySchool = new Map<string, Student[]>();
    for (const s of studsList) {
      if (!studentsBySchool.has(s.schoolId)) studentsBySchool.set(s.schoolId, []);
      studentsBySchool.get(s.schoolId)!.push(s);
    }

    // Hotspot counts per student
    const allHotspots  = hotspotStore.getAll().filter((h) => !h.resolvedAt && studIdSet.has(h.studentId));
    const hsPerStudent = new Map<string, number>();
    for (const h of allHotspots) hsPerStudent.set(h.studentId, (hsPerStudent.get(h.studentId) ?? 0) + 1);
    setStudentHsMap(hsPerStudent);

    // District KPIs
    const avgs = studsList.map((s) => studentOverallAvg.get(s.id) ?? 0);
    setDistrictAvg(avgs.length > 0 ? Math.round(avgs.reduce((a, b) => a + b, 0) / avgs.length) : 0);
    setTotalHs(allHotspots.length);
    setGreenCnt(avgs.filter((a) => a >= SCORE_GREEN).length);
    setRedCnt(avgs.filter((a) => a < SCORE_YELLOW).length);

    // School-level stats (unsorted — sort happens in render body)
    setSchoolStatsList(schoolsList.map((school) => {
      const studs      = studentsBySchool.get(school.id) ?? [];
      const schoolAvg  = studs.length > 0 ? Math.round(studs.map((s) => studentOverallAvg.get(s.id) ?? 0).reduce((a, b) => a + b, 0) / studs.length) : 0;
      const hs         = studs.reduce((a, s) => a + (hsPerStudent.get(s.id) ?? 0), 0);
      const teachers   = userStore.getTeachers(school.id);
      const compliance = teachers.length > 0
        ? Math.round(teachers.reduce((a, t) => a + getTeacherComplianceThisWeek(t.id).rate, 0) / teachers.length)
        : 0;
      return { school, studs, avg: schoolAvg, hs, compliance };
    }));

    // Subject × school heatmap
    setHeatmapData(CORE_SUBJECTS.map((subject) => ({
      subject,
      schools: schoolsList.map((sc) => {
        const sStuds = studentsBySchool.get(sc.id) ?? [];
        const avg    = sStuds.length > 0
          ? Math.round(sStuds.map((s) => studentSubjAvg.get(s.id)?.get(subject) ?? 0).reduce((a, b) => a + b, 0) / sStuds.length)
          : 0;
        return { school: sc, avg };
      }),
    })));

    // Trend data
    setDistrictTrend(getDistrictTrend(viewDistrictId));
    const trendsMap = new Map<string, ReturnType<typeof getSchoolTrend>>();
    for (const sc of schoolsList) trendsMap.set(sc.id, getSchoolTrend(sc.id));
    setSchoolTrends(trendsMap);

    if (user.role === Role.DISTRICT) generateAlerts(user);
  }, [user, isLoading, router, viewDistrictId, paramId]);

  // Sort precomputed school stats in render body (cheap — no store reads)
  const schoolStats = [...schoolStatsList].sort((a, b) => {
    if (sortSchool === 'name')     return a.school.name.localeCompare(b.school.name);
    if (sortSchool === 'hotspots') return b.hs - a.hs;
    return a.avg - b.avg;
  });

  // Filter/sort uses precomputed Maps — no store reads
  const filteredStudents = allStudents
    .filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase()))
    .filter((s) => {
      if (filterStatus === 'all') return true;
      return getColorStatus(studentAvgMap.get(s.id) ?? 0) === filterStatus;
    })
    .sort((a, b) => (studentAvgMap.get(a.id) ?? 0) - (studentAvgMap.get(b.id) ?? 0))
    .slice(0, 40);

  if (isLoading) return null;

  return (
    <div className="min-h-screen" style={{ background: '#F5F7FA' }}>
      <Navbar />

      <main className="max-w-4xl lg:max-w-6xl mx-auto px-4 md:px-6 py-5 md:py-8 pb-10">
        {/* Header */}
        <div className="mb-5">
          {paramId && (
            <button onClick={() => router.back()} className="text-sm font-medium mb-2 block" style={{ color: '#0033A0' }}>
              ← Ministry Overview
            </button>
          )}
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
          <KPICard value={`${districtAvg}%`}  label="District Avg" color={scoreColor(districtAvg)} />
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-x-8 items-start">
            {schoolStats.map(({ school, studs, avg, hs, compliance }, rank) => {
              const color = scoreColor(avg);
              return (
                <button
                  key={school.id}
                  onClick={() => router.push(`/school?id=${school.id}`)}
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
                {heatmapData.map(({ subject, schools: schoolData }, ri) => (
                  <tr key={subject} style={{ background: ri % 2 === 0 ? 'white' : '#F9FAFB' }}>
                    <td className="px-3 py-2 text-xs font-semibold" style={{ color: '#374151', whiteSpace: 'nowrap' }}>
                      {subject}
                    </td>
                    {schoolData.map(({ school, avg }) => {
                      const bg  = avg >= SCORE_GREEN ? '#DCFCE7' : avg >= SCORE_YELLOW ? '#FEF9C3' : avg > 0 ? '#FEE2E2' : '#F3F4F6';
                      const col = avg >= SCORE_GREEN ? '#008751' : avg >= SCORE_YELLOW ? '#854D0E' : avg > 0 ? '#E30613' : '#9CA3AF';
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

        {/* District trend */}
        {viewDistrictId && (
          <div className="rounded-2xl p-4 mb-5" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
            <h2 className="font-bold text-sm mb-1" style={{ color: '#0033A0' }}>District Performance Trend (8 weeks)</h2>
            <p className="text-xs mb-3" style={{ color: '#9CA3AF' }}>Weekly average class score across all schools</p>
            <TrendChart data={districtTrend} height={72} />

            {/* Per-school mini trends */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              {schools.slice(0, 4).map((sc) => {
                const tData = schoolTrends.get(sc.id) ?? [];
                const latest = tData.filter((p) => p.score > 0).slice(-1)[0]?.score ?? 0;
                return (
                  <div key={sc.id}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold truncate" style={{ color: '#374151', maxWidth: '80%' }}>
                        {sc.name.split(',')[0]}
                      </p>
                      <span className="text-xs font-black shrink-0" style={{ color: scoreColor(latest) }}>
                        {latest > 0 ? `${latest}%` : '—'}
                      </span>
                    </div>
                    <TrendChart data={tData} height={36} showLabels={false} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Student drill-down */}
        <div className="rounded-2xl p-4" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
          <h2 className="font-bold text-sm mb-3" style={{ color: '#0033A0' }}>
            Students ({filteredStudents.length} showing)
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
              const avg = studentAvgMap.get(s.id) ?? 0;
              const sc  = schools.find((x) => x.id === s.schoolId);
              const cls = classStore.getById(s.classId);
              const col = scoreColor(avg);
              const hs  = studentHsMap.get(s.id) ?? 0;
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

export default function DistrictDashboard() {
  return (
    <Suspense fallback={null}>
      <DistrictContent />
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
