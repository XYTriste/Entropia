import { useState } from 'react';
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
import { teachers, examSchedules, transferOperations } from '@/data/mock';

export default function TransferView() {
  const [teacherA, setTeacherA] = useState('');
  const [teacherB, setTeacherB] = useState('');
  const [transferType, setTransferType] = useState('swap');
  const [slotA, setSlotA] = useState('');
  const [slotB, setSlotB] = useState('');
  const [reason, setReason] = useState('');
  const [validationResult, setValidationResult] = useState<string | null>(null);
  const [operations, setOperations] = useState(transferOperations);
  const [dragSide, setDragSide] = useState<'left' | 'right' | null>(null);

  const teacherAExams = examSchedules.filter(
    (e) => e.fixedTeachers.includes(teacherA) || e.patrolTeachers.includes(teacherA)
  );
  const teacherBExams = examSchedules.filter(
    (e) => e.fixedTeachers.includes(teacherB) || e.patrolTeachers.includes(teacherB)
  );

  const handleExecute = () => {
    if (!teacherA || !teacherB || !slotA) {
      setValidationResult('请选择教师A、教师B和场次');
      return;
    }
    setValidationResult('验证通过！可以执行调剂');
  };

  const handleDragStart = (side: 'left' | 'right') => {
    setDragSide(side);
  };

  const handleDrop = (targetSide: 'left' | 'right', examKey: string) => {
    if (dragSide === 'left' && targetSide === 'right') {
      setSlotB(examKey);
    } else if (dragSide === 'right' && targetSide === 'left') {
      setSlotA(examKey);
    } else if (dragSide === targetSide) {
      if (targetSide === 'left') {
        setSlotA(examKey);
      } else {
        setSlotB(examKey);
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
                value={teacherA}
                onChange={(e) => setTeacherA(e.target.value)}
                className="form-input-glass rounded-xl appearance-none w-full pr-10 text-sm"
              >
                <option value="">选择教师</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.name}>{t.name} ({t.type})</option>
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
                value={teacherB}
                onChange={(e) => setTeacherB(e.target.value)}
                className="form-input-glass rounded-xl appearance-none w-full pr-10 text-sm"
              >
                <option value="">选择教师</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.name}>{t.name} ({t.type})</option>
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
              if (data) handleDrop('left', data);
            }}
          >
            <div className="px-5 py-4 bg-[#C27A63]/5 border-b border-[#C27A63]/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-[#C27A63]" />
                <span className="text-sm font-medium text-[#C27A63]">
                  {teacherA || '教师A'} 监考场次
                </span>
              </div>
              <span className="font-display text-lg font-semibold text-[#C27A63]">
                {teacherAExams.length}
              </span>
            </div>
            <div className="p-4 overflow-y-auto" style={{ maxHeight: 450 }}>
              {teacherAExams.length === 0 ? (
                <div className="text-center py-8 text-[#C8CDD3] dark:text-[#484F58] text-sm">
                  请选择教师A
                </div>
              ) : (
                <div className="space-y-2">
                  {teacherAExams.map((exam, i) => (
                    <div
                      key={i}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', `${exam.date} ${exam.timeSlot}`);
                        handleDragStart('left');
                      }}
                      className={`p-3 rounded-xl cursor-move transition-all ${
                        slotA === `${exam.date} ${exam.timeSlot}`
                          ? 'bg-[#C27A63]/10 border border-[#C27A63]/20'
                          : 'bg-[#F9FAFB] dark:bg-[#21262D] hover:bg-[#C27A63]/5'
                      }`}
                      onClick={() => setSlotA(`${exam.date} ${exam.timeSlot}`)}
                    >
                      <div className="flex items-center gap-2">
                        <GripVertical size={14} className="text-[#C8CDD3] dark:text-[#484F58] flex-shrink-0" />
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
                  ))}
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
                <label className="block text-xs text-[#8C959F] dark:text-[#8B949E] mb-1.5">选择A的场次</label>
                <input
                  type="text"
                  value={slotA}
                  onChange={(e) => setSlotA(e.target.value)}
                  placeholder="点击左侧选择或拖拽场次"
                  className="form-input-glass rounded-xl w-full text-sm"
                  readOnly
                />
              </div>

              {transferType === 'swap' && (
                <div>
                  <label className="block text-xs text-[#8C959F] dark:text-[#8B949E] mb-1.5">选择B的场次</label>
                  <input
                    type="text"
                    value={slotB}
                    onChange={(e) => setSlotB(e.target.value)}
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
                    validationResult.includes('通过')
                      ? 'bg-[#6B9B8A]/10 text-[#6B9B8A]'
                      : 'bg-[#C27A63]/10 text-[#C27A63]'
                  }`}
                >
                  {validationResult.includes('通过') ? (
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
              if (data) handleDrop('right', data);
            }}
          >
            <div className="px-5 py-4 bg-[#6B9B8A]/5 border-b border-[#6B9B8A]/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-[#6B9B8A]" />
                <span className="text-sm font-medium text-[#6B9B8A]">
                  {teacherB || '教师B'} 监考场次
                </span>
              </div>
              <span className="font-display text-lg font-semibold text-[#6B9B8A]">
                {teacherBExams.length}
              </span>
            </div>
            <div className="p-4 overflow-y-auto" style={{ maxHeight: 450 }}>
              {teacherBExams.length === 0 ? (
                <div className="text-center py-8 text-[#C8CDD3] dark:text-[#484F58] text-sm">
                  请选择教师B
                </div>
              ) : (
                <div className="space-y-2">
                  {teacherBExams.map((exam, i) => (
                    <div
                      key={i}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', `${exam.date} ${exam.timeSlot}`);
                        handleDragStart('right');
                      }}
                      className={`p-3 rounded-xl cursor-move transition-all ${
                        slotB === `${exam.date} ${exam.timeSlot}`
                          ? 'bg-[#6B9B8A]/10 border border-[#6B9B8A]/20'
                          : 'bg-[#F9FAFB] dark:bg-[#21262D] hover:bg-[#6B9B8A]/5'
                      }`}
                      onClick={() => setSlotB(`${exam.date} ${exam.timeSlot}`)}
                    >
                      <div className="flex items-center gap-2">
                        <GripVertical size={14} className="text-[#C8CDD3] dark:text-[#484F58] flex-shrink-0" />
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
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
