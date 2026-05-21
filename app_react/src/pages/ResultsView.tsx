import { useState, useCallback, useMemo, useEffect } from 'react';
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
  ChevronsUpDown,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import RollingNumber from '@/components/RollingNumber';
import ExportModal, { type ExportFormat } from '@/components/ExportModal';
import { getExamOverviewMatrix, getPatrolMatrix, getTeacherGanttData, getClassroomMatrix, getBatchClassSchedule, getCourseExams, getScheduleVersions } from '@/api/results';
import { getCourses } from '@/api/courses';
import { deleteScheduleVersion, applyVersion } from '@/api/scheduler';
import apiClient from '@/api/client';
import { examSchedules, teachers, classrooms, classesData, courses, daysOfWeek, slotCodes, slotLabels } from '@/data/mock';
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
  const [activeVersionId, setActiveVersionId] = useState<number | null>(null);
  const [searchQuery] = useState('');
  const [expandedTeacher, setExpandedTeacher] = useState<number | null>(null);
  const [expandedCourses, setExpandedCourses] = useState<Set<number>>(new Set());
  const [expandedClassrooms, setExpandedClassrooms] = useState<Set<string>>(new Set());
  const [expandedClass, setExpandedClass] = useState<number | null>(null);
  const [overviewModal, setOverviewModal] = useState<{ date: string; slot: string } | null>(null);
  const [showAllVersions, setShowAllVersions] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    versionId: number;
    versionNo: string;
    status: string;
  } | null>(null);
  const [applyConfirmModal, setApplyConfirmModal] = useState<{
    open: boolean;
    versionId: number;
    versionNo: string;
  } | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const queryClient = useQueryClient();

  // 导出处理函数
  const handleExport = useCallback(async (format: ExportFormat, versionId: number | null) => {
    try {
      const params = versionId ? `?version_id=${versionId}` : '';
      let url = '';
      let filename = '';

      switch (format) {
        case 'excel':
          url = `/import-export/export/excel${params}`;
          filename = `排考结果${versionId ? `_v${versionId}` : ''}.xlsx`;
          break;
        case 'json':
          url = `/import-export/export/json${params}`;
          filename = `排考结果${versionId ? `_v${versionId}` : ''}.json`;
          break;
        case 'sql':
          url = `/import-export/export/sql${params}`;
          filename = `排考结果${versionId ? `_v${versionId}` : ''}.sql`;
          break;
      }

      // 发起请求获取文件
      const response = await apiClient.get(url, {
        responseType: format === 'json' ? 'json' : 'blob',
      });

      if (format === 'json') {
        // JSON 格式：下载为文件
        const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
        downloadBlob(blob, filename);
      } else {
        // Excel/SQL：直接下载
        const blob = new Blob([response.data], {
          type: format === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/plain',
        });
        downloadBlob(blob, filename);
      }

      toast.success(`导出成功：${filename}`);
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || '导出失败');
    }
  }, []);

  // 下载 Blob 文件
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 展开/折叠教室辅助函数
  const toggleClassroom = useCallback((roomName: string) => {
    setExpandedClassrooms((prev) => {
      const next = new Set(prev);
      if (next.has(roomName)) {
        next.delete(roomName);
      } else {
        next.add(roomName);
      }
      return next;
    });
  }, []);

  const collapseAllClassrooms = useCallback(() => {
    setExpandedClassrooms(new Set());
  }, []);

  // 展开/折叠课程辅助函数
  const toggleCourse = useCallback((courseId: number) => {
    setExpandedCourses((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) {
        next.delete(courseId);
      } else {
        next.add(courseId);
      }
      return next;
    });
  }, []);

  const collapseAllCourses = useCallback(() => {
    setExpandedCourses(new Set());
  }, []);

  // 获取排考版本列表
  const { data: versionsData, refetch: refetchVersions } = useQuery({
    queryKey: ['scheduleVersions'],
    queryFn: getScheduleVersions,
  });

  // 删除版本 mutation
  const deleteVersionMutation = useMutation({
    mutationFn: (versionId: number) => deleteScheduleVersion(versionId),
    onSuccess: (data, versionId) => {
      toast.success(`版本已删除${data.deleted_exams > 0 ? `，同时删除了 ${data.deleted_exams} 条考试记录` : ''}`);
      // 关闭确认对话框
      setDeleteModal(null);
      // 如果删除的是当前选中版本，需要切换到其他版本
      if (activeVersionId === versionId) {
        setActiveVersionId(null);
        // 清除所有面板数据
        queryClient.invalidateQueries({ queryKey: ['examOverviewMatrix'] });
        queryClient.invalidateQueries({ queryKey: ['teacherGanttData'] });
        queryClient.invalidateQueries({ queryKey: ['classroomMatrix'] });
        queryClient.invalidateQueries({ queryKey: ['patrolMatrix'] });
        queryClient.invalidateQueries({ queryKey: ['batchClassSchedule'] });
      }
      // 刷新版本列表
      refetchVersions();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || error?.message || '删除失败');
    },
  });

  // 应用版本 mutation
  const applyVersionMutation = useMutation({
    mutationFn: (versionId: number) => applyVersion(versionId),
    onSuccess: () => {
      toast.success('版本已应用，排考结果已更新');
      // 刷新版本列表和所有面板数据
      refetchVersions();
      queryClient.invalidateQueries({ queryKey: ['examOverviewMatrix'] });
      queryClient.invalidateQueries({ queryKey: ['teacherGanttData'] });
      queryClient.invalidateQueries({ queryKey: ['classroomMatrix'] });
      queryClient.invalidateQueries({ queryKey: ['patrolMatrix'] });
      queryClient.invalidateQueries({ queryKey: ['batchClassSchedule'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || error?.message || '应用失败');
    },
  });

  // 刷新所有面板数据
  const refreshAllPanels = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['examOverviewMatrix'] });
    queryClient.invalidateQueries({ queryKey: ['teacherGanttData'] });
    queryClient.invalidateQueries({ queryKey: ['classroomMatrix'] });
    queryClient.invalidateQueries({ queryKey: ['patrolMatrix'] });
    queryClient.invalidateQueries({ queryKey: ['batchClassSchedule'] });
    queryClient.invalidateQueries({ queryKey: ['courseExams'] });
    toast.success('数据已刷新');
  }, [queryClient]);

  // 过滤后的版本列表：默认只显示已发布版本
  const filteredVersions = useMemo(() => {
    if (!versionsData) return [];
    if (showAllVersions) return versionsData;
    // 只显示 published 或 latest 状态的版本
    return versionsData.filter((v: any) => v.status === 'published' || v.status === 'latest');
  }, [versionsData, showAllVersions]);

  // 设置默认选中的版本
  useEffect(() => {
    if (filteredVersions.length > 0 && !activeVersionId) {
      const active = filteredVersions.find((v: any) => v.status === 'published');
      setActiveVersionId(active?.id || filteredVersions[0].id);
    }
  }, [filteredVersions, activeVersionId]);

  // 获取当前选中版本的状态
  const currentVersionStatus = useMemo(() => {
    if (!activeVersionId || !versionsData) return null;
    const version = versionsData.find((v: any) => v.id === activeVersionId);
    return version?.status || null;
  }, [activeVersionId, versionsData]);

  // 获取总览矩阵数据
  const { data: overviewData } = useQuery({
    queryKey: ['examOverviewMatrix', activeVersionId],
    queryFn: () => getExamOverviewMatrix(),
    enabled: !!activeVersionId,
  });

  // 各面板数据查询
  const { data: teacherGanttData } = useQuery({
    queryKey: ['teacherGanttData', activeVersionId],
    queryFn: () => getTeacherGanttData(),
    enabled: !!activeVersionId,
  });
  const { data: classroomMatrixData } = useQuery({
    queryKey: ['classroomMatrix', activeVersionId],
    queryFn: () => getClassroomMatrix(),
    enabled: !!activeVersionId,
  });
  const { data: patrolMatrixData } = useQuery({
    queryKey: ['patrolMatrix', activeVersionId],
    queryFn: () => getPatrolMatrix(),
    enabled: !!activeVersionId,
  });
  const { data: batchClassData } = useQuery({
    queryKey: ['batchClassSchedule', activeVersionId],
    queryFn: () => getBatchClassSchedule(),
    enabled: !!activeVersionId,
  });
  const { data: coursesData } = useQuery({
    queryKey: ['courses'],
    queryFn: getCourses,
  });

  // 基础统计：从 overviewData 计算
  const baseStats = useMemo(() => {
    const matrix = overviewData?.matrix || {};
    let examCount = 0;
    const allTeachers = new Set<string>();
    const allRooms = new Set<string>();
    const allClasses = new Set<string>();
    const allCourses = new Set<string>();
    let patrolCount = 0;

    Object.values(matrix).forEach((daySlots: any) => {
      Object.values(daySlots).forEach((exams: any[]) => {
        exams.forEach((exam: any) => {
          examCount += (exam.classrooms?.length || 0);
          allCourses.add(exam.course_name);

          exam.classrooms?.forEach((cr: any) => {
            allRooms.add(cr.classroom_name);
            cr.classes?.forEach((cls: any) => {
              allClasses.add(cls.class_name);
            });
          });

          exam.teachers?.forEach((t: any) => {
            allTeachers.add(t.teacher_name);
            if (t.role === 'patrol') {
              patrolCount++;
            }
          });
        });
      });
    });

    return {
      examCount,
      teacherCount: allTeachers.size,
      roomCount: allRooms.size,
      classCount: allClasses.size,
      courseCount: allCourses.size,
      patrolCount,
    };
  }, [overviewData]);

  // 根据当前面板动态计算统计数据
  const stats = useMemo(() => {
    switch (currentPanel) {
      case 'overview':
        // 总览矩阵：显示基础统计
        return [
          { label: '考试场次', value: baseStats.examCount, highlight: true },
          { label: '监考教师', value: baseStats.teacherCount },
          { label: '使用教室', value: baseStats.roomCount },
          { label: '涉及班级', value: baseStats.classCount },
          { label: '涉及课程', value: baseStats.courseCount },
          { label: '流动监考人次', value: baseStats.patrolCount },
        ];

      case 'teachers': {
        // 监考教师：显示教师数量和监考场次分布
        const teachers = teacherGanttData?.teachers || [];
        let fixedCount = 0;
        let patrolCount = 0;
        teachers.forEach(t => {
          (t.events || []).forEach((e: any) => {
            if (e.role === 'fixed') fixedCount++;
            else if (e.role === 'patrol') patrolCount++;
          });
        });
        const totalExams = fixedCount + patrolCount;
        const avgExams = teachers.length > 0 ? totalExams / teachers.length : 0;
        return [
          { label: '监考教师', value: teachers.length, highlight: true },
          { label: '固定监考场次', value: fixedCount },
          { label: '流动监考场次', value: patrolCount },
          { label: '人均监考', value: Math.round(avgExams * 10) / 10, isDecimal: true },
          { label: '使用教室', value: baseStats.roomCount },
          { label: '涉及课程', value: baseStats.courseCount },
        ];
      }

      case 'teacher-load': {
        // 教师负荷：显示负荷分布
        const teachers = teacherGanttData?.teachers || [];
        // 从教师数据中获取最大监考场次上限（如果有）
        const globalMaxSlots = teachers.length > 0
          ? Math.max(...teachers.map(t => t.max_slots || 5))
          : 5;
        const examCounts = teachers.map(t => t.events?.length || 0);
        // 使用每位老师的 max_slots 计算高负荷教师
        const overloaded = teachers.filter(t => {
          const maxSlots = t.max_slots || 5;
          const count = t.events?.length || 0;
          return count > maxSlots * 0.8;
        }).length;
        const normal = teachers.length - overloaded;
        const totalExams = examCounts.reduce((sum, count) => sum + count, 0);
        const avgExams = teachers.length > 0 ? totalExams / teachers.length : 0;
        const maxExams = examCounts.length > 0 ? Math.max(...examCounts) : 0;
        return [
          { label: '监考教师', value: teachers.length, highlight: true },
          { label: '高负荷教师', value: overloaded },
          { label: '正常负荷', value: normal },
          { label: '最高场次', value: maxExams },
          { label: '平均场次', value: Math.round(avgExams * 10) / 10, isDecimal: true },
          { label: '满负荷上限', value: globalMaxSlots },
        ];
      }

      case 'classrooms': {
        // 教室使用：显示教室分布
        const matrix = classroomMatrixData?.matrix || {};
        const rooms = Object.keys(matrix);
        const totalExams = rooms.reduce((sum, room) => {
          return sum + Object.values(matrix[room] || {}).flat().length;
        }, 0);
        const avgExams = rooms.length > 0 ? (totalExams / rooms.length).toFixed(1) : 0;
        const usedDays = new Set<string>();
        rooms.forEach(room => {
          Object.keys(matrix[room] || {}).forEach(key => {
            const day = key.split('-')[0];
            if (day) usedDays.add(day);
          });
        });
        return [
          { label: '使用教室', value: rooms.length, highlight: true },
          { label: '教室场次', value: totalExams },
          { label: '人均使用', value: parseFloat(avgExams) },
          { label: '使用天数', value: usedDays.size },
          { label: '涉及班级', value: baseStats.classCount },
          { label: '涉及课程', value: baseStats.courseCount },
        ];
      }

      case 'patrol': {
        // 流动监考：显示分组统计
        const matrix = patrolMatrixData?.matrix || {};
        const groupColors = patrolMatrixData?.group_colors || {};
        const groups = Object.keys(groupColors);
        const totalAssignments = Object.values(matrix).reduce((sum: number, daySlots: any) => {
          return sum + Object.values(daySlots).reduce((s: number, arr: any[]) => s + arr.length, 0);
        }, 0);
        const avgPerGroup = groups.length > 0 ? (totalAssignments / groups.length).toFixed(1) : 0;
        return [
          { label: '流动监考人次', value: totalAssignments, highlight: true },
          { label: '监考分组', value: groups.length },
          { label: '人均次数', value: parseFloat(avgPerGroup) },
          { label: '分组数', value: groups.length },
          { label: '监考教师', value: baseStats.teacherCount },
          { label: '涉及课程', value: baseStats.courseCount },
        ];
      }

      case 'classes': {
        // 班级安排：显示班级统计
        const classes = batchClassData?.classes || [];
        const totalExams = classes.reduce((sum, c) => sum + (c.exam_count || 0), 0);
        const avgExams = classes.length > 0 ? (totalExams / classes.length).toFixed(1) : 0;
        return [
          { label: '涉及班级', value: classes.length, highlight: true },
          { label: '考试场次', value: totalExams },
          { label: '班均场次', value: parseFloat(avgExams) },
          { label: '使用教室', value: baseStats.roomCount },
          { label: '涉及课程', value: baseStats.courseCount },
          { label: '监考教师', value: baseStats.teacherCount },
        ];
      }

      case 'courses': {
        // 课程详情：显示课程统计
        const courses = coursesData?.items || [];
        const totalExams = courses.reduce((sum, c) => sum + (c.exam_count || 0), 0);
        const totalStudents = courses.reduce((sum, c) => sum + (c.student_count || 0), 0);
        return [
          { label: '涉及课程', value: courses.length, highlight: true },
          { label: '考试场次', value: totalExams },
          { label: '考生总数', value: totalStudents },
          { label: '使用教室', value: baseStats.roomCount },
          { label: '涉及班级', value: baseStats.classCount },
          { label: '监考教师', value: baseStats.teacherCount },
        ];
      }

      default:
        return [
          { label: '考试场次', value: baseStats.examCount, highlight: true },
          { label: '监考教师', value: baseStats.teacherCount },
          { label: '使用教室', value: baseStats.roomCount },
          { label: '涉及班级', value: baseStats.classCount },
          { label: '涉及课程', value: baseStats.courseCount },
          { label: '流动监考人次', value: baseStats.patrolCount },
        ];
    }
  }, [currentPanel, baseStats, teacherGanttData, classroomMatrixData, patrolMatrixData, batchClassData, coursesData]);

  const renderPanel = () => {
    switch (currentPanel) {
      case 'overview':
        return <OverviewPanel searchQuery={searchQuery} matrixData={overviewData} onCellClick={(date, slot) => setOverviewModal({ date, slot })} />;
      case 'teachers':
        return <TeacherPanel searchQuery={searchQuery} expandedTeacher={expandedTeacher} setExpandedTeacher={setExpandedTeacher} activeVersionId={activeVersionId} />;
      case 'teacher-load':
        return <TeacherLoadPanel searchQuery={searchQuery} activeVersionId={activeVersionId} />;
      case 'classrooms':
        return <ClassroomPanel searchQuery={searchQuery} expandedClassrooms={expandedClassrooms} toggleClassroom={toggleClassroom} collapseAll={collapseAllClassrooms} activeVersionId={activeVersionId} />;
      case 'patrol':
        return <PatrolPanel activeVersionId={activeVersionId} />;
      case 'classes':
        return <ClassPanel searchQuery={searchQuery} expandedClass={expandedClass} setExpandedClass={setExpandedClass} activeVersionId={activeVersionId} />;
      case 'courses':
        return <CoursePanel searchQuery={searchQuery} expandedCourses={expandedCourses} toggleCourse={toggleCourse} collapseAll={collapseAllCourses} />;
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
                value={activeVersionId || ''}
                onChange={(e) => {
                  const versionId = Number(e.target.value);
                  setActiveVersionId(versionId);
                }}
                className="form-input-glass rounded-xl appearance-none w-full pr-10 text-sm"
                disabled={!filteredVersions || filteredVersions.length === 0}
              >
                {filteredVersions && filteredVersions.length > 0 ? (
                  filteredVersions.map((v: any) => {
                    // 转换 UTC 时间到中国时区
                    const localTime = v.created_at
                      ? new Date(v.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
                      : '';
                    return (
                      <option key={v.id} value={v.id}>
                        {v.version_no} {v.status === 'published' ? '(当前)' : `(${localTime})`}
                      </option>
                    );
                  })
                ) : (
                  <option value="">加载中...</option>
                )}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C8CDD3] dark:text-[#484F58] pointer-events-none" />
            </div>

            {/* 应用此版本按钮 - 仅当选中版本不是已发布状态时显示 */}
            {activeVersionId && currentVersionStatus && currentVersionStatus !== 'published' && (
              <button
                onClick={() => {
                  if (activeVersionId && versionsData) {
                    const version = versionsData.find((v: any) => v.id === activeVersionId);
                    if (version) {
                      setApplyConfirmModal({
                        open: true,
                        versionId: version.id,
                        versionNo: version.version_no,
                      });
                    }
                  }
                }}
                disabled={applyVersionMutation.isPending}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 mb-3 bg-[#6B9B8A] hover:bg-[#5A8A79] text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {applyVersionMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={14} />
                )}
                应用此版本
              </button>
            )}

            {/* 显示所有版本切换 */}
            <button
              onClick={() => setShowAllVersions(!showAllVersions)}
              className={`w-full text-xs text-left px-3 py-1.5 rounded-lg mb-2 transition-colors ${
                showAllVersions
                  ? 'text-[#D4A373] bg-[#D4A373]/5'
                  : 'text-[#8C959F] dark:text-[#8B949E] hover:text-[#D4A373]'
              }`}
            >
              {showAllVersions ? '✓ 显示所有版本' : '显示所有版本（含草稿）'}
            </button>

            {/* 导航项列表 */}
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

            {/* 删除当前版本按钮 - 放在课程详情按钮下方，保持安全距离 */}
            {activeVersionId && (
              <button
                onClick={() => {
                  const currentVersion = versionsData?.find((v: any) => v.id === activeVersionId);
                  if (currentVersion) {
                    setDeleteModal({
                      open: true,
                      versionId: currentVersion.id,
                      versionNo: currentVersion.version_no,
                      status: currentVersion.status,
                    });
                  }
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 mt-6 text-xs text-[#C27A63] hover:bg-[#C27A63]/10 rounded-lg transition-colors"
              >
                <Trash2 size={12} />
                删除当前版本
              </button>
            )}
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

        {/* 删除版本确认对话框 */}
        {deleteModal?.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteModal(null)} />
            <div className="relative glass-card rounded-3xl p-6 w-[420px] max-w-[90vw]">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#C27A63]/10 flex items-center justify-center">
                  <AlertCircle size={20} className="text-[#C27A63]" />
                </div>
                <h3 className="font-display text-lg font-medium text-[#1F2328] dark:text-[#E6EDF3]">
                  删除版本
                </h3>
              </div>
              <p className="text-sm text-[#8C959F] dark:text-[#8B949E] mb-2">
                确定要删除版本 <span className="font-medium text-[#1F2328] dark:text-[#E6EDF3]">{deleteModal.versionNo}</span> 吗？
              </p>
              {deleteModal.status === 'published' && (
                <p className="text-xs text-[#C27A63] mb-4 p-2 bg-[#C27A63]/5 rounded-lg">
                  ⚠️ 这是已发布版本，删除将同时清空所有关联的考试数据（监考安排、教室分配等）。
                </p>
              )}
              {deleteModal.status === 'draft' && (
                <p className="text-xs text-[#8C959F] dark:text-[#8B949E] mb-4">
                  这是草稿版本，删除后不可恢复。
                </p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteModal(null)}
                  className="flex-1 px-4 py-2.5 bg-white/60 dark:bg-[#21262D]/80 text-[#8C959F] dark:text-[#8B949E] rounded-xl text-sm font-medium transition-all hover:bg-[#F3F4F6] dark:hover:bg-[#30363D]"
                >
                  取消
                </button>
                <button
                  onClick={() => deleteVersionMutation.mutate(deleteModal.versionId)}
                  disabled={deleteVersionMutation.isPending}
                  className="flex-1 px-4 py-2.5 bg-[#C27A63] hover:bg-[#B06A53] text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                >
                  {deleteVersionMutation.isPending ? '删除中...' : '确认删除'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 应用版本确认对话框 */}
        {applyConfirmModal?.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setApplyConfirmModal(null)} />
            <div className="relative glass-card rounded-3xl p-6 w-[420px] max-w-[90vw]">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#6B9B8A]/10 flex items-center justify-center">
                  <AlertCircle size={20} className="text-[#6B9B8A]" />
                </div>
                <h3 className="font-display text-lg font-medium text-[#1F2328] dark:text-[#E6EDF3]">
                  确认应用版本
                </h3>
              </div>
              <p className="text-sm text-[#8C959F] dark:text-[#8B949E] mb-2">
                确定要应用版本 <span className="font-medium text-[#1F2328] dark:text-[#E6EDF3]">{applyConfirmModal.versionNo}</span> 吗？
              </p>
              <p className="text-xs text-[#C27A63] mb-4 p-2 bg-[#C27A63]/5 rounded-lg">
                应用后，当前排考结果将被覆盖并归档，后续可在「显示所有版本」中找到并还原为应用版本。
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setApplyConfirmModal(null)}
                  className="flex-1 px-4 py-2.5 bg-white/60 dark:bg-[#21262D]/80 text-[#8C959F] dark:text-[#8B949E] rounded-xl text-sm font-medium transition-all hover:bg-[#F3F4F6] dark:hover:bg-[#30363D]"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    if (applyConfirmModal) {
                      setApplyConfirmModal(null);
                      applyVersionMutation.mutate(applyConfirmModal.versionId);
                    }
                  }}
                  disabled={applyVersionMutation.isPending}
                  className="flex-1 px-4 py-2.5 bg-[#6B9B8A] hover:bg-[#5A8A79] text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                >
                  {applyVersionMutation.isPending ? '应用中...' : '确认应用'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 导出对话框 */}
        <ExportModal
          open={exportModalOpen}
          onClose={() => setExportModalOpen(false)}
          versionId={activeVersionId}
          versionNo={filteredVersions.find((v: any) => v.id === activeVersionId)?.version_no || ''}
          versionStatus={currentVersionStatus}
          onExport={handleExport}
        />

        {/* Right Stats Panel */}
        <aside className="hidden md:block w-[280px] flex-shrink-0">
          <div className="glass-card rounded-3xl p-5 sticky top-24">
            <h3 className="font-display text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3] mb-1">
              数据统计
            </h3>
            <p className="text-xs text-[#8C959F] dark:text-[#8B949E] mb-4">
              {navItems.find(item => item.key === currentPanel)?.label || '总览矩阵'}
            </p>
            <div className="space-y-3">
              {stats.map((stat, index) => {
                const isDecimal = (stat as any).isDecimal;
                const displayValue = typeof stat.value === 'number' ? stat.value : 0;
                const intPart = Math.floor(displayValue);
                const decimalPart = isDecimal ? `.${String(displayValue % 1).slice(2, 3) || '0'}` : '';
                
                return (
                  <div
                    key={index}
                    className={`p-3 rounded-xl ${
                      stat.highlight ? 'bg-[#D4A373]/5' : 'bg-white/40 dark:bg-[#161B22]/60'
                    }`}
                  >
                    <div className="text-xs text-[#8C959F] dark:text-[#8B949E] mb-1">{stat.label}</div>
                    <div className="font-display font-semibold text-xl text-[#1F2328] dark:text-[#E6EDF3] flex items-baseline">
                      <RollingNumber target={intPart} />
                      {isDecimal && <span className="text-lg">{decimalPart}</span>}
                      {(['平均场次', '人均次数', '人均使用', '班均场次'] as string[]).includes(stat.label) && (
                        <span className="text-sm text-[#8C959F] dark:text-[#8B949E] font-normal ml-1">
                          {stat.label.includes('次数') ? '次' : '场'}
                        </span>
                      )}
                      {stat.label === '满负荷上限' && (
                        <span className="text-sm text-[#8C959F] dark:text-[#8B949E] font-normal ml-1">场</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 space-y-2">
              <button
                onClick={refreshAllPanels}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white/60 dark:bg-[#21262D]/80 hover:bg-[#D4A373]/10 text-[#8C959F] dark:text-[#8B949E] hover:text-[#D4A373] rounded-xl text-sm transition-all"
              >
                <RefreshCw size={14} />
                刷新数据
              </button>
              <button
                onClick={() => setExportModalOpen(true)}
                className="w-full btn-amber text-sm flex items-center justify-center gap-2"
              >
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
  const [examsOpen, setExamsOpen] = useState(true);

  // 统计教室数量（每场考试的每个教室都算）
  const classroomCount = slotExams.reduce((count: number, exam: any) => {
    return count + (exam.classrooms?.length || 0);
  }, 0);

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

      {/* 关联考试 - 可折叠 */}
      <div className="glass-card rounded-2xl p-4 mb-4">
        <button
          onClick={() => setExamsOpen(!examsOpen)}
          className="flex items-center justify-between w-full text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3]"
        >
          <span>关联考试 ({classroomCount} 教室)</span>
          {examsOpen ? (
            <ChevronDown size={14} className="text-[#8C959F]" />
          ) : (
            <ChevronRight size={14} className="text-[#8C959F]" />
          )}
        </button>

        {examsOpen && (
          <div className="mt-3 space-y-3 max-h-[400px] overflow-y-auto">
            {slotExams.length === 0 ? (
              <p className="text-sm text-[#C8CDD3] dark:text-[#484F58] py-4 text-center">该时段暂无考试安排。</p>
            ) : (
              slotExams.map((exam: any, examIdx: number) => {
                const classrooms = exam.classrooms || [];
                const fixedTeachers = (exam.teachers || []).filter((t: any) => t.role === 'fixed');
                const examPatrolTeachers = (exam.teachers || []).filter((t: any) => t.role === 'patrol');

                return (
                  <div key={examIdx} className="bg-[#F9FAFB] dark:bg-[#21262D] rounded-xl p-4">
                    {/* 考试基本信息 */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3]">{exam.course_name}</span>
                          <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] ${exam.course_type === '公共课' ? 'bg-[#6395C3]/10 text-[#6395C3]' : 'bg-[#D4A373]/10 text-[#D4A373]'}`}>{exam.course_type}</span>
                          {exam.exam_label && (
                            <span className="inline-flex px-1.5 py-0.5 rounded-full text-[10px] bg-[#6B9B8A]/10 text-[#6B9B8A]">{exam.exam_label}卷</span>
                          )}
                        </div>
                        <div className="text-xs text-[#8C959F] dark:text-[#8B949E]">
                          共 {exam.total_students} 名考生
                        </div>
                      </div>
                      <span className="text-xs text-[#C8CDD3] dark:text-[#484F58]">#{examIdx + 1}</span>
                    </div>

                    {/* 教室信息 */}
                    <div className="mb-3">
                      <div className="text-[10px] text-[#8C959F] dark:text-[#8B949E] mb-1.5">考试教室</div>
                      <div className="flex flex-wrap gap-2">
                        {classrooms.map((cr: any, crIdx: number) => (
                          <div key={crIdx} className="flex items-center gap-1.5 px-2 py-1 bg-white/60 dark:bg-[#161B22]/80 rounded-lg">
                            <Building2 size={12} className="text-[#D4A373]" />
                            <span className="text-xs text-[#1F2328] dark:text-[#E6EDF3]">{cr.classroom_name}</span>
                            <span className="text-[10px] text-[#8C959F] dark:text-[#8B949E]">({cr.capacity}座/{cr.total_students}人)</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 班级信息 */}
                    <div className="mb-3">
                      <div className="text-[10px] text-[#8C959F] dark:text-[#8B949E] mb-1.5">涉考班级</div>
                      <div className="flex flex-wrap gap-1.5">
                        {classrooms.flatMap((cr: any) =>
                          (cr.classes || []).map((cls: any, clsIdx: number) => (
                            <span key={clsIdx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#6395C3]/10 text-[#6395C3] rounded text-[10px]">
                              {cls.class_name} ({cls.student_count}人)
                              <span className="text-[#6395C3]/60">@{cr.classroom_name}</span>
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    {/* 监考教师 */}
                    <div className="flex flex-wrap gap-4">
                      {fixedTeachers.length > 0 && (
                        <div>
                          <div className="text-[10px] text-[#8C959F] dark:text-[#8B949E] mb-1">固定监考</div>
                          <div className="flex flex-wrap gap-1">
                            {fixedTeachers.map((t: any, tIdx: number) => (
                              <span key={tIdx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#D4A373]/10 text-[#D4A373] rounded text-[10px]">
                                <Users size={10} />
                                {t.teacher_name}
                                {t.classroom_name && <span className="text-[#D4A373]/60">@{t.classroom_name}</span>}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {examPatrolTeachers.length > 0 && (
                        <div>
                          <div className="text-[10px] text-[#8C959F] dark:text-[#8B949E] mb-1">流动监考</div>
                          <div className="flex flex-wrap gap-1">
                            {examPatrolTeachers.map((t: any, tIdx: number) => (
                              <span key={tIdx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#6B9B8A]/10 text-[#6B9B8A] rounded text-[10px]">
                                <Route size={10} />
                                {t.teacher_name}
                                {t.patrol_group_name && <span className="text-[#6B9B8A]/60">({t.patrol_group_name})</span>}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </>
  );
}

/* ==================== Sub Panels ==================== */

// 周排序映射，确保周一到周五按顺序
const DAY_ORDER: Record<string, number> = { '周一': 1, '周二': 2, '周三': 3, '周四': 4, '周五': 5 };

function OverviewPanel({ searchQuery: _searchQuery, matrixData, onCellClick }: { searchQuery: string; matrixData?: any; onCellClick?: (date: string, slot: string) => void }) {
  const matrix = matrixData?.matrix || {};
  const dates = Object.keys(matrix).sort((a, b) => (DAY_ORDER[a] || 99) - (DAY_ORDER[b] || 99));
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
                    {date}
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
  activeVersionId,
}: {
  searchQuery: string;
  expandedTeacher: number | null;
  setExpandedTeacher: (id: number | null) => void;
  activeVersionId: number | null;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['teacherGanttData', activeVersionId],
    queryFn: () => getTeacherGanttData(activeVersionId!),
    enabled: !!activeVersionId,
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
                    {teacherExams.map((exam, i) => (
                      <div key={i} className="text-xs bg-[#F9FAFB] dark:bg-[#21262D] rounded-xl p-3 space-y-1.5">
                        <div className="flex justify-between">
                          <span className="text-[#1F2328] dark:text-[#E6EDF3] font-medium">{exam.day_name} {exam.time_range}</span>
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
                        {exam.role === 'fixed' ? (
                          // 固定监考：显示班级信息
                          <div className="mt-1.5 px-2 py-1 bg-[#EBF4FF] dark:bg-[#1E3A5F] text-[#1D4ED8] dark:text-[#93C5FD] rounded-lg">
                            班级: {exam.class_names?.join(', ')}
                          </div>
                        ) : (
                          // 流动监考：显示巡场教室
                          <div className="mt-1.5 px-2 py-1 bg-[#FEF9E7] dark:bg-[#3D3020] text-[#B45309] dark:text-[#FCD34D] rounded-lg">
                            巡场: {exam.classrooms?.join('、')}
                          </div>
                        )}
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

function TeacherLoadPanel({ searchQuery, activeVersionId }: { searchQuery: string; activeVersionId: number | null }) {
  const { data, isLoading } = useQuery({
    queryKey: ['teacherGanttData', activeVersionId],
    queryFn: () => getTeacherGanttData(activeVersionId!),
    enabled: !!activeVersionId,
  });

  if (isLoading) {
    return <div className="glass-card rounded-3xl p-6 text-center text-[#8C959F]">加载中...</div>;
  }

  const teacherList = data?.teachers || [];
  // 教师类型映射
  const typeLabels: Record<string, string> = {
    full_time: '专任',
    part_time: '兼任',
  };
  // 计算教师负荷率（使用 API 返回的 max_slots）
  const filtered = teacherList
    .filter((t) => t.teacher_name.toLowerCase().includes(searchQuery.toLowerCase()))
    .map((t) => {
      const examCount = t.events?.length || 0;
      const maxSlots = t.max_slots || 5;
      return { ...t, examCount, maxSlots, loadRate: maxSlots > 0 ? (examCount / maxSlots) * 100 : 0 };
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
              <div className="text-[10px] text-[#8C959F] dark:text-[#8B949E]">{typeLabels[t.teacher_type] || '未知'}</div>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-[#8C959F] dark:text-[#8B949E]">{t.examCount} / {t.maxSlots} 场</span>
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

function ClassroomPanel({
  searchQuery,
  expandedClassrooms,
  toggleClassroom,
  collapseAll,
  activeVersionId,
}: {
  searchQuery: string;
  expandedClassrooms: Set<string>;
  toggleClassroom: (name: string) => void;
  collapseAll: () => void;
  activeVersionId: number | null;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['classroomMatrix', activeVersionId],
    queryFn: () => getClassroomMatrix(activeVersionId!),
    enabled: !!activeVersionId,
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
        <div className="flex items-center gap-3">
          {expandedClassrooms.size > 0 && (
            <button
              onClick={collapseAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#8C959F] dark:text-[#8B949E] hover:text-[#D4A373] hover:bg-[#D4A373]/10 rounded-lg transition-all"
            >
              <ChevronsUpDown size={14} />
              全部折叠
            </button>
          )}
          <span className="text-xs text-[#8C959F] dark:text-[#8B949E] bg-[#F9FAFB] dark:bg-[#21262D] px-3 py-1 rounded-full">
            {filtered.length} 间教室
          </span>
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
        {filtered.map((roomName) => {
          const roomData = matrix[roomName] || {};
          const roomExams = Object.values(roomData).flat().sort((a, b) => {
            // 按日期排序（周一在前），再按时间排序（早的在前）
            if (a.day_of_week !== b.day_of_week) {
              return a.day_of_week - b.day_of_week;
            }
            return a.time_range.localeCompare(b.time_range);
          });
          const isExpanded = expandedClassrooms.has(roomName);

          return (
            <>
              <div
                key={roomName}
                className={`glass-card rounded-2xl p-4 cursor-pointer transition-all hover:shadow-lg ${
                  isExpanded ? 'ring-2 ring-[#D4A373]/20' : ''
                }`}
                onClick={() => toggleClassroom(roomName)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 size={16} className="text-[#D4A373]" />
                    <span className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3]">{roomName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="status-badge-info text-[10px]">{roomExams.length} 场</span>
                    <ChevronDown
                      size={16}
                      className={`text-[#8C959F] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </div>
                </div>
              </div>

              {isExpanded && roomExams.length > 0 && (
                <div className="col-span-full glass-card rounded-2xl p-5 space-y-3">
                  <div className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3] mb-3">
                    {roomName} 的考试安排
                    <span className="ml-2 text-xs text-[#8C959F] dark:text-[#8B949E]">({roomExams.length} 场)</span>
                  </div>
                  <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                    {roomExams.map((exam: any, i: number) => (
                      <div key={i} className="text-xs bg-[#F9FAFB] dark:bg-[#21262D] rounded-xl p-3 space-y-1.5">
                        <div className="text-[#1F2328] dark:text-[#E6EDF3] font-medium">{exam.course_name}</div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="px-2 py-1 rounded bg-[#10B981]/10 text-[#10B981] font-medium text-[11px]">
                            星期{exam.day_name.replace('周', '')} {exam.time_range}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#D4A373]/10 text-[#D4A373]">
                            {exam.exam_label || '-'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 pt-1 border-t border-[#F3F4F6] dark:border-[#30363D] flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-[#6395C3]/10 text-[#6395C3] text-[10px]">
                            {exam.class_names?.join('、') || '未知班级'}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-[#D4A373]/10 text-[#D4A373] text-[10px]">
                            {exam.total_students} 人
                          </span>
                          {exam.teacher_names?.length > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-[#8B5CF6]/10 text-[#8B5CF6] text-[10px]">
                              {exam.teacher_names.join('、')}
                            </span>
                          )}
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

function PatrolPanel({ activeVersionId }: { activeVersionId: number | null }) {
  const { data, isLoading } = useQuery({
    queryKey: ['patrolMatrix', activeVersionId],
    queryFn: () => getPatrolMatrix(activeVersionId!),
    enabled: !!activeVersionId,
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

function ClassPanel({
  searchQuery,
  expandedClass,
  setExpandedClass,
  activeVersionId,
}: {
  searchQuery: string;
  expandedClass: number | null;
  setExpandedClass: (id: number | null) => void;
  activeVersionId: number | null;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['batchClassSchedule', activeVersionId],
    queryFn: () => getBatchClassSchedule(activeVersionId!),
    enabled: !!activeVersionId,
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
          const isExpanded = expandedClass === cls.class_id;
          const previewExams = cls.exams.slice(0, 3);

          return (
            <>
              <div
                key={cls.class_id}
                className={`glass-card rounded-2xl p-4 cursor-pointer transition-all hover:shadow-lg ${
                  isExpanded ? 'ring-2 ring-[#D4A373]/20' : ''
                }`}
                onClick={() => setExpandedClass(isExpanded ? null : cls.class_id)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <GraduationCap size={16} className="text-[#D4A373]" />
                    <span className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3]">{cls.class_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="status-badge-info text-[10px]">{cls.exam_count} 场</span>
                    <ChevronDown
                      size={16}
                      className={`text-[#8C959F] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  {previewExams.map((exam, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs bg-[#F9FAFB] dark:bg-[#21262D] rounded-lg p-2">
                      <Clock size={12} className="text-[#8C959F] dark:text-[#8B949E] flex-shrink-0" />
                      <span className="text-[#8C959F] dark:text-[#8B949E]">{exam.day_name} {exam.time_range}</span>
                      <span className="text-[#1F2328] dark:text-[#E6EDF3] font-medium truncate">{exam.course_name}</span>
                      <span className="text-[#C8CDD3] dark:text-[#484F58]">{exam.classroom_name}</span>
                    </div>
                  ))}
                  {cls.exams.length > 3 && !isExpanded && (
                    <div className="text-xs text-[#8C959F] dark:text-[#8B949E] text-center py-1">
                      还有 {cls.exams.length - 3} 场...
                    </div>
                  )}
                </div>
              </div>

              {isExpanded && cls.exams.length > 0 && (
                <div className="col-span-full glass-card rounded-2xl p-5 space-y-3">
                  <div className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3] mb-3">
                    {cls.class_name} 的考试安排
                    <span className="ml-2 text-xs text-[#8C959F] dark:text-[#8B949E]">({cls.exams.length} 场)</span>
                  </div>
                  <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                    {cls.exams.map((exam, i) => (
                      <div key={i} className="text-xs bg-[#F9FAFB] dark:bg-[#21262D] rounded-xl p-3 space-y-1.5">
                        <div className="text-[#1F2328] dark:text-[#E6EDF3] font-medium">{exam.course_name}</div>
                        <div className="flex justify-between items-center">
                          <span className="text-[#8C959F] dark:text-[#8B949E]">
                            {exam.day_name} {exam.time_range}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#D4A373]/10 text-[#D4A373]">
                            {exam.exam_label || '-'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1 border-t border-[#F3F4F6] dark:border-[#30363D]">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-[#6395C3]/10 text-[#6395C3]">
                            考场: {exam.classroom_name}
                          </span>
                          {exam.teacher_names && exam.teacher_names.length > 0 && (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-[#6B9B8A]/10 text-[#6B9B8A]">
                              监考: {exam.teacher_names.join('、')}
                            </span>
                          )}
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

function CoursePanel({
  searchQuery,
  expandedCourses,
  toggleCourse,
  collapseAll,
}: {
  searchQuery: string;
  expandedCourses: Set<number>;
  toggleCourse: (id: number) => void;
  collapseAll: () => void;
}) {
  const { data: coursesData, isLoading } = useQuery({
    queryKey: ['courses'],
    queryFn: getCourses,
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
        <div className="flex items-center gap-3">
          {expandedCourses.size > 0 && (
            <button
              onClick={collapseAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#8C959F] dark:text-[#8B949E] hover:text-[#6395C3] hover:bg-[#6395C3]/10 rounded-lg transition-all"
            >
              <ChevronsUpDown size={14} />
              全部折叠
            </button>
          )}
          <span className="text-xs text-[#8C959F] dark:text-[#8B949E] bg-[#F9FAFB] dark:bg-[#21262D] px-3 py-1 rounded-full">
            {filtered.length} 门课程
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((course) => {
          const isExpanded = expandedCourses.has(course.id);
          const isLoadingDetail = isExpanded;

          return (
            <div
              key={course.id}
              className="glass-card rounded-2xl overflow-hidden cursor-pointer transition-all"
              onClick={() => toggleCourse(course.id)}
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

              {isExpanded && (
                <CourseExamDetail courseId={course.id} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CourseExamDetail({ courseId }: { courseId: number }) {
  const { data: courseDetailData, isLoading } = useQuery({
    queryKey: ['courseDetail', courseId],
    queryFn: () => getCourseExams(courseId),
  });

  if (isLoading) {
    return <div className="px-4 pb-4 border-t border-[#F3F4F6] dark:border-[#30363D] pt-3 text-center text-xs text-[#8C959F]">加载详情中...</div>;
  }

  if (!courseDetailData || !courseDetailData.exams || courseDetailData.exams.length === 0) {
    return <div className="px-4 pb-4 border-t border-[#F3F4F6] dark:border-[#30363D] pt-3 text-center text-xs text-[#8C959F]">暂无考试安排</div>;
  }

  return (
    <div className="px-4 pb-4 border-t border-[#F3F4F6] dark:border-[#30363D]">
      <div className="mt-3 space-y-2">
        {courseDetailData.exams?.map((exam: any, i: number) => {
          // 后端返回 classrooms 数组，每个元素包含 classroom_name 和 classes 数组
          const classrooms = exam.classrooms || [];
          const items: { room: string; classInfo: string }[] = classrooms.map((c: any) => {
            const classNames = c.classes
              ?.map((cl: any) => `${cl.class_name}(${cl.student_count}人)`)
              .join('、') || '-';
            return { room: c.classroom_name, classInfo: classNames };
          });
          if (items.length === 0) items.push({ room: '-', classInfo: '-' });

          // 每4个一行
          const rows: typeof items[] = [];
          for (let k = 0; k < items.length; k += 4) {
            rows.push(items.slice(k, k + 4));
          }

          return (
            <div key={i} className="mb-3">
              {/* 标题行 - 加大显示 */}
              <div className="flex items-center gap-3 mb-2 text-sm">
                <Clock size={14} className="text-[#D4A373]" />
                <span className="font-semibold text-[#1F2328] dark:text-[#E6EDF3]">{exam.day_name}</span>
                <span className="text-[#8C959F] dark:text-[#8B949E]">{exam.time_range}</span>
                <span className="px-2 py-0.5 rounded bg-[#D4A373]/10 text-[#D4A373] font-medium">
                  {exam.exam_label || '-'}
                </span>
              </div>
              {/* 教室信息 - 每4个一行，用grid保证对齐 */}
              <div className="space-y-1">
                {rows.map((row, j) => (
                  <div key={j} className="grid grid-cols-4 gap-2">
                    {row.map((item, k) => (
                      <div
                        key={k}
                        className={`px-2 py-1.5 rounded-lg text-xs font-medium text-center truncate ${
                          (j * 4 + k) % 2 === 0
                            ? 'bg-[#6395C3]/10 text-[#6395C3]'
                            : 'bg-[#D4A373]/10 text-[#D4A373]'
                        }`}
                        title={`${item.room}@${item.classInfo}`}
                      >
                        {item.room}@{item.classInfo}
                      </div>
                    ))}
                    {/* 填充空白格子 */}
                    {row.length < 4 && Array.from({ length: 4 - row.length }).map((_, k) => (
                      <div key={`empty-${k}`} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
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
  );
}
