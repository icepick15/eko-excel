import type {
  User, District, School, Class, TeacherClassSubject, TimetableSlot,
  Student, TopicSegment, DiaryEntry, StudentAttendance,
  ReadinessMetric, ReadinessSnapshot, BrainMapProfile,
  Hotspot, Intervention, Message, Notification, TermCalendar, AuditLog,
  QuizQuestion, StudentSeenQuestions, QuizAttempt, PracticeStreak,
  HomeworkAssignment, HomeworkSubmission, CareerRecommendation, ParentOptOut,
} from './types';

// ============= Storage keys =============
const K = {
  users:              'eko_users',
  districts:          'eko_districts',
  schools:            'eko_schools',
  classes:            'eko_classes',
  teacherClassSubj:   'eko_teacher_class_subj',
  timetable:          'eko_timetable',
  students:           'eko_students',
  topics:             'eko_topics',
  diaries:            'eko_diaries',
  attendance:         'eko_attendance',
  metrics:            'eko_metrics',
  snapshots:          'eko_snapshots',
  brainMaps:          'eko_brain_maps',
  hotspots:           'eko_hotspots',
  interventions:      'eko_interventions',
  messages:           'eko_messages',
  notifications:      'eko_notifications',
  termCalendars:      'eko_term_calendars',
  auditLogs:          'eko_audit_logs',
  quizQuestions:      'eko_quiz_questions',
  seenQuestions:      'eko_seen_questions',
  quizAttempts:       'eko_quiz_attempts',
  streaks:            'eko_streaks',
  homework:           'eko_homework',
  homeworkSubs:       'eko_homework_subs',
  career:             'eko_career',
  parentOptOut:       'eko_parent_optout',
  currentUser:        'eko_current_user',
  seeded:             'eko_seeded_v4',
} as const;

// ============= Generic helpers =============
function get<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(key) || '[]') as T[]; }
  catch { return []; }
}

function set<T>(key: string, data: T[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(data));
}

function upsert<T extends { id: string }>(key: string, item: T): T {
  const all = get<T>(key);
  const idx = all.findIndex((x) => x.id === item.id);
  if (idx >= 0) all[idx] = item; else all.push(item);
  set(key, all);
  return item;
}

function addMany<T extends { id: string }>(key: string, items: T[]): void {
  const existing = get<T>(key);
  const ids = new Set(existing.map((x) => x.id));
  const toAdd = items.filter((x) => !ids.has(x.id));
  if (toAdd.length > 0) set(key, [...existing, ...toAdd]);
}

// ============= Auth =============
export const auth = {
  login: (phone: string): User | null => {
    const norm = phone.replace(/^0/, '+234');
    const users = get<User>(K.users);
    return users.find((u) => u.phone === phone || u.phone === norm) ?? null;
  },
  current: (): User | null => {
    if (typeof window === 'undefined') return null;
    try { const r = localStorage.getItem(K.currentUser); return r ? JSON.parse(r) : null; }
    catch { return null; }
  },
  setCurrentUser: (u: User) => localStorage.setItem(K.currentUser, JSON.stringify(u)),
  logout: () => localStorage.removeItem(K.currentUser),
};

// ============= Districts =============
export const districtStore = {
  getAll:    ()       => get<District>(K.districts),
  getById:   (id: string) => get<District>(K.districts).find((d) => d.id === id),
  save:      (d: District) => upsert(K.districts, d),
  saveMany:  (items: District[]) => addMany(K.districts, items),
};

// ============= Schools =============
export const schoolStore = {
  getAll:        ()            => get<School>(K.schools),
  getById:       (id: string) => get<School>(K.schools).find((s) => s.id === id),
  getByDistrict: (dId: string) => get<School>(K.schools).filter((s) => s.districtId === dId),
  save:          (s: School)  => upsert(K.schools, s),
  saveMany:      (items: School[]) => addMany(K.schools, items),
};

