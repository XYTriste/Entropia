/**
 * 教师调剂 API
 */

import apiClient from './client';
import type { ApiResponse, PaginatedResponse } from './types';
import type { TransferOperation } from '@/types';

// 请求/响应类型
export interface SwapRequest {
  teacher_a_id: number;
  teacher_b_id: number;
  exam_a_id: number;
  exam_b_id: number;
  reason: string;
}

export interface TransferRequest {
  from_teacher_id: number;
  to_teacher_id: number;
  exam_id: number;
  reason: string;
}

export interface BatchTransferRequest {
  from_teacher_id: number;
  to_teacher_id: number;
  reason: string;
  exam_ids?: number[];  // 可选：指定要转移的考试ID列表
}

/**
 * 获取调剂历史
 */
export async function getTransferHistory(params?: {
  page?: number;
  page_size?: number;
}): Promise<PaginatedResponse<TransferOperation>> {
  const { data } = await apiClient.get<PaginatedResponse<TransferOperation>>('/history', { params });
  return data;
}

/**
 * 交换场次
 */
export async function swapExams(payload: SwapRequest): Promise<{
  success: boolean;
  message: string;
  operation_id: string;
}> {
  const { data } = await apiClient.post<ApiResponse<{
    success: boolean;
    message: string;
    operation_id: string;
  }>>('/transfer/swap', payload);
  return data.data;
}

/**
 * 转移场次
 */
export async function transferExam(payload: TransferRequest): Promise<{
  success: boolean;
  message: string;
  operation_id: string;
}> {
  const { data } = await apiClient.post<ApiResponse<{
    success: boolean;
    message: string;
    operation_id: string;
  }>>('/transfer/transfer', payload);
  return data.data;
}

/**
 * 批量转交
 */
export async function batchTransfer(payload: BatchTransferRequest): Promise<{
  success: boolean;
  message: string;
  transferred_count: number;
  operation_id: string;
}> {
  const { data } = await apiClient.post<ApiResponse<{
    success: boolean;
    message: string;
    transferred_count: number;
    operation_id: string;
  }>>('/transfer/batch', payload);
  return data.data;
}

/**
 * 撤销操作
 */
export async function undoTransfer(operationId: string): Promise<{
  success: boolean;
  message: string;
}> {
  const { data } = await apiClient.post<ApiResponse<{
    success: boolean;
    message: string;
  }>>(`/transfer/undo/${operationId}`);
  return data.data;
}
