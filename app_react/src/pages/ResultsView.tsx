import { useState, useCallback } from 'react';
import {
  BarChart3,
  Users,
  Gauge,
  Building2,
  Route,
  GraduationCap,
  BookOpen,
  ChevronDown,
  RefreshCw,
  Download,
  ChevronRight,
  Clock,
  X,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import RollingNumber from '@/components/RollingNumber';
import { getExamOverviewMatrix, getPatrolMatrix, getTeacherGanttData, getClassroomMatrix, getBatchClassSchedule, getCourseExams } from '@/api/results';
import { getCourses } from '@/api/courses';
import { scheduleVersions, examSchedules, teachers, classrooms, classesData, courses, daysOfWeek, slotCodes, slotLabels } from '@/data/mock';
import type { ResultPanelType } from '@/types';

const navItems: { key: ResultPanelType; label: string; icon: typeof BarChart3 }[] = [
  { key: 'overview', label: '总览矩阵', icon: BarChart3 },
  { key: 'teachers', label: '监考教师', icon: Users },
  { key: 'teacher-load', label: '教师负荷', icon: Gauge },
  { key: 'classrooms', label: '教室使用', icon: Building2 },
  { key: 'patrol', label: '流动监考', icon: Route },
  { key: 'classes', label: '班级安排', icon: GraduationCap },
  { key: 'courses', label: '课程详情', icon: BookOpen },
];

const patrolColors: Record<string, string> = {
  'A组': '#D4A373',
  'B组': '#6B9B8A',
  'C组': '#8C959F',
};

export default function ResultsView() {
  const [currentPanel, setCurrentPanel] = useState<ResultPanelType>('overview');
  const [activeVersion, setActiveVersion] = useState(scheduleVersions[0]);
  const [searchQuery] = useState('');
  const [expandedTeacher, setExpandedTeacher] = useState<number | null>(null);
  const [expandedCourse, setExpandedCourse] = useState<number | null>(null);
  const [overviewModal, setOverviewModal] = useState<{ date: string; slot: string } | null>(null);

  // 获取总览矩阵数据（用于 OverviewCellModal）
  const { data: overviewData } = useQuery({
    queryKey: ['examOverviewMatrix'],
    queryFn: getExamOverviewMatrix,
  });

  const version = activeVersion;

  const renderPanel = () => {
    switch (currentPanel) {
      case 'overview':
        return <OverviewPanel searchQuery={searchQuery} matrixData={overviewData} onCellClick={(date, slot) => setOverviewModal({ date, slot })} />;
      case 'teachers':
        return <TeacherPanel searchQuery={searchQuery} expandedTeacher={expandedTeacher} setExpandedTeacher={setExpandedTeacher} />;
      case 'teacher-load':
        return <TeacherLoadPanel searchQuery={searchQuery} />;
      case 'classrooms':
        return <ClassroomPanel searchQuery={searchQuery} />;
      case 'patrol':
        return <PatrolPanel />;
      case 'classes':
        return <ClassPanel searchQuery={searchQuery} />;
      case 'courses':
        return <CoursePanel searchQuery={searchQuery} expandedCourse={expandedCourse} setExpandedCourse={setExpandedCourse} />;
      default:
        return <OverviewPanel searchQuery={searchQuery} />;
    }
  };

  return (
    <div className="page-container px-4 md:px-6">
      <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row gap-4 md:gap-5" style={{ minHeight: 'calc(100vh - 140px)' }}>
        {/* Left Sidebar */}
        <nav className="hidden md:block w-[260px] flex-shrink-0">
          <div className="glass-card rounded-3xl p-4 sticky top-24">
            <div className="px-3 py-2 mb-3">
              <h2 className="font-display text-base font-medium text-[#1F2328] dark:text-[#E6EDF3]">排考结果</h2>
            </div>

            {/* Version Select */}
            <div className="mb-4 relative">
              <select
                value={activeVersion.id}
                onChange={(e) => {
                  const v = scheduleVersions.find((sv) => sv.id === Number(e.target.value));
                  if (v) setActiveVersion(v);
                }}
                className="form-input-glass rounded-xl appearance-none w-full pr-10 text-sm"
              >
                {scheduleVersions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} {v.isActive ? '(当前)' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C8CDD3] dark:text-[#484F58] pointer-events-none" />
            </div>

            <div className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPanel === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => setCurrentPanel(item.key)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 group ${
                      isActive
                        ? 'bg-[#D4A373]/10 text-[#D4A373]'
                        : 'text-[#8C959F] dark:text-[#8B949E] hover:bg-white/50 dark:bg-[#21262D]/70 hover:text-[#1F2328] dark:text-[#E6EDF3]'
                    }`}
                  >
                    <Icon size={16} className={isActive ? 'text-[#D4A373]' : 'group-hover:text-[#D4A373] transition-colors'} />
                    <span>{item.label}</span>
                    {isActive && <ChevronRight size={14} className="ml-auto" />}
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Main View */}
        <div className="flex-1 min-w-0">
          {renderPanel()}
        </div>

        {/* Overview Cell Click Modal */}
        {overviewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
              onClick={() => setOverviewModal(null)}
            />
            <div className="relative glass-card rounded-3xl p-6 w-[720px] max-w-full max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
              <OverviewCellModal
                date={overviewModal.date}
                slot={overviewModal.slot}
                matrixData={overviewData}
                onClose={() => setOverviewModal(null)}
              />
            </div>
          </div>
        )}

        {/* Right Stats Panel */}
        <aside className="hidden md:block w-[280px] flex-shrink-0">
          <div className="glass-card rounded-3xl p-5 sticky top-24">
            <h3 className="font-display text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3] mb-4">
              数据统计
            </h3>
            <div className="space-y-3">
              {[
                { label: '版本', value: version.name, highlight: true },
                { label: '考试总数', value: version.examCount, highlight: true },
                { label: '监考教师', value: version.teacherCount },
                { label: '使用教室', value: version.roomCount },
                { label: '涉及班级', value: version.classCount },
                { label: '涉及课程', value: version.courseCount },
                { label: '流动监考', value: version.patrolCount },
              ].map((stat, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-xl ${
                    stat.highlight ? 'bg-[#D4A373]/5' : 'bg-white/40 dark:bg-[#161B22]/60'
                  }`}
                >
                  <div className="text-xs text-[#8C959F] dark:text-[#8B949E] mb-1">{stat.label}</div>
                  <div className={`font-display font-semibold ${
                    typeof stat.value === 'number' ? 'text-xl text-[#1F2328] dark:text-[#E6EDF3]' : 'text-sm text-[#D4A373]'
                  }`}>
                    {typeof stat.value === 'number' ? (
                      <RollingNumber target={stat.value} />
                    ) : (
                      stat.value
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 space-y-2">
              <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white/60 dark:bg-[#21262D]/80 hover:bg-[#D4A373]/10 text-[#8C959F] dark:text-[#8B949E] hover:text-[#D4A373] rounded-xl text-sm transition-all">
                <RefreshCw size={14} />
                刷新数据
              </button>
              <button className="w-full btn-amber text-sm flex items-center justify-center gap-2">
                <Download size={14} />
                导出结果
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function OverviewCellModal({ date, slot, matrixData, onClose }: { date: string; slot: string; matrixData?: any; onClose: () => void }) {
  const matrix = matrixData?.matrix || {};
  const slotExams = matrix[date]?.[slot] || [];
  // 收集流动监考教师
  const patrolTeachers = Array.from(new Set(
    slotExams.flatMap((e: any) =>
      (e.teachers || []).filter((t: any) => t.role === 'patrol').map((t: any) => t.teacher_name)
    )
  ));

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-display text-lg font-medium text-[#1F2328] dark:text-[#E6EDF3]">
            {date} {slot} ({slotLabels[slot]})
          </h3>
          <p className="text-xs text-[#8C959F] dark:text-[#8B949E] mt-1">
            共 {slotExams.length} 场考试
            {patrolTeachers.length > 0 && ` | 流动监考: ${patrolTeachers.join('、')}`}
          </p>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F9FAFB] dark:hover:bg-[#21262D]">
          <X size={16} className="text-[#8C959F]" />
        </button>
      </div>

      <div className="glass-card rounded-2xl p-4">
        {slotExams.length === 0 ? (
          <p className="text-sm text-[#C8CDD3] dark:text-[#484F58] py-4 text-center">该时段暂无考试安排。</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#F9FAFB]/80 dark:bg-[#21262D]/80">
                <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">课程</th>
                <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">类型</th>
                <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">教室</th>
                <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">涉考班级</th>
                <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">人数</th>
                <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">监考教师</th>
                <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">AB卷</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6] dark:divide-[#30363D]">
              {slotExams.map((e: any, i: number) => {
                const classrooms = e.classrooms || [];
                const classroomName = classrooms.map((c: any) => c.classroom_name).join(', ');
                const classNames = classrooms.flatMap((c: any) => c.classes?.map((cls: any) => cls.class_name) || []);
                const fixedTeachers = (e.teachers || []).filter((t: any) => t.role === 'fixed').map((t: any) => t.teacher_name);
                return (
                  <tr key={i} className="data-table-row">
                    <td className="px-2 py-2 text-[#1F2328] dark:text-[#E6EDF3] font-medium">{e.course_name}</td>
                    <td className="px-2 py-2">
                      <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] ${e.course_type === '公共课' ? 'bg-[#6395C3]/10 text-[#6395C3]' : 'bg-[#D4A373]/10 text-[#D4A373]'}`}>{e.course_type}</span>
                    </td>
                    <td className="px-2 py-2 text-[#8C959F] dark:text-[#8B949E]">{classroomName}</td>
                    <td className="px-2 py-2 text-[#8C959F] dark:text-[#8B949E] max-w-[120px] truncate">{classNames.join(', ')}</td>
                    <td className="px-2 py-2 text-[#1F2328] dark:text-[#E6EDF3]">{e.total_students}</td>
                    <td className="px-2 py-2 text-[#8C959F] dark:text-[#8B949E]">{fixedTeachers.join(', ')}</td>
                    <td className="px-2 py-2 text-[#8C959F] dark:text-[#8B949E]">{e.exam_label || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

/* ==================== Sub Panels ==================== */

function OverviewPanel({ searchQuery: _searchQuery, matrixData, onCellClick }: { searchQuery: string; matrixData?: any; onCellClick?: (date: string, slot: string) => void }) {
  const matrix = matrixData?.matrix || {};
  const dates = Object.keys(matrix).sort();
  const slots = ['T1', 'T2', 'T3', 'T4'];

  // 计算统计数据
  let totalExams = 0;
  const allClassrooms = new Set<string>();
  const allTeachers = new Set<string>();
  let totalStudents = 0;

  dates.forEach(day => {
    slots.forEach(slot => {
      const exams = matrix[day]?.[slot] || [];
      totalExams += exams.length;
      exams.forEach(exam => {
        exam.classrooms?.forEach(c => allClassrooms.add(c.classroom_name));
        exam.teachers?.forEach(t => allTeachers.add(t.teacher_name));
        totalStudents += exam.total_students || 0;
      });
    });
  });

  return (
    <div className="glass-card rounded-3xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-display text-lg font-medium text-[#1F2328] dark:text-[#E6EDF3]">排考总览</h3>
        <div className="flex gap-4 text-xs text-[#8C959F] dark:text-[#8B949E]">
          <span>共 {totalExams} 场考试</span>
          <span>{dates.length} 天</span>
        </div>
      </div>

      {/* Matrix Table - swapped rows and columns */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#F9FAFB] dark:bg-[#21262D]/80">
              <th className="px-4 py-3 text-left text-xs font-medium text-[#8C959F] dark:text-[#8B949E]">时段 \ 日期</th>
              {dates.slice(0, 10).map((date) => (
                <th key={date} className="px-3 py-3 text-center text-xs font-medium text-[#8C959F] dark:text-[#8B949E] whitespace-nowrap">
                  {date.slice(2)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F3F4F6]">
            {slots.map((slot) => (
              <tr key={slot} className="data-table-row">
                <td className="px-4 py-3 font-medium text-[#1F2328] dark:text-[#E6EDF3] whitespace-nowrap">
                  {slot}
                  <div className="text-[10px] text-[#C8CDD3] dark:text-[#484F58] font-normal">{slotLabels[slot]}</div>
                </td>
                {dates.slice(0, 10).map((date) => {
                  const exams = matrix[date]?.[slot] || [];
                  return (
                    <td key={date} className="px-3 py-3 text-center">
                      {exams.length > 0 ? (
                        <button
                          onClick={() => onCellClick?.(date, slot)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[#6B9B8A]/10 text-[#6B9B8A] hover:bg-[#6B9B8A]/20 transition-colors cursor-pointer"
                        >
                          {exams.length} 场
                        </button>
                      ) : (
                        <span className="text-[#C8CDD3] dark:text-[#484F58]">-</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mt-6">
        {[
          { label: '总考试场次', value: totalExams, icon: BookOpen },
          { label: '使用教室', value: allClassrooms.size, icon: Building2 },
          { label: '参与教师', value: allTeachers.size, icon: Users },
          { label: '考生总人次', value: totalStudents, icon: GraduationCap },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="glass-card rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#D4A373]/10 flex items-center justify-center">
                <Icon size={18} className="text-[#D4A373]" />
              </div>
              <div>
                <div className="font-display text-xl font-semibold text-[#1F2328] dark:text-[#E6EDF3]">
                  <RollingNumber target={s.value} />
                </div>
                <div className="text-xs text-[#8C959F] dark:text-[#8B949E]">{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TeacherPanel({
  searchQuery,
  expandedTeacher,
  setExpandedTeacher,
}: {
  searchQuery: string;
  expandedTeacher: number | null;
  setExpandedTeacher: (id: number | null) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['teacherGanttData'],
    queryFn: getTeacherGanttData,
  });

  if (isLoading) {
    return <div className="glass-card rounded-3xl p-6 text-center text-[#8C959F]">加载中...</div>;
  }

  const teacherList = data?.teachers || [];
  const filtered = teacherList.filter((t) =>
    t.teacher_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="glass-card rounded-3xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-display text-lg font-medium text-[#1F2328] dark:text-[#E6EDF3]">监考教师安排</h3>
        <span className="text-xs text-[#8C959F] dark:text-[#8B949E] bg-[#F9FAFB] dark:bg-[#21262D] px-3 py-1 rounded-full">
          {filtered.length} 位教师
        </span>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
        {filtered.map((teacher) => {
          const isExpanded = expandedTeacher === teacher.teacher_id;
          const teacherExams = teacher.events || [];

          return (
            <>
              <div
                key={teacher.teacher_id}
                className={`glass-card rounded-2xl p-4 cursor-pointer transition-all hover:shadow-lg ${
                  isExpanded ? 'ring-2 ring-[#D4A373]/20' : ''
                }`}
                onClick={() => setExpandedTeacher(isExpanded ? null : teacher.teacher_id)}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium text-white"
                    style={{ backgroundColor: '#D4A373' }}
                  >
                    {teacher.teacher_name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3] truncate">{teacher.teacher_name}</div>
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#D4A373]/10 text-[#D4A373]">
                      监考
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-lg font-semibold text-[#1F2328] dark:text-[#E6EDF3]">
                      {teacherExams.length}
                    </div>
                    <div className="text-[10px] text-[#8C959F] dark:text-[#8B949E]">监考场次</div>
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="col-span-full glass-card rounded-2xl p-5 space-y-3">
                  <div className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3] mb-3">
                    {teacher.teacher_name} 的考试安排
                    <span className="ml-2 text-xs text-[#8C959F] dark:text-[#8B949E]">({teacherExams.length} 场)</span>
                  </div>
                  <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                    {teacherExams.slice(0, 6).map((exam, i) => (
                      <div key={i} className="text-xs bg-[#F9FAFB] dark:bg-[#21262D] rounded-xl p-3 space-y-1.5">
                        <div className="flex justify-between">
                          <span className="text-[#1F2328] dark:text-[#E6EDF3] font-medium">{exam.day_name} {exam.slot_code}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                            exam.role === 'fixed'
                              ? 'bg-[#D4A373]/10 text-[#D4A373]'
                              : 'bg-[#6395C3]/10 text-[#6395C3]'
                          }`}>
                            {exam.role === 'fixed' ? '固定' : '流动'}
                          </span>
                        </div>
                        <div className="text-[#1F2328] dark:text-[#E6EDF3]">{exam.course_name}</div>
                        <div className="flex gap-2 text-[#8C959F] dark:text-[#8B949E]">
                          <span>{exam.time_range}</span>
                          <span>{exam.exam_label || ''}</span>
                        </div>
                        <div className="text-[#C8CDD3] dark:text-[#484F58] pt-1 border-t border-[#F3F4F6] dark:border-[#30363D]">
                          班级: {exam.class_names?.join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          );
        })}
      </div>
    </div>
  );
}

function TeacherLoadPanel({ searchQuery }: { searchQuery: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['teacherGanttData'],
    queryFn: getTeacherGanttData,
  });

  if (isLoading) {
    return <div className="glass-card rounded-3xl p-6 text-center text-[#8C959F]">加载中...</div>;
  }

  const teacherList = data?.teachers || [];
  // 计算教师负荷率
  const filtered = teacherList
    .filter((t) => t.teacher_name.toLowerCase().includes(searchQuery.toLowerCase()))
    .map((t) => {
      const examCount = t.events?.length || 0;
      // 假设 max_slots 为 5（默认值），实际应从教师列表 API 获取
      const maxSlots = 5;
      return { ...t, examCount, loadRate: maxSlots > 0 ? (examCount / maxSlots) * 100 : 0 };
    })
    .sort((a, b) => b.loadRate - a.loadRate);

  return (
    <div className="glass-card rounded-3xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-display text-lg font-medium text-[#1F2328] dark:text-[#E6EDF3]">教师负荷分布</h3>
      </div>

      <div className="space-y-3">
        {filtered.map((t) => (
          <div key={t.teacher_id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-[#F9FAFB] dark:bg-[#21262D] transition-colors">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white flex-shrink-0"
              style={{ backgroundColor: '#D4A373' }}
            >
              {t.teacher_name[0]}
            </div>
            <div className="w-24 flex-shrink-0">
              <div className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3]">{t.teacher_name}</div>
              <div className="text-[10px] text-[#8C959F] dark:text-[#8B949E]">监考</div>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-[#8C959F] dark:text-[#8B949E]">{t.examCount} / 5 场</span>
                <span className={`text-xs font-medium ${
                  t.loadRate > 90 ? 'text-[#C27A63]' : t.loadRate > 70 ? 'text-[#C5AC74]' : 'text-[#6B9B8A]'
                }`}>{t.loadRate.toFixed(0)}%</span>
              </div>
              <div className="h-2 bg-[#F3F4F6] dark:bg-[#30363D] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(t.loadRate, 100)}%`,
                    backgroundColor: t.loadRate > 90 ? '#C27A63' : t.loadRate > 70 ? '#C5AC74' : '#6B9B8A',
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClassroomPanel({ searchQuery }: { searchQuery: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['classroomMatrix'],
    queryFn: getClassroomMatrix,
  });

  if (isLoading) {
    return <div className="glass-card rounded-3xl p-6 text-center text-[#8C959F]">加载中...</div>;
  }

  const matrix = data?.matrix || {};
  const roomNames = Object.keys(matrix).sort();
  const filtered = roomNames.filter((name) => name.toLowerCase().includes(searchQuery.toLowerCase()));
  const slots = ['T1', 'T2', 'T3', 'T4'];

  return (
    <div className="glass-card rounded-3xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-display text-lg font-medium text-[#1F2328] dark:text-[#E6EDF3]">教室使用情况</h3>
        <span className="text-xs text-[#8C959F] dark:text-[#8B949E] bg-[#F9FAFB] dark:bg-[#21262D] px-3 py-1 rounded-full">
          {filtered.length} 间教室
        </span>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
        {filtered.map((roomName) => {
          const roomData = matrix[roomName] || {};
          const roomExams = Object.values(roomData).flat();
          return (
            <div key={roomName} className="glass-card rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Building2 size={16} className="text-[#D4A373]" />
                  <span className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3]">{roomName}</span>
                </div>
                <span className="status-badge-info text-[10px]">{roomExams.length} 场</span>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {slots.map((slot) => {
                  // 匹配任何包含此 slot 的键（如 "周一-T1"）
                  const slotExams = Object.entries(roomData)
                    .filter(([key]) => key.includes(`-${slot}`))
                    .flatMap(([, exams]) => exams);
                  return (
                    <div key={slot} className="bg-[#F9FAFB] dark:bg-[#21262D] rounded-lg p-2 text-center">
                      <div className="text-[10px] text-[#C8CDD3] dark:text-[#484F58] mb-1">{slot}</div>
                      {slotExams.length > 0 ? (
                        <div className="space-y-1">
                          {slotExams.slice(0, 1).map((e: any, i: number) => (
                            <div key={i} className="text-[10px]">
                              <div className="text-[#1F2328] dark:text-[#E6EDF3] truncate">{e.course_name}</div>
                              <div className="text-[#C8CDD3] dark:text-[#484F58] truncate">{e.exam_label || '-'}</div>
                              <div className="text-[#8C959F] dark:text-[#8B949E]">{e.total_students}人</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[10px] text-[#C8CDD3] dark:text-[#484F58]">空闲</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PatrolPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['patrolMatrix'],
    queryFn: getPatrolMatrix,
  });

  if (isLoading) {
    return <div className="glass-card rounded-3xl p-6 text-center text-[#8C959F]">加载中...</div>;
  }

  const matrix = data?.matrix || {};
  const groupColors = data?.group_colors || {};
  const days = ['周一', '周二', '周三', '周四', '周五'];
  const slots = ['T1', 'T2', 'T3', 'T4'];

  // 计算总人次
  let totalCount = 0;
  days.forEach(day => {
    slots.forEach(slot => {
      const assignments = matrix[day]?.[slot] || [];
      totalCount += assignments.length;
    });
  });

  return (
    <div className="glass-card rounded-3xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-display text-lg font-medium text-[#1F2328] dark:text-[#E6EDF3]">流动监考安排</h3>
        <span className="text-xs text-[#8C959F] dark:text-[#8B949E] bg-[#F9FAFB] dark:bg-[#21262D] px-3 py-1 rounded-full">
          {totalCount} 人次
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#F9FAFB] dark:bg-[#21262D]/80">
              <th className="px-4 py-3 text-left text-xs font-medium text-[#8C959F] dark:text-[#8B949E]">时段</th>
              {days.map((d) => (
                <th key={d} className="px-3 py-3 text-center text-xs font-medium text-[#8C959F] dark:text-[#8B949E]">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F3F4F6]">
            {slots.map((slot) => (
              <tr key={slot} className="data-table-row">
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3]">{slot}</div>
                  <div className="text-[10px] text-[#C8CDD3] dark:text-[#484F58]">{slotLabels[slot]}</div>
                </td>
                {days.map((day) => {
                  const assignments = matrix[day]?.[slot] || [];
                  return (
                    <td key={day} className="px-3 py-3 text-center">
                      {assignments.length > 0 ? (
                        <span className="flex flex-col items-center gap-1">
                          {assignments.map((t: any, ti: number) => (
                            <span
                              key={ti}
                              className="inline-flex px-2 py-1 rounded-lg text-[10px]"
                              style={{
                                backgroundColor: `${groupColors[t.patrol_group_name] || '#6B9B8A'}20`,
                                color: groupColors[t.patrol_group_name] || '#6B9B8A',
                              }}
                            >
                              {t.teacher_name}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="text-[#C8CDD3] dark:text-[#484F58]">-</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Group Legend */}
      <div className="mt-6 flex items-center gap-4">
        <span className="text-xs text-[#8C959F] dark:text-[#8B949E]">分组说明:</span>
        {Object.entries(groupColors).map(([name, color]) => (
          <div key={name} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs text-[#8C959F] dark:text-[#8B949E]">{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClassPanel({ searchQuery }: { searchQuery: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['batchClassSchedule'],
    queryFn: getBatchClassSchedule,
  });

  if (isLoading) {
    return <div className="glass-card rounded-3xl p-6 text-center text-[#8C959F]">加载中...</div>;
  }

  const classList = data?.classes || [];
  const filtered = classList.filter((c) =>
    c.class_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="glass-card rounded-3xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-display text-lg font-medium text-[#1F2328] dark:text-[#E6EDF3]">班级考试安排</h3>
        <span className="text-xs text-[#8C959F] dark:text-[#8B949E] bg-[#F9FAFB] dark:bg-[#21262D] px-3 py-1 rounded-full">
          {filtered.length} 个班级
        </span>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        {filtered.map((cls) => {
          return (
            <div key={cls.class_id} className="glass-card rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <GraduationCap size={16} className="text-[#D4A373]" />
                  <span className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3]">{cls.class_name}</span>
                </div>
                <span className="status-badge-info text-[10px]">{cls.exam_count} 场</span>
              </div>
              <div className="space-y-2">
                {cls.exams.slice(0, 3).map((exam, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs bg-[#F9FAFB] dark:bg-[#21262D] rounded-lg p-2">
                    <Clock size={12} className="text-[#8C959F] dark:text-[#8B949E] flex-shrink-0" />
                    <span className="text-[#8C959F] dark:text-[#8B949E]">{exam.day_name} {exam.slot_code}</span>
                    <span className="text-[#1F2328] dark:text-[#E6EDF3] font-medium truncate">{exam.course_name}</span>
                    <span className="text-[#C8CDD3] dark:text-[#484F58]">{exam.classroom_name}</span>
                    <span className="text-[#8C959F] dark:text-[#8B949E] ml-auto">-</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CoursePanel({
  searchQuery,
  expandedCourse,
  setExpandedCourse,
}: {
  searchQuery: string;
  expandedCourse: number | null;
  setExpandedCourse: (id: number | null) => void;
}) {
  const { data: coursesData, isLoading } = useQuery({
    queryKey: ['courses'],
    queryFn: getCourses,
  });

  // 获取展开课程的详情
  const { data: courseDetailData } = useQuery({
    queryKey: ['courseDetail', expandedCourse],
    queryFn: () => getCourseExams(expandedCourse!),
    enabled: !!expandedCourse,
  });

  if (isLoading) {
    return <div className="glass-card rounded-3xl p-6 text-center text-[#8C959F]">加载中...</div>;
  }

  const courseList = coursesData?.items || [];
  const filtered = courseList.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="glass-card rounded-3xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-display text-lg font-medium text-[#1F2328] dark:text-[#E6EDF3]">课程考试详情</h3>
        <span className="text-xs text-[#8C959F] dark:text-[#8B949E] bg-[#F9FAFB] dark:bg-[#21262D] px-3 py-1 rounded-full">
          {filtered.length} 门课程
        </span>
      </div>

      <div className="space-y-3">
        {filtered.map((course) => {
          const isExpanded = expandedCourse === course.id;

          return (
            <div
              key={course.id}
              className="glass-card rounded-2xl overflow-hidden cursor-pointer transition-all"
              onClick={() => setExpandedCourse(isExpanded ? null : course.id)}
            >
              <div className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3]">{course.name}</span>
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        course.course_type === '公共课'
                          ? 'bg-[#6395C3]/10 text-[#6395C3]'
                          : 'bg-[#D4A373]/10 text-[#D4A373]'
                      }`}
                    >
                      {course.course_type}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-[#8C959F] dark:text-[#8B949E]">
                  <span>{course.student_count} 学生</span>
                  <span className="status-badge-info text-[10px]">{course.exam_count || 0} 场考试</span>
                  <ChevronRight
                    size={14}
                    className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  />
                </div>
              </div>

              {isExpanded && courseDetailData && (
                <div className="px-4 pb-4 border-t border-[#F3F4F6] dark:border-[#30363D]">
                  <div className="mt-3 space-y-2">
                    {courseDetailData.exams?.map((exam: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 text-xs bg-[#F9FAFB] dark:bg-[#21262D] rounded-xl p-3">
                        <Clock size={12} className="text-[#8C959F] dark:text-[#8B949E]" />
                        <span className="text-[#8C959F] dark:text-[#8B949E]">{exam.day_name}</span>
                        <span className="text-[#8C959F] dark:text-[#8B949E]">{exam.slot_code}</span>
                        <span className="text-[#D4A373] font-medium">{exam.exam_label || '-'}</span>
                        <span className="text-[#1F2328] dark:text-[#E6EDF3] font-medium">
                          {exam.classrooms?.map((c: any) => c.classroom_name).join(', ')}
                        </span>
                        <span className="text-[#8C959F] dark:text-[#8B949E]">
                          {exam.classrooms?.reduce((sum: number, c: any) => sum + c.total_students, 0)}人
                        </span>
                      </div>
                    ))}
                    {courseDetailData.ab_analysis && (
                      <div className="mt-3 p-3 bg-[#F9FAFB] dark:bg-[#21262D] rounded-xl text-xs">
                        <div className="text-[#8C959F] dark:text-[#8B949E] mb-2">AB卷分析</div>
                        <div className="flex gap-4">
                          <span>A卷: {courseDetailData.ab_analysis.a_student_count}人</span>
                          <span>B卷: {courseDetailData.ab_analysis.b_student_count}人</span>
                          <span className={courseDetailData.ab_analysis.balance === '均衡' ? 'text-green-600' : 'text-red-600'}>
                            {courseDetailData.ab_analysis.balance}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
