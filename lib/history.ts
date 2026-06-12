import type { AcademicHistoryRecord, ClassLevel } from './types';
import { academicHistoryStore, studentStore, classStore, schoolStore } from './storage';

export const CLASS_LEVELS: ClassLevel[] = ['JSS1', 'JSS2', 'JSS3', 'SSS1', 'SSS2', 'SSS3'];

// Deterministic hash so a student's generated history is stable across renders/devices
function seeded(seedStr: string, min: number, max: number): number {
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) h = (h * 31 + seedStr.charCodeAt(i)) >>> 0;
  return min + (h % (max - min + 1));
}

function remarkFor(avg: number): string {
  if (avg >= 75) return 'Excellent';
  if (avg >= 65) return 'Very Good';
  if (avg >= 55) return 'Good';
  return 'Fair';
}

// Returns completed class-levels (JSS1 up to, but not including, the current class),
// most recent first. Generated deterministically on first access, then persisted.
export function getAcademicHistory(studentId: string): AcademicHistoryRecord[] {
  const existing = academicHistoryStore.getByStudent(studentId);
  if (existing.length > 0) return sortRecent(existing);

  const student = studentStore.getById(studentId);
  if (!student) return [];
  const cls = classStore.getById(student.classId);
  if (!cls) return [];

  const currentIdx = CLASS_LEVELS.indexOf(cls.level);
  if (currentIdx <= 0) return []; // JSS1 students have no prior history yet

  const school = schoolStore.getById(student.schoolId);
  const currentStartYear = parseInt(cls.academicYear.split('/')[0], 10);

  const records: AcademicHistoryRecord[] = CLASS_LEVELS.slice(0, currentIdx).map((level, i) => {
    const yearsBack = currentIdx - i;
    const startYear = currentStartYear - yearsBack;
    const base = seeded(`${studentId}-${level}`, 55, 80);
    const termAverages = [0, 1, 2].map((t) =>
      Math.min(95, base + seeded(`${studentId}-${level}-t${t}`, 0, 8))
    );
    const finalAverage = Math.round(termAverages.reduce((a, b) => a + b, 0) / 3);
    const classSize = seeded(`${studentId}-${level}-size`, 26, 34);
    return {
      id: `ah-${studentId}-${level}`,
      studentId,
      classLevel: level,
      academicYear: `${startYear}/${startYear + 1}`,
      schoolName: school?.name ?? 'Lagos State School',
      termAverages,
      finalAverage,
      positionInClass: seeded(`${studentId}-${level}-pos`, 1, Math.min(15, classSize)),
      classSize,
      promoted: true,
      remark: remarkFor(finalAverage),
    };
  });

  academicHistoryStore.saveMany(records);
  return sortRecent(records);
}

function sortRecent(records: AcademicHistoryRecord[]): AcademicHistoryRecord[] {
  return [...records].sort(
    (a, b) => CLASS_LEVELS.indexOf(b.classLevel) - CLASS_LEVELS.indexOf(a.classLevel)
  );
}
