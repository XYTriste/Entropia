/**
 * 导入导出 API
 */

import apiClient, { API_BASE_URL } from './client';
import type { ApiResponse } from './types';

// 导入类型
export type ImportEntity =
  | 'teachers'
  | 'classrooms'
  | 'students'
  | 'courses'
  | 'classes'
  | 'majors'
  | 'course-classes'
  | 'time-slots';

// 导入结果
export interface ImportResult {
  success: boolean;
  success_count: number;
  error_count: number;
  errors: string[];
  warnings: string[];
}

// ============================================================
// 模板下载
// ============================================================

/**
 * 下载单个实体模板
 */
export function downloadTemplate(entity: ImportEntity): void {
  window.open(
    `${API_BASE_URL}/api/import-export/templates/${entity}`,
    '_blank'
  );
}

/**
 * 下载全量模板
 */
export function downloadAllInOneTemplate(): void {
  window.open(
    `${API_BASE_URL}/api/import-export/templates/all-in-one`,
    '_blank'
  );
}

// ============================================================
// 数据导入
// ============================================================

/**
 * Excel 批量导入数据
 */
export async function importExcelData(
  entity: ImportEntity,
  file: File
): Promise<ImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await apiClient.post<ApiResponse<ImportResult>>(
    `/import-export/import-excel/${entity}`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    }
  );
  return data.data;
}

/**
 * 全量数据级联导入（单文件多 Sheet）
 */
export async function importAllInOne(file: File): Promise<{
  success: boolean;
  overall_summary: string;
  sheets: Array<{
    sheet_name: string;
    entity: string;
    label: string;
    success: boolean;
    success_count: number;
    error_count: number;
    errors: string[];
    warnings: string[];
  }>;
}> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await apiClient.post<ApiResponse<any>>(
    '/import-export/import-excel-all',
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    }
  );
  return data.data;
}

// ============================================================
// 数据导出
// ============================================================

/**
 * 下载导出文件（通用方法）
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * 导出 Excel
 */
export async function exportExcel(): Promise<void> {
  const response = await apiClient.get('/import-export/export/excel', {
    responseType: 'blob',
  });
  const blob = new Blob([response.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const filename = `排考结果_${new Date().toISOString().split('T')[0]}.xlsx`;
  downloadBlob(blob, filename);
}

/**
 * 导出 JSON
 */
export async function exportJson(): Promise<void> {
  const response = await apiClient.get('/import-export/export/json');
  const blob = new Blob([JSON.stringify(response.data.data, null, 2)], {
    type: 'application/json',
  });
  const filename = `排考结果_${new Date().toISOString().split('T')[0]}.json`;
  downloadBlob(blob, filename);
}

/**
 * 导出 SQL
 */
export async function exportSql(): Promise<void> {
  const response = await apiClient.get('/import-export/export/sql', {
    responseType: 'blob',
  });
  const blob = new Blob([response.data], {
    type: 'text/plain;charset=utf-8',
  });
  const filename = `排考结果_${new Date().toISOString().split('T')[0]}.sql`;
  downloadBlob(blob, filename);
}

// ============================================================
// 清除数据
// ============================================================

/**
 * 清除全部基础数据（保留时段）
 */
export async function clearAllData(
  confirm: boolean = true,
  preserveAuditLogs: boolean = true
): Promise<{ code: number; message: string; cleared_counts: Record<string, string> }> {
  const { data } = await apiClient.post<ApiResponse<{
    cleared_counts: Record<string, string>;
  }>>('/import-export/clear-data', {
    confirm,
    preserve_audit_logs: preserveAuditLogs,
  });
  return data.data as any;
}
