import { useState, useRef } from 'react';
import {
  Upload,
  Download,
  FileSpreadsheet,
  FileJson,
  FileCode,
  Trash2,
  ChevronDown,
  FileCheck,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

const importTypes = [
  { key: 'teachers', label: '教师' },
  { key: 'classrooms', label: '教室' },
  { key: 'courses', label: '课程' },
  { key: 'classes', label: '班级' },
  { key: 'students', label: '学生' },
  { key: 'majors', label: '专业' },
  { key: 'course-classes', label: '课程-班级' },
  { key: 'time-slots', label: '时段' },
];

export default function ImportExportView() {
  const [importType, setImportType] = useState('teachers');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{ success: number; errors: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.xlsx')) {
      setUploadedFile(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
    }
  };

  const handleImport = () => {
    setImportResult({ success: 48, errors: 0 });
  };

  return (
    <div className="page-container px-4 md:px-6">
      <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Left: Import */}
        <div className="glass-card rounded-3xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#F3F4F6] dark:border-[#30363D] flex items-center gap-2">
            <Upload size={18} className="text-[#D4A373]" />
            <h2 className="font-display text-base font-medium text-[#1F2328] dark:text-[#E6EDF3]">Excel 批量导入</h2>
          </div>

          <div className="p-6 space-y-6">
            {/* Step 1: Select Type & Templates */}
            <div>
              <div className="text-sm text-[#8C959F] dark:text-[#8B949E] mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#D4A373]/10 text-[#D4A373] text-xs flex items-center justify-center font-medium">1</span>
                选择要导入的数据类型并下载模板
              </div>

              <div className="relative mb-4">
                <select
                  value={importType}
                  onChange={(e) => setImportType(e.target.value)}
                  className="form-input-glass rounded-xl appearance-none w-full pr-10 text-sm"
                >
                  {importTypes.map((t) => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C8CDD3] dark:text-[#484F58] pointer-events-none" />
              </div>

              <div className="grid grid-cols-3 gap-2">
                {importTypes.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setImportType(t.key)}
                    className={`px-3 py-2 rounded-xl text-xs transition-all ${
                      importType === t.key
                        ? 'bg-[#D4A373]/10 text-[#D4A373]'
                        : 'bg-white/60 dark:bg-[#21262D]/80 text-[#8C959F] dark:text-[#8B949E] hover:bg-[#F9FAFB] dark:bg-[#21262D]'
                    }`}
                  >
                    {t.label}模板
                  </button>
                ))}
                <button className="px-3 py-2 rounded-xl text-xs bg-white/60 dark:bg-[#21262D]/80 text-[#8C959F] dark:text-[#8B949E] hover:bg-[#F9FAFB] dark:bg-[#21262D] transition-all">
                  全量模板
                </button>
                <button className="px-3 py-2 rounded-xl text-xs bg-[#C27A63]/5 text-[#C27A63] hover:bg-[#C27A63]/10 transition-all">
                  清除全部数据
                </button>
              </div>
            </div>

            {/* Step 2: Upload */}
            <div>
              <div className="text-sm text-[#8C959F] dark:text-[#8B949E] mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#D4A373]/10 text-[#D4A373] text-xs flex items-center justify-center font-medium">2</span>
                填写数据后上传 Excel 文件
              </div>

              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#E5E7EB] dark:border-[#30363D] hover:border-[#D4A373] rounded-2xl p-8 text-center cursor-pointer transition-all hover:bg-[#D4A373]/5"
              >
                <Upload size={32} className="mx-auto mb-3 text-[#C8CDD3] dark:text-[#484F58]" />
                <p className="text-sm text-[#8C959F] dark:text-[#8B949E] mb-1">点击上传或拖拽文件到此处</p>
                <p className="text-xs text-[#C8CDD3] dark:text-[#484F58]">支持 .xlsx 格式</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            </div>

            {/* File Preview */}
            {uploadedFile && (
              <div className="bg-[#F9FAFB] dark:bg-[#21262D] rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet size={20} className="text-[#6B9B8A]" />
                    <div>
                      <div className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3]">{uploadedFile.name}</div>
                      <div className="text-xs text-[#8C959F] dark:text-[#8B949E]">{(uploadedFile.size / 1024).toFixed(1)} KB</div>
                    </div>
                  </div>
                  <button
                    onClick={() => { setUploadedFile(null); setImportResult(null); }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#C27A63]/10 text-[#C8CDD3] dark:text-[#484F58] hover:text-[#C27A63] transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <button
                  onClick={handleImport}
                  className="w-full btn-amber flex items-center justify-center gap-2 text-sm"
                >
                  <Upload size={14} />
                  开始导入
                </button>
              </div>
            )}

            {/* Import Result */}
            {importResult && (
              <div className="space-y-2">
                {importResult.errors === 0 ? (
                  <div className="flex items-center gap-2 p-3 bg-[#6B9B8A]/10 text-[#6B9B8A] rounded-xl text-sm">
                    <CheckCircle2 size={16} />
                    成功导入 {importResult.success} 条数据
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-3 bg-[#6B9B8A]/10 text-[#6B9B8A] rounded-xl text-sm">
                      <CheckCircle2 size={16} />
                      成功导入 {importResult.success} 条
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-[#C27A63]/10 text-[#C27A63] rounded-xl text-sm">
                      <AlertCircle size={16} />
                      导入失败 {importResult.errors} 条
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Export */}
        <div className="glass-card rounded-3xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#F3F4F6] dark:border-[#30363D] flex items-center gap-2">
            <Download size={18} className="text-[#6B9B8A]" />
            <h2 className="font-display text-base font-medium text-[#1F2328] dark:text-[#E6EDF3]">数据导出</h2>
          </div>

          <div className="p-6 space-y-4">
            {/* Excel Export */}
            <button className="w-full glass-card rounded-2xl p-5 flex items-center gap-4 text-left hover:-translate-y-0.5 transition-all group cursor-pointer">
              <div className="w-12 h-12 rounded-xl bg-[#6B9B8A]/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                <FileSpreadsheet size={22} className="text-[#6B9B8A]" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3] group-hover:text-[#6B9B8A] transition-colors">
                  Excel 导出
                </div>
                <div className="text-xs text-[#8C959F] dark:text-[#8B949E]">
                  导出排考结果为Excel文件，含多个工作表
                </div>
              </div>
              <Download size={18} className="text-[#C8CDD3] dark:text-[#484F58] group-hover:text-[#6B9B8A] transition-colors" />
            </button>

            {/* JSON Export */}
            <button className="w-full glass-card rounded-2xl p-5 flex items-center gap-4 text-left hover:-translate-y-0.5 transition-all group cursor-pointer">
              <div className="w-12 h-12 rounded-xl bg-[#6395C3]/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                <FileJson size={22} className="text-[#6395C3]" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3] group-hover:text-[#6395C3] transition-colors">
                  JSON 导出
                </div>
                <div className="text-xs text-[#8C959F] dark:text-[#8B949E]">
                  导出完整的排考数据为JSON格式
                </div>
              </div>
              <Download size={18} className="text-[#C8CDD3] dark:text-[#484F58] group-hover:text-[#6395C3] transition-colors" />
            </button>

            {/* SQL Export */}
            <button className="w-full glass-card rounded-2xl p-5 flex items-center gap-4 text-left hover:-translate-y-0.5 transition-all group cursor-pointer">
              <div className="w-12 h-12 rounded-xl bg-[#9C81AF]/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                <FileCode size={22} className="text-[#9C81AF]" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3] group-hover:text-[#9C81AF] transition-colors">
                  SQL 导出
                </div>
                <div className="text-xs text-[#8C959F] dark:text-[#8B949E]">
                  导出排考数据为SQL INSERT语句
                </div>
              </div>
              <Download size={18} className="text-[#C8CDD3] dark:text-[#484F58] group-hover:text-[#9C81AF] transition-colors" />
            </button>

            {/* Worksheet badges */}
            <div className="pt-4 border-t border-[#F3F4F6] dark:border-[#30363D]">
              <p className="text-xs text-[#8C959F] dark:text-[#8B949E] mb-3">Excel 工作表说明</p>
              <div className="flex flex-wrap gap-2">
                {['排考总览', '教师安排', '教室安排', '班级安排', '课程详情', '约束报告'].map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs bg-[#F9FAFB] dark:bg-[#21262D] text-[#8C959F] dark:text-[#8B949E]"
                  >
                    <FileCheck size={10} className="text-[#6B9B8A]" />
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
