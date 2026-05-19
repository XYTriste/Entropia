/**
 * 导入导出 API
 */

import apiClient, { API_BASE_URL } from './client';
import type { ApiResponse } from './types';

// 导出类型
export type ExportType = 'excel' | 'json' | 'sql';
export type ImportType = 'teachers' | 'courses' | 'classes' | 'students' | 'exams' | 'all';

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
}

export interface TemplateInfo {
  type: ImportType;
  name: string;
  description: string;
  required_columns: string[];
  optional_columns: string[];
}

/**
 * 获取导入模板列表
 */
export async function getTemplates(): Promise<TemplateInfo[]> {
  const { data } = await apiClient.get<ApiResponse<TemplateInfo[]>>('/templates');
  return data.data;
}

/**
 * 下载导入模板
 */
export function downloadTemplate(type: ImportType): void {
  window.open(`${API_BASE_URL}/api/import-export/template/${type}`, '_blank');
}

/**
 * 导入数据
 */
export async function importData(
  type: ImportType,
  file: File
): Promise<ImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await apiClient.post<ApiResponse<ImportResult>>(`/import/${type}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data;
}

/**
 * 导出 Excel
 */
export async function exportExcel(versionId?: number): Promise<Blob> {
  const response = await apiClient.post<Blob>(
    '/export/excel',
    { version_id: versionId },
    { responseType: 'blob' }
  );
  return response.data;
}

/**
 * 导出 JSON
 */
export async function exportJson(versionId?: number): Promise<Record<string, unknown>> {
  const { data } = await apiClient.post<ApiResponse<Record<string, unknown>>>('/export/json', {
    version_id: versionId,
  });
  return data.data;
}

/**
 * 导出 SQL
 */
export async function exportSql(versionId?: number): Promise<string> {
  const { data } = await apiClient.post<ApiResponse<{ sql: string }>>('/export/sql', {
    version_id: versionId,
  });
  return data.data.sql;
}

/**
 * 下载导出文件（通用方法）
 */
export function downloadFile(blob: Blob, filename: string): void {
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
 * 导出并下载 Excel
 */
export async function exportAndDownloadExcel(versionId?: number): Promise<void> {
  const blob = await exportExcel(versionId);
  const filename = `排考结果_${new Date().toISOString().split('T')[0]}.xlsx`;
  downloadFile(blob, filename);
}
