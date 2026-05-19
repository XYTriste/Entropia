/**
 * useCourses — 课程管理 hooks
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/courses'
import type { CourseCreate, CourseUpdate, SearchParams } from '@/api/courses'

const keys = {
  all: ['courses'] as const,
  lists: (params?: SearchParams & { type?: '公共课' | '专业课'; all?: boolean }) =>
    ['courses', 'list', params] as const,
  detail: (id: number) => ['courses', 'detail', id] as const,
}

export function useCourses(params?: SearchParams & { type?: '公共课' | '专业课'; all?: boolean }) {
  return useQuery({
    queryKey: keys.lists(params),
    queryFn: () => api.getCourses(params),
    select: (res) => res.items,
  })
}

export function useCourse(id: number | undefined) {
  return useQuery({
    queryKey: keys.detail(id!),
    queryFn: () => api.getCourse(id!),
    enabled: id !== undefined,
  })
}

export function useCreateCourse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createCourse,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useUpdateCourse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: CourseUpdate }) =>
      api.updateCourse(id, payload),
    onSuccess: (_data, variables) => {
      qc.setQueryData(keys.detail(variables.id), _data)
      qc.invalidateQueries({ queryKey: keys.all })
    },
  })
}

export function useDeleteCourse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteCourse,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useImportCourses() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.importCourses,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}
