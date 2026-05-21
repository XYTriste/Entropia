import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Users,
  AlertTriangle,
  ChevronDown as ChevronDownIcon,
  X,
  RefreshCw,
  Calendar,
  Clock,
  BookOpen,
  Loader2,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getAdjustmentExams, getAvailableTeachers, changeTeacher } from '@/api/adjustments';
import { getScheduleVersions } from '@/api/exams';
import type { ScheduleVersion } from '@/types';

const ITEMS_PER_PAGE = 12;

export default function AdjustmentsView() {
  // 筛选状态
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'common' | 'major'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedVersion, setSelectedVersion] = useState<number | undefined>(undefined);

  // 选中行
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [showValidation, setShowValidation] = useState(false);

  // 换教师对话框状态
  const [showChangeTeacher, setShowChangeTeacher] = useState<{
    examId: number;
    classroomId: number;
    date: string;
    timeSlot: string;
    slotCode: string;
    timeSlotId: number;
    courseName: string;
    currentTeachers: Array<{ id: number; name: string }>;
  } | null>(null);
  const [selectedNewTeacher, setSelectedNewTeacher] = useState('');
  const [isChangingTeacher, setIsChangingTeacher] = useState(false);

  // 防抖搜索 - 500ms 延迟
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 获取版本列表
  const { data: versions } = useQuery({
    queryKey: ['scheduleVersions'],
    queryFn: getScheduleVersions,
  });

  // 获取考试列表
  const {
    data: examData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: [
      'adjustmentExams',
      {
        version_id: selectedVersion,
        course_type: filterType === 'all' ? undefined : filterType,
        search: debouncedSearch || undefined,
        page: 1,
        page_size: 1000, // 获取全部数据用于前端分页
      },
    ],
    queryFn: () =>
      getAdjustmentExams({
        version_id: selectedVersion,
        course_type: filterType === 'all' ? undefined : filterType,
        search: debouncedSearch || undefined,
        page: 1,
        page_size: 1000,
      }),
  });

  // 获取可用教师列表（当换教师对话框打开时）
  const { data: availableTeachers } = useQuery({
    queryKey: [
      'availableTeachers',
      showChangeTeacher?.timeSlotId,
    ],
    queryFn: () => {
      if (!showChangeTeacher) return Promise.resolve(null);
      const firstTeacherId = showChangeTeacher.currentTeachers[0]?.id;
      return getAvailableTeachers({
        time_slot_id: showChangeTeacher.timeSlotId,
        exclude_teacher_id: firstTeacherId,
      });
    },
    enabled: !!showChangeTeacher,
  });

  // 格式化数据用于显示 - 展开每个教室为单独一条记录
  const formattedExams = useMemo(() => {
    if (!examData?.items) return [];

    const searchLower = debouncedSearch.toLowerCase();
    
    // 将每个考试的 classrooms 展开为多条记录
    const expandedRecords: Array<{
      id: number;
      course_id: number;
      course_name: string;
      course_type: string;
      exam_label: string;
      date: string;
      dateLabel?: string;
      examDate?: string;
      timeSlot: string;
      slotCode: string;
      timeSlotId: number;
      classroomId: number;
      classroomName: string;
      capacity: number;
      studentCount: number;
      classNames: string[];
      fixedTeachers: Array<{ id: number; name: string }>;
      patrolTeachers: string[];
      displayId: string;
    }> = [];

    examData.items.forEach((exam) => {
      // 将每个教室展开为一条记录
      exam.classrooms.forEach((room) => {
        // 按 classroom_id 过滤：只显示分配到该教室的固定监考教师
        const roomFixedTeachers = exam.fixed_teachers
          .filter((t) => t.classroom_id === room.classroom_id)
          .map((t) => ({ id: t.teacher_id, name: t.teacher_name }));

        // 流动监考：分配到该教室的 + 未分配教室的（全局流动）
        const roomPatrolTeachers = exam.patrol_teachers
          .filter((t) => t.classroom_id === null || t.classroom_id === room.classroom_id)
          .map((t) => t.teacher_name);

        // 该教室所属班级
        const roomClassNames = room.classes.map((cls) => cls.class_name);

        // 前端搜索过滤：根据搜索词过滤记录
        if (searchLower) {
          const matchedTeacher = roomFixedTeachers.some(t => 
            t.name.toLowerCase().includes(searchLower)
          );
          const matchedClassName = roomClassNames.some(c => 
            c.toLowerCase().includes(searchLower)
          );
          const matchedCourseName = exam.course_name.toLowerCase().includes(searchLower);
          const matchedClassroomName = room.classroom_name.toLowerCase().includes(searchLower);
          
          // 如果不匹配任何字段，跳过这条记录
          if (!matchedTeacher && !matchedClassName && !matchedCourseName && !matchedClassroomName) {
            return; // 跳过当前教室
          }
        }

        expandedRecords.push({
          id: exam.id,
          course_id: exam.course_id,
          course_name: exam.course_name,
          course_type: exam.course_type,
          exam_label: exam.exam_label,
          // 时段信息
          date: exam.time_slot.day_name || '-',
          dateLabel: exam.time_slot.date_label,
          examDate: exam.time_slot.exam_date,
          timeSlot: exam.time_slot.time_range || '-',
          slotCode: exam.time_slot.slot_code || 'T1',
          timeSlotId: exam.time_slot.id || 0,
          // 教室信息（每条记录对应一个教室）
          classroomId: room.classroom_id,
          classroomName: room.classroom_name,
          capacity: room.capacity,
          studentCount: room.total_students,
          // 班级信息（该教室所属班级）
          classNames: roomClassNames,
          // 教师信息（按教室过滤后的监考教师）
          fixedTeachers: roomFixedTeachers,
          patrolTeachers: roomPatrolTeachers,
          // 用于唯一标识
          displayId: `${exam.id}-${room.classroom_id}`,
        });
      });
    });

    // 按日期和时间排序
    const slotOrder: Record<string, number> = { 'T1': 1, 'T2': 2, 'T3': 3, 'T4': 4 };

    expandedRecords.sort((a, b) => {
      // 先按实际日期排序（ISO 日期字符串可直接比较）
      if (a.examDate && b.examDate) {
        const cmp = a.examDate.localeCompare(b.examDate);
        if (cmp !== 0) return cmp;
      } else if (a.examDate) {
        return -1;
      } else if (b.examDate) {
        return 1;
      }
      // 无 examDate 时回退到按星期名称排序
      const dayOrder: Record<string, number> = { '周一': 1, '周二': 2, '周三': 3, '周四': 4, '周五': 5 };
      const dayA = dayOrder[a.date] || 0;
      const dayB = dayOrder[b.date] || 0;
      if (dayA !== dayB) return dayA - dayB;

      // 再按时段代码排序
      const slotA = slotOrder[a.slotCode] || 0;
      const slotB = slotOrder[b.slotCode] || 0;
      return slotA - slotB;
    });

    return expandedRecords;
  }, [examData, debouncedSearch]);

  // 分页处理
  const totalPages = Math.ceil(formattedExams.length / ITEMS_PER_PAGE);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return formattedExams.slice(start, start + ITEMS_PER_PAGE);
  }, [formattedExams, currentPage]);

  // 搜索处理（防抖由 useEffect 处理）
  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  // 筛选处理
  const handleFilterChange = useCallback((value: 'all' | 'common' | 'major') => {
    setFilterType(value);
    setCurrentPage(1);
  }, []);

  // 版本切换
  const handleVersionChange = useCallback((versionId: number | undefined) => {
    setSelectedVersion(versionId);
    setCurrentPage(1);
  }, []);

  // 行选择
  const handleSelectRow = (id: string) => {
    setSelectedRows((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  // 全选
  const handleSelectAll = () => {
    if (selectedRows.length === paginated.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(paginated.map((e) => e.displayId));
    }
  };

  // 获取课程类型显示
  const getCourseTypeDisplay = (type: string) => {
    return type === 'public' ? '公共课' : '专业课';
  };

  return (
    <div className="page-container px-4 md:px-6">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 md:mb-6 gap-3">
          <h1 className="font-display text-xl md:text-2xl font-semibold text-[#1F2328] dark:text-[#E6EDF3]">
            手动微调
          </h1>
          <div className="flex items-center gap-2 md:gap-3">
            {/* 版本选择 */}
            <div className="relative">
              <select
                value={selectedVersion ?? ''}
                onChange={(e) =>
                  handleVersionChange(e.target.value ? Number(e.target.value) : undefined)
                }
                className="form-input-glass rounded-xl appearance-none w-44 pr-10 text-sm"
              >
                <option value="">已发布版本</option>
                {versions?.map((v: ScheduleVersion) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C8CDD3] dark:text-[#484F58] pointer-events-none"
              />
            </div>

            {/* 搜索 */}
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C8CDD3] dark:text-[#484F58]"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="搜索课程、教师、教室..."
                className="form-input-glass pl-9 pr-4 py-2.5 rounded-xl text-sm w-full sm:w-64"
              />
            </div>

            {/* 类型筛选 */}
            <div className="relative">
              <select
                value={filterType}
                onChange={(e) =>
                  handleFilterChange(e.target.value as 'all' | 'common' | 'major')
                }
                className="form-input-glass rounded-xl appearance-none w-36 pr-10 text-sm"
              >
                <option value="all">全部类型</option>
                <option value="common">公共课</option>
                <option value="major">专业课</option>
              </select>
              <ChevronDown
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C8CDD3] dark:text-[#484F58] pointer-events-none"
              />
            </div>

            {/* 刷新按钮 */}
            <button
              onClick={() => refetch()}
              className="p-2.5 rounded-xl bg-[#6395C3]/10 text-[#6395C3] hover:bg-[#6395C3]/20 transition-colors"
              title="刷新数据"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Validation Summary */}
        {showValidation && (
          <div className="glass-card rounded-2xl p-4 mb-4 flex items-center gap-3 bg-[#C27A63]/5 border border-[#C27A63]/20">
            <AlertTriangle size={18} className="text-[#C27A63] flex-shrink-0" />
            <div className="flex-1">
              <span className="text-sm text-[#C27A63] font-medium">验证摘要: </span>
              <span className="text-sm text-[#8C959F] dark:text-[#8B949E]">
                发现 3 处需要关注的问题，建议检查冲突项后再保存
              </span>
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
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D4A373]"></div>
              </div>
            ) : isError ? (
              <div className="flex items-center justify-center py-12 text-[#C27A63]">
                加载数据失败，请重试
              </div>
            ) : formattedExams.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-[#8C959F] dark:text-[#8B949E]">
                暂无考试安排数据
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F9FAFB] dark:bg-[#21262D]/80">
                    <th className="px-4 py-3 text-left w-10">
                      <input
                        type="checkbox"
                        checked={selectedRows.length === paginated.length && paginated.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-[#C8CDD3] dark:border-[#484F58] text-[#D4A373] focus:ring-[#D4A373]/20"
                      />
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-[#8C959F] dark:text-[#8B949E]">
                      日期
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-[#8C959F] dark:text-[#8B949E]">
                      时段
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-[#8C959F] dark:text-[#8B949E]">
                      课程
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-[#8C959F] dark:text-[#8B949E]">
                      类型
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-[#8C959F] dark:text-[#8B949E]">
                      教室
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-[#8C959F] dark:text-[#8B949E]">
                      容量
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-[#8C959F] dark:text-[#8B949E]">
                      班级
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-[#8C959F] dark:text-[#8B949E]">
                      固定监考
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-[#8C959F] dark:text-[#8B949E]">
                      流动监考
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-[#8C959F] dark:text-[#8B949E]">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {paginated.map((exam) => (
                    <tr key={exam.displayId} className="data-table-row">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedRows.includes(exam.displayId)}
                          onChange={() => handleSelectRow(exam.displayId)}
                          className="rounded border-[#C8CDD3] dark:border-[#484F58] text-[#D4A373] focus:ring-[#D4A373]/20"
                        />
                      </td>
                      <td className="px-3 py-3 text-[#1F2328] dark:text-[#E6EDF3] whitespace-nowrap">
                        {exam.dateLabel ? `${exam.dateLabel} ${exam.date}` : exam.date}
                      </td>
                      <td className="px-3 py-3 text-[#8C959F] dark:text-[#8B949E]">
                        {exam.timeSlot}
                      </td>
                      <td className="px-3 py-3 text-[#1F2328] dark:text-[#E6EDF3] font-medium">
                        {exam.course_name}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            exam.course_type === 'public'
                              ? 'bg-[#6395C3]/10 text-[#6395C3]'
                              : 'bg-[#D4A373]/10 text-[#D4A373]'
                          }`}
                        >
                          {getCourseTypeDisplay(exam.course_type)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[#1F2328] dark:text-[#E6EDF3]">
                        {exam.classroomName}
                      </td>
                      <td className="px-3 py-3 text-[#8C959F] dark:text-[#8B949E]">
                        {exam.studentCount}/{exam.capacity}
                      </td>
                      <td className="px-3 py-3 text-[#8C959F] dark:text-[#8B949E] text-xs max-w-[120px] truncate">
                        {exam.classNames.join(', ')}
                      </td>
                      <td className="px-3 py-3 text-[#8C959F] dark:text-[#8B949E] text-xs">
                        {exam.fixedTeachers.length > 0
                          ? exam.fixedTeachers.map(t => t.name).join(', ')
                          : '-'}
                      </td>
                      <td className="px-3 py-3 text-[#8C959F] dark:text-[#8B949E] text-xs">
                        {exam.patrolTeachers.length > 0
                          ? exam.patrolTeachers.join(', ')
                          : '-'}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() =>
                              setShowChangeTeacher({
                                examId: exam.id,
                                classroomId: exam.classroomId,
                                date: exam.date,
                                timeSlot: exam.timeSlot,
                                slotCode: exam.slotCode,
                                timeSlotId: exam.timeSlotId,
                                courseName: exam.course_name,
                                currentTeachers: exam.fixedTeachers,
                              })
                            }
                            className="px-2.5 py-1 text-[10px] bg-[#6395C3]/10 text-[#6395C3] hover:bg-[#6395C3]/20 rounded-lg transition-colors flex items-center gap-1"
                          >
                            <Users size={10} />
                            换教师
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-[#F3F4F6] dark:border-[#30363D] flex items-center justify-between">
              <span className="text-xs text-[#8C959F] dark:text-[#8B949E]">
                显示 {(currentPage - 1) * ITEMS_PER_PAGE + 1} -{' '}
                {Math.min(currentPage * ITEMS_PER_PAGE, formattedExams.length)} /{' '}
                {formattedExams.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8C959F] dark:text-[#8B949E] hover:bg-[#F9FAFB] dark:bg-[#21262D] disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                {(() => {
                  const pages: (number | string)[] = [];
                  if (totalPages <= 7) {
                    for (let i = 1; i <= totalPages; i++) pages.push(i);
                  } else {
                    pages.push(1);
                    if (currentPage > 3) pages.push('...');
                    const start = Math.max(2, currentPage - 1);
                    const end = Math.min(totalPages - 1, currentPage + 1);
                    for (let i = start; i <= end; i++) pages.push(i);
                    if (currentPage < totalPages - 2) pages.push('...');
                    pages.push(totalPages);
                  }
                  return pages.map((page, idx) =>
                    typeof page === 'string' ? (
                      <span key={`ellipsis-${idx}`} className="px-1 text-sm text-[#8C959F] dark:text-[#8B949E]">
                        {page}
                      </span>
                    ) : (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all ${
                          page === currentPage
                            ? 'bg-[#D4A373] text-white'
                            : 'text-[#8C959F] dark:text-[#8B949E] hover:bg-[#F9FAFB] dark:bg-[#21262D]'
                        }`}
                      >
                        {page}
                      </button>
                    )
                  );
                })()}
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
            onClick={() => {
              setShowChangeTeacher(null);
              setSelectedNewTeacher('');
            }}
          />
          <div className="relative glass-card rounded-3xl p-6 w-[480px] max-w-full animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display text-lg font-medium text-[#1F2328] dark:text-[#E6EDF3]">
                更换监考教师
              </h3>
              <button
                onClick={() => {
                  setShowChangeTeacher(null);
                  setSelectedNewTeacher('');
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F9FAFB] dark:bg-[#21262D]"
              >
                <X size={16} className="text-[#8C959F] dark:text-[#8B949E]" />
              </button>
            </div>

            {/* 当前记录信息 */}
            <div className="space-y-3 mb-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="glass-card rounded-xl p-3 flex items-center gap-2">
                  <Calendar size={14} className="text-[#6395C3] flex-shrink-0" />
                  <div>
                    <div className="text-[10px] text-[#8C959F] dark:text-[#8B949E]">日期</div>
                    <div className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3]">
                      {showChangeTeacher.dateLabel ? `${showChangeTeacher.dateLabel} ${showChangeTeacher.date}` : showChangeTeacher.date}
                    </div>
                  </div>
                </div>
                <div className="glass-card rounded-xl p-3 flex items-center gap-2">
                  <Clock size={14} className="text-[#6395C3] flex-shrink-0" />
                  <div>
                    <div className="text-[10px] text-[#8C959F] dark:text-[#8B949E]">时段</div>
                    <div className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3]">
                      {showChangeTeacher.timeSlot}
                    </div>
                  </div>
                </div>
              </div>
              <div className="glass-card rounded-xl p-3 flex items-center gap-2">
                <BookOpen size={14} className="text-[#6395C3] flex-shrink-0" />
                <div>
                  <div className="text-[10px] text-[#8C959F] dark:text-[#8B949E]">课程</div>
                  <div className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3]">
                    {showChangeTeacher.courseName}
                  </div>
                </div>
              </div>
              <div className="glass-card rounded-xl p-3">
                <div className="text-[10px] text-[#8C959F] dark:text-[#8B949E] mb-1">
                  原监考教师
                </div>
                <div className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3]">
                  {showChangeTeacher.currentTeachers.map(t => t.name).join('、') || '无'}
                </div>
              </div>
            </div>

            {/* 选择新教师 */}
            <div>
              <label className="block text-sm text-[#8C959F] dark:text-[#8B949E] mb-2">
                选择新教师
              </label>
              <div className="relative">
                <select
                  value={selectedNewTeacher}
                  onChange={(e) => setSelectedNewTeacher(e.target.value)}
                  className="form-input-glass rounded-xl appearance-none w-full pr-10 text-sm"
                >
                  <option value="">请选择教师</option>
                  {availableTeachers?.teachers.map((teacher) => (
                    <option
                      key={teacher.id}
                      value={teacher.id}
                      disabled={teacher.has_conflict}
                      className={teacher.has_conflict ? 'bg-red-50 text-red-400' : ''}
                    >
                      {teacher.has_conflict
                        ? `${teacher.name} - 时段冲突，不支持选择该教师`
                        : `${teacher.name} (${teacher.current_slots}/${teacher.max_slots})`
                      }
                    </option>
                  ))}
                </select>
                <ChevronDownIcon
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C8CDD3] dark:text-[#484F58] pointer-events-none"
                />
              </div>
              {availableTeachers?.teachers.some(t => t.has_conflict) && (
                <div className="mt-2 text-xs text-[#C27A63] flex items-center gap-1">
                  <AlertTriangle size={12} />
                  <span>灰色选项表示该时段已有监考任务，无法选择</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowChangeTeacher(null);
                  setSelectedNewTeacher('');
                }}
                disabled={isChangingTeacher}
                className="px-5 py-2.5 text-sm text-[#8C959F] dark:text-[#8B949E] hover:text-[#1F2328] dark:text-[#E6EDF3] bg-white/60 dark:bg-[#21262D]/80 hover:bg-[#F9FAFB] dark:bg-[#21262D] rounded-xl transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  if (!showChangeTeacher || !selectedNewTeacher) return;

                  setIsChangingTeacher(true);
                  try {
                    const oldTeacherId = showChangeTeacher.currentTeachers[0]?.id || 0;
                    await changeTeacher({
                      exam_id: showChangeTeacher.examId,
                      old_teacher_id: oldTeacherId,
                      new_teacher_id: Number(selectedNewTeacher),
                      role: 'fixed',
                      reason: `更换监考教师：从 ${showChangeTeacher.currentTeachers.map(t => t.name).join('、')} 更换为 ${availableTeachers?.teachers.find(t => t.id === Number(selectedNewTeacher))?.name}`,
                    });
                    // 成功后刷新数据
                    refetch();
                    setShowChangeTeacher(null);
                    setSelectedNewTeacher('');
                  } catch (error) {
                    console.error('更换教师失败:', error);
                    alert('更换教师失败，请重试');
                  } finally {
                    setIsChangingTeacher(false);
                  }
                }}
                disabled={!selectedNewTeacher || isChangingTeacher}
                className="btn-amber text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isChangingTeacher ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    保存中...
                  </>
                ) : (
                  '保存'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
