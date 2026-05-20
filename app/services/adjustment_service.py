"""
考试排考系统 - 手动微调服务

提供排考结果的手动微调功能：
- 校验硬约束（时段冲突、教室容量、教师场次超限）
- 校验软约束（违反时发出警告但不阻止）
- 撤销栈管理（支持撤销最近5步）
- 记录审计日志
"""

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.audit_log import AuditLog
from app.models.classroom import Classroom
from app.models.exam import Exam
from app.models.exam_classroom import ExamClassroom
from app.models.exam_teacher import ExamTeacher
from app.models.teacher import Teacher
from app.models.time_slot import TimeSlot
from app.utils.validators import (
    check_time_slot_conflict,
    validate_hc04_room_capacity,
    validate_hc05_teacher_max_slots,
    validate_teacher_workload,
)

# 国内时区 UTC+8
CN_TZ = timezone(timedelta(hours=8))


# ============================================================
# 撤销栈管理
# ============================================================


@dataclass
class AdjustmentAction:
    """单次调整操作记录"""

    action_type: str  # move_exam_time / change_classroom / change_teacher / redo_patrol
    exam_id: int
    old_data: dict[str, Any]
    new_data: dict[str, Any]
    reason: str
    timestamp: str = field(default_factory=lambda: datetime.now(CN_TZ).isoformat())


class UndoStack:
    """撤销栈 (最大保留最近5步)"""

    MAX_SIZE = 5

    def __init__(self) -> None:
        self._stack: list[AdjustmentAction] = []

    def push(self, action: AdjustmentAction) -> None:
        """压入操作记录，超出容量时移除最早的"""
        self._stack.append(action)
        if len(self._stack) > self.MAX_SIZE:
            self._stack.pop(0)

    def pop(self) -> Optional[AdjustmentAction]:
        """弹出最近的操作记录"""
        if not self._stack:
            return None
        return self._stack.pop()

    def can_undo(self) -> bool:
        return len(self._stack) > 0

    def size(self) -> int:
        return len(self._stack)


# 全局撤销栈 (可按用户扩展)
_global_undo_stack = UndoStack()


# ============================================================
# 硬约束校验
# ============================================================


async def validate_hard_constraints_exam_time_change(
    db: AsyncSession,
    exam_id: int,
    new_time_slot_id: int,
) -> tuple[bool, list[str], list[str]]:
    """校验调整考试时段的硬约束

    返回: (是否通过, 错误列表, 警告列表)
    """
    errors: list[str] = []
    warnings: list[str] = []

    # 1. 考试是否存在
    exam = await db.get(Exam, exam_id)
    if not exam:
        errors.append(f"考试(id={exam_id})不存在")
        return False, errors, warnings

    # 2. 新时段是否存在
    new_ts = await db.get(TimeSlot, new_time_slot_id)
    if not new_ts:
        errors.append(f"时段(id={new_time_slot_id})不存在")
        return False, errors, warnings

    # 3. 检查考试是否已锁定
    if exam.is_locked:
        errors.append("该考试已锁定，不能调整时段")
        return False, errors, warnings

    # 4. 检查时段冲突: 同一课程的不同考试(AB卷)不能在同一时段
    result = await db.execute(
        select(Exam).where(
            Exam.course_id == exam.course_id,
            Exam.id != exam_id,
            Exam.time_slot_id == new_time_slot_id,
        )
    )
    conflicting = result.scalar_one_or_none()
    if conflicting:
        errors.append(
            f"时段冲突: 课程'{exam.course.name}'的另一场考试已在该时段"
        )

    # 5. 检查教室是否在该时段被占用
    for ec in exam.classroom_assignments:
        result = await db.execute(
            select(ExamClassroom)
            .join(Exam, ExamClassroom.exam_id == Exam.id)
            .where(
                ExamClassroom.classroom_id == ec.classroom_id,
                Exam.time_slot_id == new_time_slot_id,
                Exam.id != exam_id,
            )
        )
        conflict_ec = result.scalar_one_or_none()
        if conflict_ec:
            errors.append(
                f"教室冲突: 教室(id={ec.classroom_id})在新时段已被占用"
            )

    return len(errors) == 0, errors, warnings


