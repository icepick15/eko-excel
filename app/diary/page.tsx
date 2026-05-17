'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Role, BehavioralTrait, BEHAVIORAL_TRAIT_LABELS } from '@/lib/types';
import type { Student, TopicSegment, DiaryEntry } from '@/lib/types';
import { studentStore, topicStore, diaryStore } from '@/lib/storage';
import { recomputeStudent } from '@/lib/calculations';
import Navbar from '@/components/Navbar';

const TRAIT_OPTIONS: Array<'high' | 'medium' | 'low'> = ['high', 'medium', 'low'];
const TRAIT_COLORS: Record<string, string> = {
  high: 'var(--lagos-green)',
  medium: 'var(--lagos-gold)',
  low: 'var(--lagos-red)',
};

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export default function DiaryEntryPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [students, setStudents] = useState<Student[]>([]);
  const [topics, setTopics] = useState<TopicSegment[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);

  // Form state
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [classScore, setClassScore] = useState('');
  const [attendance, setAttendance] = useState<Set<string>>(new Set());
  const [traits, setTraits] = useState<Record<BehavioralTrait, 'high' | 'medium' | 'low'>>({
    [BehavioralTrait.ENGAGEMENT]: 'medium',
    [BehavioralTrait.PERSISTENCE]: 'medium',
    [BehavioralTrait.FOCUS]: 'medium',
    [BehavioralTrait.COLLABORATION]: 'medium',
    [BehavioralTrait.RESILIENCE]: 'medium',
  });

  const [errors, setErrors] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.role !== Role.TEACHER) { router.replace('/dashboard'); return; }

    const myStudents = studentStore.getBySchool(user.schoolId!);
    setStudents(myStudents);
    // Default: all present
    setAttendance(new Set(myStudents.map((s) => s.id)));

    const allTopics = topicStore.getAll();
    setTopics(allTopics);
    const uniqueSubjects = [...new Set(allTopics.map((t) => t.subject))].sort();
    setSubjects(uniqueSubjects);
    if (uniqueSubjects[0]) setSelectedSubject(uniqueSubjects[0]);
  }, [user, isLoading, router]);

  const filteredTopics = topics.filter((t) => t.subject === selectedSubject);

  function toggleAttendance(id: string) {
    setAttendance((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function validate(): string[] {
    const errs: string[] = [];
    if (!selectedTopicId) errs.push('Select a topic');
    const score = parseInt(classScore);
    if (isNaN(score) || score < 0 || score > 100) errs.push('Class score must be 0–100');
    if (attendance.size === 0) errs.push('At least one student must be marked present');
    return errs;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (errs.length > 0) return;

    setLoading(true);
    const entry: DiaryEntry = {
      id: uid(),
      idempotencyKey: `${user!.id}-${selectedTopicId}-${Date.now()}`,
      studentId: students[0].id, // diary is per-class; we record class-level
      teacherId: user!.id,
      topicId: selectedTopicId,
      classScore: parseInt(classScore),
      attendance: Array.from(attendance),
      behavioralTraits: traits,
      createdAt: new Date().toISOString(),
    };

    // Save one entry per present student
    const presentStudents = students.filter((s) => attendance.has(s.id));
    presentStudents.forEach((student) => {
      diaryStore.save({
        ...entry,
        id: uid(),
        idempotencyKey: `${user!.id}-${student.id}-${selectedTopicId}-${Date.now()}`,
        studentId: student.id,
      });
      recomputeStudent(student.id);
    });

    setLoading(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--background)' }}>
        <Navbar />
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <div
            className="w-20 h-20 rounded-full mx-auto flex items-center justify-center text-3xl mb-6 shadow-lg"
            style={{ background: 'var(--lagos-green)', color: 'white' }}
          >
            ✓
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--lagos-blue)' }}>Diary Submitted!</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            Student metrics have been updated. WAEC readiness recalculated.
          </p>
          <div className="flex flex-col gap-3">
            <button className="btn-primary w-full" onClick={() => setSubmitted(false)}>
              + Another Entry
            </button>
            <button
              className="w-full py-3 rounded-xl font-semibold text-sm"
              style={{ background: 'var(--lagos-blue-light)', color: 'var(--lagos-blue)' }}
              onClick={() => router.push('/dashboard')}
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <button
              onClick={() => router.back()}
              className="text-xs font-medium"
              style={{ color: 'var(--text-muted)' }}
            >
              ← Back
            </button>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--lagos-blue)' }}>New Diary Entry</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Should take less than 2 minutes &nbsp;·&nbsp;{' '}
            {new Date().toLocaleDateString('en-NG', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* 1. Subject + Topic */}
          <div className="card">
            <h3 className="font-bold text-sm mb-3" style={{ color: 'var(--lagos-blue)' }}>1. Lesson Topic</h3>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--text-muted)' }}>Subject</label>
                <select
                  className="input"
                  value={selectedSubject}
                  onChange={(e) => { setSelectedSubject(e.target.value); setSelectedTopicId(''); }}
                >
                  {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--text-muted)' }}>Topic Covered</label>
                <select
                  className="input"
                  value={selectedTopicId}
                  onChange={(e) => setSelectedTopicId(e.target.value)}
                >
                  <option value="">Select topic...</option>
                  {filteredTopics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.topic} (WAEC weight: {(t.waecFrequency * 100).toFixed(0)}%)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 2. Class Score */}
          <div className="card">
            <h3 className="font-bold text-sm mb-3" style={{ color: 'var(--lagos-blue)' }}>2. Class Performance Score</h3>
            <div>
              <label className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Class Average Score (0 – 100)
              </label>
              <input
                className="input text-2xl font-bold text-center"
                type="number"
                min="0"
                max="100"
                placeholder="e.g. 72"
                value={classScore}
                onChange={(e) => setClassScore(e.target.value)}
              />
              {classScore && (
                <div
                  className="mt-2 text-center text-sm font-semibold"
                  style={{
                    color: parseInt(classScore) >= 75 ? 'var(--lagos-green)'
                      : parseInt(classScore) >= 55 ? 'var(--lagos-gold)'
                      : 'var(--lagos-red)',
                  }}
                >
                  {parseInt(classScore) >= 75 ? '✓ Good performance' : parseInt(classScore) >= 55 ? '⚠ Needs improvement' : '✗ Below threshold'}
                </div>
              )}
            </div>
          </div>

          {/* 3. Attendance */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm" style={{ color: 'var(--lagos-blue)' }}>
                3. Attendance ({attendance.size}/{students.length})
              </h3>
              <div className="flex gap-2">
                <button type="button" className="text-xs font-medium px-2 py-1 rounded"
                  style={{ background: 'var(--lagos-green-light)', color: 'var(--lagos-green)' }}
                  onClick={() => setAttendance(new Set(students.map((s) => s.id)))}>
                  All Present
                </button>
                <button type="button" className="text-xs font-medium px-2 py-1 rounded"
                  style={{ background: '#FEE2E2', color: 'var(--lagos-red)' }}
                  onClick={() => setAttendance(new Set())}>
                  All Absent
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {students.map((student) => {
                const isPresent = attendance.has(student.id);
                return (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => toggleAttendance(student.id)}
                    className="flex items-center gap-2 p-2.5 rounded-xl text-left transition-all"
                    style={{
                      background: isPresent ? 'var(--lagos-green-light)' : 'var(--background)',
                      border: `1.5px solid ${isPresent ? 'var(--lagos-green)' : 'var(--border)'}`,
                    }}
                  >
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: isPresent ? 'var(--lagos-green)' : 'var(--border)', color: 'white' }}
                    >
                      {isPresent ? '✓' : ''}
                    </div>
                    <span className="text-xs font-medium truncate">{student.name.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Behavioral Traits */}
          <div className="card">
            <h3 className="font-bold text-sm mb-3" style={{ color: 'var(--lagos-blue)' }}>4. Behavioral Traits (All Mandatory)</h3>
            <div className="flex flex-col gap-4">
              {Object.values(BehavioralTrait).map((trait) => (
                <div key={trait}>
                  <label className="text-xs font-semibold block mb-2" style={{ color: 'var(--foreground)' }}>
                    {BEHAVIORAL_TRAIT_LABELS[trait]}
                  </label>
                  <div className="flex gap-2">
                    {TRAIT_OPTIONS.map((option) => {
                      const isSelected = traits[trait] === option;
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setTraits((prev) => ({ ...prev, [trait]: option }))}
                          className="flex-1 py-2 rounded-lg text-xs font-bold capitalize transition-all"
                          style={{
                            background: isSelected ? TRAIT_COLORS[option] : 'var(--background)',
                            color: isSelected ? 'white' : 'var(--text-muted)',
                            border: `1.5px solid ${isSelected ? TRAIT_COLORS[option] : 'var(--border)'}`,
                          }}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="rounded-xl p-4" style={{ background: '#FEE2E2', border: '1px solid #FCA5A5' }}>
              {errors.map((e, i) => (
                <div key={i} className="text-sm text-red-700 flex items-center gap-2">
                  <span>✗</span> {e}
                </div>
              ))}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="btn-success w-full py-4 text-base"
            style={{ borderRadius: '12px' }}
          >
            {loading ? 'Saving...' : '✓ Submit Diary Entry'}
          </button>
        </form>
      </main>
    </div>
  );
}
