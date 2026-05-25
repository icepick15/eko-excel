import { ColorStatus, BehavioralTrait, CORE_SUBJECTS, SUBJECT_TO_DOMAIN, ACADEMIC_DOMAINS } from './types';
import type {
  DiaryEntry, ReadinessMetric, ReadinessSnapshot, BrainMapProfile,
  Hotspot, CareerRecommendation, CareerPathway,
} from './types';
import {
  diaryStore, topicStore, metricsStore, snapshotStore,
  brainMapStore, hotspotStore, quizAttemptStore, careerStore,
  studentStore, attendanceStore, classStore, schoolStore, districtStore,
} from './storage';

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// Spec thresholds: RED <40%, YELLOW 40–70%, GREEN ≥70%
export const SCORE_GREEN  = 70;
export const SCORE_YELLOW = 40;

export function getColorStatus(score: number): ColorStatus {
  if (score >= SCORE_GREEN)  return ColorStatus.GREEN;
  if (score >= SCORE_YELLOW) return ColorStatus.YELLOW;
  return ColorStatus.RED;
}

export function scoreColor(score: number): string {
  if (score >= SCORE_GREEN)  return '#008751';
  if (score >= SCORE_YELLOW) return '#FFCC00';
  return '#E30613';
}
export function scoreBg(score: number): string {
  if (score >= SCORE_GREEN)  return '#F0FDF4';
  if (score >= SCORE_YELLOW) return '#FFFBEB';
  return '#FEF2F2';
}
export function scoreBorder(score: number): string {
  if (score >= SCORE_GREEN)  return '#86EFAC';
  if (score >= SCORE_YELLOW) return '#FDE68A';
  return '#FECACA';
}
export function scoreLabel(score: number): string {
  if (score >= SCORE_GREEN)  return 'MASTERED';
  if (score >= SCORE_YELLOW) return 'CAUTION ZONE';
  return 'CRITICAL HOTSPOT';
}

// ============= WAEC Readiness Meter =============
// Formula per spec: Σ(TopicWeight_i × NormalizedScore_i × RecencyFactor_i) × AdjustmentFactors
// Recency: e^(−0.1t) where t = weeks since data point
// Adjustment: attendance cap at 60% if attendance < 60%; confidence halved if < 3 data points
export function calculateReadiness(studentId: string, subject: string): ReadinessMetric {
  const student = studentStore.getById(studentId);
  const cls = student ? classStore.getById(student.classId) : null;

  // Pull all class-level diaries for this student's class and subject
  const allDiaries = cls
    ? diaryStore.getByClass(cls.id).filter((d) => d.subject === subject)
    : [];

  const topics = topicStore.getAll();
  const topicMap = new Map(topics.map((t) => [t.id, t]));
  const now = Date.now();

  let totalWeightedScore = 0;
  let totalWeight = 0;
  let dataPoints = 0;

  for (const diary of allDiaries) {
    for (const tId of diary.topicIds) {
      const topic = topicMap.get(tId);
      if (!topic) continue;
      const weight = topic.waecWeight; // 1–10
      const normalizedScore = diary.classScore / 100;
      const weeksAgo = (now - new Date(diary.submittedAt).getTime()) / (1000 * 60 * 60 * 24 * 7);
      const recencyFactor = Math.exp(-0.1 * weeksAgo);

      totalWeightedScore += weight * normalizedScore * recencyFactor;
      totalWeight += weight * recencyFactor;
      dataPoints++;
    }
  }

  // Blend quiz attempt scores (CBT results are more precise — weight 1.2×)
  const quizAttempts = quizAttemptStore.getByStudentAndSubject(studentId, subject);
  for (const attempt of quizAttempts) {
    const topic = topicMap.get(attempt.topicId);
    if (!topic) continue;
    const weight = topic.waecWeight * 1.2;
    const normalizedScore = attempt.score / 100;
    const weeksAgo = (now - new Date(attempt.completedAt).getTime()) / (1000 * 60 * 60 * 24 * 7);
    const recencyFactor = Math.exp(-0.1 * weeksAgo);
    totalWeightedScore += weight * normalizedScore * recencyFactor;
    totalWeight += weight * recencyFactor;
    dataPoints++;
  }

  let score = totalWeight > 0 ? (totalWeightedScore / totalWeight) * 100 : 0;

  // Data confidence: halve confidence weight if < 3 data points
  if (dataPoints < 3) score = score * 0.75;

  // Attendance cap: if attendance < 60%, cap readiness at 60%
  const attendanceRate = getAttendanceRate(studentId);
  if (attendanceRate < 0.6 && score > 60) score = 60;

  score = Math.min(100, Math.max(0, Math.round(score * 10) / 10));

  const metric: ReadinessMetric = {
    studentId,
    subject,
    readinessScore: score,
    colorStatus: getColorStatus(score),
    computedAt: new Date().toISOString(),
  };

  metricsStore.save(metric);

  // Save a snapshot for trend charts (one per day per student×subject)
  const today = new Date().toISOString().slice(0, 10);
  const snapshot: ReadinessSnapshot = {
    id: `snap-${studentId}-${subject.replace(/\s+/g, '_')}-${today}`,
    studentId,
    subject,
    readinessScore: score,
    colorStatus: getColorStatus(score),
    snapshotDate: today,
  };
  snapshotStore.save(snapshot);

  return metric;
}

