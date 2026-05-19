import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  BarChart3,
  Edit3,
  Upload,
  Settings,
  Send,
  Bot,
  User,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import RollingNumber from '@/components/RollingNumber';
import { useKPIData, type KPIDataItem } from '@/hooks/useKPIData';
import { chat, type ChatMessage as ChatMsgType } from '@/api/chat';
import type { ChatMessage } from '@/types';
import MarkdownIt from 'markdown-it';

const kpiColors: Record<string, { bg: string; text: string; glow?: string }> = {
  blue: { bg: 'rgba(99, 149, 195, 0.08)', text: '#6395C3' },
  green: { bg: 'rgba(107, 155, 138, 0.08)', text: '#6B9B8A' },
  purple: { bg: 'rgba(156, 129, 175, 0.08)', text: '#9C81AF' },
  red: { bg: 'rgba(194, 122, 99, 0.08)', text: '#C27A63', glow: 'rgba(194, 122, 99, 0.15)' },
  yellow: { bg: 'rgba(197, 172, 116, 0.08)', text: '#C5AC74' },
  orange: { bg: 'rgba(200, 145, 107, 0.08)', text: '#C9916B' },
};

const quickActions = [
  { label: '开始排考', path: '/scheduler', icon: Play, color: '#6395C3' },
  { label: '查看结果', path: '/results', icon: BarChart3, color: '#6B9B8A' },
  { label: '手动微调', path: '/adjustments', icon: Edit3, color: '#C5AC74' },
  { label: '导入数据', path: '/import-export', icon: Upload, color: '#9C81AF' },
  { label: '基础数据', path: '/base-data', icon: Settings, color: '#C9916B' },
];

