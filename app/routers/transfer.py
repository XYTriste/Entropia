"""
考试排考系统 - 教师调剂路由

提供教师监考场次调剂操作:
- 对调 (swap): 两个教师交换场次
- 转移 (transfer): 将单个场次从一个教师转移给另一个教师
- 批量转移 (batch): 将一个教师的所有场次转移给另一个教师
- 撤销 (undo): 撤销最近的调剂操作
- 历史 (history): 查询调剂历史记录
"""

from typing import Optional
from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.teacher import Teacher
from app.models.exam import Exam
from app.models.exam_teacher import ExamTeacher
from app.schemas.teacher import TeacherResponse

router = APIRouter()


# ---------- 辅助函数 ----------
async def check_time_slot_conflict(
    teacher_id: int,
    exam_id: int,
    db: AsyncSession,
    exclude_exam_ids: list = None,
) -> Optional[str]:
    """
    检查教师是否在指定考试的时段有其他安排
    返回冲突描述，无冲突返回 None
    exclude_exam_ids: 排除的考试ID列表（用于交换场景）
    """
    # 获取目标考试的时间槽
    result = await db.execute(
        select(Exam).where(Exam.id == exam_id).options(
            selectinload(Exam.time_slot)
        )
    )
    target_exam = result.scalar_one_or_none()
    if not target_exam or not target_exam.time_slot:
        return None
    
    target_slot_id = target_exam.time_slot_id
    
    # 检查该教师是否在同一时间槽有其他考试安排
    conditions = [
        ExamTeacher.teacher_id == teacher_id,
        Exam.time_slot_id == target_slot_id,
    ]
    if exclude_exam_ids:
        conditions.append(ExamTeacher.exam_id.notin_(exclude_exam_ids))
    else:
        conditions.append(ExamTeacher.exam_id != exam_id)  # 排除自身
    
    result = await db.execute(
        select(ExamTeacher)
        .join(Exam, ExamTeacher.exam_id == Exam.id)
        .where(*conditions)
        .options(selectinload(ExamTeacher.exam).selectinload(Exam.course))
    )
    conflicts = result.scalars().all()
    
    if conflicts:
        conflict_descs = []
        for ct in conflicts[:3]:  # 最多显示3个
            if ct.exam and ct.exam.course:
                conflict_descs.append(f"{ct.exam.course.name}({'固定' if ct.role.value == 'fixed' else '流动'})")
        if conflict_descs:
            return f"教师在同时段已有安排: {', '.join(conflict_descs)}"
    
    return None


