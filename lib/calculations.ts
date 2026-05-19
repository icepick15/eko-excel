import { ColorStatus, BehavioralTrait, WAEC_SUBJECTS, SUBJECT_TO_DOMAIN } from './types';
import type { DiaryEntry, TopicSegment, ReadinessMetric, BrainMapProfile, Hotspot, CareerRecommendation, CareerPathway } from './types';
import { diaryStore, topicStore, metricsStore, brainMapStore, hotspotStore, quizAttemptStore, careerStore } from './storage';

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

const RECENCY_DECAY = 0.95;
const TRAIT_VALUE: Record<string, number> = { high: 1, medium: 0.66, low: 0.33 };

function getColorStatus(score: number): ColorStatus {
  if (score >= 75) return ColorStatus.GREEN;
  if (score >= 55) return ColorStatus.YELLOW;
  return ColorStatus.RED;
}

// ============= WAEC Readiness Meter =============
export function calculateReadiness(studentId: string, subject: string): ReadinessMetric {
  const diaries = diaryStore.getByStudent(studentId);
  const topics = topicStore.getAll();
  const topicMap = new Map(topics.map((t) => [t.id, t]));

  const subjectDiaries = diaries.filter((d) => {
    const topic = topicMap.get(d.topicId);
    return topic?.subject === subject;
  });

  const now = Date.now();
  let totalWeightedScore = 0;
  let totalWeight = 0;

  for (const diary of subjectDiaries) {
    const topic = topicMap.get(diary.topicId) as TopicSegment;
    const weight = topic.waecFrequency;
    const normalizedScore = diary.classScore / 100;
    const ageInDays = (now - new Date(diary.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    const recencyFactor = Math.pow(RECENCY_DECAY, ageInDays / 7);

    totalWeightedScore += weight * normalizedScore * recencyFactor;
    totalWeight += weight * recencyFactor;
  }

  // Also blend in quiz attempt scores for this subject (more direct than class-level diary)
  const quizAttempts = quizAttemptStore.getByStudent(studentId).filter((a) => a.subject === subject);
  for (const attempt of quizAttempts) {
    const topic = topicMap.get(attempt.topicId);
    if (!topic) continue;
    const weight = topic.waecFrequency * 1.2;
    const normalizedScore = attempt.score / 100;
    const ageInDays = (now - new Date(attempt.completedAt).getTime()) / (1000 * 60 * 60 * 24);
    const recencyFactor = Math.pow(RECENCY_DECAY, ageInDays / 7);
    totalWeightedScore += weight * normalizedScore * recencyFactor;
    totalWeight += weight * recencyFactor;
  }

  const score = totalWeight > 0 ? (totalWeightedScore / totalWeight) * 100 : 0;
  const metric: ReadinessMetric = {
    studentId,
    subject,
    readinessScore: Math.round(score * 100) / 100,
    colorStatus: getColorStatus(score),
    computedAt: new Date().toISOString(),
  };
  return metricsStore.save(metric);
}

// ============= Brain Map =============
export function calculateBrainMap(studentId: string): BrainMapProfile {
  const diaries = diaryStore.getByStudent(studentId);

  // Academic: readiness scores per domain
  const domainScores: Record<string, number[]> = {};
  for (const subject of WAEC_SUBJECTS) {
    const metric = metricsStore.getByStudentAndSubject(studentId, subject)
      ?? calculateReadiness(studentId, subject);
    const domain = SUBJECT_TO_DOMAIN[subject];
    if (!domainScores[domain]) domainScores[domain] = [];
    domainScores[domain].push(metric.readinessScore / 100);
  }
  const academicDomains: Record<string, number> = {};
  for (const [domain, scores] of Object.entries(domainScores)) {
    academicDomains[domain] = scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  // Behavioral: average per trait across all diaries
  const traitAccum: Record<string, number[]> = {};
  for (const diary of diaries) {
    for (const [trait, value] of Object.entries(diary.behavioralTraits)) {
      if (!traitAccum[trait]) traitAccum[trait] = [];
      traitAccum[trait].push(TRAIT_VALUE[value] ?? 0);
    }
  }
  const behavioralTraits: Record<string, number> = {};
  for (const trait of Object.values(BehavioralTrait)) {
    const vals = traitAccum[trait] ?? [];
    behavioralTraits[trait] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }

  const academicAvg = Object.values(academicDomains).reduce((a, b) => a + b, 0) / Object.keys(academicDomains).length || 0;
  const behavioralAvg = Object.values(behavioralTraits).reduce((a, b) => a + b, 0) / Object.keys(behavioralTraits).length || 0;

  const allScores = { ...academicDomains, ...behavioralTraits };
  const topStrengths = Object.entries(allScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);

  const profile: BrainMapProfile = {
    studentId,
    academicScore: Math.round(academicAvg * 75 * 100) / 100,
    behavioralScore: Math.round(behavioralAvg * 25 * 100) / 100,
    topStrengths,
    academicDomains,
    behavioralTraits,
    computedAt: new Date().toISOString(),
  };
  return brainMapStore.save(profile);
}

// ============= Hotspot Detection =============
export function detectHotspots(studentId: string): Hotspot[] {
  const metrics = WAEC_SUBJECTS.map((s) =>
    metricsStore.getByStudentAndSubject(studentId, s) ?? calculateReadiness(studentId, s)
  );
  const diaries = diaryStore.getByStudent(studentId);
  const newHotspots: Hotspot[] = [];

  // Low readiness across the board
  const avgReadiness = metrics.reduce((a, m) => a + m.readinessScore, 0) / metrics.length;
  if (avgReadiness < 55) {
    newHotspots.push({
      id: uid(), studentId,
      category: 'low_readiness',
      severity: avgReadiness < 40 ? 'critical' : 'high',
      description: `Average WAEC readiness is ${avgReadiness.toFixed(0)}% — below threshold`,
      detectedAt: new Date().toISOString(),
    });
  }

  // Math weakness
  const mathMetric = metrics.find((m) => m.subject === 'Mathematics');
  if (mathMetric && mathMetric.readinessScore < 55) {
    newHotspots.push({
      id: uid(), studentId,
      category: 'math_weakness',
      severity: mathMetric.readinessScore < 40 ? 'critical' : 'high',
      description: `Mathematics readiness is ${mathMetric.readinessScore.toFixed(0)}%`,
      detectedAt: new Date().toISOString(),
    });
  }

  // English weakness
  const engMetric = metrics.find((m) => m.subject === 'English');
  if (engMetric && engMetric.readinessScore < 55) {
    newHotspots.push({
      id: uid(), studentId,
      category: 'english_weakness',
      severity: engMetric.readinessScore < 40 ? 'critical' : 'high',
      description: `English readiness is ${engMetric.readinessScore.toFixed(0)}%`,
      detectedAt: new Date().toISOString(),
    });
  }

  // Low engagement
  if (diaries.length > 0) {
    const engagementScores = diaries.map((d) => TRAIT_VALUE[d.behavioralTraits[BehavioralTrait.ENGAGEMENT]] ?? 0);
    const avgEngagement = engagementScores.reduce((a, b) => a + b, 0) / engagementScores.length;
    if (avgEngagement < 0.4) {
      newHotspots.push({
        id: uid(), studentId,
        category: 'low_engagement',
        severity: 'medium',
        description: `Low engagement score: ${(avgEngagement * 100).toFixed(0)}%`,
        detectedAt: new Date().toISOString(),
      });
    }
  }

  // Low attendance
  const recentDiaries = diaries.slice(0, 10);
  if (recentDiaries.length > 0) {
    const attendanceRate = recentDiaries.filter((d) => d.attendance.includes(studentId)).length / recentDiaries.length;
    if (attendanceRate < 0.7) {
      newHotspots.push({
        id: uid(), studentId,
        category: 'low_attendance',
        severity: attendanceRate < 0.5 ? 'critical' : 'medium',
        description: `Attendance rate: ${(attendanceRate * 100).toFixed(0)}% over last ${recentDiaries.length} lessons`,
        detectedAt: new Date().toISOString(),
      });
    }
  }

  newHotspots.forEach((h) => hotspotStore.save(h));
  return newHotspots;
}

// ============= Career Streaming =============
export function computeCareerRecommendation(studentId: string): CareerRecommendation {
  const metrics = metricsStore.getByStudent(studentId);
  const brainMap = brainMapStore.getByStudent(studentId);

  const getScore = (subject: string) =>
    metrics.find((m) => m.subject === subject)?.readinessScore ?? 0;

  const mathScore = getScore('Mathematics');
  const englishScore = getScore('English');
  const physicsScore = getScore('Physics');
  const chemScore = getScore('Chemistry');
  const bioScore = getScore('Biology');

  const scienceRating = mathScore * 0.35 + physicsScore * 0.30 + chemScore * 0.20 + bioScore * 0.15;
  const artsRating = englishScore * 0.50 + mathScore * 0.20 + (brainMap ? brainMap.behavioralTraits['collaboration'] * 30 : 0) * 0.30;
  const commercialRating = mathScore * 0.35 + englishScore * 0.35 + (brainMap ? brainMap.academicScore / 75 * 100 : 50) * 0.30;

  const ratings: Record<CareerPathway, number> = {
    Science: scienceRating,
    Arts: artsRating,
    Commercial: commercialRating,
  };
  const pathway = (Object.entries(ratings).sort((a, b) => b[1] - a[1])[0][0]) as CareerPathway;
  const total = Object.values(ratings).reduce((a, b) => a + b, 0);
  const confidence = Math.min(95, Math.max(50, Math.round((ratings[pathway] / (total / 3)) * 65)));

  const reasons: string[] = [];
  if (pathway === 'Science') {
    if (mathScore >= 55) reasons.push(`Mathematics: ${mathScore.toFixed(0)}% — strong quantitative foundation`);
    if (physicsScore >= 50) reasons.push(`Physics: ${physicsScore.toFixed(0)}% — spatial-mechanical aptitude`);
    if (chemScore >= 50) reasons.push(`Chemistry: ${chemScore.toFixed(0)}% — applied science readiness`);
  } else if (pathway === 'Arts') {
    if (englishScore >= 55) reasons.push(`English: ${englishScore.toFixed(0)}% — verbal-creative strength`);
    reasons.push(`Highest engagement in language and humanities topics`);
    if (brainMap && brainMap.behavioralTraits['collaboration'] > 0.6) reasons.push('Strong collaboration and communication traits');
  } else {
    if (mathScore >= 50) reasons.push(`Mathematics: ${mathScore.toFixed(0)}% — adequate numeracy`);
    if (englishScore >= 50) reasons.push(`English: ${englishScore.toFixed(0)}% — good communication skills`);
    reasons.push('Balanced analytical and verbal profile suited for business studies');
  }

  return careerStore.save({
    studentId, pathway, confidence, reasons,
    subjectScores: { Mathematics: mathScore, English: englishScore, Physics: physicsScore, Chemistry: chemScore, Biology: bioScore },
    computedAt: new Date().toISOString(),
  });
}

// ============= Full recompute for a student =============
export function recomputeStudent(studentId: string): void {
  WAEC_SUBJECTS.forEach((subject) => calculateReadiness(studentId, subject));
  calculateBrainMap(studentId);
  detectHotspots(studentId);
  computeCareerRecommendation(studentId);
}
