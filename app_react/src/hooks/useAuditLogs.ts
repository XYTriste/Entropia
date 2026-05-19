/**
 * useAuditLogs — 审计日志 hooks
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/auditLogs'
import type { AuditLogParams } from '@/api/auditLogs'

const keys = {
  all: ['auditLogs'] as const,
  lists: (params?: AuditLogParams) => ['auditLogs', 'list', params] as const,
  detail: (id: number) => ['auditLogs', 'detail', id] as const,
  types: () => ['auditLogs', 'types'] as const,
}

// ── 查询：日志列表 ──────────────────────────────────────────
export function useAuditLogs(params?: AuditLogParams) {
  return useQuery({
    queryKey: keys.lists(params),
    queryFn: () => api.getAuditLogs(params),
    select: (res: any) => ({
      items: res.items ?? res,   // 兼容两种返回格式
      total: res.total ?? 0,
    }),
  })
}

// ── 查询：单个日志详情 ──────────────────────────────────────
export function useAuditLog(id: number | undefined) {
  return useQuery({
    queryKey: keys.detail(id!),
    queryFn: () => api.getAuditLog(id!),
    enabled: id !== undefined,
  })
}

// ── 查询：操作类型列表（用于下拉筛选）─────────────────────
export function useOperationTypes() {
  return useQuery({
    queryKey: keys.types(),
    queryFn: () => api.getOperationTypes(),
    // 操作类型不常变化，缓存时间长一点
    staleTime: 5 * 60 * 1000,
  })
}
