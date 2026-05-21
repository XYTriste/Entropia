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
  // 后端字段映射
  course_type?: 'public' | 'major';  // 后端原始字段
  student_count?: number;            // 后端原始字段
  // 前端展示字段（由后端数据转换）
  code?: string;
  type: '公共课' | '专业课';
  department?: string;
  studentCount: number;
  // 排考状态
  schedule_status?: 'scheduled' | 'unscheduled' | 'partial';
  exam_count?: number;  // 已排考场次
}

export interface Class {
  id: number;
  name: string;
  major_id: number;
  major_name?: string;  // 后端返回的专业名称
  grade: number;        // 后端返回：年级 (1-4)
  student_count: number;
  created_at?: string;
  updated_at?: string;
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
  examDate?: string;
  dateLabel?: string;
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
  // 排考策略
  strategy?: 'all' | 'public_only' | 'major_only';
  // 每教室固定监考人数
  fixed_teachers_per_room: number;
  // 每时段对流动监考人数
  patrol_teacher_count_per_slot_pair: number;
  // 流动监考分组规则
  patrol_group_rules: Array<{ group_name: string; patterns: string[] }>;
  // 教室优先级规则
  classroom_priority_rules: Array<{ priority: number; patterns: string[] }>;
  // 是否启用最大监考天数约束
  enable_max_days_constraint: boolean;
  // 是否启用日期连续性约束
  enable_day_continuity_constraint: boolean;
  // 最大监考天数上限
  max_days: number;
  // 考试起始日期
  examStartDate?: string;
  // 考试周数
  examWeeks?: number;
}
