/**
 * KPI 数据 API
 *
 * 获取仪表盘所需的各项 KPI 指标数据
 */

import apiClient from './client';

/**
 * KPI 数据响应类型
 */
export interface KPIDataResponse {
  scheduled_exams: number;
  pending_exams: number;
  total_exam_sessions: number;
  classroom_utilization: number;
  teacher_assignment_rate: number;
  conflict_count: number;
  student_flow: number;
  avg_classroom_load: number;
}

/**
 * 获取 KPI 数据
 */
export async function getKPIData(): Promise<KPIDataResponse> {
  const response = await apiClient.get<{
    code: number;
    data: KPIDataResponse;
    message: string;
  }>('/kpi/');

  if (response.data.code !== 0) {
    throw new Error(response.data.message || '获取 KPI 数据失败');
  }

  return response.data.data;
}
