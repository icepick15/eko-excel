'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Role } from '@/lib/types';
import type { QuizQuestion } from '@/lib/types';
import {
  quizQuestionStore, quizAttemptStore, topicStore,
  seenQuestionsStore, streakStore,
} from '@/lib/storage';
import { recomputeStudent } from '@/lib/calculations';
import Navbar from '@/components/Navbar';

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

const SECS_PER_Q = 30;
type Mode = 'normal' | 'timed' | 'waec';
type Difficulty = 'easy' | 'medium' | 'hard';

function QuizContent() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const topicId  = params.get('topicId')  ?? '';
  const subject  = params.get('subject')  ?? '';

  // ── Mode selection state ────────────────────────────────────────────
  const [mode, setMode] = useState<Mode | null>(null);

  // ── Quiz state ──────────────────────────────────────────────────────
  const [questions,   setQuestions]   = useState<QuizQuestion[]>([]);
  const [currentIdx,  setCurrentIdx]  = useState(0);
  const [selected,    setSelected]    = useState<number | null>(null);
  const [answers,     setAnswers]     = useState<Array<{ questionId: string; chosen: number; correct: boolean }>>([]);
  const [timeLeft,    setTimeLeft]    = useState(SECS_PER_Q);
  const [startTime,   setStartTime]   = useState(0);
  const [showResult,  setShowResult]  = useState(false);
  const [finalScore,  setFinalScore]  = useState(0);
  const [finalCorrect,setFinalCorrect]= useState(0);
  const [topicName,   setTopicName]   = useState('');
  const [totalTime,   setTotalTime]   = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Adaptive difficulty
  const [currentDifficulty, setCurrentDifficulty] = useState<Difficulty>('medium');

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.role !== Role.STUDENT) { router.replace('/login'); return; }
    const topic = topicStore.getById(topicId);
    setTopicName(topic?.topic ?? subject ?? 'Quiz');
  }, [user, isLoading, topicId, subject, router]);

  function loadQuestions(selectedMode: Mode) {
    if (!user?.studentId) return;

    const seen = seenQuestionsStore.get(user.studentId);

    let pool: QuizQuestion[] = [];
    if (selectedMode === 'waec') {
      pool = quizQuestionStore.getWaecOnly().filter((q) => !subject || q.subject === subject);
    } else if (topicId) {
      pool = quizQuestionStore.getByTopic(topicId);
      if (pool.length === 0) pool = quizQuestionStore.getBySubject(subject);
    } else {
      pool = quizQuestionStore.getBySubject(subject);
    }

    // Prioritise unseen
    const unseen = pool.filter((q) => !seen.includes(q.id));
    const source = unseen.length >= 5 ? unseen : pool;

    // Shuffle + take 5–10
    const shuffled = [...source].sort(() => Math.random() - 0.5).slice(0, 8);
    if (shuffled.length === 0) shuffled.push(...pool.slice(0, 5));

    setQuestions(shuffled);
    setCurrentIdx(0);
    setSelected(null);
    setAnswers([]);
    setShowResult(false);
    setStartTime(Date.now());
    setCurrentDifficulty('medium');

    if (selectedMode === 'timed') {
      setTimeLeft(SECS_PER_Q);
    }
  }

  // Start mode
  function startMode(m: Mode) {
    setMode(m);
    loadQuestions(m);
  }

  // Timer for timed mode
  useEffect(() => {
    if (mode !== 'timed' || questions.length === 0 || showResult || selected !== null) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          handleAutoAdvance();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  });

  function handleAutoAdvance() {
    // Treat as wrong if time runs out
    advanceQuestion(-1);
  }

  function handleSelect(idx: number) {
    if (selected !== null) return;
    if (mode === 'timed') clearInterval(timerRef.current!);
    setSelected(idx);
  }

  function advanceQuestion(chosenIdx: number) {
    if (!questions[currentIdx]) return;
    const q = questions[currentIdx];
    const correct = chosenIdx === q.correctIndex;

    const newAnswers = [...answers, { questionId: q.id, chosen: chosenIdx, correct }];
    setAnswers(newAnswers);

    // Adaptive difficulty: get harder on correct, easier on wrong
    if (correct && currentDifficulty === 'easy') setCurrentDifficulty('medium');
    else if (correct && currentDifficulty === 'medium') setCurrentDifficulty('hard');
    else if (!correct && currentDifficulty === 'hard') setCurrentDifficulty('medium');
    else if (!correct && currentDifficulty === 'medium') setCurrentDifficulty('easy');

    const isLast = currentIdx + 1 >= questions.length;
    if (isLast) {
      finishQuiz(newAnswers);
    } else {
      setCurrentIdx(currentIdx + 1);
      setSelected(null);
      if (mode === 'timed') setTimeLeft(SECS_PER_Q);
    }
  }

  function finishQuiz(finalAnswers: typeof answers) {
    const correctCount = finalAnswers.filter((a) => a.correct).length;
    const score = Math.round((correctCount / questions.length) * 100);
    const elapsed = Math.round((Date.now() - startTime) / 1000);

    setFinalCorrect(correctCount);
    setFinalScore(score);
    setTotalTime(elapsed);

    if (user?.studentId) {
      quizAttemptStore.save({
        id: uid(),
        studentId: user.studentId,
        topicId,
        subject,
        score,
        totalQuestions: questions.length,
        correctCount,
        timeTakenSeconds: elapsed,
        isTimedMode: mode === 'timed',
        completedAt: new Date().toISOString(),
        answers: finalAnswers,
        source: 'cbt',
      });

      // Mark seen
      seenQuestionsStore.add(user.studentId, questions.map((q) => q.id));

      // Update streak
      streakStore.update(user.studentId);

      // Recompute metrics
      recomputeStudent(user.studentId);
    }

    setShowResult(true);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0033A0' }}>
        <p className="text-white animate-pulse">Loading...</p>
      </div>
    );
  }

  // ── Mode selection screen ───────────────────────────────────────────
  if (!mode) {
    return (
      <div className="min-h-screen" style={{ background: '#F5F7FA' }}>
        <Navbar />
        <main className="max-w-md mx-auto px-4 py-8">
          <button onClick={() => router.back()} className="text-sm font-medium mb-6" style={{ color: '#0033A0' }}>
            ← Back
          </button>
          <h1 className="text-2xl font-black mb-1" style={{ color: '#0033A0' }}>Practice Quiz</h1>
          <p className="text-sm mb-6" style={{ color: '#6B7280' }}>
            {topicName} · {subject}
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => startMode('normal')}
              className="p-5 rounded-2xl text-left"
              style={{ background: '#EFF6FF', border: '1.5px solid #BFDBFE' }}
            >
              <p className="font-black text-base mb-0.5" style={{ color: '#0033A0' }}>📚 Normal Mode</p>
              <p className="text-sm" style={{ color: '#6B7280' }}>Answer at your own pace · adaptive difficulty · see explanations</p>
            </button>

            <button
              onClick={() => startMode('timed')}
              className="p-5 rounded-2xl text-left"
              style={{ background: '#FFF7ED', border: '1.5px solid #FDBA74' }}
            >
              <p className="font-black text-base mb-0.5" style={{ color: '#EA580C' }}>⏱ Timed Mode</p>
              <p className="text-sm" style={{ color: '#6B7280' }}>30 seconds per question · simulates exam pressure</p>
            </button>

            <button
              onClick={() => startMode('waec')}
              className="p-5 rounded-2xl text-left"
              style={{ background: '#F0FDF4', border: '1.5px solid #86EFAC' }}
            >
              <p className="font-black text-base mb-0.5" style={{ color: '#008751' }}>🏅 WAEC Past Questions</p>
              <p className="text-sm" style={{ color: '#6B7280' }}>Real WAEC questions from past papers · highest exam relevance</p>
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ── Loading questions ───────────────────────────────────────────────
  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0033A0' }}>
        <div className="text-white text-center">
          <p className="text-xl font-bold mb-2">Loading Questions...</p>
          <p className="text-sm opacity-60 animate-pulse">Preparing your quiz</p>
        </div>
      </div>
    );
  }

  // ── Results screen ──────────────────────────────────────────────────
  if (showResult) {
    const passed = finalScore >= 65;
    return (
      <div className="min-h-screen" style={{ background: '#F5F7FA' }}>
        <Navbar />
        <div className="max-w-md mx-auto px-4 py-8">
          <div className="text-center mb-6">
            <div
              className="w-24 h-24 rounded-full mx-auto flex items-center justify-center text-4xl mb-4"
              style={{ background: passed ? '#008751' : '#E30613', color: 'white' }}
            >
              {passed ? '🏆' : '💪'}
            </div>
            <p className="text-4xl font-black" style={{ color: passed ? '#008751' : '#E30613' }}>{finalScore}%</p>
            <p className="font-semibold mt-1" style={{ color: '#374151' }}>
              {passed ? 'Well done!' : 'Keep practising!'}
            </p>
            <p className="text-sm mt-0.5" style={{ color: '#9CA3AF' }}>
              {finalCorrect}/{questions.length} correct · {Math.floor(totalTime / 60)}m {totalTime % 60}s
            </p>
            {mode === 'waec' && <p className="text-xs mt-1 font-bold" style={{ color: '#008751' }}>🏅 WAEC Past Questions Mode</p>}
          </div>

          {/* Question review */}
          <div className="rounded-2xl p-4 mb-5" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
            <p className="text-xs font-bold mb-3 uppercase" style={{ color: '#6B7280' }}>Review</p>
            {questions.map((q, i) => {
              const ans = answers[i];
              const correct = ans?.correct ?? false;
              return (
                <div
                  key={q.id}
                  className="py-3"
                  style={{ borderBottom: i < questions.length - 1 ? '1px solid #F3F4F6' : 'none' }}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-base shrink-0">{correct ? '✅' : '❌'}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{ color: '#111827' }}>{q.stem}</p>
                      {!correct && (
                        <p className="text-xs mt-0.5 font-semibold" style={{ color: '#008751' }}>
                          ✓ {q.options[q.correctIndex]}
                        </p>
                      )}
                      {q.explanation && (
                        <p className="text-xs mt-1 italic" style={{ color: '#9CA3AF' }}>
                          {q.explanation}
                        </p>
                      )}
                      {q.waecYear && (
                        <span className="text-xs font-bold" style={{ color: '#0033A0' }}>
                          WAEC {q.waecYear}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => { setMode(null); setShowResult(false); setQuestions([]); }}
              className="w-full py-4 rounded-2xl font-bold text-white text-sm"
              style={{ background: '#0033A0' }}
            >
              Try Another Mode →
            </button>
            <button
              onClick={() => router.push('/student')}
              className="w-full py-3 rounded-2xl font-semibold text-sm"
              style={{ background: '#F3F4F6', color: '#374151' }}
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Question screen ─────────────────────────────────────────────────
  const currentQ = questions[currentIdx];
  const progress  = ((currentIdx) / questions.length) * 100;
  const diffColor = currentQ.difficulty === 'easy' ? '#008751' : currentQ.difficulty === 'medium' ? '#FFCC00' : '#E30613';
  const timerPct  = (timeLeft / SECS_PER_Q) * 100;
  const timerColor= timeLeft <= 10 ? '#E30613' : timeLeft <= 20 ? '#FFCC00' : '#008751';

  return (
    <div className="min-h-screen" style={{ background: '#F5F7FA' }}>
      <Navbar />

      <main className="max-w-lg mx-auto px-4 py-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setMode(null)} className="text-sm font-medium" style={{ color: '#0033A0' }}>
            ← Exit
          </button>
          <div className="text-center">
            <p className="text-xs font-bold" style={{ color: '#0033A0' }}>{topicName}</p>
            <p className="text-xs" style={{ color: '#9CA3AF' }}>{subject}</p>
          </div>
          <div className="text-xs font-bold" style={{ color: '#6B7280' }}>
            {currentIdx + 1}/{questions.length}
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full mb-3 overflow-hidden" style={{ background: '#E5E7EB' }}>
          <div
            className="h-1.5 rounded-full transition-all"
            style={{ width: `${progress}%`, background: '#0033A0' }}
          />
        </div>

        {/* Timer (timed mode) */}
        {mode === 'timed' && (
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: '#E5E7EB' }}>
              <div
                className="h-2 rounded-full transition-all"
                style={{ width: `${timerPct}%`, background: timerColor }}
              />
            </div>
            <span className="text-sm font-black w-8 text-right shrink-0" style={{ color: timerColor }}>
              {timeLeft}s
            </span>
          </div>
        )}

        {/* Question card */}
        <div className="rounded-2xl p-5 mb-4" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
          <div className="flex items-center gap-2 mb-3">
            <span
              className="text-xs px-2 py-0.5 rounded-full font-bold capitalize"
              style={{ background: currentQ.difficulty === 'easy' ? '#DCFCE7' : currentQ.difficulty === 'medium' ? '#FEF9C3' : '#FEE2E2', color: diffColor }}
            >
              {currentQ.difficulty}
            </span>
            {currentQ.waecYear && (
              <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: '#EFF6FF', color: '#0033A0' }}>
                WAEC {currentQ.waecYear}
              </span>
            )}
          </div>
          <p className="text-base font-semibold leading-relaxed" style={{ color: '#111827' }}>
            {currentQ.stem}
          </p>
        </div>

        {/* Options */}
        <div className="flex flex-col gap-2.5 mb-5">
          {currentQ.options.map((option, i) => {
            let bg     = 'white';
            let border = '#E5E7EB';
            let color  = '#111827';

            if (selected !== null) {
              if (i === currentQ.correctIndex) {
                bg = '#DCFCE7'; border = '#008751'; color = '#008751';
              } else if (i === selected && selected !== currentQ.correctIndex) {
                bg = '#FEE2E2'; border = '#E30613'; color = '#E30613';
              }
            } else if (selected === i) {
              bg = '#EFF6FF'; border = '#0033A0'; color = '#0033A0';
            }

            return (
              <button
                key={i}
                onClick={() => handleSelect(i)}
                disabled={selected !== null}
                className="w-full text-left p-4 rounded-xl font-medium text-sm transition-all"
                style={{
                  background: bg,
                  border: `2px solid ${border}`,
                  color,
                  cursor: selected !== null ? 'default' : 'pointer',
                }}
              >
                <span className="font-black mr-2">{String.fromCharCode(65 + i)}.</span>
                {option}
              </button>
            );
          })}
        </div>

        {/* Feedback + next */}
        {selected !== null && (
          <div className="flex flex-col gap-3">
            {/* Explanation */}
            <div
              className="rounded-xl p-4"
              style={{
                background: selected === currentQ.correctIndex ? '#DCFCE7' : '#FEE2E2',
                border: `1.5px solid ${selected === currentQ.correctIndex ? '#86EFAC' : '#FECACA'}`,
              }}
            >
              <p
                className="text-sm font-bold mb-1"
                style={{ color: selected === currentQ.correctIndex ? '#008751' : '#E30613' }}
              >
                {selected === currentQ.correctIndex ? '✓ Correct!' : `✗ The answer is: ${currentQ.options[currentQ.correctIndex]}`}
              </p>
              {currentQ.explanation && (
                <p className="text-xs" style={{ color: selected === currentQ.correctIndex ? '#166534' : '#991B1B' }}>
                  {currentQ.explanation}
                </p>
              )}
            </div>
            <button
              onClick={() => advanceQuestion(selected)}
              className="w-full py-4 rounded-2xl font-bold text-white text-sm"
              style={{ background: '#0033A0' }}
            >
              {currentIdx + 1 >= questions.length ? 'See Results →' : 'Next Question →'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default function QuizPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0033A0' }}>
        <p className="text-white text-sm animate-pulse">Loading quiz...</p>
      </div>
    }>
      <QuizContent />
    </Suspense>
  );
}
