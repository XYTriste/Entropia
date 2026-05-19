/**
 * 学生管理 API
 */

import apiClient from './client';
import type { ApiResponse, PaginatedResponse, SearchParams } from './types';
import type { Student } from '@/types';

// 请求/响应类型
export interface StudentCreate {
  name: string;
  student_id: string;
  class_id?: number;
  class_name?: string;
  major?: string;
}

export interface StudentUpdate extends Partial<StudentCreate> {}

/**
 * 获取学生列表
 */
export async function getStudents(params?: SearchParams & { all?: boolean }): Promise<PaginatedResponse<Student>> {
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
    data: { total: number; items: Student[]; skip: number; limit: number };
  }>('/students/', { params: queryParams });

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
 * 获取单个学生
 */
export async function getStudent(id: number): Promise<Student> {
  const { data } = await apiClient.get<ApiResponse<Student>>(`/students/${id}`);
  return data.data;
}

/**
 * 创建学生
 */
export async function createStudent(payload: StudentCreate): Promise<Student> {
  const { data } = await apiClient.post<ApiResponse<Student>>('/students/', payload);
  return data.data;
}

/**
 * 更新学生
 */
export async function updateStudent(id: number, payload: StudentUpdate): Promise<Student> {
  const { data } = await apiClient.put<ApiResponse<Student>>(`/students/${id}`, payload);
  return data.data;
}

/**
 * 删除学生
 */
export async function deleteStudent(id: number): Promise<void> {
  await apiClient.delete(`/students/${id}`);
}

/**
 * 批量导入学生
 */
export async function importStudents(file: File): Promise<{ imported: number; errors: string[] }> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await apiClient.post<ApiResponse<{ imported: number; errors: string[] }>>(
    '/students/import',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return data.data;
}
