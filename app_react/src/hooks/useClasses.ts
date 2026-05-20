/**
 * useClasses — 班级管理 hooks
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/classes'
import type { ClassCreate, ClassUpdate, SearchParams } from '@/api/classes'

const keys = {
  all: ['classes'] as const,
  lists: (params?: SearchParams & { all?: boolean; major_id?: number }) => ['classes', 'list', params] as const,
  detail: (id: number) => ['classes', 'detail', id] as const,
}

export function useClasses(params?: SearchParams & { all?: boolean; major_id?: number }) {
  return useQuery({
    queryKey: keys.lists(params),
    queryFn: () => api.getClasses(params),
    select: (res) => res.items,
  })
}

export function useClass(id: number | undefined) {
  return useQuery({
    queryKey: keys.detail(id!),
    queryFn: () => api.getClass(id!),
    enabled: id !== undefined,
  })
}

export function useCreateClass() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createClass,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useUpdateClass() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ClassUpdate }) =>
      api.updateClass(id, payload),
    onSuccess: (_data, variables) => {
      qc.setQueryData(keys.detail(variables.id), _data)
      qc.invalidateQueries({ queryKey: keys.all })
    },
  })
}

export function useDeleteClass() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteClass,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}
