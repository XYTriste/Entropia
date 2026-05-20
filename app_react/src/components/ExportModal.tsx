import { useState } from 'react';
import { X, Download, FileSpreadsheet, FileJson, FileCode } from 'lucide-react';

export type ExportFormat = 'excel' | 'json' | 'sql';

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  versionId: number | null;
  versionNo: string;
  versionStatus: string | null;
  onExport: (format: ExportFormat, versionId: number | null) => void;
}

const formatOptions: { value: ExportFormat; label: string; desc: string; icon: typeof FileSpreadsheet }[] = [
  {
    value: 'excel',
    label: 'Excel',
    desc: '多 Sheet 表格，适合打印和存档',
    icon: FileSpreadsheet,
  },
  {
    value: 'json',
    label: 'JSON',
    desc: '结构化数据，适合程序处理',
    icon: FileJson,
  },
  {
    value: 'sql',
    label: 'SQL',
    desc: 'INSERT 语句，可导入其他数据库',
    icon: FileCode,
  },
];

export default function ExportModal({
  open,
  onClose,
  versionId,
  versionNo,
  versionStatus,
  onExport,
}: ExportModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('excel');
  const [exportAll, setExportAll] = useState(!versionId);

  if (!open) return null;

  const handleExport = () => {
    const targetVersionId = exportAll ? null : versionId;
    onExport(selectedFormat, targetVersionId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white dark:bg-[#161B22] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F3F4F6] dark:border-[#30363D]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#D4A373]/10 flex items-center justify-center">
              <Download size={20} className="text-[#D4A373]" />
            </div>
            <div>
              <h3 className="font-display text-lg font-medium text-[#1F2328] dark:text-[#E6EDF3]">
                导出排考结果
              </h3>
              <p className="text-xs text-[#8C959F] dark:text-[#8B949E]">
                选择导出版本和格式
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F9FAFB] dark:hover:bg-[#21262D] transition-colors"
          >
            <X size={16} className="text-[#8C959F]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Version Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3]">
              选择版本
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 rounded-xl border border-[#F3F4F6] dark:border-[#30363D] cursor-pointer hover:border-[#D4A373]/50 transition-colors">
                <input
                  type="radio"
                  name="version"
                  checked={exportAll}
                  onChange={() => setExportAll(true)}
                  className="w-4 h-4 text-[#D4A373] focus:ring-[#D4A373] focus:ring-offset-0"
                />
                <div>
                  <div className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3]">
                    导出全部已排考数据
                  </div>
                  <div className="text-xs text-[#8C959F] dark:text-[#8B949E]">
                    导出所有已发布的考试记录
                  </div>
                </div>
              </label>

              {versionId && (
                <label className="flex items-center gap-3 p-3 rounded-xl border border-[#F3F4F6] dark:border-[#30363D] cursor-pointer hover:border-[#D4A373]/50 transition-colors">
                  <input
                    type="radio"
                    name="version"
                    checked={!exportAll}
                    onChange={() => setExportAll(false)}
                    className="w-4 h-4 text-[#D4A373] focus:ring-[#D4A373] focus:ring-offset-0"
                  />
                  <div>
                    <div className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3]">
                      导出版本：{versionNo}
                    </div>
                    <div className="text-xs text-[#8C959F] dark:text-[#8B949E]">
                      状态：{versionStatus === 'published' ? '已发布' : versionStatus}
                    </div>
                  </div>
                </label>
              )}
            </div>
          </div>

          {/* Format Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3]">
              选择格式
            </label>
            <div className="grid grid-cols-3 gap-2">
              {formatOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = selectedFormat === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => setSelectedFormat(option.value)}
                    className={`p-3 rounded-xl border transition-all text-left ${
                      isSelected
                        ? 'border-[#D4A373] bg-[#D4A373]/10'
                        : 'border-[#F3F4F6] dark:border-[#30363D] hover:border-[#D4A373]/50'
                    }`}
                  >
                    <Icon
                      size={20}
                      className={`mb-2 ${
                        isSelected ? 'text-[#D4A373]' : 'text-[#8C959F]'
                      }`}
                    />
                    <div
                      className={`text-sm font-medium ${
                        isSelected
                          ? 'text-[#1F2328] dark:text-[#E6EDF3]'
                          : 'text-[#1F2328] dark:text-[#E6EDF3]'
                      }`}
                    >
                      {option.label}
                    </div>
                    <div className="text-[10px] text-[#8C959F] dark:text-[#8B949E] leading-tight mt-0.5">
                      {option.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#F3F4F6] dark:border-[#30363D] bg-[#F9FAFB] dark:bg-[#0D1117]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[#8C959F] hover:text-[#1F2328] dark:text-[#8B949E] dark:hover:text-[#E6EDF3] transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-5 py-2 bg-[#D4A373] hover:bg-[#C4956A] text-white rounded-xl text-sm font-medium transition-colors"
          >
            <Download size={16} />
            导出
          </button>
        </div>
      </div>
    </div>
  );
}
