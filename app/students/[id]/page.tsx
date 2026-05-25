'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  BEHAVIORAL_TRAIT_LABELS, BehavioralTrait, ColorStatus,
  CORE_SUBJECTS, ACADEMIC_DOMAINS,
} from '@/lib/types';
import type {
  Student, ReadinessMetric, BrainMapProfile, Hotspot,
  DiaryEntry, ReadinessSnapshot, CareerRecommendation, Class,
} from '@/lib/types';
import {
  studentStore, metricsStore, brainMapStore, hotspotStore,
  diaryStore, classStore, snapshotStore, careerStore,
  messageStore, interventionStore,
} from '@/lib/storage';
import { recomputeStudent, scoreColor, SCORE_GREEN, SCORE_YELLOW } from '@/lib/calculations';
import Navbar from '@/components/Navbar';

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

const DOMAIN_FIELDS = [
  { key: 'logicalAnalytical',  label: 'Logical-Analytical' },
  { key: 'spatialMechanical',  label: 'Spatial-Mechanical' },
  { key: 'verbalCreative',     label: 'Verbal-Creative'    },
  { key: 'appliedPractical',   label: 'Applied-Practical'  },
  { key: 'consistency',        label: 'Consistency'        },
] as const;

const SEVERITY_STYLES = {
  critical: { bg: '#FEE2E2', color: '#E30613', border: '#FECACA' },
  high:     { bg: '#FFF7ED', color: '#EA580C', border: '#FDBA74' },
  medium:   { bg: '#FEF9C3', color: '#854D0E', border: '#FDE047' },
};
const TREND_ICON: Record<string, string>  = { up: '↑', down: '↓', stable: '→' };
const TREND_COLOR: Record<string, string> = { up: '#008751', down: '#E30613', stable: '#6B7280' };

type Tab = 'overview' | 'brainmap' | 'trends' | 'career';

