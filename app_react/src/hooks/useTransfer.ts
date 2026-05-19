/**
 * useTransfer — 教师调剂 hooks
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/transfer'
import type { SwapRequest, TransferRequest, BatchTransferRequest } from '@/api/transfer'
import type { TransferOperation } from '@/types'

const keys = {
  all: ['transfer'] as const,
  history: (params?: { page?: number; page_size?: number }) =>
    ['transfer', 'history', params] as const,
}

// ── 查询：调剂历史 ────────────────────────────────────────────
export function useTransferHistory(params?: {
  page?: number
  page_size?: number
}) {
  return useQuery({
    queryKey: keys.history(params),
    queryFn: () => api.getTransferHistory(params),
    select: (res) => res.items,
  })
}

// ── 变更：交换场次 ────────────────────────────────────────────
export function useSwapExams() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: SwapRequest) => api.swapExams(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.all })
      qc.invalidateQueries({ queryKey: ['exams'] })
    },
  })
}

// ── 变更：转移场次 ────────────────────────────────────────────
export function useTransferExam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: TransferRequest) => api.transferExam(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.all })
      qc.invalidateQueries({ queryKey: ['exams'] })
    },
  })
}

// ── 变更：批量转交 ────────────────────────────────────────────
export function useBatchTransfer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: BatchTransferRequest) => api.batchTransfer(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.all })
      qc.invalidateQueries({ queryKey: ['exams'] })
    },
  })
}

// ── 变更：撤销操作 ────────────────────────────────────────────
export function useUndoTransfer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (operationId: string) => api.undoTransfer(operationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.all })
      qc.invalidateQueries({ queryKey: ['exams'] })
    },
  })
}