// ============= Attendance Rate =============
export function getAttendanceRate(studentId: string, recentDays = 30): number {
  const from = new Date(Date.now() - recentDays * 86400000).toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);
  const records = attendanceStore.getByStudentAndRange(studentId, from, to);
  if (records.length === 0) return 1; // assume full attendance if no data
  const present = records.filter((r) => r.status === 'present').length;
  return present / records.length;
}

// ============= Brain Map Computation =============
// 75% Academic + 25% Behavioural per spec
// 5 domains: Logical-Analytical, Spatial-Mechanical, Verbal-Creative, Applied-Practical, Consistency
export function calculateBrainMap(studentId: string): BrainMapProfile | null {
  const student = studentStore.getById(studentId);
  const cls = student ? classStore.getById(student.classId) : null;

  // Need minimum 3 weeks of diary data
  const diaries = cls ? diaryStore.getByClass(cls.id) : [];
  const earliestDate = diaries.length > 0
    ? new Date(diaries[diaries.length - 1].submittedAt)
    : new Date();
  const weeksOfData = Math.floor((Date.now() - earliestDate.getTime()) / (7 * 86400000));

  // Academic scores per domain (from WAEC metrics)
  const domainScores: Record<string, number[]> = {};
  for (const subject of CORE_SUBJECTS) {
    const m = metricsStore.getByStudentAndSubject(studentId, subject)
      ?? calculateReadiness(studentId, subject);
    const domain = SUBJECT_TO_DOMAIN[subject] ?? 'Logical-Analytical';
    if (!domainScores[domain]) domainScores[domain] = [];
    domainScores[domain].push(m.readinessScore / 100);
  }

  const academicDomainAvg: Record<string, number> = {};
  for (const domain of ACADEMIC_DOMAINS) {
    const vals = domainScores[domain] ?? [];
    academicDomainAvg[domain] = vals.length > 0
      ? vals.reduce((a, b) => a + b, 0) / vals.length
      : 0.5;
  }

  // Behavioural: average 1–5 trait scores across all class diaries (normalised to 0–1)
  const traitAccum: Record<string, number[]> = {};
  for (const diary of diaries) {
    for (const [trait, value] of Object.entries(diary.traits)) {
      if (!traitAccum[trait]) traitAccum[trait] = [];
      traitAccum[trait].push((value as number) / 5);
    }
  }

  const behaviouralTraitAvg: Record<string, number> = {};
  for (const trait of Object.values(BehavioralTrait)) {
    const vals = traitAccum[trait] ?? [];
    behaviouralTraitAvg[trait] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0.5;
  }

  // Consistency domain = attendance × persistence trait
  const attendance = getAttendanceRate(studentId);
  const persistence = behaviouralTraitAvg[BehavioralTrait.PERSISTENCE] ?? 0.5;
  const consistency = attendance * persistence;

  // Map behavioural traits to domains per spec:
  // Engagement → all domains (average boost)
  // Persistence → Consistency
  // Focus → Logical-Analytical
  // Collaboration → Verbal-Creative
  // Resilience → Applied-Practical
  const engagement   = behaviouralTraitAvg[BehavioralTrait.ENGAGEMENT] ?? 0.5;
  const focus        = behaviouralTraitAvg[BehavioralTrait.FOCUS] ?? 0.5;
  const collaboration= behaviouralTraitAvg[BehavioralTrait.COLLABORATION] ?? 0.5;
  const resilience   = behaviouralTraitAvg[BehavioralTrait.RESILIENCE] ?? 0.5;

  // Combined scores (75% academic + 25% behavioural)
  const logicalAnalytical  = clamp((academicDomainAvg['Logical-Analytical']  ?? 0.5) * 0.75 + (focus * 0.5 + engagement * 0.5) * 0.25);
  const spatialMechanical  = clamp((academicDomainAvg['Spatial-Mechanical']  ?? 0.5) * 0.75 + engagement * 0.25);
  const verbalCreative     = clamp((academicDomainAvg['Verbal-Creative']     ?? 0.5) * 0.75 + collaboration * 0.25);
  const appliedPractical   = clamp((academicDomainAvg['Applied-Practical']   ?? 0.5) * 0.75 + resilience * 0.25);

  // Top profiles (2–3 strongest domains)
  const domainMap = {
    'Logical-Analytical': logicalAnalytical,
    'Spatial-Mechanical': spatialMechanical,
    'Verbal-Creative':    verbalCreative,
    'Applied-Practical':  appliedPractical,
    'Consistency':        consistency,
  };
  const topProfiles = Object.entries(domainMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);

  // AI-style teaching recommendation (simulated)
  const recommendation = generateTeachingRecommendation(topProfiles, student?.name ?? 'this student');
  const homeAction = generateHomeAction(topProfiles);

  const profile: BrainMapProfile = {
    studentId,
    logicalAnalytical:  Math.round(logicalAnalytical  * 100),
    spatialMechanical:  Math.round(spatialMechanical  * 100),
    verbalCreative:     Math.round(verbalCreative     * 100),
    appliedPractical:   Math.round(appliedPractical   * 100),
    consistency:        Math.round(consistency        * 100),
    topProfiles,
    teachingRecommendation: recommendation,
    homeAction,
    computedAt: new Date().toISOString(),
    weeksOfData,
  };

  return brainMapStore.save(profile);
}

