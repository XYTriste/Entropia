import { useState, useMemo, useEffect } from 'react';
import {
  Users,
  Building2,
  BookOpen,
  GraduationCap,
  UserCircle,
  Award,
  Clock,
  Search,
  Plus,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Pencil,
  Trash2,
  Eye,
  X,
} from 'lucide-react';
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { BaseDataType } from '@/types';
import {
  useTeachers,
  useCreateTeacher,
  useUpdateTeacher,
  useDeleteTeacher,
} from '@/hooks/useTeachers';
import {
  useClassrooms,
  useCreateClassroom,
  useUpdateClassroom,
  useDeleteClassroom,
} from '@/hooks/useClassrooms';
import {
  useCourses,
  useCreateCourse,
  useUpdateCourse,
  useDeleteCourse,
} from '@/hooks/useCourses';
import {
  useClasses,
  useCreateClass,
  useUpdateClass,
  useDeleteClass,
} from '@/hooks/useClasses';
import {
  useStudents,
  useCreateStudent,
  useUpdateStudent,
  useDeleteStudent,
} from '@/hooks/useStudents';
import { useMajors, useCreateMajor, useUpdateMajor, useDeleteMajor } from '@/hooks/useMajors';
import { useTimeSlots, useCreateTimeSlot, useUpdateTimeSlot, useDeleteTimeSlot } from '@/hooks/useTimeSlots';

// ── Mock 数据（仅详情弹窗仍使用，后续可替换为真实 API）─────────────
import {
  teachers as mockTeachers,
  classrooms as mockClassrooms,
  courses as mockCourses,
  classesData as mockClassesData,
  students as mockStudents,
  majors as mockMajors,
  timeSlots as mockTimeSlots,
  examSchedules,
} from '@/data/mock';

// ── 教师详情组件（接入 /api/teachers/{id}/exams）──────────────────
import apiClient from '@/api/client';

interface TeacherExamData {
  teacher_id: number;
  teacher_name: string;
  current_slots: number;
  max_slots: number;
  fixed_count: number;
  patrol_count: number;
  fixed_exams: Array<{
    exam_id: number;
    course_name: string;
    course_type: string;
    exam_paper: string;
    time_slot: string;
    classroom_name: string;
    date: string;
  }>;
  patrol_exams: Array<{
    date: string;
    time_slot: string;
    remark: string;
  }>;
}

// ── 教师详情表格（适配后端 API 返回的字段）─────────────────────
interface TeacherExamRow {
  date: string;
  time_slot: string;
  course_name: string;
  course_type?: string;
  exam_paper?: string;
  classroom_name?: string;
  classes_str?: string;
  student_count?: number;
}

