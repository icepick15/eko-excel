// ============= Enums =============
export enum Role {
  TEACHER = 'teacher',
  HEADTEACHER = 'headteacher',
  DISTRICT = 'district',
  MINISTRY = 'ministry',
  PARENT = 'parent',
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

// ============= Domain Models =============
export interface User {
  id: string;
  phone: string;
  name: string;
  role: Role;
  schoolId?: string;
  districtId?: string;
  createdAt: string;
}

export interface District {
  id: string;
  name: string;
}

export interface School {
  id: string;
  name: string;
  districtId: string;
  address?: string;
}

export interface Student {
  id: string;
  name: string;
  schoolId: string;
  class: string;
  enrolledDate: string;
}

export interface TopicSegment {
  id: string;
  subject: string;
  topic: string;
  waecFrequency: number;
  weight: number;
}

export interface DiaryEntry {
  id: string;
  idempotencyKey: string;
  studentId: string;
  teacherId: string;
  topicId: string;
  classScore: number;
  attendance: string[];
  behavioralTraits: Record<BehavioralTrait, 'high' | 'medium' | 'low'>;
  createdAt: string;
}

export interface ReadinessMetric {
  studentId: string;
  subject: string;
  readinessScore: number;
  colorStatus: ColorStatus;
  computedAt: string;
}

export interface BrainMapProfile {
  studentId: string;
  academicScore: number;
  behavioralScore: number;
  topStrengths: string[];
  academicDomains: Record<string, number>;
  behavioralTraits: Record<string, number>;
  computedAt: string;
}

export interface Hotspot {
  id: string;
  studentId: string;
  category: 'low_attendance' | 'low_readiness' | 'low_engagement' | 'math_weakness' | 'english_weakness';
  severity: 'critical' | 'high' | 'medium';
  description: string;
  detectedAt: string;
  resolvedAt?: string;
}

// ============= API-style Contracts =============
export interface DiarySubmitRequest {
  studentId: string;
  topicId: string;
  classScore: number;
  attendance: string[];
  behavioralTraits: Record<BehavioralTrait, 'high' | 'medium' | 'low'>;
}

// ============= Constants =============
export const BEHAVIORAL_TRAIT_LABELS: Record<BehavioralTrait, string> = {
  [BehavioralTrait.ENGAGEMENT]: 'Engagement / Participation',
  [BehavioralTrait.PERSISTENCE]: 'Persistence / Effort',
  [BehavioralTrait.FOCUS]: 'Focus / Attention',
  [BehavioralTrait.COLLABORATION]: 'Collaboration',
  [BehavioralTrait.RESILIENCE]: 'Resilience / Emotional Regulation',
};

export const WAEC_SUBJECTS = ['Mathematics', 'English', 'Physics', 'Chemistry', 'Biology'];

export const SUBJECT_TO_DOMAIN: Record<string, string> = {
  Mathematics: 'Logical-Analytical',
  English: 'Verbal-Creative',
  Physics: 'Spatial-Mechanical',
  Chemistry: 'Applied-Practical',
  Biology: 'Applied-Practical',
};

export const ACADEMIC_DOMAINS = [
  'Logical-Analytical',
  'Spatial-Mechanical',
  'Verbal-Creative',
  'Applied-Practical',
];
