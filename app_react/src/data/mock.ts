import type {
  KPIData,
  Teacher,
  Classroom,
  Course,
  Class,
  Student,
  Major,
  TimeSlot,
  ExamSchedule,
  PatrolAssignment,
  AuditLog,
  ScheduleVersion,
  ChatMessage,
  SchedulerConfig,
  TransferOperation,
} from '@/types';

export const kpiData: KPIData[] = [
  { label: '已安排考试场次', value: 156, unit: '场', color: 'blue' },
  { label: '未安排考试场次', value: 23, unit: '场', color: 'blue' },
  { label: '教室利用率', value: 87.3, unit: '%', color: 'green' },
  { label: '监考教师分配率', value: 92.1, unit: '%', color: 'purple' },
  { label: '排考冲突告警', value: 3, unit: '项', color: 'red', hasAlert: true },
  { label: '考生人次流量', value: 4820, unit: '人次', color: 'yellow' },
  { label: '平均考场负载', value: 78.5, unit: '%', color: 'orange' },
];

export const teachers: Teacher[] = Array.from({ length: 48 }, (_, i) => ({
  id: i + 1,
  name: ['张三', '李四', '王五', '赵六', '陈七', '刘八', '孙九', '周十', '吴十一', '郑十二'][i % 10] + (Math.floor(i / 10) > 0 ? `-${Math.floor(i / 10)}` : ''),
  type: i % 3 === 0 ? '兼任' : '专任',
  maxDuties: 6 + (i % 4),
  currentDuties: Math.floor(Math.random() * 6),
  phone: `138${String(10000000 + i * 123456).slice(0, 8)}`,
  department: ['计算机学院', '数学学院', '外语学院', '物理学院', '化学学院'][i % 5],
}));

export const classrooms: Classroom[] = Array.from({ length: 36 }, (_, i) => ({
  id: i + 1,
  name: `${['A', 'B', 'C', 'D'][Math.floor(i / 9)]}-${String((i % 9) + 101).padStart(3, '0')}`,
  capacity: 40 + (i % 5) * 20,
  building: ['第一教学楼', '第二教学楼', '第三教学楼', '实验楼'][Math.floor(i / 9)],
  type: i % 3 === 0 ? '多媒体教室' : '普通教室',
}));

export const courses: Course[] = Array.from({ length: 42 }, (_, i) => ({
  id: i + 1,
  name: ['高等数学', '大学英语', '数据结构', '线性代数', '操作系统', '计算机网络', '数据库原理', '软件工程', '离散数学', '概率统计'][i % 10] + (Math.floor(i / 10) > 0 ? ` ${Math.floor(i / 10) + 1}` : ''),
  code: `CS${String(1000 + i).slice(1)}`,
  type: i % 4 === 0 ? '公共课' : '专业课',
  department: ['计算机学院', '数学学院', '外语学院', '物理学院', '化学学院'][i % 5],
  studentCount: 30 + (i % 10) * 15,
}));

export const classesData: Class[] = Array.from({ length: 32 }, (_, i) => ({
  id: i + 1,
  name: `202${3 + Math.floor(i / 8)}级${['计算机', '软件工程', '网络工程', '人工智能'][Math.floor((i % 8) / 2)]}${(i % 2) + 1}班`,
  major: ['计算机科学与技术', '软件工程', '网络工程', '人工智能'][Math.floor((i % 8) / 2)],
  grade: `202${3 + Math.floor(i / 8)}`,
  studentCount: 30 + (i % 8) * 5,
}));

export const students: Student[] = Array.from({ length: 50 }, (_, i) => ({
  id: i + 1,
  name: ['小明', '小红', '小刚', '小丽', '小华', '小芳', '小军', '小燕', '小波', '小敏'][i % 10] + (Math.floor(i / 10) > 0 ? `${Math.floor(i / 10) + 1}` : ''),
  studentId: `2023${String(100000 + i * 1234).slice(0, 6)}`,
  className: `2023级计算机${(i % 4) + 1}班`,
  major: ['计算机科学与技术', '软件工程', '网络工程', '人工智能'][i % 4],
}));

