/**
 * API 通用类型定义
 */

/** 通用 API 响应格式 */
export interface ApiResponse<T = unknown> {
  data: T;
  message?: string;
  success: boolean;
}

/** 分页响应 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/** 分页请求参数 */
export interface PaginationParams {
  page?: number;
  page_size?: number;
  skip?: number;
  limit?: number;
}

/** 搜索请求参数 */
export interface SearchParams extends PaginationParams {
  search?: string;
  ordering?: string;
}

/** API 错误响应 */
export interface ApiError {
  detail: string;
  code?: string;
  errors?: Array<{
    loc: string[];
    msg: string;
    type: string;
  }>;
}

/** SSE 流式响应事件 */
export interface SSEEvent {
  event: string;
  data: string;
  id?: string;
}

/** 文件下载响应 */
export interface FileDownload {
  filename: string;
  content: Blob;
  contentType: string;
}
