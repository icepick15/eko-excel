// ============= Enums =============
export enum Role {
  TEACHER = 'teacher',
  HEADTEACHER = 'headteacher',
  DISTRICT = 'district',
  MINISTRY = 'ministry',
  PARENT = 'parent',
  STUDENT = 'student',
  SCHOOLADMIN = 'schooladmin',
}

export enum BehavioralTrait {
  ENGAGEMENT = 'engagement',
  PERSISTENCE = 'persistence',
  FOCUS = 'focus',
  COLLABORATION = 'collaboration',
  RESILIENCE = 'resilience',
}

export enum ColorStatus {
  GREEN = 'green',
  YELLOW = 'yellow',
  RED = 'red',
}

export type ClassLevel =
  | 'JSS1' | 'JSS2' | 'JSS3'
  | 'SSS1' | 'SSS2' | 'SSS3';

export type ClassSection = 'A' | 'B' | 'C';

// ============= Domain Models =============
export interface User {
  id: string;
  phone: string;
  name: string;
  role: Role;
  schoolId?: string;
  districtId?: string;
  studentId?: string;
  childIds?: string[];   // parent may have multiple children
  createdAt: string;
  isActive?: boolean;
}

export interface District {
  id: string;
  name: string;
  lgaList?: string[];
}

export interface School {
  id: string;
  name: string;
  districtId: string;
  lga?: string;
  address?: string;
  headteacherId?: string;
  schoolCode?: string;
}

export interface Class {
  id: string;
  schoolId: string;
  level: ClassLevel;
  section: ClassSection;
  academicYear: string; // e.g. "2024/2025"
  formTeacherId?: string;
}

export interface TeacherClassSubject {
  id: string;
  teacherId: string;
  classId: string;
  subject: string;
}

export interface TimetableSlot {
  id: string;
  classId: string;
  teacherClassSubjectId: string;
  dayOfWeek: number;   // 1=Mon … 5=Fri
  period: number;      // 1–8
  startTime: string;   // "08:00"
  endTime: string;     // "09:00"
}

export interface Student {
  id: string;
  name: string;
  schoolId: string;
  classId: string;
  gender: 'M' | 'F';
  dob?: string;
  parentPhone?: string;
  enrolledDate: string;
  consentSigned?: boolean;
  isActive?: boolean;
}

// One completed class-level in a student's academic journey (JSS1 → current)
export interface AcademicHistoryRecord {
  id: string;               // ah-<studentId>-<level>
  studentId: string;
  classLevel: ClassLevel;
  academicYear: string;     // e.g. '2021/2022'
  schoolName: string;
  termAverages: number[];   // [term1, term2, term3]
  finalAverage: number;
  positionInClass: number;
  classSize: number;
  promoted: boolean;
  remark: string;
}

export interface TopicSegment {
  id: string;
  subject: string;
  classLevel: ClassLevel;
  topic: string;
  subTopic?: string;
  waecWeight: number;   // 1–10 per spec
  waecFrequency: number; // 0–1 normalised (legacy compat)
}

// Class-level diary entry (one per class per subject per lesson)
export interface DiaryEntry {
  id: string;
  teacherId: string;
  classId: string;
  subject: string;
  topicIds: string[];            // up to 3 topics per session
  classScore: number;            // 0–100 class-level aggregate
  presentStudentIds: string[];   // who was present
  absentStudentIds: string[];    // who was absent
  traits: Record<BehavioralTrait, number>; // 1–5 per trait
  notes?: string;                // max 200 chars optional
  submittedAt: string;           // UTC ISO
  syncStatus: 'synced' | 'pending_sync';
  missedReason?: 'school_closed' | 'sick_leave' | 'power_outage' | 'network_issue' | 'other';
}

// Per-student attendance record derived from diary
export interface StudentAttendance {
  id: string;
  studentId: string;
  diaryId: string;
  date: string;       // YYYY-MM-DD
  status: 'present' | 'absent' | 'excused';
}

