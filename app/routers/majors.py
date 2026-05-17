"""
考试排考系统 - 专业管理路由

提供专业的 CRUD 操作。
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud import major as major_crud
from app.database import get_db
from app.models.major import Major
from app.schemas.major import MajorCreate, MajorResponse, MajorUpdate

router = APIRouter()


@router.get("/", response_model=dict)
async def list_majors(
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: str | None = Query(None, description="按名称搜索"),
) -> dict:
    """获取专业列表"""
    query = select(Major)
    if search:
        query = query.where(Major.name.ilike(f"%{search}%"))

    count_query = select(func.count()).select_from(query.subquery())
    count_result = await db.execute(count_query)
    total = count_result.scalar_one() or 0

    result = await db.execute(query.offset(skip).limit(limit).order_by(Major.id))
    items = result.scalars().all()

    return {
        "code": 0,
        "message": "success",
        "data": {
            "total": total,
            "items": [MajorResponse.model_validate(m).model_dump() for m in items],
            "skip": skip,
            "limit": limit,
        },
    }


@router.get("/{major_id}", response_model=dict)
async def get_major(
    major_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """获取专业详情"""
    major = await major_crud.get_or_404(db, major_id)
    return {
        "code": 0,
        "message": "success",
        "data": MajorResponse.model_validate(major).model_dump(),
    }


@router.post("/", response_model=dict)
async def create_major(
    obj_in: MajorCreate,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """创建专业"""
    existing = await db.execute(select(Major).where(Major.name == obj_in.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"专业名称'{obj_in.name}'已存在")

    major = await major_crud.create(db, obj_in=obj_in)
    return {
        "code": 0,
        "message": "创建成功",
        "data": MajorResponse.model_validate(major).model_dump(),
    }


@router.put("/{major_id}", response_model=dict)
async def update_major(
    major_id: int,
    obj_in: MajorUpdate,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """更新专业"""
    major = await major_crud.get_or_404(db, major_id)

    if obj_in.name is not None:
        existing = await db.execute(
            select(Major).where(Major.name == obj_in.name, Major.id != major_id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail=f"专业名称'{obj_in.name}'已存在")

    major = await major_crud.update(db, db_obj=major, obj_in=obj_in)
    return {
        "code": 0,
        "message": "更新成功",
        "data": MajorResponse.model_validate(major).model_dump(),
    }


@router.delete("/{major_id}", response_model=dict)
async def delete_major(
    major_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """删除专业"""
    major = await major_crud.get_or_404(db, major_id)

    if major.classes:
        raise HTTPException(status_code=400, detail="该专业下还有班级，不能删除")

    await major_crud.delete(db, id=major_id)
    return {"code": 0, "message": "删除成功", "data": None}
