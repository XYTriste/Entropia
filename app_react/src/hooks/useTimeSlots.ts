/**
 * useTimeSlots — 时段管理 hooks
 * 注意：getTimeSlots 返回 TimeSlot[] 而非PaginatedResponse，select 不需要解包
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/timeSlots'
import type { TimeSlotCreate, TimeSlotUpdate } from '@/api/timeSlots'

const keys = {
  all: ['timeSlots'] as const,
  lists: () => ['timeSlots', 'list'] as const,
  detail: (id: number) => ['timeSlots', 'detail', id] as const,
}

export function useTimeSlots() {
  return useQuery({
    queryKey: keys.lists(),
    queryFn: () => api.getTimeSlots(),
    // API 直接返回 TimeSlot[]，不需要 select 解包
  })
}

export function useTimeSlot(id: number | undefined) {
  return useQuery({
    queryKey: keys.detail(id!),
    queryFn: () => api.getTimeSlot(id!),
    enabled: id !== undefined,
  })
}

export function useCreateTimeSlot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createTimeSlot,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useUpdateTimeSlot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: TimeSlotUpdate }) =>
      api.updateTimeSlot(id, payload),
    onSuccess: (_data, variables) => {
      qc.setQueryData(keys.detail(variables.id), _data)
      qc.invalidateQueries({ queryKey: keys.all })
    },
  })
}

export function useDeleteTimeSlot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteTimeSlot,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useBulkCreateTimeSlots() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.bulkCreateTimeSlots,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}
