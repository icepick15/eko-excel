'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Role, CORE_SUBJECTS } from '@/lib/types';
import type { Class } from '@/lib/types';
import {
  tcsStore, classStore, schoolStore, districtStore,
} from '@/lib/storage';
import {
  getClassSubjectCoverage, getClassCoverage, getSchoolSubjectCoverage,
  getDistrictSubjectCoverage, getStateSubjectCoverage,
  scoreColor, SCORE_GREEN, SCORE_YELLOW,
  type SubjectCoverage, type CurriculumCoverageItem,
} from '@/lib/calculations';
import Navbar from '@/components/Navbar';

const SUBJECT_EMOJI: Record<string, string> = {
  'Mathematics':      '🔢',
  'English Language': '📝',
  'Physics':          '⚡',
  'Chemistry':        '🧪',
  'Biology':          '🌿',
};

function CoverageBar({ pct, height = 8 }: { pct: number; height?: number }) {
  const color = pct >= SCORE_GREEN ? '#008751' : pct >= SCORE_YELLOW ? '#FFCC00' : '#E30613';
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height, background: '#F3F4F6' }}>
      <div className="rounded-full h-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function SubjectCard({ cov, onClick }: { cov: SubjectCoverage; onClick?: () => void }) {
  const color = scoreColor(cov.coveragePercent);
  const bg    = cov.coveragePercent >= SCORE_GREEN ? '#F0FDF4' : cov.coveragePercent >= SCORE_YELLOW ? '#FFFBEB' : '#FEF2F2';
  const border = cov.coveragePercent >= SCORE_GREEN ? '#86EFAC' : cov.coveragePercent >= SCORE_YELLOW ? '#FDE68A' : '#FECACA';
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="rounded-2xl p-4 text-left w-full"
      style={{ background: bg, border: `1.5px solid ${border}`, cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 20 }}>{SUBJECT_EMOJI[cov.subject] ?? '📚'}</span>
          <p className="font-bold text-sm" style={{ color: '#374151' }}>{cov.subject}</p>
        </div>
        <span className="text-2xl font-black" style={{ color }}>{cov.coveragePercent}%</span>
      </div>
      <CoverageBar pct={cov.coveragePercent} />
      <p className="text-xs mt-2" style={{ color: '#9CA3AF' }}>
        {cov.coveredTopics} / {cov.totalTopics} topics covered
        {onClick && ' · tap to see detail'}
      </p>
    </button>
  );
}