# ---------- 交换场次 ----------
@router.post("/swap", response_model=dict)
async def swap_exams(
    payload: dict,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    交换两个教师的场次
    payload: { teacher_a_id, teacher_b_id, exam_a_id, exam_b_id, reason }
    """
    teacher_a_id = payload.get("teacher_a_id")
    teacher_b_id = payload.get("teacher_b_id")
    exam_a_id = payload.get("exam_a_id")
    exam_b_id = payload.get("exam_b_id")
    reason = payload.get("reason", "")

    if not all([teacher_a_id, teacher_b_id, exam_a_id, exam_b_id]):
        raise HTTPException(status_code=400, detail="缺少必需参数")

    # 验证教师存在
    result = await db.execute(
        select(Teacher).where(Teacher.id.in_([teacher_a_id, teacher_b_id]))
    )
    teachers = {t.id: t for t in result.scalars().all()}
    if len(teachers) < 2:
        raise HTTPException(status_code=404, detail="教师不存在")

    # 验证考试存在
    result = await db.execute(
        select(Exam).where(Exam.id.in_([exam_a_id, exam_b_id]))
    )
    exams = result.scalars().all()
    exam_ids_found = {e.id for e in exams}
    if exam_a_id not in exam_ids_found:
        raise HTTPException(status_code=404, detail=f"考试 {exam_a_id} 不存在")
    if exam_b_id not in exam_ids_found:
        raise HTTPException(status_code=404, detail=f"考试 {exam_b_id} 不存在")

    # 获取两条监考记录
    result = await db.execute(
        select(ExamTeacher)
        .where(ExamTeacher.teacher_id == teacher_a_id)
        .where(ExamTeacher.exam_id == exam_a_id)
    )
    record_a = result.scalar_one_or_none()
    if not record_a:
        raise HTTPException(status_code=404, detail="教师A的监考记录不存在")

    result = await db.execute(
        select(ExamTeacher)
        .where(ExamTeacher.teacher_id == teacher_b_id)
        .where(ExamTeacher.exam_id == exam_b_id)
    )
    record_b = result.scalar_one_or_none()
    if not record_b:
        raise HTTPException(status_code=404, detail="教师B的监考记录不存在")

    if exam_a_id == exam_b_id:
        # 同一场考试：只需交换 classroom_id，teacher_id 不变
        await db.execute(
            update(ExamTeacher)
            .where(ExamTeacher.teacher_id == teacher_a_id)
            .where(ExamTeacher.exam_id == exam_a_id)
            .values(classroom_id=record_b.classroom_id)
        )
        await db.execute(
            update(ExamTeacher)
            .where(ExamTeacher.teacher_id == teacher_b_id)
            .where(ExamTeacher.exam_id == exam_b_id)
            .values(classroom_id=record_a.classroom_id)
        )
    else:
        # 不同考试：先检查目标教师是否已在目标考试中有同角色安排
        result = await db.execute(
            select(ExamTeacher).where(
                (ExamTeacher.teacher_id == teacher_b_id)
                & (ExamTeacher.exam_id == exam_a_id)
                & (ExamTeacher.role == record_a.role)
            )
        )
        if result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="教师B已在目标考试中有同角色安排，无法交换")

        result = await db.execute(
            select(ExamTeacher).where(
                (ExamTeacher.teacher_id == teacher_a_id)
                & (ExamTeacher.exam_id == exam_b_id)
                & (ExamTeacher.role == record_b.role)
            )
        )
        if result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="教师A已在目标考试中有同角色安排，无法交换")

        # 时段冲突校验
        conflict_a = await check_time_slot_conflict(teacher_a_id, exam_b_id, db, exclude_exam_ids=[exam_a_id])
        if conflict_a:
            raise HTTPException(status_code=400, detail=f"教师A {conflict_a}，无法交换")

        conflict_b = await check_time_slot_conflict(teacher_b_id, exam_a_id, db, exclude_exam_ids=[exam_b_id])
        if conflict_b:
            raise HTTPException(status_code=400, detail=f"教师B {conflict_b}，无法交换")

        # 交换 teacher_id
        await db.execute(
            update(ExamTeacher)
            .where(ExamTeacher.teacher_id == teacher_a_id)
            .where(ExamTeacher.exam_id == exam_a_id)
            .values(teacher_id=teacher_b_id)
        )
        await db.execute(
            update(ExamTeacher)
            .where(ExamTeacher.teacher_id == teacher_b_id)
            .where(ExamTeacher.exam_id == exam_b_id)
            .values(teacher_id=teacher_a_id)
        )

    await db.commit()

    return {
        "code": 0,
        "message": "交换成功",
        "data": {
            "success": True,
            "message": "场次交换成功",
            "operation_id": str(uuid4()),
        },
    }


# ---------- 转移单个场次 ----------
@router.post("/transfer", response_model=dict)
async def transfer_exam(
    payload: dict,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    将单个场次从一个教师转移给另一个教师
    payload: { from_teacher_id, to_teacher_id, exam_id, reason }
    """
    from_teacher_id = payload.get("from_teacher_id")
    to_teacher_id = payload.get("to_teacher_id")
    exam_id = payload.get("exam_id")
    reason = payload.get("reason", "")

    if not all([from_teacher_id, to_teacher_id, exam_id]):
        raise HTTPException(status_code=400, detail="缺少必需参数")

    # 验证教师存在
    result = await db.execute(
        select(Teacher).where(Teacher.id.in_([from_teacher_id, to_teacher_id]))
    )
    teachers = {t.id: t for t in result.scalars().all()}
    if len(teachers) < 2:
        raise HTTPException(status_code=404, detail="教师不存在")

    # 验证考试存在
    result = await db.execute(select(Exam).where(Exam.id == exam_id))
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="考试不存在")

    # 时段冲突校验
    conflict = await check_time_slot_conflict(to_teacher_id, exam_id, db)
    if conflict:
        raise HTTPException(status_code=400, detail=f"目标教师 {conflict}，无法转移")

    # 检查目标教师是否已达到 max_slots
    to_teacher = teachers[to_teacher_id]
    if to_teacher.current_slots >= to_teacher.max_slots:
        raise HTTPException(
            status_code=400,
            detail=f"目标教师 {to_teacher.name} 已达到最大监考场次限制 ({to_teacher.max_slots})",
        )

    # 转移：更新 ExamTeacher 记录
    result = await db.execute(
        update(ExamTeacher)
        .where(ExamTeacher.teacher_id == from_teacher_id)
        .where(ExamTeacher.exam_id == exam_id)
        .values(teacher_id=to_teacher_id)
    )

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="未找到该教师的场次记录")

    # 更新教师的 current_slots
    await db.execute(
        update(Teacher)
        .where(Teacher.id == from_teacher_id)
        .values(current_slots=Teacher.current_slots - result.rowcount)
    )
    await db.execute(
        update(Teacher)
        .where(Teacher.id == to_teacher_id)
        .values(current_slots=Teacher.current_slots + result.rowcount)
    )

    await db.commit()

    return {
        "code": 0,
        "message": "转移成功",
        "data": {
            "success": True,
            "message": "场次转移成功",
            "operation_id": str(uuid4()),
        },
    }


