/**
 * 排考引擎 API
 */

import apiClient from './client';
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
  job_id: string;
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
 * 获取排考状态（轮询）
 */
export async function getSchedulerStatus(jobId: string): Promise<{
  job_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'completed_with_violations';
  created_at?: string;
  result?: {
    version_id: number;
    version_no: string;
    success: boolean;
    exams_scheduled: number;
    violations: number;
    solve_time: string;
  };
  error?: string;
}> {
  const { data } = await apiClient.get<ApiResponse<{
    job_id: string;
    status: string;
    created_at?: string;
    result?: any;
    error?: string;
  }>>(`/scheduler/status/${jobId}`);
  return {
    ...data.data,
    status: data.data.status as 'pending' | 'running' | 'completed' | 'failed' | 'completed_with_violations',
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
  const { data } = await apiClient.put<ApiResponse<SchedulerConfig>>('/scheduler/config', config);
  return data.data;
}

/**
 * 删除排考版本
 * - draft: 直接删除版本记录
 * - published: 同时删除关联的考试数据
 */
export async function deleteScheduleVersion(versionId: number): Promise<{ deleted_exams: number }> {
  const { data } = await apiClient.delete<ApiResponse<{ deleted_exams: number }>>(
    `/scheduler/versions/${versionId}`
  );
  return data.data;
}