// ============= Classes =============
export const classStore = {
  getAll:       ()            => get<Class>(K.classes),
  getById:      (id: string) => get<Class>(K.classes).find((c) => c.id === id),
  getBySchool:  (sId: string) => get<Class>(K.classes).filter((c) => c.schoolId === sId),
  save:         (c: Class)   => upsert(K.classes, c),
  saveMany:     (items: Class[]) => addMany(K.classes, items),
};

// ============= TeacherClassSubjects =============
export const tcsStore = {
  getAll:        ()             => get<TeacherClassSubject>(K.teacherClassSubj),
  getByTeacher:  (tId: string)  => get<TeacherClassSubject>(K.teacherClassSubj).filter((x) => x.teacherId === tId),
  getByClass:    (cId: string)  => get<TeacherClassSubject>(K.teacherClassSubj).filter((x) => x.classId === cId),
  save:          (x: TeacherClassSubject) => upsert(K.teacherClassSubj, x),
  saveMany:      (items: TeacherClassSubject[]) => addMany(K.teacherClassSubj, items),
};

// ============= Timetable =============
export const timetableStore = {
  getAll:     ()             => get<TimetableSlot>(K.timetable),
  getByClass: (cId: string)  => get<TimetableSlot>(K.timetable).filter((s) => s.classId === cId),
  getByDay:   (cId: string, day: number) =>
    get<TimetableSlot>(K.timetable)
      .filter((s) => s.classId === cId && s.dayOfWeek === day)
      .sort((a, b) => a.period - b.period),
  save:       (s: TimetableSlot) => upsert(K.timetable, s),
  saveMany:   (items: TimetableSlot[]) => addMany(K.timetable, items),
};

// ============= Students =============
export const studentStore = {
  getAll:        ()             => get<Student>(K.students),
  getById:       (id: string)   => get<Student>(K.students).find((s) => s.id === id),
  getBySchool:   (sId: string)  => get<Student>(K.students).filter((s) => s.schoolId === sId && s.isActive !== false),
  getByClass:    (cId: string)  => get<Student>(K.students).filter((s) => s.classId === cId && s.isActive !== false),
  getByDistrict: (dId: string)  => {
    const schoolIds = schoolStore.getByDistrict(dId).map((s) => s.id);
    return get<Student>(K.students).filter((s) => schoolIds.includes(s.schoolId) && s.isActive !== false);
  },
  save:          (s: Student)   => upsert(K.students, s),
  saveMany:      (items: Student[]) => addMany(K.students, items),
  archive:       (id: string)   => {
    const all = get<Student>(K.students);
    const idx = all.findIndex((s) => s.id === id);
    if (idx >= 0) { all[idx].isActive = false; set(K.students, all); }
  },
};

// ============= Users =============
export const userStore = {
  getAll:       ()             => get<User>(K.users),
  getById:      (id: string)   => get<User>(K.users).find((u) => u.id === id),
  getBySchool:  (sId: string)  => get<User>(K.users).filter((u) => u.schoolId === sId),
  getTeachers:  (sId: string)  => get<User>(K.users).filter((u) => u.schoolId === sId && (u.role === 'teacher' || u.role === 'headteacher')),
  save:         (u: User)      => upsert(K.users, u),
  saveMany:     (items: User[]) => addMany(K.users, items),
  deactivate:   (id: string)   => {
    const all = get<User>(K.users);
    const idx = all.findIndex((u) => u.id === id);
    if (idx >= 0) { all[idx].isActive = false; set(K.users, all); }
  },
};

// ============= Topics =============
export const topicStore = {
  getAll:        ()                         => get<TopicSegment>(K.topics),
  getById:       (id: string)               => get<TopicSegment>(K.topics).find((t) => t.id === id),
  getBySubject:  (subject: string)          => get<TopicSegment>(K.topics).filter((t) => t.subject === subject),
  getByLevel:    (level: string)            => get<TopicSegment>(K.topics).filter((t) => t.classLevel === level),
  save:          (t: TopicSegment)          => upsert(K.topics, t),
  saveMany:      (items: TopicSegment[])    => addMany(K.topics, items),
};

