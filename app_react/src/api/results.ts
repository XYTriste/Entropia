/**
 * 排考结果 API
 * 封装排考结果各维度的数据查询接口
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
export async function getExamOverviewMatrix(): Promise<OverviewMatrixResponse> {
  const { data } = await apiClient.get<ApiResponse<OverviewMatrixResponse>>('/exams/overview/matrix');
  return data.data;
}

// ============================================================
// 教师甘特图
// ============================================================

export interface TeacherGanttItem {
  teacher_id: number;
  teacher_name: string;
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
  }>;
}

/**
 * 获取教师监考甘特图数据
 */
export async function getTeacherGanttData(): Promise<{ teachers: TeacherGanttItem[] }> {
  const { data } = await apiClient.get<ApiResponse<{ teachers: TeacherGanttItem[] }>>('/exams/teachers/gantt');
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
  }>>>;
}

/**
 * 获取教室使用矩阵
 */
export async function getClassroomMatrix(): Promise<ClassroomMatrixResponse> {
  const { data } = await apiClient.get<ApiResponse<ClassroomMatrixResponse>>('/exams/classrooms/matrix');
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
export async function getPatrolMatrix(): Promise<PatrolMatrixResponse> {
  const { data } = await apiClient.get<ApiResponse<PatrolMatrixResponse>>('/exams/patrol/matrix');
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
export async function getClassSchedule(classId: number): Promise<ClassScheduleResponse> {
  const { data } = await apiClient.get<ApiResponse<ClassScheduleResponse>>(`/exams/classes/${classId}/schedule`);
  return data.data;
}

/**
 * 获取所有班级的考试安排（批量接口）
 */
export async function getBatchClassSchedule(): Promise<{ classes: Array<ClassScheduleResponse> }> {
  const { data } = await apiClient.get<ApiResponse<{ classes: ClassScheduleResponse[] }>>('/exams/classes/batch-schedule');
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
export async function getCourseExams(courseId: number): Promise<CourseExamsResponse> {
  const { data } = await apiClient.get<ApiResponse<CourseExamsResponse>>(`/exams/${courseId}/exams`);
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
}

/**
 * 获取排考版本列表
 */
export async function getScheduleVersions(): Promise<ScheduleVersion[]> {
  const { data } = await apiClient.get<ApiResponse<{ items: ScheduleVersion[] }>>('/scheduler/versions');
  return data.data.items;
}