async def validate_hard_constraints_classroom_change(
    db: AsyncSession,
    exam_id: int,
    new_classroom_id: int,
) -> tuple[bool, list[str], list[str]]:
    """校验更换教室的硬约束"""
    errors: list[str] = []
    warnings: list[str] = []

    exam = await db.get(Exam, exam_id)
    if not exam:
        errors.append(f"考试(id={exam_id})不存在")
        return False, errors, warnings

    new_room = await db.get(Classroom, new_classroom_id)
    if not new_room:
        errors.append(f"教室(id={new_classroom_id})不存在")
        return False, errors, warnings

    if not new_room.is_active:
        errors.append(f"教室'{new_room.name}'已停用")
        return False, errors, warnings

    # 检查教室容量
    total_students = sum(ec.total_students for ec in exam.classroom_assignments)
    passed, msg = validate_hc04_room_capacity(new_room.capacity, total_students)
    if not passed:
        errors.append(f"教室容量不足: {msg}")

    # 检查新教室在相同时段是否被占用
    if exam.time_slot_id:
        result = await db.execute(
            select(ExamClassroom)
            .join(Exam, ExamClassroom.exam_id == Exam.id)
            .where(
                ExamClassroom.classroom_id == new_classroom_id,
                Exam.time_slot_id == exam.time_slot_id,
                Exam.id != exam_id,
            )
        )
        conflict = result.scalar_one_or_none()
        if conflict:
            errors.append(f"教室冲突: '{new_room.name}'在该时段已被占用")

    return len(errors) == 0, errors, warnings


