'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Role, CORE_SUBJECTS } from '@/lib/types';
import type { School, District } from '@/lib/types';
import {
  schoolStore, studentStore, metricsStore, hotspotStore,
  districtStore, userStore, classStore,
} from '@/lib/storage';
import {
  getSchoolReadinessAvg, getTeacherComplianceThisWeek,
  getSchoolSubjectCoverage, scoreColor, SCORE_GREEN, SCORE_YELLOW,
} from '@/lib/calculations';
import Navbar from '@/components/Navbar';

// ── types ─────────────────────────────────────────────────────────────────────

type ReportType = 'school_perf' | 'at_risk' | 'compliance' | 'coverage';

interface ReportDef {
  id:    ReportType;
  label: string;
  desc:  string;
  icon:  string;
}

const REPORT_DEFS: ReportDef[] = [
  { id: 'school_perf', icon: '🏫', label: 'School Performance',  desc: 'Readiness averages, hotspot counts, student status breakdown'     },
  { id: 'at_risk',     icon: '⚠️',  label: 'At-Risk Students',    desc: 'Students below 40% readiness with per-subject scores'             },
  { id: 'compliance',  icon: '📋', label: 'Teacher Compliance',   desc: 'Diary submission rates for each teacher this week'                },
  { id: 'coverage',    icon: '📚', label: 'Curriculum Coverage',  desc: 'Topics covered vs total by subject and school'                    },
];

// ── csv helpers ───────────────────────────────────────────────────────────────

function escape(v: string | number): string {
  return `"${String(v).replace(/"/g, '""')}"`;
}

function toCSV(headers: string[], rows: (string | number)[][]): string {
  return [[...headers], ...rows].map((row) => row.map(escape).join(',')).join('\n');
}

