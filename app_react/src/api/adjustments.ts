/**
 * 手动微调 API
 * 对接后端 /exams/ 接口
 */

import apiClient from './client';
import type { ApiResponse, PaginatedResponse } from './types';

// ============================================================
// 类型定义
// ============================================================

/** 考试安排（用于手动微调页面） */
export interface AdjustmentExam {
  id: number;
  course_id: number;
  course_name: string;
  course_type: string;  // "common" | "major"
  exam_label: string;
  time_slot: {
    id: number | null;
    day_of_week: number;
    day_name: string;    // "周一" | "周二" | ...
    slot_code: string;  // "T1" | "T2" | "T3" | "T4"
    time_range: string;  // "08:00-10:00"
    exam_date?: string;  // ISO 日期，如 "2026-06-02"
    date_label?: string; // "06-02"
  };
  classrooms: Array<{
    classroom_id: number;
    classroom_name: string;
    capacity: number;
    total_students: number;
    classes: Array<{
      class_id: number;
      class_name: string;
      student_count: number;
    }>;
  }>;
  teachers: Array<{
    teacher_id: number;
    teacher_name: string;
    role: 'fixed' | 'patrol';
    classroom_id: number | null;
    classroom_name: string | null;
  }>;
  fixed_teachers: Array<{
    teacher_id: number;
    teacher_name: string;
    role: 'fixed' | 'patrol';
    classroom_id: number | null;
    classroom_name: string | null;
  }>;
  patrol_teachers: Array<{
    teacher_id: number;
    teacher_name: string;
    role: 'fixed' | 'patrol';
    classroom_id: number | null;
    classroom_name: string | null;
  }>;
  total_students: number;
}

/** 考试列表响应 */
export interface ExamListResponse {
  total: number;
  items: AdjustmentExam[];
  skip: number;
  limit: number;
}

/** 调整请求基础 */
export interface AdjustmentRequest {
  exam_id: number;
  reason: string;
}

/** 教室调整 */
export interface ClassroomAdjustment extends AdjustmentRequest {
  new_classroom_id: number;
}

/** 教师调整 */
export interface TeacherAdjustment extends AdjustmentRequest {
  old_teacher_id?: number;
  new_teacher_id: number;
  type: 'fixed' | 'patrol';
}

/** 批量调整 */
export interface BatchAdjustment {
  adjustments: Array<ClassroomAdjustment | TeacherAdjustment>;
  reason: string;
}

// ============================================================
// API 接口
// ============================================================

/**
 * 获取考试安排列表（用于手动微调）
 * @param params 过滤参数
 */
export async function getAdjustmentExams(params?: {
  version_id?: number;      // 排考版本ID，不指定默认返回已发布版本
  course_type?: 'common' | 'major';  // 课程类型过滤
  date?: string;           // 日期过滤: 周一/周二/周三/周四/周五
  search?: string;         // 搜索: 课程名/教室名/教师名
  page?: number;
  page_size?: number;
}): Promise<PaginatedResponse<AdjustmentExam>> {
  const queryParams: Record<string, unknown> = {};

  if (params?.version_id) queryParams.version_id = params.version_id;
  if (params?.course_type) queryParams.course_type = params.course_type;
  if (params?.date) queryParams.date = params.date;
  if (params?.search) queryParams.search = params.search;
  if (params?.page) queryParams.skip = (params.page - 1) * (params.page_size || 100);
  if (params?.page_size) queryParams.limit = params.page_size;

  const { data } = await apiClient.get<ApiResponse<ExamListResponse>>('/exams/', {
    params: queryParams,
  });

  const page = params?.page ?? 1;
  const page_size = params?.page_size ?? 100;

  return {
    items: data.data.items,
    total: data.data.total,
    page,
    page_size,
    total_pages: Math.ceil(data.data.total / page_size),
  };
}

/**
 * 调整考试教室
 */
export async function adjustClassroom(payload: ClassroomAdjustment): Promise<{
  success: boolean;
  message: string;
  exam: AdjustmentExam;
}> {
  const { data } = await apiClient.post<ApiResponse<{
    success: boolean;
    message: string;
    exam: AdjustmentExam;
  }>>('/adjustments/classroom', payload);
  return data.data;
}

/**
 * 更换监考教师
 */
export async function changeTeacher(payload: {
  exam_id: number;
  old_teacher_id: number;
  new_teacher_id: number;
  role?: 'fixed' | 'patrol';
  reason?: string;
}): Promise<{
  success: boolean;
  message: string;
}> {
  const { data } = await apiClient.post<ApiResponse<{
    success: boolean;
    message: string;
  }>>('/adjustments/change-teacher', {
    exam_id: payload.exam_id,
    old_teacher_id: payload.old_teacher_id,
    new_teacher_id: payload.new_teacher_id,
    role: payload.role || 'fixed',
    reason: payload.reason || '手动更换监考教师',
  });
  return data.data;
}

/**
 * 批量调整
 */
export async function batchAdjust(payload: BatchAdjustment): Promise<{
  success: boolean;
  message: string;
  adjusted_count: number;
}> {
  const { data } = await apiClient.post<ApiResponse<{
    success: boolean;
    message: string;
    adjusted_count: number;
  }>>('/adjustments/batch', payload);
  return data.data;
}

/**
 * 获取可用的教室列表（用于换教室）
 */
export async function getAvailableClassrooms(params: {
  date: string;
  time_slot: string;
  exclude_exam_id?: number;
}): Promise<Array<{
  id: number;
  name: string;
  capacity: number;
  building: string;
}>> {
  const { data } = await apiClient.get<ApiResponse<Array<{
    id: number;
    name: string;
    capacity: number;
    building: string;
}>>>('/adjustments/available_classrooms', { params });
  return data.data;
}

/**
 * 获取可用的教师列表（用于换教师）
 * @param params time_slot_id: 时段ID, exclude_teacher_id?: 排除的教师ID
 */
export async function getAvailableTeachers(params: {
  time_slot_id: number;
  exclude_teacher_id?: number;
}): Promise<{
  teachers: Array<{
    id: number;
    name: string;
    teacher_type: string;
    current_slots: number;
    max_slots: number;
    has_conflict: boolean;
  }>;
  time_slot: {
    id: number;
    day_name: string;
    slot_code: string;
    time_range: string;
    exam_date?: string;
    date_label?: string;
  };
}> {
  const queryParams: Record<string, unknown> = {
    time_slot_id: params.time_slot_id,
  };
  if (params.exclude_teacher_id) {
    queryParams.exclude_teacher_id = params.exclude_teacher_id;
  }

  const { data } = await apiClient.get<ApiResponse<{
    teachers: Array<{
      id: number;
      name: string;
      teacher_type: string;
      current_slots: number;
      max_slots: number;
      has_conflict: boolean;
    }>;
    time_slot: {
      id: number;
      day_name: string;
      slot_code: string;
      time_range: string;
      exam_date?: string;
      date_label?: string;
    };
  }>>('/adjustments/available-teachers', { params: queryParams });
  return data.data;
}
