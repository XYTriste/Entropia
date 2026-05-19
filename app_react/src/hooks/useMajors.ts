/**
 * useMajors — 专业管理 hooks
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/majors'
import type { MajorCreate, MajorUpdate, SearchParams } from '@/api/majors'

const keys = {
  all: ['majors'] as const,
  lists: (params?: SearchParams & { all?: boolean }) => ['majors', 'list', params] as const,
  detail: (id: number) => ['majors', 'detail', id] as const,
}

export function useMajors(params?: SearchParams & { all?: boolean }) {
  return useQuery({
    queryKey: keys.lists(params),
    queryFn: () => api.getMajors(params),
    select: (res) => res.items,
  })
}

export function useMajor(id: number | undefined) {
  return useQuery({
    queryKey: keys.detail(id!),
    queryFn: () => api.getMajor(id!),
    enabled: id !== undefined,
  })
}

export function useCreateMajor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createMajor,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useUpdateMajor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: MajorUpdate }) =>
      api.updateMajor(id, payload),
    onSuccess: (_data, variables) => {
      qc.setQueryData(keys.detail(variables.id), _data)
      qc.invalidateQueries({ queryKey: keys.all })
    },
  })
}

export function useDeleteMajor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteMajor,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}
