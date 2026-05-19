/**
 * useStudents — 学生管理 hooks
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/students'
import type { StudentCreate, StudentUpdate, SearchParams } from '@/api/students'

const keys = {
  all: ['students'] as const,
  lists: (params?: SearchParams & { all?: boolean }) => ['students', 'list', params] as const,
  detail: (id: number) => ['students', 'detail', id] as const,
}

export function useStudents(params?: SearchParams & { all?: boolean }) {
  return useQuery({
    queryKey: keys.lists(params),
    queryFn: () => api.getStudents(params),
    select: (res) => res.items,
  })
}

export function useStudent(id: number | undefined) {
  return useQuery({
    queryKey: keys.detail(id!),
    queryFn: () => api.getStudent(id!),
    enabled: id !== undefined,
  })
}

export function useCreateStudent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createStudent,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useUpdateStudent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: StudentUpdate }) =>
      api.updateStudent(id, payload),
    onSuccess: (_data, variables) => {
      qc.setQueryData(keys.detail(variables.id), _data)
      qc.invalidateQueries({ queryKey: keys.all })
    },
  })
}

export function useDeleteStudent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteStudent,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useImportStudents() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.importStudents,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}