function clamp(v: number): number { return Math.min(1, Math.max(0, v)); }

function generateTeachingRecommendation(profiles: string[], name: string): string {
  const top = profiles[0];
  const recs: Record<string, string> = {
    'Logical-Analytical':  `${name} thrives with structured problem-solving. Use step-by-step worked examples in Mathematics and Physics. Encourage them to explain their reasoning aloud — this reinforces the logical patterns they already process well.`,
    'Spatial-Mechanical':  `${name} grasps concepts through visuals and diagrams. Use drawings, models, and real-world objects when teaching Physics and Technical Drawing. Label diagrams with them rather than describing concepts verbally.`,
    'Verbal-Creative':     `${name} learns through language and storytelling. In English, allow creative interpretation of texts. Frame Science concepts as narratives — "the journey of a red blood cell" engages them far more than definitions.`,
    'Applied-Practical':   `${name} excels with hands-on activities. Biology practicals, Chemistry experiments, and Agricultural Science fieldwork will cement understanding that pure theory cannot. Always link abstract ideas to real Lagos examples.`,
    'Consistency':         `${name} shows strong self-discipline and persistence. Channel this into structured revision schedules. They benefit from goal-setting frameworks — set weekly WAEC readiness targets with them and track progress visibly.`,
  };
  return recs[top] ?? `Focus on ${name}'s strongest domain (${top}) when introducing new topics. Build from known strengths before tackling weak areas.`;
}

