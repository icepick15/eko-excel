'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Role, ColorStatus, WAEC_SUBJECTS } from '@/lib/types';
import type { Student, ReadinessMetric, BrainMapProfile, Hotspot } from '@/lib/types';
import { studentStore, metricsStore, brainMapStore, hotspotStore, topicStore, quizAttemptStore } from '@/lib/storage';
import { recomputeStudent } from '@/lib/calculations';
import Navbar from '@/components/Navbar';
import ReadinessBadge from '@/components/ReadinessBadge';

export default function StudentDashboard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [student, setStudent] = useState<Student | null>(null);
  const [metrics, setMetrics] = useState<ReadinessMetric[]>([]);
  const [brainMap, setBrainMap] = useState<BrainMapProfile | null>(null);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [recentAttempts, setRecentAttempts] = useState<ReturnType<typeof quizAttemptStore.getByStudent>>([]);

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.role !== Role.STUDENT) { router.replace('/login'); return; }
    if (!user.studentId) { router.replace('/login'); return; }

    recomputeStudent(user.studentId);

    const s = studentStore.getById(user.studentId);
    setStudent(s ?? null);
    setMetrics(metricsStore.getByStudent(user.studentId));
    setBrainMap(brainMapStore.getByStudent(user.studentId) ?? null);
    setHotspots(hotspotStore.getByStudent(user.studentId));
    setRecentAttempts(quizAttemptStore.getByStudent(user.studentId).slice(0, 5));
  }, [user, isLoading, router]);

  if (isLoading || !student) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--lagos-blue)' }}>
        <div className="text-white text-center">
          <div className="text-xl font-bold mb-2">Eko Excel</div>
          <div className="text-blue-200 text-sm animate-pulse">Loading your dashboard...</div>
        </div>
      </div>
    );
  }

  const avgReadiness = metrics.length > 0
    ? metrics.reduce((a, m) => a + m.readinessScore, 0) / metrics.length
    : 0;
  const overallStatus = avgReadiness >= 75 ? ColorStatus.GREEN : avgReadiness >= 55 ? ColorStatus.YELLOW : ColorStatus.RED;
  const topics = topicStore.getAll();

  const statusColor = overallStatus === ColorStatus.GREEN ? 'var(--lagos-green)' : overallStatus === ColorStatus.YELLOW ? 'var(--lagos-gold)' : 'var(--lagos-red)';

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
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
              <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: 'var(--lagos-blue-light)', color: 'var(--lagos-blue)' }}>
                Class {student.class}
              </span>
              <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: 'var(--lagos-green-light)', color: 'var(--lagos-green)' }}>
                {recentAttempts.length} quizzes completed
              </span>
              {hotspots.length > 0 && (
                <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: '#FEE2E2', color: 'var(--lagos-red)' }}>
                  {hotspots.length} active hotspots
                </span>
              )}
            </div>
          </div>
          <ReadinessBadge score={avgReadiness} status={overallStatus} size="lg" />
        </div>

        {/* Risk alert */}
        {avgReadiness < 40 && (
          <div className="rounded-xl p-4 mb-6 flex items-center gap-3" style={{ background: '#FEE2E2', border: '1px solid #FCA5A5' }}>
            <span className="text-2xl">⚠</span>
            <div>
              <div className="font-bold text-sm" style={{ color: 'var(--lagos-red)' }}>Your WAEC readiness is critically low</div>
              <div className="text-xs mt-0.5" style={{ color: '#991B1B' }}>Practice the quizzes below every day to bring your score up before exams.</div>
            </div>
          </div>
        )}

        {/* Active Hotspots — practice now */}
        {hotspots.length > 0 && (
          <div className="card mb-6">
            <h2 className="font-bold text-base mb-4" style={{ color: 'var(--lagos-red)' }}>
              ⚡ Your Weak Areas — Practice Now
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {hotspots.map((h) => {
                const topic = topics.find((t) => {
                  if (h.category === 'math_weakness') return t.subject === 'Mathematics';
                  if (h.category === 'english_weakness') return t.subject === 'English';
                  return false;
                }) ?? topics.find(() => true);
                return (
                  <div
                    key={h.id}
                    className="rounded-xl p-4 flex items-center justify-between gap-3"
                    style={{ background: h.severity === 'critical' ? '#FEE2E2' : h.severity === 'high' ? '#FEF9C3' : 'var(--lagos-blue-light)' }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm" style={{ color: h.severity === 'critical' ? 'var(--lagos-red)' : h.severity === 'high' ? '#854D0E' : 'var(--lagos-blue)' }}>
                        {h.description}
                      </div>
                      <div className="text-xs mt-0.5 capitalize" style={{ color: 'var(--text-muted)' }}>{h.severity} priority</div>
                    </div>
                    {topic && (
                      <button
                        className="text-xs font-bold px-3 py-2 rounded-lg shrink-0"
                        style={{ background: 'var(--lagos-blue)', color: 'white' }}
                        onClick={() => router.push(`/quiz?topicId=${topic.id}&subject=${encodeURIComponent(topic.subject)}`)}
                      >
                        Practice →
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Subject Readiness */}
        <div className="card mb-6">
          <h2 className="font-bold text-base mb-4" style={{ color: 'var(--lagos-blue)' }}>WAEC Readiness by Subject</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
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
          {/* Practice buttons per subject */}
          <div className="flex flex-wrap gap-2">
            {WAEC_SUBJECTS.map((subject) => {
              const subjectTopics = topics.filter((t) => t.subject === subject);
              const firstTopic = subjectTopics[0];
              const metric = metrics.find((m) => m.subject === subject);
              if (!firstTopic) return null;
              return (
                <button
                  key={subject}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
                  style={{
                    background: metric?.colorStatus === ColorStatus.GREEN ? 'var(--lagos-green-light)' : metric?.colorStatus === ColorStatus.YELLOW ? '#FEF9C3' : '#FEE2E2',
                    color: metric?.colorStatus === ColorStatus.GREEN ? 'var(--lagos-green)' : metric?.colorStatus === ColorStatus.YELLOW ? '#854D0E' : 'var(--lagos-red)',
                  }}
                  onClick={() => router.push(`/quiz?topicId=${firstTopic.id}&subject=${encodeURIComponent(subject)}`)}
                >
                  Practice {subject} →
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Brain Map snapshot */}
          {brainMap && (
            <div className="card">
              <h2 className="font-bold text-base mb-4" style={{ color: 'var(--lagos-blue)' }}>Your Brain Map</h2>
              <div className="flex flex-col gap-2 mb-4">
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
              {brainMap.topStrengths.length > 0 && (
                <div>
                  <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Top Strengths</div>
                  <div className="flex flex-wrap gap-1.5">
                    {brainMap.topStrengths.map((s) => (
                      <span key={s} className="text-xs px-2 py-1 rounded-full font-medium"
                        style={{ background: 'var(--lagos-gold-light)', color: 'var(--lagos-gold)' }}>
                        ⭐ {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Recent quiz history */}
          <div className="card">
            <h2 className="font-bold text-base mb-4" style={{ color: 'var(--lagos-blue)' }}>Recent Quiz Scores</h2>
            {recentAttempts.length === 0 ? (
              <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                <div className="text-3xl mb-2">📝</div>
                <div className="text-sm font-medium mb-1">No quizzes yet</div>
                <div className="text-xs">Tap "Practice" on any subject above to start</div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {recentAttempts.map((attempt) => {
                  const topic = topics.find((t) => t.id === attempt.topicId);
                  const passed = attempt.score >= 65;
                  return (
                    <div key={attempt.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--background)' }}>
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm shrink-0"
                        style={{
                          background: passed ? 'var(--lagos-green-light)' : '#FEE2E2',
                          color: passed ? 'var(--lagos-green)' : 'var(--lagos-red)',
                        }}
                      >
                        {attempt.score}%
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{topic?.topic ?? 'Quiz'}</div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {attempt.subject} · {attempt.correctCount}/{attempt.totalQuestions} correct · {new Date(attempt.completedAt).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                      <div className="text-lg shrink-0">{passed ? '✅' : '❌'}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Overall progress bar */}
        <div className="card mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-base" style={{ color: 'var(--lagos-blue)' }}>Overall WAEC Readiness</h2>
            <span className="font-black text-2xl" style={{ color: statusColor }}>{avgReadiness.toFixed(0)}%</span>
          </div>
          <div className="progress-bar" style={{ height: '12px' }}>
            <div className="progress-bar-fill" style={{ width: `${avgReadiness}%`, background: statusColor, height: '12px', borderRadius: '6px' }} />
          </div>
          <div className="flex justify-between text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            <span>0%</span>
            <span style={{ color: 'var(--lagos-gold)' }}>55% — Passing</span>
            <span style={{ color: 'var(--lagos-green)' }}>75% — Strong</span>
            <span>100%</span>
          </div>
        </div>
      </main>
    </div>
  );
}
