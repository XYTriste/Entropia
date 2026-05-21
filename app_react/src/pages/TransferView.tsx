import { useState, useMemo, useEffect } from 'react';
import {
  SwitchCamera,
  Undo2,
  ChevronDown,
  Clock,
  MapPin,
  BookOpen,
  AlertCircle,
  CheckCircle2,
  GripVertical,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getTeachers, getTeacherExams } from '@/api/teachers';
import { swapExams, transferExam, batchTransfer, undoTransfer } from '@/api/transfer';

export default function TransferView() {
  const [teacherA, setTeacherA] = useState<number | ''>('');
  const [teacherB, setTeacherB] = useState<number | ''>('');
  const [transferType, setTransferType] = useState('swap');
  const [slotA, setSlotA] = useState<number | ''>('');
  const [slotB, setSlotB] = useState<number | ''>('');
  const [reason, setReason] = useState('');
  const [validationResult, setValidationResult] = useState<string | null>(null);
  const [showSameSlotDialog, setShowSameSlotDialog] = useState(false);
  const [operations, setOperations] = useState<Array<{
    id: string;
    type: string;
    from_teacher: string;
    to_teacher: string;
    exam_info: string;
    timestamp: string;
    status: string;
  }>>([]);
  const [dragSide, setDragSide] = useState<'left' | 'right' | null>(null);
  const [selectedExamIds, setSelectedExamIds] = useState<number[]>([]);  // 批量转移时的多选
  const queryClient = useQueryClient();  // 用于刷新数据

  // 获取教师列表
  const { data: teachersData } = useQuery({
    queryKey: ['teachers', 'all'],
    queryFn: () => getTeachers({ all: true }),
  });

  // 获取教师A的考试安排
  const { data: teacherAExamsData } = useQuery({
    queryKey: ['teacherExams', teacherA],
    queryFn: () => teacherA ? getTeacherExams(teacherA) : Promise.resolve(null),
    enabled: !!teacherA,
  });

  // 获取教师B的考试安排
  const { data: teacherBExamsData } = useQuery({
    queryKey: ['teacherExams', teacherB],
    queryFn: () => teacherB ? getTeacherExams(teacherB) : Promise.resolve(null),
    enabled: !!teacherB,
  });

  // 切换教师A或调剂类型时，清空选择
  useEffect(() => {
    setSelectedExamIds([]);
    setSlotA('');
  }, [teacherA, transferType]);

  // 切换教师B时，清空选择
  useEffect(() => {
    setSlotB('');
  }, [teacherB]);

  // 转换教师考试数据为显示格式
  const teacherAExams = useMemo(() => {
    if (!teacherAExamsData) return [];
    const schedules: Array<{
      examId: number;
      date: string;
      dateLabel?: string;
      examDate?: string;
      timeSlot: string;
      courseName: string;
      classroomName: string;
      examPaper: string;
      isPatrol: boolean;  // 是否流动监考
    }> = [];

    // 固定监考 - 使用 assigned_classroom（单教室）
    teacherAExamsData.fixed_exams?.forEach((exam: any) => {
      const dayName = exam.day_name || exam.date;
      const dateLabel = exam.date_label;
      schedules.push({
        examId: exam.exam_id,
        date: dateLabel ? `${dateLabel} ${dayName}` : dayName,
        dateLabel,
        examDate: exam.exam_date,
        timeSlot: exam.time_range || exam.time_slot,
        courseName: exam.course_name,
        classroomName: exam.assigned_classroom || '-',
        examPaper: exam.exam_paper || '-',
        isPatrol: false,
      });
    });

    // 流动监考 - 使用 classrooms 数组
    teacherAExamsData.patrol_exams?.forEach((exam: any) => {
      const dayName = exam.day_name || exam.date;
      const dateLabel = exam.date_label;
      // 流动监考显示所有教室
      const classrooms = exam.classrooms || [];
      if (classrooms.length > 0) {
        classrooms.forEach((room: any) => {
          schedules.push({
            examId: exam.exam_id,
            date: dateLabel ? `${dateLabel} ${dayName}` : dayName,
            dateLabel,
            examDate: exam.exam_date,
            timeSlot: exam.time_range || exam.time_slot,
            courseName: exam.course_name,
            classroomName: room.classroom_name || '-',
            examPaper: exam.exam_paper || '-',
            isPatrol: true,
          });
        });
      } else {
        schedules.push({
          examId: exam.exam_id,
          date: dateLabel ? `${dateLabel} ${dayName}` : dayName,
          dateLabel,
          examDate: exam.exam_date,
          timeSlot: exam.time_range || exam.time_slot,
          courseName: exam.course_name,
          classroomName: '-',
          examPaper: exam.exam_paper || '-',
          isPatrol: true,
        });
      }
    });

    return schedules;
  }, [teacherAExamsData]);

  const teacherBExams = useMemo(() => {
    if (!teacherBExamsData) return [];
    const schedules: Array<{
      examId: number;
      date: string;
      dateLabel?: string;
      examDate?: string;
      timeSlot: string;
      courseName: string;
      classroomName: string;
      examPaper: string;
      isPatrol: boolean;
    }> = [];

    // 固定监考 - 使用 assigned_classroom（单教室）
    teacherBExamsData.fixed_exams?.forEach((exam: any) => {
      const dayName = exam.day_name || exam.date;
      const dateLabel = exam.date_label;
      schedules.push({
        examId: exam.exam_id,
        date: dateLabel ? `${dateLabel} ${dayName}` : dayName,
        dateLabel,
        examDate: exam.exam_date,
        timeSlot: exam.time_range || exam.time_slot,
        courseName: exam.course_name,
        classroomName: exam.assigned_classroom || '-',
        examPaper: exam.exam_paper || '-',
        isPatrol: false,
      });
    });

    // 流动监考 - 使用 classrooms 数组
    teacherBExamsData.patrol_exams?.forEach((exam: any) => {
      const dayName = exam.day_name || exam.date;
      const dateLabel = exam.date_label;
      const classrooms = exam.classrooms || [];
      if (classrooms.length > 0) {
        classrooms.forEach((room: any) => {
          schedules.push({
            examId: exam.exam_id,
            date: dateLabel ? `${dateLabel} ${dayName}` : dayName,
            dateLabel,
            examDate: exam.exam_date,
            timeSlot: exam.time_range || exam.time_slot,
            courseName: exam.course_name,
            classroomName: room.classroom_name || '-',
            examPaper: exam.exam_paper || '-',
            isPatrol: true,
          });
        });
      } else {
        schedules.push({
          examId: exam.exam_id,
          date: dateLabel ? `${dateLabel} ${dayName}` : dayName,
          dateLabel,
          examDate: exam.exam_date,
          timeSlot: exam.time_range || exam.time_slot,
          courseName: exam.course_name,
          classroomName: '-',
          examPaper: exam.exam_paper || '-',
          isPatrol: true,
        });
      }
    });

    return schedules;
  }, [teacherBExamsData]);

  // 获取教师名称
  const getTeacherName = (teacherId: number) => {
    return teachersData?.items?.find(t => t.id === teacherId)?.name || '';
  };

  // 获取教师信息
  const getTeacherInfo = (teacherId: number | '') => {
    if (!teacherId || !teachersData?.items) return null;
    return teachersData.items.find(t => t.id === teacherId) || null;
  };

  // 获取 slot 对应的显示信息
  const getSlotDisplay = (examId: number, teacherId: number, isSlotA: boolean) => {
    const exams = isSlotA ? teacherAExams : teacherBExams;
    const exam = exams.find(e => e.examId === examId);
    if (!exam) return '';
    return `${exam.date} ${exam.timeSlot} - ${exam.courseName} - ${exam.classroomName}`;
  };

  // 刷新数据的函数
  const refreshData = () => {
    // 刷新教师列表（更新已安排场次数量）
    queryClient.invalidateQueries({ queryKey: ['teachers', 'all'] });
    // 刷新教师A的考试安排
    queryClient.invalidateQueries({ queryKey: ['teacherExams', teacherA] });
    // 刷新教师B的考试安排
    queryClient.invalidateQueries({ queryKey: ['teacherExams', teacherB] });
  };

  const handleExecute = async () => {
    if (!teacherA || !teacherB) {
      setValidationResult('请选择教师A和教师B');
      return;
    }

    if (transferType === 'swap') {
      if (!slotA || !slotB) {
        setValidationResult('请选择双方需要交换的场次');
        return;
      }
      // 检测是否同一日期同一时段
      const examA = teacherAExams.find(e => e.examId === slotA);
      const examB = teacherBExams.find(e => e.examId === slotB);
      if (examA && examB && examA.examDate && examB.examDate && examA.examDate === examB.examDate && examA.timeSlot === examB.timeSlot) {
        setShowSameSlotDialog(true);
        return;
      }
      try {
        await swapExams({
          teacher_a_id: teacherA as number,
          teacher_b_id: teacherB as number,
          exam_a_id: slotA as number,
          exam_b_id: slotB as number,
          reason: reason || '手动交换场次',
        });
        setValidationResult('交换成功！');
        setSlotA('');
        setSlotB('');
        refreshData();
      } catch (error: any) {
        setValidationResult(`交换失败: ${error.message || '未知错误'}`);
      }
    } else if (transferType === 'transfer') {
      if (!slotA) {
        setValidationResult('请选择需要转移的场次');
        return;
      }
      try {
        await transferExam({
          from_teacher_id: teacherA as number,
          to_teacher_id: teacherB as number,
          exam_id: slotA as number,
          reason: reason || '手动转移场次',
        });
        setValidationResult('转移成功！');
        setSlotA('');
        refreshData();
      } catch (error: any) {
        setValidationResult(`转移失败: ${error.message || '未知错误'}`);
      }
    } else if (transferType === 'batch-transfer') {
      if (selectedExamIds.length === 0) {
        setValidationResult('请选择需要转移的场次');
        return;
      }
      try {
        const result = await batchTransfer({
          from_teacher_id: teacherA as number,
          to_teacher_id: teacherB as number,
          reason: reason || '批量转移选中的场次',
          exam_ids: selectedExamIds,
        });
        setValidationResult(`批量转移成功！共转移 ${result.transferred_count} 个场次`);
        setSelectedExamIds([]);  // 清空选中状态
        refreshData();
      } catch (error: any) {
        setValidationResult(`批量转移失败: ${error.message || '未知错误'}`);
      }
    }
  };

  const handleDragStart = (side: 'left' | 'right') => {
    setDragSide(side);
  };

  const handleDrop = (targetSide: 'left' | 'right', examId: number) => {
    if (dragSide === 'left' && targetSide === 'right') {
      setSlotB(examId);
    } else if (dragSide === 'right' && targetSide === 'left') {
      setSlotA(examId);
    } else if (dragSide === targetSide) {
      if (targetSide === 'left') {
        setSlotA(examId);
      } else {
        setSlotB(examId);
      }
    }
    setDragSide(null);
  };

  return (
    <div className="page-container px-4 md:px-6">
      <div className="max-w-[1200px] mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 md:mb-6 gap-3">
          <h1 className="font-display text-xl md:text-2xl font-semibold text-[#1F2328] dark:text-[#E6EDF3]">教师调剂</h1>
          <button
            onClick={() => {
              if (operations.length > 0) {
                setOperations((prev) => prev.slice(0, -1));
              }
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/60 dark:bg-[#21262D]/80 hover:bg-[#C27A63]/10 text-[#8C959F] dark:text-[#8B949E] hover:text-[#C27A63] rounded-xl text-sm transition-all"
          >
            <Undo2 size={14} />
            撤销最近操作
          </button>
        </div>

        {/* Teacher Selection */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-4 md:mb-6">
          <div className="relative w-full sm:w-[200px]">
            <label className="block text-xs text-[#8C959F] dark:text-[#8B949E] mb-1.5">教师A (调出方)</label>
            <div className="relative">
              <select
                value={teacherA || 0}
                onChange={(e) => setTeacherA(Number(e.target.value) || '')}
                className="form-input-glass rounded-xl appearance-none w-full pr-10 text-sm"
              >
                <option value={0}>选择教师</option>
                {teachersData?.items?.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}({t.teacher_type === 'part_time' ? '兼任' : '专任'}, 已安排{t.current_slots}场)</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C8CDD3] dark:text-[#484F58] pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center justify-center pt-5">
            <div className="w-10 h-10 rounded-full bg-[#D4A373]/10 flex items-center justify-center">
              <SwitchCamera size={18} className="text-[#D4A373]" />
            </div>
          </div>

          <div className="relative w-full sm:w-[200px]">
            <label className="block text-xs text-[#8C959F] dark:text-[#8B949E] mb-1.5">教师B (调入方)</label>
            <div className="relative">
              <select
                value={teacherB || 0}
                onChange={(e) => setTeacherB(Number(e.target.value) || '')}
                className="form-input-glass rounded-xl appearance-none w-full pr-10 text-sm"
              >
                <option value={0}>选择教师</option>
                {teachersData?.items?.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}({t.teacher_type === 'part_time' ? '兼任' : '专任'}, 已安排{t.current_slots}场)</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C8CDD3] dark:text-[#484F58] pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Three Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
          {/* Left: Teacher A */}
          <div
            className="glass-card rounded-3xl overflow-hidden"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const data = e.dataTransfer.getData('text/plain');
              if (data) handleDrop('left', Number(data));
            }}
          >
            <div className="px-5 py-4 bg-[#C27A63]/5 border-b border-[#C27A63]/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-[#C27A63]" />
                <span className="text-sm font-medium text-[#C27A63]">
                  {getTeacherName(teacherA as number) || '教师A'} 监考场次/最大场次
                </span>
              </div>
              <span className="font-display text-lg font-semibold text-[#C27A63]">
                {getTeacherInfo(teacherA)?.current_slots || 0}/{getTeacherInfo(teacherA)?.max_slots || 0}
              </span>
            </div>
            <div className="p-4 overflow-y-auto" style={{ maxHeight: 450 }}>
              {teacherAExams.length === 0 ? (
                <div className="text-center py-8 text-[#C8CDD3] dark:text-[#484F58] text-sm">
                  请选择教师A
                </div>
              ) : (
                <div className="space-y-2">
                  {teacherAExams.map((exam, i) => {
                    const isSelected = selectedExamIds.includes(exam.examId);
                    const isActive = slotA === exam.examId;
                    const isBatchMode = transferType === 'batch-transfer';
                    const isPatrol = exam.isPatrol;  // 是否流动监考
                    
                    return (
                      <div
                        key={i}
                        draggable={!isBatchMode && !isPatrol}
                        onDragStart={!isBatchMode && !isPatrol ? (e) => {
                          e.dataTransfer.setData('text/plain', String(exam.examId));
                          handleDragStart('left');
                        } : undefined}
                        className={`p-3 rounded-xl transition-all ${
                          isPatrol
                            ? 'bg-[#F9FAFB] dark:bg-[#21262D] opacity-60 cursor-not-allowed border border-dashed border-[#C8CDD3] dark:border-[#484F58]'
                            : isBatchMode
                              ? isSelected
                                ? 'bg-[#C27A63]/10 border border-[#C27A63]/20 cursor-pointer'
                                : 'bg-[#F9FAFB] dark:bg-[#21262D] hover:bg-[#C27A63]/5 cursor-pointer'
                              : isActive
                                ? 'bg-[#C27A63]/10 border border-[#C27A63]/20'
                                : 'bg-[#F9FAFB] dark:bg-[#21262D] hover:bg-[#C27A63]/5 cursor-pointer'
                        }`}
                        onClick={() => {
                          if (isPatrol) return;  // 流动监考不可选择
                          if (isBatchMode) {
                            // 批量模式：切换选中状态
                            setSelectedExamIds(prev =>
                              prev.includes(exam.examId)
                                ? prev.filter(id => id !== exam.examId)
                                : [...prev, exam.examId]
                            );
                          } else {
                            setSlotA(exam.examId);
                          }
                        }}
                      >
                        <div className="flex items-center gap-2">
                          {isPatrol ? (
                            <span className="text-[10px] text-[#8C959F] dark:text-[#8B949E] flex-shrink-0">流动</span>
                          ) : isBatchMode ? (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="w-4 h-4 accent-[#C27A63] pointer-events-none"
                            />
                          ) : (
                            <GripVertical size={14} className="text-[#C8CDD3] dark:text-[#484F58] flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-xs text-[#8C959F] dark:text-[#8B949E] mb-1">
                              <Clock size={10} />
                              {exam.date} {exam.timeSlot}
                            </div>
                            <div className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3]">{exam.courseName}</div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-[#8C959F] dark:text-[#8B949E]">
                              <MapPin size={10} />
                              {exam.classroomName}
                              <BookOpen size={10} />
                              {exam.examPaper}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Center: Transfer Operations */}
          <div className="glass-card rounded-3xl overflow-hidden">
            <div className="px-5 py-4 bg-[#D4A373]/5 border-b border-[#D4A373]/10 flex items-center justify-center">
              <div className="flex items-center gap-2">
                <SwitchCamera size={16} className="text-[#D4A373]" />
                <span className="text-sm font-medium text-[#D4A373]">调剂操作</span>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-[#8C959F] dark:text-[#8B949E] mb-1.5">调剂类型</label>
                <div className="relative">
                  <select
                    value={transferType}
                    onChange={(e) => setTransferType(e.target.value)}
                    className="form-input-glass rounded-xl appearance-none w-full pr-10 text-sm"
                  >
                    <option value="swap">对调 (Swap)</option>
                    <option value="transfer">转移 (Transfer)</option>
                    <option value="batch-transfer">批量转移</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C8CDD3] dark:text-[#484F58] pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs text-[#8C959F] dark:text-[#8B949E] mb-1.5">
                  {transferType === 'batch-transfer' ? '选择A的场次（多选）' : '选择A的场次'}
                </label>
                <input
                  type="text"
                  value={
                    transferType === 'batch-transfer'
                      ? selectedExamIds.length > 0
                        ? `已选择 ${selectedExamIds.length} 场`
                        : ''
                      : slotA ? getSlotDisplay(slotA as number, teacherA as number, true) : ''
                  }
                  placeholder={
                    transferType === 'batch-transfer'
                      ? '点击左侧卡片多选场次'
                      : '点击左侧选择或拖拽场次'
                  }
                  className="form-input-glass rounded-xl w-full text-sm"
                  readOnly
                />
              </div>

              {transferType === 'swap' && (
                <div>
                  <label className="block text-xs text-[#8C959F] dark:text-[#8B949E] mb-1.5">选择B的场次</label>
                  <input
                    type="text"
                    value={slotB ? getSlotDisplay(slotB as number, teacherB as number, false) : ''}
                    placeholder="点击右侧选择或拖拽场次"
                    className="form-input-glass rounded-xl w-full text-sm"
                    readOnly
                  />
                </div>
              )}

              <div>
                <label className="block text-xs text-[#8C959F] dark:text-[#8B949E] mb-1.5">调剂原因</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="请输入调剂原因..."
                  rows={3}
                  className="form-input-glass rounded-xl w-full text-sm resize-none"
                />
              </div>

              {validationResult && (
                <div
                  className={`p-3 rounded-xl text-sm flex items-center gap-2 ${
                    validationResult.includes('成功')
                      ? 'bg-[#6B9B8A]/10 text-[#6B9B8A]'
                      : 'bg-[#C27A63]/10 text-[#C27A63]'
                  }`}
                >
                  {validationResult.includes('成功') ? (
                    <CheckCircle2 size={14} />
                  ) : (
                    <AlertCircle size={14} />
                  )}
                  {validationResult}
                </div>
              )}

              <button
                onClick={handleExecute}
                className="w-full btn-amber flex items-center justify-center gap-2"
              >
                <SwitchCamera size={14} />
                执行调剂
              </button>
            </div>
          </div>

          {/* Right: Teacher B */}
          <div
            className="glass-card rounded-3xl overflow-hidden"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const data = e.dataTransfer.getData('text/plain');
              if (data) handleDrop('right', Number(data));
            }}
          >
            <div className="px-5 py-4 bg-[#6B9B8A]/5 border-b border-[#6B9B8A]/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-[#6B9B8A]" />
                <span className="text-sm font-medium text-[#6B9B8A]">
                  {getTeacherName(teacherB as number) || '教师B'} 监考场次/最大场次
                </span>
              </div>
              <span className="font-display text-lg font-semibold text-[#6B9B8A]">
                {getTeacherInfo(teacherB)?.current_slots || 0}/{getTeacherInfo(teacherB)?.max_slots || 0}
              </span>
            </div>
            <div className="p-4 overflow-y-auto" style={{ maxHeight: 450 }}>
              {teacherBExams.length === 0 ? (
                <div className="text-center py-8 text-[#C8CDD3] dark:text-[#484F58] text-sm">
                  请选择教师B
                </div>
              ) : (
                <div className="space-y-2">
                  {teacherBExams.map((exam, i) => {
                    const isPatrol = exam.isPatrol;  // 是否流动监考
                    const isActive = slotB === exam.examId;
                    
                    return (
                      <div
                        key={i}
                        draggable={!isPatrol}
                        onDragStart={!isPatrol ? (e) => {
                          e.dataTransfer.setData('text/plain', String(exam.examId));
                          handleDragStart('right');
                        } : undefined}
                        className={`p-3 rounded-xl transition-all ${
                          isPatrol
                            ? 'bg-[#F9FAFB] dark:bg-[#21262D] opacity-60 cursor-not-allowed border border-dashed border-[#C8CDD3] dark:border-[#484F58]'
                            : isActive
                              ? 'bg-[#6B9B8A]/10 border border-[#6B9B8A]/20'
                              : 'bg-[#F9FAFB] dark:bg-[#21262D] hover:bg-[#6B9B8A]/5 cursor-pointer'
                        }`}
                        onClick={() => {
                          if (isPatrol) return;  // 流动监考不可选择
                          setSlotB(exam.examId);
                        }}
                      >
                        <div className="flex items-center gap-2">
                          {isPatrol ? (
                            <span className="text-[10px] text-[#8C959F] dark:text-[#8B949E] flex-shrink-0">流动</span>
                          ) : (
                            <GripVertical size={14} className="text-[#C8CDD3] dark:text-[#484F58] flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-xs text-[#8C959F] dark:text-[#8B949E] mb-1">
                              <Clock size={10} />
                              {exam.date} {exam.timeSlot}
                            </div>
                            <div className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3]">{exam.courseName}</div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-[#8C959F] dark:text-[#8B949E]">
                              <MapPin size={10} />
                              {exam.classroomName}
                              <BookOpen size={10} />
                              {exam.examPaper}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 同一时段冲突提示弹窗 */}
      {showSameSlotDialog && (() => {
        const examA = teacherAExams.find(e => e.examId === slotA);
        const examB = teacherBExams.find(e => e.examId === slotB);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowSameSlotDialog(false)} />
            <div className="relative glass-card rounded-3xl p-6 w-[480px] max-w-full animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#C27A63]/10 flex items-center justify-center">
                  <AlertCircle size={20} className="text-[#C27A63]" />
                </div>
                <h3 className="font-display text-lg font-medium text-[#1F2328] dark:text-[#E6EDF3]">
                  同一时段冲突
                </h3>
              </div>
              <p className="text-sm text-[#8C959F] dark:text-[#8B949E] mb-4">
                两位老师在同一日期同一时段已有监考安排，只能交换教室（考试科目和教室绑定）。
              </p>
              <div className="space-y-3 mb-4">
                <div className="p-3 bg-[#F9FAFB] dark:bg-[#21262D] rounded-xl">
                  <div className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3] mb-1">
                    {getTeacherName(teacherA as number)}
                  </div>
                  <div className="text-sm">
                    <span className="font-bold text-[#C27A63]">{examA?.date} {examA?.timeSlot}</span>
                    <span className="text-[#8C959F] dark:text-[#8B949E] ml-2">{examA?.courseName} — {examA?.classroomName}</span>
                  </div>
                </div>
                <div className="p-3 bg-[#F9FAFB] dark:bg-[#21262D] rounded-xl">
                  <div className="text-sm font-medium text-[#1F2328] dark:text-[#E6EDF3] mb-1">
                    {getTeacherName(teacherB as number)}
                  </div>
                  <div className="text-sm">
                    <span className="font-bold text-[#C27A63]">{examB?.date} {examB?.timeSlot}</span>
                    <span className="text-[#8C959F] dark:text-[#8B949E] ml-2">{examB?.courseName} — {examB?.classroomName}</span>
                  </div>
                </div>
              </div>
              <div className="p-3 bg-[#C27A63]/10 border border-[#C27A63]/20 rounded-xl text-sm text-[#C27A63] mb-5">
                <strong>提示：</strong>交换教室后，两位老师监考的科目也会随之交换（考试科目与教室绑定）。
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSameSlotDialog(false)}
                  className="flex-1 btn-secondary text-sm"
                >
                  取消
                </button>
                <button
                  onClick={async () => {
                    setShowSameSlotDialog(false);
                    try {
                      await swapExams({
                        teacher_a_id: teacherA as number,
                        teacher_b_id: teacherB as number,
                        exam_a_id: slotA as number,
                        exam_b_id: slotB as number,
                        reason: reason || '同一时段交换教室',
                      });
                      setValidationResult('交换成功！');
                      setSlotA('');
                      setSlotB('');
                      refreshData();
                    } catch (error: any) {
                      setValidationResult(`交换失败: ${error.message || '未知错误'}`);
                    }
                  }}
                  className="flex-1 btn-amber text-sm"
                >
                  确认交换教室
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
