/**
 * 教师管理 API
 */

import apiClient from './client';
import type { ApiResponse, PaginatedResponse, SearchParams } from './types';
import type { Teacher } from '@/types';

// 请求/响应类型
// 前端表单类型（中文显示）
export interface TeacherFormData {
  name: string;
  teacher_type: '专任' | '兼任';
  max_slots?: number;
  phone?: string;
  department?: string;
}

// 转换为后端 API 类型（英文值）
function toApiPayload(data: TeacherFormData): { name: string; teacher_type: 'full_time' | 'part_time'; max_slots?: number; phone?: string; department?: string } {
  return {
    name: data.name,
    teacher_type: data.teacher_type === '专任' ? 'full_time' : 'part_time',
    max_slots: data.max_slots,
    phone: data.phone,
    department: data.department,
  };
}

export interface TeacherUpdate extends Partial<Omit<TeacherFormData, 'teacher_type'>> {
  teacher_type?: '专任' | '兼任';
  max_slots?: number;
}

/**
 * 获取教师列表
 * @param all=true 时忽略分页，返回所有数据
 */
export async function getTeachers(params?: SearchParams & { all?: boolean }): Promise<PaginatedResponse<Teacher>> {
  const queryParams: Record<string, unknown> = {};
  if (params?.all) {
    queryParams.all = true;
  } else {
    if (params?.page) queryParams.skip = (params.page - 1) * (params.page_size || 10);
    if (params?.page_size) queryParams.limit = params.page_size;
  }
  if (params?.search) queryParams.search = params.search;
  if (params?.ordering) queryParams.ordering = params.ordering;

  const { data } = await apiClient.get<{
    code: number;
    message: string;
    data: { total: number; items: Teacher[]; skip: number; limit: number };
  }>('/teachers/', { params: queryParams });
  
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
 * 获取单个教师
 */
export async function getTeacher(id: number): Promise<Teacher> {
  const { data } = await apiClient.get<ApiResponse<Teacher>>(`/teachers/${id}`);
  return data.data;
}

/**
 * 创建教师
 */
export async function createTeacher(payload: TeacherFormData): Promise<Teacher> {
  const { data } = await apiClient.post<ApiResponse<Teacher>>('/teachers/', toApiPayload(payload));
  return data.data;
}

/**
 * 更新教师
 */
export async function updateTeacher(id: number, payload: TeacherUpdate): Promise<Teacher> {
  // 转换 teacher_type 从中文到英文
  const apiPayload: Record<string, unknown> = { ...payload };
  if (payload.teacher_type) {
    apiPayload.teacher_type = payload.teacher_type === '专任' ? 'full_time' : 'part_time';
  }
  const { data } = await apiClient.put<ApiResponse<Teacher>>(`/teachers/${id}`, apiPayload);
  return data.data;
}

/**
 * 获取教师详情（含监考安排）
 */
export async function getTeacherExams(id: number): Promise<{
  teacher_id: number;
  teacher_name: string;
  current_slots: number;
  max_slots: number;
  fixed_count: number;
  patrol_count: number;
  fixed_exams: Array<{
    exam_id: number;
    course_name: string;
    course_type: string;
    date: string;
    time_slot: string;
    classroom_name: string;
    student_count: number;
  }>;
  patrol_exams: Array<{
    exam_id: number;
    course_name: string;
    course_type: string;
    date: string;
    time_slot: string;
    classrooms: Array<{ classroom_name: string; student_count: number }>;
  }>;
}> {
  const { data } = await apiClient.get<ApiResponse<{
    teacher_id: number;
    teacher_name: string;
    current_slots: number;
    max_slots: number;
    fixed_count: number;
    patrol_count: number;
    fixed_exams: Array<{
      exam_id: number;
      course_name: string;
      course_type: string;
      date: string;
      time_slot: string;
      classroom_name: string;
      student_count: number;
    }>;
    patrol_exams: Array<{
      exam_id: number;
      course_name: string;
      course_type: string;
      date: string;
      time_slot: string;
      classrooms: Array<{ classroom_name: string; student_count: number }>;
    }>;
  }>>(`/teachers/${id}/exams`);
  return data.data;
}

/**
 * 删除教师
 */
export async function deleteTeacher(id: number): Promise<void> {
  await apiClient.delete(`/teachers/${id}`);
}

/**
 * 导入教师
 */
export async function importTeachers(file: File): Promise<{ imported: number; errors: string[] }> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await apiClient.post<ApiResponse<{ imported: number; errors: string[] }>>(
    '/teachers/import',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return data.data;
}
