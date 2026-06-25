'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Role } from '@/lib/types';
import type { User, TeacherClassSubject, Class, Student } from '@/lib/types';
import { tcsStore, classStore, studentStore, schoolStore } from '@/lib/storage';
import { formatStudentId } from '@/lib/format';

// ── Types ──────────────────────────────────────────────────────────────────────
type MainStep = 'consent' | 'welcome' | 'setup';
type UploadPhase = 'idle' | 'uploading' | 'processing' | 'results' | 'confirmed';

interface OcrRow { id: number; name: string; cls: string; gender: string; age: string; phone: string; ok: boolean; }
interface Slide    { icon: string; title: string; desc: string; }

// ── Constants ─────────────────────────────────────────────────────────────────
const MOCK_ROWS: OcrRow[] = [
  { id: 1, name: 'Adebayo Oluwaseun',   cls: 'SS1A', gender: 'M', age: '16', phone: '08012345678', ok: true  },
  { id: 2, name: 'Okonkwo Chidinma',    cls: 'SS1A', gender: 'F', age: '15', phone: '08023456789', ok: true  },
  { id: 3, name: 'Fashola Taiwo',       cls: 'SS1B', gender: 'M', age: '??', phone: '0801????89',  ok: false },
  { id: 4, name: 'Eze Ngozichukwuka',  cls: 'SS1B', gender: 'F', age: '16', phone: '08045678901', ok: true  },
  { id: 5, name: 'Salami Ridwan',       cls: 'SS2A', gender: 'M', age: '17', phone: '080?????23',  ok: false },
  { id: 6, name: 'Adeyemi Folasade',   cls: 'SS2A', gender: 'F', age: '16', phone: '08067890123', ok: true  },
  { id: 7, name: 'Bakare Emmanuel',    cls: 'SS2B', gender: 'M', age: '17', phone: '08078901234', ok: true  },
  { id: 8, name: 'Nwachukwu Adaeze',  cls: 'SS2B', gender: 'F', age: '??', phone: '08089012345', ok: false },
];

const SLIDES: Partial<Record<Role, Slide[]>> = {
  [Role.TEACHER]: [
    { icon: '📓', title: 'Log your diary in 2 minutes', desc: 'Record scores, attendance, and topics covered — daily, from your phone.' },
    { icon: '📊', title: 'Know every student',          desc: 'Track WAEC readiness across all subjects and catch struggling students early.' },
    { icon: '🔥', title: "Act before it's too late",    desc: 'Hotspot alerts show exactly which student needs which subject support, right now.' },
  ],
  [Role.HEADTEACHER]: [
    { icon: '🏫', title: 'Your whole school, one view', desc: 'Monitor every class, teacher, and student from a single dashboard.' },
    { icon: '📸', title: 'Onboard students in minutes', desc: 'Snap your class register and our system digitizes it automatically.' },
    { icon: '📋', title: 'Teacher compliance, sorted',  desc: "See who's logging diaries on time and nudge those who aren't." },
  ],
  [Role.SCHOOLADMIN]: [
    { icon: '🏫', title: 'Your whole school, one view', desc: 'Monitor every class, teacher, and student from a single dashboard.' },
    { icon: '📸', title: 'Onboard students in minutes', desc: 'Snap your class register and our system digitizes it automatically.' },
    { icon: '📋', title: 'Teacher compliance, sorted',  desc: "See who's logging diaries on time and nudge those who aren't." },
  ],
  [Role.STUDENT]: [
    { icon: '🎓', title: 'Welcome to Eko Learn',    desc: 'Your personal WAEC readiness tracker — built to help you excel in every subject.' },
    { icon: '📈', title: 'Track your progress',     desc: 'See your readiness scores across all core subjects and watch yourself improve.' },
    { icon: '🤖', title: 'Get help when you need it', desc: 'Your AI tutor is always available — ask questions, practice topics, get answers.' },
  ],
  [Role.PARENT]: [
    { icon: '👨‍👩‍👧', title: "Stay close to your child",   desc: 'Get real-time visibility into their academic progress and readiness scores.' },
    { icon: '🔔',    title: "Never miss a moment",      desc: 'Instant alerts when your child needs support or a teacher flags a concern.' },
    { icon: '💬',    title: 'Connect with teachers',    desc: "Direct messaging with your child's school staff, all in one place." },
  ],
  [Role.DISTRICT]: [
    { icon: '🗺️', title: 'District-wide intelligence', desc: 'Every school, every student — monitored from one powerful dashboard.' },
    { icon: '📊', title: 'Track what matters',          desc: 'Readiness averages, compliance rates, and hotspots across all your schools.' },
    { icon: '📋', title: 'Data-driven decisions',       desc: 'Export reports, identify underperforming schools, and act on evidence.' },
  ],
  [Role.MINISTRY]: [
    { icon: '🗺️', title: 'State-wide intelligence',   desc: 'Every district, every school, every student — visible from the Ministry.' },
    { icon: '📊', title: 'Monitor at every level',    desc: 'Drill from state averages down to individual school performance instantly.' },
    { icon: '📋', title: 'Policy backed by data',     desc: 'Real-time WAEC readiness trends and curriculum coverage to guide decisions.' },
  ],
};

