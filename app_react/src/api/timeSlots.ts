/**
 * 时段管理 API
 */

import apiClient from './client';
import type { ApiResponse, PaginatedResponse } from './types';
import type { TimeSlot } from '@/types';

// 请求/响应类型
export interface TimeSlotCreate {
  code: string;
  name: string;
  start_time: string;
  end_time: string;
  day_of_week: number;
}

export interface TimeSlotUpdate extends Partial<TimeSlotCreate> {}

/**
 * 获取时段列表
 */
export async function getTimeSlots(): Promise<TimeSlot[]> {
  const { data } = await apiClient.get<{
    code: number;
    data: { total: number; items: any[] };
  }>('/time-slots/');
  return data.data.items.map((item) => ({
    id: item.id,
    code: item.code,
    name: item.name,
    startTime: item.start_time,
    endTime: item.end_time,
    dayOfWeek: item.day_of_week,
    examDate: item.exam_date,
    dateLabel: item.date_label,
  }));
}

/**
 * 获取单个时段
 */
export async function getTimeSlot(id: number): Promise<TimeSlot> {
  const { data } = await apiClient.get<ApiResponse<TimeSlot>>(`/time-slots/${id}`);
  return data.data;
}

/**
 * 创建时段
 */
export async function createTimeSlot(payload: TimeSlotCreate): Promise<TimeSlot> {
  const { data } = await apiClient.post<ApiResponse<TimeSlot>>('/time-slots/', payload);
  return data.data;
}

/**
 * 更新时段
 */
export async function updateTimeSlot(id: number, payload: TimeSlotUpdate): Promise<TimeSlot> {
  const { data } = await apiClient.put<ApiResponse<TimeSlot>>(`/time-slots/${id}`, payload);
  return data.data;
}

/**
 * 删除时段
 */
export async function deleteTimeSlot(id: number): Promise<void> {
  await apiClient.delete(`/time-slots/${id}`);
}

/**
 * 批量创建时段
 */
export async function bulkCreateTimeSlots(payloads: TimeSlotCreate[]): Promise<TimeSlot[]> {
  const { data } = await apiClient.post<ApiResponse<TimeSlot[]>>('/time-slots/bulk', payloads);
  return data.data;
}

/**
 * 根据起始日期和周数生成考试时段
 */
export async function generateTimeSlots(startDate: string, weeks: number): Promise<TimeSlot[]> {
  const { data } = await apiClient.post<ApiResponse<{ total: number; items: any[] }>>('/time-slots/generate', {
    start_date: startDate,
    weeks,
  });
  return data.data.items.map((item) => ({
    id: item.id,
    code: item.code,
    name: item.name,
    startTime: item.start_time,
    endTime: item.end_time,
    dayOfWeek: item.day_of_week,
    examDate: item.exam_date,
    dateLabel: item.date_label,
  }));
}
