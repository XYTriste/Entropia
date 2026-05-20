import { useState, useRef, useEffect } from 'react';
import {
  Play,
  Settings,
  Cpu,
  Save,
  Square,
  CheckCircle2,
  Clock,
  BookOpen,
  Users,
  Building2,
  BarChart3,
  ChevronDown,
  Search,
  AlertTriangle,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import WaveProgress from '@/components/WaveProgress';
import RollingNumber from '@/components/RollingNumber';
import { getCourses } from '@/api/courses';
import { runScheduler, getSchedulerStatus, getSchedulerConfig, saveSchedulerConfig } from '@/api/scheduler';
import { useSchedulerStatus } from '@/hooks/useScheduler';
import type { Course, SchedulerConfig } from '@/types';

export default function SchedulerView() {
  // 排考配置状态
  const [config, setConfig] = useState({
    strategy: 'all' as 'all' | 'public_only' | 'major_only',
    fixedProctorsPerRoom: 1,
    maxSolveTime: 300,
    maxProctorDays: 3,
    noCrossDay: true,
  });
  const [selectedCourses, setSelectedCourses] = useState<number[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // 高级配置状态
  const [advancedConfig, setAdvancedConfig] = useState<{
    patrol_teacher_count_per_slot_pair: number;
    enable_max_days_constraint: boolean;
  }>({
    patrol_teacher_count_per_slot_pair: 2,
    enable_max_days_constraint: true,
  });

  // 获取课程列表
  const { data: coursesData, isLoading: coursesLoading } = useQuery({
    queryKey: ['courses', 'all'],
    queryFn: () => getCourses({ all: true, page_size: 1000 }),
  });

  // 获取排考配置
  const { data: serverConfig } = useQuery({
    queryKey: ['scheduler', 'config'],
    queryFn: getSchedulerConfig,
  });

  // 保存配置 mutation
  const saveConfigMutation = useMutation({
    mutationFn: (cfg: Partial<SchedulerConfig>) => saveSchedulerConfig(cfg as any),
    onSuccess: () => {
      toast.success('配置已保存');
    },
    onError: () => {
      toast.error('保存失败');
    },
  });

  // 轮询排考状态
  const { mutate: startPolling } = useSchedulerStatus(jobId || undefined, (status) => {
    if (status.status === 'running') {
      setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] 排考进行中...`]);
      setProgress((p) => Math.min(p + 10, 90));
    } else if (status.status === 'completed' || status.status === 'completed_with_violations') {
      setIsRunning(false);
      setShowResults(true);
      setProgress(100);
      if (status.result) {
        setLogs((prev) => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] 排考完成!`,
          `[${new Date().toLocaleTimeString()}] 已安排 ${status.result.exams_scheduled} 场考试`,
          `[${new Date().toLocaleTimeString()}] 耗时 ${status.result.solve_time}`,
        ]);
      }
    } else if (status.status === 'failed') {
      setIsRunning(false);
      setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] 排考失败: ${status.error}`]);
    }
  });

  // 当获取到服务器配置时，更新表单
  useEffect(() => {
    if (serverConfig) {
      setConfig((prev) => ({
        ...prev,
        fixedProctorsPerRoom: serverConfig.fixed_teachers_per_room || 1,
        maxProctorDays: serverConfig.max_days || 3,
        noCrossDay: serverConfig.enable_day_continuity_constraint ?? true,
      }));
      setAdvancedConfig({
        patrol_teacher_count_per_slot_pair: serverConfig.patrol_teacher_count_per_slot_pair || 2,
        enable_max_days_constraint: serverConfig.enable_max_days_constraint ?? true,
      });
    }
  }, [serverConfig]);

  // 转换后端数据为前端格式
  const courses: Course[] = (coursesData?.items || []).map((c) => ({
    ...c,
    // 后端 course_type (public/major) -> 前端 type (公共课/专业课)
    type: c.course_type === 'public' ? '公共课' : '专业课',
    // 后端 student_count -> 前端 studentCount
    studentCount: c.student_count || 0,
  }));

  // 已排考课程 ID 集合（基于 schedule_status）
  const scheduledCourseIds = new Set<number>(
    courses.filter((c) => c.schedule_status === 'scheduled').map((c) => c.id)
  );

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // 开始排考
  const runSchedulerMutation = useMutation({
    mutationFn: () => runScheduler({
      course_ids: selectedCourses,
      strategy: config.strategy === 'all' ? 'full' : config.strategy,
      fixed_proctors_per_room: config.fixedProctorsPerRoom as 1 | 2 | 3,
      enable_max_days_constraint: advancedConfig.enable_max_days_constraint,
      enable_day_continuity_constraint: config.noCrossDay,
      max_days: config.maxProctorDays,
    }),
    onSuccess: (data) => {
      setJobId(data.job_id);
      startPolling(data.job_id);
    },
    onError: (error: any) => {
      toast.error(error?.toast || '启动排考失败');
      setIsRunning(false);
    },
  });

  const handleStart = () => {
    if (selectedCourses.length === 0) {
      toast.warning('请先选择要排考的课程');
      return;
    }
    setIsRunning(true);
    setProgress(10);
    setLogs([[`${new Date().toLocaleTimeString()} 正在启动排考引擎...`]]);
    setShowResults(false);
    runSchedulerMutation.mutate();
  };

  const handleStop = () => {
    setIsRunning(false);
    setJobId(null);
    toast.info('排考已停止');
  };

  const handleSaveConfig = () => {
    saveConfigMutation.mutate({
      fixed_teachers_per_room: config.fixedProctorsPerRoom,
      patrol_teacher_count_per_slot_pair: advancedConfig.patrol_teacher_count_per_slot_pair,
      enable_max_days_constraint: advancedConfig.enable_max_days_constraint,
      enable_day_continuity_constraint: config.noCrossDay,
      max_days: config.maxProctorDays,
    });
  };

  const filteredCourses = courses.filter((c) =>
    c.name.toLowerCase().includes(filterText.toLowerCase()) ||
    c.code.toLowerCase().includes(filterText.toLowerCase())
  );

  const toggleCourse = (id: number) => {
    setSelectedCourses((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedCourses.length === filteredCourses.length) {
      setSelectedCourses([]);
    } else {
      setSelectedCourses(filteredCourses.map((c) => c.id));
    }
  };

  return (
    <div className="page-container px-4 md:px-6">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 md:mb-6 gap-3">
          <div className="flex items-center gap-3">
            <Cpu size={22} className="text-[#D4A373]" />
            <h1 className="font-display text-xl md:text-2xl font-semibold text-[#1F2328] dark:text-[#E6EDF3]">
              智能排考引擎
            </h1>
          </div>
          <span className="status-badge-info self-start sm:self-auto">
            <Settings size={12} />
            OR-Tools CP-SAT
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4 md:gap-6">
          {/* Left: Config Panel */}
          <div className="space-y-5">
            <div className="glass-card rounded-3xl p-6">
              <h2 className="font-display text-base font-medium text-[#1F2328] dark:text-[#E6EDF3] mb-5 flex items-center gap-2">
                <Settings size={16} className="text-[#D4A373]" />
                排考配置
              </h2>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm text-[#8C959F] dark:text-[#8B949E] mb-2">排考策略</label>
                  <div className="relative">
                    <select
                      value={config.strategy}
                      onChange={(e) => setConfig({ ...config, strategy: e.target.value })}
                      className="form-input-glass rounded-xl appearance-none w-full pr-10"
                    >
                      <option value="all">全部分配</option>
                      <option value="public_only">只分公共课</option>
                      <option value="major_only">只分专业课</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C8CDD3] dark:text-[#484F58] pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-[#8C959F] dark:text-[#8B949E] mb-2">每教室固定监考人数</label>
                  <div className="flex gap-3">
                    {[1, 2, 3].map((n) => (
                      <button
                        key={n}
                        onClick={() => setConfig({ ...config, fixedProctorsPerRoom: n })}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                          config.fixedProctorsPerRoom === n
                            ? 'bg-[#D4A373] text-white shadow-lg shadow-[#D4A373]/20'
                            : 'bg-white/60 dark:bg-[#21262D]/80 text-[#8C959F] dark:text-[#8B949E] hover:bg-[#D4A373]/10 hover:text-[#D4A373]'
                        }`}
                      >
                        {n} 人
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-[#8C959F] dark:text-[#8B949E] mb-2">最大求解时间 (秒)</label>
                  <input
                    type="number"
                    value={config.maxSolveTime}
                    onChange={(e) => setConfig({ ...config, maxSolveTime: Number(e.target.value) })}
                    className="form-input-glass rounded-xl w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm text-[#8C959F] dark:text-[#8B949E] mb-2">最大监考天数</label>
                  <div className="relative">
                    <select
                      value={config.maxProctorDays}
                      onChange={(e) => setConfig({ ...config, maxProctorDays: Number(e.target.value) })}
                      className="form-input-glass rounded-xl appearance-none w-full pr-10"
                    >
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>{n} 天</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C8CDD3] pointer-events-none" />
                  </div>
                </div>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={config.noCrossDay}
                      onChange={(e) => setConfig({ ...config, noCrossDay: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-[#E5E7EB] dark:bg-[#30363D] rounded-full peer transition-all peer-checked:bg-[#D4A373]" />
                    <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5" />
                  </div>
                  <span className="text-sm text-[#1F2328] dark:text-[#E6EDF3] group-hover:text-[#D4A373] transition-colors">
                    尽量不跨天排监考
                  </span>
                </label>

                {/* 高级配置折叠 */}
                <div className="border-t border-[#F3F4F6] dark:border-[#30363D] pt-4">
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center gap-2 text-sm text-[#8C959F] dark:text-[#8B949E] hover:text-[#D4A373] transition-colors"
                  >
                    <ChevronRight
                      size={14}
                      className={`transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
                    />
                    高级配置
                  </button>

                  {showAdvanced && (
                    <div className="mt-4 space-y-4 pl-4 border-l-2 border-[#D4A373]/20">
                      <div>
                        <label className="block text-sm text-[#8C959F] dark:text-[#8B949E] mb-2">
                          每时段对流动监考人数
                        </label>
                        <div className="relative">
                          <select
                            value={advancedConfig.patrol_teacher_count_per_slot_pair}
                            onChange={(e) => setAdvancedConfig({
                              ...advancedConfig,
                              patrol_teacher_count_per_slot_pair: Number(e.target.value),
                            })}
                            className="form-input-glass rounded-xl appearance-none w-full pr-10"
                          >
                            {[1, 2, 3, 4, 5].map((n) => (
                              <option key={n} value={n}>{n} 人</option>
                            ))}
                          </select>
                          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C8CDD3] pointer-events-none" />
                        </div>
                      </div>

                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={advancedConfig.enable_max_days_constraint}
                            onChange={(e) => setAdvancedConfig({
                              ...advancedConfig,
                              enable_max_days_constraint: e.target.checked,
                            })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-[#E5E7EB] dark:bg-[#30363D] rounded-full peer transition-all peer-checked:bg-[#D4A373]" />
                          <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5" />
                        </div>
                        <span className="text-sm text-[#1F2328] dark:text-[#E6EDF3] group-hover:text-[#D4A373] transition-colors">
                          启用最大监考天数约束
                        </span>
                      </label>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleSaveConfig}
                    disabled={saveConfigMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white/60 dark:bg-[#21262D]/80 hover:bg-[#D4A373]/10 text-[#8C959F] dark:text-[#8B949E] hover:text-[#D4A373] rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                  >
                    {saveConfigMutation.isPending ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Save size={14} />
                    )}
                    保存配置
                  </button>
                  <button
                    onClick={handleStart}
                    disabled={isRunning || selectedCourses.length === 0 || runSchedulerMutation.isPending}
                    className="flex-[2] btn-amber flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {runSchedulerMutation.isPending ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Play size={14} />
                    )}
                    {isRunning ? '排考进行中...' : '开始自动排考'}
                  </button>
                </div>
              </div>
            </div>

            {/* Progress Panel */}
            {(isRunning || showResults) && (
              <div className="glass-card rounded-3xl p-6 transition-all duration-500">
                <h2 className="font-display text-base font-medium text-[#1F2328] dark:text-[#E6EDF3] mb-4 flex items-center gap-2">
                  <Clock size={16} className="text-[#D4A373]" />
                  排考进度
                </h2>

                <WaveProgress progress={progress} width={380} height={50} />

                {/* Log Area */}
                <div
                  className="mt-4 bg-[#1F2328] rounded-2xl p-4 overflow-y-auto font-mono text-xs"
                  style={{ maxHeight: 200 }}
                >
                  {logs.map((log, i) => (
                    <div
                      key={i}
                      className={`mb-1 ${
                        log.includes('冲突') || log.includes('Error')
                          ? 'text-[#C27A63]'
                          : log.includes('完成')
                          ? 'text-[#6B9B8A]'
                          : 'text-[#8C959F] dark:text-[#8B949E]'
                      }`}
                    >
                      <span className="text-[#C8CDD3] dark:text-[#484F58]/50">{log.slice(0, 10)}</span>
                      <span className="ml-2">{log.slice(11)}</span>
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </div>

                {isRunning && (
                  <button
                    onClick={handleStop}
                    className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#C27A63]/10 hover:bg-[#C27A63]/20 text-[#C27A63] rounded-xl text-sm font-medium transition-all"
                  >
                    <Square size={14} />
                    停止排考
                  </button>
                )}

                {/* Result Card */}
                {showResults && !isRunning && (
                  <div className="mt-4 glass-card rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3]">排考任务结果</h3>
                      <span className="status-badge-success">
                        <CheckCircle2 size={12} />
                        已完成
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-[#F9FAFB] dark:bg-[#21262D] rounded-xl p-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#6B9B8A]/10 flex items-center justify-center">
                          <CheckCircle2 size={16} className="text-[#6B9B8A]" />
                        </div>
                        <div>
                          <div className="text-xs text-[#8C959F] dark:text-[#8B949E]">排考状态</div>
                          <div className="text-sm font-medium text-[#6B9B8A]">成功完成</div>
                        </div>
                      </div>

                      <div className="bg-[#F9FAFB] dark:bg-[#21262D] rounded-xl p-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#C27A63]/10 flex items-center justify-center">
                          <AlertTriangle size={16} className="text-[#C27A63]" />
                        </div>
                        <div>
                          <div className="text-xs text-[#8C959F] dark:text-[#8B949E]">冲突错误</div>
                          <div className="text-sm font-medium text-[#C27A63]">3 项冲突已自动修复</div>
                        </div>
                      </div>

                      <div className="bg-[#F9FAFB] dark:bg-[#21262D] rounded-xl p-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#6395C3]/10 flex items-center justify-center">
                          <Clock size={16} className="text-[#6395C3]" />
                        </div>
                        <div>
                          <div className="text-xs text-[#8C959F] dark:text-[#8B949E]">求解耗时</div>
                          <div className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3]">41.2 秒</div>
                        </div>
                      </div>

                      <div className="bg-[#F9FAFB] dark:bg-[#21262D] rounded-xl p-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#D4A373]/10 flex items-center justify-center">
                          <BarChart3 size={16} className="text-[#D4A373]" />
                        </div>
                        <div>
                          <div className="text-xs text-[#8C959F] dark:text-[#8B949E]">安排场次</div>
                          <div className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3]">156 / 156 场</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Course Selection + Results */}
          <div className="space-y-5">
            {/* Course Selection */}
            {!showResults && (
              <div className="glass-card rounded-3xl overflow-hidden flex flex-col" style={{ maxHeight: 600 }}>
                <div className="px-6 py-4 border-b border-[#F3F4F6] dark:border-[#30363D]">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-display text-base font-medium text-[#1F2328] dark:text-[#E6EDF3] flex items-center gap-2">
                      <BookOpen size={16} className="text-[#D4A373]" />
                      选择排考课程
                    </h2>
                    <span className="text-xs text-[#8C959F] dark:text-[#8B949E]">
                      已选 {selectedCourses.length} / {courses.length}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C8CDD3] dark:text-[#484F58]" />
                      <input
                        type="text"
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                        placeholder="搜索课程..."
                        className="form-input-glass pl-9 pr-4 py-2 rounded-xl text-sm w-full"
                      />
                    </div>
                    <button
                      onClick={toggleAll}
                      className="px-3 py-2 text-xs text-[#8C959F] dark:text-[#8B949E] hover:text-[#D4A373] bg-white/60 dark:bg-[#21262D]/80 hover:bg-[#D4A373]/5 rounded-xl transition-all"
                    >
                      {selectedCourses.length === filteredCourses.length ? '取消全选' : '全选'}
                    </button>
                  </div>
                </div>

                  <div className="flex-1 overflow-y-auto">
                    {coursesLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-[#D4A373]" />
                        <span className="ml-2 text-sm text-[#8C959F]">加载中...</span>
                      </div>
                    ) : (
                      <table className="w-full">
                        <tbody className="divide-y divide-[#F3F4F6]">
                          {filteredCourses.map((course) => (
                            <tr
                              key={course.id}
                              onClick={() => toggleCourse(course.id)}
                              className={`data-table-row cursor-pointer ${
                                selectedCourses.includes(course.id) ? 'bg-[#D4A373]/5' : ''
                              }`}
                            >
                              <td className="px-6 py-2.5 w-10">
                                <input
                                  type="checkbox"
                                  checked={selectedCourses.includes(course.id)}
                                  onChange={() => {}}
                                  className="rounded border-[#C8CDD3] dark:border-[#484F58] text-[#D4A373] focus:ring-[#D4A373]/20"
                                />
                              </td>
                              <td className="px-2 py-2.5 text-sm text-[#1F2328] dark:text-[#E6EDF3]">{course.name}</td>
                              <td className="px-2 py-2.5">
                                <span
                                  className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                    course.type === '公共课'
                                      ? 'bg-[#6395C3]/10 text-[#6395C3]'
                                      : 'bg-[#D4A373]/10 text-[#D4A373]'
                                  }`}
                                >
                                  {course.type}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-xs text-[#8C959F] dark:text-[#8B949E]">{course.studentCount}人</td>
                              <td className="px-4 py-2.5">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                  scheduledCourseIds.has(course.id)
                                    ? 'bg-[#6B9B8A]/10 text-[#6B9B8A]'
                                    : 'bg-[#C27A63]/10 text-[#C27A63]'
                                }`}>
                                  {scheduledCourseIds.has(course.id) ? '已排' : '未排'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
              </div>
            )}

            {/* Results Panel */}
            {showResults && (
              <div className="glass-card rounded-3xl p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-base font-medium text-[#1F2328] dark:text-[#E6EDF3] flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-[#6B9B8A]" />
                    排考结果
                  </h2>
                  <span className="status-badge-success">
                    <CheckCircle2 size={12} />
                    成功
                  </span>
                </div>

                {/* Result Stats */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: '已安排考试', value: 156, icon: BookOpen, color: '#D4A373' },
                    { label: '使用教室', value: 32, icon: Building2, color: '#6395C3' },
                    { label: '参与教师', value: 48, icon: Users, color: '#6B9B8A' },
                    { label: '流动监考组', value: 6, icon: BarChart3, color: '#9C81AF' },
                  ].map((stat, i) => {
                    const Icon = stat.icon;
                    return (
                      <div
                        key={i}
                        className="glass-card rounded-2xl p-4 flex items-center gap-3"
                      >
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: `${stat.color}12` }}
                        >
                          <Icon size={18} style={{ color: stat.color }} />
                        </div>
                        <div>
                          <div className="font-display text-xl font-semibold text-[#1F2328] dark:text-[#E6EDF3]">
                            <RollingNumber target={stat.value} />
                          </div>
                          <div className="text-xs text-[#8C959F] dark:text-[#8B949E]">{stat.label}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Result Actions */}
                <div className="flex gap-3">
                  <button className="flex-1 btn-amber text-sm flex items-center justify-center gap-2">
                    <BarChart3 size={14} />
                    查看详细结果
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white/60 dark:bg-[#21262D]/80 hover:bg-[#6B9B8A]/10 text-[#8C959F] dark:text-[#8B949E] hover:text-[#6B9B8A] rounded-xl text-sm font-medium transition-all">
                    <CheckCircle2 size={14} />
                    应用此版本
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