# ---------- 批量转移 ----------
@router.post("/batch", response_model=dict)
async def batch_transfer(
    payload: dict,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    批量转移教师的场次给另一个教师
    payload: { from_teacher_id, to_teacher_id, reason, exam_ids? }
    - 如果提供 exam_ids，只转移指定的场次
    - 如果不提供 exam_ids，转移该教师的所有场次
    """
    from_teacher_id = payload.get("from_teacher_id")
    to_teacher_id = payload.get("to_teacher_id")
    reason = payload.get("reason", "")
    exam_ids = payload.get("exam_ids", [])  # 可选的指定考试ID列表

    if not all([from_teacher_id, to_teacher_id]):
        raise HTTPException(status_code=400, detail="缺少必需参数")

    if from_teacher_id == to_teacher_id:
        raise HTTPException(status_code=400, detail="不能转移到同一个教师")

    # 验证教师存在
    result = await db.execute(
        select(Teacher).where(Teacher.id.in_([from_teacher_id, to_teacher_id]))
    )
    teachers = {t.id: t for t in result.scalars().all()}
    if len(teachers) < 2:
        raise HTTPException(status_code=404, detail="教师不存在")

    from_teacher = teachers[from_teacher_id]
    to_teacher = teachers[to_teacher_id]

    # 构建查询条件
    where_conditions = [ExamTeacher.teacher_id == from_teacher_id]
    if exam_ids and len(exam_ids) > 0:
        where_conditions.append(ExamTeacher.exam_id.in_(exam_ids))

    # 查询要转移的场次数量
    result = await db.execute(
        select(ExamTeacher).where(*where_conditions)
    )
    exams_to_transfer = result.scalars().all()
    transfer_count = len(exams_to_transfer)

    if transfer_count == 0:
        return {
            "code": 0,
            "message": "无需转移",
            "data": {
                "success": True,
                "message": "没有可转移的场次",
                "transferred_count": 0,
                "operation_id": str(uuid4()),
            },
        }

    # 检查目标教师容量
    available_slots = to_teacher.max_slots - to_teacher.current_slots
    if transfer_count > available_slots:
        raise HTTPException(
            status_code=400,
            detail=f"目标教师 {to_teacher.name} 剩余容量不足"
                     f"（需要 {transfer_count} 场，剩余 {available_slots} 场）",
        )

    # 时段冲突校验：检查目标教师是否在要转移的考试的时段有其他安排
    if exam_ids and len(exam_ids) > 0:
        # 获取要转移的考试的 time_slot_id
        result = await db.execute(
            select(Exam.time_slot_id).where(Exam.id.in_(exam_ids))
        )
        time_slot_ids = [row[0] for row in result.all() if row[0]]
        
        if time_slot_ids:
            # 检查目标教师在这些时段是否有其他安排
            result = await db.execute(
                select(ExamTeacher)
                .join(Exam, ExamTeacher.exam_id == Exam.id)
                .where(
                    ExamTeacher.teacher_id == to_teacher_id,
                    Exam.time_slot_id.in_(time_slot_ids),
                    # 排除正在转移的考试
                    ExamTeacher.exam_id.in_(
                        select(ExamTeacher.exam_id).where(
                            ExamTeacher.teacher_id == from_teacher_id,
                            ExamTeacher.exam_id.in_(exam_ids)
                        ).subquery().select()
                    )
                )
                .options(selectinload(ExamTeacher.exam).selectinload(Exam.course))
            )
            conflicts = result.scalars().all()
            if conflicts:
                conflict_descs = []
                for ct in conflicts[:3]:
                    if ct.exam and ct.exam.course:
                        conflict_descs.append(f"{ct.exam.course.name}({'固定' if ct.role.value == 'fixed' else '流动'})")
                if conflict_descs:
                    raise HTTPException(
                        status_code=400,
                        detail=f"目标教师 {to_teacher.name} 在同时段已有安排: {', '.join(conflict_descs)}，无法转移"
                    )

    # 批量转移
    result = await db.execute(
        update(ExamTeacher)
        .where(*where_conditions)
        .values(teacher_id=to_teacher_id)
    )
    transferred_count = result.rowcount

    # 更新教师的 current_slots
    await db.execute(
        update(Teacher)
        .where(Teacher.id == from_teacher_id)
        .values(current_slots=Teacher.current_slots - transferred_count)
    )
    await db.execute(
        update(Teacher)
        .where(Teacher.id == to_teacher_id)
        .values(current_slots=Teacher.current_slots + transferred_count)
    )

    await db.commit()

    return {
        "code": 0,
        "message": "批量转移成功",
        "data": {
            "success": True,
            "message": f"成功转移 {transferred_count} 个场次",
            "transferred_count": transferred_count,
            "operation_id": str(uuid4()),
        },
    }


# ---------- 获取调剂历史 ----------
@router.get("/history", response_model=dict)
async def get_transfer_history(
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
) -> dict:
    """获取调剂历史记录（暂未实现持久化存储）"""
    # TODO: 需要实现 TransferOperation 模型来存储历史记录
    return {
        "code": 0,
        "message": "success",
        "data": {
            "total": 0,
            "items": [],
            "page": page,
            "page_size": page_size,
            "total_pages": 0,
        },
    }


# ---------- 撤销操作 ----------
@router.post("/undo/{operation_id}", response_model=dict)
async def undo_transfer(
    operation_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """撤销调剂操作（暂未实现）"""
    # TODO: 需要记录操作详情才能实现撤销
    raise HTTPException(status_code=501, detail="撤销功能暂未实现")