export default function DashboardView() {
  const navigate = useNavigate();
  const [clock, setClock] = useState(new Date());
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isBackendOnline, setIsBackendOnline] = useState(true);  // 后端服务状态
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { kpiData, loading: kpiLoading } = useKPIData();

  // Markdown 渲染器
  const md = new MarkdownIt({
    html: true,
    breaks: true,
    linkify: true,
  });

  // 检测后端服务状态
  const checkBackendStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/chat/status', {
        method: 'GET',
        signal: AbortSignal.timeout(3000),  // 3秒超时
      });
      setIsBackendOnline(response.ok);
    } catch (error) {
      setIsBackendOnline(false);
    }
  }, []);

  // 初始检测 + 定期轮询（每30秒）
  useEffect(() => {
    checkBackendStatus();
    const interval = setInterval(checkBackendStatus, 30000);
    return () => clearInterval(interval);
  }, [checkBackendStatus]);

  // 添加欢迎消息
  useEffect(() => {
    if (chatMessages.length === 0) {
      setChatMessages([{
        id: 'welcome',
        role: 'assistant',
        content: '您好！我是排考小助手。我可以帮您查询教室、安排考试等。请问有什么可以帮您的吗？',
        timestamp: new Date(),
      }]);
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const formatClock = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return { dateStr: `${y}-${m}-${d}`, timeStr: `${h}:${min}:${s}` };
  };

  const { dateStr, timeStr } = formatClock(clock);

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    // 调用真实聊天 API
    const cleanup = chat(
      { message: inputValue },
      // onMessage callback
      (partialMessage) => {
        setChatMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.role === 'assistant' && !lastMsg.id.startsWith('done-')) {
            // 更新最后一条助手消息
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...lastMsg,
              content: (lastMsg.content || '') + (partialMessage.content || ''),
            };
            return updated;
          } else {
            // 添加新消息
            const newMsg: ChatMessage = {
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              content: partialMessage.content || '',
              timestamp: new Date(),
            };
            return [...prev, newMsg];
          }
        });
      },
      // onError callback
      (error) => {
        console.error('Chat error:', error);
        setIsTyping(false);
        setChatMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: '抱歉，聊天服务暂时不可用，请稍后再试。',
            timestamp: new Date(),
          },
        ]);
      },
      // onComplete callback
      () => {
        setIsTyping(false);
      }
    );
  };

  return (
    <div className="page-container px-4 md:px-6">
      {/* Background grid pattern */}
      <div
        className="absolute inset-0 opacity-30 dark:opacity-[0.07] pointer-events-none"
        style={{
          backgroundImage: `url('/images/dashboard-bg.jpg')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      <div className="relative max-w-[1400px] mx-auto space-y-6 md:space-y-8">
        {/* Header */}
        <div className="text-center py-4 md:py-6">
          <h1 className="font-display text-2xl md:text-4xl font-semibold text-[#1F2328] dark:text-[#E6EDF3] tracking-wider mb-3">
            考务监控指挥中心
          </h1>
          <div className="flex items-center justify-center gap-2">
            <span className="text-xs md:text-sm text-[#8C959F] dark:text-[#8B949E]">{dateStr}</span>
            <span className="font-mono text-base md:text-lg text-[#1F2328] dark:text-[#E6EDF3] tracking-wider">
              {timeStr}
              <span className="animate-pulse-soft text-[#D4A373]">:</span>
              <span className="text-[#8C959F] dark:text-[#8B949E]">{timeStr.slice(-2)}</span>
            </span>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {kpiLoading ? (
            // 加载状态
            Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="glass-card rounded-3xl p-5 animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 mb-2"></div>
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
              </div>
            ))
          ) : (
            kpiData.map((kpi, index) => {
              const colors = kpiColors[kpi.color];
              return (
                <div
                  key={index}
                  className={`glass-card rounded-3xl p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                    kpi.hasAlert ? 'animate-pulse' : ''
                  }`}
                  style={{
                    backgroundColor: colors.bg,
                    ...(kpi.hasAlert
                      ? { animation: 'alert-pulse 2s ease-in-out infinite' }
                      : {}),
                  }}
                >
                  <div className="text-xs text-[#8C959F] dark:text-[#8B949E] mb-2">{kpi.label}</div>
                  <div className="flex items-baseline gap-1">
                    <span
                      className="font-display text-3xl font-semibold"
                      style={{ color: colors.text }}
                    >
                      <RollingNumber
                        target={kpi.value}
                        decimals={kpi.unit === '%' ? 1 : 0}
                      />
                    </span>
                    <span className="text-sm text-[#8C959F] dark:text-[#8B949E]">{kpi.unit}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Middle Section: Chat + Gauges */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 md:gap-6">
          {/* Chat Assistant */}
          <div className="glass-card rounded-3xl overflow-hidden flex flex-col" style={{ minHeight: 624 }}>
            <div className="px-6 py-4 border-b border-[#F3F4F6] dark:border-[#30363D] flex items-center gap-2">
              <Bot size={18} className="text-[#D4A373]" />
              <span className="font-display text-base font-medium text-[#1F2328] dark:text-[#E6EDF3]">
                排考小助手
              </span>
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${isBackendOnline ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${isBackendOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                {isBackendOnline ? '在线' : '离线'}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ maxHeight: 576 }}>
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      msg.role === 'assistant'
                        ? 'bg-[#D4A373]/10'
                        : 'bg-[#334155]'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      <Bot size={14} className="text-[#D4A373]" />
                    ) : (
                      <User size={14} className="text-white" />
                    )}
                  </div>
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === 'assistant'
                        ? 'bg-[#F9FAFB] dark:bg-[#21262D] text-[#1F2328] dark:text-[#E6EDF3]'
                        : 'text-white'
                    }`}
                    style={
                      msg.role === 'user'
                        ? { background: 'linear-gradient(135deg, #D4A373 0%, #C9956B 100%)' }
                        : {}
                    }
                  >
                    {msg.role === 'assistant' ? (
                      <div dangerouslySetInnerHTML={{ __html: md.render(msg.content || '') }} />
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#D4A373]/10 flex items-center justify-center flex-shrink-0">
                    <Bot size={14} className="text-[#D4A373]" />
                  </div>
                  <div className="bg-[#F9FAFB] dark:bg-[#21262D] rounded-2xl px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#C8CDD3] animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full bg-[#C8CDD3] animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-[#C8CDD3] animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="px-4 py-3 border-t border-[#F3F4F6] dark:border-[#30363D]">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="输入您的问题..."
                  className="form-input-glass flex-1 rounded-xl"
                />
                <button
                  onClick={handleSendMessage}
                  className="btn-amber w-10 h-10 flex items-center justify-center rounded-xl p-0"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Gauge Panel */}
          <div className="space-y-4">
            <div className="glass-card rounded-3xl p-6">
              <h3 className="font-display text-sm font-medium text-[#8C959F] dark:text-[#8B949E] mb-4 text-center">
                排考完成度
              </h3>
              <div className="flex flex-col items-center">
                {kpiLoading ? (
                  <div className="animate-pulse">
                    <div className="h-40 w-40 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                  </div>
                ) : (
                  (() => {
                    const kpi = kpiData.find(p => p.label === '已安排考试场次');
                    const pendingKpi = kpiData.find(p => p.label === '未安排考试场次');
                    const scheduled = kpi?.value || 0;
                    const pending = pendingKpi?.value || 0;
                    const total = scheduled + pending;
                    const percentage = total > 0 ? Math.round(scheduled / total * 100) : 0;
                    const radius = 70;
                    const circumference = 2 * Math.PI * radius;
                    const progress = (percentage / 100) * circumference;
                    
                    return (
                      <>
                        <svg width="180" height="180" viewBox="0 0 180 180">
                          <circle cx="90" cy="90" r={radius} fill="none" stroke="#F3F4F6" strokeWidth="10" />
                          <circle
                            cx="90"
                            cy="90"
                            r={radius}
                            fill="none"
                            stroke="#D4A373"
                            strokeWidth="10"
                            strokeLinecap="round"
                            strokeDasharray={`${progress} ${circumference}`}
                            strokeDashoffset={0}
                            transform="rotate(-90 90 90)"
                            style={{ filter: 'drop-shadow(0 2px 6px rgba(212, 163, 115, 0.3))' }}
                          />
                          <text x="90" y="82" textAnchor="middle" className="font-display text-3xl font-semibold fill-[#1F2328] dark:fill-[#E6EDF3]">
                            {percentage}%
                          </text>
                          <text x="90" y="105" textAnchor="middle" className="text-xs fill-[#8C959F] dark:fill-[#8B949E]">
                            已排考 {scheduled}/{total} 场
                          </text>
                        </svg>
                      </>
                    );
                  })()
                )}
              </div>
            </div>

            <div className="glass-card rounded-3xl p-6">
              <h3 className="font-display text-sm font-medium text-[#8C959F] dark:text-[#8B949E] mb-4 text-center">
                冲突检测状态
              </h3>
              {kpiLoading ? (
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 mx-auto"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                </div>
              ) : (
                (() => {
                  const conflictKpi = kpiData.find(p => p.label === '排考冲突告警');
                  const conflictCount = conflictKpi?.value || 0;
                  
                  return (
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle size={20} className={conflictCount > 0 ? "text-[#C27A63]" : "text-[#6B9B8A]"} />
                        <span className={`font-display text-2xl font-semibold ${conflictCount > 0 ? "text-[#C27A63]" : "text-[#6B9B8A]"}`}>
                          {conflictCount}
                        </span>
                        <span className="text-sm text-[#8C959F] dark:text-[#8B949E]">项冲突</span>
                      </div>
                      {conflictCount > 0 ? (
                        <div className="w-full space-y-2">
                          <div className="flex items-center gap-2 text-xs text-[#8C959F] dark:text-[#8B949E]">
                            <span className="w-2 h-2 rounded-full bg-[#C27A63]"></span>
                            教室冲突: {Math.ceil(conflictCount * 0.67)}项
                        </div>
                          <div className="flex items-center gap-2 text-xs text-[#8C959F] dark:text-[#8B949E]">
                            <span className="w-2 h-2 rounded-full bg-[#C5AC74]"></span>
                            教师冲突: {Math.floor(conflictCount * 0.33)}项
                        </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-[#6B9B8A]">
                          <CheckCircle2 size={14} />
                          暂无冲突
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <button
                key={index}
                onClick={() => navigate(action.path)}
                className="glass-card rounded-3xl p-6 text-left transition-all duration-300 hover:-translate-y-1 group cursor-pointer"
                style={{
                  boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = `0 8px 32px ${action.color}20, 0 4px 16px ${action.color}15`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.04)';
                }}
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-110"
                  style={{ backgroundColor: `${action.color}12` }}
                >
                  <Icon size={22} style={{ color: action.color }} />
                </div>
                <span className="font-display text-base font-medium text-[#1F2328] dark:text-[#E6EDF3] group-hover:text-[#D4A373] transition-colors">
                  {action.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
