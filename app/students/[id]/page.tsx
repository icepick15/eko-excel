'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { WAEC_SUBJECTS, BEHAVIORAL_TRAIT_LABELS, BehavioralTrait } from '@/lib/types';
import type { Student, ReadinessMetric, BrainMapProfile, Hotspot, DiaryEntry } from '@/lib/types';
import { studentStore, metricsStore, brainMapStore, hotspotStore, diaryStore, topicStore, careerStore } from '@/lib/storage';
import type { CareerRecommendation } from '@/lib/types';
import { recomputeStudent } from '@/lib/calculations';
import Navbar from '@/components/Navbar';
import ReadinessBadge from '@/components/ReadinessBadge';
import { ColorStatus } from '@/lib/types';

const SEVERITY_STYLE: Record<string, { bg: string; text: string }> = {
  critical: { bg: '#FEE2E2', text: '#991B1B' },
  high: { bg: '#FEF9C3', text: '#854D0E' },
  medium: { bg: 'var(--lagos-blue-light)', text: 'var(--lagos-blue)' },
};

const CATEGORY_ICON: Record<string, string> = {
  low_attendance: '📅',
  low_readiness: '📉',
  low_engagement: '😔',
  math_weakness: '🔢',
  english_weakness: '📝',
};

export default function StudentProfilePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const studentId = params.id as string;

  const [student, setStudent] = useState<Student | null>(null);
  const [metrics, setMetrics] = useState<ReadinessMetric[]>([]);
  const [brainMap, setBrainMap] = useState<BrainMapProfile | null>(null);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [diaries, setDiaries] = useState<DiaryEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'brainmap' | 'history' | 'career'>('overview');
  const [career, setCareer] = useState<CareerRecommendation | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }

    const s = studentStore.getById(studentId);
    if (!s) { router.replace('/dashboard'); return; }
    setStudent(s);

    recomputeStudent(studentId);

    setMetrics(metricsStore.getByStudent(studentId));
    setBrainMap(brainMapStore.getByStudent(studentId) ?? null);
    setHotspots(hotspotStore.getByStudent(studentId));
    setDiaries(diaryStore.getByStudent(studentId));
    setCareer(careerStore.getByStudent(studentId) ?? null);
  }, [user, isLoading, studentId, router]);

  if (!student) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--lagos-blue)' }}>
        <div className="text-white text-center pt-20 text-lg font-bold animate-pulse">Loading...</div>
      </div>
    );
  }

  const avgReadiness = metrics.length > 0
    ? metrics.reduce((a, m) => a + m.readinessScore, 0) / metrics.length
    : 0;

  const overallStatus = avgReadiness >= 75 ? ColorStatus.GREEN : avgReadiness >= 55 ? ColorStatus.YELLOW : ColorStatus.RED;
  const topics = topicStore.getAll();

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Back */}
        <button onClick={() => router.back()} className="text-xs mb-4 font-medium" style={{ color: 'var(--text-muted)' }}>
          ← Back
        </button>

        {/* Student header */}
        <div className="card mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black shrink-0"
            style={{ background: 'var(--lagos-blue)', color: 'white' }}
          >
            {student.name.charAt(0)}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-black" style={{ color: 'var(--lagos-blue)' }}>{student.name}</h1>
            <div className="flex flex-wrap gap-2 mt-1">
              <span className="text-xs px-2 py-1 rounded-full font-medium"
                style={{ background: 'var(--lagos-blue-light)', color: 'var(--lagos-blue)' }}>
                Class {student.class}
              </span>
              <span className="text-xs px-2 py-1 rounded-full font-medium"
                style={{ background: 'var(--lagos-green-light)', color: 'var(--lagos-green)' }}>
                {diaries.length} diary entries
              </span>
              {hotspots.length > 0 && (
                <span className="text-xs px-2 py-1 rounded-full font-medium"
                  style={{ background: '#FEE2E2', color: 'var(--lagos-red)' }}>
                  {hotspots.length} active alerts
                </span>
              )}
            </div>
          </div>
          <ReadinessBadge score={avgReadiness} status={overallStatus} size="lg" />
        </div>

        {/* Hotspot alerts */}
        {hotspots.length > 0 && (
          <div className="flex flex-col gap-2 mb-6">
            {hotspots.map((h) => (
              <div key={h.id} className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: SEVERITY_STYLE[h.severity].bg, border: '1px solid rgba(0,0,0,0.06)' }}>
                <span className="text-lg">{CATEGORY_ICON[h.category]}</span>
                <div className="flex-1">
                  <span className="text-xs font-bold uppercase tracking-wide" style={{ color: SEVERITY_STYLE[h.severity].text }}>
                    {h.severity}
                  </span>
                  <span className="text-sm ml-2" style={{ color: SEVERITY_STYLE[h.severity].text }}>{h.description}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ background: 'var(--border)' }}>
          {(['overview', 'brainmap', 'history', 'career'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all"
              style={{
                background: activeTab === tab ? 'white' : 'transparent',
                color: activeTab === tab ? 'var(--lagos-blue)' : 'var(--text-muted)',
                boxShadow: activeTab === tab ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              {tab === 'overview' ? 'WAEC Readiness' : tab === 'brainmap' ? 'Brain Map' : tab === 'history' ? 'Diary History' : 'Career Path'}
            </button>
          ))}
        </div>

        {/* WAEC Readiness Tab */}
        {activeTab === 'overview' && (
          <div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {WAEC_SUBJECTS.map((subject) => {
                const metric = metrics.find((m) => m.subject === subject);
                return (
                  <ReadinessBadge
                    key={subject}
                    score={metric?.readinessScore ?? 0}
                    status={metric?.colorStatus ?? ColorStatus.RED}
                    subject={subject}
                    size="md"
                  />
                );
              })}
            </div>
            <div className="card">
              <h3 className="font-bold text-sm mb-3" style={{ color: 'var(--lagos-blue)' }}>Score Breakdown</h3>
              <div className="flex flex-col gap-3">
                {WAEC_SUBJECTS.map((subject) => {
                  const metric = metrics.find((m) => m.subject === subject);
                  const score = metric?.readinessScore ?? 0;
                  const status = metric?.colorStatus ?? ColorStatus.RED;
                  const barColor = status === ColorStatus.GREEN ? 'var(--lagos-green)' : status === ColorStatus.YELLOW ? 'var(--lagos-gold)' : 'var(--lagos-red)';
                  return (
                    <div key={subject}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium">{subject}</span>
                        <span className="font-bold" style={{ color: barColor }}>{score.toFixed(0)}%</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-bar-fill" style={{ width: `${score}%`, background: barColor }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Brain Map Tab */}
        {activeTab === 'brainmap' && brainMap && (
          <div className="grid sm:grid-cols-2 gap-5">
            {/* Academic domains */}
            <div className="card">
              <h3 className="font-bold text-sm mb-4" style={{ color: 'var(--lagos-blue)' }}>Academic Domains</h3>
              <div className="flex flex-col gap-3">
                {Object.entries(brainMap.academicDomains).map(([domain, score]) => (
                  <div key={domain}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium">{domain}</span>
                      <span className="font-bold" style={{ color: 'var(--lagos-blue)' }}>{(score * 100).toFixed(0)}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-bar-fill" style={{ width: `${score * 100}%`, background: 'var(--lagos-blue)' }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Top Strengths</div>
                <div className="flex flex-wrap gap-1.5">
                  {brainMap.topStrengths.map((s) => (
                    <span key={s} className="text-xs px-2.5 py-1 rounded-full font-medium"
                      style={{ background: 'var(--lagos-gold-light)', color: 'var(--lagos-gold)' }}>
                      ⭐ {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Behavioral traits */}
            <div className="card">
              <h3 className="font-bold text-sm mb-4" style={{ color: 'var(--lagos-blue)' }}>Behavioral Traits</h3>
              <div className="flex flex-col gap-3">
                {Object.values(BehavioralTrait).map((trait) => {
                  const score = brainMap.behavioralTraits[trait] ?? 0;
                  return (
                    <div key={trait}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium">{BEHAVIORAL_TRAIT_LABELS[trait]}</span>
                        <span className="font-bold" style={{
                          color: score >= 0.7 ? 'var(--lagos-green)' : score >= 0.45 ? 'var(--lagos-gold)' : 'var(--lagos-red)',
                        }}>
                          {(score * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-bar-fill" style={{
                          width: `${score * 100}%`,
                          background: score >= 0.7 ? 'var(--lagos-green)' : score >= 0.45 ? 'var(--lagos-gold)' : 'var(--lagos-red)',
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3" style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <div className="text-center p-3 rounded-xl" style={{ background: 'var(--lagos-blue-light)' }}>
                  <div className="text-xl font-black" style={{ color: 'var(--lagos-blue)' }}>{brainMap.academicScore.toFixed(0)}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Academic Score</div>
                </div>
                <div className="text-center p-3 rounded-xl" style={{ background: 'var(--lagos-green-light)' }}>
                  <div className="text-xl font-black" style={{ color: 'var(--lagos-green)' }}>{brainMap.behavioralScore.toFixed(0)}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Behavioral Score</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Career Path Tab */}
        {activeTab === 'career' && (
          <div>
            {career ? (
              <div className="flex flex-col gap-5">
                {/* Pathway banner */}
                <div
                  className="rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5"
                  style={{
                    background: career.pathway === 'Science' ? 'var(--lagos-blue)' : career.pathway === 'Arts' ? 'var(--lagos-green)' : 'var(--lagos-gold)',
                    color: 'white',
                  }}
                >
                  <div className="text-5xl shrink-0">
                    {career.pathway === 'Science' ? '🔬' : career.pathway === 'Arts' ? '🎨' : '💼'}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium opacity-80 mb-1">Recommended Pathway</div>
                    <div className="text-3xl font-black mb-1">{career.pathway}</div>
                    <div className="text-sm opacity-80">
                      {career.pathway === 'Science' ? 'Engineering, Medicine, Technology, Sciences' : career.pathway === 'Arts' ? 'Law, Journalism, Education, Languages' : 'Accounting, Business, Economics, Administration'}
                    </div>
                  </div>
                  <div
                    className="px-4 py-2 rounded-xl text-center shrink-0"
                    style={{ background: 'rgba(255,255,255,0.2)' }}
                  >
                    <div className="text-3xl font-black">{career.confidence}%</div>
                    <div className="text-xs opacity-80">confidence</div>
                  </div>
                </div>

                {/* Reasoning */}
                <div className="card">
                  <h3 className="font-bold text-sm mb-3" style={{ color: 'var(--lagos-blue)' }}>Why this pathway?</h3>
                  <div className="flex flex-col gap-2">
                    {career.reasons.map((reason, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <span className="shrink-0 mt-0.5" style={{ color: 'var(--lagos-green)' }}>✓</span>
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pathway comparison */}
                <div className="card">
                  <h3 className="font-bold text-sm mb-4" style={{ color: 'var(--lagos-blue)' }}>Pathway Comparison</h3>
                  {(['Science', 'Arts', 'Commercial'] as const).map((pathway) => {
                    const isTop = pathway === career.pathway;
                    const relevantSubjects: Record<string, string[]> = {
                      Science: ['Mathematics', 'Physics', 'Chemistry'],
                      Arts: ['English', 'Mathematics'],
                      Commercial: ['Mathematics', 'English'],
                    };
                    const avgScore = relevantSubjects[pathway].reduce((sum, subj) => sum + (career.subjectScores[subj] ?? 0), 0) / relevantSubjects[pathway].length;
                    return (
                      <div key={pathway} className="flex items-center gap-3 mb-3">
                        <div className="text-sm font-semibold w-24 shrink-0" style={{ color: isTop ? 'var(--lagos-blue)' : 'var(--text-muted)' }}>
                          {isTop && '★ '}{pathway}
                        </div>
                        <div className="progress-bar flex-1">
                          <div
                            className="progress-bar-fill"
                            style={{
                              width: `${avgScore}%`,
                              background: isTop ? 'var(--lagos-blue)' : 'var(--border)',
                            }}
                          />
                        </div>
                        <div className="text-xs font-bold w-8 text-right shrink-0" style={{ color: isTop ? 'var(--lagos-blue)' : 'var(--text-muted)' }}>
                          {avgScore.toFixed(0)}%
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Subject scores */}
                <div className="card">
                  <h3 className="font-bold text-sm mb-3" style={{ color: 'var(--lagos-blue)' }}>Subject Score Breakdown</h3>
                  <div className="flex flex-col gap-2">
                    {Object.entries(career.subjectScores).map(([subject, score]) => {
                      const sc = score >= 75 ? 'green' : score >= 55 ? 'yellow' : 'red';
                      const barColor = sc === 'green' ? 'var(--lagos-green)' : sc === 'yellow' ? 'var(--lagos-gold)' : 'var(--lagos-red)';
                      return (
                        <div key={subject}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium">{subject}</span>
                            <span className="font-bold" style={{ color: barColor }}>{score.toFixed(0)}%</span>
                          </div>
                          <div className="progress-bar">
                            <div className="progress-bar-fill" style={{ width: `${score}%`, background: barColor }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                    Computed: {new Date(career.computedAt).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="card text-center py-10" style={{ color: 'var(--text-muted)' }}>
                <div className="text-3xl mb-2">🎓</div>
                <div className="text-sm font-medium">No career data yet</div>
                <div className="text-xs mt-1">Submit more diary entries to build the career recommendation.</div>
              </div>
            )}
          </div>
        )}

        {/* Diary History Tab */}
        {activeTab === 'history' && (
          <div className="card">
            <h3 className="font-bold text-sm mb-4" style={{ color: 'var(--lagos-blue)' }}>Diary History ({diaries.length} entries)</h3>
            {diaries.length === 0 ? (
              <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                <div className="text-3xl mb-2">📓</div>
                <div className="text-sm">No diary entries yet</div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {diaries.slice(0, 20).map((diary) => {
                  const topic = topics.find((t) => t.id === diary.topicId);
                  return (
                    <div key={diary.id} className="flex items-center gap-4 p-3 rounded-xl"
                      style={{ background: 'var(--background)' }}>
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm shrink-0"
                        style={{
                          background: diary.classScore >= 75 ? 'var(--lagos-green-light)' : diary.classScore >= 55 ? '#FEF9C3' : '#FEE2E2',
                          color: diary.classScore >= 75 ? 'var(--lagos-green)' : diary.classScore >= 55 ? '#854D0E' : 'var(--lagos-red)',
                        }}
                      >
                        {diary.classScore}%
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm">{topic?.topic ?? 'Unknown topic'}</div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {topic?.subject} &nbsp;·&nbsp; {new Date(diary.createdAt).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </div>
                      <div className="text-xs text-right">
                        <div className="font-semibold" style={{ color: 'var(--text-muted)' }}>
                          {Object.entries(diary.behavioralTraits).filter(([, v]) => v === 'high').length}/5 high
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