export const majors: Major[] = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  name: ['计算机科学与技术', '软件工程', '网络工程', '人工智能', '数据科学', '信息安全', '物联网工程', '电子信息工程', '通信工程', '自动化'][i % 10] + (Math.floor(i / 10) > 0 ? ` ${Math.floor(i / 10) + 1}` : ''),
  code: `M${String(100 + i).slice(1)}`,
  department: ['计算机学院', '电子学院', '自动化学院', '通信学院'][i % 4],
}));

export const timeSlots: TimeSlot[] = [
  { id: 1, code: 'T1', name: '上午第一场', startTime: '08:00', endTime: '10:00', dayOfWeek: 0 },
  { id: 2, code: 'T2', name: '上午第二场', startTime: '10:30', endTime: '12:30', dayOfWeek: 0 },
  { id: 3, code: 'T3', name: '下午第一场', startTime: '14:00', endTime: '16:00', dayOfWeek: 0 },
  { id: 4, code: 'T4', name: '下午第二场', startTime: '16:30', endTime: '18:30', dayOfWeek: 0 },
];

export const examSchedules: ExamSchedule[] = Array.from({ length: 60 }, (_, i) => ({
  id: i + 1,
  courseId: (i % 42) + 1,
  courseName: courses[i % 42].name,
  courseType: courses[i % 42].type as '公共课' | '专业课',
  classroomId: (i % 36) + 1,
  classroomName: classrooms[i % 36].name,
  capacity: classrooms[i % 36].capacity,
  date: `2026-06-${String(15 + Math.floor(i / 8)).padStart(2, '0')}`,
  timeSlot: ['T1', 'T2', 'T3', 'T4'][i % 4],
  timeRange: timeSlots[i % 4].startTime + '-' + timeSlots[i % 4].endTime,
  classNames: [`2023级计算机${(i % 4) + 1}班`, `2023级软件工程${(i % 3) + 1}班`],
  studentCount: 40 + (i % 5) * 10,
  fixedTeachers: [teachers[i % 48].name, teachers[(i + 1) % 48].name],
  patrolTeachers: [teachers[(i + 2) % 48].name],
  examPaper: i % 2 === 0 ? 'A卷' : 'B卷',
}));

export const patrolAssignments: PatrolAssignment[] = [
  { day: '周一', slot: 'T1', groupId: 1, groupName: 'A组', teachers: ['张三', '李四'], color: '#D4A373' },
  { day: '周一', slot: 'T2', groupId: 2, groupName: 'B组', teachers: ['王五', '赵六'], color: '#6B9B8A' },
  { day: '周一', slot: 'T3', groupId: 1, groupName: 'A组', teachers: ['张三', '李四'], color: '#D4A373' },
  { day: '周一', slot: 'T4', groupId: 3, groupName: 'C组', teachers: ['陈七', '刘八'], color: '#8C959F' },
  { day: '周二', slot: 'T1', groupId: 2, groupName: 'B组', teachers: ['王五', '赵六'], color: '#6B9B8A' },
  { day: '周二', slot: 'T2', groupId: 1, groupName: 'A组', teachers: ['张三', '李四'], color: '#D4A373' },
  { day: '周二', slot: 'T3', groupId: 3, groupName: 'C组', teachers: ['陈七', '刘八'], color: '#8C959F' },
  { day: '周二', slot: 'T4', groupId: 2, groupName: 'B组', teachers: ['王五', '赵六'], color: '#6B9B8A' },
  { day: '周三', slot: 'T1', groupId: 3, groupName: 'C组', teachers: ['陈七', '刘八'], color: '#8C959F' },
  { day: '周三', slot: 'T2', groupId: 2, groupName: 'B组', teachers: ['王五', '赵六'], color: '#6B9B8A' },
  { day: '周三', slot: 'T3', groupId: 1, groupName: 'A组', teachers: ['张三', '李四'], color: '#D4A373' },
  { day: '周三', slot: 'T4', groupId: 3, groupName: 'C组', teachers: ['陈七', '刘八'], color: '#8C959F' },
  { day: '周四', slot: 'T1', groupId: 1, groupName: 'A组', teachers: ['张三', '李四'], color: '#D4A373' },
  { day: '周四', slot: 'T2', groupId: 3, groupName: 'C组', teachers: ['陈七', '刘八'], color: '#8C959F' },
  { day: '周四', slot: 'T3', groupId: 2, groupName: 'B组', teachers: ['王五', '赵六'], color: '#6B9B8A' },
  { day: '周四', slot: 'T4', groupId: 1, groupName: 'A组', teachers: ['张三', '李四'], color: '#D4A373' },
  { day: '周五', slot: 'T1', groupId: 2, groupName: 'B组', teachers: ['王五', '赵六'], color: '#6B9B8A' },
  { day: '周五', slot: 'T2', groupId: 1, groupName: 'A组', teachers: ['张三', '李四'], color: '#D4A373' },
  { day: '周五', slot: 'T3', groupId: 3, groupName: 'C组', teachers: ['陈七', '刘八'], color: '#8C959F' },
  { day: '周五', slot: 'T4', groupId: 2, groupName: 'B组', teachers: ['王五', '赵六'], color: '#6B9B8A' },
];