export interface ReadinessMetric {
  studentId: string;
  subject: string;
  readinessScore: number;
  colorStatus: ColorStatus;
  computedAt: string;
}

// Historical snapshot — every computation result retained for trend charts
export interface ReadinessSnapshot {
  id: string;
  studentId: string;
  subject: string;
  readinessScore: number;
  colorStatus: ColorStatus;
  snapshotDate: string; // YYYY-MM-DD
}

export interface BrainMapProfile {
  studentId: string;
  logicalAnalytical: number;    // 0–1
  spatialMechanical: number;
  verbalCreative: number;
  appliedPractical: number;
  consistency: number;
  topProfiles: string[];        // e.g. ["Logical-Analytical", "Verbal-Creative"]
  teachingRecommendation: string;
  homeAction: string;
  computedAt: string;
  weeksOfData: number;
}

export interface Hotspot {
  id: string;
  studentId: string;
  subject: string;
  topicId?: string;
  readinessScore: number;
  severity: 'critical' | 'high' | 'medium';
  trend: 'up' | 'down' | 'stable';
  description: string;
  detectedAt: string;
  resolvedAt?: string;
}

export interface Intervention {
  id: string;
  hotspotId?: string;
  studentId?: string;
  schoolId?: string;
  assignedBy: string;      // userId
  assignedTo: string;      // userId (teacher)
  description: string;
  dueDate: string;
  status: 'open' | 'in_progress' | 'completed';
  completedAt?: string;
  createdAt: string;
}

export interface Message {
  id: string;
  fromUserId: string;
  fromRole: Role;
  fromName: string;
  toUserId?: string;
  toSchoolId?: string;
  subject: string;
  body: string;
  severity?: 'info' | 'warning' | 'urgent';
  requiredResponseDate?: string;
  isRead: boolean;
  readAt?: string;
  sentAt: string;
  replies?: MessageReply[];
}

export interface MessageReply {
  id: string;
  fromUserId: string;
  fromName: string;
  body: string;
  sentAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'nudge' | 'query' | 'hotspot' | 'intervention' | 'report';
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  deepLink?: string;
}

export interface TermCalendar {
  id: string;
  schoolId: string;
  academicYear: string;
  term: 1 | 2 | 3;
  firstDay: string;   // YYYY-MM-DD
  lastDay: string;
  holidays: string[]; // YYYY-MM-DD[]
  closureDays: string[];
}

export interface AuditLog {
  id: string;
  userId: string;
  userRole: Role;
  action: string;
  targetType?: string;
  targetId?: string;
  detail?: string;
  createdAt: string;
}

// ============= Quiz =============
export interface QuizQuestion {
  id: string;
  subject: string;
  classLevel?: ClassLevel;
  topicId: string;
  stem: string;
  question: string; // alias for stem (backward compat)
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  waecYear?: number;  // if from a real past paper
  waecTopicWeight?: number;
  imageUrl?: string;
}

export interface StudentSeenQuestions {
  studentId: string;
  seenIds: string[];
}

export interface QuizAttempt {
  id: string;
  studentId: string;
  topicId: string;
  subject: string;
  score: number;
  totalQuestions: number;
  correctCount: number;
  timeTakenSeconds?: number;
  isTimedMode?: boolean;
  completedAt: string;
  answers?: Array<{ questionId: string; chosen: number; correct: boolean }>;
  source?: 'cbt' | 'homework' | 'whatsapp';
}

export interface PracticeStreak {
  studentId: string;
  currentStreak: number;
  lastPracticeDate: string; // YYYY-MM-DD
  longestStreak: number;
}

// ============= Homework =============
export interface HomeworkAssignment {
  id: string;
  teacherId: string;
  classId: string;
  subject: string;
  topicId: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questionCount: number;
  questionIds: string[];
  deadline: 'tonight' | 'tomorrow' | 'this_week';
  deadlineDate: string;
  createdAt: string;
  status: 'active' | 'closed';
}

