/**
 * 课程管理 API
 */

import apiClient from './client';
import type { ApiResponse, PaginatedResponse, SearchParams } from './types';
import type { Course } from '@/types';

// 请求/响应类型
export interface CourseCreate {
  name: string;
  code: string;
  type: '公共课' | '专业课';
  department?: string;
  student_count?: number;
  has_ab_split?: boolean;
  dept_assigned_date?: string;
  dept_assigned_time_slot_id?: number;
}

export interface CourseUpdate extends Partial<CourseCreate> {}

/**
 * 获取课程列表
 */
export async function getCourses(params?: SearchParams & { type?: '公共课' | '专业课'; all?: boolean }): Promise<PaginatedResponse<Course>> {
  const queryParams: Record<string, unknown> = {};
  if (params?.all) {
    queryParams.all = true;
  } else {
    if (params?.page) queryParams.skip = (params.page - 1) * (params.page_size || 10);
    if (params?.page_size) queryParams.limit = params.page_size;
  }
  if (params?.search) queryParams.search = params.search;
  if (params?.type) queryParams.course_type = params.type;

  const { data } = await apiClient.get<{
    code: number;
    data: { total: number; items: Course[]; skip: number; limit: number };
  }>('/courses/', { params: queryParams });

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
 * 获取单个课程（含关联班级）
 */
export async function getCourse(id: number): Promise<Course & { classes: Array<{ id: number; name: string }> }> {
  const { data } = await apiClient.get<ApiResponse<Course & { classes: Array<{ id: number; name: string }> }>>(`/courses/${id}`);
  return data.data;
}

/**
 * 创建课程
 */
export async function createCourse(payload: CourseCreate): Promise<Course> {
  const { data } = await apiClient.post<ApiResponse<Course>>('/courses/', payload);
  return data.data;
}

/**
 * 更新课程
 */
export async function updateCourse(id: number, payload: CourseUpdate): Promise<Course> {
  const { data } = await apiClient.put<ApiResponse<Course>>(`/courses/${id}`, payload);
  return data.data;
}

/**
 * 删除课程
 */
export async function deleteCourse(id: number): Promise<void> {
  await apiClient.delete(`/courses/${id}`);
}

/**
 * 导入课程
 */
export async function importCourses(file: File): Promise<{ imported: number; errors: string[] }> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await apiClient.post<ApiResponse<{ imported: number; errors: string[] }>>(
    '/courses/import',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return data.data;
}