function roleSlides(role: Role): Slide[] {
  return SLIDES[role] ?? SLIDES[Role.TEACHER]!;
}

function redirectByRole(role: Role, router: ReturnType<typeof useRouter>) {
  if (role === Role.TEACHER) router.replace('/dashboard');
  else if (role === Role.HEADTEACHER || role === Role.SCHOOLADMIN) router.replace('/school');
  else if (role === Role.DISTRICT) router.replace('/district');
  else if (role === Role.MINISTRY) router.replace('/ministry');
  else if (role === Role.STUDENT) router.replace('/student');
  else if (role === Role.PARENT) router.replace('/parent');
  else router.replace('/dashboard');
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [step,           setStep]          = useState<MainStep>('consent');
  const [agreed,         setAgreed]        = useState(false);
  const [slideIdx,       setSlideIdx]      = useState(0);
  const [uploadPhase,    setUploadPhase]   = useState<UploadPhase>('idle');
  const [uploadProgress, setUploadProgress]= useState(0);
  const [ocrDots,        setOcrDots]       = useState(0);
  const [teacherItems,   setTeacherItems]  = useState<{ tcs: TeacherClassSubject; cls: Class | null }[]>([]);
  const [children,       setChildren]      = useState<Student[]>([]);

  useEffect(() => {
    if (isLoading) return;
    if (!user)     { router.replace('/login'); return; }
    if (localStorage.getItem('eko_onboarded_v1')) { redirectByRole(user.role, router); return; }

    if (user.role === Role.TEACHER) {
      const tcs = tcsStore.getByTeacher(user.id);
      setTeacherItems(tcs.map(t => ({ tcs: t, cls: classStore.getById(t.classId) ?? null })));
    }
    if (user.role === Role.PARENT) {
      setChildren((user.childIds ?? []).map(id => studentStore.getById(id)).filter(Boolean) as Student[]);
    }
  }, [user, isLoading, router]);

  // Upload progress bar
  useEffect(() => {
    if (uploadPhase !== 'uploading') return;
    const iv = setInterval(() => {
      setUploadProgress(p => {
        if (p >= 100) { clearInterval(iv); setUploadPhase('processing'); return 100; }
        return p + 5;
      });
    }, 70);
    return () => clearInterval(iv);
  }, [uploadPhase]);

  // OCR animated dots + completion
  useEffect(() => {
    if (uploadPhase !== 'processing') return;
    const dotIv = setInterval(() => setOcrDots(d => (d + 1) % 4), 350);
    const timer  = setTimeout(() => setUploadPhase('results'), 2500);
    return () => { clearInterval(dotIv); clearTimeout(timer); };
  }, [uploadPhase]);

  function finish() {
    localStorage.setItem('eko_onboarded_v1', 'true');
    redirectByRole(user!.role, router);
  }

  function startUpload() {
    setUploadProgress(0);
    setUploadPhase('uploading');
  }

  if (isLoading || !user) return null;

  const slides     = roleSlides(user.role);
  const isLastSlide = slideIdx === slides.length - 1;
  const goodRows   = MOCK_ROWS.filter(r => r.ok);
  const badRows    = MOCK_ROWS.filter(r => !r.ok);

  // ── CONSENT ──────────────────────────────────────────────────────────────
  if (step === 'consent') return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0033A0' }}>
      <div style={{ background: '#008751' }} className="py-2 text-center text-white text-xs font-medium tracking-widest">
        FEDERAL REPUBLIC OF NIGERIA &nbsp;·&nbsp; LAGOS STATE GOVERNMENT
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full mx-auto mb-3 overflow-hidden shadow-xl"
            style={{ border: '3px solid #FFCC00' }}>
            <Image src="/logo.png" alt="Lagos State" width={64} height={64} className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-black text-white">Eko Learn</h1>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>Student Excellence Platform</p>
        </div>

        <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl" style={{ background: 'white' }}>
          <div className="text-center mb-5">
            <span className="text-4xl">🔒</span>
            <h2 className="text-lg font-black mt-2" style={{ color: '#0033A0' }}>Privacy &amp; Data Notice</h2>
            <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
              Nigeria Data Protection Regulation (NDPR) Disclosure
            </p>
          </div>

          <div className="rounded-xl p-4 mb-5 space-y-2.5" style={{ background: '#F9FAFB', border: '1.5px solid #E5E7EB' }}>
            {([
              ['🎯', 'Your data is used strictly for educational purposes within Lagos State schools.'],
              ['📋', 'We collect only: Name, Class, and Phone Number — nothing beyond what is essential.'],
              ['🔐', 'All records are encrypted at rest and stored on isolated, secure government servers.'],
              ['🗑️', 'You may request deletion of your data at any time via your school administrator.'],
            ] as [string, string][]).map(([icon, text]) => (
              <div key={text} className="flex items-start gap-2.5">
                <span className="text-sm shrink-0">{icon}</span>
                <p className="text-xs leading-relaxed" style={{ color: '#374151' }}>{text}</p>
              </div>
            ))}
          </div>

          <label className="flex items-start gap-3 cursor-pointer mb-5 select-none">
            <div
              onClick={() => setAgreed(a => !a)}
              className="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 cursor-pointer transition-colors"
              style={{ borderColor: agreed ? '#0033A0' : '#D1D5DB', background: agreed ? '#0033A0' : 'white' }}
            >
              {agreed && <span className="text-white text-xs font-black">✓</span>}
            </div>
            <span className="text-xs leading-relaxed" style={{ color: '#374151' }}>
              I understand and agree that my data will be used solely for educational tracking by
              Eko Learn / Lagos State Ministry of Education.
            </span>
          </label>

          <button
            onClick={() => agreed && setStep('welcome')}
            disabled={!agreed}
            className="w-full py-3.5 rounded-xl text-sm font-black transition-colors"
            style={{ background: agreed ? '#0033A0' : '#E5E7EB', color: agreed ? 'white' : '#9CA3AF' }}
          >
            Continue →
          </button>
        </div>
      </div>

      <div className="py-3 text-center text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
        © 2026 Lagos State Ministry of Education &nbsp;·&nbsp; Eko Learn v1.0
      </div>
    </div>
  );

  // ── WELCOME SLIDES ────────────────────────────────────────────────────────
  if (step === 'welcome') {
    const slide = slides[slideIdx];
    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#0033A0' }}>
        <div className="flex justify-between items-center px-4 pt-4">
          <span className="text-sm font-black text-white opacity-50">Eko Learn</span>
          <button
            onClick={() => setStep('setup')}
            className="text-xs font-semibold px-3 py-1.5 rounded-full"
            style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)' }}
          >
            Skip
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
          <div className="text-7xl mb-8" style={{ lineHeight: 1 }}>{slide.icon}</div>

          <div className="text-center max-w-xs mb-10">
            <h2 className="text-2xl font-black text-white leading-tight mb-3">{slide.title}</h2>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>{slide.desc}</p>
          </div>

          {/* Dot indicators */}
          <div className="flex gap-2 mb-8">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setSlideIdx(i)}
                style={{
                  height: 8, borderRadius: 4,
                  width: i === slideIdx ? 28 : 8,
                  background: i === slideIdx ? '#FFCC00' : 'rgba(255,255,255,0.3)',
                  transition: 'width 0.2s',
                }}
              />
            ))}
          </div>

          <div className="w-full max-w-xs space-y-3">
            <button
              onClick={() => isLastSlide ? setStep('setup') : setSlideIdx(i => i + 1)}
              className="w-full py-4 rounded-2xl text-base font-black shadow-lg"
              style={{ background: '#FFCC00', color: '#0033A0' }}
            >
              {isLastSlide ? "Let's Get Started →" : 'Next →'}
            </button>
            {slideIdx > 0 && (
              <button
                onClick={() => setSlideIdx(i => i - 1)}
                className="w-full py-2 text-sm text-center"
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                ← Previous
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── SETUP ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: '#F5F7FA' }}>
      <div style={{ background: '#0033A0' }}>
        <div style={{ background: '#008751' }} className="py-1.5 text-center text-white text-xs font-medium tracking-widest">
          FEDERAL REPUBLIC OF NIGERIA &nbsp;·&nbsp; LAGOS STATE GOVERNMENT
        </div>
        <div className="flex items-center gap-3 px-4 py-3 max-w-2xl mx-auto">
          <div className="w-8 h-8 rounded-full overflow-hidden shrink-0" style={{ border: '2px solid #FFCC00' }}>
            <Image src="/logo.png" alt="Lagos" width={32} height={32} className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="text-white font-black text-sm leading-none">Eko Learn</p>
            <p className="text-xs leading-none mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Account Setup</p>
          </div>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {(user.role === Role.HEADTEACHER || user.role === Role.SCHOOLADMIN) && (
          <RosterUpload
            phase={uploadPhase}
            progress={uploadProgress}
            ocrDots={ocrDots}
            goodRows={goodRows}
            badRows={badRows}
            onStartUpload={startUpload}
            onConfirm={() => { setUploadPhase('confirmed'); setTimeout(finish, 1000); }}
            onReupload={() => { setUploadProgress(0); setUploadPhase('idle'); }}
            onSkip={finish}
          />
        )}
        {user.role === Role.TEACHER && (
          <TeacherSetup items={teacherItems} onDone={finish} />
        )}
        {user.role === Role.STUDENT && (
          <StudentActivation user={user} onDone={finish} />
        )}
        {user.role === Role.PARENT && (
          <ParentSetup children={children} onDone={finish} />
        )}
        {(user.role === Role.DISTRICT || user.role === Role.MINISTRY) && (
          <AdminOverview role={user.role} onDone={finish} />
        )}
      </main>
    </div>
  );
}

