export interface KPIData {
  label: string;
  value: number;
  unit: string;
  color: 'blue' | 'green' | 'purple' | 'red' | 'yellow' | 'orange';
  hasAlert?: boolean;
}

export interface Teacher {
  id: number;
  name: string;
  type: '专任' | '兼任';
  maxDuties: number;
  currentDuties: number;
  phone?: string;
  department?: string;
}

export interface Classroom {
  id: number;
  name: string;
  capacity: number;
  building: string;
  type: string;
}

export interface Course {
  id: number;
  name: string;
  code: string;
  type: '公共课' | '专业课';
  department: string;
  studentCount: number;
}

export interface Class {
  id: number;
  name: string;
  major: string;
  grade: string;
  studentCount: number;
}

export interface Student {
  id: number;
  name: string;
  studentId: string;
  className: string;
  major: string;
}

export interface Major {
  id: number;
  name: string;
  code: string;
  department: string;
}

export interface TimeSlot {
  id: number;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  dayOfWeek: number;
}

export interface ExamSchedule {
  id: number;
  courseId: number;
  courseName: string;
  courseType: '公共课' | '专业课';
  classroomId: number;
  classroomName: string;
  capacity: number;
  date: string;
  timeSlot: string;
  timeRange: string;
  classNames: string[];
  studentCount: number;
  fixedTeachers: string[];
  patrolTeachers: string[];
  examPaper: 'A卷' | 'B卷';
}

export interface PatrolAssignment {
  day: string;
  slot: string;
  groupId: number;
  groupName: string;
  teachers: string[];
  color: string;
}

export interface AuditLog {
  id: number;
  time: string;
  operator: string;
  operationType: string;
  entityType: string;
  entityName: string;
  beforeValue: string;
  afterValue: string;
  reason: string;
}

export interface ScheduleVersion {
  id: number;
  name: string;
  createdAt: string;
  examCount: number;
  teacherCount: number;
  roomCount: number;
  classCount: number;
  courseCount: number;
  patrolCount: number;
  isActive: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface NavItem {
  label: string;
  path: string;
  icon: string;
}

export interface BaseDataNavItem {
  key: string;
  label: string;
  icon: string;
}

export type BaseDataType = 'teachers' | 'classrooms' | 'courses' | 'classes' | 'students' | 'majors' | 'time-slots';

export type ResultPanelType = 'overview' | 'teachers' | 'teacher-load' | 'classrooms' | 'patrol' | 'classes' | 'courses';

export interface TransferOperation {
  id: string;
  type: 'swap' | 'transfer' | 'batch-transfer';
  teacherA: string;
  teacherB: string;
  slotA: string;
  slotB?: string;
  reason: string;
  timestamp: string;
}

export interface SchedulerConfig {
  strategy: string;
  fixedProctorsPerRoom: number;
  maxSolveTime: number;
  patrolGroupRule: string;
  constraints: string[];
  maxProctorDays: number;
  noCrossDay: boolean;
}