function downloadCSV(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── report builders ───────────────────────────────────────────────────────────

function buildSchoolPerf(schools: School[]): { headers: string[]; rows: (string | number)[][] } {
  const headers = [
    'School', 'District', 'Readiness Avg (%)',
    'Green (≥70%)', 'Yellow (40–69%)', 'Red (<40%)',
    'Active Hotspots', 'Teacher Compliance Avg (%)',
  ];
  const rows = schools.map((sc) => {
    const studs      = studentStore.getBySchool(sc.id);
    const avg        = getSchoolReadinessAvg(sc.id);
    const teachers   = userStore.getTeachers(sc.id);
    const compliance = teachers.length > 0
      ? Math.round(teachers.reduce((a, t) => a + getTeacherComplianceThisWeek(t.id).rate, 0) / teachers.length)
      : 0;
    const green  = studs.filter((s) => avgScore(s.id) >= SCORE_GREEN).length;
    const yellow = studs.filter((s) => { const a = avgScore(s.id); return a >= SCORE_YELLOW && a < SCORE_GREEN; }).length;
    const red    = studs.filter((s) => avgScore(s.id) < SCORE_YELLOW && avgScore(s.id) > 0).length;
    const hs     = hotspotStore.getBySchool(sc.id).filter((h) => !h.resolvedAt).length;
    const dist   = districtStore.getById(sc.districtId ?? '')?.name ?? '';
    return [sc.name, dist, avg, green, yellow, red, hs, compliance];
  });
  return { headers, rows };
}

function buildAtRisk(schools: School[]): { headers: string[]; rows: (string | number)[][] } {
  const headers = ['Student', 'School', 'Class', 'Overall Avg (%)', ...CORE_SUBJECTS];
  const rows: (string | number)[][] = [];
  for (const sc of schools) {
    for (const s of studentStore.getBySchool(sc.id)) {
      const overall = avgScore(s.id);
      if (overall === 0 || overall >= SCORE_YELLOW) continue;
      const cls     = classStore.getById(s.classId);
      const metrics = metricsStore.getByStudent(s.id);
      const subjectScores = CORE_SUBJECTS.map((subj) => {
        const m = metrics.find((x) => x.subject === subj);
        return m ? Math.round(m.readinessScore) : '—';
      });
      rows.push([s.name, sc.name, `${cls?.level ?? ''}${cls?.section ?? ''}`, overall, ...subjectScores]);
    }
  }
  return { headers, rows };
}

function buildCompliance(schools: School[]): { headers: string[]; rows: (string | number)[][] } {
  const headers = ['Teacher', 'School', 'Submitted (week)', 'Required (week)', 'Rate (%)'];
  const rows: (string | number)[][] = [];
  for (const sc of schools) {
    for (const t of userStore.getTeachers(sc.id)) {
      const c = getTeacherComplianceThisWeek(t.id);
      rows.push([t.name, sc.name, c.submitted, c.required, c.rate]);
    }
  }
  rows.sort((a, b) => Number(a[4]) - Number(b[4])); // lowest compliance first
  return { headers, rows };
}

function buildCoverage(schools: School[]): { headers: string[]; rows: (string | number)[][] } {
  const headers = ['School', 'Subject', 'Covered Topics', 'Total Topics', 'Coverage (%)'];
  const rows: (string | number)[][] = [];
  for (const sc of schools) {
    for (const cov of getSchoolSubjectCoverage(sc.id)) {
      if (cov.totalTopics === 0) continue;
      rows.push([sc.name, cov.subject, cov.coveredTopics, cov.totalTopics, cov.coveragePercent]);
    }
  }
  return { headers, rows };
}

function avgScore(studentId: string): number {
  const ms = metricsStore.getByStudent(studentId);
  if (ms.length === 0) return 0;
  return Math.round(ms.reduce((a, m) => a + m.readinessScore, 0) / ms.length);
}

// ── component ─────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [districts,      setDistricts]      = useState<District[]>([]);
  const [allSchools,     setAllSchools]      = useState<School[]>([]);
  const [selectedDist,   setSelectedDist]    = useState<string>('all');
  const [reportType,     setReportType]      = useState<ReportType>('school_perf');
  const [generated,      setGenerated]       = useState(false);
  const [exportedAt,     setExportedAt]      = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.role !== Role.DISTRICT && user.role !== Role.MINISTRY) {
      router.replace('/dashboard'); return;
    }

    const dists = districtStore.getAll();
    setDistricts(dists);
    setAllSchools(schoolStore.getAll());

    if (user.role === Role.DISTRICT) {
      setSelectedDist(user.districtId ?? 'all');
    }
  }, [user, isLoading, router]);

  const scopeSchools = useMemo(() => {
    if (selectedDist === 'all') return allSchools;
    return allSchools.filter((sc) => sc.districtId === selectedDist);
  }, [allSchools, selectedDist]);

  const reportData = useMemo(() => {
    if (!generated) return null;
    switch (reportType) {
      case 'school_perf': return buildSchoolPerf(scopeSchools);
      case 'at_risk':     return buildAtRisk(scopeSchools);
      case 'compliance':  return buildCompliance(scopeSchools);
      case 'coverage':    return buildCoverage(scopeSchools);
    }
  }, [generated, reportType, scopeSchools]);

  function handleGenerate() {
    setGenerated(true);
    setExportedAt(null);
  }

  function handleExport() {
    if (!reportData) return;
    const def      = REPORT_DEFS.find((r) => r.id === reportType)!;
    const distName = selectedDist === 'all'
      ? 'StateWide'
      : (districts.find((d) => d.id === selectedDist)?.name ?? selectedDist).replace(/\s+/g, '_');
    const filename = `EkoExcel_${def.label.replace(/\s+/g, '_')}_${distName}_${today}.csv`;
    downloadCSV(filename, toCSV(reportData.headers, reportData.rows));
    setExportedAt(new Date().toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' }));
  }

  if (isLoading || !user) return null;

  const isMinistry   = user.role === Role.MINISTRY;
  const selectedDef  = REPORT_DEFS.find((r) => r.id === reportType)!;

  return (
    <div className="min-h-screen" style={{ background: '#F5F7FA' }}>
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-5 pb-10">

        {/* Header */}
        <div className="mb-5">
          <span className="text-xs font-bold px-2 py-0.5 rounded-full mb-1 inline-block"
            style={{ background: '#EFF6FF', color: '#0033A0' }}>
            {isMinistry ? 'Ministry' : 'District'} — Reports &amp; Export
          </span>
          <h1 className="text-xl font-black" style={{ color: '#0033A0' }}>Reports</h1>
          <p className="text-sm" style={{ color: '#6B7280' }}>
            Generate and download CSV snapshots for offline review or sharing
          </p>
        </div>

        {/* Config card */}
        <div className="rounded-2xl p-5 mb-5" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
          <h2 className="font-bold text-sm mb-4" style={{ color: '#0033A0' }}>1. Configure Report</h2>

          {/* Report type selector */}
          <p className="text-xs font-semibold mb-2" style={{ color: '#374151' }}>Report Type</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {REPORT_DEFS.map((def) => (
              <button
                key={def.id}
                onClick={() => { setReportType(def.id); setGenerated(false); }}
                className="text-left p-3 rounded-xl text-xs transition-all"
                style={{
                  border:     reportType === def.id ? '2px solid #0033A0' : '1.5px solid #E5E7EB',
                  background: reportType === def.id ? '#EFF6FF' : 'white',
                  color:      '#111827',
                }}
              >
                <div className="font-bold mb-0.5">{def.icon} {def.label}</div>
                <div style={{ color: '#6B7280', fontSize: '0.65rem' }}>{def.desc}</div>
              </button>
            ))}
          </div>

          {/* Scope selector (ministry only) */}
          {isMinistry && (
            <>
              <p className="text-xs font-semibold mb-2" style={{ color: '#374151' }}>Scope</p>
              <select
                className="w-full rounded-xl px-3 py-2 text-sm mb-4"
                style={{ border: '1.5px solid #E5E7EB', color: '#374151' }}
                value={selectedDist}
                onChange={(e) => { setSelectedDist(e.target.value); setGenerated(false); }}
              >
                <option value="all">All Districts (State-Wide)</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </>
          )}

          {/* Summary of scope */}
          <div className="flex items-center justify-between text-xs rounded-lg px-3 py-2 mb-4"
            style={{ background: '#F9FAFB', color: '#6B7280', border: '1px solid #E5E7EB' }}>
            <span>
              {scopeSchools.length} school{scopeSchools.length !== 1 ? 's' : ''} in scope
              &nbsp;·&nbsp;
              {scopeSchools.reduce((a, sc) => a + studentStore.getBySchool(sc.id).length, 0)} students
              &nbsp;·&nbsp;
              {scopeSchools.reduce((a, sc) => a + userStore.getTeachers(sc.id).length, 0)} teachers
            </span>
            <span style={{ color: '#9CA3AF' }}>{today}</span>
          </div>

          <button
            onClick={handleGenerate}
            className="btn-primary w-full"
          >
            Generate Preview →
          </button>
        </div>

        {/* Preview + export */}
        {generated && reportData && (
          <div className="rounded-2xl overflow-hidden mb-5" style={{ border: '1.5px solid #E5E7EB' }}>
            {/* Preview header */}
            <div className="flex items-center justify-between px-4 py-3"
              style={{ background: '#0033A0', color: 'white' }}>
              <div>
                <p className="font-bold text-sm">{selectedDef.icon} {selectedDef.label}</p>
                <p style={{ color: '#A8C4F0', fontSize: '0.65rem' }}>
                  {reportData.rows.length} row{reportData.rows.length !== 1 ? 's' : ''}
                  &nbsp;·&nbsp;
                  {selectedDist === 'all' ? 'State-Wide' : districts.find((d) => d.id === selectedDist)?.name}
                  &nbsp;·&nbsp;{today}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {exportedAt && (
                  <span style={{ color: '#A8C4F0', fontSize: '0.65rem' }}>
                    Exported {exportedAt}
                  </span>
                )}
                <button
                  onClick={handleExport}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg"
                  style={{ background: '#FFCC00', color: '#0033A0' }}
                >
                  ↓ Download CSV
                </button>
              </div>
            </div>

            {/* Table */}
            {reportData.rows.length === 0 ? (
              <div className="px-4 py-8 text-center" style={{ background: 'white' }}>
                <p className="text-sm font-semibold" style={{ color: '#9CA3AF' }}>No data matches this report</p>
                <p className="text-xs mt-1" style={{ color: '#D1D5DB' }}>
                  {reportType === 'at_risk'
                    ? 'No students below 40% readiness in this scope — good news!'
                    : 'Check that seed data is loaded and schools are in scope.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto" style={{ maxHeight: 480 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', fontSize: '0.75rem' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                    <tr style={{ background: '#F3F4F6' }}>
                      {reportData.headers.map((h) => (
                        <th key={h} className="text-left px-3 py-2 font-semibold whitespace-nowrap"
                          style={{ color: '#374151', borderBottom: '1.5px solid #E5E7EB' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.rows.slice(0, 150).map((row, ri) => (
                      <tr key={ri} style={{ borderBottom: '1px solid #F3F4F6' }}>
                        {row.map((cell, ci) => {
                          // Colour numeric % columns for certain reports
                          const header  = reportData.headers[ci] ?? '';
                          const isScore = (header.includes('%') || header.includes('Avg')) && typeof cell === 'number';
                          const color   = isScore ? scoreColor(cell as number) : '#374151';
                          return (
                            <td key={ci} className="px-3 py-2 whitespace-nowrap"
                              style={{ color, fontWeight: isScore ? 700 : 400 }}>
                              {cell}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {reportData.rows.length > 150 && (
                  <p className="px-4 py-2 text-xs text-center" style={{ color: '#9CA3AF', background: '#F9FAFB' }}>
                    Showing first 150 of {reportData.rows.length} rows — download CSV for full data
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* About section */}
        <div className="rounded-2xl p-4" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
          <h2 className="font-bold text-sm mb-3" style={{ color: '#0033A0' }}>About These Reports</h2>
          <div className="flex flex-col gap-2">
            {REPORT_DEFS.map((def) => (
              <div key={def.id} className="flex items-start gap-2 text-xs">
                <span className="shrink-0 mt-0.5">{def.icon}</span>
                <div>
                  <span className="font-semibold" style={{ color: '#111827' }}>{def.label}</span>
                  <span style={{ color: '#6B7280' }}> — {def.desc}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs mt-3 pt-3" style={{ color: '#9CA3AF', borderTop: '1px solid #F3F4F6' }}>
            All data is sourced from local storage on this device. Reports reflect the current state at time of generation.
            CSV files can be opened in Microsoft Excel, Google Sheets, or any spreadsheet application.
          </p>
        </div>
      </main>
    </div>
  );
}
