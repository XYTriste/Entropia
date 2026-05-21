"""
考试排考系统 - 时段管理路由

提供时段的查询操作以及总览矩阵:
- 列表 (含占用状态)
- 时段总览矩阵
- 根据起始日期生成多周时段
"""

from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select
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
        if ts.exam_date:
            item["date_label"] = ts.exam_date.strftime("%m-%d")
        data_items.append(item)

    return {
        "code": 0,
        "message": "success",
        "data": {"total": len(data_items), "items": data_items},
    }


class TimeSlotGenerateRequest(BaseModel):
    """生成考试时段请求"""
    start_date: date = Field(..., description="考试起始日期 (必须是周一)")
    weeks: int = Field(1, ge=1, le=4, description="考试周数 (1-4)")


@router.post("/generate", response_model=dict)
async def generate_time_slots(
    req: TimeSlotGenerateRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """根据起始日期和周数生成考试时段

    逻辑：
    1. 删除所有已有 exam_date 的生成记录（保留模板记录 exam_date IS NULL）
    2. 从 start_date 开始，取连续周一至周五，每天生成 T1-T4
    3. 插入数据库并返回生成的记录列表
    """
    # 校验 start_date 必须是周一
    if req.start_date.weekday() != 0:
        raise HTTPException(status_code=400, detail="考试起始日期必须是周一")

    # 读取模板记录（exam_date IS NULL）
    result = await db.execute(
        select(TimeSlot)
        .where(TimeSlot.exam_date.is_(None))
        .order_by(TimeSlot.day_of_week, TimeSlot.slot_code)
    )
    templates = result.scalars().all()

    if len(templates) != 20:
        raise HTTPException(
            status_code=500,
            detail=f"模板记录数量异常，期望 20 条，实际 {len(templates)} 条。请检查数据库初始化。"
        )

    # 构建模板映射 (day_of_week, slot_code) -> TimeSlot
    template_map = {
        (t.day_of_week, t.slot_code): t for t in templates
    }

    # 删除旧生成记录
    await db.execute(delete(TimeSlot).where(TimeSlot.exam_date.isnot(None)))
    await db.flush()

    # 生成新记录
    generated = []

    for week_count in range(req.weeks):
        for day_offset in range(5):  # 0-4 对应周一到周五
            exam_date = req.start_date + timedelta(weeks=week_count, days=day_offset)
            dow = day_offset + 1  # 1-5
            for slot_code in SLOT_CODES:
                tmpl = template_map.get((dow, slot_code))
                if not tmpl:
                    continue
                ts = TimeSlot(
                    day_of_week=tmpl.day_of_week,
                    slot_code=tmpl.slot_code,
                    start_time=tmpl.start_time,
                    end_time=tmpl.end_time,
                    is_continuous=tmpl.is_continuous,
                    exam_date=exam_date,
                )
                db.add(ts)
                generated.append(ts)

    await db.commit()

    # 刷新获取 id
    for ts in generated:
        await db.refresh(ts)

    data_items = []
    for ts in generated:
        item = TimeSlotResponse.model_validate(ts).model_dump()
        item["day_name"] = DAY_NAMES.get(ts.day_of_week, "")
        item["date_label"] = ts.exam_date.strftime("%m-%d") if ts.exam_date else None
        data_items.append(item)

    return {
        "code": 0,
        "message": f"成功生成 {len(data_items)} 个考试时段（{req.weeks} 周）",
        "data": {"total": len(data_items), "items": data_items},
    }


@router.delete("/{time_slot_id}", response_model=dict)
async def delete_time_slot(
    time_slot_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """删除时段（仅允许删除有 exam_date 的生成记录，模板记录不可删除）"""
    ts = await db.get(TimeSlot, time_slot_id)
    if not ts:
        raise HTTPException(status_code=404, detail="时段不存在")
    if ts.exam_date is None:
        raise HTTPException(status_code=400, detail="模板记录不可删除，请通过重新生成考试时段来覆盖")
    await db.delete(ts)
    await db.commit()
    return {"code": 0, "message": "删除成功"}


@router.get("/overview", response_model=dict)
async def get_time_slot_overview(
    db: AsyncSession = Depends(get_db),
) -> dict:
    """获取时段总览矩阵 (日期 x 时段)"""
    result = await db.execute(
        select(TimeSlot)
        .options(selectinload(TimeSlot.exams))
        .order_by(TimeSlot.exam_date, TimeSlot.day_of_week, TimeSlot.slot_code)
    )
    all_slots = result.scalars().all()

    # 构建矩阵: 按具体日期分组，每个日期下 4 个时段
    matrix: dict[str, dict[str, dict | None]] = {}
    for slot in all_slots:
        if slot.exam_date is None:
            continue  # 跳过模板记录
        date_key = slot.exam_date.isoformat()
        if date_key not in matrix:
            matrix[date_key] = {}
        exam_count = len(slot.exams) if slot.exams else 0
        matrix[date_key][slot.slot_code] = {
            "time_slot_id": slot.id,
            "time_range": f"{slot.start_time}-{slot.end_time}",
            "exam_count": exam_count,
            "is_occupied": exam_count > 0,
            "is_continuous": slot.is_continuous,
            "day_of_week": slot.day_of_week,
            "day_name": DAY_NAMES.get(slot.day_of_week, ""),
            "date_label": slot.exam_date.strftime("%m-%d"),
        }

    return {"code": 0, "message": "success", "data": {"matrix": matrix}}
