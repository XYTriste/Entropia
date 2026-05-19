import { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Clock,
  User,
  Tag,
  ArrowRight,
} from 'lucide-react';
import { auditLogs } from '@/data/mock';

const ITEMS_PER_PAGE = 15;

const operationTypeLabels: Record<string, { label: string; color: string }> = {
  CREATE: { label: '创建', color: '#6B9B8A' },
  UPDATE: { label: '更新', color: '#D4A373' },
  DELETE: { label: '删除', color: '#C27A63' },
  TRANSFER: { label: '调剂', color: '#6395C3' },
  SCHEDULE: { label: '排考', color: '#9C81AF' },
};

export default function AuditLogsView() {
  const [operationType, setOperationType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const filtered = useMemo(() => {
    return auditLogs.filter((log) => {
      const matchesType = !operationType || log.operationType === operationType;
      const matchesDateFrom = !dateFrom || log.time >= dateFrom;
      const matchesDateTo = !dateTo || log.time <= `${dateTo} 23:59:59`;
      const matchesSearch =
        !searchQuery ||
        log.operator.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.entityName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesDateFrom && matchesDateTo && matchesSearch;
    });
  }, [operationType, dateFrom, dateTo, searchQuery]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  const handleReset = () => {
    setOperationType('');
    setDateFrom('');
    setDateTo('');
    setSearchQuery('');
    setCurrentPage(1);
  };

  return (
    <div className="page-container px-4 md:px-6">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <h1 className="font-display text-xl md:text-2xl font-semibold text-[#1F2328] dark:text-[#E6EDF3]">审计日志</h1>
        </div>

        {/* Filters */}
        <div className="glass-card rounded-2xl p-3 md:p-4 mb-4 md:mb-6 flex flex-wrap items-center gap-2 md:gap-3">
          <div className="relative w-[120px] md:w-[140px]">
            <select
              value={operationType}
              onChange={(e) => { setOperationType(e.target.value); setCurrentPage(1); }}
              className="form-input-glass rounded-xl appearance-none w-full pr-10 text-sm"
            >
              <option value="">全部操作</option>
              {Object.entries(operationTypeLabels).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C8CDD3] dark:text-[#484F58] pointer-events-none" />
          </div>

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
            className="form-input-glass rounded-xl w-[120px] md:w-[140px] text-sm"
          />

          <span className="text-xs text-[#C8CDD3] dark:text-[#484F58]">至</span>

          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
            className="form-input-glass rounded-xl w-[120px] md:w-[140px] text-sm"
          />

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            placeholder="搜索..."
            className="form-input-glass rounded-xl flex-1 min-w-[120px] md:w-[200px] text-sm"
          />

          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-[#8C959F] dark:text-[#8B949E] hover:text-[#C27A63] bg-white/60 dark:bg-[#21262D]/80 hover:bg-[#C27A63]/5 rounded-xl transition-all"
          >
            <RotateCcw size={14} />
            重置
          </button>
        </div>

        {/* Table */}
        <div className="glass-card rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F9FAFB] dark:bg-[#21262D]/80">
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#8C959F] dark:text-[#8B949E] w-14">ID</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-[#8C959F] dark:text-[#8B949E]">时间</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-[#8C959F] dark:text-[#8B949E]">操作人</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-[#8C959F] dark:text-[#8B949E]">操作类型</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-[#8C959F] dark:text-[#8B949E]">实体</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-[#8C959F] dark:text-[#8B949E]">变更前</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-[#8C959F] dark:text-[#8B949E]">变更后</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-[#8C959F] dark:text-[#8B949E]">原因</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {paginated.map((log) => {
                  const opType = operationTypeLabels[log.operationType] || { label: log.operationType, color: '#8C959F' };
                  return (
                    <tr key={log.id} className="data-table-row">
                      <td className="px-4 py-3.5 text-[#8C959F] dark:text-[#8B949E] font-mono text-xs">#{log.id}</td>
                      <td className="px-3 py-3.5 text-[#8C959F] dark:text-[#8B949E] text-xs whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Clock size={10} />
                          {log.time}
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-[#1F2328] dark:text-[#E6EDF3]">
                        <div className="flex items-center gap-1.5">
                          <User size={12} className="text-[#8C959F] dark:text-[#8B949E]" />
                          {log.operator}
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <span
                          className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium"
                          style={{
                            backgroundColor: `${opType.color}12`,
                            color: opType.color,
                          }}
                        >
                          {opType.label}
                        </span>
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <Tag size={12} className="text-[#8C959F] dark:text-[#8B949E]" />
                          <span className="text-[#1F2328] dark:text-[#E6EDF3]">{log.entityName}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="text-xs text-[#8C959F] dark:text-[#8B949E] max-w-[120px] truncate block font-mono">
                          {log.beforeValue.length > 30 ? log.beforeValue.slice(0, 30) + '...' : log.beforeValue}
                        </span>
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-1">
                          <ArrowRight size={10} className="text-[#D4A373]" />
                          <span className="text-xs text-[#1F2328] dark:text-[#E6EDF3] max-w-[120px] truncate block font-mono">
                            {log.afterValue.length > 30 ? log.afterValue.slice(0, 30) + '...' : log.afterValue}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-xs text-[#8C959F] dark:text-[#8B949E]">{log.reason}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-[#F3F4F6] dark:border-[#30363D] flex items-center justify-between">
              <span className="text-xs text-[#8C959F] dark:text-[#8B949E]">
                显示 {(currentPage - 1) * ITEMS_PER_PAGE + 1} -{' '}
                {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} / {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8C959F] dark:text-[#8B949E] hover:bg-[#F9FAFB] dark:bg-[#21262D] disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all ${
                      page === currentPage ? 'bg-[#D4A373] text-white' : 'text-[#8C959F] dark:text-[#8B949E] hover:bg-[#F9FAFB] dark:bg-[#21262D]'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8C959F] dark:text-[#8B949E] hover:bg-[#F9FAFB] dark:bg-[#21262D] disabled:opacity-30 transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
