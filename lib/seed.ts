import { Role, BehavioralTrait } from './types';
import type {
  User, District, School, Class, TeacherClassSubject, TimetableSlot,
  Student, TopicSegment, DiaryEntry, StudentAttendance, ReadinessSnapshot,
  QuizQuestion, TermCalendar, Message, HomeworkAssignment,
} from './types';
import {
  districtStore, schoolStore, classStore, tcsStore, timetableStore,
  studentStore, userStore, topicStore, diaryStore, attendanceStore,
  snapshotStore, quizQuestionStore, termCalendarStore, messageStore, seedStore,
  homeworkStore,
} from './storage';
import { recomputeStudent } from './calculations';

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}
function dateStr(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysOffset);
  return d.toISOString().slice(0, 10);
}

export function seedData(): void {
  if (typeof window === 'undefined') return;
  if (seedStore.isSeeded()) return;

  // ── Districts ──────────────────────────────────────────────────────
  const districts: District[] = [
    { id: 'dist-1', name: 'Education District I (Lagos Island)', lgaList: ['Lagos Island', 'Eti-Osa', 'Apapa'] },
    { id: 'dist-2', name: 'Education District II (Badagry)', lgaList: ['Badagry', 'Amuwo-Odofin', 'Ojo'] },
    { id: 'dist-3', name: 'Education District III (Ikorodu)', lgaList: ['Ikorodu', 'Kosofe', 'Somolu'] },
    { id: 'dist-4', name: 'Education District IV (Mushin)', lgaList: ['Mushin', 'Surulere', 'Agege'] },
    { id: 'dist-5', name: 'Education District V (Alimosho)', lgaList: ['Alimosho', 'Ifako-Ijaiye', 'Ikeja'] },
  ];
  districtStore.saveMany(districts);

  // ── Schools ────────────────────────────────────────────────────────
  const schools: School[] = [
    { id: 'sch-1', name: 'Lagos Model College, Meiran',      districtId: 'dist-1', lga: 'Lagos Island',  address: 'Meiran, Lagos',       schoolCode: 'LMC001', headteacherId: 'user-head-1' },
    { id: 'sch-2', name: 'Government College, Igbobi',        districtId: 'dist-1', lga: 'Eti-Osa',       address: 'Igbobi, Lagos',        schoolCode: 'GCI002', headteacherId: 'user-head-2' },
    { id: 'sch-3', name: 'Ansar-Ud-Deen High School',         districtId: 'dist-2', lga: 'Amuwo-Odofin',  address: 'Isale-Eko, Lagos',     schoolCode: 'ADH003', headteacherId: 'user-head-3' },
    { id: 'sch-4', name: 'Ikorodu High School',               districtId: 'dist-3', lga: 'Ikorodu',       address: 'Ikorodu, Lagos',       schoolCode: 'IHS004', headteacherId: 'user-head-4' },
    { id: 'sch-5', name: 'Mushin Senior High School',         districtId: 'dist-4', lga: 'Mushin',        address: 'Mushin, Lagos',        schoolCode: 'MSH005', headteacherId: 'user-head-5' },
  ];
  schoolStore.saveMany(schools);

  // ── Classes (sch-1 only — the logged-in school) ───────────────────
  const classes: Class[] = [
    { id: 'cls-jss1a', schoolId: 'sch-1', level: 'JSS1', section: 'A', academicYear: '2024/2025', formTeacherId: 'user-teacher-1' },
    { id: 'cls-jss2a', schoolId: 'sch-1', level: 'JSS2', section: 'A', academicYear: '2024/2025', formTeacherId: 'user-teacher-2' },
    { id: 'cls-jss3a', schoolId: 'sch-1', level: 'JSS3', section: 'A', academicYear: '2024/2025', formTeacherId: 'user-teacher-3' },
    { id: 'cls-sss1a', schoolId: 'sch-1', level: 'SSS1', section: 'A', academicYear: '2024/2025', formTeacherId: 'user-teacher-1' },
    { id: 'cls-sss1b', schoolId: 'sch-1', level: 'SSS1', section: 'B', academicYear: '2024/2025', formTeacherId: 'user-teacher-2' },
    { id: 'cls-sss2a', schoolId: 'sch-1', level: 'SSS2', section: 'A', academicYear: '2024/2025', formTeacherId: 'user-teacher-3' },
    { id: 'cls-sss3a', schoolId: 'sch-1', level: 'SSS3', section: 'A', academicYear: '2024/2025', formTeacherId: 'user-teacher-1' },
  ];
  classStore.saveMany(classes);
  // Stub classes for other schools
  schoolStore.getAll().filter(s => s.id !== 'sch-1').forEach(s => {
    ['JSS1','SSS1','SSS2','SSS3'].forEach((lvl, i) => {
      classStore.saveMany([{ id: `cls-${s.id}-${lvl}`, schoolId: s.id, level: lvl as 'JSS1', section: 'A', academicYear: '2024/2025' }]);
    });
  });

  // ── Users ──────────────────────────────────────────────────────────
  const users: User[] = [
    { id: 'user-teacher-1', phone: '08012345678', name: 'Mrs. Folasade Adebayo',    role: Role.TEACHER,      schoolId: 'sch-1', createdAt: daysAgo(90),  isActive: true },
    { id: 'user-teacher-2', phone: '08023456789', name: 'Mr. Babatunde Alli',     role: Role.TEACHER,      schoolId: 'sch-1', createdAt: daysAgo(90),  isActive: true },
    { id: 'user-teacher-3', phone: '08098765432', name: 'Mrs. Ngozi Eze',         role: Role.TEACHER,      schoolId: 'sch-1', createdAt: daysAgo(80),  isActive: true },
    { id: 'user-head-1',    phone: '08034567890', name: 'Mr. Olusegun Bakare',    role: Role.HEADTEACHER,  schoolId: 'sch-1', createdAt: daysAgo(120), isActive: true },
    { id: 'user-admin-1',   phone: '08034567891', name: 'Mrs. Kemi Adeyemi',      role: Role.SCHOOLADMIN,  schoolId: 'sch-1', createdAt: daysAgo(120), isActive: true },
    { id: 'user-head-2',    phone: '08034567892', name: 'Mr. Chukwuemeka Nwosu',  role: Role.HEADTEACHER,  schoolId: 'sch-2', createdAt: daysAgo(120), isActive: true },
    { id: 'user-head-3',    phone: '08034567893', name: 'Mrs. Aisha Mohammed',    role: Role.HEADTEACHER,  schoolId: 'sch-3', createdAt: daysAgo(120), isActive: true },
    { id: 'user-head-4',    phone: '08034567894', name: 'Mr. Rotimi Fadipe',      role: Role.HEADTEACHER,  schoolId: 'sch-4', createdAt: daysAgo(120), isActive: true },
    { id: 'user-head-5',    phone: '08034567895', name: 'Mrs. Bola Ogundimu',     role: Role.HEADTEACHER,  schoolId: 'sch-5', createdAt: daysAgo(120), isActive: true },
    { id: 'user-district-1',phone: '08045678901', name: 'Education District I Office',        role: Role.DISTRICT,     districtId: 'dist-1', createdAt: daysAgo(150), isActive: true },
    { id: 'user-district-2',phone: '08045678902', name: 'Education District II Office',     role: Role.DISTRICT,     districtId: 'dist-2', createdAt: daysAgo(150), isActive: true },
    { id: 'user-ministry-1',phone: '08056789012', name: 'Ministry of Education',    role: Role.MINISTRY,     createdAt: daysAgo(200), isActive: true },
    { id: 'user-student-1', phone: '08067890123', name: 'Abiodun Fashola',        role: Role.STUDENT,      schoolId: 'sch-1', studentId: 'stu-1',  createdAt: daysAgo(300), isActive: true },
    { id: 'user-student-2', phone: '08078901234', name: 'Chidinma Obi',           role: Role.STUDENT,      schoolId: 'sch-1', studentId: 'stu-2',  createdAt: daysAgo(300), isActive: true },
    { id: 'user-student-3', phone: '08079012345', name: 'Emeka Nwosu',            role: Role.STUDENT,      schoolId: 'sch-1', studentId: 'stu-3',  createdAt: daysAgo(300), isActive: true },
    { id: 'user-parent-1',  phone: '08089012345', name: 'Mr. Taiwo Fashola',      role: Role.PARENT,       childIds: ['stu-1'],         createdAt: daysAgo(300), isActive: true },
    { id: 'user-parent-2',  phone: '08090123456', name: 'Mrs. Grace Obi',         role: Role.PARENT,       childIds: ['stu-2', 'stu-3'],createdAt: daysAgo(300), isActive: true },
  ];
  if (typeof window !== 'undefined') localStorage.setItem('eko_users', JSON.stringify(users));

  // ── TeacherClassSubjects ───────────────────────────────────────────
  const tcs: TeacherClassSubject[] = [
    // Teacher 1: Mathematics (SSS1A, SSS3A, JSS1A)
    { id: 'tcs-1', teacherId: 'user-teacher-1', classId: 'cls-sss1a', subject: 'Mathematics' },
    { id: 'tcs-2', teacherId: 'user-teacher-1', classId: 'cls-sss3a', subject: 'Mathematics' },
    { id: 'tcs-3', teacherId: 'user-teacher-1', classId: 'cls-jss1a', subject: 'Mathematics' },
    // Teacher 2: English Language (SSS1B, JSS2A)
    { id: 'tcs-4', teacherId: 'user-teacher-2', classId: 'cls-sss1b', subject: 'English Language' },
    { id: 'tcs-5', teacherId: 'user-teacher-2', classId: 'cls-jss2a', subject: 'English Language' },
    // Teacher 3: Biology + Chemistry (SSS2A, JSS3A)
    { id: 'tcs-6', teacherId: 'user-teacher-3', classId: 'cls-sss2a', subject: 'Biology' },
    { id: 'tcs-7', teacherId: 'user-teacher-3', classId: 'cls-jss3a', subject: 'Basic Science' },
    { id: 'tcs-8', teacherId: 'user-teacher-3', classId: 'cls-sss2a', subject: 'Chemistry' },
  ];
  tcsStore.saveMany(tcs);

  // ── Timetable (Mon–Fri, 8 periods) ────────────────────────────────
  const slots: TimetableSlot[] = [
    // SSS1A — Mathematics (Mon p1, Wed p2, Fri p1)
    { id: 'tt-1', classId: 'cls-sss1a', teacherClassSubjectId: 'tcs-1', dayOfWeek: 1, period: 1, startTime: '08:00', endTime: '09:00' },
    { id: 'tt-2', classId: 'cls-sss1a', teacherClassSubjectId: 'tcs-1', dayOfWeek: 3, period: 2, startTime: '09:00', endTime: '10:00' },
    { id: 'tt-3', classId: 'cls-sss1a', teacherClassSubjectId: 'tcs-1', dayOfWeek: 5, period: 1, startTime: '08:00', endTime: '09:00' },
    // SSS3A — Mathematics
    { id: 'tt-4', classId: 'cls-sss3a', teacherClassSubjectId: 'tcs-2', dayOfWeek: 2, period: 1, startTime: '08:00', endTime: '09:00' },
    { id: 'tt-5', classId: 'cls-sss3a', teacherClassSubjectId: 'tcs-2', dayOfWeek: 4, period: 3, startTime: '10:00', endTime: '11:00' },
    // SSS1B — English Language
    { id: 'tt-6', classId: 'cls-sss1b', teacherClassSubjectId: 'tcs-4', dayOfWeek: 1, period: 2, startTime: '09:00', endTime: '10:00' },
    { id: 'tt-7', classId: 'cls-sss1b', teacherClassSubjectId: 'tcs-4', dayOfWeek: 3, period: 1, startTime: '08:00', endTime: '09:00' },
    // SSS2A — Biology
    { id: 'tt-8', classId: 'cls-sss2a', teacherClassSubjectId: 'tcs-6', dayOfWeek: 2, period: 2, startTime: '09:00', endTime: '10:00' },
    { id: 'tt-9', classId: 'cls-sss2a', teacherClassSubjectId: 'tcs-6', dayOfWeek: 5, period: 2, startTime: '09:00', endTime: '10:00' },
  ];
  timetableStore.saveMany(slots);

  // ── Students ───────────────────────────────────────────────────────
  const studentData: Array<[string, string, 'M'|'F', string, string, string]> = [
    // [id, name, gender, classId, dob, parentPhone]
    ['stu-1',  'Abiodun Fashola',    'M', 'cls-sss1a', '2009-03-15', '08089012345'],
    ['stu-2',  'Chidinma Obi',       'F', 'cls-sss1a', '2009-07-22', '08090123456'],
    ['stu-3',  'Emeka Nwosu',        'M', 'cls-sss1a', '2009-11-08', '08090123456'],
    ['stu-4',  'Funmilayo Adeleke',  'F', 'cls-sss1a', '2009-05-30', '08091234567'],
    ['stu-5',  'Gbenga Coker',       'M', 'cls-sss1a', '2008-12-01', '08092345678'],
    ['stu-6',  'Halima Yusuf',       'F', 'cls-sss1a', '2009-02-14', '08093456789'],
    ['stu-7',  'Ikenna Eze',         'M', 'cls-sss1b', '2009-09-19', '08094567890'],
    ['stu-8',  'Jumoke Bello',       'F', 'cls-sss1b', '2009-04-03', '08095678901'],
    ['stu-9',  'Kayode Adesanya',    'M', 'cls-sss1b', '2008-08-25', '08096789012'],
    ['stu-10', 'Lara Okafor',        'F', 'cls-sss1b', '2009-01-11', '08097890123'],
    ['stu-11', 'Musa Danjuma',       'M', 'cls-sss2a', '2008-06-17', '08098901234'],
    ['stu-12', 'Ngozi Chukwu',       'F', 'cls-sss2a', '2008-10-29', '08099012345'],
    ['stu-13', 'Olumide Bankole',    'M', 'cls-sss2a', '2007-12-05', '08010123456'],
    ['stu-14', 'Patricia Ogunleye',  'F', 'cls-sss2a', '2008-03-21', '08011234567'],
    ['stu-15', 'Quadri Lawal',       'M', 'cls-sss2a', '2008-07-09', '08012345679'],
    ['stu-16', 'Rachael Adeyemi',    'F', 'cls-sss3a', '2007-01-28', '08013456789'],
    ['stu-17', 'Samuel Okafor',      'M', 'cls-sss3a', '2007-05-14', '08014567890'],
    ['stu-18', 'Taiwo Afolabi',      'M', 'cls-sss3a', '2007-09-02', '08015678901'],
    ['stu-19', 'Uche Obiora',        'F', 'cls-sss3a', '2007-11-18', '08016789012'],
    ['stu-20', 'Victoria Eze',       'F', 'cls-sss3a', '2007-04-07', '08017890123'],
    ['stu-21', 'Wasiu Balogun',      'M', 'cls-jss1a', '2012-02-20', '08018901234'],
    ['stu-22', 'Xena Adeogun',       'F', 'cls-jss1a', '2012-06-11', '08019012345'],
    ['stu-23', 'Yemi Olawale',       'M', 'cls-jss1a', '2011-08-30', '08020123456'],
    ['stu-24', 'Zainab Musa',        'F', 'cls-jss1a', '2012-01-15', '08021234567'],
    ['stu-25', 'Adewale Ogundipe',   'M', 'cls-jss2a', '2011-04-04', '08022345678'],
    ['stu-26', 'Blessing Nwosu',     'F', 'cls-jss2a', '2011-10-22', '08023456780'],
    ['stu-27', 'Chukwudi Obi',       'M', 'cls-jss2a', '2011-12-08', '08024567891'],
    ['stu-28', 'Damilola Ajayi',     'F', 'cls-jss3a', '2010-03-17', '08025678902'],
    ['stu-29', 'Ebuka Chime',        'M', 'cls-jss3a', '2010-07-25', '08026789013'],
    ['stu-30', 'Fatima Abubakar',    'F', 'cls-jss3a', '2010-11-03', '08027890124'],
  ];
  const students: Student[] = studentData.map(([id, name, gender, classId, dob, parentPhone]) => ({
    id, name, gender, classId,
    schoolId: 'sch-1',
    dob, parentPhone,
    enrolledDate: daysAgo(300),
    consentSigned: true,
    isActive: true,
  }));
  studentStore.saveMany(students);

  // ── Topics (Lagos NERDC curriculum, with waecWeight 1–10) ─────────
  const topicData: Array<[string, string, string, number]> = [
    // [subject, level, topic, waecWeight]
    ['Mathematics',      'SSS1', 'Algebra & Quadratic Equations',    9],
    ['Mathematics',      'SSS1', 'Trigonometry',                     8],
    ['Mathematics',      'SSS1', 'Statistics & Probability',         7],
    ['Mathematics',      'SSS2', 'Sequences & Series',               7],
    ['Mathematics',      'SSS2', 'Coordinate Geometry',              7],
    ['Mathematics',      'SSS3', 'Calculus & Differentiation',       8],
    ['Mathematics',      'SSS3', 'Integration & Applications',       8],
    ['Mathematics',      'JSS1', 'Whole Numbers & Operations',       6],
    ['Mathematics',      'JSS2', 'Basic Algebra',                    6],
    ['Mathematics',      'JSS3', 'Mensuration & Geometry',           7],
    ['English Language', 'SSS1', 'Comprehension & Summary',          9],
    ['English Language', 'SSS1', 'Essay Writing',                    8],
    ['English Language', 'SSS1', 'Grammar & Usage',                  8],
    ['English Language', 'SSS2', 'Oral English & Phonetics',         7],
    ['English Language', 'SSS3', 'Literature & Comprehension',       9],
    ['English Language', 'JSS2', 'Comprehension & Vocabulary',       6],
    ['Physics',          'SSS1', 'Mechanics & Motion',               8],
    ['Physics',          'SSS1', 'Electricity & Magnetism',          8],
    ['Physics',          'SSS2', 'Waves & Sound',                    7],
    ['Physics',          'SSS2', 'Light & Optics',                   7],
    ['Chemistry',        'SSS2', 'Organic Chemistry',                9],
    ['Chemistry',        'SSS2', 'Acids, Bases & Salts',             8],
    ['Chemistry',        'SSS1', 'Atomic Structure',                 7],
    ['Biology',          'SSS2', 'Cell Biology & Genetics',          9],
    ['Biology',          'SSS2', 'Ecology & Environment',            7],
    ['Biology',          'SSS1', 'Nutrition & Digestion',            8],
    ['Basic Science',    'JSS3', 'Matter & Properties',              5],
    ['Basic Science',    'JSS1', 'Living & Non-living Things',       4],
  ];
  const topics: TopicSegment[] = topicData.map(([subject, level, topic, w], i) => ({
    id: `topic-${i + 1}`,
    subject,
    classLevel: level as 'SSS1',
    topic,
    waecWeight: w,
    waecFrequency: w / 10,
  }));
  topicStore.saveMany(topics);

  // ── Diary Entries (class-level, past 8 weeks) ─────────────────────
  const traitLevels = [1, 2, 3, 4, 5];
  const diaries: DiaryEntry[] = [];
  const attendanceRecords: StudentAttendance[] = [];
  const snapshots: ReadinessSnapshot[] = [];

  // Classes taught by teacher-1 (SSS1A Maths, SSS3A Maths)
  const classDiaryConfig = [
    { classId: 'cls-sss1a', teacherId: 'user-teacher-1', subject: 'Mathematics',      topicOffset: 0  },
    { classId: 'cls-sss3a', teacherId: 'user-teacher-1', subject: 'Mathematics',      topicOffset: 5  },
    { classId: 'cls-sss1b', teacherId: 'user-teacher-2', subject: 'English Language', topicOffset: 10 },
    { classId: 'cls-sss2a', teacherId: 'user-teacher-3', subject: 'Biology',          topicOffset: 23 },
    { classId: 'cls-sss2a', teacherId: 'user-teacher-3', subject: 'Chemistry',        topicOffset: 20 },
  ];

  for (const cfg of classDiaryConfig) {
    const classStudents = students.filter((s) => s.classId === cfg.classId);
    const subjectTopics = topics.filter((t) => t.subject === cfg.subject);

    for (let week = 0; week < 8; week++) {
      for (let day = 0; day < 3; day++) {
        const daysOffset = week * 7 + day * 2 + 1;
        const subDate = dateStr(daysOffset);
        const topic = subjectTopics[((week * 3 + day) % subjectTopics.length)];
        if (!topic) continue;

        // Vary performance: some classes struggling, some doing well
        const baseScore = cfg.classId === 'cls-sss3a' ? 72 :
                          cfg.classId === 'cls-sss2a' ? 58 : 65;
        const classScore = Math.min(100, Math.max(30, baseScore + (Math.random() * 20 - 10)));

        // Attendance: 85–95% attendance rate
        const presentStudents = classStudents.filter(() => Math.random() > 0.1);
        const absentStudents  = classStudents.filter((s) => !presentStudents.find((p) => p.id === s.id));

        const traitBase = cfg.classId === 'cls-sss1a' ? 3 : 2;
        const traits: Record<BehavioralTrait, number> = {
          [BehavioralTrait.ENGAGEMENT]:   Math.min(5, Math.max(1, traitBase + Math.round(Math.random() * 2 - 0.5))),
          [BehavioralTrait.PERSISTENCE]:  Math.min(5, Math.max(1, traitBase + Math.round(Math.random() * 2 - 0.5))),
          [BehavioralTrait.FOCUS]:        Math.min(5, Math.max(1, traitBase + Math.round(Math.random() * 2 - 0.5))),
          [BehavioralTrait.COLLABORATION]:Math.min(5, Math.max(1, traitBase + Math.round(Math.random() * 2 - 0.5))),
          [BehavioralTrait.RESILIENCE]:   Math.min(5, Math.max(1, traitBase + Math.round(Math.random() * 2 - 0.5))),
        };

        const diary: DiaryEntry = {
          id: uid(),
          teacherId: cfg.teacherId,
          classId: cfg.classId,
          subject: cfg.subject,
          topicIds: [topic.id],
          classScore: Math.round(classScore),
          presentStudentIds: presentStudents.map((s) => s.id),
          absentStudentIds:  absentStudents.map((s) => s.id),
          traits,
          submittedAt: new Date(Date.now() - daysOffset * 86400000).toISOString(),
          syncStatus: 'synced',
        };
        diaries.push(diary);

        // Student attendance records
        for (const s of presentStudents) {
          attendanceRecords.push({ id: uid(), studentId: s.id, diaryId: diary.id, date: subDate, status: 'present' });
        }
        for (const s of absentStudents) {
          attendanceRecords.push({ id: uid(), studentId: s.id, diaryId: diary.id, date: subDate, status: 'absent' });
        }
      }
    }
  }

  diaries.forEach((d) => diaryStore.save(d));
  attendanceStore.saveMany(attendanceRecords);

  // ── Term Calendar ──────────────────────────────────────────────────
  const terms: TermCalendar[] = [
    {
      id: 'term-1', schoolId: 'sch-1', academicYear: '2024/2025', term: 2,
      firstDay: '2025-01-13', lastDay: '2025-04-11',
      holidays: ['2025-01-13', '2025-03-18', '2025-04-18'],
      closureDays: [],
    },
  ];
  termCalendarStore.saveMany(terms);

  // ── Seed Messages (admin → teacher) ────────────────────────────────
  const msgs: Message[] = [
    {
      id: 'msg-1', fromUserId: 'user-head-1', fromRole: Role.HEADTEACHER, fromName: 'Mr. Olusegun Bakare',
      toUserId: 'user-teacher-1', subject: 'Diary Submission Reminder',
      body: 'Dear Mrs. Okonkwo, please ensure your Mathematics SSS1A diary is submitted daily before 4PM. Your compliance rate last week was 80%. Target is 90%+.',
      severity: 'warning', isRead: false, sentAt: daysAgo(2),
    },
    {
      id: 'msg-2', fromUserId: 'user-district-1', fromRole: Role.DISTRICT, fromName: 'Education District I Office',
      toUserId: 'user-teacher-1', subject: 'Support Query: Low Readiness — SSS1A Mathematics',
      body: 'Data shows SSS1A Mathematics readiness is below 60%. Please describe the interventions you have put in place this term. Response required by Friday.',
      severity: 'urgent', requiredResponseDate: dateStr(-3), isRead: false, sentAt: daysAgo(4),
    },
    {
      id: 'msg-3', fromUserId: 'user-head-1', fromRole: Role.HEADTEACHER, fromName: 'Mr. Olusegun Bakare',
      toUserId: 'user-teacher-2', subject: 'Well done — English Language',
      body: 'Your English Language SSS1B results have improved significantly this week. Attendance is at 92%. Keep it up!',
      severity: 'info', isRead: true, readAt: daysAgo(1), sentAt: daysAgo(3),
    },
  ];
  msgs.forEach((m) => messageStore.save(m));

  seedStore.markSeeded();

  // Compute metrics for all sch-1 students
  students.forEach((s) => recomputeStudent(s.id));
}

