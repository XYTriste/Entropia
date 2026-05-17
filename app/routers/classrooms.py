"""
考试排考系统 - 教室管理路由

提供教室的 CRUD 操作以及启用/禁用切换。
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud import classroom as classroom_crud
from app.database import get_db
from app.models.classroom import Classroom
from app.schemas.classroom import ClassroomCreate, ClassroomResponse, ClassroomUpdate

router = APIRouter()


@router.get("/", response_model=dict)
async def list_classrooms(
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: str | None = Query(None, description="按名称搜索"),
    building: str | None = Query(None, description="按教学楼过滤"),
    is_active: bool | None = Query(None, description="按启用状态过滤"),
) -> dict:
    """获取教室列表"""
    query = select(Classroom)

    if search:
        query = query.where(Classroom.name.ilike(f"%{search}%"))
    if building:
        query = query.where(Classroom.building == building)
    if is_active is not None:
        query = query.where(Classroom.is_active == is_active)

    count_query = select(func.count()).select_from(query.subquery())
    count_result = await db.execute(count_query)
    total = count_result.scalar_one() or 0

    result = await db.execute(query.offset(skip).limit(limit).order_by(Classroom.id))
    items = result.scalars().all()

    return {
        "code": 0,
        "message": "success",
        "data": {
            "total": total,
            "items": [ClassroomResponse.model_validate(r).model_dump() for r in items],
            "skip": skip,
            "limit": limit,
        },
    }


@router.get("/{classroom_id}", response_model=dict)
async def get_classroom(
    classroom_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """获取教室详情"""
    classroom = await classroom_crud.get_or_404(db, classroom_id)
    return {
        "code": 0,
        "message": "success",
        "data": ClassroomResponse.model_validate(classroom).model_dump(),
    }


@router.post("/", response_model=dict)
async def create_classroom(
    obj_in: ClassroomCreate,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """创建教室"""
    existing = await db.execute(select(Classroom).where(Classroom.name == obj_in.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"教室名称'{obj_in.name}'已存在")

    classroom = await classroom_crud.create(db, obj_in=obj_in)
    return {
        "code": 0,
        "message": "创建成功",
        "data": ClassroomResponse.model_validate(classroom).model_dump(),
    }


@router.put("/{classroom_id}", response_model=dict)
async def update_classroom(
    classroom_id: int,
    obj_in: ClassroomUpdate,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """更新教室"""
    classroom = await classroom_crud.get_or_404(db, classroom_id)

    if obj_in.name is not None and obj_in.name != classroom.name:
        existing = await db.execute(
            select(Classroom).where(Classroom.name == obj_in.name, Classroom.id != classroom_id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail=f"教室名称'{obj_in.name}'已存在")

    classroom = await classroom_crud.update(db, db_obj=classroom, obj_in=obj_in)
    return {
        "code": 0,
        "message": "更新成功",
        "data": ClassroomResponse.model_validate(classroom).model_dump(),
    }


@router.delete("/{classroom_id}", response_model=dict)
async def delete_classroom(
    classroom_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """删除教室"""
    classroom = await classroom_crud.get_or_404(db, classroom_id)

    if classroom.exam_assignments:
        raise HTTPException(status_code=400, detail="该教室已被用于考试安排，不能删除")

    await classroom_crud.delete(db, id=classroom_id)
    return {"code": 0, "message": "删除成功", "data": None}


@router.patch("/{classroom_id}/toggle-active", response_model=dict)
async def toggle_classroom_active(
    classroom_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """切换教室启用/禁用状态"""
    classroom = await classroom_crud.get_or_404(db, classroom_id)
    classroom.is_active = not classroom.is_active
    db.add(classroom)
    await db.commit()
    await db.refresh(classroom)

    status_str = "启用" if classroom.is_active else "禁用"
    return {
        "code": 0,
        "message": f"已{status_str}",
        "data": ClassroomResponse.model_validate(classroom).model_dump(),
    }
