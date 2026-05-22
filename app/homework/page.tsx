'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Role } from '@/lib/types';
import type { HomeworkAssignment, HomeworkSubmission, QuizQuestion } from '@/lib/types';
import {
  tcsStore, classStore, topicStore, homeworkStore, homeworkSubStore,
  quizQuestionStore, studentStore, userStore,
} from '@/lib/storage';
import Navbar from '@/components/Navbar';

const DIFFICULTY_COLOR = { easy: '#008751', medium: '#FFCC00', hard: '#E30613' };
const DEADLINE_LABEL = { tonight: 'Due Tonight', tomorrow: 'Due Tomorrow', this_week: 'Due This Week' };

export default function HomeworkPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.role === Role.DISTRICT || user.role === Role.MINISTRY) router.replace('/dashboard');
  }, [user, isLoading, router]);

  if (isLoading || !user) return null;
  if (user.role === Role.STUDENT) return <StudentView user={user} />;
  return <TeacherView user={user} />;
}

// ── TEACHER VIEW ──────────────────────────────────────────────────────────────

function TeacherView({ user }: { user: { id: string; name: string; schoolId?: string } }) {
  const [assignments, setAssignments] = useState<HomeworkAssignment[]>([]);
  const [showForm, setShowForm]       = useState(false);

  // form state
  const [tcsId, setTcsId]         = useState('');
  const [topicId, setTopicId]     = useState('');
  const [difficulty, setDifficulty] = useState<'easy'|'medium'|'hard'>('medium');
  const [deadline, setDeadline]   = useState<'tonight'|'tomorrow'|'this_week'>('tomorrow');
  const [qCount, setQCount]       = useState(5);

  const tcsList = tcsStore.getByTeacher(user.id);
  const selectedTcs = tcsList.find((t) => t.id === tcsId);
  const topics = selectedTcs
    ? topicStore.getAll().filter((t) => t.subject === selectedTcs.subject)
    : [];

  useEffect(() => {
    setAssignments(homeworkStore.getByTeacher(user.id));
  }, [user.id]);

  function handleAssign() {
    if (!selectedTcs || !topicId) return;
    const pool = quizQuestionStore.getByTopic(topicId);
    if (pool.length === 0) return;
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const picked   = shuffled.slice(0, Math.min(qCount, pool.length));
    const deadlineDate = new Date();
    if (deadline === 'tonight') { /* same day */ }
    else if (deadline === 'tomorrow') deadlineDate.setDate(deadlineDate.getDate() + 1);
    else deadlineDate.setDate(deadlineDate.getDate() + 7);

    const hw: HomeworkAssignment = {
      id: `hw-${Date.now()}`,
      teacherId: user.id,
      classId: selectedTcs.classId,
      subject: selectedTcs.subject,
      topicId,
      difficulty,
      questionCount: picked.length,
      questionIds: picked.map((q) => q.id),
      deadline,
      deadlineDate: deadlineDate.toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
      status: 'active',
    };
    homeworkStore.save(hw);
    setAssignments(homeworkStore.getByTeacher(user.id));
    setShowForm(false);
    setTcsId(''); setTopicId('');
  }

  const activeHw  = assignments.filter((h) => h.status === 'active');
  const closedHw  = assignments.filter((h) => h.status === 'closed');

  return (
    <div className="min-h-screen" style={{ background: '#F5F7FA' }}>
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-5 pb-10">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-xs font-bold" style={{ color: '#9CA3AF' }}>Teacher</p>
            <h1 className="text-xl font-black" style={{ color: '#0033A0' }}>Homework</h1>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 rounded-xl text-sm font-bold text-white"
            style={{ background: '#0033A0' }}
          >
            + Assign
          </button>
        </div>

        {/* Assign form */}
        {showForm && (
          <div className="rounded-2xl p-4 mb-5" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
            <h2 className="font-bold text-sm mb-3" style={{ color: '#0033A0' }}>New Homework Assignment</h2>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: '#374151' }}>Class & Subject</label>
                <select className="w-full rounded-xl px-3 py-2 text-sm" style={{ border: '1.5px solid #E5E7EB' }}
                  value={tcsId} onChange={(e) => { setTcsId(e.target.value); setTopicId(''); }}>
                  <option value="">Select class…</option>
                  {tcsList.map((t) => {
                    const cls = classStore.getById(t.classId);
                    return <option key={t.id} value={t.id}>{cls?.level}{cls?.section} — {t.subject}</option>;
                  })}
                </select>
              </div>

              {topics.length > 0 && (
                <div>
                  <label className="text-xs font-semibold block mb-1" style={{ color: '#374151' }}>Topic</label>
                  <select className="w-full rounded-xl px-3 py-2 text-sm" style={{ border: '1.5px solid #E5E7EB' }}
                    value={topicId} onChange={(e) => setTopicId(e.target.value)}>
                    <option value="">Select topic…</option>
                    {topics.map((t) => <option key={t.id} value={t.id}>{t.topic}</option>)}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold block mb-1" style={{ color: '#374151' }}>Difficulty</label>
                  <select className="w-full rounded-xl px-3 py-2 text-sm" style={{ border: '1.5px solid #E5E7EB' }}
                    value={difficulty} onChange={(e) => setDifficulty(e.target.value as 'easy'|'medium'|'hard')}>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1" style={{ color: '#374151' }}>Questions</label>
                  <select className="w-full rounded-xl px-3 py-2 text-sm" style={{ border: '1.5px solid #E5E7EB' }}
                    value={qCount} onChange={(e) => setQCount(Number(e.target.value))}>
                    {[3,5,8,10].map((n) => <option key={n} value={n}>{n} Qs</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1" style={{ color: '#374151' }}>Deadline</label>
                  <select className="w-full rounded-xl px-3 py-2 text-sm" style={{ border: '1.5px solid #E5E7EB' }}
                    value={deadline} onChange={(e) => setDeadline(e.target.value as 'tonight'|'tomorrow'|'this_week')}>
                    <option value="tonight">Tonight</option>
                    <option value="tomorrow">Tomorrow</option>
                    <option value="this_week">This Week</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleAssign}
                disabled={!tcsId || !topicId}
                className="py-3 rounded-xl font-bold text-sm text-white"
                style={{ background: tcsId && topicId ? '#008751' : '#D1D5DB' }}
              >
                Assign Homework →
              </button>
            </div>
          </div>
        )}

        {/* Active */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
          <h2 className="font-bold text-sm mb-3" style={{ color: '#0033A0' }}>Active ({activeHw.length})</h2>
          {activeHw.length === 0
            ? <p className="text-sm py-4 text-center" style={{ color: '#9CA3AF' }}>No active homework — assign one above.</p>
            : <div className="flex flex-col gap-3">
                {activeHw.map((hw) => <HwTeacherCard key={hw.id} hw={hw} />)}
              </div>
          }
        </div>

        {/* Closed */}
        {closedHw.length > 0 && (
          <div className="rounded-2xl p-4" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
            <h2 className="font-bold text-sm mb-3" style={{ color: '#9CA3AF' }}>Closed ({closedHw.length})</h2>
            <div className="flex flex-col gap-3">
              {closedHw.map((hw) => <HwTeacherCard key={hw.id} hw={hw} />)}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function HwTeacherCard({ hw }: { hw: HomeworkAssignment }) {
  const cls   = classStore.getById(hw.classId);
  const topic = topicStore.getAll().find((t) => t.id === hw.topicId);
  const subs  = homeworkSubStore.getByHomework(hw.id);
  const studs = studentStore.getBySchool(cls?.schoolId ?? '').filter((s) => s.classId === hw.classId);
  const avgScore = subs.length > 0 ? Math.round(subs.reduce((a, s) => a + s.score, 0) / subs.length) : null;

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: '#F9FAFB', border: '1.5px solid #E5E7EB' }}>
      <div className="w-2 h-2 rounded-full mt-1.5 shrink-0"
        style={{ background: hw.status === 'active' ? '#008751' : '#9CA3AF' }} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm" style={{ color: '#111827' }}>{hw.subject} — {topic?.topic ?? hw.topicId}</p>
        <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>
          {cls?.level}{cls?.section} · {hw.questionCount} Qs ·{' '}
          <span style={{ color: DIFFICULTY_COLOR[hw.difficulty] }}>{hw.difficulty}</span>
        </p>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-xs px-2 py-0.5 rounded-full font-bold"
            style={{ background: '#EFF6FF', color: '#0033A0' }}>
            {DEADLINE_LABEL[hw.deadline]}
          </span>
          <span className="text-xs" style={{ color: '#9CA3AF' }}>
            {subs.length}/{studs.length} submitted
            {avgScore !== null && <> · avg {avgScore}%</>}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── STUDENT VIEW ──────────────────────────────────────────────────────────────

function StudentView({ user }: { user: { id: string; studentId?: string } }) {
  const [pending,   setPending]   = useState<HomeworkAssignment[]>([]);
  const [completed, setCompleted] = useState<HomeworkAssignment[]>([]);
  const [quizHw,    setQuizHw]    = useState<HomeworkAssignment | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers,   setAnswers]   = useState<number[]>([]);
  const [qIdx,      setQIdx]      = useState(0);
  const [done,      setDone]      = useState(false);
  const [tab,       setTab]       = useState<'pending'|'completed'>('pending');

  const student = studentStore.getById(user.studentId ?? '');

  useEffect(() => {
    if (!student) return;
    const today = new Date().toISOString().slice(0, 10);
    const all   = homeworkStore.getByClass(student.classId).filter((h) => h.deadlineDate >= today);
    const submitted = homeworkSubStore.getByStudent(student.id);
    const submittedIds = new Set(submitted.map((s) => s.homeworkId));
    setPending(all.filter((h) => !submittedIds.has(h.id)));
    setCompleted(all.filter((h) => submittedIds.has(h.id)));
  }, [student]);

  function startHw(hw: HomeworkAssignment) {
    const qs = hw.questionIds.map((id) => quizQuestionStore.getById(id)).filter(Boolean) as QuizQuestion[];
    setQuizHw(hw);
    setQuestions(qs);
    setAnswers(new Array(qs.length).fill(-1));
    setQIdx(0);
    setDone(false);
  }

  function submitHw() {
    if (!quizHw || !student) return;
    const correctCount = answers.filter((a, i) => a === questions[i].correctIndex).length;
    const score = Math.round((correctCount / questions.length) * 100);
    const sub: HomeworkSubmission = {
      id: `sub-${Date.now()}`,
      homeworkId: quizHw.id,
      studentId: student.id,
      answers: questions.map((q, i) => ({ questionId: q.id, chosen: answers[i], correct: answers[i] === q.correctIndex })),
      score,
      submittedAt: new Date().toISOString(),
    };
    homeworkSubStore.save(sub);
    setDone(true);

    // refresh lists
    const today = new Date().toISOString().slice(0, 10);
    const all   = homeworkStore.getByClass(student.classId).filter((h) => h.deadlineDate >= today);
    const submitted = homeworkSubStore.getByStudent(student.id);
    const submittedIds = new Set(submitted.map((s) => s.homeworkId));
    setPending(all.filter((h) => !submittedIds.has(h.id)));
    setCompleted(all.filter((h) => submittedIds.has(h.id)));
  }

  // Quiz mode
  if (quizHw && questions.length > 0) {
    const q = questions[qIdx];
    const score = done
      ? Math.round((answers.filter((a, i) => a === questions[i].correctIndex).length / questions.length) * 100)
      : 0;

    if (done) {
      return (
        <div className="min-h-screen" style={{ background: '#F5F7FA' }}>
          <Navbar />
          <div className="max-w-lg mx-auto px-4 py-10 text-center">
            <div className="text-5xl mb-4">{score >= 75 ? '🎉' : score >= 50 ? '👍' : '📚'}</div>
            <h2 className="text-2xl font-black mb-1" style={{ color: '#0033A0' }}>{score}%</h2>
            <p className="text-sm mb-6" style={{ color: '#6B7280' }}>
              {answers.filter((a, i) => a === questions[i].correctIndex).length}/{questions.length} correct
            </p>
            <div className="flex flex-col gap-2 mb-6 text-left">
              {questions.map((q, i) => {
                const correct = answers[i] === q.correctIndex;
                return (
                  <div key={q.id} className="p-3 rounded-xl" style={{ background: correct ? '#DCFCE7' : '#FEE2E2', border: `1.5px solid ${correct ? '#86EFAC' : '#FCA5A5'}` }}>
                    <p className="text-xs font-bold mb-1" style={{ color: correct ? '#008751' : '#E30613' }}>
                      {correct ? '✓' : '✗'} {q.question}
                    </p>
                    <p className="text-xs" style={{ color: '#374151' }}>
                      {q.explanation}
                    </p>
                  </div>
                );
              })}
            </div>
            <button onClick={() => setQuizHw(null)} className="px-6 py-3 rounded-xl font-bold text-white" style={{ background: '#0033A0' }}>
              Back to Homework
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen" style={{ background: '#F5F7FA' }}>
        <Navbar />
        <div className="max-w-lg mx-auto px-4 py-5">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setQuizHw(null)} className="text-sm" style={{ color: '#0033A0' }}>← Back</button>
            <span className="text-sm font-bold" style={{ color: '#9CA3AF' }}>{qIdx + 1} / {questions.length}</span>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 rounded-full mb-5 overflow-hidden" style={{ background: '#E5E7EB' }}>
            <div className="h-1.5 rounded-full transition-all" style={{ width: `${((qIdx) / questions.length) * 100}%`, background: '#0033A0' }} />
          </div>

          <div className="rounded-2xl p-5 mb-4" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
            <p className="text-xs font-bold mb-3" style={{ color: '#9CA3AF' }}>{quizHw.subject}</p>
            <p className="font-bold text-base mb-5" style={{ color: '#111827' }}>{q.question}</p>
            <div className="flex flex-col gap-2">
              {q.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => setAnswers((prev) => { const n = [...prev]; n[qIdx] = i; return n; })}
                  className="flex items-center gap-3 p-3 rounded-xl text-left w-full"
                  style={{
                    background: answers[qIdx] === i ? '#EFF6FF' : '#F9FAFB',
                    border: `1.5px solid ${answers[qIdx] === i ? '#0033A0' : '#E5E7EB'}`,
                  }}
                >
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: answers[qIdx] === i ? '#0033A0' : '#E5E7EB', color: answers[qIdx] === i ? 'white' : '#6B7280' }}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="text-sm" style={{ color: '#111827' }}>{opt}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            {qIdx > 0 && (
              <button onClick={() => setQIdx(qIdx - 1)} className="flex-1 py-3 rounded-xl font-bold text-sm" style={{ background: 'white', border: '1.5px solid #E5E7EB', color: '#374151' }}>
                ← Prev
              </button>
            )}
            {qIdx < questions.length - 1 ? (
              <button
                onClick={() => setQIdx(qIdx + 1)}
                disabled={answers[qIdx] === -1}
                className="flex-1 py-3 rounded-xl font-bold text-sm text-white"
                style={{ background: answers[qIdx] !== -1 ? '#0033A0' : '#D1D5DB' }}
              >
                Next →
              </button>
            ) : (
              <button
                onClick={submitHw}
                disabled={answers.includes(-1)}
                className="flex-1 py-3 rounded-xl font-bold text-sm text-white"
                style={{ background: !answers.includes(-1) ? '#008751' : '#D1D5DB' }}
              >
                Submit ✓
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#F5F7FA' }}>
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-5 pb-10">
        <div className="mb-5">
          <p className="text-xs font-bold" style={{ color: '#9CA3AF' }}>Student</p>
          <h1 className="text-xl font-black" style={{ color: '#0033A0' }}>Homework</h1>
        </div>

        {/* Tab toggle */}
        <div className="flex gap-1 mb-4 p-1 rounded-xl" style={{ background: '#E5E7EB' }}>
          {(['pending', 'completed'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className="flex-1 py-1.5 rounded-lg text-sm font-semibold"
              style={{ background: tab === t ? 'white' : 'transparent', color: tab === t ? '#0033A0' : '#6B7280' }}>
              {t === 'pending' ? `Pending (${pending.length})` : `Done (${completed.length})`}
            </button>
          ))}
        </div>

        {tab === 'pending' && (
          <div className="flex flex-col gap-3">
            {pending.length === 0
              ? <p className="text-sm text-center py-8" style={{ color: '#9CA3AF' }}>No pending homework. 🎉</p>
              : pending.map((hw) => {
                  const topic = topicStore.getAll().find((t) => t.id === hw.topicId);
                  const daysLeft = Math.ceil((new Date(hw.deadlineDate).getTime() - Date.now()) / 86400000);
                  return (
                    <div key={hw.id} className="rounded-2xl p-4" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm" style={{ color: '#111827' }}>{hw.subject}</p>
                          <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>{topic?.topic ?? hw.topicId}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                              style={{ background: DIFFICULTY_COLOR[hw.difficulty] + '20', color: DIFFICULTY_COLOR[hw.difficulty] }}>
                              {hw.difficulty}
                            </span>
                            <span className="text-xs" style={{ color: '#9CA3AF' }}>{hw.questionCount} questions</span>
                            <span className="text-xs font-bold" style={{ color: daysLeft <= 1 ? '#E30613' : '#9CA3AF' }}>
                              {daysLeft <= 0 ? 'Due today!' : `${daysLeft}d left`}
                            </span>
                          </div>
                        </div>
                        <button onClick={() => startHw(hw)} className="px-4 py-2 rounded-xl text-sm font-bold text-white shrink-0"
                          style={{ background: '#0033A0' }}>
                          Start →
                        </button>
                      </div>
                    </div>
                  );
                })
            }
          </div>
        )}

        {tab === 'completed' && (
          <div className="flex flex-col gap-3">
            {completed.length === 0
              ? <p className="text-sm text-center py-8" style={{ color: '#9CA3AF' }}>No completed homework yet.</p>
              : completed.map((hw) => {
                  const topic = topicStore.getAll().find((t) => t.id === hw.topicId);
                  const sub   = homeworkSubStore.getByStudent(student?.id ?? '').find((s) => s.homeworkId === hw.id);
                  const score = sub?.score ?? 0;
                  const col   = score >= 75 ? '#008751' : score >= 50 ? '#FFCC00' : '#E30613';
                  return (
                    <div key={hw.id} className="flex items-center gap-3 p-4 rounded-2xl"
                      style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg shrink-0"
                        style={{ background: col + '20', color: col }}>
                        {score}%
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm" style={{ color: '#111827' }}>{hw.subject}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>{topic?.topic ?? hw.topicId}</p>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: '#DCFCE7', color: '#008751' }}>
                        Submitted ✓
                      </span>
                    </div>
                  );
                })
            }
          </div>
        )}
      </main>
    </div>
  );
}