function generateHomeAction(profiles: string[]): string {
  const top = profiles[0];
  const actions: Record<string, string> = {
    'Logical-Analytical':  'Ask your child to explain one Maths problem to you tonight. If they can teach it, they understand it.',
    'Spatial-Mechanical':  'Encourage your child to draw a diagram of something they learned today — a circuit, a cell, any structure.',
    'Verbal-Creative':     'Read one newspaper article together and ask: "What is the main point? Do you agree?" 15 minutes of discussion builds comprehension skills.',
    'Applied-Practical':   'Visit a market, kitchen, or workshop together. Ask how today\'s Science lesson connects to what you see around you.',
    'Consistency':         'Help your child create a weekly study timetable. Consistency is their superpower — structure supports it.',
  };
  return actions[top] ?? 'Spend 20 minutes reviewing today\'s topic with your child. Ask them to teach you — it solidifies their understanding.';
}

// ============= Hotspot Detection =============
// Creates a hotspot for each subject where readiness < 55%.
// Uses deterministic IDs (studentId + subject) so re-runs are idempotent.
// Clears any stale/corrupt hotspots first.
export function detectHotspots(studentId: string): Hotspot[] {
  // Wipe stale open hotspots (includes corrupt entries from old seeds)
  hotspotStore.resetForStudent(studentId);

  const newHotspots: Hotspot[] = [];

  for (const subject of CORE_SUBJECTS) {
    const metric = metricsStore.getByStudentAndSubject(studentId, subject)
      ?? calculateReadiness(studentId, subject);

    // Only create a hotspot if score is meaningfully low (> 0 ensures we have real data)
    if (metric.readinessScore > 0 && metric.readinessScore < SCORE_GREEN) {
      const hotspot: Hotspot = {
        id: `hs-${studentId}-${subject.replace(/\s+/g, '-')}`,
        studentId,
        subject,
        readinessScore: metric.readinessScore,
        severity: metric.readinessScore < SCORE_YELLOW ? 'critical' : 'high',
        trend: getTrend(studentId, subject),
        description: `${subject} readiness is ${metric.readinessScore.toFixed(0)}% — below 55% threshold`,
        detectedAt: new Date().toISOString(),
      };
      hotspotStore.save(hotspot);
      newHotspots.push(hotspot);
    }
  }

  return newHotspots;
}

function getTrend(studentId: string, subject: string): 'up' | 'down' | 'stable' {
  const snapshots = snapshotStore.getByStudentAndSubject(studentId, subject);
  if (snapshots.length < 2) return 'stable';
  const last   = snapshots[snapshots.length - 1].readinessScore;
  const before = snapshots[snapshots.length - 2].readinessScore;
  if (last - before > 3)  return 'up';
  if (before - last > 3)  return 'down';
  return 'stable';
}