// ── Multi-school seed (schools 2–5) ───────────────────────────────────────────
export function seedMultiSchool(): void {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem('eko_seeded_multi_v1') === 'true') return;

  // ── Performance profiles ────────────────────────────────────────────
  // sch-2: high performer  (~72%)  dist-1 → green on ministry heatmap
  // sch-3: medium          (~56%)  dist-2 → yellow
  // sch-4: struggling      (~36%)  dist-3 → RED, triggers alerts
  // sch-5: medium-low      (~52%)  dist-4 → yellow

  type SchoolCfg = {
    schoolId: string;
    baseScore: number;   // mean classScore for diary entries
    variance: number;    // ±spread
    compliance: number;  // fraction of 3 sessions/week that get logged
    teachers: { id: string; name: string; phone: string; subject: string }[];
  };

  const configs: SchoolCfg[] = [
    {
      schoolId: 'sch-2', baseScore: 73, variance: 10, compliance: 0.92,
      teachers: [
        { id: 'user-t-s2-1', name: 'Mr. Seun Adeyemi',   phone: '08061111001', subject: 'Mathematics'      },
        { id: 'user-t-s2-2', name: 'Mrs. Titi Obaseki',  phone: '08061111002', subject: 'English Language' },
      ],
    },
    {
      schoolId: 'sch-3', baseScore: 56, variance: 12, compliance: 0.72,
      teachers: [
        { id: 'user-t-s3-1', name: 'Mr. Aliyu Garba',    phone: '08061111003', subject: 'Mathematics'      },
        { id: 'user-t-s3-2', name: 'Mrs. Nneka Igwe',    phone: '08061111004', subject: 'Biology'          },
      ],
    },
    {
      schoolId: 'sch-4', baseScore: 36, variance: 10, compliance: 0.52,
      teachers: [
        { id: 'user-t-s4-1', name: 'Mr. Godwin Efe',     phone: '08061111005', subject: 'Chemistry'        },
        { id: 'user-t-s4-2', name: 'Mrs. Shade Lemo',    phone: '08061111006', subject: 'English Language' },
      ],
    },
    {
      schoolId: 'sch-5', baseScore: 52, variance: 11, compliance: 0.80,
      teachers: [
        { id: 'user-t-s5-1', name: 'Mr. Emeka Okeke',    phone: '08061111007', subject: 'Physics'          },
        { id: 'user-t-s5-2', name: 'Mrs. Amina Bello',   phone: '08061111008', subject: 'Mathematics'      },
      ],
    },
  ];

  // ── Name pools ────────────────────────────────────────────────────────
  const maleFirst   = ['Adebayo','Chukwuma','Ismail','Tunde','Dele','Kola','Segun','Obinna','Hakeem','Femi','Dayo','Kunle'];
  const femaleFirst = ['Adeola','Chinwe','Fatima','Bimpe','Remi','Sade','Ifeoma','Kemi','Amaka','Hauwa','Toyin','Ngozi'];
  const surnames    = ['Adeyemi','Okafor','Bello','Lawal','Chukwu','Ibrahim','Eze','Afolabi','Nwosu','Salami','Ogundipe','Danjuma'];

  // ── Topic pools per subject ───────────────────────────────────────────
  const subjectTopics: Record<string, string[]> = {
    'Mathematics':      ['topic-1', 'topic-2', 'topic-3'],
    'English Language': ['topic-11', 'topic-12', 'topic-13'],
    'Biology':          ['topic-24', 'topic-25', 'topic-26'],
    'Chemistry':        ['topic-21', 'topic-22', 'topic-23'],
    'Physics':          ['topic-17', 'topic-18', 'topic-19'],
  };

  const classLevels = ['JSS1', 'SSS1', 'SSS2', 'SSS3'] as const;
  let stuIdx = 100; // stu-100 onward — no collision with sch-1's stu-1…stu-30

  for (const cfg of configs) {
    const { schoolId, baseScore, variance, compliance, teachers } = cfg;

    // 1. Teachers
    userStore.saveMany(teachers.map((t) => ({
      id: t.id, phone: t.phone, name: t.name,
      role: Role.TEACHER, schoolId,
      createdAt: daysAgo(90), isActive: true,
    })));

    // 2. TCS — each teacher covers SSS1A and SSS2A in their subject
    const teachingClasses = [`cls-${schoolId}-SSS1`, `cls-${schoolId}-SSS2`];
    const newTcs: TeacherClassSubject[] = [];
    for (const t of teachers) {
      teachingClasses.forEach((cId, ci) => {
        newTcs.push({ id: `tcs-${t.id}-${ci}`, teacherId: t.id, classId: cId, subject: t.subject });
      });
    }
    tcsStore.saveMany(newTcs);

    // 3. Timetable slots (Mon p1, Wed p2 per teacher/class pair) — needed for compliance calc
    const ttSlots: TimetableSlot[] = [];
    for (const tc of newTcs) {
      ttSlots.push(
        { id: `tt-${tc.id}-mon`, classId: tc.classId, teacherClassSubjectId: tc.id, dayOfWeek: 1, period: 1, startTime: '08:00', endTime: '09:00' },
        { id: `tt-${tc.id}-wed`, classId: tc.classId, teacherClassSubjectId: tc.id, dayOfWeek: 3, period: 2, startTime: '09:00', endTime: '10:00' },
        { id: `tt-${tc.id}-fri`, classId: tc.classId, teacherClassSubjectId: tc.id, dayOfWeek: 5, period: 1, startTime: '08:00', endTime: '09:00' },
      );
    }
    timetableStore.saveMany(ttSlots);

    // 4. Students — 5 per class level
    const schoolStudents: Student[] = [];
    for (const lvl of classLevels) {
      const classId = `cls-${schoolId}-${lvl}`;
      for (let i = 0; i < 5; i++) {
        const isMale = (stuIdx + i) % 2 === 0;
        const first  = isMale ? maleFirst[(stuIdx + i) % maleFirst.length] : femaleFirst[(stuIdx + i) % femaleFirst.length];
        const last   = surnames[(stuIdx + i) % surnames.length];
        const dobYear = lvl.startsWith('JSS') ? 2011 + Math.floor(i / 2) : 2008 + Math.floor(i / 2);
        const dobMon  = String(((stuIdx + i) % 12) + 1).padStart(2, '0');
        schoolStudents.push({
          id: `stu-${stuIdx + i}`,
          name: `${first} ${last}`,
          gender: isMale ? 'M' : 'F',
          classId, schoolId,
          dob: `${dobYear}-${dobMon}-15`,
          enrolledDate: daysAgo(300),
          consentSigned: true,
          isActive: true,
        });
      }
      stuIdx += 5;
    }
    studentStore.saveMany(schoolStudents);

    // 5. Diary entries — 8 weeks, up to 3 sessions/week (compliance-gated)
    const diaries: DiaryEntry[] = [];
    for (const tc of newTcs) {
      const clsStudents = schoolStudents.filter((s) => s.classId === tc.classId);
      if (clsStudents.length === 0) continue;
      const topics = subjectTopics[tc.subject] ?? ['topic-1'];

      for (let week = 0; week < 8; week++) {
        for (let day = 0; day < 3; day++) {
          // Skip some sessions based on compliance (creates realistic gaps)
          if (day > 0 && Math.random() > compliance) continue;

          const daysOffset  = week * 7 + day * 2 + 1;
          const topicId     = topics[(week * 3 + day) % topics.length];
          const classScore  = Math.min(100, Math.max(15, baseScore + (Math.random() * variance * 2 - variance)));
          const traitBase   = baseScore >= 70 ? 3 : 2;

          const present = clsStudents.filter(() => Math.random() > 0.1);
          const absent  = clsStudents.filter((s) => !present.find((p) => p.id === s.id));

          diaries.push({
            id:       `d-${tc.teacherId.slice(-4)}-w${week}-d${day}-${tc.classId.slice(-4)}`,
            teacherId: tc.teacherId,
            classId:   tc.classId,
            subject:   tc.subject,
            topicIds:  [topicId],
            classScore: Math.round(classScore),
            presentStudentIds: present.map((s) => s.id),
            absentStudentIds:  absent.map((s) => s.id),
            traits: {
              [BehavioralTrait.ENGAGEMENT]:    Math.min(5, Math.max(1, traitBase + Math.round(Math.random() * 2 - 0.5))),
              [BehavioralTrait.PERSISTENCE]:   Math.min(5, Math.max(1, traitBase + Math.round(Math.random() * 2 - 0.5))),
              [BehavioralTrait.FOCUS]:         Math.min(5, Math.max(1, traitBase + Math.round(Math.random() * 2 - 0.5))),
              [BehavioralTrait.COLLABORATION]: Math.min(5, Math.max(1, traitBase + Math.round(Math.random() * 2 - 0.5))),
              [BehavioralTrait.RESILIENCE]:    Math.min(5, Math.max(1, traitBase + Math.round(Math.random() * 2 - 0.5))),
            },
            submittedAt: new Date(Date.now() - daysOffset * 86400000).toISOString(),
            syncStatus: 'synced',
          });
        }
      }
    }
    diaries.forEach((d) => diaryStore.save(d));

    // 6. Compute readiness metrics for every new student
    schoolStudents.forEach((s) => recomputeStudent(s.id));
  }

  // ── Extra district users for dist-3, dist-4, dist-5 ─────────────────
  userStore.saveMany([
    { id: 'user-dist-3', phone: '08045678903', name: 'Education District III Office',   role: Role.DISTRICT, districtId: 'dist-3', createdAt: daysAgo(150), isActive: true },
    { id: 'user-dist-4', phone: '08045678904', name: 'Mr. Seun Adeola',    role: Role.DISTRICT, districtId: 'dist-4', createdAt: daysAgo(150), isActive: true },
    { id: 'user-dist-5', phone: '08045678905', name: 'Dr. Bisi Akinwande', role: Role.DISTRICT, districtId: 'dist-5', createdAt: daysAgo(150), isActive: true },
  ]);

  localStorage.setItem('eko_seeded_multi_v1', 'true');
}

