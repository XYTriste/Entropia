import { useState, useEffect, useCallback } from 'react';

export default function Footer() {
  const [time, setTime] = useState(new Date());
  const [isBackendOnline, setIsBackendOnline] = useState(true);  // 后端服务状态

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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

  const formatTime = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${d} ${h}:${min}:${s}`;
  };

  return (
    <footer className="h-8 flex items-center justify-between px-6 text-xs bg-[#334155] dark:bg-[#0D1117] border-t border-transparent dark:border-[#30363D] transition-colors duration-300">
      <span className="font-mono text-white/60">
        {formatTime(time)}
      </span>
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isBackendOnline ? 'bg-green-500' : 'bg-gray-400'}`}
          />
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${isBackendOnline ? 'bg-green-500' : 'bg-gray-400'}`}
          />
        </span>
        <span className={`text-white/50 ${!isBackendOnline ? 'text-gray-400' : ''}`}>
          {isBackendOnline ? '系统连接正常' : '系统连接失败'}
        </span>
      </div>
    </footer>
  );
}