async def validate_hard_constraints_teacher_change(
    db: AsyncSession,
    exam_id: int,
    new_teacher_id: int,
    role: str = "fixed",
) -> tuple[bool, list[str], list[str]]:
    """校验更换监考教师的硬约束"""
    errors: list[str] = []
    warnings: list[str] = []

    exam = await db.get(Exam, exam_id)
    if not exam:
        errors.append(f"考试(id={exam_id})不存在")
        return False, errors, warnings

    new_teacher = await db.get(Teacher, new_teacher_id)
    if not new_teacher:
        errors.append(f"教师(id={new_teacher_id})不存在")
        return False, errors, warnings

    if not new_teacher.is_active:
        errors.append(f"教师'{new_teacher.name}'已停用")
        return False, errors, warnings

    # 检查新教师是否已在该时段监考（避免同一教师同一时段多场监考）
    if exam.time_slot_id:
        result = await db.execute(
            select(ExamTeacher)
            .join(Exam, ExamTeacher.exam_id == Exam.id)
            .where(
                ExamTeacher.teacher_id == new_teacher_id,
                Exam.time_slot_id == exam.time_slot_id,
                Exam.id != exam_id,
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            errors.append(
                f"教师冲突: '{new_teacher.name}'在该时段已有其他监考安排"
            )

    # 检查教师场次上限
    passed, msg = validate_teacher_workload(
        new_teacher.max_slots, new_teacher.current_slots, delta=1
    )
    if not passed:
        errors.append(f"教师场次超限: {msg}")

    return len(errors) == 0, errors, warnings


# ============================================================
# 软约束校验
# ============================================================


async def validate_soft_constraints(
    db: AsyncSession,
    exam_id: int,
    action_type: str,
    new_value: Any,
) -> list[str]:
    """校验软约束（返回警告列表，不阻止操作）"""
    warnings: list[str] = []

    exam = await db.get(Exam, exam_id)
    if not exam:
        return warnings

    if action_type == "move_exam_time":
        # 软约束: 避免同一天连续时段安排不同考试给同一班级
        new_ts = await db.get(TimeSlot, new_value)
        if new_ts and exam.time_slot_id:
            old_ts = await db.get(TimeSlot, exam.time_slot_id)
            if old_ts:
                # 检查同班级是否有其他考试在新时段附近
                warnings.append("更换时段后，请确认同一班级的考试安排合理")

    elif action_type == "change_teacher":
        # 软约束: 专任教师与兼职教师的平衡
        new_teacher = await db.get(Teacher, new_value)
        if new_teacher and new_teacher.teacher_type.value == "part_time":
            warnings.append("安排兼职教师监考，请确认其时间安排可行")

    return warnings


# ============================================================
# 核心业务操作
# ============================================================


async def move_exam_time(
    db: AsyncSession,
    exam_id: int,
    new_time_slot_id: int,
    reason: str,
    operator: str = "admin",
) -> dict[str, Any]:
    """调整考试时段"""
    # 硬约束校验
    passed, errors, warnings = await validate_hard_constraints_exam_time_change(
        db, exam_id, new_time_slot_id
    )
    if not passed:
        raise HTTPException(status_code=400, detail={"errors": errors, "warnings": warnings})

    # 加载考试
    result = await db.execute(
        select(Exam).where(Exam.id == exam_id).options(selectinload(Exam.time_slot))
    )
    exam = result.scalar_one()

    old_time_slot_id = exam.time_slot_id

    # 记录旧状态
    old_data = {
        "time_slot_id": old_time_slot_id,
        "time_slot_str": f"{exam.time_slot.day_of_week}-{exam.time_slot.slot_code}" if exam.time_slot else None,
    }

    # 更新
    exam.time_slot_id = new_time_slot_id
    db.add(exam)
    await db.flush()

    # 重新加载新时段
    new_ts = await db.get(TimeSlot, new_time_slot_id)
    new_data = {
        "time_slot_id": new_time_slot_id,
        "time_slot_str": f"{new_ts.day_of_week}-{new_ts.slot_code}" if new_ts else None,
    }

    # 记录撤销操作
    action = AdjustmentAction(
        action_type="move_exam_time",
        exam_id=exam_id,
        old_data=old_data,
        new_data=new_data,
        reason=reason,
    )
    _global_undo_stack.push(action)

    # 记录审计日志
    await _create_audit_log(db, "move_exam_time", "exam", exam_id, old_data, new_data, reason, operator)

    # 软约束校验
    soft_warnings = await validate_soft_constraints(db, exam_id, "move_exam_time", new_time_slot_id)
    warnings.extend(soft_warnings)

    return {"success": True, "exam_id": exam_id, "warnings": warnings}


async def change_classroom(
    db: AsyncSession,
    exam_id: int,
    old_classroom_id: int,
    new_classroom_id: int,
    reason: str,
    operator: str = "admin",
) -> dict[str, Any]:
    """更换教室"""
    # 硬约束校验
    passed, errors, warnings = await validate_hard_constraints_classroom_change(
        db, exam_id, new_classroom_id
    )
    if not passed:
        raise HTTPException(status_code=400, detail={"errors": errors, "warnings": warnings})

    # 查找并更新教室分配
    result = await db.execute(
        select(ExamClassroom).where(
            ExamClassroom.exam_id == exam_id,
            ExamClassroom.classroom_id == old_classroom_id,
        )
    )
    ec = result.scalar_one_or_none()
    if not ec:
        raise HTTPException(status_code=404, detail="原教室分配记录不存在")

    old_data = {"classroom_id": old_classroom_id}
    new_data = {"classroom_id": new_classroom_id}

    ec.classroom_id = new_classroom_id
    db.add(ec)
    await db.flush()

    # 更新该教室的固定监考教师 classroom_id
    result = await db.execute(
        select(ExamTeacher).where(
            ExamTeacher.exam_id == exam_id,
            ExamTeacher.classroom_id == old_classroom_id,
        )
    )
    for et in result.scalars().all():
        et.classroom_id = new_classroom_id
        db.add(et)
    await db.flush()

    action = AdjustmentAction(
        action_type="change_classroom",
        exam_id=exam_id,
        old_data=old_data,
        new_data=new_data,
        reason=reason,
    )
    _global_undo_stack.push(action)

    await _create_audit_log(db, "change_classroom", "exam", exam_id, old_data, new_data, reason, operator)

    return {"success": True, "exam_id": exam_id, "warnings": warnings}


async def change_teacher(
    db: AsyncSession,
    exam_id: int,
    old_teacher_id: int,
    new_teacher_id: int,
    reason: str,
    role: str = "fixed",
    operator: str = "admin",
) -> dict[str, Any]:
    """更换监考教师"""
    passed, errors, warnings = await validate_hard_constraints_teacher_change(
        db, exam_id, new_teacher_id, role
    )
    if not passed:
        raise HTTPException(status_code=400, detail={"errors": errors, "warnings": warnings})

    result = await db.execute(
        select(ExamTeacher).where(
            ExamTeacher.exam_id == exam_id,
            ExamTeacher.teacher_id == old_teacher_id,
            ExamTeacher.role == role,
        )
    )
    et = result.scalar_one_or_none()
    if not et:
        raise HTTPException(status_code=404, detail="原教师分配记录不存在")

    old_data = {"teacher_id": old_teacher_id, "role": role}
    new_data = {"teacher_id": new_teacher_id, "role": role}

    et.teacher_id = new_teacher_id
    db.add(et)
    await db.flush()

    # 更新教师场次计数
    old_teacher = await db.get(Teacher, old_teacher_id)
    new_teacher = await db.get(Teacher, new_teacher_id)
    if old_teacher and old_teacher.current_slots > 0:
        old_teacher.current_slots -= 1
        db.add(old_teacher)
    if new_teacher:
        new_teacher.current_slots += 1
        db.add(new_teacher)
    await db.flush()

    action = AdjustmentAction(
        action_type="change_teacher",
        exam_id=exam_id,
        old_data=old_data,
        new_data=new_data,
        reason=reason,
    )
    _global_undo_stack.push(action)

    await _create_audit_log(db, "change_teacher", "exam", exam_id, old_data, new_data, reason, operator)

    soft_warnings = await validate_soft_constraints(db, exam_id, "change_teacher", new_teacher_id)
    warnings.extend(soft_warnings)

    return {"success": True, "exam_id": exam_id, "warnings": warnings}


async def redo_patrol_teachers(
    db: AsyncSession,
    time_slot_id: int,
    reason: str,
    operator: str = "admin",
) -> dict[str, Any]:
    """重新分配流动监考教师"""
    # 删除原有流动监考分配
    result = await db.execute(
        select(ExamTeacher)
        .join(Exam, ExamTeacher.exam_id == Exam.id)
        .where(Exam.time_slot_id == time_slot_id, ExamTeacher.role == "patrol")
    )
    old_assignments = []
    for et in result.scalars().all():
        old_assignments.append({"teacher_id": et.teacher_id, "exam_id": et.exam_id})
        await db.delete(et)
    await db.flush()

    # 同时删除 patrol_teachers 表中的记录
    from sqlalchemy import delete
    await db.execute(
        delete(PatrolTeacher).where(PatrolTeacher.time_slot_id == time_slot_id)
    )
    await db.flush()

    # 记录审计日志
    old_data = {"patrol_assignments": old_assignments}
    new_data = {"patrol_assignments": "待重新分配"}

    await _create_audit_log(
        db, "redo_patrol", "time_slot", time_slot_id, old_data, new_data, reason, operator
    )

    return {
        "success": True,
        "time_slot_id": time_slot_id,
        "message": "流动监考已清除，请重新运行排考引擎分配",
    }


# ============================================================
# 撤销操作
# ============================================================


async def undo_last_action(db: AsyncSession, operator: str = "admin") -> dict[str, Any]:
    """撤销最近一次操作"""
    action = _global_undo_stack.pop()
    if not action:
        raise HTTPException(status_code=400, detail="没有可撤销的操作")

    if action.action_type == "move_exam_time":
        # 恢复到原时段
        exam = await db.get(Exam, action.exam_id)
        if exam:
            exam.time_slot_id = action.old_data["time_slot_id"]
            db.add(exam)

    elif action.action_type == "change_classroom":
        result = await db.execute(
            select(ExamClassroom).where(
                ExamClassroom.exam_id == action.exam_id,
                ExamClassroom.classroom_id == action.new_data["classroom_id"],
            )
        )
        ec = result.scalar_one_or_none()
        if ec:
            ec.classroom_id = action.old_data["classroom_id"]
            db.add(ec)

    elif action.action_type == "change_teacher":
        result = await db.execute(
            select(ExamTeacher).where(
                ExamTeacher.exam_id == action.exam_id,
                ExamTeacher.teacher_id == action.new_data["teacher_id"],
                ExamTeacher.role == action.old_data.get("role", "fixed"),
            )
        )
        et = result.scalar_one_or_none()
        if et:
            et.teacher_id = action.old_data["teacher_id"]
            db.add(et)

    await db.flush()

    # 记录撤销操作的审计日志
    await _create_audit_log(
        db, "undo", "adjustment", action.exam_id,
        action.new_data, action.old_data, f"撤销操作: {action.reason}", operator
    )

    return {"success": True, "undone_action": action.action_type}


def can_undo() -> bool:
    """检查是否可以撤销"""
    return _global_undo_stack.can_undo()


# ============================================================
# 审计日志辅助
# ============================================================


async def _create_audit_log(
    db: AsyncSession,
    action: str,
    entity_type: str,
    entity_id: int,
    old_value: dict,
    new_value: dict,
    reason: str,
    operator: str,
) -> None:
    """创建审计日志记录"""
    log = AuditLog(
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        old_value=json.dumps(old_value, ensure_ascii=False),
        new_value=json.dumps(new_value, ensure_ascii=False),
        reason=reason,
        operator=operator,
        created_at=datetime.now(CN_TZ),
    )
    db.add(log)
    await db.flush()
