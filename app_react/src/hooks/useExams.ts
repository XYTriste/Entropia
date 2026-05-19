/**
 * useExams — 考试结果 hooks（只读查询为主）
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/exams'
import type { ExamSchedule, ScheduleVersion, KPIStats } from '@/types'

// ── Query Keys ──────────────────────────────────────────────────
const keys = {
  all: ['exams'] as const,
  lists: (params?: { version_id?: number; date?: string; teacher_id?: number; classroom_id?: number }) =>
    ['exams', 'list', params] as const,
  detail: (id: number) => ['exams', 'detail', id] as const,
  versions: () => ['exams', 'versions'] as const,
  classroomMatrix: (versionId?: number) => ['exams', 'classroomMatrix', versionId] as const,
  patrolMatrix: (versionId?: number) => ['exams', 'patrolMatrix', versionId] as const,
  classMatrix: (versionId?: number) => ['exams', 'classMatrix', versionId] as const,
  teacherGantt: (teacherId: number, versionId?: number) =>
    ['exams', 'teacherGantt', teacherId, versionId] as const,
  kpi: (versionId?: number) => ['exams', 'kpi', versionId] as const,
}

// ── 查询：考试列表 ─────────────────────────────────────────────
export function useExams(params?: {
  version_id?: number
  date?: string
  teacher_id?: number
  classroom_id?: number
  page?: number
  page_size?: number
}) {
  return useQuery({
    queryKey: keys.lists(params),
    queryFn: () => api.getExams(params),
    select: (res) => res.items,
  })
}

// ── 查询：单个考试 ─────────────────────────────────────────────
export function useExam(id: number | undefined) {
  return useQuery({
    queryKey: keys.detail(id!),
    queryFn: () => api.getExam(id!),
    enabled: id !== undefined,
  })
}

// ── 查询：排考版本列表 ────────────────────────────────────────
export function useScheduleVersions() {
  return useQuery({
    queryKey: keys.versions(),
    queryFn: () => api.getScheduleVersions(),
  })
}

// ── 查询：教室使用矩阵 ────────────────────────────────────────
export function useClassroomMatrix(versionId?: number) {
  return useQuery({
    queryKey: keys.classroomMatrix(versionId),
    queryFn: () => api.getClassroomMatrix(versionId),
  })
}

// ── 查询：流动监考矩阵 ────────────────────────────────────────
export function usePatrolMatrix(versionId?: number) {
  return useQuery({
    queryKey: keys.patrolMatrix(versionId),
    queryFn: () => api.getPatrolMatrix(versionId),
  })
}

// ── 查询：班级考试矩阵 ────────────────────────────────────────
export function useClassMatrix(versionId?: number) {
  return useQuery({
    queryKey: keys.classMatrix(versionId),
    queryFn: () => api.getClassMatrix(versionId),
  })
}

// ── 查询：教师监考甘特图 ──────────────────────────────────────
export function useTeacherGantt(teacherId: number, versionId?: number) {
  return useQuery({
    queryKey: keys.teacherGantt(teacherId, versionId),
    queryFn: () => api.getTeacherGantt(teacherId, versionId),
    enabled: teacherId > 0,
  })
}

// ── 查询：KPI 统计 ───────────────────────────────────────────
export function useKPIStats(versionId?: number) {
  return useQuery({
    queryKey: keys.kpi(versionId),
    queryFn: () => api.getKPIStats(versionId),
  })
}
