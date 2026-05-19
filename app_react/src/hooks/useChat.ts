/**
 * useChat — AI 助手 hooks
 *
 * 用法（SSE 流）：
 *   const { sendMessage, isStreaming, messages, error } = useChat()
 *   sendMessage({ message: '帮我分析一下排考结果' })
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/chat'
import type { ChatMessage } from '@/types'

// ── SSE：AI 对话流（自定义 hook）─────────────────────
interface UseChatReturn {
  /** 当前对话消息列表（含流式中间态） */
  messages: ChatMessage[]
  /** 是否正在等待 AI 回复 */
  isStreaming: boolean
  /** 错误信息 */
  error: Error | null
  /** 发送消息（触发 SSE 流） */
  sendMessage: (req: api.ChatRequest) => void
  /** 清空消息列表（不调接口，仅本地） */
  clearMessages: () => void
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  // 组件卸载时清理 SSE 连接
  useEffect(() => {
    return () => {
      cleanupRef.current?.()
    }
  }, [])

  const sendMessage = useCallback((req: api.ChatRequest) => {
    // 先清理旧连接
    cleanupRef.current?.()
    setError(null)
    setIsStreaming(true)

    // 添加一个"等待中"的助手消息占位
    const assistantMsg: ChatMessage = {
      id: Date.now(),
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, assistantMsg])

    const cleanup = api.chat(
      req,
      // onMessage：增量追加 content
      (partial) => {
        setMessages(prev => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last && last.role === 'assistant') {
            last.content += (partial as any).content ?? ''
          }
          return next
        })
      },
      // onError
      (err) => {
        setIsStreaming(false)
        setError(err)
      },
      // onComplete
      () => {
        setIsStreaming(false)
      },
    )

    cleanupRef.current = cleanup
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  return { messages, isStreaming, error, sendMessage, clearMessages }
}

// ── 查询：对话历史 ────────────────────────────────────
export function useChatHistory(params?: { page?: number; page_size?: number }) {
  return useQuery({
    queryKey: ['chat', 'history', params],
    queryFn: () => api.getChatHistory(params),
    select: (res) => res.items,
  })
}

// ── 变更：清空对话历史 ────────────────────────────────
export function useClearChatHistory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.clearChatHistory,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat', 'history'] })
    },
  })
}
