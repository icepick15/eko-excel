'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Role, ColorStatus, WAEC_SUBJECTS } from '@/lib/types';
import type { School, Student } from '@/lib/types';
import { schoolStore, studentStore, metricsStore, hotspotStore, districtStore } from '@/lib/storage';
import { recomputeStudent } from '@/lib/calculations';
import Navbar from '@/components/Navbar';

export default function DistrictDashboard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [schools, setSchools] = useState<School[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [districtName, setDistrictName] = useState('');
  const [computed, setComputed] = useState(false);
  const [search, setSearch] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'green' | 'yellow' | 'red'>('all');
  const [selectedSchool, setSelectedSchool] = useState('');

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.role !== Role.DISTRICT) { router.replace('/dashboard'); return; }

    const district = districtStore.getById(user.districtId!);
    setDistrictName(district?.name ?? 'District');

    const mySchools = schoolStore.getByDistrict(user.districtId!);
    setSchools(mySchools);

    const students = studentStore.getByDistrict(user.districtId!);
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

  function schoolAvg(schoolId: string): number {
    const students = studentStore.getBySchool(schoolId);
    if (students.length === 0) return 0;
    return students.reduce((a, s) => a + getAvg(s.id), 0) / students.length;
  }

  const filteredStudents = allStudents
    .filter((s) => !selectedSchool || s.schoolId === selectedSchool)
    .filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase()))
    .filter((s) => filterStatus === 'all' || getStatus(s.id) === filterStatus)
    .sort((a, b) => {
      const aScore = filterSubject ? getAvg(a.id, filterSubject) : getAvg(a.id);
      const bScore = filterSubject ? getAvg(b.id, filterSubject) : getAvg(b.id);
      return aScore - bScore; // ascending: worst first
    });

  const totalHotspots = allStudents.reduce((acc, s) => acc + hotspotStore.getByStudent(s.id).length, 0);
  const greenCount = allStudents.filter((s) => getStatus(s.id) === ColorStatus.GREEN).length;
  const redCount = allStudents.filter((s) => getStatus(s.id) === ColorStatus.RED).length;

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="text-xs px-2 py-1 rounded font-medium" style={{ background: 'var(--lagos-blue-light)', color: 'var(--lagos-blue)' }}>
              District View
            </div>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--lagos-blue)' }}>{districtName}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {schools.length} Schools &nbsp;·&nbsp; {allStudents.length} Students
          </p>
        </div>

        {/* District-wide summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="card text-center">
            <div className="text-2xl font-black mb-1" style={{ color: 'var(--lagos-blue)' }}>{allStudents.length}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Total Students</div>
          </div>
          <div className="card text-center">
            <div className="text-2xl font-black mb-1" style={{ color: 'var(--lagos-green)' }}>{greenCount}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>On Track (≥75%)</div>
          </div>
          <div className="card text-center">
            <div className="text-2xl font-black mb-1" style={{ color: 'var(--lagos-red)' }}>{redCount}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>At Risk (&lt;55%)</div>
          </div>
          <div className="card text-center">
            <div className="text-2xl font-black mb-1" style={{ color: 'var(--lagos-gold)' }}>{totalHotspots}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Active Alerts</div>
          </div>
        </div>

        {/* School performance summary */}
        <div className="card mb-6">
          <h2 className="font-bold text-sm mb-4" style={{ color: 'var(--lagos-blue)' }}>School Performance</h2>
          <div className="flex flex-col gap-3">
            {schools.map((school) => {
              const avg = schoolAvg(school.id);
              const schoolStudents = studentStore.getBySchool(school.id);
              const schoolHotspots = hotspotStore.getBySchool(school.id);
              const status = avg >= 75 ? ColorStatus.GREEN : avg >= 55 ? ColorStatus.YELLOW : ColorStatus.RED;
              const barColor = status === ColorStatus.GREEN ? 'var(--lagos-green)' : status === ColorStatus.YELLOW ? 'var(--lagos-gold)' : 'var(--lagos-red)';
              return (
                <div key={school.id} className="flex items-center gap-4 p-3 rounded-xl cursor-pointer hover:opacity-80"
                  style={{ background: 'var(--background)' }}
                  onClick={() => setSelectedSchool(selectedSchool === school.id ? '' : school.id)}>
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0"
                    style={{ background: 'var(--lagos-blue-light)', color: 'var(--lagos-blue)' }}
                  >
                    {school.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{school.name}</div>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="progress-bar flex-1" style={{ height: '6px' }}>
                        <div className="progress-bar-fill" style={{ width: `${avg}%`, background: barColor, height: '6px' }} />
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-black text-sm" style={{ color: barColor }}>{avg.toFixed(0)}%</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{schoolStudents.length} students</div>
                    {schoolHotspots.length > 0 && (
                      <div className="text-xs font-medium" style={{ color: 'var(--lagos-red)' }}>
                        {schoolHotspots.length} alerts
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Subject heatmap */}
        <div className="card mb-6">
          <h2 className="font-bold text-sm mb-4" style={{ color: 'var(--lagos-blue)' }}>Subject Readiness Heatmap</h2>
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--background)' }}>
                  <th className="text-left text-xs font-bold px-3 py-2" style={{ color: 'var(--text-muted)' }}>School</th>
                  {WAEC_SUBJECTS.map((s) => (
                    <th key={s} className="text-center text-xs font-bold px-2 py-2" style={{ color: 'var(--text-muted)' }}>{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {schools.map((school) => {
                  const schoolStudents = studentStore.getBySchool(school.id);
                  return (
                    <tr key={school.id}>
                      <td className="px-3 py-2 text-sm font-medium">{school.name.split(',')[0]}</td>
                      {WAEC_SUBJECTS.map((subject) => {
                        const avg = schoolStudents.length > 0
                          ? schoolStudents.reduce((a, s) => a + getAvg(s.id, subject), 0) / schoolStudents.length
                          : 0;
                        const bg = avg >= 75 ? '#D1FAE5' : avg >= 55 ? '#FEF9C3' : '#FEE2E2';
                        const color = avg >= 75 ? '#065F46' : avg >= 55 ? '#854D0E' : '#991B1B';
                        return (
                          <td key={subject} className="px-2 py-2 text-center">
                            <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: bg, color }}>
                              {avg.toFixed(0)}%
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Student search */}
        <div className="card mb-4">
          <h2 className="font-bold text-sm mb-3" style={{ color: 'var(--lagos-blue)' }}>
            Search Students ({filteredStudents.length} showing)
          </h2>
          <div className="flex flex-col sm:flex-row gap-3 mb-3">
            <input className="input flex-1" placeholder='Search by name (e.g. "low math students")...' value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="input sm:w-40" value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}>
              <option value="">All Subjects</option>
              {WAEC_SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="input sm:w-36" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as 'all' | 'green' | 'yellow' | 'red')}>
              <option value="all">All Status</option>
              <option value="green">On Track</option>
              <option value="yellow">Needs Help</option>
              <option value="red">At Risk</option>
            </select>
          </div>
          <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
            {filteredStudents.slice(0, 30).map((student) => {
              const avg = filterSubject ? getAvg(student.id, filterSubject) : getAvg(student.id);
              const status = getStatus(student.id);
              const school = schools.find((sc) => sc.id === student.schoolId);
              return (
                <div
                  key={student.id}
                  className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:opacity-80"
                  style={{ background: 'var(--background)' }}
                  onClick={() => router.push(`/students/${student.id}`)}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0"
                    style={{ background: 'var(--lagos-blue-light)', color: 'var(--lagos-blue)' }}
                  >
                    {student.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{student.name}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{school?.name?.split(',')[0]} · {student.class}</div>
                  </div>
                  <span
                    className="text-xs font-black px-2.5 py-1 rounded-full shrink-0"
                    style={{
                      background: status === ColorStatus.GREEN ? '#D1FAE5' : status === ColorStatus.YELLOW ? '#FEF9C3' : '#FEE2E2',
                      color: status === ColorStatus.GREEN ? '#065F46' : status === ColorStatus.YELLOW ? '#854D0E' : '#991B1B',
                    }}
                  >
                    {avg.toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
