"""
考试排考系统 - 手动微调与调剂路由

提供排考结果的手动微调和教师调剂功能:

手动微调:
- 调整考试时段
- 更换教室
- 更换监考教师
- 重新分配流动监考

教师场次调剂:
- 教师交换
- 单场转移
- 批量转交
- 撤销最近一次操作
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Exam, ExamTeacher, Teacher, TimeSlot
from app.models.exam import ExamStatus
from app.services.adjustment_service import (
    can_undo,
    change_classroom,
    change_teacher,
    move_exam_time,
    redo_patrol_teachers,
    undo_last_action,
)
from app.services.teacher_transfer import (
    batch_transfer,
    single_transfer,
    swap_teachers,
    undo_last_transfer,
)

router = APIRouter()


# ============================================================
# 请求模型 - 手动微调
# ============================================================


class MoveExamTimeRequest(BaseModel):
    """调整考试时段请求"""
    exam_id: int = Field(..., description="考试ID")
    new_time_slot_id: int = Field(..., description="新时段ID")
    reason: str = Field(..., min_length=1, max_length=255, description="调整原因")


class ChangeClassroomRequest(BaseModel):
    """更换教室请求"""
    exam_id: int = Field(..., description="考试ID")
    old_classroom_id: int = Field(..., description="原教室ID")
    new_classroom_id: int = Field(..., description="新教室ID")
    reason: str = Field(..., min_length=1, max_length=255, description="调整原因")


class ChangeTeacherRequest(BaseModel):
    """更换监考教师请求"""
    exam_id: int = Field(..., description="考试ID")
    old_teacher_id: int = Field(..., description="原教师ID")
    new_teacher_id: int = Field(..., description="新教师ID")
    role: str = Field("fixed", description="角色: fixed/patrol")
    reason: str = Field(..., min_length=1, max_length=255, description="调整原因")


class RedoPatrolRequest(BaseModel):
    """重新分配流动监考请求"""
    time_slot_id: int = Field(..., description="时段ID")
    reason: str = Field(..., min_length=1, max_length=255, description="调整原因")


# ============================================================
# 请求模型 - 教师调剂
# ============================================================


class TeacherSwapRequest(BaseModel):
    """教师交换请求"""
    teacher_a_id: int = Field(..., description="教师A ID")
    teacher_b_id: int = Field(..., description="教师B ID")
    exam_a_id: int = Field(..., description="考试A ID")
    exam_b_id: int = Field(..., description="考试B ID")
    reason: str = Field(..., min_length=1, max_length=255, description="交换原因")


class TeacherTransferRequest(BaseModel):
    """单场转移请求"""
    from_teacher_id: int = Field(..., description="转出教师ID")
    to_teacher_id: int = Field(..., description="接收教师ID")
    exam_id: int = Field(..., description="考试ID")
    role: str = Field("fixed", description="角色")
    reason: str = Field(..., min_length=1, max_length=255, description="转移原因")


class TeacherBatchTransferRequest(BaseModel):
    """批量转交请求"""
    from_teacher_id: int = Field(..., description="转出教师ID")
    to_teacher_id: int = Field(..., description="接收教师ID")
    reason: str = Field(..., min_length=1, max_length=255, description="转交原因")


# ============================================================
# 手动微调端点
# ============================================================


@router.post("/move-exam-time", response_model=dict)
async def move_exam_time_endpoint(
    req: MoveExamTimeRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """调整考试时段"""
    result = await move_exam_time(
        db=db,
        exam_id=req.exam_id,
        new_time_slot_id=req.new_time_slot_id,
        reason=req.reason,
    )
    await db.commit()
    return {"code": 0, "message": "调整成功", "data": result}


@router.post("/change-classroom", response_model=dict)
async def change_classroom_endpoint(
    req: ChangeClassroomRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """更换教室"""
    result = await change_classroom(
        db=db,
        exam_id=req.exam_id,
        old_classroom_id=req.old_classroom_id,
        new_classroom_id=req.new_classroom_id,
        reason=req.reason,
    )
    await db.commit()
    return {"code": 0, "message": "更换成功", "data": result}


@router.post("/change-teacher", response_model=dict)
async def change_teacher_endpoint(
    req: ChangeTeacherRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """更换监考教师"""
    result = await change_teacher(
        db=db,
        exam_id=req.exam_id,
        old_teacher_id=req.old_teacher_id,
        new_teacher_id=req.new_teacher_id,
        reason=req.reason,
        role=req.role,
    )
    await db.commit()
    return {"code": 0, "message": "更换成功", "data": result}


@router.post("/redo-patrol", response_model=dict)
async def redo_patrol_endpoint(
    req: RedoPatrolRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """重新分配流动监考"""
    result = await redo_patrol_teachers(
        db=db,
        time_slot_id=req.time_slot_id,
        reason=req.reason,
    )
    await db.commit()
    return {"code": 0, "message": "操作成功", "data": result}


# ============================================================
# 教师调剂端点
# ============================================================


@router.post("/teacher-swap", response_model=dict)
async def teacher_swap_endpoint(
    req: TeacherSwapRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """教师交换"""
    result = await swap_teachers(
        db=db,
        teacher_a_id=req.teacher_a_id,
        teacher_b_id=req.teacher_b_id,
        exam_a_id=req.exam_a_id,
        exam_b_id=req.exam_b_id,
        reason=req.reason,
    )
    await db.commit()
    return {"code": 0, "message": "交换成功", "data": result}


@router.post("/teacher-transfer", response_model=dict)
async def teacher_transfer_endpoint(
    req: TeacherTransferRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """单场转移"""
    result = await single_transfer(
        db=db,
        from_teacher_id=req.from_teacher_id,
        to_teacher_id=req.to_teacher_id,
        exam_id=req.exam_id,
        role=req.role,
        reason=req.reason,
    )
    await db.commit()
    return {"code": 0, "message": "转移成功", "data": result}


@router.post("/teacher-batch-transfer", response_model=dict)
async def teacher_batch_transfer_endpoint(
    req: TeacherBatchTransferRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """批量转交"""
    result = await batch_transfer(
        db=db,
        from_teacher_id=req.from_teacher_id,
        to_teacher_id=req.to_teacher_id,
        reason=req.reason,
    )
    await db.commit()
    return {"code": 0, "message": "批量转交成功", "data": result}


# ============================================================
# 撤销操作
# ============================================================


@router.post("/undo-last", response_model=dict)
async def undo_last_endpoint(
    db: AsyncSession = Depends(get_db),
) -> dict:
    """撤销最近一次操作"""
    # 先尝试撤销微调
    if can_undo():
        result = await undo_last_action(db)
        await db.commit()
        return {"code": 0, "message": "已撤销最近一次微调", "data": result}

    # 再尝试撤销调剂
    result = await undo_last_transfer(db)
    await db.commit()
    return {"code": 0, "message": "已撤销最近一次调剂", "data": result}


# ============================================================
# 查询端点
# ============================================================


DAY_NAME_TO_NUMBER = {
    "周一": 1, "周二": 2, "周三": 3, "周四": 4, "周五": 5
}


@router.get("/available-teachers", response_model=dict)
async def get_available_teachers(
    db: AsyncSession = Depends(get_db),
    date: str = Query(..., description="日期: 周一/周二/周三/周四/周五"),
    time_slot_code: str = Query(..., description="时段代码: T1/T2/T3/T4"),
    exclude_teacher_id: int | None = Query(None, description="排除的教师ID（如当前监考）"),
) -> dict:
    """获取可用教师列表（用于换教师对话框）

    返回所有教师及其在指定时段的安排状态：
    - has_conflict: 是否时段冲突（该时段已有监考任务）
    - current_slots: 当前总场次
    - max_slots: 最大可安排场次
    """
    # 转换日期为 day_of_week
    day_of_week = DAY_NAME_TO_NUMBER.get(date)
    if not day_of_week:
        raise HTTPException(status_code=400, detail=f"无效的日期: {date}，应为 周一/周二/周三/周四/周五")

    # 查询指定时段的时段ID
    time_slot_result = await db.execute(
        select(TimeSlot).where(
            TimeSlot.day_of_week == day_of_week,
            TimeSlot.slot_code == time_slot_code
        )
    )
    time_slot = time_slot_result.scalar_one_or_none()
    if not time_slot:
        raise HTTPException(status_code=404, detail=f"未找到时段: {date} {time_slot_code}")

    time_slot_id = time_slot.id

    # 查询该时段已有监考任务的教师ID列表
    conflict_result = await db.execute(
        select(ExamTeacher.teacher_id).join(
            Exam, ExamTeacher.exam_id == Exam.id
        ).where(
            Exam.time_slot_id == time_slot_id,
            Exam.status == ExamStatus.SCHEDULED,
        )
    )
    conflict_teacher_ids = set(conflict_result.scalars().all())

    # 如果排除教师，从冲突列表中移除
    if exclude_teacher_id:
        conflict_teacher_ids.discard(exclude_teacher_id)

    # 查询所有教师及其当前场次
    # 教师当前场次从 exam_teachers 表统计
    current_slots_result = await db.execute(
        select(
            ExamTeacher.teacher_id,
            func.count(ExamTeacher.id).label("current_slots")
        ).join(
            Exam, ExamTeacher.exam_id == Exam.id
        ).where(
            Exam.status == ExamStatus.SCHEDULED
        ).group_by(ExamTeacher.teacher_id)
    )
    teacher_slots_map = {row.teacher_id: row.current_slots for row in current_slots_result}

    # 查询所有活跃教师
    teachers_result = await db.execute(
        select(Teacher).where(Teacher.is_active == True).order_by(Teacher.name)
    )
    teachers = teachers_result.scalars().all()

    # 构建返回数据
    teachers_data = []
    for teacher in teachers:
        current_slots = teacher_slots_map.get(teacher.id, 0)
        max_slots = teacher.max_slots or 2  # 默认最大2场
        has_conflict = teacher.id in conflict_teacher_ids

        teachers_data.append({
            "id": teacher.id,
            "name": teacher.name,
            "teacher_type": teacher.teacher_type.value if teacher.teacher_type else "unknown",
            "current_slots": current_slots,
            "max_slots": max_slots,
            "has_conflict": has_conflict,
        })

    return {
        "code": 0,
        "message": "success",
        "data": {
            "teachers": teachers_data,
            "time_slot": {
                "id": time_slot_id,
                "day_name": date,
                "slot_code": time_slot_code,
                "time_range": f"{time_slot.start_time}-{time_slot.end_time}",
            }
        }
    }
