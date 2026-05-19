/**
 * 教室管理 API
 */

import apiClient from './client';
import type { ApiResponse, PaginatedResponse, SearchParams } from './types';
import type { Classroom } from '@/types';

// 请求/响应类型
export interface ClassroomCreate {
  name: string;
  capacity: number;
  building: string;
  floor?: number;
  type?: string;
}

export interface ClassroomUpdate extends Partial<ClassroomCreate> {}

/**
 * 获取教室列表
 */
export async function getClassrooms(params?: SearchParams & { all?: boolean }): Promise<PaginatedResponse<Classroom>> {
  const queryParams: Record<string, unknown> = {};
  if (params?.all) {
    queryParams.all = true;
  } else {
    if (params?.page) queryParams.skip = (params.page - 1) * (params.page_size || 10);
    if (params?.page_size) queryParams.limit = params.page_size;
  }
  if (params?.search) queryParams.search = params.search;

  const { data } = await apiClient.get<{
    code: number;
    data: { total: number; items: Classroom[]; skip: number; limit: number };
  }>('/classrooms/', { params: queryParams });

  const page = params?.page ?? 1;
  const page_size = params?.page_size ?? 10;
  return {
    items: data.data.items,
    total: data.data.total,
    page,
    page_size,
    total_pages: params?.all ? 1 : Math.ceil(data.data.total / page_size),
  };
}

/**
 * 获取单个教室
 */
export async function getClassroom(id: number): Promise<Classroom> {
  const { data } = await apiClient.get<ApiResponse<Classroom>>(`/classrooms/${id}`);
  return data.data;
}

/**
 * 创建教室
 */
export async function createClassroom(payload: ClassroomCreate): Promise<Classroom> {
  const { data } = await apiClient.post<ApiResponse<Classroom>>('/classrooms/', payload);
  return data.data;
}

/**
 * 更新教室
 */
export async function updateClassroom(id: number, payload: ClassroomUpdate): Promise<Classroom> {
  const { data } = await apiClient.put<ApiResponse<Classroom>>(`/classrooms/${id}`, payload);
  return data.data;
}

/**
 * 删除教室
 */
export async function deleteClassroom(id: number): Promise<void> {
  await apiClient.delete(`/classrooms/${id}`);
}

// ── 教室考试详情类型 ──────────────────────────────────────

export interface ClassroomExam {
  exam_id: number;
  course_id: number;
  course_name: string;
  course_type: string;
  exam_paper: string;
  date: string;
  day_of_week: number | null;
  day_name: string;
  slot_code: string;
  time_slot: string;
  total_students: number;
  classes: Array<{ class_name: string; student_count: number }>;
  classes_str: string;
  fixed_teachers: string[];
  fixed_teachers_str: string;
}

export interface ClassroomExamResponse {
  classroom_id: number;
  classroom_name: string;
  capacity: number;
  exam_count: number;
  exams: ClassroomExam[];
}

/**
 * 获取教室的考试安排详情
 */
export async function getClassroomExams(classroomId: number): Promise<ClassroomExamResponse> {
  const { data } = await apiClient.get<ApiResponse<ClassroomExamResponse>>(`/classrooms/${classroomId}/exams`);
  return data.data;
}
