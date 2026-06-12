'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Role, BehavioralTrait, BEHAVIORAL_TRAIT_LABELS } from '@/lib/types';
import type { Student, TopicSegment, TeacherClassSubject, Class } from '@/lib/types';
import { tcsStore, classStore, studentStore, topicStore, diaryStore, attendanceStore } from '@/lib/storage';
import { recomputeStudent } from '@/lib/calculations';
import Navbar from '@/components/Navbar';

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

const STEPS = ['Class', 'Attendance', 'Topics', 'Score & Traits', 'Review'];

const DEFAULT_TRAITS: Record<BehavioralTrait, number> = {
  [BehavioralTrait.ENGAGEMENT]: 3,
  [BehavioralTrait.PERSISTENCE]: 3,
  [BehavioralTrait.FOCUS]: 3,
  [BehavioralTrait.COLLABORATION]: 3,
  [BehavioralTrait.RESILIENCE]: 3,
};

const TRAIT_COLORS: Record<number, string> = {
  1: '#E30613',
  2: '#F97316',
  3: '#FFCC00',
  4: '#22C55E',
  5: '#008751',
};

export default function DiaryEntryPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // Step tracker
  const [step, setStep] = useState(0);

  // Step 0: class/subject selection
  const [myTcs, setMyTcs] = useState<TeacherClassSubject[]>([]);
  const [selectedTcsId, setSelectedTcsId] = useState('');

  // Derived from selection
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [topics, setTopics] = useState<TopicSegment[]>([]);

  // Step 1: attendance — set of PRESENT student IDs (default all present)
  const [presentIds, setPresentIds] = useState<Set<string>>(new Set());

  // Step 2: topics
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  // Step 3: score and traits
  const [classScore, setClassScore] = useState(60);
  const [traits, setTraits] = useState<Record<BehavioralTrait, number>>({ ...DEFAULT_TRAITS });

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.role !== Role.TEACHER && user.role !== Role.HEADTEACHER) {
      router.replace('/dashboard');
      return;
    }
    const tcs = tcsStore.getByTeacher(user.id);
    setMyTcs(tcs);
    if (tcs.length > 0) setSelectedTcsId(tcs[0].id);
  }, [user, isLoading, router]);

  // When selectedTcsId changes, load class + students + topics
  useEffect(() => {
    if (!selectedTcsId) return;
    const tcs = myTcs.find((t) => t.id === selectedTcsId);
    if (!tcs) return;

    const cls = classStore.getById(tcs.classId);
    setSelectedClass(cls ?? null);

    const classStudents = studentStore.getByClass(tcs.classId);
    setStudents(classStudents);
    setPresentIds(new Set(classStudents.map((s) => s.id)));

    const classTopics = topicStore.getBySubject(tcs.subject);
    setTopics(classTopics);
    setSelectedTopicIds([]);
  }, [selectedTcsId, myTcs]);

  const selectedTcs = myTcs.find((t) => t.id === selectedTcsId);

  function togglePresent(id: string) {
    setPresentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleTopic(id: string) {
    setSelectedTopicIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < 3 ? [...prev, id] : prev
    );
  }

  function setTrait(trait: BehavioralTrait, val: number) {
    setTraits((prev) => ({ ...prev, [trait]: val }));
  }

  function scoreColor(score: number): string {
    if (score >= 70) return '#008751';
    if (score >= 40) return '#FFCC00';
    return '#E30613';
  }

  function scoreLabel(score: number): string {
    if (score >= 70) return 'Good performance';
    if (score >= 40) return 'Needs improvement';
    return 'Below threshold';
  }

  const canProceed = useCallback((): boolean => {
    if (step === 0) return !!selectedTcsId;
    if (step === 1) return presentIds.size > 0;
    if (step === 2) return selectedTopicIds.length > 0;
    if (step === 3) return true;
    return true;
  }, [step, selectedTcsId, presentIds, selectedTopicIds]);

  function handleSubmit() {
    if (!selectedTcs || !selectedClass) return;
    setSubmitting(true);

    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const presentArr = Array.from(presentIds);
    const absentArr = students.filter((s) => !presentIds.has(s.id)).map((s) => s.id);

    const entry = {
      id: uid(),
      teacherId: user!.id,
      classId: selectedClass.id,
      subject: selectedTcs.subject,
      topicIds: selectedTopicIds,
      classScore,
      presentStudentIds: presentArr,
      absentStudentIds: absentArr,
      traits,
      notes: notes.trim() || undefined,
      submittedAt: now,
      syncStatus: 'pending_sync' as const,
    };
    diaryStore.save(entry);

    // Record per-student attendance
    const attRecords = students.map((s) => ({
      id: `att-${s.id}-${today}`,
      studentId: s.id,
      diaryId: entry.id,
      date: today,
      status: presentIds.has(s.id) ? 'present' as const : 'absent' as const,
    }));
    attendanceStore.saveMany(attRecords);

    // Recompute metrics for present students
    presentArr.forEach((sid) => recomputeStudent(sid));

    setSubmitting(false);
    setSubmitted(true);
  }

  // ── Success screen ───────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--background)' }}>
        <Navbar />
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <div
            className="w-24 h-24 rounded-full mx-auto flex items-center justify-center text-4xl mb-6 shadow-lg"
            style={{ background: '#008751', color: 'white' }}
          >
            ✓
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: '#0033A0' }}>Diary Submitted!</h2>
          <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
            {selectedTcs?.subject} · {selectedClass?.level}{selectedClass?.section}
          </p>
          <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
            {presentIds.size} students present · WAEC readiness updated
          </p>
          <div className="flex flex-col gap-3">
            <button
              className="w-full py-3 rounded-xl font-bold text-white text-sm"
              style={{ background: '#0033A0' }}
              onClick={() => {
                setStep(0);
                setSubmitted(false);
                setSelectedTopicIds([]);
                setNotes('');
                setClassScore(60);
                setTraits({ ...DEFAULT_TRAITS });
              }}
            >
              + Log Another Entry
            </button>
            <button
              className="w-full py-3 rounded-xl font-semibold text-sm"
              style={{ background: '#E8F0FE', color: '#0033A0' }}
              onClick={() => router.push('/dashboard')}
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const progressPct = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <Navbar />

      {/* Progress header */}
      <div style={{ background: '#0033A0', color: 'white' }} className="px-4 pt-4 pb-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => step > 0 ? setStep(step - 1) : router.back()}
              className="text-sm font-medium opacity-80 hover:opacity-100"
            >
              ← {step === 0 ? 'Back' : STEPS[step - 1]}
            </button>
            <span className="text-xs font-bold opacity-70">
              Step {step + 1} of {STEPS.length} — {STEPS[step]}
            </span>
          </div>
          <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }}>
            <div
              className="h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%`, background: '#FFCC00' }}
            />
          </div>
        </div>
      </div>

      <main className="max-w-2xl md:max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-8 pb-28">

        {/* ── Step 0: Class + Subject ───────────────────────────────────── */}
        {step === 0 && (
          <div>
            <h1 className="text-xl font-bold mb-1" style={{ color: '#0033A0' }}>
              Which lesson are you logging?
            </h1>
            <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
              {new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>

            {myTcs.length === 0 ? (
              <div className="card text-center py-10">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  No class assignments found. Contact your school admin.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                {myTcs.map((tcs) => {
                  const cls = classStore.getById(tcs.classId);
                  const isSelected = tcs.id === selectedTcsId;
                  return (
                    <button
                      key={tcs.id}
                      onClick={() => setSelectedTcsId(tcs.id)}
                      className="w-full text-left p-4 rounded-2xl transition-all"
                      style={{
                        background: isSelected ? '#E8F0FE' : 'var(--card-bg)',
                        border: `2px solid ${isSelected ? '#0033A0' : 'var(--border)'}`,
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-base" style={{ color: '#0033A0' }}>
                            {tcs.subject}
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {cls ? `${cls.level}${cls.section} · ${cls.academicYear}` : tcs.classId}
                          </div>
                        </div>
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{
                            background: isSelected ? '#0033A0' : 'var(--border)',
                            color: 'white',
                          }}
                        >
                          {isSelected ? '✓' : ''}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Step 1: Attendance ───────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <h1 className="text-xl font-bold" style={{ color: '#0033A0' }}>Mark Attendance</h1>
              <span className="text-sm font-bold" style={{ color: '#008751' }}>
                {presentIds.size}/{students.length} present
              </span>
            </div>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
              Tap a circle to mark absent. Default is all present.
            </p>

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setPresentIds(new Set(students.map((s) => s.id)))}
                className="flex-1 py-2 rounded-xl text-xs font-bold"
                style={{ background: '#DCFCE7', color: '#008751', border: '1.5px solid #008751' }}
              >
                All Present
              </button>
              <button
                onClick={() => setPresentIds(new Set())}
                className="flex-1 py-2 rounded-xl text-xs font-bold"
                style={{ background: '#FEE2E2', color: '#E30613', border: '1.5px solid #E30613' }}
              >
                All Absent
              </button>
            </div>

            {/* 5-per-row circles */}
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
              {students.map((s) => {
                const isPresent = presentIds.has(s.id);
                const initials = s.name.split(' ').slice(0, 2).map((n) => n[0]).join('');
                return (
                  <button
                    key={s.id}
                    onClick={() => togglePresent(s.id)}
                    className="flex flex-col items-center gap-1"
                    title={s.name}
                  >
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold transition-all"
                      style={{
                        background: isPresent ? '#008751' : '#E30613',
                        color: 'white',
                        boxShadow: isPresent ? '0 0 0 2px #DCFCE7' : '0 0 0 2px #FEE2E2',
                      }}
                    >
                      {initials}
                    </div>
                    <span
                      className="text-xs text-center leading-tight"
                      style={{ color: 'var(--text-muted)', maxWidth: 48, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {s.name.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>

            {presentIds.size === 0 && (
              <p className="text-xs mt-4 text-center" style={{ color: '#E30613' }}>
                At least one student must be present
              </p>
            )}
          </div>
        )}

        {/* ── Step 2: Topics ───────────────────────────────────────────── */}
        {step === 2 && (
          <div>
            <h1 className="text-xl font-bold mb-1" style={{ color: '#0033A0' }}>Topics Covered</h1>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
              Select up to 3 topics. ⚡ = high WAEC weight.
            </p>

            <div className="flex flex-wrap gap-2 mb-5">
              {topics.map((t) => {
                const isSelected = selectedTopicIds.includes(t.id);
                const isWaec = t.waecWeight >= 7;
                const canSelect = isSelected || selectedTopicIds.length < 3;
                return (
                  <button
                    key={t.id}
                    onClick={() => canSelect && toggleTopic(t.id)}
                    className="px-3 py-2 rounded-full text-xs font-semibold transition-all flex items-center gap-1"
                    style={{
                      background: isSelected ? '#0033A0' : 'var(--card-bg)',
                      color: isSelected ? 'white' : 'var(--foreground)',
                      border: `1.5px solid ${isSelected ? '#0033A0' : isWaec ? '#FFCC00' : 'var(--border)'}`,
                      opacity: !canSelect && !isSelected ? 0.4 : 1,
                    }}
                  >
                    {isWaec && <span>⚡</span>}
                    {t.topic}
                    {t.subTopic && <span style={{ opacity: 0.7 }}> · {t.subTopic}</span>}
                  </button>
                );
              })}
              {topics.length === 0 && (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  No topics found for {selectedTcs?.subject}
                </p>
              )}
            </div>

            {selectedTopicIds.length > 0 && (
              <div className="mb-4 p-3 rounded-xl" style={{ background: '#E8F0FE' }}>
                <p className="text-xs font-semibold mb-1" style={{ color: '#0033A0' }}>Selected ({selectedTopicIds.length}/3):</p>
                {selectedTopicIds.map((tid) => {
                  const t = topics.find((x) => x.id === tid);
                  return t ? (
                    <div key={tid} className="text-xs" style={{ color: '#0033A0' }}>
                      • {t.topic} {t.waecWeight >= 7 && '⚡'}
                    </div>
                  ) : null;
                })}
              </div>
            )}

            <div>
              <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-muted)' }}>
                Notes (optional · {notes.length}/200)
              </label>
              <textarea
                className="w-full rounded-xl p-3 text-sm resize-none"
                style={{ border: '1.5px solid var(--border)', background: 'var(--card-bg)', minHeight: 80 }}
                maxLength={200}
                placeholder="Any observations about today's lesson..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* ── Step 3: Score + Traits ───────────────────────────────────── */}
        {step === 3 && (
          <div>
            <h1 className="text-xl font-bold mb-4" style={{ color: '#0033A0' }}>Class Performance</h1>

            {/* Score slider */}
            <div className="card mb-4">
              <div className="flex items-end justify-between mb-2">
                <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Class Average Score</span>
                <span className="text-3xl font-black" style={{ color: scoreColor(classScore) }}>
                  {classScore}%
                </span>
              </div>

              {/* Colour-zone background bar */}
              <div className="relative h-3 rounded-full mb-3 overflow-hidden" style={{ background: 'var(--border)' }}>
                <div className="absolute inset-0 flex">
                  <div style={{ width: '55%', background: '#FEE2E2' }} />
                  <div style={{ width: '20%', background: '#FEF9C3' }} />
                  <div style={{ flex: 1,        background: '#DCFCE7' }} />
                </div>
                <div
                  className="absolute top-0 bottom-0 w-4 h-4 rounded-full border-2 border-white shadow"
                  style={{
                    left: `calc(${classScore}% - 8px)`,
                    background: scoreColor(classScore),
                    top: '-2px',
                  }}
                />
              </div>

              <input
                type="range"
                min={0} max={100}
                value={classScore}
                onChange={(e) => setClassScore(Number(e.target.value))}
                className="w-full mb-2"
                style={{ accentColor: scoreColor(classScore) }}
              />

              <div className="flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                <span>0 — Poor</span>
                <span style={{ color: scoreColor(classScore), fontWeight: 700 }}>
                  {scoreLabel(classScore)}
                </span>
                <span>100 — Excellent</span>
              </div>
            </div>

            {/* Behavioural traits */}
            <div className="card">
              <h3 className="text-sm font-bold mb-4" style={{ color: '#0033A0' }}>Behavioural Traits</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {Object.values(BehavioralTrait).map((trait) => (
                  <div key={trait}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                        {BEHAVIORAL_TRAIT_LABELS[trait]}
                      </span>
                      <span className="text-xs font-bold" style={{ color: TRAIT_COLORS[traits[trait]] }}>
                        {traits[trait]}/5
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((val) => {
                        const isActive = traits[trait] >= val;
                        return (
                          <button
                            key={val}
                            onClick={() => setTrait(trait, val)}
                            className="flex-1 h-9 rounded-lg text-xs font-bold transition-all"
                            style={{
                              background: isActive ? TRAIT_COLORS[traits[trait]] : 'var(--background)',
                              color: isActive ? 'white' : 'var(--text-muted)',
                              border: `1.5px solid ${isActive ? TRAIT_COLORS[traits[trait]] : 'var(--border)'}`,
                            }}
                          >
                            {val}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 4: Review & Submit ──────────────────────────────────── */}
        {step === 4 && (
          <div>
            <h1 className="text-xl font-bold mb-1" style={{ color: '#0033A0' }}>Review & Submit</h1>
            <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
              Confirm the details below before submitting.
            </p>

            <div className="card mb-4">
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                    <td className="py-2 pr-4 font-semibold" style={{ color: 'var(--text-muted)', width: '40%' }}>Class</td>
                    <td className="py-2 font-bold" style={{ color: '#0033A0' }}>
                      {selectedClass?.level}{selectedClass?.section} — {selectedTcs?.subject}
                    </td>
                  </tr>
                  <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                    <td className="py-2 pr-4 font-semibold" style={{ color: 'var(--text-muted)' }}>Attendance</td>
                    <td className="py-2">
                      <span style={{ color: '#008751', fontWeight: 700 }}>{presentIds.size} present</span>
                      {' '}
                      <span style={{ color: 'var(--text-muted)' }}>/ {students.length} total</span>
                    </td>
                  </tr>
                  <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                    <td className="py-2 pr-4 font-semibold" style={{ color: 'var(--text-muted)' }}>Topics</td>
                    <td className="py-2 text-xs" style={{ color: 'var(--foreground)' }}>
                      {selectedTopicIds.map((tid) => {
                        const t = topics.find((x) => x.id === tid);
                        return t ? <div key={tid}>• {t.topic} {t.waecWeight >= 7 && '⚡'}</div> : null;
                      })}
                    </td>
                  </tr>
                  <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                    <td className="py-2 pr-4 font-semibold" style={{ color: 'var(--text-muted)' }}>Class Score</td>
                    <td className="py-2 font-black text-lg" style={{ color: scoreColor(classScore) }}>
                      {classScore}%
                    </td>
                  </tr>
                  {Object.values(BehavioralTrait).map((trait) => (
                    <tr key={trait} className="border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                      <td className="py-1.5 pr-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                        {BEHAVIORAL_TRAIT_LABELS[trait].split(' ')[0]}
                      </td>
                      <td className="py-1.5">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((v) => (
                            <div
                              key={v}
                              className="w-4 h-4 rounded-sm"
                              style={{
                                background: traits[trait] >= v ? TRAIT_COLORS[traits[trait]] : 'var(--border)',
                              }}
                            />
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {notes && (
                    <tr>
                      <td className="pt-2 pr-4 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Notes</td>
                      <td className="pt-2 text-xs" style={{ color: 'var(--foreground)' }}>{notes}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-4 rounded-2xl font-black text-base text-white transition-all"
              style={{
                background: submitting ? '#6B7280' : '#008751',
                boxShadow: submitting ? 'none' : '0 4px 14px rgba(0,135,81,0.4)',
              }}
            >
              {submitting ? 'Saving...' : '✓ Submit Diary Entry'}
            </button>
          </div>
        )}
      </main>

      {/* Fixed bottom nav */}
      {step < 4 && (
        <div
          className="fixed bottom-0 left-0 right-0 px-4 py-4"
          style={{ background: 'var(--background)', borderTop: '1px solid var(--border)' }}
        >
          <div className="max-w-2xl md:max-w-3xl mx-auto">
            <button
              onClick={() => {
                if (step === 3 || canProceed()) setStep(step + 1);
              }}
              disabled={!canProceed()}
              className="w-full py-4 rounded-2xl font-bold text-white text-base transition-all"
              style={{
                background: canProceed() ? '#0033A0' : '#9CA3AF',
                boxShadow: canProceed() ? '0 4px 14px rgba(0,51,160,0.3)' : 'none',
              }}
            >
              {step === 3 ? 'Review →' : 'Continue →'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