// ============= Diary Entries =============
export const diaryStore = {
  getAll:        ()             => get<DiaryEntry>(K.diaries),
  getById:       (id: string)   => get<DiaryEntry>(K.diaries).find((d) => d.id === id),
  getByClass:    (cId: string)  =>
    get<DiaryEntry>(K.diaries)
      .filter((d) => d.classId === cId)
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()),
  getByTeacher:  (tId: string)  =>
    get<DiaryEntry>(K.diaries)
      .filter((d) => d.teacherId === tId)
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()),
  getByTeacherToday: (tId: string) => {
    const today = new Date().toISOString().slice(0, 10);
    return get<DiaryEntry>(K.diaries).filter(
      (d) => d.teacherId === tId && d.submittedAt.startsWith(today)
    );
  },
  getByClassAndDate: (cId: string, date: string) =>
    get<DiaryEntry>(K.diaries).filter((d) => d.classId === cId && d.submittedAt.startsWith(date)),
  save:          (d: DiaryEntry) => upsert(K.diaries, d),
};

// ============= Student Attendance =============
export const attendanceStore = {
  getByStudent: (sId: string) =>
    get<StudentAttendance>(K.attendance)
      .filter((a) => a.studentId === sId)
      .sort((a, b) => b.date.localeCompare(a.date)),
  getByStudentAndRange: (sId: string, from: string, to: string) =>
    get<StudentAttendance>(K.attendance)
      .filter((a) => a.studentId === sId && a.date >= from && a.date <= to),
  saveMany: (items: StudentAttendance[]) => {
    const existing = get<StudentAttendance>(K.attendance);
    const keys = new Set(existing.map((a) => `${a.studentId}_${a.date}`));
    const toAdd = items.filter((a) => !keys.has(`${a.studentId}_${a.date}`));
    if (toAdd.length > 0) set(K.attendance, [...existing, ...toAdd]);
  },
};

// ============= Readiness Metrics (latest per student×subject) =============
export const metricsStore = {
  getAll:                ()                          => get<ReadinessMetric>(K.metrics),
  getByStudent:          (sId: string)               => get<ReadinessMetric>(K.metrics).filter((m) => m.studentId === sId),
  getByStudentAndSubject:(sId: string, subj: string) =>
    get<ReadinessMetric>(K.metrics).find((m) => m.studentId === sId && m.subject === subj),
  save: (m: ReadinessMetric) => {
    const all = get<ReadinessMetric>(K.metrics);
    const idx = all.findIndex((x) => x.studentId === m.studentId && x.subject === m.subject);
    if (idx >= 0) all[idx] = m; else all.push(m);
    set(K.metrics, all);
    return m;
  },
};

// ============= Readiness Snapshots (history for trend charts) =============
export const snapshotStore = {
  getByStudent:          (sId: string)               =>
    get<ReadinessSnapshot>(K.snapshots)
      .filter((s) => s.studentId === sId)
      .sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate)),
  getByStudentAndSubject:(sId: string, subj: string) =>
    get<ReadinessSnapshot>(K.snapshots)
      .filter((s) => s.studentId === sId && s.subject === subj)
      .sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate)),
  save: (s: ReadinessSnapshot) => {
    // One snapshot per student×subject×date
    const all = get<ReadinessSnapshot>(K.snapshots);
    const idx = all.findIndex(
      (x) => x.studentId === s.studentId && x.subject === s.subject && x.snapshotDate === s.snapshotDate
    );
    if (idx >= 0) all[idx] = s; else all.push(s);
    set(K.snapshots, all);
    return s;
  },
  saveMany: (items: ReadinessSnapshot[]) => addMany(K.snapshots, items),
};