// ============= Career Prediction =============
export function computeCareerRecommendation(studentId: string): CareerRecommendation {
  const metrics = metricsStore.getByStudent(studentId);
  const brainMap = brainMapStore.getByStudent(studentId);

  const getScore = (subject: string) =>
    metrics.find((m) => m.subject === subject)?.readinessScore ?? 50;

  const mathScore    = getScore('Mathematics');
  const englishScore = getScore('English Language');
  const physicsScore = getScore('Physics');
  const chemScore    = getScore('Chemistry');
  const bioScore     = getScore('Biology');

  const logAnalytical = brainMap?.logicalAnalytical ?? 50;
  const verbalCreative = brainMap?.verbalCreative ?? 50;
  const appliedPractical = brainMap?.appliedPractical ?? 50;

  const scienceRating    = mathScore * 0.30 + physicsScore * 0.25 + chemScore * 0.20 + bioScore * 0.15 + logAnalytical * 0.10;
  const artsRating       = englishScore * 0.40 + verbalCreative * 0.30 + mathScore * 0.15 + (brainMap?.spatialMechanical ?? 50) * 0.15;
  const commercialRating = mathScore * 0.35 + englishScore * 0.30 + logAnalytical * 0.20 + appliedPractical * 0.15;

  const ratings: Record<CareerPathway, number> = { Science: scienceRating, Arts: artsRating, Commercial: commercialRating };
  const sorted = Object.entries(ratings).sort((a, b) => b[1] - a[1]);
  const pathway = sorted[0][0] as CareerPathway;
  const total = sorted.reduce((acc, [, v]) => acc + v, 0);
  const confidence = Math.min(92, Math.max(52, Math.round((ratings[pathway] / (total / 3)) * 62)));

  const reasons: string[] = [];
  const evidenceSubjects: string[] = [];
  if (pathway === 'Science') {
    if (mathScore >= 55) { reasons.push(`Mathematics: ${mathScore.toFixed(0)}% — strong quantitative foundation`); evidenceSubjects.push('Mathematics'); }
    if (physicsScore >= 50) { reasons.push(`Physics: ${physicsScore.toFixed(0)}% — spatial-mechanical aptitude`); evidenceSubjects.push('Physics'); }
    if (chemScore >= 50)   { reasons.push(`Chemistry: ${chemScore.toFixed(0)}% — applied science readiness`); evidenceSubjects.push('Chemistry'); }
  } else if (pathway === 'Arts') {
    if (englishScore >= 55) { reasons.push(`English Language: ${englishScore.toFixed(0)}% — verbal-creative strength`); evidenceSubjects.push('English Language'); }
    reasons.push('High Verbal-Creative domain score — excels in language and expression');
    if (brainMap && brainMap.verbalCreative > 60) reasons.push('Collaboration and communication traits above average');
  } else {
    if (mathScore >= 50) { reasons.push(`Mathematics: ${mathScore.toFixed(0)}% — adequate numeracy`); evidenceSubjects.push('Mathematics'); }
    if (englishScore >= 50) { reasons.push(`English Language: ${englishScore.toFixed(0)}% — communication skills`); evidenceSubjects.push('English Language'); }
    reasons.push('Balanced Logical-Analytical profile suited for business and commerce');
  }

  return careerStore.save({
    studentId, pathway, confidence, reasons, evidenceSubjects,
    subjectScores: { Mathematics: mathScore, 'English Language': englishScore, Physics: physicsScore, Chemistry: chemScore, Biology: bioScore },
    computedAt: new Date().toISOString(),
  });
}

// ============= Full recompute for one student =============
export function recomputeStudent(studentId: string): void {
  CORE_SUBJECTS.forEach((subject) => calculateReadiness(studentId, subject));
  calculateBrainMap(studentId);
  detectHotspots(studentId);
  computeCareerRecommendation(studentId);
}

// ============= School-wide compliance metrics =============
export function getTeacherComplianceThisWeek(teacherId: string): { submitted: number; required: number; rate: number } {
  const monday = new Date();
  monday.setDate(monday.getDate() - monday.getDay() + 1);
  monday.setHours(0, 0, 0, 0);
  const today = new Date();
  const schoolDays = Math.min(5, Math.ceil((today.getTime() - monday.getTime()) / 86400000));

  const tcsEntries = (typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('eko_teacher_class_subj') || '[]')
    : []) as Array<{ teacherId: string; classId: string; subject: string }>;

  const myClasses = tcsEntries.filter((t) => t.teacherId === teacherId);
  const required = myClasses.length * schoolDays;
  if (required === 0) return { submitted: 0, required: 0, rate: 0 };

  const submitted = diaryStore.getByTeacher(teacherId).filter((d) => {
    const sub = new Date(d.submittedAt);
    return sub >= monday && sub <= today;
  }).length;

  return { submitted, required, rate: Math.round((submitted / required) * 100) };
}

// ============= Average readiness for a class / school =============
export function getClassReadinessAvg(classId: string): number {
  const students = studentStore.getByClass(classId);
  if (students.length === 0) return 0;
  const totals = students.map((s) => {
    const ms = metricsStore.getByStudent(s.id);
    if (ms.length === 0) return 0;
    return ms.reduce((a, m) => a + m.readinessScore, 0) / ms.length;
  });
  return Math.round(totals.reduce((a, b) => a + b, 0) / totals.length);
}

export function getSchoolReadinessAvg(schoolId: string): number {
  const students = studentStore.getBySchool(schoolId);
  if (students.length === 0) return 0;
  const totals = students.map((s) => {
    const ms = metricsStore.getByStudent(s.id);
    if (ms.length === 0) return 0;
    return ms.reduce((a, m) => a + m.readinessScore, 0) / ms.length;
  });
  return Math.round(totals.reduce((a, b) => a + b, 0) / totals.length);
}

