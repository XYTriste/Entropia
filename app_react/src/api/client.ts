/**
 * API 客户端配置
 * 统一处理请求拦截、响应拦截、错误处理
 */

import type { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import axios from 'axios';

// API 基础 URL 配置
// 开发环境：通过 Vite 代理转发（留空，使用相对路径）
// 生产环境：可设置为完整后端地址（如 https://api.example.com）
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
export const API_PREFIX = '/api';

// 创建 axios 实例
const apiClient: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}${API_PREFIX}`,
  timeout: 30000, // 30 秒默认超时
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 可在此添加认证 token
    // const token = localStorage.getItem('token');
    // if (token && config.headers) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error: AxiosError) => {
    console.error('[API Request Error]', error);
    return Promise.reject(error);
  }
);

// 响应拦截器
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    console.log(`[API Response] ${response.config.url} - ${response.status}`);
    return response;
  },
  (error: AxiosError) => {
    if (error.response) {
      // 服务器返回错误状态码
      const status = error.response.status;
      const data = error.response.data as Record<string, unknown>;
      
      console.error(`[API Error] ${status}:`, data);

      switch (status) {
        case 400:
          console.error('请求参数错误:', data);
          break;
        case 401:
          console.error('未授权，请重新登录');
          // 可触发重新登录逻辑
          // window.location.href = '/login';
          break;
        case 403:
          console.error('权限不足');
          break;
        case 404:
          console.error('资源不存在');
          break;
        case 500:
          console.error('服务器内部错误');
          break;
        default:
          console.error('请求失败:', data);
      }
    } else if (error.request) {
      // 请求已发出但没有收到响应
      console.error('[API Error] 网络连接失败，请检查网络');
    } else {
      // 请求配置出错
      console.error('[API Error]', error.message);
    }
    return Promise.reject(error);
  }
);

export default apiClient;
