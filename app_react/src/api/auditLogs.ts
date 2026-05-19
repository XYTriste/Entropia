/**
 * 审计日志 API
 */

import apiClient from './client';
import type { ApiResponse, PaginatedResponse } from './types';
import type { AuditLog } from '@/types';

// 请求/响应类型
export interface AuditLogParams {
  start_date?: string;
  end_date?: string;
  operator?: string;
  operation_type?: string;
  entity_type?: string;
  page?: number;
  page_size?: number;
}

export interface OperationType {
  type: string;
  label: string;
  count: number;
}

/**
 * 获取审计日志列表
 */
export async function getAuditLogs(params?: AuditLogParams): Promise<PaginatedResponse<AuditLog>> {
  const { data } = await apiClient.get<PaginatedResponse<AuditLog>>('/', { params });
  return data;
}

/**
 * 获取操作类型列表（用于下拉筛选）
 */
export async function getOperationTypes(): Promise<OperationType[]> {
  const { data } = await apiClient.get<ApiResponse<OperationType[]>>('/types');
  return data.data;
}

/**
 * 获取单个审计日志详情
 */
export async function getAuditLog(id: number): Promise<AuditLog> {
  const { data } = await apiClient.get<ApiResponse<AuditLog>>(`/${id}`);
  return data.data;
}
