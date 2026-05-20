/**
 * useAdjustments — 手动微调 hooks
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/adjustments'

const keys = {
  all: ['adjustments'] as const,
  lists: (params?: {
    version_id?: number;
    course_type?: 'common' | 'major';
    date?: string;
    search?: string;
    page?: number;
    page_size?: number;
  }) => ['adjustments', 'list', params] as const,
  availableClassrooms: (date: string, timeSlot: string, excludeExamId?: number) =>
    ['adjustments', 'availableClassrooms', date, timeSlot, excludeExamId] as const,
  availableTeachers: (date: string, timeSlot: string, excludeTeacherId?: number) =>
    ['adjustments', 'availableTeachers', date, timeSlot, excludeTeacherId] as const,
}

// ── 查询：考试安排列表（用于手动微调）
export function useAdjustmentExams(params?: {
  version_id?: number;
  course_type?: 'common' | 'major';
  date?: string;
  search?: string;
  page?: number;
  page_size?: number;
}) {
  return useQuery({
    queryKey: keys.lists(params),
    queryFn: () => api.getAdjustmentExams(params),
    select: (res) => res.items,
  })
}

// ── 查询：可用教室
export function useAvailableClassrooms(
  date: string,
  timeSlot: string,
  excludeExamId?: number,
) {
  return useQuery({
    queryKey: keys.availableClassrooms(date, timeSlot, excludeExamId),
    queryFn: () => api.getAvailableClassrooms({ date, time_slot: timeSlot, exclude_exam_id: excludeExamId }),
    enabled: date !== '' && timeSlot !== '',
  })
}

// ── 查询：可用教师
export function useAvailableTeachers(
  date: string,
  timeSlotCode: string,
  excludeTeacherId?: number,
) {
  return useQuery({
    queryKey: keys.availableTeachers(date, timeSlotCode, excludeTeacherId),
    queryFn: () => api.getAvailableTeachers({ date, time_slot_code: timeSlotCode, exclude_teacher_id: excludeTeacherId }),
    enabled: date !== '' && timeSlotCode !== '',
  })
}

// ── 变更：调整教室
export function useAdjustClassroom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.adjustClassroom,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.all })
      qc.invalidateQueries({ queryKey: ['adjustmentExams'] })
    },
  })
}

// ── 变更：调整教师
export function useAdjustTeacher() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.adjustTeacher,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.all })
      qc.invalidateQueries({ queryKey: ['adjustmentExams'] })
    },
  })
}

// ── 变更：批量调整
export function useBatchAdjust() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.batchAdjust,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.all })
      qc.invalidateQueries({ queryKey: ['adjustmentExams'] })
    },
  })
}