function TeacherDetailContent({ teacherId, onClose }: { teacherId: number; onClose: () => void }) {
  const [data, setData] = useState<TeacherExamData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get<{ code: number; data: TeacherExamData }>(`/teachers/${teacherId}/exams`)
      .then(res => setData(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [teacherId]);

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display text-lg font-medium text-[#1F2328] dark:text-[#E6EDF3]">加载中...</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F9FAFB] dark:bg-[#21262D]"><X size={16} className="text-[#8C959F]" /></button>
        </div>
        <div className="space-y-3 animate-pulse">
          {[1,2,3,4].map(i => <div key={i} className="h-16 bg-[#F3F4F6] dark:bg-[#30363D] rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display text-lg font-medium text-[#1F2328] dark:text-[#E6EDF3]">加载失败</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F9FAFB] dark:bg-[#21262D]"><X size={16} className="text-[#8C959F]" /></button>
        </div>
        <div className="text-sm text-[#8C959F]">无法获取监考信息</div>
      </div>
    );
  }

  const name = data.teacher_name;
  const total = data.fixed_count + data.patrol_count;

  // 将 fixed_exams 转换为表格行
  const fixedRows: TeacherExamRow[] = data.fixed_exams.map(exam => {
    // 将班级数组转换为字符串
    const classesStr = exam.assigned_classes && exam.assigned_classes.length > 0
      ? exam.assigned_classes.map((c: any) => `${c.class_name}(${c.student_count}人)`).join('、')
      : '-';
    
    return {
      date: exam.date,
      time_slot: exam.time_slot,
      course_name: exam.course_name,
      course_type: exam.course_type,
      exam_paper: exam.exam_paper,
      classroom_name: exam.assigned_classroom || '-',
      classes_str: classesStr,
      student_count: exam.assigned_student_count || 0,
    };
  });

  // 将 patrol_exams 转换为表格行
  const patrolRows: TeacherExamRow[] = data.patrol_exams.map(exam => ({
    date: exam.date,
    time_slot: exam.time_slot,
    course_name: exam.remark || '流动监考',
    classroom_name: '-',
  }));

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-display text-lg font-medium text-[#1F2328] dark:text-[#E6EDF3]">{name} 监考详情</h3>
        <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F9FAFB] dark:bg-[#21262D]"><X size={16} className="text-[#8C959F] dark:text-[#8B949E]" /></button>
      </div>

      {/* 统计卡片 - 4列布局 */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <div className="glass-card rounded-xl p-3 text-center">
          <div className="text-xs text-[#8C959F] dark:text-[#8B949E]">姓名</div>
          <div className="font-display text-lg font-semibold text-[#1F2328] dark:text-[#E6EDF3] truncate">{name}</div>
        </div>
        <div className="glass-card rounded-xl p-3 text-center">
          <div className="text-xs text-[#8C959F] dark:text-[#8B949E]">固定监考</div>
          <div className="font-display text-lg font-semibold text-[#D4A373]">{data.fixed_count} 场</div>
        </div>
        <div className="glass-card rounded-xl p-3 text-center">
          <div className="text-xs text-[#8C959F] dark:text-[#8B949E]">流动监考</div>
          <div className="font-display text-lg font-semibold text-[#6395C3]">{data.patrol_count} 场</div>
        </div>
        <div className="glass-card rounded-xl p-3 text-center">
          <div className="text-xs text-[#8C959F] dark:text-[#8B949E]">总监考</div>
          <div className="font-display text-lg font-semibold text-[#1F2328] dark:text-[#E6EDF3]">{total} 场</div>
        </div>
      </div>

      {/* 固定监考表格 */}
      <div className="glass-card rounded-2xl p-4 mb-4">
        <h4 className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3] mb-3">固定监考安排</h4>
        {fixedRows.length === 0 ? (
          <p className="text-sm text-[#C8CDD3] dark:text-[#484F58] py-4 text-center">暂无固定监考安排。</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#F9FAFB] dark:bg-[#21262D]/80">
                <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">日期</th>
                <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">时段</th>
                <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">课程</th>
                <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">类型</th>
                <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">监考教室</th>
                <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">涉考班级</th>
                <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">人数</th>
                <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">AB卷</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {fixedRows.map((row, i) => (
                <tr key={i} className="data-table-row">
                  <td className="px-2 py-2 text-[#1F2328] dark:text-[#E6EDF3]">{row.date}</td>
                  <td className="px-2 py-2 text-[#8C959F] dark:text-[#8B949E]">{row.time_slot}</td>
                  <td className="px-2 py-2 text-[#1F2328] dark:text-[#E6EDF3] font-medium">{row.course_name}</td>
                  <td className="px-2 py-2">
                    <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] ${
                      row.course_type === '公共课' ? 'bg-[#6395C3]/10 text-[#6395C3]' : 'bg-[#D4A373]/10 text-[#D4A373]'
                    }`}>
                      {row.course_type}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-[#1F2328] dark:text-[#E6EDF3]">{row.classroom_name}</td>
                  <td className="px-2 py-2 text-[#1F2328] dark:text-[#E6EDF3]">{row.classes_str}</td>
                  <td className="px-2 py-2 text-[#8C959F] dark:text-[#8B949E]">{row.student_count} 人</td>
                  <td className="px-2 py-2 text-[#8C959F] dark:text-[#8B949E]">{row.exam_paper || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 流动监考表格 */}
      <div className="glass-card rounded-2xl p-4">
        <h4 className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3] mb-3">流动监考安排</h4>
        {patrolRows.length === 0 ? (
          <p className="text-sm text-[#C8CDD3] dark:text-[#484F58] py-4 text-center">暂无流动监考安排。</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#F9FAFB] dark:bg-[#21262D]/80">
                <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">日期</th>
                <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">时段</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {patrolRows.map((row, i) => (
                <tr key={i} className="data-table-row">
                  <td className="px-2 py-2 text-[#1F2328] dark:text-[#E6EDF3]">{row.date}</td>
                  <td className="px-2 py-2 text-[#8C959F] dark:text-[#8B949E]">{row.time_slot}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

// ── 常量 ────────────────────────────────────────────────────────
const navItems: { key: BaseDataType; label: string; icon: typeof Users }[] = [
  { key: 'teachers', label: '教师', icon: Users },
  { key: 'classrooms', label: '教室', icon: Building2 },
  { key: 'courses', label: '课程', icon: BookOpen },
  { key: 'classes', label: '班级', icon: GraduationCap },
  { key: 'students', label: '学生', icon: UserCircle },
  { key: 'majors', label: '专业', icon: Award },
  { key: 'time-slots', label: '时段', icon: Clock },
];

const ITEMS_PER_PAGE = 10;

// ── 数据类型映射（hook key → snake_case 参数名）────────────────
const searchKeyMap: Record<BaseDataType, string> = {
  teachers: 'teachers',
  classrooms: 'classrooms',
  courses: 'courses',
  classes: 'classes',
  students: 'students',
  majors: 'majors',
  'time-slots': 'time-slots',
};

// ── 全局状态：各 Tab 搜索词 & 页码（初始化为空，后端分页）────────
interface TabState {
  search: string;
  page: number;
  selected: number[];
}

const initTabState = (): TabState => ({ search: '', page: 1, selected: [] });

export default function BaseDataView() {
  const [activeTab, setActiveTab] = useState<BaseDataType>('teachers');
  const [tabStates, setTabStates] = useState<Record<BaseDataType, TabState>>({
    teachers: initTabState(),
    classrooms: initTabState(),
    courses: initTabState(),
    classes: initTabState(),
    students: initTabState(),
    majors: initTabState(),
    'time-slots': initTabState(),
  });
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editItem, setEditItem] = useState<Record<string, unknown> | null>(null);

  const current = tabStates[activeTab];

  // ── 根据 activeTab 切换对应 hook ─────────────────────────────
  // teachers（获取全量数据，前端分页切片显示）
  const teachersQuery = useTeachers(
    current.search ? { search: current.search, all: true } : { all: true }
  );
  const createTeacher = useCreateTeacher();
  const updateTeacher = useUpdateTeacher();
  const deleteTeacher = useDeleteTeacher();

  // classrooms（获取全量数据，前端分页切片显示）
  const classroomsQuery = useClassrooms(
    current.search ? { search: current.search, all: true } : { all: true }
  );
  const createClassroom = useCreateClassroom();
  const updateClassroom = useUpdateClassroom();
  const deleteClassroom = useDeleteClassroom();

  // courses（获取全量数据，前端分页切片显示）
  const coursesQuery = useCourses(
    current.search ? { search: current.search, all: true } : { all: true }
  );
  const createCourse = useCreateCourse();
  const updateCourse = useUpdateCourse();
  const deleteCourse = useDeleteCourse();

  // classes（获取全量数据，前端分页切片显示）
  const classesQuery = useClasses(
    current.search ? { search: current.search, all: true } : { all: true }
  );
  const createClass = useCreateClass();
  const updateClass = useUpdateClass();
  const deleteClass = useDeleteClass();

  // students（获取全量数据，前端分页切片显示）
  const studentsQuery = useStudents(
    current.search ? { search: current.search, all: true } : { all: true }
  );
  const createStudent = useCreateStudent();
  const updateStudent = useUpdateStudent();
  const deleteStudent = useDeleteStudent();

  // majors（获取全量数据，前端分页切片显示）
  const majorsQuery = useMajors(
    current.search ? { search: current.search, all: true } : { all: true }
  );
  const createMajor = useCreateMajor();
  const updateMajor = useUpdateMajor();
  const deleteMajor = useDeleteMajor();

  // time-slots（不分页，无搜索）
  const timeSlotsQuery = useTimeSlots();
  const createTimeSlot = useCreateTimeSlot();
  const updateTimeSlot = useUpdateTimeSlot();
  const deleteTimeSlot = useDeleteTimeSlot();

  // ── 统一获取当前 Tab 的 query 结果 ───────────────────────────
  const currentQuery = (() => {
    switch (activeTab) {
      case 'teachers': return teachersQuery;
      case 'classrooms': return classroomsQuery;
      case 'courses': return coursesQuery;
      case 'classes': return classesQuery;
      case 'students': return studentsQuery;
      case 'majors': return majorsQuery;
      case 'time-slots': return timeSlotsQuery;
    }
  })();

  // ── 统一获取 CRUD mutation ───────────────────────────────────
  const currentMutations = (() => {
    switch (activeTab) {
      case 'teachers': return { create: createTeacher, update: updateTeacher, delete: deleteTeacher };
      case 'classrooms': return { create: createClassroom, update: updateClassroom, delete: deleteClassroom };
      case 'courses': return { create: createCourse, update: updateCourse, delete: deleteCourse };
      case 'classes': return { create: createClass, update: updateClass, delete: deleteClass };
      case 'students': return { create: createStudent, update: updateStudent, delete: deleteStudent };
      case 'majors': return { create: createMajor, update: updateMajor, delete: deleteMajor };
      case 'time-slots': return { create: createTimeSlot, update: updateTimeSlot, delete: deleteTimeSlot };
    }
  })();

  const currentData: Record<string, unknown>[] = currentQuery.data ?? [];

  // 前端分页切片（基于全量数据 currentData）
  const startIndex = (current.page - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedData = currentData.slice(startIndex, endIndex);

  // 后端返回总条数（带分页时）
  const totalCount = (currentQuery.data && 'total' in currentQuery.data
    ? (currentQuery.data as any).total
    : currentData.length) as number;

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const isLoading = currentQuery.isLoading;
  const isFetching = currentQuery.isFetching;
  const error = currentQuery.error;

  // ── 工具方法 ────────────────────────────────────────────────
  const setTabState = (patch: Partial<TabState>) => {
    setTabStates(prev => ({
      ...prev,
      [activeTab]: { ...prev[activeTab], ...patch },
    }));
  };

  const handleTabChange = (key: BaseDataType) => {
    setActiveTab(key);
  };

  const handleSelectAll = (checked: boolean) => {
    setTabState({ selected: checked ? paginatedData.map((item) => item.id as number) : [] });
  };

  const handleSelectRow = (id: number) => {
    setTabState({
      selected: current.selected.includes(id)
        ? current.selected.filter(r => r !== id)
        : [...current.selected, id],
    });
  };

  const handleDelete = () => {
    if (!editItem?.id) return;
    currentMutations.delete.mutate(editItem.id as number, {
      onSuccess: () => {
        setShowDeleteConfirm(false);
        setEditItem(null);
      },
    });
  };

  const handleRefresh = () => {
    currentQuery.refetch();
  };

  // ── 统计面板（实时从 API 数据计算）──────────────────────────
  const getStats = () => {
    switch (activeTab) {
      case 'teachers': {
        const list = currentData as any[];
        return [
          { label: '总记录数', value: totalCount },
          { label: '专任教师', value: list.filter((t) => t.teacher_type === 'full_time').length },
          { label: '兼任教师', value: list.filter((t) => t.teacher_type === 'part_time').length },
          { label: '已选记录', value: current.selected.length },
        ];
      }
      case 'classrooms': {
        const list = currentData as any[];
        const totalCap = list.reduce((s, c) => s + (c.capacity ?? 0), 0);
        return [
          { label: '总记录数', value: totalCount },
          { label: '总容量', value: totalCap },
          { label: '平均容量', value: list.length ? Math.round(totalCap / list.length) : 0 },
          { label: '已选记录', value: current.selected.length },
        ];
      }
      case 'courses': {
        const list = currentData as any[];
        return [
          { label: '总记录数', value: totalCount },
          { label: '公共课', value: list.filter((c) => c.course_type === 'public').length },
          { label: '专业课', value: list.filter((c) => c.course_type === 'major').length },
          { label: '需AB卷', value: list.filter((c) => c.needs_ab).length },
          { label: '已选记录', value: current.selected.length },
        ];
      }
      default:
        return [
          { label: '总记录数', value: totalCount },
          { label: '已选记录', value: current.selected.length },
        ];
    }
  };

  // ── 侧边栏 Badge 数量（从各 query 实时获取）────────────────
  const badgeCounts: Record<string, number> = {
    teachers: teachersQuery.data?.length ?? 0,
    classrooms: classroomsQuery.data?.length ?? 0,
    courses: coursesQuery.data?.length ?? 0,
    classes: classesQuery.data?.length ?? 0,
    students: studentsQuery.data?.length ?? 0,
    majors: majorsQuery.data?.length ?? 0,
    'time-slots': timeSlotsQuery.data?.length ?? 0,
  };

  // ── 列配置（复用原有逻辑，统一从数据提取字段渲染）─────────────
  const getColumns = () => {
    const base = [
      { key: 'id', label: 'ID', width: '60px' },
      { key: 'actions', label: '操作', width: '120px' },
    ];
    switch (activeTab) {
      case 'teachers':
        return [
          { key: 'id', label: 'ID', width: '60px' },
          { key: 'name', label: '姓名' },
          { key: 'teacher_type', label: '类型' },
          { key: 'max_slots', label: '最大监考数', width: '100px' },
          { key: 'current_slots', label: '当前监考', width: '100px' },
          { key: 'is_active', label: '状态', width: '80px' },
          { key: 'actions', label: '操作', width: '120px' },
        ];
      case 'classrooms':
        return [
          { key: 'id', label: 'ID', width: '60px' },
          { key: 'name', label: '教室名称' },
          { key: 'building', label: '教学楼' },
          { key: 'room_type', label: '类型' },
          { key: 'capacity', label: '容量', width: '80px' },
          { key: 'floor', label: '楼层', width: '80px' },
          { key: 'is_active', label: '状态', width: '80px' },
          { key: 'actions', label: '操作', width: '120px' },
        ];
      case 'courses':
        return [
          { key: 'id', label: 'ID', width: '60px' },
          { key: 'name', label: '课程名称' },
          { key: 'course_type', label: '类型', width: '100px' },
          { key: 'linked_class_count', label: '关联班级', width: '100px' },
          { key: 'student_count', label: '学生数', width: '80px' },
          { key: 'needs_ab', label: 'AB卷', width: '80px' },
          { key: 'schedule_status', label: '排考状态', width: '100px' },
          { key: 'is_active', label: '状态', width: '80px' },
          { key: 'actions', label: '操作', width: '120px' },
        ];
      case 'classes':
        return [
          { key: 'id', label: 'ID', width: '60px' },
          { key: 'name', label: '班级名称' },
          { key: 'major_name', label: '专业' },
          { key: 'grade', label: '年级' },
          { key: 'student_count', label: '学生数', width: '80px' },
          { key: 'actions', label: '操作', width: '120px' },
        ];
      case 'students':
        return [
          { key: 'id', label: 'ID', width: '60px' },
          { key: 'student_id', label: '学号' },
          { key: 'name', label: '姓名' },
          { key: 'class_name', label: '班级' },
          { key: 'major', label: '专业' },
          { key: 'actions', label: '操作', width: '120px' },
        ];
      case 'majors':
        return [
          { key: 'id', label: 'ID', width: '60px' },
          { key: 'name', label: '专业名称' },
          { key: 'created_at', label: '创建时间', width: '180px' },
          { key: 'actions', label: '操作', width: '120px' },
        ];
      case 'time-slots':
        return [
          { key: 'id', label: 'ID', width: '60px' },
          { key: 'day_name', label: '星期', width: '80px' },
          { key: 'slot_code', label: '时段', width: '80px' },
          { key: 'start_time', label: '开始时间', width: '100px' },
          { key: 'end_time', label: '结束时间', width: '100px' },
          { key: 'actions', label: '操作', width: '96px' },
        ];
    }
  };

  const currentColumns = getColumns();

  const renderCell = (item: Record<string, unknown>, key: string) => {
    if (key === 'actions') {
      return (
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setEditItem(item); setShowEditDialog(true); }}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#D4A373]/10 transition-colors group/btn"
            title="编辑"
          >
            <Pencil size={14} className="text-[#8C959F] dark:text-[#8B949E] group-hover/btn:text-[#D4A373] transition-colors" />
          </button>
          <button
            onClick={() => { setEditItem(item); setShowDetailDialog(true); }}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#6395C3]/10 transition-colors group/btn"
            title="查看"
          >
            <Eye size={14} className="text-[#8C959F] dark:text-[#8B949E] group-hover/btn:text-[#6395C3] transition-colors" />
          </button>
          <button
            onClick={() => { setEditItem(item); setShowDeleteConfirm(true); }}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#C27A63]/10 transition-colors group/btn"
            title="删除"
          >
            <Trash2 size={14} className="text-[#8C959F] dark:text-[#8B949E] group-hover/btn:text-[#C27A63] transition-colors" />
          </button>
        </div>
      );
    }
    if (key === 'type') {
      const val = item[key];
      return (
        <span
          className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
            val === '专任' || val === '专业课'
              ? 'bg-[#D4A373]/10 text-[#D4A373]'
              : val === '公共课'
              ? 'bg-[#6395C3]/10 text-[#6395C3]'
              : 'bg-[#6B9B8A]/10 text-[#6B9B8A]'
          }`}
        >
          {String(val ?? '-')}
        </span>
      );
    }
    if (key === 'teacher_type') {
      const val = item[key];
      const label = val === 'full_time' ? '专任' : val === 'part_time' ? '兼任' : String(val ?? '-');
      const colorClass = val === 'full_time'
        ? 'bg-[#D4A373]/10 text-[#D4A373]'
        : 'bg-[#6B9B8A]/10 text-[#6B9B8A]';
      return (
        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
          {label}
        </span>
      );
    }
    if (key === 'room_type') {
      const val = item[key];
      const label = val === 'regular' ? '普通' : val === 'lecture' ? '阶梯' : val === 'multimedia' ? '多媒体' : String(val ?? '-');
      const colorClass = val === 'lecture'
        ? 'bg-[#6B9B8A]/10 text-[#6B9B8A]'
        : 'bg-[#6395C3]/10 text-[#6395C3]';
      return (
        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
          {label}
        </span>
      );
    }
    if (key === 'course_type') {
      const val = item[key];
      const label = val === 'public' ? '公共课' : val === 'major' ? '专业课' : String(val ?? '-');
      const colorClass = val === 'public'
        ? 'bg-[#6395C3]/10 text-[#6395C3]'
        : 'bg-[#D4A373]/10 text-[#D4A373]';
      return (
        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
          {label}
        </span>
      );
    }
    if (key === 'needs_ab') {
      return <span className="text-[#8C959F] dark:text-[#8B949E]">{item[key] ? '是' : '否'}</span>;
    }
    if (key === 'schedule_status') {
      const val = item[key] as string;
      const label = val === 'unscheduled' ? '未排' : val === 'scheduled' ? '已排' : val === 'partial' ? '部分' : String(val ?? '-');
      const colorClass = val === 'scheduled'
        ? 'bg-green-100 text-green-700'
        : val === 'partial'
        ? 'bg-yellow-100 text-yellow-700'
        : 'bg-gray-100 text-gray-500';
      return (
        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
          {label}
        </span>
      );
    }
    if (key === 'is_active') {
      const val = item[key];
      const isActive = Boolean(val);
      return (
        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {isActive ? '启用' : '禁用'}
        </span>
      );
    }
    if (key === 'day_of_week') {
      const dayMap: Record<number, string> = {
        0: '全周', 1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五', 6: '周六', 7: '周日',
      };
      return dayMap[item[key] as number] ?? String(item[key] ?? '-');
    }
    if (key === 'created_at') {
      const val = item[key];
      if (!val) return '-';
      const date = new Date(val as string);
      return isNaN(date.getTime()) ? String(val) : date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    }
    return String(item[key] ?? '-');
  };

  // ── 渲染 ────────────────────────────────────────────────────
  return (
    <div className="page-container px-4 md:px-6">
      <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row gap-4 md:gap-5" style={{ minHeight: 'calc(100vh - 140px)' }}>
        {/* Left Sidebar */}
        <nav className="hidden md:block w-[200px] flex-shrink-0">
          <div className="glass-card rounded-3xl p-4 sticky top-24">
            <div className="px-3 py-2 mb-2">
              <h2 className="font-display text-base font-medium text-[#1F2328] dark:text-[#E6EDF3]">基础数据</h2>
              <p className="text-xs text-[#8C959F] dark:text-[#8B949E] mt-1">管理核心基础信息</p>
            </div>
            <div className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => handleTabChange(item.key)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 group ${
                      isActive
                        ? 'bg-[#D4A373]/10 text-[#D4A373]'
                        : 'text-[#8C959F] dark:text-[#8B949E] hover:bg-white/50 dark:bg-[#21262D]/70 hover:text-[#1F2328] dark:text-[#E6EDF3]'
                    }`}
                  >
                    {isActive && (
                      <span className="absolute left-0 w-1 h-5 rounded-r-full bg-[#D4A373]" />
                    )}
                    <Icon size={16} className={isActive ? 'text-[#D4A373]' : 'group-hover:text-[#D4A373] transition-colors'} />
                    <span>{item.label}</span>
                    {/* 从各 hook 实时获取 badge 数量 */}
                    <span className="ml-auto text-xs text-[#C8CDD3] dark:text-[#484F58]">
                      {badgeCounts[item.key] ?? '-'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <div className="glass-card rounded-3xl overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#F3F4F6] dark:border-[#30363D] flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="font-display text-lg font-medium text-[#1F2328] dark:text-[#E6EDF3]">
                  {navItems.find((n) => n.key === activeTab)?.label}管理
                </h2>
                <span className="text-xs text-[#8C959F] dark:text-[#8B949E] bg-[#F9FAFB] dark:bg-[#21262D] px-2.5 py-1 rounded-full">
                  {isFetching ? '加载中...' : `共 ${totalCount} 条记录`}
                </span>
              </div>
              <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (activeTab === 'courses') {
                    alert('课程管理暂不支持单独添加，请通过导入导出模块进行配置');
                    return;
                  }
                  setEditItem(null);
                  setShowEditDialog(true);
                }}
                className="btn-amber flex items-center gap-2 text-sm"
              >
                <Plus size={14} />
                新增
              </button>
                <button
                  onClick={handleRefresh}
                  className={`flex items-center gap-2 px-4 py-2 text-sm text-[#8C959F] dark:text-[#8B949E] hover:text-[#D4A373] bg-white/60 dark:bg-[#21262D]/80 hover:bg-[#D4A373]/5 rounded-xl transition-all ${isFetching ? 'animate-spin' : ''}`}
                >
                  <RefreshCw size={14} />
                  刷新
                </button>
              </div>
            </div>

            {/* Toolbar */}
            <div className="px-6 py-3 border-b border-[#F3F4F6] dark:border-[#30363D] flex items-center justify-between">
              <div className="relative flex-1 max-w-xs">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C8CDD3] dark:text-[#484F58]" />
                <input
                  type="text"
                  value={current.search}
                  onChange={(e) => { setTabState({ search: e.target.value, page: 1 }); }}
                  placeholder="搜索..."
                  className="form-input-glass pl-9 pr-4 py-2 rounded-xl text-sm w-full"
                />
              </div>
              <span className="text-xs text-[#8C959F] dark:text-[#8B949E]">
                已选择 {current.selected.length} 项
              </span>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="mx-6 mt-4 px-4 py-3 bg-[#C27A63]/10 border border-[#C27A63]/20 rounded-xl text-sm text-[#C27A63]">
                加载失败：{(error as Error).message}
              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#F9FAFB] dark:bg-[#21262D]/80">
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        checked={currentData.length > 0 && current.selected.length === currentData.length}
                        className="rounded border-[#C8CDD3] dark:border-[#484F58] text-[#D4A373] focus:ring-[#D4A373]/20"
                      />
                    </th>
                    {currentColumns.map((col) => (
                      <th
                        key={col.key}
                        className="px-4 py-3 text-left text-xs font-medium text-[#8C959F] dark:text-[#8B949E] uppercase tracking-wider"
                        style={col.width ? { width: col.width } : {}}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {isLoading ? (
                    // Loading Skeleton
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="data-table-row">
                        <td className="px-6 py-3.5">
                          <div className="h-4 w-4 bg-[#F3F4F6] dark:bg-[#30363D] rounded animate-pulse" />
                        </td>
                        {currentColumns.map((col) => (
                          <td key={col.key} className="px-4 py-3.5">
                            <div className="h-4 bg-[#F3F4F6] dark:bg-[#30363D] rounded animate-pulse" style={{ width: col.key === 'actions' ? '80px' : '120px' }} />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : currentData.length === 0 ? (
                    <tr>
                      <td colSpan={currentColumns.length + 1} className="px-6 py-12 text-center text-[#C8CDD3] dark:text-[#484F58]">
                        暂无数据
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map((item) => (
                      <tr
                        key={item.id as number}
                        className="data-table-row group/row"
                      >
                        <td className="px-6 py-3.5">
                          <input
                            type="checkbox"
                            checked={current.selected.includes(item.id as number)}
                            onChange={() => handleSelectRow(item.id as number)}
                            className="rounded border-[#C8CDD3] dark:border-[#484F58] text-[#D4A373] focus:ring-[#D4A373]/20"
                          />
                        </td>
                        {currentColumns.map((col) => (
                          <td
                            key={col.key}
                            className="px-4 py-3.5 text-sm text-[#1F2328] dark:text-[#E6EDF3]"
                          >
                            {renderCell(item, col.key)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination（始终显示，方便用户确认当前页码） */}
            {totalPages >= 1 && (
              <div className="px-6 py-4 border-t border-[#F3F4F6] dark:border-[#30363D] flex items-center justify-between">
                <span className="text-xs text-[#8C959F] dark:text-[#8B949E]">
                  显示 {(current.page - 1) * ITEMS_PER_PAGE + 1} -{' '}
                  {Math.min(current.page * ITEMS_PER_PAGE, totalCount)} / {totalCount}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setTabState({ page: Math.max(1, current.page - 1) })}
                    disabled={current.page === 1}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8C959F] dark:text-[#8B949E] hover:bg-[#F9FAFB] dark:bg-[#21262D] disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    // 只有 1 页时直接显示 [1]
                    if (totalPages === 1) {
                      return (
                        <button
                          key={1}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm bg-[#D4A373] text-white"
                        >
                          1
                        </button>
                      );
                    }
                    const page = totalPages <= 7
                      ? i + 1
                      : current.page <= 4
                      ? i + 1
                      : current.page >= totalPages - 3
                      ? totalPages - 6 + i
                      : current.page - 3 + i;
                    return (
                      <button
                        key={page}
                        onClick={() => setTabState({ page })}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all ${
                          page === current.page
                            ? 'bg-[#D4A373] text-white'
                            : 'text-[#8C959F] dark:text-[#8B949E] hover:bg-[#F9FAFB] dark:bg-[#21262D]'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setTabState({ page: Math.min(totalPages, current.page + 1) })}
                    disabled={current.page === totalPages}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8C959F] dark:text-[#8B949E] hover:bg-[#F9FAFB] dark:bg-[#21262D] disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Stats Panel */}
        <aside className="hidden md:block w-[200px] flex-shrink-0">
          <div className="glass-card rounded-3xl p-5 sticky top-24">
            <h3 className="font-display text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3] mb-4">
              统计信息
            </h3>
            <div className="space-y-4">
              {getStats().map((stat, index) => (
                <div key={index} className="group/stat">
                  <div className="text-xs text-[#8C959F] dark:text-[#8B949E] mb-1">{stat.label}</div>
                  <div className="font-display text-2xl font-semibold text-[#1F2328] dark:text-[#E6EDF3]">
                    {isLoading ? '-' : stat.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* Edit Dialog */}
      {showEditDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => { setShowEditDialog(false); setEditItem(null); }}
          />
          <div className="relative glass-card rounded-3xl p-6 w-[480px] max-w-[90vw] animate-in fade-in zoom-in-95 duration-200">
            <h3 className="font-display text-lg font-medium text-[#1F2328] dark:text-[#E6EDF3] mb-4">
              {editItem ? '编辑' : '新增'}{' '}
              {navItems.find((n) => n.key === activeTab)?.label}
            </h3>
            <div className="space-y-4">
              {/* 教师：姓名、类型、最大监考数 */}
              {activeTab === 'teachers' && (
                <>
                  <div>
                    <label className="block text-sm text-[#8C959F] dark:text-[#8B949E] mb-1.5">姓名</label>
                    <input
                      type="text"
                      id="edit-name"
                      className="form-input-glass rounded-xl w-full"
                      defaultValue={editItem ? String(editItem.name ?? '') : ''}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[#8C959F] dark:text-[#8B949E] mb-1.5">类型</label>
                    <select
                      id="edit-teacher-type"
                      className="form-input-glass rounded-xl w-full bg-transparent"
                      defaultValue={editItem ? (editItem.teacher_type === 'full_time' ? '专任' : '兼任') : '专任'}
                    >
                      <option value="专任">专任</option>
                      <option value="兼任">兼任</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-[#8C959F] dark:text-[#8B949E] mb-1.5">最大监考数</label>
                    <input
                      type="number"
                      id="edit-max-slots"
                      className="form-input-glass rounded-xl w-full"
                      defaultValue={editItem ? String(editItem.max_slots ?? 0) : '0'}
                    />
                  </div>
                </>
              )}
              {/* 教室：名称、容量、教学楼、楼层、类型 */}
              {activeTab === 'classrooms' && (
                <>
                  <div>
                    <label className="block text-sm text-[#8C959F] dark:text-[#8B949E] mb-1.5">名称</label>
                    <input
                      type="text"
                      id="edit-room-name"
                      className="form-input-glass rounded-xl w-full"
                      defaultValue={editItem ? String(editItem.name ?? '') : ''}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[#8C959F] dark:text-[#8B949E] mb-1.5">容量</label>
                    <input
                      type="number"
                      id="edit-room-capacity"
                      className="form-input-glass rounded-xl w-full"
                      defaultValue={editItem ? String(editItem.capacity ?? '') : ''}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[#8C959F] dark:text-[#8B949E] mb-1.5">教学楼</label>
                    <input
                      type="text"
                      id="edit-room-building"
                      className="form-input-glass rounded-xl w-full"
                      defaultValue={editItem ? String(editItem.building ?? '') : ''}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[#8C959F] dark:text-[#8B949E] mb-1.5">楼层</label>
                    <input
                      type="number"
                      id="edit-room-floor"
                      className="form-input-glass rounded-xl w-full"
                      defaultValue={editItem ? String(editItem.floor ?? '') : ''}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[#8C959F] dark:text-[#8B949E] mb-1.5">类型</label>
                    <select
                      id="edit-room-type"
                      className="form-input-glass rounded-xl w-full bg-transparent"
                      defaultValue={
                        editItem
                          ? (editItem.room_type === 'regular' ? '普通' : editItem.room_type === 'lecture' ? '阶梯' : '普通')
                          : '普通'
                      }
                    >
                      <option value="普通">普通</option>
                      <option value="阶梯">阶梯</option>
                    </select>
                  </div>
                </>
              )}
              {/* 课程：名称、类型、AB卷 */}
              {activeTab === 'courses' && (
                <>
                  <div>
                    <label className="block text-sm text-[#8C959F] dark:text-[#8B949E] mb-1.5">课程名称</label>
                    <input
                      type="text"
                      id="edit-course-name"
                      className="form-input-glass rounded-xl w-full"
                      defaultValue={editItem ? String(editItem.name ?? '') : ''}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[#8C959F] dark:text-[#8B949E] mb-1.5">类型</label>
                    <select
                      id="edit-course-type"
                      className="form-input-glass rounded-xl w-full bg-transparent"
                      defaultValue={editItem ? (editItem.course_type === 'public' ? '公共课' : '专业课') : '专业课'}
                    >
                      <option value="专业课">专业课</option>
                      <option value="公共课">公共课</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-[#8C959F] dark:text-[#8B949E] mb-1.5">AB卷</label>
                    <select
                      id="edit-course-ab"
                      className="form-input-glass rounded-xl w-full bg-transparent"
                      defaultValue={editItem ? (editItem.needs_ab ? '是' : '否') : '否'}
                    >
                      <option value="否">否</option>
                      <option value="是">是</option>
                    </select>
                  </div>
                </>
              )}
              {/* 专业：名称 */}
              {activeTab === 'majors' && (
                <>
                  <div>
                    <label className="block text-sm text-[#8C959F] dark:text-[#8B949E] mb-1.5">专业名称</label>
                    <input
                      type="text"
                      id="edit-major-name"
                      className="form-input-glass rounded-xl w-full"
                      defaultValue={editItem ? String(editItem.name ?? '') : ''}
                    />
                  </div>
                </>
              )}
              {/* 其他类型：动态生成输入框 */}
              {activeTab !== 'teachers' && activeTab !== 'classrooms' && activeTab !== 'courses' && activeTab !== 'majors' && currentColumns
                .filter((c) => c.key !== 'actions' && c.key !== 'id')
                .map((col) => (
                  <div key={col.key}>
                    <label className="block text-sm text-[#8C959F] dark:text-[#8B949E] mb-1.5">{col.label}</label>
                    <input
                      type="text"
                      id={`edit-${col.key}`}
                      className="form-input-glass rounded-xl w-full"
                      placeholder={`请输入${col.label}`}
                      defaultValue={editItem ? String(editItem[col.key] ?? '') : ''}
                    />
                  </div>
                ))}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowEditDialog(false); setEditItem(null); }}
                className="px-4 py-2 text-sm text-[#8C959F] dark:text-[#8B949E] hover:text-[#1F2328] dark:text-[#E6EDF3] transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => {
                  const isNew = !editItem?.id;
                  const payload: Record<string, unknown> = {};

                  // 教师：读取专用表单字段
                  if (activeTab === 'teachers') {
                    const nameInput = document.getElementById('edit-name') as HTMLInputElement;
                    const teacherTypeSelect = document.getElementById('edit-teacher-type') as HTMLSelectElement;
                    const maxSlotsInput = document.getElementById('edit-max-slots') as HTMLInputElement;
                    payload.name = nameInput?.value ?? '';
                    payload.teacher_type = teacherTypeSelect?.value ?? '专任';
                    payload.max_slots = Number(maxSlotsInput?.value ?? 0);
                  }

                  // 教室：读取专用表单字段（类型下拉需转换）
                  if (activeTab === 'classrooms') {
                    const nameInput = document.getElementById('edit-room-name') as HTMLInputElement;
                    const capacityInput = document.getElementById('edit-room-capacity') as HTMLInputElement;
                    const buildingInput = document.getElementById('edit-room-building') as HTMLInputElement;
                    const floorInput = document.getElementById('edit-room-floor') as HTMLInputElement;
                    const typeSelect = document.getElementById('edit-room-type') as HTMLSelectElement;
                    payload.name = nameInput?.value ?? '';
                    payload.capacity = Number(capacityInput?.value ?? 0);
                    payload.building = buildingInput?.value ?? '';
                    payload.floor = Number(floorInput?.value ?? 0);
                    // 类型：中文→后端枚举
                    payload.room_type = typeSelect?.value === '阶梯' ? 'lecture' : 'regular';
                  }

                  // 课程：读取专用表单字段（类型、AB卷需转换）
                  if (activeTab === 'courses') {
                    const nameInput = document.getElementById('edit-course-name') as HTMLInputElement;
                    const typeSelect = document.getElementById('edit-course-type') as HTMLSelectElement;
                    const abSelect = document.getElementById('edit-course-ab') as HTMLSelectElement;
                    payload.name = nameInput?.value ?? '';
                    payload.course_type = typeSelect?.value === '公共课' ? 'public' : 'major';
                    payload.needs_ab = abSelect?.value === '是';
                  }

                  // 专业：读取专用表单字段（只有名称）
                  if (activeTab === 'majors') {
                    const nameInput = document.getElementById('edit-major-name') as HTMLInputElement;
                    payload.name = nameInput?.value ?? '';
                  }

                  // 其他类型：从动态表单读取（input 已加上 id="edit-{key}"）
                  if (activeTab !== 'teachers' && activeTab !== 'classrooms' && activeTab !== 'courses' && activeTab !== 'majors') {
                    currentColumns
                      .filter((c) => c.key !== 'actions' && c.key !== 'id')
                      .forEach((col) => {
                        const input = document.getElementById(`edit-${col.key}`) as HTMLInputElement;
                        if (input) payload[col.key] = input.value;
                      });
                  }

                  if (isNew) {
                    // 新增模式
                    currentMutations.create.mutate(payload as any, {
                      onSuccess: () => {
                        setShowEditDialog(false);
                        setEditItem(null);
                      },
                    });
                  } else {
                    // 编辑模式
                    currentMutations.update.mutate(
                      { id: editItem.id as number, payload: payload },
                      {
                        onSuccess: () => {
                          setShowEditDialog(false);
                          setEditItem(null);
                        },
                      }
                    );
                  }
                }}
                disabled={currentMutations.create.isPending || currentMutations.update.isPending}
                className="btn-amber text-sm disabled:opacity-50"
              >
                {currentMutations.create.isPending || currentMutations.update.isPending ? '保存中...' : '确定'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Dialog — 教师接入 /exams 接口，其他仍用 mock */}
      {showDetailDialog && editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => { setShowDetailDialog(false); setEditItem(null); }}
          />
          <div className="relative glass-card rounded-3xl p-6 w-[1000px] max-w-full max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            {activeTab === 'teachers' && (
              <TeacherDetailContent teacherId={editItem.id as number} onClose={() => { setShowDetailDialog(false); setEditItem(null); }} />
            )}
            {activeTab === 'classrooms' && <ClassroomDetailDialog classroom={editItem} onClose={() => { setShowDetailDialog(false); setEditItem(null); }} />}
            {activeTab === 'courses' && <CourseDetailDialog course={editItem} onClose={() => { setShowDetailDialog(false); setEditItem(null); }} />}
            {activeTab === 'classes' && <ClassDetailDialog cls={editItem} onClose={() => { setShowDetailDialog(false); setEditItem(null); }} />}
            {activeTab === 'majors' && <MajorDetailDialog major={editItem} onClose={() => { setShowDetailDialog(false); setEditItem(null); }} />}
            {(activeTab === 'students' || activeTab === 'time-slots') && (
              <>
                  <h3 className="font-display text-lg font-medium text-[#1F2328] dark:text-[#E6EDF3] mb-4">
                    {String(editItem.name || editItem.student_id || editItem.code || '')} 详情
                  </h3>
                  <div className="space-y-2 text-sm text-[#8C959F] dark:text-[#8B949E]">
                    {Object.entries(editItem).filter(([k]) => k !== 'actions').map(([k, v]) => (
                      <div key={k} className="flex justify-between py-1 border-b border-[#F3F4F6] dark:border-[#30363D]">
                        <span>{k}</span>
                        <span className="text-[#1F2328] dark:text-[#E6EDF3]">{String(v ?? '-')}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end mt-4">
                    <button onClick={() => { setShowDetailDialog(false); setEditItem(null); }} className="px-4 py-2 text-sm text-[#8C959F] dark:text-[#8B949E]">关闭</button>
                  </div>
              </>
            )}
          </div>
        </div>
      )}
      {/* Delete Confirm Dialog */}
      {showDeleteConfirm && editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => { setShowDeleteConfirm(false); setEditItem(null); }}
          />
          <div className="relative glass-card rounded-3xl p-6 w-[400px] max-w-[90vw] animate-in fade-in zoom-in-95 duration-200 text-center">
            <div className="w-12 h-12 rounded-full bg-[#C27A63]/10 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={20} className="text-[#C27A63]" />
            </div>
            <h3 className="font-display text-lg font-medium text-[#1F2328] dark:text-[#E6EDF3] mb-2">确认删除？</h3>
            <p className="text-sm text-[#8C959F] dark:text-[#8B949E] mb-6">
              您即将删除 <span className="text-[#C27A63] font-medium">{String(editItem.name || editItem.student_id || editItem.code || '')}</span>，此操作不可撤销。
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => { setShowDeleteConfirm(false); setEditItem(null); }}
                className="px-5 py-2.5 text-sm text-[#8C959F] dark:text-[#8B949E] hover:text-[#1F2328] dark:text-[#E6EDF3] bg-white/60 dark:bg-[#21262D]/80 hover:bg-[#F9FAFB] dark:bg-[#21262D] rounded-xl transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={currentMutations.delete.isPending}
                className="px-5 py-2.5 text-sm text-white rounded-xl transition-colors disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #C27A63 0%, #B56A53 100%)' }}
              >
                {currentMutations.delete.isPending ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* ===================== Detail Dialog Components ===================== */

function DetailTable({ exams }: { exams: typeof examSchedules }) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="bg-[#F9FAFB] dark:bg-[#21262D]/80">
          <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">日期</th>
          <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">时段</th>
          <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">课程</th>
          <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">类型</th>
          <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">AB卷</th>
          <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">分配教室</th>
          <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">总人数</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[#F3F4F6]">
        {exams.length === 0 ? (
          <tr>
            <td colSpan={7} className="px-2 py-6 text-center text-[#C8CDD3] dark:text-[#484F58]">暂无安排</td>
          </tr>
        ) : (
          exams.map((e, i) => (
            <tr key={i} className="data-table-row">
              <td className="px-2 py-2 text-[#1F2328] dark:text-[#E6EDF3]">{e.date}</td>
              <td className="px-2 py-2 text-[#8C959F] dark:text-[#8B949E]">{e.timeSlot}</td>
              <td className="px-2 py-2 text-[#1F2328] dark:text-[#E6EDF3] font-medium">{e.courseName}</td>
              <td className="px-2 py-2">
                <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] ${e.courseType === '公共课' ? 'bg-[#6395C3]/10 text-[#6395C3]' : 'bg-[#D4A373]/10 text-[#D4A373]'}`}>
                  {e.courseType}
                </span>
              </td>
              <td className="px-2 py-2 text-[#8C959F] dark:text-[#8B949E]">{e.examPaper}</td>
              <td className="px-2 py-2 text-[#8C959F] dark:text-[#8B949E]">{e.classroomName}</td>
              <td className="px-2 py-2 text-[#1F2328] dark:text-[#E6EDF3]">{e.studentCount}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function ClassroomDetailDialog({ classroom, onClose }: { classroom: Record<string, unknown>; onClose: () => void }) {
  const classroomId = Number(classroom.id || 0);
  const name = String(classroom.name || '');
  const capacity = Number(classroom.capacity || 0);

  // 接入后端 API
  const [data, setData] = useState<{
    classroom_name: string;
    capacity: number;
    exam_count: number;
    exams: Array<{
      course_name: string;
      course_type: string;
      exam_paper: string;
      date: string;
      time_slot: string;
      total_students: number;
      classes_str: string;
      fixed_teachers_str: string;
    }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!classroomId) {
      setLoading(false);
      return;
    }
    apiClient.get<{ code: number; data: any }>(`/classrooms/${classroomId}/exams`)
      .then(res => setData(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [classroomId]);

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display text-lg font-medium text-[#1F2328] dark:text-[#E6EDF3]">加载中...</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F9FAFB] dark:bg-[#21262D]"><X size={16} className="text-[#8C959F]" /></button>
        </div>
        <div className="space-y-3 animate-pulse">
          {[1,2,3,4].map(i => <div key={i} className="h-16 bg-[#F3F4F6] dark:bg-[#30363D] rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display text-lg font-medium text-[#1F2328] dark:text-[#E6EDF3]">加载失败</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F9FAFB] dark:bg-[#21262D]"><X size={16} className="text-[#8C959F]" /></button>
        </div>
        <div className="text-sm text-[#8C959F]">无法获取考试安排</div>
      </div>
    );
  }

  const exams = data.exams || [];

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-display text-lg font-medium text-[#1F2328] dark:text-[#E6EDF3]">{data.classroom_name}</h3>
        <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F9FAFB] dark:bg-[#21262D]"><X size={16} className="text-[#8C959F] dark:text-[#8B949E]" /></button>
      </div>
      <div className="glass-card rounded-xl p-4 mb-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-[#D4A373]/10 flex items-center justify-center"><Building2 size={18} className="text-[#D4A373]" /></div>
        <div>
          <div className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3]">{data.classroom_name}</div>
          <div className="text-xs text-[#8C959F] dark:text-[#8B949E]">容量: {data.capacity} 人</div>
        </div>
      </div>
      <div className="glass-card rounded-2xl p-4">
        <h4 className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3] mb-3">考试安排 ({data.exam_count} 场)</h4>
        {exams.length === 0 ? (
          <p className="text-sm text-[#C8CDD3] dark:text-[#484F58] py-4 text-center">暂无考试安排。</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#F9FAFB] dark:bg-[#21262D]/80">
                <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">考试科目</th>
                <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">涉考班级</th>
                <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">考试人数</th>
                <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">时间</th>
                <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">监考教师</th>
                <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">AB卷</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {exams.map((e, i) => (
                <tr key={i} className="data-table-row">
                  <td className="px-2 py-2 text-[#1F2328] dark:text-[#E6EDF3] font-medium">{e.course_name}</td>
                  <td className="px-2 py-2 text-[#8C959F] dark:text-[#8B949E] max-w-[120px] truncate">{e.classes_str}</td>
                  <td className="px-2 py-2 text-[#1F2328] dark:text-[#E6EDF3]">{e.total_students}</td>
                  <td className="px-2 py-2 text-[#8C959F] dark:text-[#8B949E] whitespace-nowrap">{e.date} {e.time_slot}</td>
                  <td className="px-2 py-2 text-[#8C959F] dark:text-[#8B949E]">{e.fixed_teachers_str}</td>
                  <td className="px-2 py-2 text-[#8C959F] dark:text-[#8B949E]">{e.exam_paper}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function CourseDetailDialog({ course, onClose }: { course: Record<string, unknown>; onClose: () => void }) {
  const courseId = Number(course.id || 0);
  const [data, setData] = useState<{
    course_name: string;
    needs_ab: boolean;
    student_count: number;
    linked_class_count: number;
    linked_classes: Array<{
      class_id: number;
      class_name: string;
      grade: string;
      major_name: string;
      exams: Array<{
        date: string;
        time_slot: string;
        classroom_names: string;
        teachers_str: string;
        exam_paper: string;
      }>;
    }>;
    exam_count: number;
    exams: Array<{
      exam_id: number;
      date: string;
      time_slot: string;
      classroom_names: string;
      classes_str: string;
      total_students: number;
      teachers_str: string;
      exam_paper: string;
    }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [classesOpen, setClassesOpen] = useState(false);

  // 将 linked_classes 按 exams 展开成行，用于「关联班级」面板
  const classExamRows = useMemo(() => {
    const rows: Array<{
      class_id: number;
      class_name: string;
      exam: {
        date: string;
        time_slot: string;
        classroom_names: string;
        teachers_str: string;
        exam_paper: string;
      } | null;
      is_first: boolean;
      row_span: number;
    }> = [];
    const rowCount: Record<number, number> = {};

    (data?.linked_classes || []).forEach(c => {
      const exams = c.exams || [];
      rowCount[c.class_id] = exams.length || 1;
      if (exams.length === 0) {
        rows.push({
          class_id: c.class_id,
          class_name: c.class_name,
          exam: null,
          is_first: true,
          row_span: 1,
        });
      } else {
        exams.forEach((exam: any, idx: number) => {
          rows.push({
            class_id: c.class_id,
            class_name: c.class_name,
            exam,
            is_first: idx === 0,
            row_span: exams.length,
          });
        });
      }
    });
    return rows;
  }, [data?.linked_classes]);

  useEffect(() => {
    if (!courseId) { setLoading(false); return; }
    apiClient.get<{ code: number; data: any }>(`/courses/${courseId}/exams`)
      .then(res => setData(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [courseId]);

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display text-lg font-medium text-[#1F2328] dark:text-[#E6EDF3]">加载中...</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F9FAFB] dark:bg-[#21262D]"><X size={16} className="text-[#8C959F]" /></button>
        </div>
        <div className="space-y-3 animate-pulse">
          {[1,2,3,4].map(i => <div key={i} className="h-16 bg-[#F3F4F6] dark:bg-[#30363D] rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display text-lg font-medium text-[#1F2328] dark:text-[#E6EDF3]">加载失败</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F9FAFB] dark:bg-[#21262D]"><X size={16} className="text-[#8C959F]" /></button>
        </div>
        <div className="text-sm text-[#8C959F]">无法获取考试安排</div>
      </div>
    );
  }

  const exams = data.exams || [];

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-display text-lg font-medium text-[#1F2328] dark:text-[#E6EDF3]">{data.course_name}</h3>
        <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F9FAFB] dark:bg-[#21262D]"><X size={16} className="text-[#8C959F] dark:text-[#8B949E]" /></button>
      </div>
      <div className="glass-card rounded-xl p-4 mb-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-[#D4A373]/10 flex items-center justify-center"><BookOpen size={18} className="text-[#D4A373]" /></div>
        <div>
          <div className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3]">{data.course_name}</div>
          <div className="text-xs text-[#8C959F] dark:text-[#8B949E]">
            学生数: {data.student_count} 人 | 关联班级: {data.linked_class_count} 个 | AB卷: {data.needs_ab ? '是' : '否'}
          </div>
        </div>
      </div>
      {/* 关联班级 - 可折叠 */}
      <div className="glass-card rounded-2xl p-4 mb-4">
        <button
          onClick={() => setClassesOpen(!classesOpen)}
          className="flex items-center justify-between w-full text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3]"
        >
          <span>关联班级 ({data.linked_class_count} 个)</span>
          {classesOpen ? (
            <ChevronDown size={14} className="text-[#8C959F]" />
          ) : (
            <ChevronRight size={14} className="text-[#8C959F]" />
          )}
        </button>
        {classesOpen && (
          <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-[#E6EDF3] dark:border-[#30363D]">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#F9FAFB] dark:bg-[#21262D]/80">
                  <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">班级</th>
                  <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">考试时间</th>
                  <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">考试教室</th>
                  <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">监考老师</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {classExamRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-2 py-6 text-center text-[#C8CDD3] dark:text-[#484F58]">暂无班级数据</td>
                  </tr>
                ) : (
                  classExamRows.map((row, idx) => (
                    <tr key={idx} className="data-table-row">
                      {row.is_first && (
                        <td
                          className="px-2 py-2 text-[#1F2328] dark:text-[#E6EDF3] align-top"
                          rowSpan={row.row_span}
                        >
                          {row.class_name}
                        </td>
                      )}
                      <td className="px-2 py-2 text-[#8C959F] dark:text-[#8B949E]">
                        {row.exam ? `${row.exam.date} ${row.exam.time_slot}` : '-'}
                      </td>
                      <td className="px-2 py-2 text-[#8C959F] dark:text-[#8B949E]">
                        {row.exam ? row.exam.classroom_names : '-'}
                      </td>
                      <td className="px-2 py-2 text-[#8C959F] dark:text-[#8B949E]">
                        {row.exam ? row.exam.teachers_str : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="glass-card rounded-2xl p-4">
        <h4 className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3] mb-3">考试安排 ({data.exam_count} 场)</h4>
        {exams.length === 0 ? (
          <p className="text-sm text-[#C8CDD3] dark:text-[#484F58] py-4 text-center">暂无考试安排。</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#F9FAFB] dark:bg-[#21262D]/80">
                <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">时间</th>
                <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">教室</th>
                <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">涉考班级</th>
                <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">人数</th>
                <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">监考教师</th>
                <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">AB卷</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {exams.map((e, i) => (
                <tr key={i} className="data-table-row">
                  <td className="px-2 py-2 text-[#8C959F] dark:text-[#8B949E] whitespace-nowrap">{e.date} {e.time_slot}</td>
                  <td className="px-2 py-2 text-[#1F2328] dark:text-[#E6EDF3]">{e.classroom_names}</td>
                  <td className="px-2 py-2 text-[#8C959F] dark:text-[#8B949E] max-w-[120px] truncate">{e.classes_str}</td>
                  <td className="px-2 py-2 text-[#1F2328] dark:text-[#E6EDF3]">{e.total_students}</td>
                  <td className="px-2 py-2 text-[#8C959F] dark:text-[#8B949E]">{e.teachers_str}</td>
                  <td className="px-2 py-2 text-[#8C959F] dark:text-[#8B949E]">{e.exam_paper}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function ClassDetailDialog({ cls, onClose }: { cls: Record<string, unknown>; onClose: () => void }) {
  const name = String(cls.name || '');
  const studentCount = Number(cls.studentCount || 0);
  const classExams = examSchedules.filter((e) => e.classNames.some((cn) => name.includes(cn.split('级')[1]?.split('班')[0] ? name.split('班')[0] : name)));
  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-display text-lg font-medium text-[#1F2328] dark:text-[#E6EDF3]">{name}</h3>
        <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F9FAFB] dark:bg-[#21262D]"><X size={16} className="text-[#8C959F] dark:text-[#8B949E]" /></button>
      </div>
      <div className="glass-card rounded-xl p-4 mb-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-[#D4A373]/10 flex items-center justify-center"><GraduationCap size={18} className="text-[#D4A373]" /></div>
        <div>
          <div className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3]">{name}</div>
          <div className="text-xs text-[#8C959F] dark:text-[#8B949E]">班级人数: {studentCount} 人</div>
        </div>
      </div>
      <div className="glass-card rounded-2xl p-4">
        <h4 className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3] mb-3">考试安排 ({classExams.length} 场)</h4>
        {classExams.length === 0 ? (
          <p className="text-sm text-[#C8CDD3] dark:text-[#484F58] py-4 text-center">暂无考试安排。</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#F9FAFB] dark:bg-[#21262D]/80">
                <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">考试时间</th>
                <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">教室</th>
                <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">涉考人数</th>
                <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">监考教师</th>
                <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">人数</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {classExams.map((e, i) => (
                <tr key={i} className="data-table-row">
                  <td className="px-2 py-2 text-[#8C959F] dark:text-[#8B949E] whitespace-nowrap">{e.date} {e.timeSlot}</td>
                  <td className="px-2 py-2 text-[#1F2328] dark:text-[#E6EDF3]">{e.classroomName}</td>
                  <td className="px-2 py-2 text-[#1F2328] dark:text-[#E6EDF3]">{e.studentCount}</td>
                  <td className="px-2 py-2 text-[#8C959F] dark:text-[#8B949E]">{e.fixedTeachers.join(', ')}</td>
                  <td className="px-2 py-2 text-[#1F2328] dark:text-[#E6EDF3]">{e.studentCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function MajorDetailDialog({ major, onClose }: { major: Record<string, unknown>; onClose: () => void }) {
  const majorId = major.id as number;
  const name = String(major.name || '');

  // 调用后端 API 获取该专业下的班级列表（含考试数量）
  const [classesData, setClassesData] = useState<Array<{
    class_id: number;
    class_name: string;
    grade: number;
    student_count: number;
    exam_count: number;
  }> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    import('@/api/exams').then(({ getMajorClassesExamCounts }) => {
      getMajorClassesExamCounts(majorId)
        .then(res => setClassesData(res.classes))
        .catch(console.error)
        .finally(() => setIsLoading(false));
    });
  }, [majorId]);

  // 计算总人数和总班级数
  const totalStudents = classesData?.reduce((s, c) => s + (c.student_count ?? 0), 0) ?? 0;
  const totalClasses = classesData?.length ?? 0;
  const totalExams = classesData?.reduce((s, c) => s + (c.exam_count ?? 0), 0) ?? 0;

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-display text-lg font-medium text-[#1F2328] dark:text-[#E6EDF3]">{name}</h3>
        <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F9FAFB] dark:bg-[#21262D]"><X size={16} className="text-[#8C959F] dark:text-[#8B949E]" /></button>
      </div>
      <div className="glass-card rounded-xl p-4 mb-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-[#D4A373]/10 flex items-center justify-center"><Award size={18} className="text-[#D4A373]" /></div>
        <div>
          <div className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3]">{name}</div>
          <div className="text-xs text-[#8C959F] dark:text-[#8B949E]">
            班级: {totalClasses} 个 | 总人数: {totalStudents} 人 | 考试: {totalExams} 场
          </div>
        </div>
      </div>
      <div className="glass-card rounded-2xl p-4">
        <h4 className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3] mb-3">班级列表 ({totalClasses} 个)</h4>
        {isLoading ? (
          <div className="space-y-2 animate-pulse">
            {[1,2,3].map(i => <div key={i} className="h-12 bg-[#F3F4F6] dark:bg-[#30363D] rounded-lg" />)}
          </div>
        ) : totalClasses === 0 || !classesData ? (
          <p className="text-sm text-[#C8CDD3] dark:text-[#484F58] py-4 text-center">暂无班级数据。</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#F9FAFB] dark:bg-[#21262D]/80">
                <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">年级</th>
                <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">班级</th>
                <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">班级人数</th>
                <th className="px-2 py-2 text-left font-medium text-[#8C959F] dark:text-[#8B949E]">考试数量</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {classesData.map((cls, i) => {
                const gradeLabel = cls.grade === 1 ? '大一' : cls.grade === 2 ? '大二' : cls.grade === 3 ? '大三' : cls.grade === 4 ? '大四' : `${cls.grade}级`;
                return (
                  <tr key={i} className="data-table-row">
                    <td className="px-2 py-2 text-[#8C959F] dark:text-[#8B949E]">{gradeLabel}</td>
                    <td className="px-2 py-2 text-[#1F2328] dark:text-[#E6EDF3] font-medium">{cls.class_name}</td>
                    <td className="px-2 py-2 text-[#1F2328] dark:text-[#E6EDF3]">{cls.student_count} 人</td>
                    <td className="px-2 py-2 text-[#1F2328] dark:text-[#E6EDF3]">{cls.exam_count} 场</td>
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
