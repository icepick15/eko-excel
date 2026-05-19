'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Role } from '@/lib/types';
import type { QuizQuestion } from '@/lib/types';
import { quizQuestionStore, quizAttemptStore, topicStore } from '@/lib/storage';
import { recomputeStudent } from '@/lib/calculations';
import Navbar from '@/components/Navbar';

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function QuizContent() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const topicId = params.get('topicId') ?? '';
  const subject = params.get('subject') ?? '';

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [finalCorrect, setFinalCorrect] = useState(0);
  const [topicName, setTopicName] = useState('');

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.role !== Role.STUDENT) { router.replace('/login'); return; }

    const topicQuestions = quizQuestionStore.getByTopic(topicId);
    if (topicQuestions.length === 0) {
      // Fall back to all questions for the subject
      const bySubject = quizQuestionStore.getBySubject(subject);
      setQuestions(bySubject.slice(0, 5));
    } else {
      setQuestions(topicQuestions);
    }

    const topic = topicStore.getById(topicId);
    setTopicName(topic?.topic ?? subject);
  }, [user, isLoading, topicId, subject, router]);

  function handleSelect(idx: number) {
    if (selected !== null) return;
    setSelected(idx);
  }

  function handleNext() {
    const newAnswers = [...answers, selected ?? 0];
    setAnswers(newAnswers);

    if (currentIdx + 1 >= questions.length) {
      const correctCount = newAnswers.filter((ans, i) => ans === questions[i].correctIndex).length;
      const score = Math.round((correctCount / questions.length) * 100);
      setFinalCorrect(correctCount);
      setFinalScore(score);

      // Save quiz attempt
      if (user?.studentId) {
        quizAttemptStore.save({
          id: uid(),
          studentId: user.studentId,
          topicId,
          subject,
          score,
          totalQuestions: questions.length,
          correctCount,
          completedAt: new Date().toISOString(),
        });
        recomputeStudent(user.studentId);
      }

      setShowResult(true);
    } else {
      setCurrentIdx(currentIdx + 1);
      setSelected(null);
    }
  }

  if (isLoading || questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--lagos-blue)' }}>
        <div className="text-white text-center">
          <div className="text-xl font-bold mb-2">Loading Quiz...</div>
          <div className="text-blue-200 text-sm animate-pulse">Preparing questions</div>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentIdx];
  const progress = ((currentIdx) / questions.length) * 100;

  // ——— Results screen ———
  if (showResult) {
    const passed = finalScore >= 65;
    return (
      <div className="min-h-screen" style={{ background: 'var(--background)' }}>
        <Navbar />
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <div
            className="w-24 h-24 rounded-full mx-auto flex items-center justify-center text-4xl mb-6 shadow-lg"
            style={{ background: passed ? 'var(--lagos-green)' : 'var(--lagos-red)', color: 'white' }}
          >
            {passed ? '🏆' : '💪'}
          </div>
          <h2 className="text-3xl font-black mb-1" style={{ color: 'var(--lagos-blue)' }}>
            {finalScore}%
          </h2>
          <p className="text-base font-semibold mb-1" style={{ color: passed ? 'var(--lagos-green)' : 'var(--lagos-red)' }}>
            {passed ? 'Well done!' : 'Keep practising!'}
          </p>
          <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
            {finalCorrect} out of {questions.length} correct
          </p>
          <p className="text-xs mb-8" style={{ color: 'var(--text-muted)' }}>
            {topicName} · {subject}
          </p>

          {/* Score breakdown */}
          <div className="card mb-6 text-left">
            <div className="text-xs font-bold mb-3 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Question Review</div>
            {questions.map((q, i) => {
              const isCorrect = answers[i] === q.correctIndex;
              return (
                <div key={q.id} className="flex items-start gap-2 py-2" style={{ borderBottom: i < questions.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <span className="text-base shrink-0 mt-0.5">{isCorrect ? '✅' : '❌'}</span>
                  <div>
                    <div className="text-xs font-medium">{q.question}</div>
                    {!isCorrect && (
                      <div className="text-xs mt-0.5" style={{ color: 'var(--lagos-green)' }}>
                        Correct: {q.options[q.correctIndex]}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-3">
            <button
              className="btn-primary w-full"
              onClick={() => {
                setCurrentIdx(0);
                setSelected(null);
                setAnswers([]);
                setShowResult(false);
              }}
            >
              Try Again →
            </button>
            <button
              className="w-full py-3 rounded-xl font-semibold text-sm"
              style={{ background: 'var(--lagos-blue-light)', color: 'var(--lagos-blue)' }}
              onClick={() => router.push('/student')}
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ——— Question screen ———
  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <Navbar />

      <main className="max-w-xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.push('/student')}
            className="text-xs font-medium"
            style={{ color: 'var(--text-muted)' }}
          >
            ← Back
          </button>
          <div className="text-center">
            <div className="text-xs font-bold" style={{ color: 'var(--lagos-blue)' }}>{topicName}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{subject}</div>
          </div>
          <div className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
            {currentIdx + 1} / {questions.length}
          </div>
        </div>

        {/* Progress bar */}
        <div className="progress-bar mb-6" style={{ height: '6px' }}>
          <div
            className="progress-bar-fill"
            style={{ width: `${progress}%`, background: 'var(--lagos-blue)', height: '6px', transition: 'width 0.3s ease' }}
          />
        </div>

        {/* Question */}
        <div className="card mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span
              className="text-xs px-2 py-0.5 rounded font-bold uppercase"
              style={{
                background: currentQ.difficulty === 'easy' ? 'var(--lagos-green-light)' : currentQ.difficulty === 'medium' ? '#FEF9C3' : '#FEE2E2',
                color: currentQ.difficulty === 'easy' ? 'var(--lagos-green)' : currentQ.difficulty === 'medium' ? '#854D0E' : 'var(--lagos-red)',
              }}
            >
              {currentQ.difficulty}
            </span>
          </div>
          <p className="text-base font-semibold leading-relaxed" style={{ color: 'var(--foreground)' }}>
            {currentQ.question}
          </p>
        </div>

        {/* Options */}
        <div className="flex flex-col gap-3 mb-6">
          {currentQ.options.map((option, i) => {
            let bg = 'white';
            let border = 'var(--border)';
            let color = 'var(--foreground)';

            if (selected !== null) {
              if (i === currentQ.correctIndex) {
                bg = 'var(--lagos-green-light)';
                border = 'var(--lagos-green)';
                color = 'var(--lagos-green)';
              } else if (i === selected && selected !== currentQ.correctIndex) {
                bg = '#FEE2E2';
                border = 'var(--lagos-red)';
                color = 'var(--lagos-red)';
              }
            } else if (selected === i) {
              bg = 'var(--lagos-blue-light)';
              border = 'var(--lagos-blue)';
              color = 'var(--lagos-blue)';
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
                <span className="font-bold mr-2">{String.fromCharCode(65 + i)}.</span>
                {option}
              </button>
            );
          })}
        </div>

        {/* Feedback + Next */}
        {selected !== null && (
          <div className="flex flex-col gap-3">
            <div
              className="rounded-xl p-3 text-sm font-medium"
              style={{
                background: selected === currentQ.correctIndex ? 'var(--lagos-green-light)' : '#FEE2E2',
                color: selected === currentQ.correctIndex ? 'var(--lagos-green)' : 'var(--lagos-red)',
              }}
            >
              {selected === currentQ.correctIndex
                ? '✓ Correct!'
                : `✗ Incorrect. The answer is: ${currentQ.options[currentQ.correctIndex]}`
              }
            </div>
            <button className="btn-primary w-full" onClick={handleNext}>
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--lagos-blue)' }}>
        <div className="text-white text-sm animate-pulse">Loading quiz...</div>
      </div>
    }>
      <QuizContent />
    </Suspense>
  );
}
