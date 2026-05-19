/**
 * 专业管理 API
 */

import apiClient from './client';
import type { ApiResponse, PaginatedResponse, SearchParams } from './types';
import type { Major } from '@/types';

// 请求/响应类型
export interface MajorCreate {
  name: string;
  code: string;
  department?: string;
}

export interface MajorUpdate extends Partial<MajorCreate> {}

/**
 * 获取专业列表
 */
export async function getMajors(params?: SearchParams & { all?: boolean }): Promise<PaginatedResponse<Major>> {
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
    data: { total: number; items: Major[]; skip: number; limit: number };
  }>('/majors/', { params: queryParams });

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
 * 获取单个专业
 */
export async function getMajor(id: number): Promise<Major> {
  const { data } = await apiClient.get<ApiResponse<Major>>(`/majors/${id}`);
  return data.data;
}

/**
 * 创建专业
 */
export async function createMajor(payload: MajorCreate): Promise<Major> {
  const { data } = await apiClient.post<ApiResponse<Major>>('/majors/', payload);
  return data.data;
}

/**
 * 更新专业
 */
export async function updateMajor(id: number, payload: MajorUpdate): Promise<Major> {
  const { data } = await apiClient.put<ApiResponse<Major>>(`/majors/${id}`, payload);
  return data.data;
}

/**
 * 删除专业
 */
export async function deleteMajor(id: number): Promise<void> {
  await apiClient.delete(`/majors/${id}`);
}
