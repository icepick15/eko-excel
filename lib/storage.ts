import type {
  User, District, School, Student, TopicSegment,
  DiaryEntry, ReadinessMetric, BrainMapProfile, Hotspot,
  QuizQuestion, QuizAttempt, CareerRecommendation,
} from './types';

// Storage keys
const KEYS = {
  users: 'eko_users',
  districts: 'eko_districts',
  schools: 'eko_schools',
  students: 'eko_students',
  topics: 'eko_topics',
  diaries: 'eko_diaries',
  metrics: 'eko_metrics',
  brainMaps: 'eko_brain_maps',
  hotspots: 'eko_hotspots',
  currentUser: 'eko_current_user',
  seeded: 'eko_seeded',
};

function get<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(key) || '[]') as T[];
  } catch {
    return [];
  }
}

function set<T>(key: string, data: T[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(data));
}

function upsert<T extends { id: string }>(key: string, item: T): T {
  const all = get<T>(key);
  const idx = all.findIndex((x) => x.id === item.id);
  if (idx >= 0) all[idx] = item;
  else all.push(item);
  set(key, all);
  return item;
}

// ============= Auth =============
export const auth = {
  login(phone: string): User | null {
    const users = get<User>(KEYS.users);
    return users.find((u) => u.phone === phone) ?? null;
  },
  current(): User | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(KEYS.currentUser);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  },
  setCurrentUser(user: User): void {
    localStorage.setItem(KEYS.currentUser, JSON.stringify(user));
  },
  logout(): void {
    localStorage.removeItem(KEYS.currentUser);
  },
};

// ============= Districts =============
export const districtStore = {
  getAll: () => get<District>(KEYS.districts),
  getById: (id: string) => get<District>(KEYS.districts).find((d) => d.id === id),
  save: (d: District) => upsert(KEYS.districts, d),
};

// ============= Schools =============
export const schoolStore = {
  getAll: () => get<School>(KEYS.schools),
  getById: (id: string) => get<School>(KEYS.schools).find((s) => s.id === id),
  getByDistrict: (districtId: string) => get<School>(KEYS.schools).filter((s) => s.districtId === districtId),
  save: (s: School) => upsert(KEYS.schools, s),
};

// ============= Students =============
export const studentStore = {
  getAll: () => get<Student>(KEYS.students),
  getById: (id: string) => get<Student>(KEYS.students).find((s) => s.id === id),
  getBySchool: (schoolId: string) => get<Student>(KEYS.students).filter((s) => s.schoolId === schoolId),
  getByDistrict: (districtId: string) => {
    const schools = schoolStore.getByDistrict(districtId).map((s) => s.id);
    return get<Student>(KEYS.students).filter((s) => schools.includes(s.schoolId));
  },
  save: (s: Student) => upsert(KEYS.students, s),
};

// ============= Topics =============
export const topicStore = {
  getAll: () => get<TopicSegment>(KEYS.topics),
  getById: (id: string) => get<TopicSegment>(KEYS.topics).find((t) => t.id === id),
  getBySubject: (subject: string) => get<TopicSegment>(KEYS.topics).filter((t) => t.subject === subject),
  save: (t: TopicSegment) => upsert(KEYS.topics, t),
};