export const auditLogs: AuditLog[] = Array.from({ length: 30 }, (_, i) => ({
  id: i + 1,
  time: `2026-05-${String(19 - Math.floor(i / 5)).padStart(2, '0')} ${String(9 + (i % 8)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00`,
  operator: ['管理员', '张主任', '李老师', '王秘书'][i % 4],
  operationType: ['CREATE', 'UPDATE', 'DELETE', 'TRANSFER', 'SCHEDULE'][i % 5],
  entityType: ['Exam', 'Teacher', 'Classroom', 'Course', 'Schedule'][i % 5],
  entityName: [`考试#${1000 + i}`, `教师-${teachers[i % 48].name}`, `教室-${classrooms[i % 36].name}`, `课程-${courses[i % 42].name}`, `排考方案V${i % 5 + 1}`][i % 5],
  beforeValue: JSON.stringify({ status: 'pending', room: null }),
  afterValue: JSON.stringify({ status: 'scheduled', room: `A-${101 + (i % 9)}` }),
  reason: ['新增排考', '调整教室', '修改时间', '教师调剂', '系统排考'][i % 5],
}));

export const scheduleVersions: ScheduleVersion[] = [
  { id: 1, name: '默认方案 V1', createdAt: '2026-05-15 09:30:00', examCount: 156, teacherCount: 48, roomCount: 36, classCount: 32, courseCount: 42, patrolCount: 20, isActive: true },
  { id: 2, name: '优化方案 V2', createdAt: '2026-05-16 14:20:00', examCount: 156, teacherCount: 48, roomCount: 36, classCount: 32, courseCount: 42, patrolCount: 18, isActive: false },
  { id: 3, name: '应急方案 V3', createdAt: '2026-05-17 11:00:00', examCount: 140, teacherCount: 42, roomCount: 32, classCount: 28, courseCount: 38, patrolCount: 16, isActive: false },
];

export const chatMessages: ChatMessage[] = [
  {
    id: '1',
    role: 'assistant',
    content: '您好！我是排考小助手。我可以帮您查询考试安排、分析排考数据、解答排考相关问题。请问有什么可以帮您的吗？',
    timestamp: new Date(Date.now() - 3600000),
  },
];

export const schedulerConfig: SchedulerConfig = {
  strategy: 'all',
  fixedProctorsPerRoom: 1,
  maxSolveTime: 300,
  patrolGroupRule: 'department',
  constraints: ['no_consecutive', 'max_duty_limit', 'gender_balance'],
  maxProctorDays: 3,
  noCrossDay: true,
};

export const transferOperations: TransferOperation[] = [
  {
    id: 't1',
    type: 'swap',
    teacherA: '张三',
    teacherB: '李四',
    slotA: '2026-06-15 T1',
    slotB: '2026-06-15 T2',
    reason: '时间冲突调整',
    timestamp: '2026-05-18 10:30:00',
  },
];

export const daysOfWeek = ['周一', '周二', '周三', '周四', '周五'];
export const slotCodes = ['T1', 'T2', 'T3', 'T4'];
export const slotLabels: Record<string, string> = {
  T1: '08:00-10:00',
  T2: '10:30-12:30',
  T3: '14:00-16:00',
  T4: '16:30-18:30',
};