function TopicList({ items, subject }: { items: CurriculumCoverageItem[]; subject: string }) {
  const sorted = [...items].sort((a, b) => a.coveredCount - b.coveredCount); // uncovered first
  return (
    <div>
      <p className="text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: '#6B7280' }}>
        {subject} — topic breakdown
      </p>
      <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
        {sorted.map((item) => {
          const covered = item.coveredCount > 0;
          return (
            <div
              key={item.topicId}
              className="flex items-center gap-3 p-2.5 rounded-xl"
              style={{
                background: covered ? '#F0FDF4' : '#FEF2F2',
                border: `1px solid ${covered ? '#86EFAC' : '#FECACA'}`,
              }}
            >
              <span className="text-base shrink-0">{covered ? '✅' : '⬜'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: '#374151' }}>{item.topic}</p>
                {item.subTopic && (
                  <p className="text-xs truncate" style={{ color: '#9CA3AF' }}>{item.subTopic}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-bold" style={{ color: covered ? '#008751' : '#E30613' }}>
                  {covered ? `${item.coveredCount}×` : 'Not taught'}
                </p>
                <p className="text-xs" style={{ color: '#9CA3AF' }}>wt {item.waecWeight}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Teacher view ──────────────────────────────────────────────────────────────
function TeacherView({ userId }: { userId: string }) {
  const router = useRouter();
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  const tcs = tcsStore.getByTeacher(userId);
  // Unique classes this teacher teaches
  const classIdSet = Array.from(new Set(tcs.map((t) => t.classId)));
  const teacherClasses = classIdSet
    .map((id) => classStore.getById(id))
    .filter((c): c is Class => c != null);

  const activeClassId = selectedClass ?? teacherClasses[0]?.id ?? null;
  const activeClass   = teacherClasses.find((c) => c.id === activeClassId);
  const classSubjects = tcs.filter((t) => t.classId === activeClassId).map((t) => t.subject);

  const activeSubject = selectedSubject ?? classSubjects[0] ?? null;
  const coverage = activeClassId && activeSubject
    ? getClassSubjectCoverage(activeClassId, activeSubject)
    : null;
  const allCoverage = activeClassId ? getClassCoverage(activeClassId) : [];

  return (
    <div>
      {/* Class picker */}
      {teacherClasses.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {teacherClasses.map((cls) => (
            <button
              key={cls.id}
              onClick={() => { setSelectedClass(cls.id); setSelectedSubject(null); }}
              className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold"
              style={{
                background: activeClassId === cls.id ? '#0033A0' : '#E5E7EB',
                color:      activeClassId === cls.id ? 'white'    : '#374151',
              }}
            >
              {cls.level}{cls.section}
            </button>
          ))}
        </div>
      )}

      {activeClass && (
        <div className="mb-3">
          <p className="text-sm font-semibold" style={{ color: '#374151' }}>
            {activeClass.level}{activeClass.section} — All Subjects
          </p>
        </div>
      )}

      {/* Subject summary grid */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {allCoverage
          .filter((c) => classSubjects.includes(c.subject))
          .map((cov) => (
            <SubjectCard
              key={cov.subject}
              cov={cov}
              onClick={() => setSelectedSubject(cov.subject === activeSubject ? null : cov.subject)}
            />
          ))}
      </div>

      {/* Topic drill-down */}
      {coverage && activeSubject && (
        <div className="rounded-2xl p-4" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="font-bold text-sm" style={{ color: '#0033A0' }}>Topic Detail</p>
            <button onClick={() => setSelectedSubject(null)} className="text-xs" style={{ color: '#9CA3AF' }}>
              Close ×
            </button>
          </div>
          <TopicList items={coverage.items} subject={activeSubject} />
          {coverage.items.some((i) => i.coveredCount === 0) && (
            <button
              onClick={() => router.push('/diary')}
              className="mt-4 w-full py-2.5 rounded-xl font-bold text-sm"
              style={{ background: '#0033A0', color: 'white' }}
            >
              Log a Diary Entry →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── School / Headteacher view ────────────────────────────────────────────────
function SchoolView({ schoolId }: { schoolId: string }) {
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  const coverage = getSchoolSubjectCoverage(schoolId);
  const classes  = classStore.getBySchool(schoolId);

  const drillSubject = selectedSubject;
  const drillData = drillSubject
    ? classes.map((cls) => ({
        cls,
        cov: getClassSubjectCoverage(cls.id, drillSubject),
      }))
    : [];

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 mb-5">
        {coverage.map((cov) => (
          <SubjectCard
            key={cov.subject}
            cov={cov}
            onClick={() => setSelectedSubject(cov.subject === selectedSubject ? null : cov.subject)}
          />
        ))}
      </div>

      {drillSubject && drillData.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="font-bold text-sm" style={{ color: '#0033A0' }}>
              {SUBJECT_EMOJI[drillSubject] ?? '📚'} {drillSubject} — By Class
            </p>
            <button onClick={() => setSelectedSubject(null)} className="text-xs" style={{ color: '#9CA3AF' }}>Close ×</button>
          </div>
          <div className="flex flex-col gap-3">
            {drillData.map(({ cls, cov }) => (
              <div key={cls.id} className="flex items-center gap-3">
                <div className="w-14 text-xs font-bold shrink-0" style={{ color: '#0033A0' }}>
                  {cls.level}{cls.section}
                </div>
                <div className="flex-1">
                  <CoverageBar pct={cov.coveragePercent} />
                </div>
                <div className="w-10 text-right shrink-0">
                  <span className="text-xs font-black" style={{ color: scoreColor(cov.coveragePercent) }}>
                    {cov.coveragePercent}%
                  </span>
                </div>
                <div className="text-xs w-16 text-right shrink-0" style={{ color: '#9CA3AF' }}>
                  {cov.coveredTopics}/{cov.totalTopics}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── District view ────────────────────────────────────────────────────────────
function DistrictView({ districtId }: { districtId: string }) {
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const coverage = getDistrictSubjectCoverage(districtId);
  const schools  = schoolStore.getByDistrict(districtId);

  const drillData = selectedSubject
    ? schools.map((sc) => ({
        sc,
        cov: getSchoolSubjectCoverage(sc.id).find((c) => c.subject === selectedSubject)!,
      }))
    : [];

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 mb-5">
        {coverage.map((cov) => (
          <SubjectCard
            key={cov.subject}
            cov={cov}
            onClick={() => setSelectedSubject(cov.subject === selectedSubject ? null : cov.subject)}
          />
        ))}
      </div>

      {selectedSubject && drillData.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="font-bold text-sm" style={{ color: '#0033A0' }}>
              {SUBJECT_EMOJI[selectedSubject] ?? '📚'} {selectedSubject} — By School
            </p>
            <button onClick={() => setSelectedSubject(null)} className="text-xs" style={{ color: '#9CA3AF' }}>Close ×</button>
          </div>
          <div className="flex flex-col gap-3">
            {drillData
              .sort((a, b) => a.cov.coveragePercent - b.cov.coveragePercent)
              .map(({ sc, cov }) => (
                <div key={sc.id} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: '#374151' }}>
                      {sc.name.split(',')[0]}
                    </p>
                    <CoverageBar pct={cov.coveragePercent} height={6} />
                  </div>
                  <div className="w-10 text-right shrink-0">
                    <span className="text-xs font-black" style={{ color: scoreColor(cov.coveragePercent) }}>
                      {cov.coveragePercent}%
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Ministry view ────────────────────────────────────────────────────────────
function MinistryView() {
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const coverage  = getStateSubjectCoverage();
  const districts = districtStore.getAll();

  const drillData = selectedSubject
    ? districts.map((d) => ({
        d,
        cov: getDistrictSubjectCoverage(d.id).find((c) => c.subject === selectedSubject)!,
      }))
    : [];

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 mb-5">
        {coverage.map((cov) => (
          <SubjectCard
            key={cov.subject}
            cov={cov}
            onClick={() => setSelectedSubject(cov.subject === selectedSubject ? null : cov.subject)}
          />
        ))}
      </div>

      {selectedSubject && drillData.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="font-bold text-sm" style={{ color: '#0033A0' }}>
              {SUBJECT_EMOJI[selectedSubject] ?? '📚'} {selectedSubject} — By District
            </p>
            <button onClick={() => setSelectedSubject(null)} className="text-xs" style={{ color: '#9CA3AF' }}>Close ×</button>
          </div>
          <div className="flex flex-col gap-3">
            {drillData
              .sort((a, b) => a.cov.coveragePercent - b.cov.coveragePercent)
              .map(({ d, cov }) => (
                <div key={d.id} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: '#374151' }}>
                      {d.name.split('(')[0].trim()}
                    </p>
                    <CoverageBar pct={cov.coveragePercent} height={6} />
                  </div>
                  <span className="text-xs font-black w-10 text-right shrink-0" style={{ color: scoreColor(cov.coveragePercent) }}>
                    {cov.coveragePercent}%
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function CurriculumPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }
    const allowed = [Role.TEACHER, Role.HEADTEACHER, Role.SCHOOLADMIN, Role.DISTRICT, Role.MINISTRY];
    if (!allowed.includes(user.role)) { router.replace('/dashboard'); return; }
    setReady(true);
  }, [user, isLoading, router]);

  if (isLoading || !ready || !user) return null;

  const subtitle: Record<Role, string> = {
    [Role.TEACHER]:     'Track which WAEC topics your classes have covered',
    [Role.HEADTEACHER]: 'School-wide curriculum progress across all classes',
    [Role.SCHOOLADMIN]: 'School-wide curriculum progress across all classes',
    [Role.DISTRICT]:    'Curriculum coverage across all schools in your district',
    [Role.MINISTRY]:    'State-wide curriculum coverage overview',
    [Role.STUDENT]:     '',
    [Role.PARENT]:      '',
  };

  return (
    <div className="min-h-screen" style={{ background: '#F5F7FA' }}>
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-5 pb-10">
        {/* Header */}
        <div className="mb-5">
          <button onClick={() => router.back()} className="text-sm font-medium mb-2" style={{ color: '#0033A0' }}>←</button>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full inline-block mb-1" style={{ background: '#EFF6FF', color: '#0033A0' }}>
            Curriculum Coverage Auditor
          </span>
          <h1 className="text-xl font-black" style={{ color: '#0033A0' }}>Syllabus Coverage</h1>
          <p className="text-sm" style={{ color: '#6B7280' }}>{subtitle[user.role]}</p>
        </div>

        {/* Legend */}
        <div className="flex gap-4 mb-5 text-xs">
          {[
            { label: `≥${SCORE_GREEN}% Covered`,  color: '#008751', bg: '#F0FDF4' },
            { label: `${SCORE_YELLOW}–${SCORE_GREEN - 1}% Partial`, color: '#854D0E', bg: '#FFFBEB' },
            { label: `<${SCORE_YELLOW}% Behind`,   color: '#E30613', bg: '#FEF2F2' },
          ].map(({ label, color, bg }) => (
            <div key={label} className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: bg }}>
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
              <span style={{ color }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Role-specific view */}
        {(user.role === Role.TEACHER) && <TeacherView userId={user.id} />}
        {(user.role === Role.HEADTEACHER || user.role === Role.SCHOOLADMIN) && (
          <SchoolView schoolId={user.schoolId ?? ''} />
        )}
        {user.role === Role.DISTRICT  && <DistrictView districtId={user.districtId ?? ''} />}
        {user.role === Role.MINISTRY  && <MinistryView />}
      </main>
    </div>
  );
}
