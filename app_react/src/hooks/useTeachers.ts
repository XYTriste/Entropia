/**
 * useTeachers — 教师管理 hooks
 *
 * 用法：
 *   const { data, isLoading, error } = useTeachers({ search: '张' })
 *   const { mutate: create } = useCreateTeacher()
 *   create({ name: '张三', type: '专任' })
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/teachers'
import type { TeacherFormData, TeacherUpdate, SearchParams } from '@/api/teachers'

// ── Query Key 工厂 ───────────────────────────────────────────────
// 所有涉及教师列表的 query 都用 ['teachers', params] 作为 key
// invalidate 时只需 invalidate ['teachers'] 即可命中所有子 key
const teacherKeys = {
  all: ['teachers'] as const,
  lists: (params?: SearchParams) => ['teachers', 'list', params] as const,
  detail: (id: number) => ['teachers', 'detail', id] as const,
}

// ── 查询：教师列表 ──────────────────────────────────────────────
export function useTeachers(params?: SearchParams & { all?: boolean }) {
  return useQuery({
    queryKey: teacherKeys.lists(params),
    queryFn: () => api.getTeachers(params),
    // 后端返回 PaginatedResponse<Teacher>，直接把 items 暴露给组件
    select: (res) => res.items,
  })
}

// ── 查询：单个教师详情 ──────────────────────────────────────────
export function useTeacher(id: number | undefined) {
  return useQuery({
    queryKey: teacherKeys.detail(id!),
    queryFn: () => api.getTeacher(id!),
    enabled: id !== undefined,
  })
}

// ── 变更：新增教师 ──────────────────────────────────────────────
export function useCreateTeacher() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: TeacherFormData) => api.createTeacher(payload),
    onSuccess: () => {
      // 新增成功后，让所有教师列表 query 失效 → 自动重新请求
      qc.invalidateQueries({ queryKey: teacherKeys.all })
    },
  })
}

// ── 变更：更新教师 ──────────────────────────────────────────────
export function useUpdateTeacher() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: TeacherUpdate }) =>
      api.updateTeacher(id, payload),
    onSuccess: (_data, variables) => {
      // 更新详情缓存（避免重新请求）
      qc.setQueryData(teacherKeys.detail(variables.id), _data)
      // 让列表失效（列表数据可能变化）
      qc.invalidateQueries({ queryKey: teacherKeys.all })
    },
  })
}

// ── 变更：删除教师 ──────────────────────────────────────────────
export function useDeleteTeacher() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteTeacher,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teacherKeys.all })
    },
  })
}

// ── 变更：批量导入教师 ──────────────────────────────────────────
export function useImportTeachers() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.importTeachers,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teacherKeys.all })
    },
  })
}