// ============= Brain Maps =============
export const brainMapStore = {
  getByStudent: (sId: string) => get<BrainMapProfile>(K.brainMaps).find((b) => b.studentId === sId),
  save: (b: BrainMapProfile) => {
    const all = get<BrainMapProfile>(K.brainMaps);
    const idx = all.findIndex((x) => x.studentId === b.studentId);
    if (idx >= 0) all[idx] = b; else all.push(b);
    set(K.brainMaps, all);
    return b;
  },
};

// ============= Hotspots =============
export const hotspotStore = {
  getAll:       ()             => get<Hotspot>(K.hotspots),
  getOpen:      ()             => get<Hotspot>(K.hotspots).filter((h) => !h.resolvedAt),
  getByStudent: (sId: string)  => get<Hotspot>(K.hotspots).filter((h) => h.studentId === sId && !h.resolvedAt),
  getBySchool:  (sId: string)  => {
    const studentIds = new Set(studentStore.getBySchool(sId).map((s) => s.id));
    return get<Hotspot>(K.hotspots).filter((h) => studentIds.has(h.studentId) && !h.resolvedAt);
  },
  getByDistrict:(dId: string)  => {
    const studentIds = new Set(studentStore.getByDistrict(dId).map((s) => s.id));
    return get<Hotspot>(K.hotspots).filter((h) => studentIds.has(h.studentId) && !h.resolvedAt);
  },
  save:         (h: Hotspot)   => upsert(K.hotspots, h),
  resolve:      (id: string)   => {
    const all = get<Hotspot>(K.hotspots);
    const idx = all.findIndex((h) => h.id === id);
    if (idx >= 0) { all[idx].resolvedAt = new Date().toISOString(); set(K.hotspots, all); }
  },
};

// ============= Interventions =============
export const interventionStore = {
  getAll:       ()             => get<Intervention>(K.interventions),
  getBySchool:  (sId: string)  => get<Intervention>(K.interventions).filter((i) => i.schoolId === sId),
  getByStudent: (sId: string)  => get<Intervention>(K.interventions).filter((i) => i.studentId === sId),
  getByTeacher: (tId: string)  => get<Intervention>(K.interventions).filter((i) => i.assignedTo === tId),
  save:         (i: Intervention) => upsert(K.interventions, i),
  complete:     (id: string)   => {
    const all = get<Intervention>(K.interventions);
    const idx = all.findIndex((i) => i.id === id);
    if (idx >= 0) { all[idx].status = 'completed'; all[idx].completedAt = new Date().toISOString(); set(K.interventions, all); }
  },
};

// ============= Messages =============
export const messageStore = {
  getAll:        ()              => get<Message>(K.messages),
  getForUser:    (uId: string)   => get<Message>(K.messages).filter((m) => m.toUserId === uId).sort((a, b) => b.sentAt.localeCompare(a.sentAt)),
  getForSchool:  (sId: string)   => get<Message>(K.messages).filter((m) => m.toSchoolId === sId).sort((a, b) => b.sentAt.localeCompare(a.sentAt)),
  getUnreadCount:(uId: string)   => get<Message>(K.messages).filter((m) => m.toUserId === uId && !m.isRead).length,
  save:          (m: Message)    => upsert(K.messages, m),
  markRead:      (id: string)    => {
    const all = get<Message>(K.messages);
    const idx = all.findIndex((m) => m.id === id);
    if (idx >= 0) { all[idx].isRead = true; all[idx].readAt = new Date().toISOString(); set(K.messages, all); }
  },
  addReply: (msgId: string, reply: import('./types').MessageReply) => {
    const all = get<Message>(K.messages);
    const idx = all.findIndex((m) => m.id === msgId);
    if (idx >= 0) {
      if (!all[idx].replies) all[idx].replies = [];
      all[idx].replies!.push(reply);
      set(K.messages, all);
    }
  },
};