export interface HomeworkSubmission {
  id: string;
  homeworkId: string;
  studentId: string;
  answers: Array<{ questionId: string; chosen: number; correct: boolean }>;
  score: number;
  submittedAt: string;
}

// Handwritten (paper) homework snapped with the device camera — separate
// from the computer-based assignments set by the teacher
export interface HandwrittenSubmission {
  id: string;
  studentId: string;
  subject: string;
  note?: string;
  imageDataUrl: string;   // downscaled JPEG data URL
  submittedAt: string;
  status: 'submitted' | 'reviewed';
}

// ============= Career Streaming =============
export type CareerPathway = 'Science' | 'Arts' | 'Commercial';

export interface CareerRecommendation {
  studentId: string;
  pathway: CareerPathway;
  confidence: number;
  reasons: string[];
  evidenceSubjects: string[];
  subjectScores: Record<string, number>;
  computedAt: string;
}

// ============= Parent Opt-out =============
export interface ParentOptOut {
  phone: string;
  optedOutAt: string;
}

// ============= Constants =============
export const BEHAVIORAL_TRAIT_LABELS: Record<BehavioralTrait, string> = {
  [BehavioralTrait.ENGAGEMENT]: 'Engagement / Participation',
  [BehavioralTrait.PERSISTENCE]: 'Persistence / Effort',
  [BehavioralTrait.FOCUS]: 'Focus / Attention',
  [BehavioralTrait.COLLABORATION]: 'Collaboration',
  [BehavioralTrait.RESILIENCE]: 'Resilience / Emotional Regulation',
};

// 14 WAEC subjects per spec
export const WAEC_SUBJECTS_SSS = [
  'Mathematics', 'English Language', 'Physics', 'Chemistry', 'Biology',
  'Agricultural Science', 'Economics', 'Government', 'Literature in English',
  'Geography', 'Commerce', 'Accounting', 'Technical Drawing', 'Further Mathematics',
];

// 12 JSS subjects per spec
export const WAEC_SUBJECTS_JSS = [
  'Mathematics', 'English Language', 'Basic Science', 'Basic Technology',
  'Social Studies', 'Civic Education', 'French', 'Agricultural Science',
  'Home Economics', 'Business Studies', 'Computer Studies', 'Physical Education',
];

// Core subjects used for WAEC Readiness Meter computation
export const CORE_SUBJECTS = [
  'Mathematics', 'English Language', 'Physics', 'Chemistry', 'Biology',
];

export const SUBJECT_TO_DOMAIN: Record<string, string> = {
  'Mathematics': 'Logical-Analytical',
  'Further Mathematics': 'Logical-Analytical',
  'Physics': 'Spatial-Mechanical',
  'Technical Drawing': 'Spatial-Mechanical',
  'English Language': 'Verbal-Creative',
  'Literature in English': 'Verbal-Creative',
  'Agricultural Science': 'Applied-Practical',
  'Home Economics': 'Applied-Practical',
  'Chemistry': 'Applied-Practical',
  'Biology': 'Applied-Practical',
  'Economics': 'Logical-Analytical',
  'Commerce': 'Applied-Practical',
  'Accounting': 'Logical-Analytical',
  'Geography': 'Spatial-Mechanical',
  'Government': 'Verbal-Creative',
  'Social Studies': 'Verbal-Creative',
  'Civic Education': 'Verbal-Creative',
  'Basic Science': 'Applied-Practical',
  'Basic Technology': 'Spatial-Mechanical',
  'Computer Studies': 'Logical-Analytical',
};

export const ACADEMIC_DOMAINS = [
  'Logical-Analytical',
  'Spatial-Mechanical',
  'Verbal-Creative',
  'Applied-Practical',
];

// Lagos brand colours — exact per Law 11
export const LAGOS_COLOURS = {
  blue: '#0033A0',
  green: '#008751',
  brightGreen: '#22C55E',
  yellow: '#FFCC00',
  red: '#E30613',
} as const;
