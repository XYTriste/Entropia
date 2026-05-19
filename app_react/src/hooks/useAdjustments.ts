/**
 * useAdjustments — 手动微调 hooks
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/adjustments'
import type { ClassroomAdjustment, TeacherAdjustment, BatchAdjustment } from '@/api/adjustments'

const keys = {
  all: ['adjustments'] as const,
  lists: (params?: { date?: string; type?: string; search?: string }) =>
    ['adjustments', 'list', params] as const,
  availableClassrooms: (date: string, timeSlot: string, excludeExamId?: number) =>
    ['adjustments', 'availableClassrooms', date, timeSlot, excludeExamId] as const,
  availableTeachers: (date: string, timeSlot: string, excludeTeacherId?: number) =>
    ['adjustments', 'availableTeachers', date, timeSlot, excludeTeacherId] as const,
}

// ── 查询：调整列表（复用考试列表）────────────────────────────
export function useAdjustments(params?: {
  date?: string
  type?: string
  search?: string
  page?: number
  page_size?: number
}) {
  return useQuery({
    queryKey: keys.lists(params),
    queryFn: () => api.getAdjustments(params),
    select: (res) => res.items,
  })
}

// ── 查询：可用教室 ────────────────────────────────────────────
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

// ── 查询：可用教师 ────────────────────────────────────────────
export function useAvailableTeachers(
  date: string,
  timeSlot: string,
  excludeTeacherId?: number,
) {
  return useQuery({
    queryKey: keys.availableTeachers(date, timeSlot, excludeTeacherId),
    queryFn: () => api.getAvailableTeachers({ date, time_slot: timeSlot, exclude_teacher_id: excludeTeacherId }),
    enabled: date !== '' && timeSlot !== '',
  })
}

// ── 变更：调整教室 ────────────────────────────────────────────
export function useAdjustClassroom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.adjustClassroom,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.all })
      qc.invalidateQueries({ queryKey: ['exams'] })
    },
  })
}

// ── 变更：调整教师 ────────────────────────────────────────────
export function useAdjustTeacher() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.adjustTeacher,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.all })
      qc.invalidateQueries({ queryKey: ['exams'] })
    },
  })
}

// ── 变更：批量调整 ────────────────────────────────────────────
export function useBatchAdjust() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.batchAdjust,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.all })
      qc.invalidateQueries({ queryKey: ['exams'] })
    },
  })
}