// ============= Notifications =============
export const notificationStore = {
  getByUser:    (uId: string)  => get<Notification>(K.notifications).filter((n) => n.userId === uId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  getUnread:    (uId: string)  => get<Notification>(K.notifications).filter((n) => n.userId === uId && !n.isRead),
  save:         (n: Notification) => upsert(K.notifications, n),
  markRead:     (id: string)   => {
    const all = get<Notification>(K.notifications);
    const idx = all.findIndex((n) => n.id === id);
    if (idx >= 0) { all[idx].isRead = true; set(K.notifications, all); }
  },
  markAllRead:  (uId: string)  => {
    const all = get<Notification>(K.notifications).map((n) => n.userId === uId ? { ...n, isRead: true } : n);
    set(K.notifications, all);
  },
};

// ============= Term Calendars =============
export const termCalendarStore = {
  getBySchool: (sId: string) => get<TermCalendar>(K.termCalendars).filter((t) => t.schoolId === sId),
  getCurrent:  (sId: string) => {
    const today = new Date().toISOString().slice(0, 10);
    return get<TermCalendar>(K.termCalendars).find(
      (t) => t.schoolId === sId && t.firstDay <= today && t.lastDay >= today
    );
  },
  save: (t: TermCalendar) => upsert(K.termCalendars, t),
  saveMany: (items: TermCalendar[]) => addMany(K.termCalendars, items),
};

// ============= Audit Logs =============
export const auditStore = {
  getAll:    ()             => get<AuditLog>(K.auditLogs).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  log:       (entry: AuditLog) => {
    const all = get<AuditLog>(K.auditLogs);
    all.push(entry);
    // Keep last 500 entries
    if (all.length > 500) all.splice(0, all.length - 500);
    set(K.auditLogs, all);
  },
};

// ============= Quiz Questions =============
export const quizQuestionStore = {
  getAll:       ()              => get<QuizQuestion>(K.quizQuestions),
  getById:      (id: string)    => get<QuizQuestion>(K.quizQuestions).find((q) => q.id === id),
  getByTopic:   (tId: string)   => get<QuizQuestion>(K.quizQuestions).filter((q) => q.topicId === tId),
  getBySubject: (subj: string)  => get<QuizQuestion>(K.quizQuestions).filter((q) => q.subject === subj),
  getWaecOnly:  ()              => get<QuizQuestion>(K.quizQuestions).filter((q) => !!q.waecYear),
  saveMany:     (items: QuizQuestion[]) => addMany(K.quizQuestions, items),
};

// ============= Seen Questions (per student) =============
export const seenQuestionsStore = {
  get: (sId: string): string[] => {
    const all = get<StudentSeenQuestions>(K.seenQuestions);
    return all.find((x) => x.studentId === sId)?.seenIds ?? [];
  },
  add: (sId: string, questionIds: string[]) => {
    const all = get<StudentSeenQuestions>(K.seenQuestions);
    const idx = all.findIndex((x) => x.studentId === sId);
    if (idx >= 0) {
      const merged = Array.from(new Set([...all[idx].seenIds, ...questionIds]));
      all[idx].seenIds = merged;
    } else {
      all.push({ studentId: sId, seenIds: questionIds });
    }
    set(K.seenQuestions, all);
  },
  clear: (sId: string) => {
    const all = get<StudentSeenQuestions>(K.seenQuestions).filter((x) => x.studentId !== sId);
    set(K.seenQuestions, all);
  },
};

// ============= Quiz Attempts =============
export const quizAttemptStore = {
  getByStudent:          (sId: string)              =>
    get<QuizAttempt>(K.quizAttempts)
      .filter((a) => a.studentId === sId)
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()),
  getByStudentAndSubject:(sId: string, subj: string) =>
    get<QuizAttempt>(K.quizAttempts).filter((a) => a.studentId === sId && a.subject === subj),
  getByStudentAndTopic:  (sId: string, tId: string) =>
    get<QuizAttempt>(K.quizAttempts).filter((a) => a.studentId === sId && a.topicId === tId),
  save: (a: QuizAttempt) => upsert(K.quizAttempts, a),
};

