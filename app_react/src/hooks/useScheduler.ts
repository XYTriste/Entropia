/**
 * useScheduler — 排考引擎 hooks
 *
 * 用法：
 *   const { mutate: run } = useRunScheduler()
 *   run({ course_ids: [1,2,3] })
 *
 *   // SSE 进度流
 *   useSchedulerStatus(taskId, (progress) => { ... })
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/scheduler'
import type { SchedulerRunRequest, SchedulerConfig } from '@/api/scheduler'

const keys = {
  all: ['scheduler'] as const,
  config: () => ['scheduler', 'config'] as const,
}

// ── 变更：启动排考 ─────────────────────────────────────────
export function useRunScheduler() {
  return useMutation({
    mutationFn: (payload: SchedulerRunRequest) => api.runScheduler(payload),
  })
}

// ── 变更：应用排考版本 ────────────────────────────────────
export function useApplyVersion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (versionId: number) => api.applyVersion(versionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exams'] })
    },
  })
}

// ── 变更：放弃排考任务 ────────────────────────────────────
export function useAbandonTask() {
  return useMutation({
    mutationFn: (taskId: string) => api.abandonTask(taskId),
  })
}

// ── 查询：排考配置 ────────────────────────────────────────
export function useSchedulerConfig() {
  return useQuery({
    queryKey: keys.config(),
    queryFn: () => api.getSchedulerConfig(),
  })
}

// ── 变更：保存排考配置 ────────────────────────────────────
export function useSaveSchedulerConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (config: Partial<SchedulerConfig>) => api.saveSchedulerConfig(config),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.config() })
    },
  })
}

// ── SSE：订阅排考进度流 ──────────────────────────────────
/**
 * 管理 SSE 进度订阅的自定义 hook。
 * 当 taskId 有值时自动建立连接，组件卸载或 taskId 变化时自动关闭。
 *
 * @param taskId 排考任务 ID（undefined 时不连接）
 * @param onProgress 进度回调
 * @param onComplete 完成回调
 * @param onError 错误回调
 */
export function useSchedulerStatus(
  taskId: string | undefined,
  onProgress?: (progress: api.SchedulerProgress) => void,
  onComplete?: () => void,
  onError?: (error: Error) => void,
) {
  const { useEffect, useRef } = require('react')
  const statusRef = useRef<typeof EventSource | null>(null)

  useEffect(() => {
    if (!taskId) return

    const cleanup = api.subscribeSchedulerStatus(
      taskId,
      (progress) => onProgress?.(progress),
      (error) => onError?.(error),
      () => onComplete?.(),
    )

    return cleanup
  }, [taskId])
}
