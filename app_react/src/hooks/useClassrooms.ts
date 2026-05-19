/**
 * useClassrooms — 教室管理 hooks
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/classrooms'
import type { ClassroomCreate, ClassroomUpdate, SearchParams } from '@/api/classrooms'

const keys = {
  all: ['classrooms'] as const,
  lists: (params?: SearchParams) => ['classrooms', 'list', params] as const,
  detail: (id: number) => ['classrooms', 'detail', id] as const,
}

export function useClassrooms(params?: SearchParams & { all?: boolean }) {
  return useQuery({
    queryKey: keys.lists(params),
    queryFn: () => api.getClassrooms(params),
    select: (res) => res.items,
  })
}

export function useClassroom(id: number | undefined) {
  return useQuery({
    queryKey: keys.detail(id!),
    queryFn: () => api.getClassroom(id!),
    enabled: id !== undefined,
  })
}

export function useCreateClassroom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createClassroom,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useUpdateClassroom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ClassroomUpdate }) =>
      api.updateClassroom(id, payload),
    onSuccess: (_data, variables) => {
      qc.setQueryData(keys.detail(variables.id), _data)
      qc.invalidateQueries({ queryKey: keys.all })
    },
  })
}

export function useDeleteClassroom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteClassroom,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}
