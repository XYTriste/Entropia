/**
 * useImportExport — 导入导出 hooks
 *
 * 注意：导出类函数返回 Blob/string，用 useMutation 包装，
 * 成功后在 onSuccess 里触发浏览器下载。
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/importExport'
import type { ImportType, TemplateInfo } from '@/api/importExport'

const keys = {
  all: ['importExport'] as const,
  templates: () => ['importExport', 'templates'] as const,
}

// ── 查询：模板列表 ──────────────────────────────────────────
export function useTemplates() {
  return useQuery({
    queryKey: keys.templates(),
    queryFn: () => api.getTemplates(),
  })
}

// ── 变更：导入数据 ──────────────────────────────────────────
export function useImportData() {
  return useMutation({
    mutationFn: ({ type, file }: { type: ImportType; file: File }) =>
      api.importData(type, file),
  })
}

// ── 变更：导出 Excel（触发浏览器下载）──────────────────────
export function useExportExcel() {
  return useMutation({
    mutationFn: (versionId?: number) => api.exportExcel(versionId),
    onSuccess: (blob) => {
      api.downloadFile(blob, `排考结果_${new Date().toISOString().split('T')[0]}.xlsx`)
    },
  })
}

// ── 变更：导出 JSON ─────────────────────────────────────────
export function useExportJson() {
  return useMutation({
    mutationFn: (versionId?: number) => api.exportJson(versionId),
    onSuccess: (json) => {
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' })
      api.downloadFile(blob, `排考结果_${new Date().toISOString().split('T')[0]}.json`)
    },
  })
}

// ── 变更：导出 SQL ──────────────────────────────────────────
export function useExportSql() {
  return useMutation({
    mutationFn: (versionId?: number) => api.exportSql(versionId),
    onSuccess: (sql) => {
      const blob = new Blob([sql], { type: 'application/sql' })
      api.downloadFile(blob, `排考结果_${new Date().toISOString().split('T')[0]}.sql`)
    },
  })
}

// ── 工具：下载模板（直接 window.open，不需要 mutation）────
export function downloadTemplate(type: ImportType): void {
  api.downloadTemplate(type)
}
