/**
 * useScheduler — 排考引擎 hooks
 *
 * 用法：
 *   const { mutate: run } = useRunScheduler()
 *   run({ course_ids: [1,2,3] })
 *
 *   // 轮询排考进度
 *   useSchedulerStatus(taskId, (status) => { ... })
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

// ── 轮询：排考状态 ────────────────────────────────────────
export function useSchedulerStatus(
  jobId: string | undefined,
  onStatusChange?: (status: Awaited<ReturnType<typeof api.getSchedulerStatus>>) => void,
) {
  const { useEffect, useRef } = require('react')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastStatusRef = useRef<string | null>(null)

  useEffect(() => {
    if (!jobId) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    const poll = async () => {
      try {
        const status = await api.getSchedulerStatus(jobId)
        // 状态变化时通知回调
        if (status.status !== lastStatusRef.current) {
          lastStatusRef.current = status.status
          onStatusChange?.(status)
        }
        // 完成或失败时停止轮询
        if (status.status === 'completed' || status.status === 'failed' || status.status === 'completed_with_violations') {
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
        }
      } catch (e) {
        console.error('轮询排考状态失败:', e)
      }
    }

    // 立即查询一次
    poll()
    // 每 2 秒轮询一次
    intervalRef.current = setInterval(poll, 2000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [jobId])
}
