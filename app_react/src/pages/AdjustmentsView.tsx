import { useState, useMemo } from 'react';
import {
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Users,
  AlertTriangle,
  ChevronDown as ChevronDownIcon,
  X,
} from 'lucide-react';
import { examSchedules, teachers } from '@/data/mock';

const ITEMS_PER_PAGE = 12;

export default function AdjustmentsView() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [showValidation, setShowValidation] = useState(false);
  const [showChangeTeacher, setShowChangeTeacher] = useState<{ examId: number; currentTeachers: string[] } | null>(null);
  const [selectedNewTeacher, setSelectedNewTeacher] = useState('');

  const filtered = useMemo(() => {
    return examSchedules.filter((e) => {
      const matchesSearch =
        !searchQuery ||
        e.courseName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.classroomName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.fixedTeachers.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesType = filterType === 'all' || e.courseType === filterType;
      return matchesSearch && matchesType;
    });
  }, [searchQuery, filterType]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  const handleSelectRow = (id: string) => {
    setSelectedRows((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  return (
    <div className="page-container px-4 md:px-6">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 md:mb-6 gap-3">
          <h1 className="font-display text-xl md:text-2xl font-semibold text-[#1F2328] dark:text-[#E6EDF3]">手动微调</h1>
          <div className="flex items-center gap-2 md:gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C8CDD3] dark:text-[#484F58]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder="搜索课程、教师、教室..."
                className="form-input-glass pl-9 pr-4 py-2.5 rounded-xl text-sm w-full sm:w-64"
              />
            </div>
            <div className="relative">
              <select
                value={filterType}
                onChange={(e) => { setFilterType(e.target.value); setCurrentPage(1); }}
                className="form-input-glass rounded-xl appearance-none w-36 pr-10 text-sm"
              >
                <option value="all">全部类型</option>
                <option value="公共课">公共课</option>
                <option value="专业课">专业课</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C8CDD3] dark:text-[#484F58] pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Validation Summary */}
        {showValidation && (
          <div className="glass-card rounded-2xl p-4 mb-4 flex items-center gap-3 bg-[#C27A63]/5 border border-[#C27A63]/20">
            <AlertTriangle size={18} className="text-[#C27A63] flex-shrink-0" />
            <div className="flex-1">
              <span className="text-sm text-[#C27A63] font-medium">验证摘要: </span>
              <span className="text-sm text-[#8C959F] dark:text-[#8B949E]">发现 3 处需要关注的问题，建议检查冲突项后再保存</span>
            </div>
            <button
              onClick={() => setShowValidation(false)}
              className="text-xs text-[#C8CDD3] dark:text-[#484F58] hover:text-[#8C959F] dark:text-[#8B949E] transition-colors"
            >
              忽略
            </button>
          </div>
        )}

        {/* Table */}
        <div className="glass-card rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F9FAFB] dark:bg-[#21262D]/80">
                  <th className="px-4 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      className="rounded border-[#C8CDD3] dark:border-[#484F58] text-[#D4A373] focus:ring-[#D4A373]/20"
                    />
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-[#8C959F] dark:text-[#8B949E]">日期</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-[#8C959F] dark:text-[#8B949E]">时段</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-[#8C959F] dark:text-[#8B949E]">课程</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-[#8C959F] dark:text-[#8B949E]">类型</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-[#8C959F] dark:text-[#8B949E]">教室</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-[#8C959F] dark:text-[#8B949E]">容量</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-[#8C959F] dark:text-[#8B949E]">班级</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-[#8C959F] dark:text-[#8B949E]">固定监考</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-[#8C959F] dark:text-[#8B949E]">流动监考</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-[#8C959F] dark:text-[#8B949E]">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {paginated.map((exam) => {
                  const rowId = `${exam.id}-${exam.classroomId}`;
                  return (
                    <tr key={rowId} className="data-table-row">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedRows.includes(rowId)}
                          onChange={() => handleSelectRow(rowId)}
                          className="rounded border-[#C8CDD3] dark:border-[#484F58] text-[#D4A373] focus:ring-[#D4A373]/20"
                        />
                      </td>
                      <td className="px-3 py-3 text-[#1F2328] dark:text-[#E6EDF3] whitespace-nowrap">{exam.date}</td>
                      <td className="px-3 py-3 text-[#8C959F] dark:text-[#8B949E]">{exam.timeSlot}</td>
                      <td className="px-3 py-3 text-[#1F2328] dark:text-[#E6EDF3] font-medium">{exam.courseName}</td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            exam.courseType === '公共课'
                              ? 'bg-[#6395C3]/10 text-[#6395C3]'
                              : 'bg-[#D4A373]/10 text-[#D4A373]'
                          }`}
                        >
                          {exam.courseType}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[#1F2328] dark:text-[#E6EDF3]">{exam.classroomName}</td>
                      <td className="px-3 py-3 text-[#8C959F] dark:text-[#8B949E]">
                        {exam.studentCount}/{exam.capacity}
                      </td>
                      <td className="px-3 py-3 text-[#8C959F] dark:text-[#8B949E] text-xs max-w-[120px] truncate">
                        {exam.classNames.join(', ')}
                      </td>
                      <td className="px-3 py-3 text-[#8C959F] dark:text-[#8B949E] text-xs">
                        {exam.fixedTeachers.join(', ')}
                      </td>
                      <td className="px-3 py-3 text-[#8C959F] dark:text-[#8B949E] text-xs">
                        {exam.patrolTeachers.join(', ')}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setShowChangeTeacher({ examId: exam.id, currentTeachers: exam.fixedTeachers })}
                            className="px-2.5 py-1 text-[10px] bg-[#6395C3]/10 text-[#6395C3] hover:bg-[#6395C3]/20 rounded-lg transition-colors flex items-center gap-1"
                          >
                            <Users size={10} />
                            换教师
                          </button>
                        </div>
                      </td>
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

      {/* Change Teacher Modal */}
      {showChangeTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => { setShowChangeTeacher(null); setSelectedNewTeacher(''); }}
          />
          <div className="relative glass-card rounded-3xl p-6 w-[420px] max-w-full animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display text-lg font-medium text-[#1F2328] dark:text-[#E6EDF3]">更换监考教师</h3>
              <button
                onClick={() => { setShowChangeTeacher(null); setSelectedNewTeacher(''); }}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F9FAFB] dark:bg-[#21262D]"
              >
                <X size={16} className="text-[#8C959F] dark:text-[#8B949E]" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="glass-card rounded-xl p-4">
                <div className="text-xs text-[#8C959F] dark:text-[#8B949E] mb-1">原监考教师</div>
                <div className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3]">
                  {showChangeTeacher.currentTeachers.join('、') || '无'}
                </div>
              </div>

              <div>
                <label className="block text-sm text-[#8C959F] dark:text-[#8B949E] mb-2">选择新教师</label>
                <div className="relative">
                  <select
                    value={selectedNewTeacher}
                    onChange={(e) => setSelectedNewTeacher(e.target.value)}
                    className="form-input-glass rounded-xl appearance-none w-full pr-10 text-sm"
                  >
                    <option value="">请选择教师</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.name}>{t.name} ({t.type})</option>
                    ))}
                  </select>
                  <ChevronDownIcon size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C8CDD3] dark:text-[#484F58] pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowChangeTeacher(null); setSelectedNewTeacher(''); }}
                className="px-5 py-2.5 text-sm text-[#8C959F] dark:text-[#8B949E] hover:text-[#1F2328] dark:text-[#E6EDF3] bg-white/60 dark:bg-[#21262D]/80 hover:bg-[#F9FAFB] dark:bg-[#21262D] rounded-xl transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => { setShowChangeTeacher(null); setSelectedNewTeacher(''); }}
                className="btn-amber text-sm"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
