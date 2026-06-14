import type { User, Notification } from './types';
import { Role } from './types';
import { SCORE_YELLOW } from './calculations';
import {
  diaryStore, tcsStore, classStore, studentStore, metricsStore,
  hotspotStore, interventionStore, userStore, schoolStore, districtStore,
  notificationStore,
} from './storage';
import { getTeacherComplianceThisWeek, getSchoolReadinessAvg } from './calculations';

function isoWeekStart(date: Date): string {
  const d = new Date(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

// Only save if this exact alert ID hasn't been seen before (preserves isRead state)
function saveIfNew(n: Notification): void {
  const existing = notificationStore.getByUser(n.userId);
  if (!existing.find((x) => x.id === n.id)) {
    notificationStore.save(n);
  }
}

// Throttle map — keyed by userId, stores last-run timestamp
const _alertsLastRun = new Map<string, number>();
const ALERTS_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function generateAlerts(user: User): void {
  if (typeof window === 'undefined') return;

  const now = Date.now();
  const lastRun = _alertsLastRun.get(user.id) ?? 0;
  if (now - lastRun < ALERTS_TTL_MS) return;
  _alertsLastRun.set(user.id, now);

  const today     = new Date().toISOString().slice(0, 10);
  const weekStart = isoWeekStart(new Date());

  if (user.role === Role.TEACHER || user.role === Role.HEADTEACHER) {
    generateTeacherAlerts(user, today, weekStart);
  }
  if (user.role === Role.HEADTEACHER || user.role === Role.SCHOOLADMIN) {
    generateSchoolAlerts(user, today, weekStart);
  }
  if (user.role === Role.DISTRICT) {
    generateDistrictAlerts(user, weekStart);
  }
  if (user.role === Role.MINISTRY) {
    generateMinistryAlerts(user, weekStart);
  }
  if (user.role === Role.PARENT) {
    generateParentAlerts(user, weekStart);
  }
}

// ── Teacher alerts ────────────────────────────────────────────────────────────

function generateTeacherAlerts(user: User, today: string, weekStart: string): void {
  const tcs      = tcsStore.getByTeacher(user.id);
  const classIds = [...new Set(tcs.map((t) => t.classId))];

  // Diary not logged today (weekdays only)
  const dow = new Date().getDay();
  if (dow >= 1 && dow <= 5) {
    for (const cId of classIds) {
      const cls = classStore.getById(cId);
      if (!cls) continue;
      for (const t of tcs.filter((t) => t.classId === cId)) {
        const logged = diaryStore.getByClassAndDate(cId, today)
          .some((d) => d.subject === t.subject && d.teacherId === user.id);
        if (!logged) {
          saveIfNew({
            id:        `diary-missing-${user.id}-${cId}-${t.subject.slice(0, 4)}-${today}`,
            userId:    user.id,
            type:      'nudge',
            title:     'Diary not logged today',
            body:      `${t.subject} for ${cls.level}${cls.section} hasn't been logged yet.`,
            isRead:    false,
            createdAt: new Date().toISOString(),
            deepLink:  '/diary',
          });
        }
      }
    }
  }

  // Students with RED readiness (< 40%) — alert once per student per week
  for (const cId of classIds) {
    for (const s of studentStore.getByClass(cId)) {
      const metrics = metricsStore.getByStudent(s.id);
      const red     = metrics.filter((m) => m.readinessScore < SCORE_YELLOW);
      if (red.length === 0) continue;
      const worst = red.sort((a, b) => a.readinessScore - b.readinessScore)[0];
      saveIfNew({
        id:        `student-red-${s.id}-${weekStart}`,
        userId:    user.id,
        type:      'hotspot',
        title:     `${s.name} at risk`,
        body:      `${worst.subject}: ${Math.round(worst.readinessScore)}% readiness — below the 40% threshold.`,
        isRead:    false,
        createdAt: new Date().toISOString(),
        deepLink:  `/students/${s.id}`,
      });
    }
  }

  // Overdue interventions assigned to me
  for (const iv of interventionStore.getByTeacher(user.id)) {
    if (iv.status !== 'completed' && iv.dueDate < today) {
      saveIfNew({
        id:        `overdue-iv-${iv.id}`,
        userId:    user.id,
        type:      'intervention',
        title:     'Intervention overdue',
        body:      `"${iv.description.slice(0, 70)}" was due on ${iv.dueDate}.`,
        isRead:    false,
        createdAt: new Date().toISOString(),
        deepLink:  '/interventions',
      });
    }
  }
}

// ── School admin / headteacher alerts ────────────────────────────────────────

function generateSchoolAlerts(user: User, today: string, weekStart: string): void {
  const sId     = user.schoolId ?? '';
  const teachers = userStore.getTeachers(sId);

  // Teachers with compliance < 70% this week
  for (const t of teachers) {
    const c = getTeacherComplianceThisWeek(t.id);
    if (c.required > 0 && c.rate < 70) {
      saveIfNew({
        id:        `compliance-low-${t.id}-${weekStart}`,
        userId:    user.id,
        type:      'query',
        title:     `Low compliance — ${t.name.split(' ')[0]}`,
        body:      `${t.name} logged ${c.submitted}/${c.required} diaries this week (${c.rate}%).`,
        isRead:    false,
        createdAt: new Date().toISOString(),
        deepLink:  '/school',
      });
    }
  }

  // Unresolved hotspots > 5 days with no intervention
  const covered = new Set(
    interventionStore.getBySchool(sId).map((iv) => iv.hotspotId).filter(Boolean) as string[]
  );
  for (const hs of hotspotStore.getAll().filter((h) => !h.resolvedAt)) {
    const student = studentStore.getById(hs.studentId);
    if (student?.schoolId !== sId) continue;
    const ageDays = Math.floor((Date.now() - new Date(hs.detectedAt).getTime()) / 86400000);
    if (ageDays >= 5 && !covered.has(hs.id)) {
      saveIfNew({
        id:        `hotspot-unaddressed-${hs.id}`,
        userId:    user.id,
        type:      'hotspot',
        title:     `Hotspot unaddressed — ${student.name}`,
        body:      `${hs.subject} (${Math.round(hs.readinessScore)}%) flagged ${ageDays} days ago with no intervention.`,
        isRead:    false,
        createdAt: new Date().toISOString(),
        deepLink:  '/hotspots',
      });
    }
  }

  // Classes with average readiness below threshold
  for (const cls of classStore.getBySchool(sId)) {
    const studs = studentStore.getByClass(cls.id);
    if (studs.length === 0) continue;
    const scores = studs.flatMap((s) => metricsStore.getByStudent(s.id).map((m) => m.readinessScore));
    if (scores.length === 0) continue;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (avg > 0 && avg < SCORE_YELLOW) {
      saveIfNew({
        id:        `class-red-${cls.id}-${weekStart}`,
        userId:    user.id,
        type:      'hotspot',
        title:     `${cls.level}${cls.section} below threshold`,
        body:      `Class average is ${Math.round(avg)}% — below the 40% readiness target.`,
        isRead:    false,
        createdAt: new Date().toISOString(),
        deepLink:  '/school',
      });
    }
  }
}

// ── District alerts ───────────────────────────────────────────────────────────

function generateDistrictAlerts(user: User, weekStart: string): void {
  const dId = user.districtId ?? '';

  for (const school of schoolStore.getByDistrict(dId)) {
    const avg = getSchoolReadinessAvg(school.id);
    if (avg > 0 && avg < SCORE_YELLOW) {
      saveIfNew({
        id:        `school-red-${school.id}-${weekStart}`,
        userId:    user.id,
        type:      'hotspot',
        title:     `${school.name.split(',')[0]} below threshold`,
        body:      `School average is ${Math.round(avg)}% — below the 40% readiness target.`,
        isRead:    false,
        createdAt: new Date().toISOString(),
        deepLink:  `/district?id=${dId}`,
      });
    }

    // Schools with low teacher compliance
    const teachers     = userStore.getTeachers(school.id);
    const lowCompliance = teachers.filter((t) => {
      const c = getTeacherComplianceThisWeek(t.id);
      return c.required > 0 && c.rate < 60;
    });
    if (lowCompliance.length > 0) {
      saveIfNew({
        id:        `school-compliance-${school.id}-${weekStart}`,
        userId:    user.id,
        type:      'query',
        title:     `Low compliance at ${school.name.split(',')[0]}`,
        body:      `${lowCompliance.length} teacher${lowCompliance.length > 1 ? 's' : ''} below 60% diary compliance this week.`,
        isRead:    false,
        createdAt: new Date().toISOString(),
        deepLink:  `/district?id=${dId}`,
      });
    }
  }
}

// ── Parent alerts ─────────────────────────────────────────────────────────────

function generateParentAlerts(user: User, weekStart: string): void {
  for (const childId of user.childIds ?? []) {
    const child = studentStore.getById(childId);
    if (!child) continue;
    const metrics = metricsStore.getByStudent(childId);
    const redMetrics = metrics.filter((m) => m.readinessScore < SCORE_YELLOW);
    if (redMetrics.length === 0) continue;
    const worst = redMetrics.sort((a, b) => a.readinessScore - b.readinessScore)[0];
    saveIfNew({
      id:        `parent-child-red-${childId}-${weekStart}`,
      userId:    user.id,
      type:      'hotspot',
      title:     `${child.name} needs attention`,
      body:      `${worst.subject}: ${Math.round(worst.readinessScore)}% readiness — below the 40% target. Consider speaking with their teacher.`,
      isRead:    false,
      createdAt: new Date().toISOString(),
      deepLink:  '/parent',
    });
  }
}

// ── Ministry alerts ───────────────────────────────────────────────────────────

function generateMinistryAlerts(user: User, weekStart: string): void {
  for (const district of districtStore.getAll()) {
    const schools    = schoolStore.getByDistrict(district.id);
    const avgScores  = schools.map((s) => getSchoolReadinessAvg(s.id)).filter((a) => a > 0);
    if (avgScores.length === 0) continue;
    const distAvg = avgScores.reduce((a, b) => a + b, 0) / avgScores.length;
    if (distAvg < SCORE_YELLOW) {
      saveIfNew({
        id:        `district-red-${district.id}-${weekStart}`,
        userId:    user.id,
        type:      'hotspot',
        title:     `${district.name} district below threshold`,
        body:      `District average is ${Math.round(distAvg)}% — below the 40% target.`,
        isRead:    false,
        createdAt: new Date().toISOString(),
        deepLink:  `/district?id=${district.id}`,
      });
    }
  }
}
