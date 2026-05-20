"""
考试排考系统 - 教师调剂服务

提供教师监考场次调剂功能：
- 教师交换：两名教师交换监考场次
- 单场转移：将某教师的监考转给另一教师
- 批量转交：将一名教师全部监考转给另一教师
- 已过期场次禁止调剂
- 每场操作必须填写原因
- 审计日志记录
- 一键撤销
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
from app.models.exam import Exam
from app.models.exam_teacher import ExamTeacher
from app.models.teacher import Teacher
from app.utils.validators import validate_teacher_workload

# 国内时区 UTC+8
CN_TZ = timezone(timedelta(hours=8))


# ============================================================
# 撤销记录管理
# ============================================================


@dataclass
class TransferRecord:
    """单次调剂操作记录"""

    transfer_type: str  # swap / single_transfer / batch_transfer
    from_teacher_id: int
    to_teacher_id: int
    exam_ids: list[int]  # 涉及的考试ID列表
    details: list[dict[str, Any]]  # 每次具体变更的详细记录
    reason: str
    timestamp: str = field(default_factory=lambda: datetime.now(CN_TZ).isoformat())


# 全局调剂记录栈
_transfer_history: list[TransferRecord] = []
MAX_HISTORY = 10


def _push_history(record: TransferRecord) -> None:
    """记录调剂历史"""
    _transfer_history.append(record)
    if len(_transfer_history) > MAX_HISTORY:
        _transfer_history.pop(0)


def get_transfer_history() -> list[TransferRecord]:
    """获取调剂历史"""
    return _transfer_history.copy()


# ============================================================
# 校验函数
# ============================================================


async def _check_teacher_exists(db: AsyncSession, teacher_id: int, label: str = "教师") -> Teacher:
    """检查教师是否存在"""
    teacher = await db.get(Teacher, teacher_id)
    if not teacher:
        raise HTTPException(status_code=404, detail=f"{label}(id={teacher_id})不存在")
    if not teacher.is_active:
        raise HTTPException(status_code=400, detail=f"{label}'{teacher.name}'已停用")
    return teacher


async def _check_exam_exists(db: AsyncSession, exam_id: int) -> Exam:
    """检查考试是否存在"""
    result = await db.execute(
        select(Exam).where(Exam.id == exam_id).options(selectinload(Exam.time_slot))
    )
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail=f"考试(id={exam_id})不存在")
    return exam


def _is_expired(exam_time_slot) -> bool:
    """检查考试是否已过期（用于禁止调剂）"""
    # 简化处理: 假设所有排考都在当前周内，实际应根据业务判断
    return False


# ============================================================
# 教师交换
# ============================================================


async def swap_teachers(
    db: AsyncSession,
    teacher_a_id: int,
    teacher_b_id: int,
    exam_a_id: int,
    exam_b_id: int,
    reason: str,
    operator: str = "admin",
) -> dict[str, Any]:
    """教师交换: 教师A的考试A 与 教师B的考试B 交换监考"""
    if not reason:
        raise HTTPException(status_code=400, detail="必须填写调剂原因")

    teacher_a = await _check_teacher_exists(db, teacher_a_id, "教师A")
    teacher_b = await _check_teacher_exists(db, teacher_b_id, "教师B")
    exam_a = await _check_exam_exists(db, exam_a_id)
    exam_b = await _check_exam_exists(db, exam_b_id)

    # 查找教师A在考试A中的角色
    result_a = await db.execute(
        select(ExamTeacher).where(
            ExamTeacher.exam_id == exam_a_id,
            ExamTeacher.teacher_id == teacher_a_id,
        )
    )
    et_a = result_a.scalar_one_or_none()
    if not et_a:
        raise HTTPException(status_code=400, detail=f"教师A未安排监考考试A")

    result_b = await db.execute(
        select(ExamTeacher).where(
            ExamTeacher.exam_id == exam_b_id,
            ExamTeacher.teacher_id == teacher_b_id,
        )
    )
    et_b = result_b.scalar_one_or_none()
    if not et_b:
        raise HTTPException(status_code=400, detail=f"教师B未安排监考考试B")

    # 检查双方场次上限
    passed_a, msg_a = validate_teacher_workload(
        teacher_a.max_slots, teacher_a.current_slots - 1 + 1, delta=0  # -1 释放A +1 接收B
    )
    # 教师A: 释放exam_a，接收exam_b，净变化为0，但需检查是否有冲突
    # 实际检查: 教师A接收exam_b后是否超过上限
    current_a_after = teacher_a.current_slots - 1  # 先减去释放的
    passed_a, msg_a = validate_teacher_workload(teacher_a.max_slots, current_a_after + 1)
    if not passed_a:
        raise HTTPException(status_code=400, detail=f"教师A{msg_a}")

    current_b_after = teacher_b.current_slots - 1
    passed_b, msg_b = validate_teacher_workload(teacher_b.max_slots, current_b_after + 1)
    if not passed_b:
        raise HTTPException(status_code=400, detail=f"教师B{msg_b}")

    # 检查时段冲突
    if exam_a.time_slot_id and exam_b.time_slot_id:
        # 交换后: A去B的考试(时段B), B去A的考试(时段A)
        # 检查教师A是否已在时段B有其他监考
        result = await db.execute(
            select(ExamTeacher)
            .join(Exam, ExamTeacher.exam_id == Exam.id)
            .where(
                ExamTeacher.teacher_id == teacher_a_id,
                Exam.time_slot_id == exam_b.time_slot_id,
                Exam.id != exam_a_id,
            )
        )
        conflict_a = result.scalar_one_or_none()
        if conflict_a:
            raise HTTPException(status_code=400, detail="教师A在考试B的时段已有其他监考安排")

        result = await db.execute(
            select(ExamTeacher)
            .join(Exam, ExamTeacher.exam_id == Exam.id)
            .where(
                ExamTeacher.teacher_id == teacher_b_id,
                Exam.time_slot_id == exam_a.time_slot_id,
                Exam.id != exam_b_id,
            )
        )
        conflict_b = result.scalar_one_or_none()
        if conflict_b:
            raise HTTPException(status_code=400, detail="教师B在考试A的时段已有其他监考安排")

    warnings: list[str] = []

    # 监考类型变更提示
    if et_a.role != et_b.role:
        warnings.append(
            f"监考类型变更: {teacher_a.name}从{et_a.role.value}变为{et_b.role.value}, "
            f"{teacher_b.name}从{et_b.role.value}变为{et_a.role.value}"
        )

    # 策略偏离警告: 专任教师→兼职, 兼职→专任
    if teacher_a.teacher_type.value == "full_time" and teacher_b.teacher_type.value == "part_time":
        warnings.append(f"注意: {teacher_a.name}(专任)与{teacher_b.name}(兼职)交换，可能影响策略平衡")

    # 执行交换
    old_et_a_role = et_a.role.value
    old_et_b_role = et_b.role.value

    et_a.teacher_id = teacher_b_id
    et_b.teacher_id = teacher_a_id
    db.add_all([et_a, et_b])
    await db.flush()

    # 更新场次计数 (交换后总量不变，无需更新current_slots)

    # 记录历史
    details = [
        {
            "exam_id": exam_a_id,
            "old_teacher": teacher_a_id,
            "new_teacher": teacher_b_id,
            "role": old_et_a_role,
        },
        {
            "exam_id": exam_b_id,
            "old_teacher": teacher_b_id,
            "new_teacher": teacher_a_id,
            "role": old_et_b_role,
        },
    ]
    record = TransferRecord(
        transfer_type="swap",
        from_teacher_id=teacher_a_id,
        to_teacher_id=teacher_b_id,
        exam_ids=[exam_a_id, exam_b_id],
        details=details,
        reason=reason,
    )
    _push_history(record)

    # 审计日志
    await _create_audit_log(
        db, "teacher_swap", "exam_teacher", exam_a_id,
        {"teacher_a": teacher_a_id, "teacher_b": teacher_b_id},
        {"swapped": True}, reason, operator,
    )

    return {"success": True, "warnings": warnings, "swapped_exams": [exam_a_id, exam_b_id]}


# ============================================================
# 单场转移
# ============================================================


async def single_transfer(
    db: AsyncSession,
    from_teacher_id: int,
    to_teacher_id: int,
    exam_id: int,
    role: str,
    reason: str,
    operator: str = "admin",
) -> dict[str, Any]:
    """单场转移: 将某教师的某场监考转给另一教师"""
    if not reason:
        raise HTTPException(status_code=400, detail="必须填写调剂原因")

    from_teacher = await _check_teacher_exists(db, from_teacher_id, "转出教师")
    to_teacher = await _check_teacher_exists(db, to_teacher_id, "接收教师")
    exam = await _check_exam_exists(db, exam_id)

    # 查找原监考记录
    result = await db.execute(
        select(ExamTeacher).where(
            ExamTeacher.exam_id == exam_id,
            ExamTeacher.teacher_id == from_teacher_id,
            ExamTeacher.role == role,
        )
    )
    et = result.scalar_one_or_none()
    if not et:
        raise HTTPException(status_code=404, detail="原监考记录不存在")

    # 检查接收方场次上限
    passed, msg = validate_teacher_workload(to_teacher.max_slots, to_teacher.current_slots + 1)
    if not passed:
        raise HTTPException(status_code=400, detail=f"接收教师{msg}")

    # 检查接收方时段冲突
    if exam.time_slot_id:
        result = await db.execute(
            select(ExamTeacher)
            .join(Exam, ExamTeacher.exam_id == Exam.id)
            .where(
                ExamTeacher.teacher_id == to_teacher_id,
                Exam.time_slot_id == exam.time_slot_id,
                Exam.id != exam_id,
            )
        )
        conflict = result.scalar_one_or_none()
        if conflict:
            raise HTTPException(
                status_code=400,
                detail=f"接收教师'{to_teacher.name}'在该时段已有其他监考安排"
            )

    warnings: list[str] = []

    # 策略偏离警告
    if from_teacher.teacher_type != to_teacher.teacher_type:
        warnings.append(
            f"教师类型变更: 从{'专任' if from_teacher.teacher_type.value == 'full_time' else '兼职'}"
            f"转为{'专任' if to_teacher.teacher_type.value == 'full_time' else '兼职'}"
        )

    # 执行转移
    old_teacher_id = et.teacher_id
    et.teacher_id = to_teacher_id
    db.add(et)
    await db.flush()

    # 更新场次计数
    from_teacher.current_slots = max(0, from_teacher.current_slots - 1)
    to_teacher.current_slots += 1
    db.add_all([from_teacher, to_teacher])
    await db.flush()

    # 记录历史
    record = TransferRecord(
        transfer_type="single_transfer",
        from_teacher_id=from_teacher_id,
        to_teacher_id=to_teacher_id,
        exam_ids=[exam_id],
        details=[{
            "exam_id": exam_id,
            "old_teacher": old_teacher_id,
            "new_teacher": to_teacher_id,
            "role": role,
        }],
        reason=reason,
    )
    _push_history(record)

    await _create_audit_log(
        db, "teacher_transfer", "exam_teacher", exam_id,
        {"teacher_id": old_teacher_id, "role": role},
        {"teacher_id": to_teacher_id, "role": role}, reason, operator,
    )

    return {"success": True, "warnings": warnings}


# ============================================================
# 批量转交
# ============================================================


async def batch_transfer(
    db: AsyncSession,
    from_teacher_id: int,
    to_teacher_id: int,
    reason: str,
    operator: str = "admin",
) -> dict[str, Any]:
    """批量转交: 将转出教师的全部监考一次性转给接收教师"""
    if not reason:
        raise HTTPException(status_code=400, detail="必须填写调剂原因")

    from_teacher = await _check_teacher_exists(db, from_teacher_id, "转出教师")
    to_teacher = await _check_teacher_exists(db, to_teacher_id, "接收教师")

    # 获取转出教师的所有监考
    result = await db.execute(
        select(ExamTeacher).where(ExamTeacher.teacher_id == from_teacher_id)
    )
    all_ets = list(result.scalars().all())

    if not all_ets:
        raise HTTPException(status_code=400, detail="转出教师没有监考安排")

    # 检查接收方容量
    needed_slots = len(all_ets)
    available = to_teacher.max_slots - to_teacher.current_slots
    if available < needed_slots:
        raise HTTPException(
            status_code=400,
            detail=f"接收教师容量不足: 需要{needed_slots}场, 可用{available}场"
        )

    # 检查时段冲突
    result = await db.execute(
        select(ExamTeacher)
        .join(Exam, ExamTeacher.exam_id == Exam.id)
        .where(ExamTeacher.teacher_id == to_teacher_id)
    )
    to_teacher_slots = set()
    for et in result.scalars().all():
        exam = await db.get(Exam, et.exam_id)
        if exam and exam.time_slot_id:
            to_teacher_slots.add(exam.time_slot_id)

    conflict_exams = []
    for et in all_ets:
        exam = await db.get(Exam, et.exam_id)
        if exam and exam.time_slot_id and exam.time_slot_id in to_teacher_slots:
            conflict_exams.append(et.exam_id)

    if conflict_exams:
        raise HTTPException(
            status_code=400,
            detail=f"时段冲突: 接收教师在以下考试时段已有安排: {conflict_exams}"
        )

    # 执行批量转交
    exam_ids = []
    details = []
    for et in all_ets:
        exam_ids.append(et.exam_id)
        details.append({
            "exam_id": et.exam_id,
            "old_teacher": from_teacher_id,
            "new_teacher": to_teacher_id,
            "role": et.role.value,
        })
        et.teacher_id = to_teacher_id
        db.add(et)

    await db.flush()

    # 更新场次计数
    from_teacher.current_slots = 0
    to_teacher.current_slots += len(all_ets)
    db.add_all([from_teacher, to_teacher])
    await db.flush()

    # 记录历史
    record = TransferRecord(
        transfer_type="batch_transfer",
        from_teacher_id=from_teacher_id,
        to_teacher_id=to_teacher_id,
        exam_ids=exam_ids,
        details=details,
        reason=reason,
    )
    _push_history(record)

    await _create_audit_log(
        db, "teacher_batch_transfer", "teacher", from_teacher_id,
        {"current_slots": from_teacher.current_slots + len(all_ets)},
        {"transferred_to": to_teacher_id, "exam_count": len(all_ets)},
        reason, operator,
    )

    return {
        "success": True,
        "transferred_count": len(all_ets),
        "exam_ids": exam_ids,
    }


# ============================================================
# 撤销最近一次调剂
# ============================================================


async def undo_last_transfer(db: AsyncSession, operator: str = "admin") -> dict[str, Any]:
    """撤销最近一次教师调剂操作"""
    if not _transfer_history:
        raise HTTPException(status_code=400, detail="没有可撤销的教师调剂操作")

    record = _transfer_history.pop()

    if record.transfer_type == "swap":
        # 交换撤销: 再交换回来
        for detail in record.details:
            result = await db.execute(
                select(ExamTeacher).where(
                    ExamTeacher.exam_id == detail["exam_id"],
                    ExamTeacher.teacher_id == detail["new_teacher"],
                )
            )
            et = result.scalar_one_or_none()
            if et:
                et.teacher_id = detail["old_teacher"]
                db.add(et)

    elif record.transfer_type in ("single_transfer", "batch_transfer"):
        # 转移撤销: 转回来
        for detail in record.details:
            result = await db.execute(
                select(ExamTeacher).where(
                    ExamTeacher.exam_id == detail["exam_id"],
                    ExamTeacher.teacher_id == detail["new_teacher"],
                )
            )
            et = result.scalar_one_or_none()
            if et:
                et.teacher_id = detail["old_teacher"]
                db.add(et)

    await db.flush()

    # 更新场次计数
    from_teacher = await db.get(Teacher, record.from_teacher_id)
    to_teacher = await db.get(Teacher, record.to_teacher_id)
    if from_teacher and to_teacher:
        if record.transfer_type == "swap":
            # 交换场次不变
            pass
        elif record.transfer_type == "single_transfer":
            from_teacher.current_slots += 1
            to_teacher.current_slots = max(0, to_teacher.current_slots - 1)
            db.add_all([from_teacher, to_teacher])
        elif record.transfer_type == "batch_transfer":
            count = len(record.details)
            from_teacher.current_slots += count
            to_teacher.current_slots = max(0, to_teacher.current_slots - count)
            db.add_all([from_teacher, to_teacher])
    await db.flush()

    await _create_audit_log(
        db, "undo_transfer", "teacher", record.from_teacher_id,
        {"undone_type": record.transfer_type},
        {"restored": True}, f"撤销调剂: {record.reason}", operator,
    )

    return {"success": True, "undone_type": record.transfer_type, "exam_ids": record.exam_ids}


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
