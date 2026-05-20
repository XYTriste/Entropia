/**
 * 考试结果 API
 */

import apiClient from './client';
import type { ApiResponse, PaginatedResponse } from './types';
import type { ExamSchedule, ScheduleVersion } from '@/types';

// 各种矩阵响应类型
export interface ClassroomMatrix {
  dates: string[];
  slots: Array<{ code: string; name: string; start: string; end: string }>;
  matrix: Array<{
    date: string;
    slot: string;
    exams: ExamSchedule[];
  }>;
}

export interface PatrolMatrix {
  days: string[];
  slots: string[];
  matrix: Array<{
    day: string;
    slot: string;
    group_name?: string;
    teachers: string[];
  }>;
}

export interface TeacherGantt {
  teacher_id: number;
  teacher_name: string;
  exams: Array<{
    date: string;
    time_slot: string;
    course_name: string;
    classroom_name: string;
    is_patrol: boolean;
  }>;
}

export interface ClassMatrix {
  classes: Array<{
    id: number;
    name: string;
    exams: ExamSchedule[];
  }>;
}

export interface CourseDetail {
  course_id: number;
  course_name: string;
  exams: ExamSchedule[];
}

export interface KPIStats {
  total_exams: number;
  unscheduled_exams: number;
  classroom_utilization: number;
  teacher_assign_rate: number;
  conflict_count: number;
  student_flow: number;
  avg_classroom_load: number;
}

/**
 * 获取考试安排列表
 */
export async function getExams(params?: {
  version_id?: number;
  date?: string;
  teacher_id?: number;
  classroom_id?: number;
  page?: number;
  page_size?: number;
}): Promise<PaginatedResponse<ExamSchedule>> {
  const queryParams: Record<string, unknown> = {};
  if (params?.version_id) queryParams.version_id = params.version_id;
  if (params?.date) queryParams.date = params.date;
  if (params?.teacher_id) queryParams.teacher_id = params.teacher_id;
  if (params?.classroom_id) queryParams.classroom_id = params.classroom_id;
  if (params?.page) queryParams.skip = (params.page - 1) * (params.page_size || 10);
  if (params?.page_size) queryParams.limit = params.page_size;

  const { data } = await apiClient.get<{
    code: number;
    data: { total: number; items: ExamSchedule[]; skip: number; limit: number };
  }>('/', { params: queryParams });

  const page = params?.page ?? 1;
  const page_size = params?.page_size ?? 10;
  return {
    items: data.data.items,
    total: data.data.total,
    page,
    page_size,
    total_pages: Math.ceil(data.data.total / page_size),
  };
}

/**
 * 获取单个考试安排
 */
export async function getExam(id: number): Promise<ExamSchedule> {
  const { data } = await apiClient.get<ApiResponse<ExamSchedule>>(`/${id}`);
  return data.data;
}

/**
 * 获取甘特图数据
 */
export async function getGanttData(params?: {
  version_id?: number;
  type?: 'teacher' | 'classroom' | 'class';
}): Promise<Record<string, unknown>> {
  const { data } = await apiClient.get<ApiResponse<Record<string, unknown>>>('/gantt', { params });
  return data.data;
}

/**
 * 获取教师监考甘特图
 */
export async function getTeacherGantt(teacherId: number, versionId?: number): Promise<TeacherGantt> {
  const { data } = await apiClient.get<ApiResponse<TeacherGantt>>('/teacher_gantt', {
    params: { teacher_id: teacherId, version_id: versionId },
  });
  return data.data;
}

/**
 * 获取版本统计
 */
export async function getVersionStats(versionId: number): Promise<ScheduleVersion> {
  const { data } = await apiClient.get<ApiResponse<ScheduleVersion>>('/version_stats', {
    params: { version_id: versionId },
  });
  return data.data;
}

/**
 * 获取教室使用矩阵
 */
export async function getClassroomMatrix(versionId?: number): Promise<ClassroomMatrix> {
  const { data } = await apiClient.get<ApiResponse<ClassroomMatrix>>('/classroom_matrix', {
    params: { version_id: versionId },
  });
  return data.data;
}

/**
 * 获取流动监考矩阵
 */
export async function getPatrolMatrix(versionId?: number): Promise<PatrolMatrix> {
  const { data } = await apiClient.get<ApiResponse<PatrolMatrix>>('/patrol_matrix', {
    params: { version_id: versionId },
  });
  return data.data;
}

/**
 * 获取班级考试矩阵
 */
export async function getClassMatrix(versionId?: number): Promise<ClassMatrix> {
  const { data } = await apiClient.get<ApiResponse<ClassMatrix>>('/class_matrix', {
    params: { version_id: versionId },
  });
  return data.data;
}

/**
 * 获取课程详情
 */
export async function getCourseDetail(courseId: number, versionId?: number): Promise<CourseDetail> {
  const { data } = await apiClient.get<ApiResponse<CourseDetail>>('/course_detail', {
    params: { course_id: courseId, version_id: versionId },
  });
  return data.data;
}

/**
 * 获取 KPI 统计
 */
export async function getKPIStats(versionId?: number): Promise<KPIStats> {
  const { data } = await apiClient.get<ApiResponse<KPIStats>>('/kpi_stats', {
    params: { version_id: versionId },
  });
  return data.data;
}

/**
 * 获取排考版本列表
 * 后端返回格式: { total, items: [{ id, version_no, status, description, created_at }] }
 * 转换为前端格式
 */
export async function getScheduleVersions(): Promise<ScheduleVersion[]> {
  const { data } = await apiClient.get<ApiResponse<{
    total: number;
    items: Array<{
      id: number;
      version_no: string;
      status: string;
      description: string | null;
      created_at: string | null;
    }>;
  }>>('/scheduler/versions');

  // 转换为前端格式
  return data.data.items.map((v) => ({
    id: v.id,
    name: v.version_no,  // 使用 version_no 作为 name
    createdAt: v.created_at || '',
    examCount: 0,  // 后端未返回，需要额外查询
    teacherCount: 0,
    roomCount: 0,
    classCount: 0,
    courseCount: 0,
    patrolCount: 0,
    isActive: v.status === 'published',  // published 对应 isActive
  }));
}

// ── 专业班级考试数量批量接口 ──────────────────────────────────────

export interface MajorClassExamCount {
  class_id: number;
  class_name: string;
  grade: number;
  student_count: number;
  exam_count: number;
}

export interface MajorClassesExamCountsResponse {
  major_id: number;
  major_name: string;
  classes: MajorClassExamCount[];
}

/**
 * 获取专业下所有班级的考试数量（批量接口）
 */
export async function getMajorClassesExamCounts(majorId: number): Promise<MajorClassesExamCountsResponse> {
  const { data } = await apiClient.get<ApiResponse<MajorClassesExamCountsResponse>>(
    `/majors/${majorId}/classes-exam-counts`
  );
  return data.data;
}
