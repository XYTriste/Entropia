/**
 * AI 助手 API
 */

import apiClient, { API_BASE_URL } from './client';
import type { ApiResponse } from './types';
import type { ChatMessage } from '@/types';

// 消息请求类型
export interface ChatRequest {
  message: string;
  context?: {
    version_id?: number;
    teacher_id?: number;
    classroom_id?: number;
  };
}

// SSE 消息回调类型
export type MessageCallback = (message: Partial<ChatMessage>) => void;

/**
 * 发送消息（SSE 流式响应 - 使用 fetch API）
 */
export function chat(
  payload: ChatRequest,
  onMessage: MessageCallback,
  onError?: (error: Error) => void,
  onComplete?: () => void
): () => void {
  let aborted = false;
  const controller = new AbortController();

  // 使用 fetch API 处理 SSE 流
  const url = `${API_BASE_URL}/api/chat/stream`;
  
  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionId: 'default',
      messages: [
        { role: 'user', content: payload.message }
      ]
    }),
    signal: controller.signal,
  })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      function read() {
        if (aborted) return;

        reader.read().then(({ done, value }) => {
          if (done || aborted) {
            onComplete?.();
            return;
          }

          // 解码并添加到缓冲区
          buffer += decoder.decode(value, { stream: true });

          // 处理完整的 SSE 消息（以 \n\n 分隔）
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || ''; // 最后一行可能不完整

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'content' || data.type === 'text') {
                  onMessage({ content: data.content, role: 'assistant' });
                } else if (data.type === 'done' || data.type === 'complete') {
                  onComplete?.();
                  return;
                } else if (data.type === 'error') {
                  onError?.(new Error(data.content || 'Unknown error'));
                  return;
                }
              } catch (e) {
                console.error('Failed to parse SSE message:', e);
              }
            }
          }

          read(); // 继续读取
        }).catch(error => {
          if (!aborted) {
            console.error('SSE read error:', error);
            onError?.(error);
          }
        });
      }

      read();
    })
    .catch(error => {
      if (!aborted) {
        console.error('SSE fetch error:', error);
        onError?.(error);
      }
    });

  // 返回清理函数
  return () => {
    aborted = true;
    controller.abort();
  };
}

/**
 * 获取对话历史
 */
export async function getChatHistory(params?: {
  page?: number;
  page_size?: number;
}): Promise<{
  items: ChatMessage[];
  total: number;
}> {
  const { data } = await apiClient.get<ApiResponse<{
    items: ChatMessage[];
    total: number;
  }>>('/history', { params });
  return data.data;
}

/**
 * 清空对话历史
 */
export async function clearChatHistory(): Promise<{ success: boolean }> {
  const { data } = await apiClient.delete<ApiResponse<{ success: boolean }>>('/history');
  return data.data;
}
