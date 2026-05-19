import { useState } from 'react';
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
} from 'lucide-react';
import RollingNumber from '@/components/RollingNumber';
import { scheduleVersions, examSchedules, teachers, classrooms, classesData, courses, patrolAssignments, daysOfWeek, slotCodes, slotLabels } from '@/data/mock';
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

  const version = activeVersion;

  const renderPanel = () => {
    switch (currentPanel) {
      case 'overview':
        return <OverviewPanel searchQuery={searchQuery} />;
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

/* ==================== Sub Panels ==================== */

function OverviewPanel({ searchQuery: _searchQuery }: { searchQuery: string }) {
  const dates = Array.from(new Set(examSchedules.map((e) => e.date))).sort();

  return (
    <div className="glass-card rounded-3xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-display text-lg font-medium text-[#1F2328] dark:text-[#E6EDF3]">排考总览</h3>
        <div className="flex gap-4 text-xs text-[#8C959F] dark:text-[#8B949E]">
          <span>共 {examSchedules.length} 场考试</span>
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
                  {date.slice(5)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F3F4F6]">
            {slotCodes.map((slot) => (
              <tr key={slot} className="data-table-row">
                <td className="px-4 py-3 font-medium text-[#1F2328] dark:text-[#E6EDF3] whitespace-nowrap">
                  {slot}
                  <div className="text-[10px] text-[#C8CDD3] dark:text-[#484F58] font-normal">{slotLabels[slot]}</div>
                </td>
                {dates.slice(0, 10).map((date) => {
                  const exams = examSchedules.filter(
                    (e) => e.date === date && e.timeSlot === slot
                  );
                  return (
                    <td key={date} className="px-3 py-3 text-center">
                      {exams.length > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[#6B9B8A]/10 text-[#6B9B8A]">
                          {exams.length} 场
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

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mt-6">
        {[
          { label: '总考试场次', value: examSchedules.length, icon: BookOpen },
          { label: '使用教室', value: new Set(examSchedules.map((e) => e.classroomId)).size, icon: Building2 },
          { label: '参与教师', value: teachers.length, icon: Users },
          { label: '考生总人次', value: examSchedules.reduce((s, e) => s + e.studentCount, 0), icon: GraduationCap },
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
  const filtered = teachers.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
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
          const isExpanded = expandedTeacher === teacher.id;
          const teacherExams = examSchedules.filter(
            (e) => e.fixedTeachers.includes(teacher.name) || e.patrolTeachers.includes(teacher.name)
          );

          return (
            <>
              <div
                key={teacher.id}
                className={`glass-card rounded-2xl p-4 cursor-pointer transition-all hover:shadow-lg ${
                  isExpanded ? 'ring-2 ring-[#D4A373]/20' : ''
                }`}
                onClick={() => setExpandedTeacher(isExpanded ? null : teacher.id)}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium text-white"
                    style={{
                      backgroundColor: teacher.type === '专任' ? '#D4A373' : '#8C959F',
                    }}
                  >
                    {teacher.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3] truncate">{teacher.name}</div>
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        teacher.type === '专任'
                          ? 'bg-[#D4A373]/10 text-[#D4A373]'
                          : 'bg-[#8C959F]/10 text-[#8C959F] dark:text-[#8B949E]'
                      }`}
                    >
                      {teacher.type}
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
                    {teacher.name} 的考试安排
                    <span className="ml-2 text-xs text-[#8C959F] dark:text-[#8B949E]">({teacherExams.length} 场)</span>
                  </div>
                  <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                    {teacherExams.slice(0, 6).map((exam, i) => (
                      <div key={i} className="text-xs bg-[#F9FAFB] dark:bg-[#21262D] rounded-xl p-3 space-y-1.5">
                        <div className="flex justify-between">
                          <span className="text-[#1F2328] dark:text-[#E6EDF3] font-medium">{exam.date} {exam.timeSlot}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                            exam.fixedTeachers.includes(teacher.name)
                              ? 'bg-[#D4A373]/10 text-[#D4A373]'
                              : 'bg-[#6395C3]/10 text-[#6395C3]'
                          }`}>
                            {exam.fixedTeachers.includes(teacher.name) ? '固定' : '流动'}
                          </span>
                        </div>
                        <div className="text-[#1F2328] dark:text-[#E6EDF3]">{exam.courseName}</div>
                        <div className="flex gap-2 text-[#8C959F] dark:text-[#8B949E]">
                          <span>{exam.classroomName}</span>
                          <span>{exam.examPaper}</span>
                        </div>
                        <div className="text-[#C8CDD3] dark:text-[#484F58] pt-1 border-t border-[#F3F4F6] dark:border-[#30363D]">
                          班级: {exam.classNames.join(', ')}
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
  const filtered = teachers
    .filter((t) => t.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .map((t) => {
      const examCount = examSchedules.filter(
        (e) => e.fixedTeachers.includes(t.name) || e.patrolTeachers.includes(t.name)
      ).length;
      return { ...t, examCount, loadRate: (examCount / t.maxDuties) * 100 };
    })
    .sort((a, b) => b.loadRate - a.loadRate);

  return (
    <div className="glass-card rounded-3xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-display text-lg font-medium text-[#1F2328] dark:text-[#E6EDF3]">教师负荷分布</h3>
      </div>

      <div className="space-y-3">
        {filtered.map((t) => (
          <div key={t.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-[#F9FAFB] dark:bg-[#21262D] transition-colors">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white flex-shrink-0"
              style={{ backgroundColor: t.type === '专任' ? '#D4A373' : '#8C959F' }}
            >
              {t.name[0]}
            </div>
            <div className="w-24 flex-shrink-0">
              <div className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3]">{t.name}</div>
              <div className="text-[10px] text-[#8C959F] dark:text-[#8B949E]">{t.type}</div>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-[#8C959F] dark:text-[#8B949E]">{t.examCount} / {t.maxDuties} 场</span>
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
  const filtered = classrooms.filter((r) =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="glass-card rounded-3xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-display text-lg font-medium text-[#1F2328] dark:text-[#E6EDF3]">教室使用情况</h3>
        <span className="text-xs text-[#8C959F] dark:text-[#8B949E] bg-[#F9FAFB] dark:bg-[#21262D] px-3 py-1 rounded-full">
          {filtered.length} 间教室
        </span>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
        {filtered.map((room) => {
          const roomExams = examSchedules.filter((e) => e.classroomId === room.id);
          return (
            <div key={room.id} className="glass-card rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Building2 size={16} className="text-[#D4A373]" />
                  <span className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3]">{room.name}</span>
                </div>
                <span className="status-badge-info text-[10px]">{roomExams.length} 场</span>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {slotCodes.map((slot) => {
                  const slotExams = roomExams.filter((e) => e.timeSlot === slot);
                  return (
                    <div key={slot} className="bg-[#F9FAFB] dark:bg-[#21262D] rounded-lg p-2 text-center">
                      <div className="text-[10px] text-[#C8CDD3] dark:text-[#484F58] mb-1">{slot}</div>
                      {slotExams.length > 0 ? (
                        <div className="space-y-1">
                          {slotExams.slice(0, 1).map((e, i) => (
                            <div key={i} className="text-[10px]">
                              <div className="text-[#1F2328] dark:text-[#E6EDF3] truncate">{e.courseName}</div>
                              <div className="text-[#8C959F] dark:text-[#8B949E]">{e.studentCount}人</div>
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
  return (
    <div className="glass-card rounded-3xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-display text-lg font-medium text-[#1F2328] dark:text-[#E6EDF3]">流动监考安排</h3>
        <span className="text-xs text-[#8C959F] dark:text-[#8B949E] bg-[#F9FAFB] dark:bg-[#21262D] px-3 py-1 rounded-full">
          {patrolAssignments.length} 人次
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#F9FAFB] dark:bg-[#21262D]/80">
              <th className="px-4 py-3 text-left text-xs font-medium text-[#8C959F] dark:text-[#8B949E]">时段</th>
              {daysOfWeek.map((d) => (
                <th key={d} className="px-3 py-3 text-center text-xs font-medium text-[#8C959F] dark:text-[#8B949E]">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F3F4F6]">
            {slotCodes.map((slot) => (
              <tr key={slot} className="data-table-row">
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3]">{slot}</div>
                  <div className="text-[10px] text-[#C8CDD3] dark:text-[#484F58]">{slotLabels[slot]}</div>
                </td>
                {daysOfWeek.map((day) => {
                  const assignment = patrolAssignments.find(
                    (p) => p.day === day && p.slot === slot
                  );
                  return (
                    <td key={day} className="px-3 py-3 text-center">
                      {assignment ? (
                        <span
                          className="inline-flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-xs"
                          style={{
                            backgroundColor: `${patrolColors[assignment.groupName]}12`,
                            color: patrolColors[assignment.groupName],
                          }}
                        >
                          <span className="font-medium">{assignment.groupName}</span>
                          <span className="text-[10px] opacity-70">
                            {assignment.teachers.join(', ')}
                          </span>
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
        {Object.entries(patrolColors).map(([name, color]) => (
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
  const filtered = classesData.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
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
          const clsExams = examSchedules.filter((e) =>
            e.classNames.some((cn) => cn.includes(cls.name.split('级')[1]?.split('班')[0] ? cls.name.split('班')[0] : cls.name))
          );
          return (
            <div key={cls.id} className="glass-card rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <GraduationCap size={16} className="text-[#D4A373]" />
                  <span className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3]">{cls.name}</span>
                </div>
                <span className="status-badge-info text-[10px]">{clsExams.length} 场</span>
              </div>
              <div className="space-y-2">
                {clsExams.slice(0, 3).map((exam, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs bg-[#F9FAFB] dark:bg-[#21262D] rounded-lg p-2">
                    <Clock size={12} className="text-[#8C959F] dark:text-[#8B949E] flex-shrink-0" />
                    <span className="text-[#8C959F] dark:text-[#8B949E]">{exam.date} {exam.timeSlot}</span>
                    <span className="text-[#1F2328] dark:text-[#E6EDF3] font-medium truncate">{exam.courseName}</span>
                    <span className="text-[#C8CDD3] dark:text-[#484F58] ml-auto">{exam.classroomName}</span>
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
  const filtered = courses.filter((c) =>
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
          const courseExams = examSchedules.filter((e) => e.courseId === course.id);

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
                        course.type === '公共课'
                          ? 'bg-[#6395C3]/10 text-[#6395C3]'
                          : 'bg-[#D4A373]/10 text-[#D4A373]'
                      }`}
                    >
                      {course.type}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-[#8C959F] dark:text-[#8B949E]">
                  <span>{course.studentCount} 学生</span>
                  <span className="status-badge-info text-[10px]">{courseExams.length} 场考试</span>
                  <ChevronRight
                    size={14}
                    className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  />
                </div>
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-[#F3F4F6] dark:border-[#30363D]">
                  <div className="mt-3 space-y-2">
                    {courseExams.map((exam, i) => (
                      <div key={i} className="flex items-center gap-3 text-xs bg-[#F9FAFB] dark:bg-[#21262D] rounded-xl p-3">
                        <Clock size={12} className="text-[#8C959F] dark:text-[#8B949E]" />
                        <span className="text-[#8C959F] dark:text-[#8B949E]">{exam.date}</span>
                        <span className="text-[#8C959F] dark:text-[#8B949E]">{exam.timeSlot}</span>
                        <span className="text-[#D4A373] font-medium">{exam.classNames[0] || '-'}</span>
                        <span className="text-[#1F2328] dark:text-[#E6EDF3] font-medium">{exam.classroomName}</span>
                        <span className="text-[#8C959F] dark:text-[#8B949E]">{exam.studentCount}人</span>
                        <span className="text-[#C8CDD3] dark:text-[#484F58] ml-auto">
                          {exam.fixedTeachers.join(', ')}
                        </span>
                      </div>
                    ))}
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
