/**
 * 手动微调 API
 */

import apiClient from './client';
import type { ApiResponse, PaginatedResponse } from './types';
import type { ExamSchedule } from '@/types';
import type { Classroom, Teacher } from '@/types';

// 请求/响应类型
export interface AdjustmentRequest {
  exam_id: number;
  reason: string;
}

export interface ClassroomAdjustment extends AdjustmentRequest {
  new_classroom_id: number;
}

export interface TeacherAdjustment extends AdjustmentRequest {
  old_teacher_id?: number;
  new_teacher_id: number;
  type: 'fixed' | 'patrol';
}

export interface BatchAdjustment {
  adjustments: Array<ClassroomAdjustment | TeacherAdjustment>;
  reason: string;
}

/**
 * 获取调整列表
 */
export async function getAdjustments(params?: {
  date?: string;
  type?: string;
  search?: string;
  page?: number;
  page_size?: number;
}): Promise<PaginatedResponse<ExamSchedule>> {
  const { data } = await apiClient.get<PaginatedResponse<ExamSchedule>>('/', { params });
  return data;
}

/**
 * 调整考试教室
 */
export async function adjustClassroom(payload: ClassroomAdjustment): Promise<{
  success: boolean;
  message: string;
  exam: ExamSchedule;
}> {
  const { data } = await apiClient.post<ApiResponse<{
    success: boolean;
    message: string;
    exam: ExamSchedule;
  }>>('/classroom', payload);
  return data.data;
}

/**
 * 调整监考教师
 */
export async function adjustTeacher(payload: TeacherAdjustment): Promise<{
  success: boolean;
  message: string;
  exam: ExamSchedule;
}> {
  const { data } = await apiClient.post<ApiResponse<{
    success: boolean;
    message: string;
    exam: ExamSchedule;
  }>>('/teacher', payload);
  return data.data;
}

/**
 * 批量调整
 */
export async function batchAdjust(payload: BatchAdjustment): Promise<{
  success: boolean;
  message: string;
  adjusted_count: number;
}> {
  const { data } = await apiClient.post<ApiResponse<{
    success: boolean;
    message: string;
    adjusted_count: number;
  }>>('/batch', payload);
  return data.data;
}

/**
 * 获取可用的教室列表
 */
export async function getAvailableClassrooms(params: {
  date: string;
  time_slot: string;
  exclude_exam_id?: number;
}): Promise<Classroom[]> {
  const { data } = await apiClient.get<ApiResponse<Classroom[]>>('/available_classrooms', { params });
  return data.data;
}

/**
 * 获取可用的教师列表
 */
export async function getAvailableTeachers(params: {
  date: string;
  time_slot: string;
  exclude_teacher_id?: number;
}): Promise<Teacher[]> {
  const { data } = await apiClient.get<ApiResponse<Teacher[]>>('/available_teachers', { params });
  return data.data;
}