// ============= Curriculum Coverage =============

export interface CurriculumCoverageItem {
  topicId: string;
  topic: string;
  subTopic?: string;
  waecWeight: number;
  coveredCount: number;
  lastCoveredAt: string | null;
}

export interface SubjectCoverage {
  subject: string;
  totalTopics: number;
  coveredTopics: number;
  coveragePercent: number;
  items: CurriculumCoverageItem[];
}

export function getClassSubjectCoverage(classId: string, subject: string): SubjectCoverage {
  const cls = classStore.getById(classId);
  const allTopics = topicStore.getAll().filter(
    (t) => t.subject === subject && t.classLevel === cls?.level
  );
  const diaries = diaryStore.getByClass(classId).filter((d) => d.subject === subject);

  const coverage = new Map<string, { count: number; lastAt: string }>();
  for (const d of diaries) {
    for (const tid of d.topicIds) {
      const existing = coverage.get(tid);
      if (!existing) {
        coverage.set(tid, { count: 1, lastAt: d.submittedAt });
      } else {
        existing.count++;
        if (d.submittedAt > existing.lastAt) existing.lastAt = d.submittedAt;
      }
    }
  }

  const items: CurriculumCoverageItem[] = allTopics.map((t) => {
    const cov = coverage.get(t.id);
    return {
      topicId: t.id,
      topic: t.topic,
      subTopic: t.subTopic,
      waecWeight: t.waecWeight,
      coveredCount: cov?.count ?? 0,
      lastCoveredAt: cov?.lastAt ?? null,
    };
  });

  const coveredTopics = items.filter((i) => i.coveredCount > 0).length;
  return {
    subject,
    totalTopics: allTopics.length,
    coveredTopics,
    coveragePercent: allTopics.length > 0 ? Math.round((coveredTopics / allTopics.length) * 100) : 0,
    items,
  };
}

export function getClassCoverage(classId: string): SubjectCoverage[] {
  return CORE_SUBJECTS.map((subject) => getClassSubjectCoverage(classId, subject));
}

export function getSchoolSubjectCoverage(schoolId: string): SubjectCoverage[] {
  const classes = classStore.getBySchool(schoolId);
  if (classes.length === 0) {
    return CORE_SUBJECTS.map((s) => ({ subject: s, totalTopics: 0, coveredTopics: 0, coveragePercent: 0, items: [] }));
  }
  return CORE_SUBJECTS.map((subject) => {
    const classCoverages = classes.map((cls) => getClassSubjectCoverage(cls.id, subject));
    const totalTopics   = classCoverages.reduce((a, c) => a + c.totalTopics, 0);
    const coveredTopics = classCoverages.reduce((a, c) => a + c.coveredTopics, 0);
    return {
      subject,
      totalTopics,
      coveredTopics,
      coveragePercent: totalTopics > 0 ? Math.round((coveredTopics / totalTopics) * 100) : 0,
      items: [],
    };
  });
}

export function getDistrictSubjectCoverage(districtId: string): SubjectCoverage[] {
  const schools = schoolStore.getByDistrict(districtId);
  if (schools.length === 0) {
    return CORE_SUBJECTS.map((s) => ({ subject: s, totalTopics: 0, coveredTopics: 0, coveragePercent: 0, items: [] }));
  }
  return CORE_SUBJECTS.map((subject) => {
    const schoolCoverages = schools.map((sc) => getSchoolSubjectCoverage(sc.id).find((c) => c.subject === subject)!);
    const totalTopics   = schoolCoverages.reduce((a, c) => a + c.totalTopics, 0);
    const coveredTopics = schoolCoverages.reduce((a, c) => a + c.coveredTopics, 0);
    return {
      subject,
      totalTopics,
      coveredTopics,
      coveragePercent: totalTopics > 0 ? Math.round((coveredTopics / totalTopics) * 100) : 0,
      items: [],
    };
  });
}