// ============= Practice Streaks =============
export const streakStore = {
  get: (sId: string): PracticeStreak => {
    const all = get<PracticeStreak>(K.streaks);
    return all.find((x) => x.studentId === sId) ?? { studentId: sId, currentStreak: 0, lastPracticeDate: '', longestStreak: 0 };
  },
  update: (sId: string) => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const all = get<PracticeStreak>(K.streaks);
    const idx = all.findIndex((x) => x.studentId === sId);
    const streak = idx >= 0 ? all[idx] : { studentId: sId, currentStreak: 0, lastPracticeDate: '', longestStreak: 0 };
    if (streak.lastPracticeDate === today) return; // already counted today
    streak.currentStreak = streak.lastPracticeDate === yesterday ? streak.currentStreak + 1 : 1;
    streak.longestStreak = Math.max(streak.longestStreak, streak.currentStreak);
    streak.lastPracticeDate = today;
    if (idx >= 0) all[idx] = streak; else all.push(streak);
    set(K.streaks, all);
  },
};

// ============= Homework =============
export const homeworkStore = {
  getAll:       ()             => get<HomeworkAssignment>(K.homework),
  getByClass:   (cId: string)  => get<HomeworkAssignment>(K.homework).filter((h) => h.classId === cId),
  getByTeacher: (tId: string)  => get<HomeworkAssignment>(K.homework).filter((h) => h.teacherId === tId),
  getActive:    (cId: string)  => {
    const today = new Date().toISOString().slice(0, 10);
    return get<HomeworkAssignment>(K.homework).filter(
      (h) => h.classId === cId && h.status === 'active' && h.deadlineDate >= today
    );
  },
  save:         (h: HomeworkAssignment) => upsert(K.homework, h),
};

export const homeworkSubStore = {
  getByHomework:  (hId: string)  => get<HomeworkSubmission>(K.homeworkSubs).filter((s) => s.homeworkId === hId),
  getByStudent:   (sId: string)  => get<HomeworkSubmission>(K.homeworkSubs).filter((s) => s.studentId === sId),
  hasSubmitted:   (hId: string, sId: string) =>
    get<HomeworkSubmission>(K.homeworkSubs).some((s) => s.homeworkId === hId && s.studentId === sId),
  save:           (s: HomeworkSubmission) => upsert(K.homeworkSubs, s),
};

// ============= Career Recommendations =============
export const careerStore = {
  getByStudent: (sId: string) => get<CareerRecommendation>(K.career).find((c) => c.studentId === sId),
  save: (c: CareerRecommendation) => {
    const all = get<CareerRecommendation>(K.career);
    const idx = all.findIndex((x) => x.studentId === c.studentId);
    if (idx >= 0) all[idx] = c; else all.push(c);
    set(K.career, all);
    return c;
  },
};

// ============= Parent Opt-Out =============
export const optOutStore = {
  isOptedOut: (phone: string) => get<ParentOptOut>(K.parentOptOut).some((x) => x.phone === phone),
  optOut: (phone: string) => {
    const all = get<ParentOptOut>(K.parentOptOut);
    if (!all.find((x) => x.phone === phone)) {
      all.push({ phone, optedOutAt: new Date().toISOString() });
      set(K.parentOptOut, all);
    }
  },
};

// ============= Seed flag =============
export const seedStore = {
  isSeeded:   () => typeof window !== 'undefined' && localStorage.getItem(K.seeded) === 'true',
  markSeeded: () => { if (typeof window !== 'undefined') localStorage.setItem(K.seeded, 'true'); },
  reset:      () => {
    if (typeof window === 'undefined') return;
    Object.values(K).forEach((k) => localStorage.removeItem(k));
  },
};
