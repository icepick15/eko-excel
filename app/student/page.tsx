'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Role, ColorStatus, CORE_SUBJECTS } from '@/lib/types';
import type {
  Student, ReadinessMetric, BrainMapProfile, Hotspot,
  QuizAttempt, PracticeStreak, TopicSegment, Class, CareerRecommendation,
} from '@/lib/types';
import {
  studentStore, metricsStore, brainMapStore, hotspotStore,
  topicStore, quizAttemptStore, streakStore, classStore, careerStore,
} from '@/lib/storage';
import { recomputeStudent, getAttendanceRate, scoreColor, SCORE_GREEN, SCORE_YELLOW } from '@/lib/calculations';
import Navbar from '@/components/Navbar';

const SUBJECT_EMOJI: Record<string, string> = {
  'Mathematics':      '🔢',
  'English Language': '📝',
  'Physics':          '⚡',
  'Chemistry':        '🧪',
  'Biology':          '🌿',
};

export default function StudentDashboard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [student,       setStudent]       = useState<Student | null>(null);
  const [cls,           setCls]           = useState<Class | null>(null);
  const [metrics,       setMetrics]       = useState<ReadinessMetric[]>([]);
  const [brainMap,      setBrainMap]      = useState<BrainMapProfile | null>(null);
  const [hotspots,      setHotspots]      = useState<Hotspot[]>([]);
  const [recentAttempts,setRecentAttempts]= useState<QuizAttempt[]>([]);
  const [allAttempts,   setAllAttempts]   = useState<QuizAttempt[]>([]);
  const [streak,        setStreak]        = useState<PracticeStreak | null>(null);
  const [topics,        setTopics]        = useState<TopicSegment[]>([]);
  const [career,        setCareer]        = useState<CareerRecommendation | null>(null);
  const [attendance,    setAttendance]    = useState(1);
  const [heatmapSubject, setHeatmapSubject] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.role !== Role.STUDENT) {
      if (user.role === Role.PARENT) router.replace('/parent');
      else router.replace('/dashboard');
      return;
    }
    if (!user.studentId) { router.replace('/login'); return; }

    const sid = user.studentId;
    recomputeStudent(sid);

    const s = studentStore.getById(sid);
    setStudent(s ?? null);

    if (s?.classId) setCls(classStore.getById(s.classId) ?? null);

    setMetrics(metricsStore.getByStudent(sid));
    setBrainMap(brainMapStore.getByStudent(sid) ?? null);
    setHotspots(hotspotStore.getByStudent(sid));
    const allA = quizAttemptStore.getByStudent(sid);
    setAllAttempts(allA);
    setRecentAttempts(allA.slice(0, 5));
    setStreak(streakStore.get(sid));
    setTopics(topicStore.getAll());
    setCareer(careerStore.getByStudent(sid) ?? null);
    setAttendance(getAttendanceRate(sid));
  }, [user, isLoading, router]);

  if (isLoading || !student) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0033A0' }}>
        <div className="text-white text-center">
          <div className="text-2xl font-black mb-2">EkoExcel</div>
          <div className="text-sm opacity-60 animate-pulse">Loading your dashboard...</div>
        </div>
      </div>
    );
  }

  const avgReadiness = metrics.length > 0
    ? Math.round(metrics.reduce((a, m) => a + m.readinessScore, 0) / metrics.length)
    : 0;
  const overallColor = scoreColor(avgReadiness);

  // Weakest subject for Today's Action card
  const weakest = metrics.length > 0
    ? metrics.reduce((w, m) => m.readinessScore < (w?.readinessScore ?? 999) ? m : w, metrics[0])
    : null;
  const weakestTopics = weakest ? topics.filter((t) => t.subject === weakest.subject) : [];

  return (
    <div className="min-h-screen" style={{ background: '#F5F7FA' }}>
      <Navbar />

      <main className="max-w-lg mx-auto px-4 py-5 pb-10">

        {/* ── Hero header ─────────────────────────────────────────────── */}
        <div
          className="rounded-2xl p-5 mb-4 relative overflow-hidden"
          style={{ background: '#0033A0', color: 'white' }}
        >
          <div className="relative z-10">
            <p className="text-sm font-medium opacity-70">Welcome back,</p>
            <h1 className="text-xl font-black mt-0.5">{student.name.split(' ')[0]}</h1>
            <p className="text-xs opacity-50 mt-0.5">
              {cls?.level}{cls?.section} · {new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            {/* Streak */}
            {(streak?.currentStreak ?? 0) > 0 && (
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'rgba(255,204,0,0.2)' }}>
                <span>🔥</span>
                <span className="text-xs font-bold" style={{ color: '#FFCC00' }}>
                  {streak!.currentStreak} day streak
                </span>
              </div>
            )}
          </div>
          <div
            className="absolute -bottom-8 -right-8 w-36 h-36 rounded-full opacity-10"
            style={{ background: '#FFCC00' }}
          />
        </div>

        {/* ── Overall readiness ring ──────────────────────────────────── */}
        <div
          className="rounded-2xl p-5 mb-4 flex items-center gap-5"
          style={{ background: 'white', border: '1.5px solid #E5E7EB' }}
        >
          {/* SVG ring */}
          <div className="shrink-0 relative w-20 h-20">
            <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90">
              <circle cx="40" cy="40" r="34" fill="none" stroke="#F3F4F6" strokeWidth="8" />
              <circle
                cx="40" cy="40" r="34" fill="none"
                stroke={overallColor} strokeWidth="8"
                strokeDasharray={`${2 * Math.PI * 34 * (avgReadiness / 100)} ${2 * Math.PI * 34}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-black leading-none" style={{ color: overallColor }}>{avgReadiness}</span>
              <span className="text-xs" style={{ color: '#9CA3AF' }}>%</span>
            </div>
          </div>
          <div className="flex-1">
            <p className="font-black text-base" style={{ color: '#111827' }}>WAEC Readiness</p>
            <p className="text-xs mt-0.5" style={{ color: overallColor, fontWeight: 600 }}>
              {avgReadiness >= SCORE_GREEN ? 'On track — keep going!' : avgReadiness >= SCORE_YELLOW ? 'Getting there — practice daily' : 'Needs urgent attention'}
            </p>
            <div className="flex gap-3 mt-2">
              <div className="text-center">
                <p className="text-base font-black" style={{ color: '#111827' }}>{hotspots.length}</p>
                <p className="text-xs" style={{ color: '#9CA3AF' }}>Hotspots</p>
              </div>
              <div className="text-center">
                <p className="text-base font-black" style={{ color: '#111827' }}>{Math.round(attendance * 100)}%</p>
                <p className="text-xs" style={{ color: '#9CA3AF' }}>Attendance</p>
              </div>
              <div className="text-center">
                <p className="text-base font-black" style={{ color: '#111827' }}>{recentAttempts.length}</p>
                <p className="text-xs" style={{ color: '#9CA3AF' }}>Quizzes</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Today's Action card ─────────────────────────────────────── */}
        {weakest && weakestTopics.length > 0 && (
          <div
            className="rounded-2xl p-4 mb-4"
            style={{
              background: weakest.readinessScore < SCORE_YELLOW ? '#FEF2F2' : '#EFF6FF',
              border: `1.5px solid ${weakest.readinessScore < SCORE_YELLOW ? '#FECACA' : '#BFDBFE'}`,
            }}
          >
            <p className="text-xs font-bold mb-1" style={{ color: weakest.readinessScore < SCORE_YELLOW ? '#E30613' : '#0033A0' }}>
              Today&apos;s Priority Action
            </p>
            <p className="font-black text-base" style={{ color: '#111827' }}>
              {SUBJECT_EMOJI[weakest.subject] ?? '📚'} Practice {weakest.subject}
            </p>
            <p className="text-xs mt-0.5 mb-3" style={{ color: '#6B7280' }}>
              Your weakest subject at {(weakest.readinessScore ?? 0).toFixed(0)}% — 15 minutes a day improves WAEC score
            </p>
            <button
              onClick={() => router.push(`/quiz?subject=${encodeURIComponent(weakest.subject)}&topicId=${weakestTopics[0].id}`)}
              className="w-full py-3 rounded-xl font-bold text-white text-sm"
              style={{ background: weakest.readinessScore < SCORE_YELLOW ? '#E30613' : '#0033A0' }}
            >
              Start Practice Quiz →
            </button>
          </div>
        )}

        {/* ── Subject rings ───────────────────────────────────────────── */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="font-bold text-sm" style={{ color: '#111827' }}>Subjects</p>
            <button
              onClick={() => router.push('/quiz')}
              className="text-xs font-semibold"
              style={{ color: '#0033A0' }}
            >
              Practice →
            </button>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {CORE_SUBJECTS.map((subject) => {
              const metric = metrics.find((m) => m.subject === subject);
              const score  = metric?.readinessScore ?? 0;
              const color  = scoreColor(score);
              const subjectTopics = topics.filter((t) => t.subject === subject);
              return (
                <button
                  key={subject}
                  onClick={() => subjectTopics[0] && router.push(`/quiz?subject=${encodeURIComponent(subject)}&topicId=${subjectTopics[0].id}`)}
                  className="flex flex-col items-center gap-1"
                >
                  <div className="relative w-12 h-12">
                    <svg viewBox="0 0 48 48" className="w-12 h-12 -rotate-90">
                      <circle cx="24" cy="24" r="20" fill="none" stroke="#F3F4F6" strokeWidth="4" />
                      <circle
                        cx="24" cy="24" r="20" fill="none"
                        stroke={color} strokeWidth="4"
                        strokeDasharray={`${2 * Math.PI * 20 * (score / 100)} ${2 * Math.PI * 20}`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span style={{ fontSize: 14 }}>{SUBJECT_EMOJI[subject] ?? '📚'}</span>
                    </div>
                  </div>
                  <span className="text-xs font-bold" style={{ color }}>
                    {score.toFixed(0)}%
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 mt-2 text-xs" style={{ color: '#9CA3AF' }}>
            {CORE_SUBJECTS.map((s) => (
              <span key={s} className="flex-1 text-center truncate" title={s}>{s.split(' ')[0]}</span>
            ))}
          </div>
        </div>

        {/* ── Academic Mastery Heatmap ────────────────────────────────── */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
          {/* Header row */}
          <div className="flex items-center justify-between mb-0.5">
            <div className="flex items-center gap-2">
              {heatmapSubject && (
                <button
                  onClick={() => setHeatmapSubject(null)}
                  className="text-sm font-bold"
                  style={{ color: '#0033A0' }}
                >
                  ←
                </button>
              )}
              <p className="font-bold text-sm" style={{ color: '#111827' }}>
                {heatmapSubject ?? 'Academic Mastery Heatmap'}
              </p>
            </div>
            {heatmapSubject && (() => {
              const firstTopic = topics.find(t => t.subject === heatmapSubject);
              return firstTopic ? (
                <button
                  onClick={() => router.push(`/quiz?subject=${encodeURIComponent(heatmapSubject)}&topicId=${firstTopic.id}`)}
                  className="text-xs font-bold px-3 py-1 rounded-full"
                  style={{ background: '#0033A0', color: 'white' }}
                >
                  Practice All →
                </button>
              ) : null;
            })()}
          </div>
          <p className="text-xs mb-3" style={{ color: '#9CA3AF' }}>
            {heatmapSubject
              ? 'Topics sorted weakest first — red blocks need your attention most'
              : 'Select any subject block to drill into sub-topic cognitive hotspots'}
          </p>

          {/* ── Subject grid ── */}
          {!heatmapSubject && (
            <div className="grid grid-cols-2 gap-2">
              {CORE_SUBJECTS.map((subject) => {
                const metric = metrics.find(m => m.subject === subject);
                const score = Math.round(metric?.readinessScore ?? 0);
                const quizCount = allAttempts.filter(a => a.subject === subject).length;
                const isCritical = score < SCORE_YELLOW;
                const isCaution  = score >= SCORE_YELLOW && score < SCORE_GREEN;
                const bg     = isCritical ? '#FEF2F2' : isCaution ? '#FFFBEB' : '#F0FDF4';
                const border = isCritical ? '#FECACA' : isCaution ? '#FDE68A' : '#86EFAC';
                const color  = isCritical ? '#DC2626' : isCaution ? '#D97706' : '#16A34A';
                const label  = isCritical ? 'CRITICAL HOTSPOT' : isCaution ? 'CAUTION ZONE' : 'MASTERED';
                return (
                  <button
                    key={subject}
                    onClick={() => setHeatmapSubject(subject)}
                    className="rounded-xl p-3 text-left"
                    style={{ background: bg, border: `1.5px solid ${border}` }}
                  >
                    <div className="flex items-start justify-between">
                      <p className="text-sm font-semibold leading-tight" style={{ color: '#374151' }}>{subject}</p>
                      <span style={{ fontSize: 16 }}>{SUBJECT_EMOJI[subject] ?? '📚'}</span>
                    </div>
                    <div className="flex items-baseline gap-1 mt-2">
                      <span className="text-3xl font-black leading-none" style={{ color }}>{score}%</span>
                      <span className="font-bold leading-none" style={{ color, fontSize: '0.55rem' }}>{label}</span>
                    </div>
                    <p className="text-xs mt-1.5" style={{ color: '#9CA3AF', fontSize: '0.62rem' }}>
                      {quizCount === 0 ? 'No quizzes yet' : `${quizCount} quiz${quizCount !== 1 ? 'zes' : ''}`} · tap to explore
                    </p>
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Topic drill-down ── */}
          {heatmapSubject && (() => {
            const subjectTopics = topics
              .filter(t => t.subject === heatmapSubject)
              .map(t => {
                const ta = allAttempts.filter(a => a.topicId === t.id);
                const score = ta.length > 0 ? Math.round(Math.max(...ta.map(a => a.score))) : null;
                return { ...t, score, attemptCount: ta.length };
              })
              .sort((a, b) => {
                if (a.score === null && b.score === null) return b.waecWeight - a.waecWeight;
                if (a.score === null) return -1;
                if (b.score === null) return 1;
                return a.score - b.score;
              });

            if (subjectTopics.length === 0) {
              return (
                <p className="text-sm text-center py-6" style={{ color: '#9CA3AF' }}>
                  No topics available for this subject yet.
                </p>
              );
            }

            return (
              <div className="flex flex-col gap-2">
                {subjectTopics.map((topic) => {
                  const score = topic.score;
                  const isUntried  = score === null;
                  const isCritical = !isUntried && score! < SCORE_YELLOW;
                  const isCaution  = !isUntried && score! >= SCORE_YELLOW && score! < SCORE_GREEN;
                  const isMastered = !isUntried && score! >= SCORE_GREEN;

                  const bg     = isUntried ? '#F9FAFB'  : isCritical ? '#FEF2F2' : isCaution ? '#FFFBEB' : '#F0FDF4';
                  const border = isUntried ? '#E5E7EB'  : isCritical ? '#FECACA' : isCaution ? '#FDE68A' : '#86EFAC';
                  const color  = isUntried ? '#9CA3AF'  : isCritical ? '#DC2626' : isCaution ? '#D97706' : '#16A34A';
                  const badge  = isUntried ? 'NOT TRIED' : isCritical ? 'WEAK' : isCaution ? 'IMPROVING' : 'STRONG';
                  const btnBg  = isUntried || isCritical ? '#E30613' : isCaution ? '#D97706' : '#008751';
                  const btnLabel = isUntried ? 'Start' : isMastered ? 'Review' : 'Practice';

                  return (
                    <div
                      key={topic.id}
                      className="rounded-xl p-3"
                      style={{ background: bg, border: `1.5px solid ${border}` }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          {/* Badge row */}
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className="font-bold px-1.5 py-0.5 rounded"
                              style={{ background: color + '22', color, fontSize: '0.6rem' }}
                            >
                              {badge}
                            </span>
                            <span style={{ color: '#9CA3AF', fontSize: '0.6rem' }}>
                              WAEC weight ×{topic.waecWeight}
                            </span>
                          </div>
                          {/* Topic name */}
                          <p className="text-sm font-semibold leading-tight" style={{ color: '#111827' }}>
                            {topic.topic}
                          </p>
                          {/* Progress bar or hint */}
                          {score !== null ? (
                            <div className="flex items-center gap-2 mt-1.5">
                              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#E5E7EB' }}>
                                <div
                                  className="h-1.5 rounded-full"
                                  style={{ width: `${score}%`, background: color }}
                                />
                              </div>
                              <span className="text-xs font-bold shrink-0" style={{ color }}>{score}%</span>
                            </div>
                          ) : (
                            <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>
                              Never practiced — highest priority
                            </p>
                          )}
                          {topic.attemptCount > 0 && (
                            <p className="text-xs mt-0.5" style={{ color: '#9CA3AF', fontSize: '0.62rem' }}>
                              {topic.attemptCount} attempt{topic.attemptCount !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                        {/* CTA button */}
                        <button
                          onClick={() => router.push(`/quiz?subject=${encodeURIComponent(heatmapSubject)}&topicId=${topic.id}`)}
                          className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold self-center"
                          style={{ background: btnBg, color: 'white' }}
                        >
                          {btnLabel}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* ── Stream Prediction ───────────────────────────────────────── */}
        {career && (
          <div
            className="rounded-2xl p-4 mb-4 flex items-center gap-4"
            style={{ background: '#F0FDF4', border: '1.5px solid #86EFAC' }}
          >
            <span className="text-3xl">
              {career.pathway === 'Science' ? '🔬' : career.pathway === 'Arts' ? '🎨' : '💼'}
            </span>
            <div className="flex-1">
              <p className="text-xs font-bold" style={{ color: '#008751' }}>Career Stream Prediction</p>
              <p className="font-black text-base" style={{ color: '#111827' }}>{career.pathway}</p>
              <p className="text-xs" style={{ color: '#6B7280' }}>
                {career.confidence}% confidence based on your performance
              </p>
            </div>
          </div>
        )}

        {/* ── Hotspot alerts ───────────────────────────────────────────── */}
        {(() => {
          // Deduplicate by subject and skip any corrupt entries (no subject or 0% score)
          const seen = new Set<string>();
          const cleanHotspots = hotspots.filter((h) => {
            if (!h.subject || h.readinessScore <= 0) return false;
            if (seen.has(h.subject)) return false;
            seen.add(h.subject);
            return true;
          });
          if (cleanHotspots.length === 0) return null;
          return (
            <div className="rounded-2xl p-4 mb-4" style={{ background: 'white', border: '1.5px solid #FECACA' }}>
              <p className="font-bold text-sm mb-3" style={{ color: '#E30613' }}>
                ⚡ Weak Areas — Focus Here
              </p>
              <div className="flex flex-col gap-2">
                {cleanHotspots.map((h) => {
                  const subjectTopics = topics.filter((t) => t.subject === h.subject);
                  const score = Math.round(h.readinessScore);
                  return (
                    <div key={h.subject} className="flex items-center gap-3">
                      <span className="text-base">{SUBJECT_EMOJI[h.subject] ?? '📚'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold" style={{ color: '#111827' }}>{h.subject}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: '#FEE2E2' }}>
                            <div className="h-1 rounded-full" style={{ width: `${score}%`, background: '#E30613' }} />
                          </div>
                          <span className="text-xs font-bold shrink-0" style={{ color: '#E30613' }}>{score}%</span>
                        </div>
                      </div>
                      {subjectTopics[0] && (
                        <button
                          onClick={() => router.push(`/quiz?subject=${encodeURIComponent(h.subject)}&topicId=${subjectTopics[0].id}`)}
                          className="text-xs font-bold px-3 py-1.5 rounded-full shrink-0"
                          style={{ background: '#FEE2E2', color: '#E30613' }}
                        >
                          Practice
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* ── Recent quiz scores ───────────────────────────────────────── */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="font-bold text-sm" style={{ color: '#111827' }}>Recent Quizzes</p>
            <button onClick={() => router.push('/quiz')} className="text-xs font-semibold" style={{ color: '#0033A0' }}>
              New Quiz →
            </button>
          </div>
          {recentAttempts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-2xl mb-2">🎯</p>
              <p className="text-sm font-semibold" style={{ color: '#374151' }}>No quizzes yet</p>
              <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>Tap any subject ring above to start practising</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {recentAttempts.map((attempt) => {
                const topic = topics.find((t) => t.id === attempt.topicId);
                const passed = attempt.score >= 65;
                return (
                  <div
                    key={attempt.id}
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ background: '#F9FAFB', border: '1.5px solid #E5E7EB' }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0"
                      style={{
                        background: passed ? '#DCFCE7' : '#FEE2E2',
                        color: passed ? '#008751' : '#E30613',
                      }}
                    >
                      {attempt.score}%
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{topic?.topic ?? attempt.subject}</p>
                      <p className="text-xs" style={{ color: '#9CA3AF' }}>
                        {attempt.correctCount}/{attempt.totalQuestions} correct ·{' '}
                        {new Date(attempt.completedAt).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}
                        {attempt.isTimedMode && ' · Timed'}
                      </p>
                    </div>
                    <span className="text-lg shrink-0">{passed ? '✅' : '❌'}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Brain Map preview ────────────────────────────────────────── */}
        {brainMap && (
          <div className="rounded-2xl p-4" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
            <p className="font-bold text-sm mb-3" style={{ color: '#111827' }}>Your Brain Map</p>
            {brainMap.topProfiles.map((p) => (
              <span
                key={p}
                className="inline-flex items-center text-xs px-2.5 py-1 rounded-full font-bold mr-2 mb-2"
                style={{ background: '#EFF6FF', color: '#0033A0' }}
              >
                ⭐ {p}
              </span>
            ))}
            <p className="text-xs mt-2 leading-relaxed" style={{ color: '#6B7280' }}>
              {brainMap.homeAction}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
