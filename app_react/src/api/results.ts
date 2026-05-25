/**
 * 排考结果 API
 * 封装排考结果各维度的数据查询接口
 * 所有查询始终返回当前已发布版本的数据（status=SCHEDULED）
 * 版本切换通过 "应用版本" 接口实现（publish时持久化到exams表）
 */

import apiClient from './client';
import type { ApiResponse } from './types';

// ============================================================
// 总览矩阵
// ============================================================

export interface OverviewMatrixResponse {
  matrix: Record<string, Record<string, Array<{
    exam_id: number;
    course_name: string;
    exam_label: string;
    course_type: string;
    classrooms: Array<{
      classroom_name: string;
      capacity: number;
      total_students: number;
      classes: Array<{ class_name: string; student_count: number }>;
    }>;
    teachers: Array<{
      teacher_name: string;
      role: string;
      classroom_name?: string;
      patrol_group_name?: string;
    }>;
    total_students: number;
  }>>>;
}

/**
 * 获取总览矩阵 (日期 × 时段)
 */
export async function getExamOverviewMatrix(versionId?: number | null): Promise<OverviewMatrixResponse> {
  const params = versionId ? `?version_id=${versionId}` : '';
  const { data } = await apiClient.get<ApiResponse<OverviewMatrixResponse>>(`/exams/overview/matrix${params}`);
  return data.data;
}

// ============================================================
// 教师甘特图
// ============================================================

export interface TeacherGanttItem {
  teacher_id: number;
  teacher_name: string;
  teacher_type?: string;
  max_slots: number;
  events: Array<{
    exam_id: number;
    course_name: string;
    exam_label: string;
    day_of_week: number;
    day_name: string;
    slot_code: string;
    time_range: string;
    role: string;
    classrooms: string[];
    assigned_classroom?: string;
    class_names: string[];
    student_count: number;
    room_details: Array<{
      classroom: string;
      class_names: string[];
      student_count: number;
    }>;
  }>;
}

/**
 * 获取教师监考甘特图数据
 */
export async function getTeacherGanttData(versionId?: number | null): Promise<{ teachers: TeacherGanttItem[] }> {
  const params = versionId ? `?version_id=${versionId}` : '';
  const { data } = await apiClient.get<ApiResponse<{ teachers: TeacherGanttItem[] }>>(`/exams/teachers/gantt${params}`);
  return data.data;
}

// ============================================================
// 教室矩阵
// ============================================================

export interface ClassroomMatrixResponse {
  matrix: Record<string, Record<string, Array<{
    exam_id: number;
    course_name: string;
    exam_label: string;
    total_students: number;
    class_names: string[];
    teacher_names: string[];
    day_of_week: number;
    day_name: string;
    time_range: string;
  }>>>;
}

/**
 * 获取教室使用矩阵
 */
export async function getClassroomMatrix(versionId?: number | null): Promise<ClassroomMatrixResponse> {
  const params = versionId ? `?version_id=${versionId}` : '';
  const { data } = await apiClient.get<ApiResponse<ClassroomMatrixResponse>>(`/exams/classrooms/matrix${params}`);
  return data.data;
}

// ============================================================
// 流动监考矩阵
// ============================================================

export interface PatrolMatrixResponse {
  matrix: Record<string, Record<string, Array<{
    teacher_id: number;
    teacher_name: string;
    patrol_group_name?: string;
  }>>>;
  group_colors: Record<string, string>;
}

/**
 * 获取流动监考矩阵
 */
export async function getPatrolMatrix(versionId?: number | null): Promise<PatrolMatrixResponse> {
  const params = versionId ? `?version_id=${versionId}` : '';
  const { data } = await apiClient.get<ApiResponse<PatrolMatrixResponse>>(`/exams/patrol/matrix${params}`);
  return data.data;
}

// ============================================================
// 班级考试安排
// ============================================================

export interface ClassScheduleResponse {
  class_id: number;
  class_name: string;
  grade: number;
  exam_count: number;
  exams: Array<{
    exam_id: number;
    course_name: string;
    course_type: string;
    exam_label: string;
    day_of_week: number;
    day_name: string;
    slot_code: string;
    time_range: string;
    status: string;
    classroom_name: string;
    teacher_names: string[];
  }>;
}

/**
 * 获取单个班级的考试安排
 */
export async function getClassSchedule(classId: number, versionId?: number | null): Promise<ClassScheduleResponse> {
  const params = versionId ? `?version_id=${versionId}` : '';
  const { data } = await apiClient.get<ApiResponse<ClassScheduleResponse>>(`/exams/classes/${classId}/schedule${params}`);
  return data.data;
}

/**
 * 获取所有班级的考试安排（批量接口）
 */
export async function getBatchClassSchedule(versionId?: number | null): Promise<{ classes: ClassScheduleResponse[] }> {
  const params = versionId ? `?version_id=${versionId}` : '';
  const { data } = await apiClient.get<ApiResponse<{ classes: ClassScheduleResponse[] }>>(`/exams/classes/batch-schedule${params}`);
  return data.data;
}

// ============================================================
// 课程考试安排
// ============================================================

export interface CourseExamsResponse {
  course_id: number;
  course_name: string;
  course_type: string;
  needs_ab: boolean;
  exam_count: number;
  exams: Array<{
    exam_id: number;
    exam_label: string;
    day_of_week: number;
    day_name: string;
    slot_code: string;
    time_range: string;
    classrooms: Array<{
      classroom_name: string;
      capacity: number;
      total_students: number;
      classes: Array<{ class_name: string; student_count: number }>;
    }>;
    teachers: Array<{
      teacher_name: string;
      role: string;
    }>;
  }>;
  ab_analysis?: {
    a_exam_id: number;
    b_exam_id: number;
    a_student_count: number;
    b_student_count: number;
    balance: string;
    a_time_slot?: string;
    b_time_slot?: string;
  };
}

/**
 * 获取课程的考试安排
 * 使用 /api/exams/{course_id}/exams 接口
 */
export async function getCourseExams(courseId: number, versionId?: number | null): Promise<CourseExamsResponse> {
  const params = versionId ? `?version_id=${versionId}` : '';
  const { data } = await apiClient.get<ApiResponse<CourseExamsResponse>>(`/exams/${courseId}/exams${params}`);
  return data.data;
}

// ============================================================
// 教师监考天数分布
// ============================================================

export interface TeacherDayDistributionItem {
  teacher_id: number;
  teacher_name: string;
  total_events: number;
  fixed_count: number;
  patrol_count: number;
  unique_days_count: number;
  day_list: Array<{
    date: string;
    day_name: string;
    slot_code: string;
  }>;
}

/**
 * 获取教师监考天数分布
 */
export async function getTeacherDayDistribution(versionId?: number | null): Promise<{ teachers: TeacherDayDistributionItem[] }> {
  const params = versionId ? `?version_id=${versionId}` : '';
  const { data } = await apiClient.get<ApiResponse<{ teachers: TeacherDayDistributionItem[] }>>(`/exams/teachers/day-distribution${params}`);
  return data.data;
}

// ============================================================
// 排考版本
// ============================================================

export interface ScheduleVersion {
  id: number;
  version_no: string;
  status: string;
  description?: string;
  created_at?: string;
  success?: boolean;
}

/**
 * 获取排考版本列表
 */
export async function getScheduleVersions(): Promise<ScheduleVersion[]> {
  const { data } = await apiClient.get<ApiResponse<{ items: ScheduleVersion[] }>>('/scheduler/versions');
  return data.data.items;
}
