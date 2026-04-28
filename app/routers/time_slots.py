"""
考试排考系统 - 时段管理路由

提供时段的查询操作以及总览矩阵:
- 列表 (含占用状态)
- 时段总览矩阵
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.crud import time_slot as time_slot_crud
from app.database import get_db
from app.models.exam import Exam
from app.models.patrol_teacher import PatrolTeacher
from app.models.time_slot import TimeSlot
from app.schemas.time_slot import TimeSlotResponse

router = APIRouter()

DAY_NAMES = {1: "周一", 2: "周二", 3: "周三", 4: "周四", 5: "周五"}
SLOT_CODES = ["T1", "T2", "T3", "T4"]


@router.get("/", response_model=dict)
async def list_time_slots(
    db: AsyncSession = Depends(get_db),
    day_of_week: int | None = Query(None, ge=1, le=5, description="按星期过滤"),
) -> dict:
    """获取时段列表 (含占用状态)"""
    query = select(TimeSlot).options(
        selectinload(TimeSlot.exams),
        selectinload(TimeSlot.patrol_teachers),
    )

    if day_of_week:
        query = query.where(TimeSlot.day_of_week == day_of_week)

    result = await db.execute(query.order_by(TimeSlot.id))
    items = result.scalars().all()

    data_items = []
    for ts in items:
        item = TimeSlotResponse.model_validate(ts).model_dump()
        item["day_name"] = DAY_NAMES.get(ts.day_of_week, "")
        item["exam_count"] = len(ts.exams) if ts.exams else 0
        item["patrol_count"] = len(ts.patrol_teachers) if ts.patrol_teachers else 0
        item["is_fully_occupied"] = len(ts.exams) > 0 if ts.exams else False
        data_items.append(item)

    return {
        "code": 0,
        "message": "success",
        "data": {"total": len(data_items), "items": data_items},
    }


@router.get("/overview", response_model=dict)
async def get_time_slot_overview(
    db: AsyncSession = Depends(get_db),
) -> dict:
    """获取时段总览矩阵 (日期 x 时段)"""
    result = await db.execute(
        select(TimeSlot)
        .options(selectinload(TimeSlot.exams))
        .order_by(TimeSlot.day_of_week, TimeSlot.slot_code)
    )
    all_slots = result.scalars().all()

    # 构建矩阵: 5天 x 4时段
    matrix = {}
    for day in range(1, 6):
        day_key = DAY_NAMES[day]
        matrix[day_key] = {}
        for slot_code in SLOT_CODES:
            slot = next(
                (s for s in all_slots if s.day_of_week == day and s.slot_code == slot_code),
                None,
            )
            if slot:
                exam_count = len(slot.exams) if slot.exams else 0
                matrix[day_key][slot_code] = {
                    "time_slot_id": slot.id,
                    "time_range": f"{slot.start_time}-{slot.end_time}",
                    "exam_count": exam_count,
                    "is_occupied": exam_count > 0,
                    "is_continuous": slot.is_continuous,
                }
            else:
                matrix[day_key][slot_code] = None

    return {"code": 0, "message": "success", "data": {"matrix": matrix}}
