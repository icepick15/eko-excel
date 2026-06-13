'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Role, CORE_SUBJECTS } from '@/lib/types';
import type { Student, Class, TeacherClassSubject } from '@/lib/types';
import { tcsStore, classStore, studentStore, metricsStore, diaryStore } from '@/lib/storage';
import { scoreColor, scoreBg, SCORE_GREEN, SCORE_YELLOW } from '@/lib/calculations';
import Navbar from '@/components/Navbar';

export default function BroadsheetPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [myTcs, setMyTcs]               = useState<TeacherClassSubject[]>([]);
  const [myClasses, setMyClasses]       = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [classStudents, setClassStudents]     = useState<Student[]>([]);

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.role !== Role.TEACHER) { router.replace('/dashboard'); return; }

    const tcs = tcsStore.getByTeacher(user.id);
    setMyTcs(tcs);

    const seen = new Set<string>();
    const classes: Class[] = [];
    for (const t of tcs) {
      if (!seen.has(t.classId)) {
        seen.add(t.classId);
        const cls = classStore.getById(t.classId);
        if (cls) classes.push(cls);
      }
    }
    setMyClasses(classes);
    if (classes.length > 0) setSelectedClassId(classes[0].id);
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!selectedClassId) return;
    setClassStudents(studentStore.getByClass(selectedClassId));
  }, [selectedClassId]);

  if (isLoading || !user) return null;

  const activeClass    = myClasses.find((c) => c.id === selectedClassId);
  const classSubjects  = myTcs
    .filter((t) => t.classId === selectedClassId)
    .map((t) => t.subject);

  // Diary class-level averages per subject (what the teacher actually taught/scored)
  const diaryAvg: Record<string, number> = {};
  if (selectedClassId) {
    for (const subj of classSubjects) {
      const entries = diaryStore.getByClass(selectedClassId).filter((d) => d.subject === subj);
      diaryAvg[subj] = entries.length > 0
        ? Math.round(entries.reduce((a, d) => a + d.classScore, 0) / entries.length)
        : 0;
    }
  }

  // Build per-student rows, sorted by overall average descending
  const rows = classStudents.map((student) => {
    const scores: Record<string, number | null> = {};
    for (const subj of classSubjects) {
      const m = metricsStore.getByStudentAndSubject(student.id, subj);
      scores[subj] = m ? m.readinessScore : null;
    }
    const valid = Object.values(scores).filter((s): s is number => s !== null);
    const average = valid.length > 0 ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null;
    return { student, scores, average };
  }).sort((a, b) => (b.average ?? -1) - (a.average ?? -1));

  // Class-average row (column footers)
  const subjectAvg: Record<string, number> = {};
  for (const subj of classSubjects) {
    const vals = rows.map((r) => r.scores[subj]).filter((s): s is number => s !== null);
    subjectAvg[subj] = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  }
  const overallAvg = Object.values(subjectAvg).length > 0
    ? Math.round(Object.values(subjectAvg).reduce((a, b) => a + b, 0) / Object.values(subjectAvg).length)
    : 0;

  return (
    <div className="min-h-screen" style={{ background: '#F5F7FA' }}>
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 md:px-6 py-5 md:py-8 pb-10">
        {/* Header */}
        <div className="mb-5">
          <button onClick={() => router.back()} className="text-sm font-medium mb-2" style={{ color: '#0033A0' }}>
            ← Back
          </button>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full inline-block mb-1"
            style={{ background: '#EFF6FF', color: '#0033A0' }}>
            Class Scores Record
          </span>
          <h1 className="text-xl font-black" style={{ color: '#0033A0' }}>Broadsheet</h1>
          <p className="text-sm" style={{ color: '#6B7280' }}>
            WAEC Readiness — {activeClass ? `${activeClass.level}${activeClass.section}` : ''}
            {activeClass ? ` · ${activeClass.academicYear}` : ''}
          </p>
        </div>

        {/* Class picker */}
        {myClasses.length > 1 && (
          <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
            {myClasses.map((cls) => (
              <button
                key={cls.id}
                onClick={() => setSelectedClassId(cls.id)}
                className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold"
                style={{
                  background: selectedClassId === cls.id ? '#0033A0' : '#E5E7EB',
                  color:      selectedClassId === cls.id ? 'white'    : '#374151',
                }}
              >
                {cls.level}{cls.section}
              </button>
            ))}
          </div>
        )}

        {/* Legend */}
        <div className="flex gap-3 mb-5 text-xs flex-wrap">
          {[
            { label: `≥${SCORE_GREEN}% On Track`,                   color: '#008751', bg: '#F0FDF4' },
            { label: `${SCORE_YELLOW}–${SCORE_GREEN - 1}% Watch`,   color: '#854D0E', bg: '#FFFBEB' },
            { label: `<${SCORE_YELLOW}% At Risk`,                    color: '#E30613', bg: '#FEF2F2' },
          ].map(({ label, color, bg }) => (
            <div key={label} className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: bg }}>
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
              <span style={{ color }}>{label}</span>
            </div>
          ))}
        </div>

        {classStudents.length === 0 ? (
          <div className="text-center py-16 rounded-2xl" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
            <p className="text-4xl mb-3">📊</p>
            <p className="font-semibold" style={{ color: '#374151' }}>No students in this class</p>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ border: '1.5px solid #E5E7EB' }}>
            <div className="overflow-x-auto">
              <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
                <thead>
                  {/* Subject headers */}
                  <tr style={{ background: '#0033A0', color: 'white' }}>
                    <th className="text-left text-xs font-bold px-3 py-3" style={{ minWidth: 160, position: 'sticky', left: 0, background: '#0033A0' }}>
                      Student
                    </th>
                    {classSubjects.map((subj) => (
                      <th key={subj} className="text-center text-xs font-bold px-2 py-3" style={{ minWidth: 80 }}>
                        {subj.split(' ')[0].slice(0, 6)}
                      </th>
                    ))}
                    <th className="text-center text-xs font-bold px-3 py-3" style={{ minWidth: 72 }}>Avg</th>
                  </tr>

                  {/* Diary class-average row */}
                  <tr style={{ background: 'rgba(0,51,160,0.06)', borderBottom: '1px solid #E5E7EB' }}>
                    <td className="px-3 py-1.5 text-xs font-semibold" style={{ position: 'sticky', left: 0, background: 'rgba(0,51,160,0.06)', color: '#6B7280' }}>
                      Class Diary Avg
                    </td>
                    {classSubjects.map((subj) => {
                      const avg = diaryAvg[subj] ?? 0;
                      return (
                        <td key={subj} className="px-2 py-1.5 text-center">
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: avg > 0 ? scoreBg(avg) : '#F3F4F6', color: avg > 0 ? scoreColor(avg) : '#9CA3AF' }}>
                            {avg > 0 ? `${avg}%` : '—'}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-3 py-1.5 text-center">
                      <span className="text-xs" style={{ color: '#9CA3AF' }}>—</span>
                    </td>
                  </tr>
                </thead>

                <tbody>
                  {rows.map(({ student, scores, average }, ri) => {
                    const rowBg = ri % 2 === 0 ? 'white' : '#F9FAFB';
                    return (
                      <tr
                        key={student.id}
                        onClick={() => router.push(`/students/${student.id}`)}
                        style={{ background: rowBg, cursor: 'pointer' }}
                      >
                        <td className="px-3 py-2.5" style={{ position: 'sticky', left: 0, background: rowBg }}>
                          <div>
                            <p className="text-xs font-semibold leading-none" style={{ color: '#111827' }}>{student.name}</p>
                            <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{student.gender === 'M' ? 'Male' : 'Female'}</p>
                          </div>
                        </td>
                        {classSubjects.map((subj) => {
                          const score = scores[subj];
                          return (
                            <td key={subj} className="px-2 py-2.5 text-center">
                              {score !== null ? (
                                <span className="text-xs font-black px-1.5 py-0.5 rounded-full"
                                  style={{ background: scoreBg(score), color: scoreColor(score) }}>
                                  {score.toFixed(0)}%
                                </span>
                              ) : (
                                <span className="text-xs" style={{ color: '#D1D5DB' }}>—</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2.5 text-center">
                          {average !== null ? (
                            <span className="text-xs font-black px-2 py-0.5 rounded-full"
                              style={{ background: scoreBg(average), color: scoreColor(average) }}>
                              {average}%
                            </span>
                          ) : (
                            <span className="text-xs" style={{ color: '#D1D5DB' }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Class average footer */}
                  <tr style={{ background: '#EEF2FF', borderTop: '2px solid #C7D2FE' }}>
                    <td className="px-3 py-2.5 text-xs font-black" style={{ position: 'sticky', left: 0, background: '#EEF2FF', color: '#0033A0' }}>
                      Class Average
                    </td>
                    {classSubjects.map((subj) => {
                      const avg = subjectAvg[subj] ?? 0;
                      return (
                        <td key={subj} className="px-2 py-2.5 text-center">
                          <span className="text-xs font-black px-1.5 py-0.5 rounded-full"
                            style={{ background: avg > 0 ? scoreBg(avg) : '#F3F4F6', color: avg > 0 ? scoreColor(avg) : '#9CA3AF' }}>
                            {avg > 0 ? `${avg}%` : '—'}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-xs font-black px-2 py-0.5 rounded-full"
                        style={{ background: overallAvg > 0 ? scoreBg(overallAvg) : '#F3F4F6', color: overallAvg > 0 ? scoreColor(overallAvg) : '#9CA3AF' }}>
                        {overallAvg > 0 ? `${overallAvg}%` : '—'}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="text-xs mt-3 text-center" style={{ color: '#9CA3AF' }}>
          WAEC Readiness from diary entries & quiz attempts · Tap a student for full profile
        </p>
      </main>
    </div>
  );
}