// ── Roster Upload (Headteacher / School Admin) ────────────────────────────────
function RosterUpload({
  phase, progress, ocrDots, goodRows, badRows,
  onStartUpload, onConfirm, onReupload, onSkip,
}: {
  phase: UploadPhase;
  progress: number;
  ocrDots: number;
  goodRows: OcrRow[];
  badRows: OcrRow[];
  onStartUpload: () => void;
  onConfirm: () => void;
  onReupload: () => void;
  onSkip: () => void;
}) {
  return (
    <div>
      <div className="mb-6">
        <span className="inline-block text-xs font-bold px-2 py-0.5 rounded-full mb-2"
          style={{ background: '#EFF6FF', color: '#0033A0' }}>
          Roster Upload · Step 1 of 1
        </span>
        <h2 className="text-xl font-black" style={{ color: '#0033A0' }}>Add your students</h2>
        <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
          Snap your class register or upload a photo — our OCR engine extracts the data automatically.
        </p>
      </div>

      {/* ── Idle ── */}
      {phase === 'idle' && (
        <div>
          <button
            onClick={onStartUpload}
            className="w-full rounded-2xl p-8 flex flex-col items-center gap-4 mb-4 transition-colors"
            style={{ border: '2px dashed #BFDBFE', background: '#EFF6FF' }}
          >
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
              style={{ background: '#0033A0' }}>
              📸
            </div>
            <div className="text-center">
              <p className="font-black text-sm" style={{ color: '#0033A0' }}>Tap to snap or upload roster</p>
              <p className="text-xs mt-1" style={{ color: '#6B7280' }}>JPG, PNG or PDF &nbsp;·&nbsp; Max 10 MB per image</p>
            </div>
          </button>

          <div className="rounded-2xl p-4 mb-4" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
            <p className="text-xs font-bold mb-3" style={{ color: '#374151' }}>How it works</p>
            <div className="space-y-2.5">
              {([
                ['#0033A0', 'white', '1', 'Take a clear, well-lit photo of the class register'],
                ['#008751', 'white', '2', 'OCR engine extracts Name, Class, Age &amp; Phone Number'],
                ['#FFCC00', '#0033A0', '3', 'Review results — low-confidence rows are highlighted in red'],
                ['#0033A0', 'white', '4', 'Confirm valid entries; flagged ones return for re-submission'],
              ] as [string, string, string, string][]).map(([bg, fg, num, text]) => (
                <div key={num} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5"
                    style={{ background: bg, color: fg }}>
                    {num}
                  </div>
                  <p className="text-xs" style={{ color: '#6B7280' }} dangerouslySetInnerHTML={{ __html: text }} />
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={onStartUpload}
            className="w-full py-4 rounded-2xl text-sm font-black mb-2"
            style={{ background: '#0033A0', color: 'white' }}
          >
            📸 Launch Camera / Upload Image
          </button>
          <button
            onClick={onSkip}
            className="w-full py-3 rounded-2xl text-sm font-semibold"
            style={{ background: 'transparent', color: '#9CA3AF', border: '1.5px solid #E5E7EB' }}
          >
            Skip for now → set up later
          </button>
        </div>
      )}

      {/* ── Uploading ── */}
      {phase === 'uploading' && (
        <div className="rounded-2xl p-8 text-center" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
          <div className="text-4xl mb-4">📤</div>
          <h3 className="font-black text-sm mb-1" style={{ color: '#0033A0' }}>Uploading roster image…</h3>
          <p className="text-xs mb-6" style={{ color: '#9CA3AF' }}>Please keep this page open</p>
          <div className="w-full h-3 rounded-full overflow-hidden mb-2" style={{ background: '#E5E7EB' }}>
            <div className="h-3 rounded-full transition-all" style={{ width: `${progress}%`, background: '#0033A0' }} />
          </div>
          <p className="text-xs font-black" style={{ color: '#0033A0' }}>{progress}%</p>
        </div>
      )}

      {/* ── OCR Processing ── */}
      {phase === 'processing' && (
        <div className="rounded-2xl p-8 text-center" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="font-black text-sm mb-1" style={{ color: '#0033A0' }}>
            Extracting data{'.'.repeat(ocrDots + 1)}
          </h3>
          <p className="text-xs mb-6" style={{ color: '#9CA3AF' }}>
            OCR engine processing &nbsp;·&nbsp; Confidence scoring in progress
          </p>
          <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
            {(['Reading fields', 'Confidence check', 'Schema validation'] as const).map((label, i) => (
              <div key={label} className="rounded-xl p-3 text-center"
                style={{ background: '#F9FAFB', border: '1.5px solid #E5E7EB' }}>
                <div className="text-lg mb-1">{i === 0 ? '✅' : '⏳'}</div>
                <p className="text-xs" style={{ color: '#6B7280' }}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Results ── */}
      {phase === 'results' && (
        <div>
          <div className="rounded-2xl p-4 mb-4 flex items-center gap-3"
            style={{ background: '#FFF7ED', border: '1.5px solid #FDBA74' }}>
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-black text-sm" style={{ color: '#EA580C' }}>
                {badRows.length} {badRows.length === 1 ? 'entry' : 'entries'} flagged for review
              </p>
              <p className="text-xs" style={{ color: '#9A3412' }}>
                {goodRows.length} of {MOCK_ROWS.length} records extracted successfully
              </p>
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden mb-4" style={{ border: '1.5px solid #E5E7EB' }}>
            <div className="overflow-x-auto">
              <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
                <thead>
                  <tr style={{ background: '#0033A0', color: 'white' }}>
                    {['Name', 'Class', 'G', 'Age', 'Phone', ''].map(h => (
                      <th key={h} className="text-left text-xs font-bold px-2 py-2.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MOCK_ROWS.map((row, i) => (
                    <tr key={row.id} style={{
                      background: !row.ok ? '#FEF2F2' : i % 2 === 0 ? 'white' : '#F9FAFB',
                      borderBottom: '1px solid #F3F4F6',
                    }}>
                      <td className="px-2 py-2 text-xs font-semibold" style={{ color: '#111827', whiteSpace: 'nowrap' }}>{row.name}</td>
                      <td className="px-2 py-2 text-xs" style={{ color: '#374151' }}>{row.cls}</td>
                      <td className="px-2 py-2 text-xs" style={{ color: '#374151' }}>{row.gender}</td>
                      <td className="px-2 py-2 text-xs font-mono"
                        style={{ color: row.age.includes('?') ? '#E30613' : '#374151' }}>{row.age}</td>
                      <td className="px-2 py-2 text-xs font-mono"
                        style={{ color: row.phone.includes('?') ? '#E30613' : '#374151' }}>{row.phone}</td>
                      <td className="px-2 py-2">
                        {row.ok
                          ? <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#DCFCE7', color: '#008751' }}>✓ OK</span>
                          : <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#FEE2E2', color: '#E30613' }}>⚠ Flag</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3">
            <button onClick={onConfirm} className="w-full py-4 rounded-2xl text-sm font-black"
              style={{ background: '#008751', color: 'white' }}>
              ✓ Confirm {goodRows.length} Valid Entries
            </button>
            <button onClick={onReupload} className="w-full py-3 rounded-2xl text-sm font-semibold"
              style={{ background: 'white', color: '#EA580C', border: '1.5px solid #FDBA74' }}>
              ↩ Re-upload to Fix {badRows.length} Flagged Entries
            </button>
            <p className="text-xs text-center" style={{ color: '#9CA3AF' }}>
              Flagged entries are queued in your admin portal for correction before final submission
            </p>
          </div>
        </div>
      )}

      {/* ── Confirmed ── */}
      {phase === 'confirmed' && (
        <div className="rounded-2xl p-8 text-center" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
          <div className="text-5xl mb-4">✅</div>
          <h3 className="font-black text-lg mb-1" style={{ color: '#008751' }}>Submitted successfully!</h3>
          <p className="text-sm mt-2" style={{ color: '#6B7280' }}>
            {goodRows.length} student records confirmed &nbsp;·&nbsp; {badRows.length} flagged entries queued for correction
          </p>
          <p className="text-xs mt-3" style={{ color: '#9CA3AF' }}>Redirecting to your dashboard…</p>
        </div>
      )}
    </div>
  );
}

// ── Teacher Setup ─────────────────────────────────────────────────────────────
function TeacherSetup({
  items, onDone,
}: {
  items: { tcs: TeacherClassSubject; cls: Class | null }[];
  onDone: () => void;
}) {
  return (
    <div>
      <div className="mb-6">
        <span className="inline-block text-xs font-bold px-2 py-0.5 rounded-full mb-2"
          style={{ background: '#EFF6FF', color: '#0033A0' }}>
          Class Assignment · Step 1 of 1
        </span>
        <h2 className="text-xl font-black" style={{ color: '#0033A0' }}>Your assigned classes</h2>
        <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
          Confirm the classes and subjects you will be tracking this term.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl p-8 text-center mb-6" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
          <div className="text-4xl mb-3">📋</div>
          <p className="font-semibold text-sm" style={{ color: '#374151' }}>No classes assigned yet</p>
          <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>Contact your school admin to set up class assignments.</p>
        </div>
      ) : (
        <div className="space-y-3 mb-6">
          {items.map(({ tcs, cls }) => (
            <div key={tcs.id} className="flex items-center gap-4 p-4 rounded-2xl"
              style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
              <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center font-black shrink-0"
                style={{ background: '#EFF6FF', color: '#0033A0', fontSize: '0.65rem', lineHeight: 1.2 }}>
                <span style={{ fontSize: '0.6rem' }}>{cls?.level ?? '?'}</span>
                <span style={{ fontSize: '0.75rem' }}>{cls?.section ?? '?'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm" style={{ color: '#111827' }}>{tcs.subject}</p>
                <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
                  {cls ? `${cls.level}${cls.section}` : 'Unknown class'}
                  {cls?.academicYear ? ` · ${cls.academicYear}` : ''}
                </p>
              </div>
              <span className="text-xs font-bold px-2 py-1 rounded-full shrink-0"
                style={{ background: '#DCFCE7', color: '#008751' }}>
                ✓ Assigned
              </span>
            </div>
          ))}
        </div>
      )}

      <button onClick={onDone} className="w-full py-4 rounded-2xl text-sm font-black"
        style={{ background: '#0033A0', color: 'white' }}>
        Looks good — Go to Dashboard →
      </button>
    </div>
  );
}

// ── Student Activation ────────────────────────────────────────────────────────
function StudentActivation({ user, onDone }: { user: User; onDone: () => void }) {
  const school = schoolStore.getById(user.schoolId ?? '');
  const lsid   = formatStudentId(user.studentId ?? user.id);

  return (
    <div>
      <div className="rounded-2xl p-6 text-center mb-5" style={{ background: '#0033A0' }}>
        <div className="text-5xl mb-3">🎓</div>
        <h2 className="text-xl font-black text-white">You&apos;re in!</h2>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.7)' }}>
          Your Eko Learn account is now active
        </p>
      </div>

      <div className="rounded-2xl p-5 mb-4" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
        <p className="text-xs font-bold mb-1" style={{ color: '#9CA3AF' }}>YOUR STUDENT ID (LSID)</p>
        <p className="text-3xl font-black tracking-widest mb-4" style={{ color: '#0033A0' }}>{lsid}</p>
        <div className="rounded-xl p-3" style={{ background: '#FFF7ED', border: '1.5px solid #FDBA74' }}>
          <p className="text-xs" style={{ color: '#92400E' }}>
            Keep this ID safe — you will need it if you ever change your phone number.
          </p>
        </div>
      </div>

      <div className="rounded-2xl p-4 mb-5" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
        {([
          ['🏫', 'School', school?.name?.split(',')[0] ?? '—'],
          ['👤', 'Name',   user.name],
          ['📱', 'Phone',  user.phone],
        ] as [string, string, string][]).map(([icon, label, value]) => (
          <div key={label} className="flex items-center gap-3 py-2.5 border-b last:border-0"
            style={{ borderColor: '#F3F4F6' }}>
            <span className="text-base">{icon}</span>
            <span className="text-xs font-semibold w-14 shrink-0" style={{ color: '#9CA3AF' }}>{label}</span>
            <span className="text-sm font-semibold truncate" style={{ color: '#111827' }}>{value}</span>
          </div>
        ))}
      </div>

      <button onClick={onDone} className="w-full py-4 rounded-2xl text-sm font-black"
        style={{ background: '#008751', color: 'white' }}>
        Start Learning →
      </button>
    </div>
  );
}

// ── Parent Setup ──────────────────────────────────────────────────────────────
function ParentSetup({ children, onDone }: { children: Student[]; onDone: () => void }) {
  return (
    <div>
      <div className="mb-6">
        <span className="inline-block text-xs font-bold px-2 py-0.5 rounded-full mb-2"
          style={{ background: '#EFF6FF', color: '#0033A0' }}>
          Your Children · Step 1 of 1
        </span>
        <h2 className="text-xl font-black" style={{ color: '#0033A0' }}>Linked children</h2>
        <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
          You will receive updates and alerts for these students.
        </p>
      </div>

      {children.length === 0 ? (
        <div className="rounded-2xl p-8 text-center mb-5" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
          <div className="text-4xl mb-3">👶</div>
          <p className="font-semibold text-sm" style={{ color: '#374151' }}>No children linked yet</p>
          <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>
            Contact your child&apos;s school to get linked to their profile.
          </p>
        </div>
      ) : (
        <div className="space-y-3 mb-5">
          {children.map(child => {
            const school = schoolStore.getById(child.schoolId);
            return (
              <div key={child.id} className="flex items-center gap-4 p-4 rounded-2xl"
                style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-black shrink-0"
                  style={{ background: '#EFF6FF', color: '#0033A0' }}>
                  {child.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm" style={{ color: '#111827' }}>{child.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
                    {school?.name?.split(',')[0] ?? '—'} &nbsp;·&nbsp; {formatStudentId(child.id)}
                  </p>
                </div>
                <span className="text-xs font-bold px-2 py-1 rounded-full shrink-0"
                  style={{ background: '#DCFCE7', color: '#008751' }}>
                  ✓ Linked
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-2xl p-4 mb-5" style={{ background: '#EFF6FF', border: '1.5px solid #BFDBFE' }}>
        <p className="text-xs font-bold mb-2.5" style={{ color: '#0033A0' }}>You will be notified when:</p>
        {[
          "📉 Your child's readiness drops below 40% in any subject",
          '🔥 A learning hotspot is flagged by their teacher',
          '📋 New intervention support is assigned to them',
        ].map(text => (
          <p key={text} className="text-xs mb-1.5 last:mb-0" style={{ color: '#374151' }}>{text}</p>
        ))}
      </div>

      <button onClick={onDone} className="w-full py-4 rounded-2xl text-sm font-black"
        style={{ background: '#0033A0', color: 'white' }}>
        Go to Parent Dashboard →
      </button>
    </div>
  );
}

// ── Admin Overview (District / Ministry) ──────────────────────────────────────
function AdminOverview({ role, onDone }: { role: Role; onDone: () => void }) {
  const isMinistry = role === Role.MINISTRY;

  const features = isMinistry ? [
    ['🗺️', 'Full State Coverage',    'View all districts, schools, and students across Lagos State'],
    ['📊', 'Readiness Analytics',    'Real-time WAEC readiness trends at state and district level'],
    ['📋', 'Curriculum Coverage',    'Monitor syllabus progress across every school and class'],
    ['📥', 'Reports & Exports',      'Generate and download CSV reports for policy review'],
  ] : [
    ['🏫', 'School Monitoring',      'View all schools, teachers, and students in your district'],
    ['📊', 'Performance Heatmap',    'Subject × school readiness breakdown at a glance'],
    ['🔥', 'Hotspot Alerts',         'District-wide at-risk student flagging and trend tracking'],
    ['📋', 'Compliance Tracking',    'Teacher diary submission rates across all schools'],
  ];

  return (
    <div>
      <div className="mb-6">
        <span className="inline-block text-xs font-bold px-2 py-0.5 rounded-full mb-2"
          style={{ background: '#EFF6FF', color: '#0033A0' }}>
          {isMinistry ? 'Ministry of Education' : 'District Office'}
        </span>
        <h2 className="text-xl font-black" style={{ color: '#0033A0' }}>
          {isMinistry ? 'State-wide Platform Access' : 'District Dashboard Access'}
        </h2>
        <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
          {isMinistry
            ? 'Your account has full visibility across all districts, schools, and students in Lagos State.'
            : 'Your account covers all schools and students within your assigned district.'}
        </p>
      </div>

      <div className="space-y-3 mb-6">
        {(features as [string, string, string][]).map(([icon, title, desc]) => (
          <div key={title} className="flex items-start gap-3 p-4 rounded-2xl"
            style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
            <span className="text-xl shrink-0 mt-0.5">{icon}</span>
            <div>
              <p className="font-black text-sm" style={{ color: '#111827' }}>{title}</p>
              <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <button onClick={onDone} className="w-full py-4 rounded-2xl text-sm font-black"
        style={{ background: '#0033A0', color: 'white' }}>
        Access Dashboard →
      </button>
    </div>
  );
}
