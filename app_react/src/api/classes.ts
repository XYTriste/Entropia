/**
 * 班级管理 API
 */

import apiClient from './client';
import type { ApiResponse, PaginatedResponse, SearchParams } from './types';
import type { Class } from '@/types';

// 请求/响应类型
export interface ClassCreate {
  name: string;
  major_id?: number;
  grade: string;
  student_count?: number;
}

export interface ClassUpdate extends Partial<ClassCreate> {}

/**
 * 获取班级列表
 */
export async function getClasses(params?: SearchParams & { all?: boolean; major_id?: number }): Promise<PaginatedResponse<Class>> {
  const queryParams: Record<string, unknown> = {};
  if (params?.all) {
    queryParams.all = true;
  } else {
    if (params?.page) queryParams.skip = (params.page - 1) * (params.page_size || 10);
    if (params?.page_size) queryParams.limit = params.page_size;
  }
  if (params?.search) queryParams.search = params.search;
  if (params?.major_id) queryParams.major_id = params.major_id;

  const { data } = await apiClient.get<{
    code: number;
    data: { total: number; items: Class[]; skip: number; limit: number };
  }>('/classes/', { params: queryParams });

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
 * 获取单个班级
 */
export async function getClass(id: number): Promise<Class> {
  const { data } = await apiClient.get<ApiResponse<Class>>(`/classes/${id}`);
  return data.data;
}

/**
 * 创建班级
 */
export async function createClass(payload: ClassCreate): Promise<Class> {
  const { data } = await apiClient.post<ApiResponse<Class>>('/classes/', payload);
  return data.data;
}

/**
 * 更新班级
 */
export async function updateClass(id: number, payload: ClassUpdate): Promise<Class> {
  const { data } = await apiClient.put<ApiResponse<Class>>(`/classes/${id}`, payload);
  return data.data;
}

/**
 * 删除班级
 */
export async function deleteClass(id: number): Promise<void> {
  await apiClient.delete(`/classes/${id}`);
}
