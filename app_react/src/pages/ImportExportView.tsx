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
  Loader2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  downloadTemplate,
  downloadAllInOneTemplate,
  importExcelData,
  importAllInOne,
  exportExcel,
  exportJson,
  exportSql,
  clearAllData,
  type ImportEntity,
} from '@/api/importExport';

const importTypes: Array<{ key: ImportEntity | 'all-in-one'; label: string }> = [
  { key: 'all-in-one', label: '全量级联导入' },
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
  const [importType, setImportType] = useState<ImportEntity>('teachers');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success_count: number;
    error_count: number;
    errors: string[];
    warnings: string[];
  } | null>(null);
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [exporting, setExporting] = useState<'excel' | 'json' | 'sql' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 拖拽上传
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.xlsx')) {
      setUploadedFile(file);
      setImportResult(null);
    }
  };

  // 文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setImportResult(null);
    }
  };

  // 下载模板
  const handleDownloadTemplate = (type: ImportEntity) => {
    downloadTemplate(type);
  };

  // 下载全量模板
  const handleDownloadAllInOne = () => {
    downloadAllInOneTemplate();
  };

  // 开始导入
  const handleImport = async () => {
    if (!uploadedFile) return;
    setImporting(true);
    try {
      if (importType === 'all-in-one') {
        const result = await importAllInOne(uploadedFile);
        const totalSuccess = result.sheets.reduce((sum, s) => sum + s.success_count, 0);
        const totalErrors = result.sheets.reduce((sum, s) => sum + s.error_count, 0);
        const allErrors = result.sheets.flatMap((s) =>
          s.errors.map((e) => `[${s.label}] ${e}`)
        );
        setImportResult({
          success_count: totalSuccess,
          error_count: totalErrors,
          errors: allErrors,
          warnings: result.sheets.flatMap((s) => s.warnings),
        });
        if (totalErrors === 0) {
          toast.success(`全量导入成功：共 ${totalSuccess} 条数据`);
        } else {
          toast.warning(`导入完成：成功 ${totalSuccess} 条，失败 ${totalErrors} 条`);
        }
      } else {
        const result = await importExcelData(importType, uploadedFile);
        setImportResult(result);
        if (result.error_count === 0) {
          toast.success(`成功导入 ${result.success_count} 条数据`);
        } else {
          toast.warning(`导入完成：成功 ${result.success_count} 条，失败 ${result.error_count} 条`);
        }
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || '导入失败，请重试');
      setImportResult({
        success_count: 0,
        error_count: 1,
        errors: [err?.response?.data?.detail || '未知错误'],
        warnings: [],
      });
    } finally {
      setImporting(false);
    }
  };

  // 清除全部数据
  const handleClearData = async () => {
    setClearing(true);
    try {
      const result = await clearAllData(true, true);
      setShowClearModal(false);
      toast.success('数据已清除', { description: '基础数据已全部清空' });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || '清除失败');
    } finally {
      setClearing(false);
    }
  };

  // 导出 Excel
  const handleExportExcel = async () => {
    setExporting('excel');
    try {
      await exportExcel();
      toast.success('Excel 导出成功');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || '导出失败');
    } finally {
      setExporting(null);
    }
  };

  // 导出 JSON
  const handleExportJson = async () => {
    setExporting('json');
    try {
      await exportJson();
      toast.success('JSON 导出成功');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || '导出失败');
    } finally {
      setExporting(null);
    }
  };

  // 导出 SQL
  const handleExportSql = async () => {
    setExporting('sql');
    try {
      await exportSql();
      toast.success('SQL 导出成功');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || '导出失败');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="page-container px-4 md:px-6">
      {/* 清除确认弹窗 */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="glass-card rounded-2xl p-6 w-[420px] space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#C27A63]/10 flex items-center justify-center">
                <AlertCircle size={20} className="text-[#C27A63]" />
              </div>
              <h3 className="text-base font-medium text-[#1F2328] dark:text-[#E6EDF3]">
                确认清除全部数据
              </h3>
            </div>
            <p className="text-sm text-[#8C959F] dark:text-[#8B949E]">
              此操作将清空所有基础数据（教师、教室、课程、班级、学生、专业、课程-班级关联），
              <strong className="text-[#C27A63]">不可逆</strong>，操作日志将保留。
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowClearModal(false)}
                className="flex-1 btn-secondary text-sm"
              >
                取消
              </button>
              <button
                onClick={handleClearData}
                disabled={clearing}
                className="flex-1 btn-red text-sm flex items-center justify-center gap-2"
              >
                {clearing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                确认清除
              </button>
            </div>
          </div>
        </div>
      )}

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

              {/* 下拉选择 */}
              <div className="relative mb-4">
                <select
                  value={importType}
                  onChange={(e) => setImportType(e.target.value as ImportEntity)}
                  className="form-input-glass rounded-xl appearance-none w-full pr-10 text-sm"
                >
                  {importTypes.map((t) => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C8CDD3] dark:text-[#484F58] pointer-events-none" />
              </div>

              {/* 模板按钮 */}
              <div className="grid grid-cols-3 gap-2">
                {importTypes.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => handleDownloadTemplate(t.key)}
                    className={`px-3 py-2 rounded-xl text-xs transition-all ${
                      importType === t.key
                        ? 'bg-[#D4A373]/10 text-[#D4A373]'
                        : 'bg-white/60 dark:bg-[#21262D]/80 text-[#8C959F] dark:text-[#8B949E] hover:bg-[#F9FAFB] dark:hover:bg-[#21262D]'
                    }`}
                  >
                    {t.label}模板
                  </button>
                ))}
                <button
                  onClick={handleDownloadAllInOne}
                  className="px-3 py-2 rounded-xl text-xs bg-white/60 dark:bg-[#21262D]/80 text-[#8C959F] dark:text-[#8B949E] hover:bg-[#F9FAFB] dark:hover:bg-[#21262D] transition-all"
                >
                  全量模板
                </button>
                <button
                  onClick={() => setShowClearModal(true)}
                  className="px-3 py-2 rounded-xl text-xs bg-[#C27A63]/5 text-[#C27A63] hover:bg-[#C27A63]/10 transition-all"
                >
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
                    <X size={14} />
                  </button>
                </div>
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="w-full btn-amber flex items-center justify-center gap-2 text-sm"
                >
                  {importing ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      导入中...
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      开始导入
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Import Result */}
            {importResult && (
              <div className="space-y-2">
                {importResult.error_count === 0 ? (
                  <div className="flex items-center gap-2 p-3 bg-[#6B9B8A]/10 text-[#6B9B8A] rounded-xl text-sm">
                    <CheckCircle2 size={16} />
                    成功导入 {importResult.success_count} 条数据
                  </div>
                ) : (
                  <div className="space-y-2">
                    {importResult.success_count > 0 && (
                      <div className="flex items-center gap-2 p-3 bg-[#6B9B8A]/10 text-[#6B9B8A] rounded-xl text-sm">
                        <CheckCircle2 size={16} />
                        成功导入 {importResult.success_count} 条
                      </div>
                    )}
                    <div className="flex items-center gap-2 p-3 bg-[#C27A63]/10 text-[#C27A63] rounded-xl text-sm">
                      <AlertCircle size={16} />
                      导入失败 {importResult.error_count} 条
                    </div>
                    {importResult.errors.length > 0 && (
                      <div className="bg-[#F9FAFB] dark:bg-[#21262D] rounded-xl p-3 text-xs text-[#8C959F] dark:text-[#8B949E] max-h-32 overflow-y-auto">
                        {importResult.errors.map((err, i) => (
                          <div key={i} className="mb-1">• {err}</div>
                        ))}
                      </div>
                    )}
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
            <button
              onClick={handleExportExcel}
              disabled={exporting !== null}
              className="w-full glass-card rounded-2xl p-5 flex items-center gap-4 text-left hover:-translate-y-0.5 transition-all group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-12 h-12 rounded-xl bg-[#6B9B8A]/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                {exporting === 'excel' ? (
                  <Loader2 size={22} className="text-[#6B9B8A] animate-spin" />
                ) : (
                  <FileSpreadsheet size={22} className="text-[#6B9B8A]" />
                )}
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
            <button
              onClick={handleExportJson}
              disabled={exporting !== null}
              className="w-full glass-card rounded-2xl p-5 flex items-center gap-4 text-left hover:-translate-y-0.5 transition-all group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-12 h-12 rounded-xl bg-[#6395C3]/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                {exporting === 'json' ? (
                  <Loader2 size={22} className="text-[#6395C3] animate-spin" />
                ) : (
                  <FileJson size={22} className="text-[#6395C3]" />
                )}
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
            <button
              onClick={handleExportSql}
              disabled={exporting !== null}
              className="w-full glass-card rounded-2xl p-5 flex items-center gap-4 text-left hover:-translate-y-0.5 transition-all group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-12 h-12 rounded-xl bg-[#9C81AF]/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                {exporting === 'sql' ? (
                  <Loader2 size={22} className="text-[#9C81AF] animate-spin" />
                ) : (
                  <FileCode size={22} className="text-[#9C81AF]" />
                )}
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
