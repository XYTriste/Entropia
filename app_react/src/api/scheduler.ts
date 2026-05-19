/**
 * 排考引擎 API
 */

import apiClient, { API_BASE_URL } from './client';
import type { ApiResponse } from './types';
import type { SchedulerConfig } from '@/types';

// 请求/响应类型
export interface SchedulerRunRequest {
  course_ids: number[];
  strategy?: 'all' | 'public_only' | 'major_only';
  fixed_proctors_per_room?: 1 | 2 | 3;
  max_solve_time?: number;
  max_proctor_days?: number;
  no_cross_day?: boolean;
}

export interface SchedulerRunResponse {
  task_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface SchedulerProgress {
  progress: number;
  current_step: string;
  logs: string[];
  exam_count?: number;
  conflict_count?: number;
}

// SSE 进度回调类型
export type ProgressCallback = (progress: SchedulerProgress) => void;

/**
 * 启动排考
 */
export async function runScheduler(payload: SchedulerRunRequest): Promise<SchedulerRunResponse> {
  const { data } = await apiClient.post<ApiResponse<SchedulerRunResponse>>('/scheduler/run', payload);
  return data.data;
}

/**
 * 获取排考状态（SSE 流式）
 */
export function subscribeSchedulerStatus(
  taskId: string,
  onProgress: ProgressCallback,
  onError?: (error: Error) => void,
  onComplete?: () => void
): () => void {
  const eventSource = new EventSource(`${API_BASE_URL}/api/scheduler/status/${taskId}`);

  eventSource.addEventListener('progress', (event: MessageEvent) => {
    try {
      const progress: SchedulerProgress = JSON.parse(event.data);
      onProgress(progress);
    } catch (e) {
      console.error('Failed to parse progress event:', e);
    }
  });

  eventSource.addEventListener('complete', () => {
    onComplete?.();
    eventSource.close();
  });

  eventSource.addEventListener('error', (event: MessageEvent) => {
    console.error('SSE error:', event);
    onError?.(new Error('SSE connection error'));
    eventSource.close();
  });

  // 返回清理函数
  return () => {
    eventSource.close();
  };
}

/**
 * 应用排考版本
 */
export async function applyVersion(versionId: number): Promise<{ success: boolean; message: string }> {
  const { data } = await apiClient.post<ApiResponse<{ success: boolean; message: string }>>(
    `/scheduler/apply/${versionId}`
  );
  return data.data;
}

/**
 * 放弃排考任务
 */
export async function abandonTask(taskId: string): Promise<{ success: boolean }> {
  const { data } = await apiClient.post<ApiResponse<{ success: boolean }>>(
    `/scheduler/abandon/${taskId}`
  );
  return data.data;
}

/**
 * 获取排考配置
 */
export async function getSchedulerConfig(): Promise<SchedulerConfig> {
  const { data } = await apiClient.get<ApiResponse<SchedulerConfig>>('/scheduler/config');
  return data.data;
}

/**
 * 保存排考配置
 */
export async function saveSchedulerConfig(config: Partial<SchedulerConfig>): Promise<SchedulerConfig> {
  const { data } = await apiClient.post<ApiResponse<SchedulerConfig>>('/scheduler/config', config);
  return data.data;
}