export default function StudentProfilePage() {
  const { user, isLoading } = useAuth();
  const router  = useRouter();
  const params  = useParams();
  const studentId = params.id as string;

  const [student,   setStudent]   = useState<Student | null>(null);
  const [cls,       setCls]       = useState<Class | null>(null);
  const [metrics,   setMetrics]   = useState<ReadinessMetric[]>([]);
  const [brainMap,  setBrainMap]  = useState<BrainMapProfile | null>(null);
  const [hotspots,  setHotspots]  = useState<Hotspot[]>([]);
  const [diaries,   setDiaries]   = useState<DiaryEntry[]>([]);
  const [snapshots, setSnapshots] = useState<ReadinessSnapshot[]>([]);
  const [career,    setCareer]    = useState<CareerRecommendation | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showIntervention, setShowIntervention] = useState(false);
  const [intDesc, setIntDesc]     = useState('');

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }

    const s = studentStore.getById(studentId);
    if (!s) { router.replace('/dashboard'); return; }
    setStudent(s);

    const c = classStore.getById(s.classId);
    setCls(c ?? null);

    recomputeStudent(studentId);

    setMetrics(metricsStore.getByStudent(studentId));
    setBrainMap(brainMapStore.getByStudent(studentId) ?? null);
    setHotspots(hotspotStore.getByStudent(studentId));
    setDiaries(s.classId ? diaryStore.getByClass(s.classId).slice(0, 20) : []);
    setSnapshots(snapshotStore.getByStudent(studentId));
    setCareer(careerStore.getByStudent(studentId) ?? null);
  }, [user, isLoading, studentId, router]);

  if (!student) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0033A0' }}>
        <p className="text-white font-bold animate-pulse">Loading...</p>
      </div>
    );
  }

  const avgReadiness = metrics.length > 0
    ? Math.round(metrics.reduce((a, m) => a + m.readinessScore, 0) / metrics.length)
    : 0;
  const overallColor = scoreColor(avgReadiness);

  function handleLogIntervention() {
    if (!intDesc.trim() || !user) return;
    interventionStore.save({
      id: uid(),
      studentId: student!.id,
      schoolId: student!.schoolId,
      assignedBy: user.id,
      assignedTo: user.id,
      description: intDesc.trim(),
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      status: 'open',
      createdAt: new Date().toISOString(),
    });
    setIntDesc('');
    setShowIntervention(false);
    alert('Intervention logged!');
  }

  const TAB_LABELS: Record<Tab, string> = {
    overview: 'WAEC',
    brainmap: 'Brain Map',
    trends:   'Trends',
    career:   'Career',
  };

  return (
    <div className="min-h-screen" style={{ background: '#F5F7FA' }}>
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 py-5 pb-10">
        {/* Back */}
        <button onClick={() => router.back()} className="text-sm font-medium mb-4" style={{ color: '#0033A0' }}>
          ← Back
        </button>

        {/* Student header card */}
        <div className="rounded-2xl p-5 mb-4 flex items-start gap-4" style={{ background: '#0033A0', color: 'white' }}>
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black shrink-0"
            style={{ background: 'rgba(255,255,255,0.2)' }}
          >
            {student.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-black leading-tight">{student.name}</h1>
            <p className="text-xs opacity-70 mt-0.5">
              {cls?.level}{cls?.section} · {student.gender === 'M' ? 'Male' : 'Female'}
              {student.parentPhone && <> · Parent: {student.parentPhone}</>}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span
                className="text-sm font-black px-2 py-0.5 rounded-full"
                style={{ background: overallColor, color: 'white' }}
              >
                {avgReadiness}%
              </span>
              <span className="text-xs opacity-60">avg readiness</span>
              {hotspots.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: '#FEE2E2', color: '#E30613' }}>
                  {hotspots.length} hotspot{hotspots.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mb-4">
          {student.parentPhone && (
            <a
              href={`tel:${student.parentPhone}`}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold text-center"
              style={{ background: '#EFF6FF', color: '#0033A0', border: '1.5px solid #BFDBFE' }}
            >
              📞 Call Parent
            </a>
          )}
          <button
            onClick={() => setShowIntervention(true)}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold"
            style={{ background: '#FFF7ED', color: '#EA580C', border: '1.5px solid #FDBA74' }}
          >
            📝 Log Intervention
          </button>
          <button
            onClick={() => router.push(`/hotspots`)}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold"
            style={{ background: hotspots.length > 0 ? '#FEE2E2' : '#F0FDF4', color: hotspots.length > 0 ? '#E30613' : '#008751', border: `1.5px solid ${hotspots.length > 0 ? '#FECACA' : '#86EFAC'}` }}
          >
            🔥 {hotspots.length} Hotspot{hotspots.length !== 1 ? 's' : ''}
          </button>
        </div>

        {/* Intervention modal */}
        {showIntervention && (
          <div
            className="fixed inset-0 z-50 flex items-end"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            onClick={() => setShowIntervention(false)}
          >
            <div
              className="w-full rounded-t-3xl p-6 pb-8"
              style={{ background: 'white' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-black text-base mb-1" style={{ color: '#111827' }}>Log Intervention</h3>
              <p className="text-xs mb-4" style={{ color: '#6B7280' }}>For {student.name} — {cls?.level}{cls?.section}</p>
              <textarea
                className="w-full rounded-xl p-3 text-sm resize-none mb-4"
                style={{ border: '1.5px solid #D1D5DB', background: '#F9FAFB', minHeight: 100 }}
                placeholder="Describe the intervention (e.g. extra practice on quadratic equations, individual tutoring session...)"
                value={intDesc}
                onChange={(e) => setIntDesc(e.target.value)}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowIntervention(false)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold"
                  style={{ background: '#F3F4F6', color: '#374151' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogIntervention}
                  disabled={!intDesc.trim()}
                  className="flex-1 py-3 rounded-xl text-sm font-bold text-white"
                  style={{ background: intDesc.trim() ? '#0033A0' : '#9CA3AF' }}
                >
                  Log Intervention
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Active hotspot alerts */}
        {hotspots.length > 0 && (
          <div className="flex flex-col gap-2 mb-4">
            {hotspots.map((h) => {
              const sev = SEVERITY_STYLES[h.severity];
              return (
                <div
                  key={h.id}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: sev.bg, border: `1.5px solid ${sev.border}` }}
                >
                  <span className="font-black text-sm" style={{ color: sev.color }}>
                    {h.severity === 'critical' ? '🔴' : h.severity === 'high' ? '🟠' : '🟡'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold" style={{ color: sev.color }}>
                      {h.subject} — {(h.readinessScore ?? 0).toFixed(0)}%{' '}
                      <span style={{ color: TREND_COLOR[h.trend] }}>{TREND_ICON[h.trend]}</span>
                    </p>
                    <p className="text-xs" style={{ color: sev.color, opacity: 0.8 }}>{h.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tabs */}
        <div
          className="flex gap-1 p-1 rounded-xl mb-4"
          style={{ background: '#E5E7EB' }}
        >
          {(Object.keys(TAB_LABELS) as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
              style={{
                background: activeTab === tab ? 'white' : 'transparent',
                color: activeTab === tab ? '#0033A0' : '#6B7280',
                boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {/* ── WAEC Readiness Tab ──────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="flex flex-col gap-3">
            {CORE_SUBJECTS.map((subject) => {
              const metric = metrics.find((m) => m.subject === subject);
              const score = metric?.readinessScore ?? 0;
              const color = scoreColor(score);
              return (
                <div
                  key={subject}
                  className="rounded-2xl p-4"
                  style={{ background: 'white', border: '1.5px solid #E5E7EB' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-sm" style={{ color: '#111827' }}>{subject}</p>
                    <p className="font-black text-lg" style={{ color }}>{score.toFixed(0)}%</p>
                  </div>
                  <div className="h-2.5 rounded-full overflow-hidden" style={{ background: '#F3F4F6' }}>
                    <div
                      className="h-2.5 rounded-full transition-all"
                      style={{ width: `${score}%`, background: color }}
                    />
                  </div>
                  <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>
                    {score >= SCORE_GREEN ? 'On track for WAEC' : score >= SCORE_YELLOW ? 'Needs improvement' : 'At risk — below threshold'}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Brain Map Tab ────────────────────────────────────────────── */}
        {activeTab === 'brainmap' && (
          <div>
            {brainMap ? (
              <div className="flex flex-col gap-4">
                {/* Domain bars */}
                <div className="rounded-2xl p-5" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
                  <h3 className="font-bold text-sm mb-4" style={{ color: '#0033A0' }}>
                    Academic + Behavioural Domains
                    {brainMap.weeksOfData < 3 && (
                      <span className="ml-2 text-xs font-normal" style={{ color: '#9CA3AF' }}>
                        ({brainMap.weeksOfData} weeks — limited data)
                      </span>
                    )}
                  </h3>
                  <div className="flex flex-col gap-4">
                    {DOMAIN_FIELDS.map(({ key, label }) => {
                      const score = brainMap[key] as number;
                      const color = score >= 65 ? '#008751' : score >= 45 ? '#FFCC00' : '#E30613';
                      return (
                        <div key={key}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-semibold" style={{ color: '#374151' }}>{label}</span>
                            <span className="font-black" style={{ color }}>{score}%</span>
                          </div>
                          <div className="h-2.5 rounded-full overflow-hidden" style={{ background: '#F3F4F6' }}>
                            <div className="h-2.5 rounded-full" style={{ width: `${score}%`, background: color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Top profiles */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {brainMap.topProfiles.map((p) => (
                      <span
                        key={p}
                        className="text-xs px-2.5 py-1 rounded-full font-bold"
                        style={{ background: '#EFF6FF', color: '#0033A0' }}
                      >
                        ⭐ {p}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Teaching recommendation */}
                <div className="rounded-2xl p-5" style={{ background: '#EFF6FF', border: '1.5px solid #BFDBFE' }}>
                  <p className="text-xs font-bold mb-2" style={{ color: '#0033A0' }}>Teacher Recommendation</p>
                  <p className="text-sm leading-relaxed" style={{ color: '#1E40AF' }}>
                    {brainMap.teachingRecommendation}
                  </p>
                </div>

                {/* Home action */}
                <div className="rounded-2xl p-5" style={{ background: '#F0FDF4', border: '1.5px solid #86EFAC' }}>
                  <p className="text-xs font-bold mb-2" style={{ color: '#008751' }}>Home Action for Parent</p>
                  <p className="text-sm leading-relaxed" style={{ color: '#166534' }}>
                    {brainMap.homeAction}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 rounded-2xl" style={{ background: 'white' }}>
                <p className="text-3xl mb-3">🧠</p>
                <p className="font-semibold" style={{ color: '#374151' }}>Brain Map not yet available</p>
                <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>Requires at least 3 weeks of class diary data</p>
              </div>
            )}
          </div>
        )}

        {/* ── Trends Tab ───────────────────────────────────────────────── */}
        {activeTab === 'trends' && (
          <div className="flex flex-col gap-4">
            {CORE_SUBJECTS.map((subject) => {
              const subSnaps = snapshots
                .filter((s) => s.subject === subject)
                .sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate));
              if (subSnaps.length === 0) return null;
              const latest = subSnaps[subSnaps.length - 1].readinessScore;
              const max = Math.max(...subSnaps.map((s) => s.readinessScore));
              const trendColor = scoreColor(latest);
              const trendDir = subSnaps.length >= 2
                ? subSnaps[subSnaps.length - 1].readinessScore > subSnaps[subSnaps.length - 2].readinessScore + 3
                  ? '↑' : subSnaps[subSnaps.length - 1].readinessScore < subSnaps[subSnaps.length - 2].readinessScore - 3
                    ? '↓' : '→'
                : '→';

              return (
                <div
                  key={subject}
                  className="rounded-2xl p-4"
                  style={{ background: 'white', border: '1.5px solid #E5E7EB' }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-bold text-sm" style={{ color: '#111827' }}>{subject}</p>
                    <div className="flex items-center gap-2">
                      <span className="font-black" style={{ color: trendColor }}>{latest.toFixed(0)}%</span>
                      <span className="font-black" style={{ color: trendDir === '↑' ? '#008751' : trendDir === '↓' ? '#E30613' : '#6B7280' }}>
                        {trendDir}
                      </span>
                    </div>
                  </div>
                  {/* Sparkline bars */}
                  <div className="flex items-end gap-1" style={{ height: 48 }}>
                    {subSnaps.slice(-12).map((snap, i) => {
                      const h = max > 0 ? (snap.readinessScore / max) * 48 : 4;
                      const c = scoreColor(snap.readinessScore);
                      return (
                        <div
                          key={i}
                          className="flex-1 rounded-t-sm"
                          style={{ height: h, background: c, minHeight: 4 }}
                          title={`${snap.snapshotDate}: ${(snap.readinessScore ?? 0).toFixed(0)}%`}
                        />
                      );
                    })}
                  </div>
                  <p className="text-xs mt-2" style={{ color: '#9CA3AF' }}>
                    {subSnaps.length} data point{subSnaps.length !== 1 ? 's' : ''}
                  </p>
                </div>
              );
            })}
            {snapshots.length === 0 && (
              <div className="text-center py-16 rounded-2xl" style={{ background: 'white' }}>
                <p className="text-3xl mb-3">📈</p>
                <p className="font-semibold" style={{ color: '#374151' }}>No trend data yet</p>
                <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>Submit diary entries to build trend charts</p>
              </div>
            )}
          </div>
        )}

        {/* ── Career Tab ───────────────────────────────────────────────── */}
        {activeTab === 'career' && (
          <div>
            {career ? (
              <div className="flex flex-col gap-4">
                {/* Pathway banner */}
                <div
                  className="rounded-2xl p-5 flex items-center gap-4"
                  style={{
                    background: career.pathway === 'Science' ? '#0033A0' : career.pathway === 'Arts' ? '#008751' : '#7C3AED',
                    color: 'white',
                  }}
                >
                  <span className="text-4xl">
                    {career.pathway === 'Science' ? '🔬' : career.pathway === 'Arts' ? '🎨' : '💼'}
                  </span>
                  <div className="flex-1">
                    <p className="text-xs font-medium opacity-70">Recommended Pathway</p>
                    <p className="text-2xl font-black">{career.pathway}</p>
                    <p className="text-xs opacity-70 mt-0.5">
                      {career.pathway === 'Science' ? 'Engineering, Medicine, Technology' : career.pathway === 'Arts' ? 'Law, Journalism, Education' : 'Accounting, Business, Economics'}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-black">{career.confidence}%</p>
                    <p className="text-xs opacity-70">confidence</p>
                  </div>
                </div>

                {/* Evidence */}
                <div className="rounded-2xl p-4" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
                  <h3 className="font-bold text-sm mb-3" style={{ color: '#0033A0' }}>Evidence</h3>
                  {career.reasons.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 mb-2">
                      <span style={{ color: '#008751' }}>✓</span>
                      <p className="text-sm" style={{ color: '#374151' }}>{r}</p>
                    </div>
                  ))}
                </div>

                {/* Subject scores */}
                <div className="rounded-2xl p-4" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
                  <h3 className="font-bold text-sm mb-3" style={{ color: '#0033A0' }}>Subject Scores</h3>
                  {Object.entries(career.subjectScores).map(([subj, score]) => {
                    const c = scoreColor(score);
                    return (
                      <div key={subj} className="mb-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium">{subj}</span>
                          <span className="font-bold" style={{ color: c }}>{score.toFixed(0)}%</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: '#F3F4F6' }}>
                          <div className="h-2 rounded-full" style={{ width: `${score}%`, background: c }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-16 rounded-2xl" style={{ background: 'white' }}>
                <p className="text-3xl mb-3">🎓</p>
                <p className="font-semibold" style={{ color: '#374151' }}>No career prediction yet</p>
                <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>Requires readiness data across multiple subjects</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