export function getStateSubjectCoverage(): SubjectCoverage[] {
  const districts = districtStore.getAll();
  if (districts.length === 0) {
    return CORE_SUBJECTS.map((s) => ({ subject: s, totalTopics: 0, coveredTopics: 0, coveragePercent: 0, items: [] }));
  }
  return CORE_SUBJECTS.map((subject) => {
    const districtCoverages = districts.map((d) => getDistrictSubjectCoverage(d.id).find((c) => c.subject === subject)!);
    const totalTopics   = districtCoverages.reduce((a, c) => a + c.totalTopics, 0);
    const coveredTopics = districtCoverages.reduce((a, c) => a + c.coveredTopics, 0);
    return {
      subject,
      totalTopics,
      coveredTopics,
      coveragePercent: totalTopics > 0 ? Math.round((coveredTopics / totalTopics) * 100) : 0,
      items: [],
    };
  });
}

// ============= Trend Charts =============
// Derived from diary classScore weekly averages (has 8 weeks of historical data).
// Snapshots only have today's date, so we use diary data for richer history.

export interface TrendPoint {
  weekStart: string;  // YYYY-MM-DD Monday of that week
  label: string;      // short display label e.g. "Apr 14"
  score: number;      // 0–100 average class performance
}

function isoWeekStart(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getUTCDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // back to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function weekLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-NG', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function aggregateByWeek(entries: { date: string; score: number }[], weeks: number): TrendPoint[] {
  const now = new Date();
  const buckets = new Map<string, number[]>();

  // Initialise empty buckets for the last N weeks
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i * 7);
    const ws = isoWeekStart(d.toISOString().slice(0, 10));
    if (!buckets.has(ws)) buckets.set(ws, []);
  }

  for (const e of entries) {
    const ws = isoWeekStart(e.date);
    if (buckets.has(ws)) {
      buckets.get(ws)!.push(e.score);
    }
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ws, scores]) => ({
      weekStart: ws,
      label: weekLabel(ws),
      score: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    }));
}

// Class trend: average diary classScore per week (optionally filtered by subject)
export function getClassTrend(classId: string, subject?: string, weeks = 8): TrendPoint[] {
  const diaries = diaryStore.getByClass(classId)
    .filter((d) => !subject || d.subject === subject);
  const entries = diaries.map((d) => ({
    date: d.submittedAt.slice(0, 10),
    score: d.classScore,
  }));
  return aggregateByWeek(entries, weeks);
}

// School trend: average diary classScore per week across all classes
export function getSchoolTrend(schoolId: string, subject?: string, weeks = 8): TrendPoint[] {
  const classes = classStore.getBySchool(schoolId);
  const entries: { date: string; score: number }[] = [];
  for (const cls of classes) {
    const diaries = diaryStore.getByClass(cls.id)
      .filter((d) => !subject || d.subject === subject);
    for (const d of diaries) {
      entries.push({ date: d.submittedAt.slice(0, 10), score: d.classScore });
    }
  }
  return aggregateByWeek(entries, weeks);
}

// District trend: average across all schools in the district
export function getDistrictTrend(districtId: string, subject?: string, weeks = 8): TrendPoint[] {
  const schools = schoolStore.getByDistrict(districtId);
  const entries: { date: string; score: number }[] = [];
  for (const sc of schools) {
    const classes = classStore.getBySchool(sc.id);
    for (const cls of classes) {
      const diaries = diaryStore.getByClass(cls.id)
        .filter((d) => !subject || d.subject === subject);
      for (const d of diaries) {
        entries.push({ date: d.submittedAt.slice(0, 10), score: d.classScore });
      }
    }
  }
  return aggregateByWeek(entries, weeks);
}

// State-wide trend
export function getStateTrend(subject?: string, weeks = 8): TrendPoint[] {
  const districts = districtStore.getAll();
  const entries: { date: string; score: number }[] = [];
  for (const dist of districts) {
    const schools = schoolStore.getByDistrict(dist.id);
    for (const sc of schools) {
      const classes = classStore.getBySchool(sc.id);
      for (const cls of classes) {
        const diaries = diaryStore.getByClass(cls.id)
          .filter((d) => !subject || d.subject === subject);
        for (const d of diaries) {
          entries.push({ date: d.submittedAt.slice(0, 10), score: d.classScore });
        }
      }
    }
  }
  return aggregateByWeek(entries, weeks);
}