// ── Question Bank ─────────────────────────────────────────────────────
export function seedQuestions(): void {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem('eko_questions_v2') === 'true') return;

  const questions: QuizQuestion[] = [
    // ── MATHEMATICS — Algebra & Quadratic Equations (topic-1) ──
    { id:'q-1-1', subject:'Mathematics', topicId:'topic-1', classLevel:'SSS1', difficulty:'medium', stem:'Solve: x² − 5x + 6 = 0', question:'Solve: x² − 5x + 6 = 0', options:['x = 2 or x = 3','x = 1 or x = 6','x = −2 or x = −3','x = 2 or x = −3'], correctIndex:0, explanation:'Factor: (x−2)(x−3)=0 → x=2 or x=3.', waecYear:2022 },
    { id:'q-1-2', subject:'Mathematics', topicId:'topic-1', classLevel:'SSS1', difficulty:'medium', stem:'Sum of roots of 2x²−6x+4=0 is:', question:'Sum of roots of 2x²−6x+4=0 is:', options:['3','6','2','−3'], correctIndex:0, explanation:'Sum = −(−6)/2 = 3.', waecYear:2021 },
    { id:'q-1-3', subject:'Mathematics', topicId:'topic-1', classLevel:'SSS1', difficulty:'hard',   stem:'If x²+kx+9=0 has equal roots, k =', question:'If x²+kx+9=0 has equal roots, k =', options:['±6','±3','±9','±18'], correctIndex:0, explanation:'Equal roots: discriminant = k²−36=0 → k=±6.', waecYear:2020 },
    { id:'q-1-4', subject:'Mathematics', topicId:'topic-1', classLevel:'SSS1', difficulty:'easy',   stem:'Factorise: x²+7x+12', question:'Factorise: x²+7x+12', options:['(x+3)(x+4)','(x+2)(x+6)','(x+1)(x+12)','(x+3)(x−4)'], correctIndex:0, explanation:'Find two numbers that multiply to 12 and add to 7: 3 and 4.', waecYear:2019 },
    { id:'q-1-5', subject:'Mathematics', topicId:'topic-1', classLevel:'SSS1', difficulty:'medium', stem:'Product of roots of 3x²−12x+9=0 is:', question:'Product of roots of 3x²−12x+9=0 is:', options:['3','−4','9','12'], correctIndex:0, explanation:'Product = c/a = 9/3 = 3.', waecYear:2018 },
    // ── MATHEMATICS — Trigonometry (topic-2) ──
    { id:'q-2-1', subject:'Mathematics', topicId:'topic-2', classLevel:'SSS1', difficulty:'easy', stem:'sin 30° equals:', question:'sin 30° equals:', options:['½','√3/2','1/√2','1'], correctIndex:0, explanation:'sin 30° = 1/2. Standard WAEC value.', waecYear:2023 },
    { id:'q-2-2', subject:'Mathematics', topicId:'topic-2', classLevel:'SSS1', difficulty:'easy', stem:'cos 60° equals:', question:'cos 60° equals:', options:['½','√3/2','1','0'], correctIndex:0, explanation:'cos 60° = 1/2. Note: cos 60° = sin 30°.', waecYear:2022 },
    { id:'q-2-3', subject:'Mathematics', topicId:'topic-2', classLevel:'SSS1', difficulty:'easy', stem:'tan 45° equals:', question:'tan 45° equals:', options:['1','0','√3','1/√3'], correctIndex:0, explanation:'tan 45° = sin 45°/cos 45° = 1.', waecYear:2021 },
    { id:'q-2-4', subject:'Mathematics', topicId:'topic-2', classLevel:'SSS1', difficulty:'medium', stem:'If sin θ = 3/5, then cos θ =', question:'If sin θ = 3/5, then cos θ =', options:['4/5','3/4','5/4','5/3'], correctIndex:0, explanation:'Pythagoras: cos θ = √(1−9/25) = 4/5.', waecYear:2020 },
    { id:'q-2-5', subject:'Mathematics', topicId:'topic-2', classLevel:'SSS1', difficulty:'medium', stem:'In a right triangle, hypotenuse=10, angle=30°. Side opposite 30° =', question:'In a right triangle, hypotenuse=10, angle=30°. Side opposite 30° =', options:['5','5√3','10√3','8'], correctIndex:0, explanation:'Opposite = hyp × sin 30° = 10 × 0.5 = 5.', waecYear:2019 },
    // ── MATHEMATICS — Statistics (topic-3) ──
    { id:'q-3-1', subject:'Mathematics', topicId:'topic-3', classLevel:'SSS1', difficulty:'easy', stem:'Mean of 4,7,8,10,11 is:', question:'Mean of 4,7,8,10,11 is:', options:['8','7','9','10'], correctIndex:0, explanation:'Sum=40, n=5, Mean=40/5=8.', waecYear:2022 },
    { id:'q-3-2', subject:'Mathematics', topicId:'topic-3', classLevel:'SSS1', difficulty:'easy', stem:'A bag: 3 red, 2 blue balls. P(red)=', question:'A bag: 3 red, 2 blue balls. P(red)=', options:['3/5','2/5','1/2','3/2'], correctIndex:0, explanation:'P(red) = 3/5.', waecYear:2021 },
    { id:'q-3-3', subject:'Mathematics', topicId:'topic-3', classLevel:'SSS1', difficulty:'medium', stem:'Median of 2,4,5,6,8,10 is:', question:'Median of 2,4,5,6,8,10 is:', options:['5.5','5','6','4'], correctIndex:0, explanation:'6 values: median = (5+6)/2 = 5.5.', waecYear:2020 },
    { id:'q-3-4', subject:'Mathematics', topicId:'topic-3', classLevel:'SSS1', difficulty:'easy', stem:'Mode of 3,4,4,5,6,4,7 is:', question:'Mode of 3,4,4,5,6,4,7 is:', options:['4','5','3','6'], correctIndex:0, explanation:'4 appears 3 times — most frequent.', waecYear:2019 },
    { id:'q-3-5', subject:'Mathematics', topicId:'topic-3', classLevel:'SSS1', difficulty:'medium', stem:'P(A or B) for mutually exclusive events =', question:'P(A or B) for mutually exclusive events =', options:['P(A)+P(B)','P(A)×P(B)','P(A)−P(B)','1−P(A)'], correctIndex:0, explanation:'Addition rule for mutually exclusive events.', waecYear:2018 },
    // ── ENGLISH LANGUAGE — Comprehension (topic-11) ──
    { id:'q-11-1', subject:'English Language', topicId:'topic-11', classLevel:'SSS1', difficulty:'easy', stem:'A topic sentence in a paragraph:', question:'A topic sentence in a paragraph:', options:['States the main idea','Gives detailed examples','Concludes the paragraph','Introduces a new topic'], correctIndex:0, explanation:'The topic sentence expresses the central idea of the paragraph.', waecYear:2022 },
    { id:'q-11-2', subject:'English Language', topicId:'topic-11', classLevel:'SSS1', difficulty:'easy', stem:'When writing a summary, you should:', question:'When writing a summary, you should:', options:['Use your own words','Copy the text exactly','Add personal opinions','Use many quotations'], correctIndex:0, explanation:'A good summary paraphrases the original in your own words.', waecYear:2021 },
    { id:'q-11-3', subject:'English Language', topicId:'topic-11', classLevel:'SSS1', difficulty:'medium', stem:'An "inference" in comprehension means:', question:'An "inference" in comprehension means:', options:['A conclusion based on evidence','A direct quotation','A dictionary definition','An introductory sentence'], correctIndex:0, explanation:'Inference = reading between the lines based on textual clues.', waecYear:2020 },
    { id:'q-11-4', subject:'English Language', topicId:'topic-11', classLevel:'SSS1', difficulty:'medium', stem:'"Candid" most nearly means:', question:'"Candid" most nearly means:', options:['Frank and honest','Secretive','Colourful','Silent'], correctIndex:0, explanation:'Candid = open, honest, straightforward.', waecYear:2019 },
    { id:'q-11-5', subject:'English Language', topicId:'topic-11', classLevel:'SSS1', difficulty:'hard',   stem:'Best strategy for summarising a long passage:', question:'Best strategy for summarising a long passage:', options:['Identify only the main ideas','Copy all important sentences','Start from the final paragraph','Quote every key phrase'], correctIndex:0, explanation:'Focus on identifying and paraphrasing the central ideas only.', waecYear:2018 },
    // ── ENGLISH LANGUAGE — Essay Writing (topic-12) ──
    { id:'q-12-1', subject:'English Language', topicId:'topic-12', classLevel:'SSS1', difficulty:'easy', stem:'A thesis statement in an essay is:', question:'A thesis statement in an essay is:', options:['The main argument','The conclusion paragraph','A supporting detail','A quotation'], correctIndex:0, explanation:'The thesis is the central claim the essay argues.', waecYear:2023 },
    { id:'q-12-2', subject:'English Language', topicId:'topic-12', classLevel:'SSS1', difficulty:'medium', stem:'In formal essay writing, you should:', question:'In formal essay writing, you should:', options:["Avoid contractions like \"don't\"",'Use slang for emphasis','Write in second person only','Keep all sentences brief'], correctIndex:0, explanation:'Formal essays require standard grammar without contractions.', waecYear:2022 },
    // ── PHYSICS — Mechanics (topic-17) ──
    { id:'q-17-1', subject:'Physics', topicId:'topic-17', classLevel:'SSS1', difficulty:'easy', stem:"Newton's First Law states that an object at rest will:", question:"Newton's First Law states that an object at rest will:", options:['Stay at rest unless acted upon by force','Accelerate constantly','Lose mass over time','Have zero weight'], correctIndex:0, explanation:'Law of Inertia: objects maintain their state unless an external force acts.', waecYear:2022 },
    { id:'q-17-2', subject:'Physics', topicId:'topic-17', classLevel:'SSS1', difficulty:'easy', stem:'Speed = ?', question:'Speed = ?', options:['Distance ÷ Time','Time ÷ Distance','Distance × Time','Mass ÷ Time'], correctIndex:0, explanation:'Speed is the rate of change of distance with time.', waecYear:2021 },
    { id:'q-17-3', subject:'Physics', topicId:'topic-17', classLevel:'SSS1', difficulty:'easy', stem:'SI unit of force:', question:'SI unit of force:', options:['Newton (N)','Joule (J)','Watt (W)','Pascal (Pa)'], correctIndex:0, explanation:'Named after Isaac Newton. 1 N = 1 kg⋅m/s².', waecYear:2020 },
    { id:'q-17-4', subject:'Physics', topicId:'topic-17', classLevel:'SSS1', difficulty:'medium', stem:'Car goes 0→20 m/s in 4s. Acceleration =', question:'Car goes 0→20 m/s in 4s. Acceleration =', options:['5 m/s²','80 m/s²','0.2 m/s²','24 m/s²'], correctIndex:0, explanation:'a = Δv/t = 20/4 = 5 m/s².', waecYear:2019 },
    { id:'q-17-5', subject:'Physics', topicId:'topic-17', classLevel:'SSS1', difficulty:'medium', stem:'Free fall acceleration near Earth surface:', question:'Free fall acceleration near Earth surface:', options:['≈10 m/s²','9 m/s','100 m/s²','1 m/s²'], correctIndex:0, explanation:'g ≈ 9.8 m/s², approximated as 10 m/s² in WAEC.', waecYear:2018 },
    // ── PHYSICS — Electricity (topic-18) ──
    { id:'q-18-1', subject:'Physics', topicId:'topic-18', classLevel:'SSS1', difficulty:'easy', stem:"Ohm's Law: V =", question:"Ohm's Law: V =", options:['IR','I÷R','R÷I','I+R'], correctIndex:0, explanation:'Voltage = Current × Resistance.', waecYear:2023 },
    { id:'q-18-2', subject:'Physics', topicId:'topic-18', classLevel:'SSS1', difficulty:'easy', stem:'SI unit of resistance:', question:'SI unit of resistance:', options:['Ohm (Ω)','Ampere (A)','Volt (V)','Coulomb (C)'], correctIndex:0, explanation:'Resistance is measured in Ohms (Ω).', waecYear:2022 },
    { id:'q-18-3', subject:'Physics', topicId:'topic-18', classLevel:'SSS1', difficulty:'medium', stem:'In parallel circuit, voltage across each component:', question:'In parallel circuit, voltage across each component:', options:['Same for all','Different for each','Zero','Doubled per branch'], correctIndex:0, explanation:'Parallel circuits share the same voltage across all branches.', waecYear:2021 },
    // ── CHEMISTRY — Organic (topic-21) ──
    { id:'q-21-1', subject:'Chemistry', topicId:'topic-21', classLevel:'SSS2', difficulty:'easy', stem:'CH₄ belongs to which homologous series?', question:'CH₄ belongs to which homologous series?', options:['Alkanes','Alkenes','Alkynes','Alcohols'], correctIndex:0, explanation:'Methane (CH₄) is the simplest alkane.', waecYear:2022 },
    { id:'q-21-2', subject:'Chemistry', topicId:'topic-21', classLevel:'SSS2', difficulty:'easy', stem:'Functional group of alcohols:', question:'Functional group of alcohols:', options:['−OH','−COOH','−CHO','−CO−'], correctIndex:0, explanation:'The hydroxyl group (−OH) defines alcohols.', waecYear:2021 },
    { id:'q-21-3', subject:'Chemistry', topicId:'topic-21', classLevel:'SSS2', difficulty:'medium', stem:'General formula for alkanes:', question:'General formula for alkanes:', options:['CₙH₂ₙ₊₂','CₙH₂ₙ','CₙH₂ₙ₋₂','CₙHₙ'], correctIndex:0, explanation:'Saturated hydrocarbons follow CₙH₂ₙ₊₂.', waecYear:2020 },
    { id:'q-21-4', subject:'Chemistry', topicId:'topic-21', classLevel:'SSS2', difficulty:'medium', stem:'Fermentation of glucose produces:', question:'Fermentation of glucose produces:', options:['Ethanol+CO₂','Methane+H₂O','Acetic acid+O₂','Propanol+N₂'], correctIndex:0, explanation:'Yeast converts glucose to ethanol and carbon dioxide.', waecYear:2019 },
    // ── BIOLOGY — Cell Biology (topic-24) ──
    { id:'q-24-1', subject:'Biology', topicId:'topic-24', classLevel:'SSS2', difficulty:'easy', stem:'"Powerhouse of the cell" is the:', question:'"Powerhouse of the cell" is the:', options:['Mitochondria','Nucleus','Ribosome','Golgi body'], correctIndex:0, explanation:'Mitochondria produce ATP via cellular respiration.', waecYear:2023 },
    { id:'q-24-2', subject:'Biology', topicId:'topic-24', classLevel:'SSS2', difficulty:'easy', stem:'DNA is found mainly in the:', question:'DNA is found mainly in the:', options:['Nucleus','Cytoplasm','Cell membrane','Vacuole'], correctIndex:0, explanation:'DNA is stored in the cell nucleus.', waecYear:2022 },
    { id:'q-24-3', subject:'Biology', topicId:'topic-24', classLevel:'SSS2', difficulty:'medium', stem:'"Tt" genotype means the organism is:', question:'"Tt" genotype means the organism is:', options:['Heterozygous','Homozygous dominant','Homozygous recessive','Non-viable'], correctIndex:0, explanation:'Tt has one dominant and one recessive allele = heterozygous.', waecYear:2021 },
    { id:'q-24-4', subject:'Biology', topicId:'topic-24', classLevel:'SSS2', difficulty:'medium', stem:'Mitosis results in:', question:'Mitosis results in:', options:['2 genetically identical cells','4 different gametes','1 cell with doubled DNA','2 cells with half DNA'], correctIndex:0, explanation:'Mitosis produces 2 genetically identical daughter cells.', waecYear:2020 },
    { id:'q-24-5', subject:'Biology', topicId:'topic-24', classLevel:'SSS2', difficulty:'easy', stem:'Cell membrane is:', question:'Cell membrane is:', options:['Selectively permeable','Completely impermeable','Permeable to large molecules only','Rigid like a cell wall'], correctIndex:0, explanation:'The cell membrane controls what enters and exits — selectively permeable.', waecYear:2019 },
    // ── BIOLOGY — Ecology (topic-25) ──
    { id:'q-25-1', subject:'Biology', topicId:'topic-25', classLevel:'SSS2', difficulty:'easy', stem:'Producers in a food chain are:', question:'Producers in a food chain are:', options:['Green plants','Herbivores','Carnivores','Decomposers'], correctIndex:0, explanation:'Green plants produce their own food via photosynthesis.', waecYear:2022 },
    { id:'q-25-2', subject:'Biology', topicId:'topic-25', classLevel:'SSS2', difficulty:'easy', stem:'Photosynthesis converts:', question:'Photosynthesis converts:', options:['CO₂+H₂O → glucose+O₂','O₂+glucose → CO₂+H₂O','N₂+H₂O → protein','Glucose → CO₂ only'], correctIndex:0, explanation:'Plants use sunlight to convert CO₂ and water into glucose and oxygen.', waecYear:2021 },
    { id:'q-25-3', subject:'Biology', topicId:'topic-25', classLevel:'SSS2', difficulty:'easy', stem:'Primary energy source in most ecosystems:', question:'Primary energy source in most ecosystems:', options:['The Sun','Water','Soil','Wind'], correctIndex:0, explanation:'Solar energy drives photosynthesis at the base of all food chains.', waecYear:2020 },
  ];

  quizQuestionStore.saveMany(questions);
  localStorage.setItem('eko_questions_v2', 'true');

  // ── Homework assignments ────────────────────────────────────────────────
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7);
  const homework: HomeworkAssignment[] = [
    {
      id: 'hw-1',
      teacherId: 'user-teacher-1',
      classId:   'cls-sss1a',
      subject:   'Mathematics',
      topicId:   'topic-1',
      difficulty: 'medium',
      questionCount: 5,
      questionIds: ['q-1-1', 'q-1-2', 'q-1-3', 'q-1-4', 'q-1-5'],
      deadline:    'tomorrow',
      deadlineDate: tomorrow.toISOString().slice(0, 10),
      createdAt:   new Date().toISOString(),
      status: 'active',
    },
    {
      id: 'hw-2',
      teacherId: 'user-teacher-1',
      classId:   'cls-sss1a',
      subject:   'Mathematics',
      topicId:   'topic-2',
      difficulty: 'easy',
      questionCount: 4,
      questionIds: ['q-2-1', 'q-2-2', 'q-2-3', 'q-2-4'],
      deadline:    'this_week',
      deadlineDate: nextWeek.toISOString().slice(0, 10),
      createdAt:   new Date().toISOString(),
      status: 'active',
    },
  ];
  homework.forEach((hw) => homeworkStore.save(hw));
}
