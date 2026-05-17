import { Role, BehavioralTrait } from './types';
import type { User, District, School, Student, TopicSegment, DiaryEntry } from './types';
import {
  districtStore, schoolStore, studentStore, topicStore,
  diaryStore, seedStore,
} from './storage';

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

export function seedData(): void {
  if (typeof window === 'undefined') return;
  if (seedStore.isSeeded()) return;

  // Districts
  const districts: District[] = [
    { id: 'dist-1', name: 'Education District I (Lagos Island)' },
    { id: 'dist-2', name: 'Education District II (Eti-Osa)' },
    { id: 'dist-3', name: 'Education District III (Ikorodu)' },
  ];
  districts.forEach((d) => districtStore.save(d));

  // Schools
  const schools: School[] = [
    { id: 'sch-1', name: 'Lagos Model College, Meiran', districtId: 'dist-1', address: 'Meiran, Lagos' },
    { id: 'sch-2', name: 'Government College, Igbobi', districtId: 'dist-1', address: 'Igbobi, Lagos' },
    { id: 'sch-3', name: 'Ansar-Ud-Deen High School', districtId: 'dist-2', address: 'Isale-Eko, Lagos' },
  ];
  schools.forEach((s) => schoolStore.save(s));

  // Users
  const users: User[] = [
    {
      id: 'user-teacher-1', phone: '08012345678', name: 'Mrs. Adaeze Okonkwo',
      role: Role.TEACHER, schoolId: 'sch-1', createdAt: daysAgo(60),
    },
    {
      id: 'user-teacher-2', phone: '08023456789', name: 'Mr. Babatunde Alli',
      role: Role.TEACHER, schoolId: 'sch-1', createdAt: daysAgo(60),
    },
    {
      id: 'user-head-1', phone: '08034567890', name: 'Mr. Emmanuel Chukwu',
      role: Role.HEADTEACHER, schoolId: 'sch-1', createdAt: daysAgo(90),
    },
    {
      id: 'user-district-1', phone: '08045678901', name: 'Dr. Fatima Sule',
      role: Role.DISTRICT, districtId: 'dist-1', createdAt: daysAgo(120),
    },
    {
      id: 'user-ministry-1', phone: '08056789012', name: 'Hon. Gbenga Adewale',
      role: Role.MINISTRY, createdAt: daysAgo(180),
    },
  ];
  if (typeof window !== 'undefined') {
    localStorage.setItem('eko_users', JSON.stringify(users));
  }

  // Students
  const studentNames = [
    'Abiodun Fashola', 'Chidinma Obi', 'Emeka Nwosu', 'Funmilayo Adeleke',
    'Gbenga Coker', 'Halima Yusuf', 'Ikenna Eze', 'Jumoke Bello',
    'Kayode Adesanya', 'Lara Okafor',
  ];
  const classes = ['SS1', 'SS2', 'SS3'];
  const students: Student[] = studentNames.map((name, i) => ({
    id: `stu-${i + 1}`,
    name,
    schoolId: 'sch-1',
    class: classes[i % 3],
    enrolledDate: daysAgo(300),
  }));
  students.forEach((s) => studentStore.save(s));

  // Topics
  const topicData: Array<[string, string, number]> = [
    ['Mathematics', 'Algebra & Quadratic Equations', 0.85],
    ['Mathematics', 'Trigonometry', 0.78],
    ['Mathematics', 'Statistics & Probability', 0.72],
    ['English', 'Comprehension & Summary', 0.90],
    ['English', 'Essay Writing', 0.85],
    ['English', 'Grammar & Usage', 0.80],
    ['Physics', 'Mechanics & Motion', 0.75],
    ['Physics', 'Electricity & Magnetism', 0.70],
    ['Chemistry', 'Organic Chemistry', 0.80],
    ['Chemistry', 'Acids, Bases & Salts', 0.75],
    ['Biology', 'Cell Biology & Genetics', 0.85],
    ['Biology', 'Ecology & Environment', 0.70],
  ];
  const topics: TopicSegment[] = topicData.map(([subject, topic, freq], i) => ({
    id: `topic-${i + 1}`,
    subject,
    topic,
    waecFrequency: freq,
    weight: freq,
  }));
  topics.forEach((t) => topicStore.save(t));

  // Diary Entries (seed historical data)
  const traitValues: Array<'high' | 'medium' | 'low'> = ['high', 'medium', 'low'];
  const traits = Object.values(BehavioralTrait);

  const diaries: DiaryEntry[] = [];
  students.forEach((student, si) => {
    // Each student gets ~8 diary entries spread over the last 30 days
    for (let day = 0; day < 8; day++) {
      const topicIdx = (si + day) % topics.length;
      const topic = topics[topicIdx];
      const baseScore = 40 + (si * 6) + (day * 2);
      const clampedScore = Math.min(95, Math.max(30, baseScore));
      const behavioralTraits = traits.reduce((acc, trait) => {
        acc[trait] = traitValues[(si + day) % 3];
        return acc;
      }, {} as Record<BehavioralTrait, 'high' | 'medium' | 'low'>);

      diaries.push({
        id: uid(),
        idempotencyKey: `${student.id}-${topic.id}-day${day}`,
        studentId: student.id,
        teacherId: 'user-teacher-1',
        topicId: topic.id,
        classScore: clampedScore,
        attendance: students.filter((_, idx) => idx !== (si + day) % students.length).map((s) => s.id),
        behavioralTraits,
        createdAt: daysAgo(30 - day * 4),
      });
    }
  });
  diaries.forEach((d) => diaryStore.save(d));

  seedStore.markSeeded();
}