// ============= Diary Entries =============
export const diaryStore = {
  getAll: () => get<DiaryEntry>(KEYS.diaries),
  getByStudent: (studentId: string) =>
    get<DiaryEntry>(KEYS.diaries)
      .filter((d) => d.studentId === studentId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  getByTeacher: (teacherId: string) =>
    get<DiaryEntry>(KEYS.diaries)
      .filter((d) => d.teacherId === teacherId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  save: (d: DiaryEntry) => upsert(KEYS.diaries, d),
};

// ============= Computed Metrics =============
export const metricsStore = {
  getAll: () => get<ReadinessMetric>(KEYS.metrics),
  getByStudent: (studentId: string) => get<ReadinessMetric>(KEYS.metrics).filter((m) => m.studentId === studentId),
  getByStudentAndSubject: (studentId: string, subject: string) =>
    get<ReadinessMetric>(KEYS.metrics).find((m) => m.studentId === studentId && m.subject === subject),
  save: (m: ReadinessMetric) => {
    const all = get<ReadinessMetric>(KEYS.metrics);
    const idx = all.findIndex((x) => x.studentId === m.studentId && x.subject === m.subject);
    if (idx >= 0) all[idx] = m;
    else all.push(m);
    set(KEYS.metrics, all);
    return m;
  },
};

// ============= Brain Map =============
export const brainMapStore = {
  getByStudent: (studentId: string) => get<BrainMapProfile>(KEYS.brainMaps).find((b) => b.studentId === studentId),
  save: (b: BrainMapProfile) => {
    const all = get<BrainMapProfile>(KEYS.brainMaps);
    const idx = all.findIndex((x) => x.studentId === b.studentId);
    if (idx >= 0) all[idx] = b;
    else all.push(b);
    set(KEYS.brainMaps, all);
    return b;
  },
};

// ============= Hotspots =============
export const hotspotStore = {
  getAll: () => get<Hotspot>(KEYS.hotspots).filter((h) => !h.resolvedAt),
  getByStudent: (studentId: string) =>
    get<Hotspot>(KEYS.hotspots).filter((h) => h.studentId === studentId && !h.resolvedAt),
  getBySchool: (schoolId: string) => {
    const studentIds = studentStore.getBySchool(schoolId).map((s) => s.id);
    return get<Hotspot>(KEYS.hotspots).filter((h) => studentIds.includes(h.studentId) && !h.resolvedAt);
  },
  save: (h: Hotspot) => upsert(KEYS.hotspots, h),
  resolve: (id: string) => {
    const all = get<Hotspot>(KEYS.hotspots);
    const idx = all.findIndex((h) => h.id === id);
    if (idx >= 0) {
      all[idx].resolvedAt = new Date().toISOString();
      set(KEYS.hotspots, all);
    }
  },
};

// ============= Seed flag =============
export const seedStore = {
  isSeeded: () => localStorage.getItem(KEYS.seeded) === 'true',
  markSeeded: () => localStorage.setItem(KEYS.seeded, 'true'),
};

// ============= Users =============
export const userStore = {
  getAll: () => get<User>(KEYS.users),
  getBySchool: (schoolId: string) => get<User>(KEYS.users).filter((u) => u.schoolId === schoolId),
  addMany: (newUsers: User[]) => {
    const existing = get<User>(KEYS.users);
    const ids = new Set(existing.map((u) => u.id));
    const toAdd = newUsers.filter((u) => !ids.has(u.id));
    if (toAdd.length > 0) set(KEYS.users, [...existing, ...toAdd]);
  },
};

// ============= Quiz Questions =============
export const quizQuestionStore = {
  getAll: () => get<QuizQuestion>('eko_quiz_questions'),
  getByTopic: (topicId: string) => get<QuizQuestion>('eko_quiz_questions').filter((q) => q.topicId === topicId),
  getBySubject: (subject: string) => get<QuizQuestion>('eko_quiz_questions').filter((q) => q.subject === subject),
  saveMany: (questions: QuizQuestion[]) => {
    const existing = get<QuizQuestion>('eko_quiz_questions');
    const ids = new Set(existing.map((q) => q.id));
    const toAdd = questions.filter((q) => !ids.has(q.id));
    if (toAdd.length > 0) set('eko_quiz_questions', [...existing, ...toAdd]);
  },
};

// ============= Quiz Attempts =============
export const quizAttemptStore = {
  getByStudent: (studentId: string) =>
    get<QuizAttempt>('eko_quiz_attempts')
      .filter((a) => a.studentId === studentId)
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()),
  getByStudentAndTopic: (studentId: string, topicId: string) =>
    get<QuizAttempt>('eko_quiz_attempts')
      .filter((a) => a.studentId === studentId && a.topicId === topicId)
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()),
  save: (a: QuizAttempt) => upsert('eko_quiz_attempts', a),
};

// ============= Career Recommendations =============
export const careerStore = {
  getByStudent: (studentId: string) =>
    get<CareerRecommendation>('eko_career').find((c) => c.studentId === studentId),
  save: (c: CareerRecommendation) => {
    const all = get<CareerRecommendation>('eko_career');
    const idx = all.findIndex((x) => x.studentId === c.studentId);
    if (idx >= 0) all[idx] = c;
    else all.push(c);
    set('eko_career', all);
    return c;
  },
};
