"""
考试排考系统 - 班级管理路由

提供班级的 CRUD 操作 (含关联专业)。
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.crud import class_ as class_crud
from app.database import get_db
from app.models.class_ import Class
from app.models.major import Major
from app.schemas.class_ import ClassCreate, ClassResponse, ClassUpdate

router = APIRouter()


@router.get("/", response_model=dict)
async def list_classes(
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=10000),
    major_id: int | None = Query(None, description="按专业过滤"),
    grade: int | None = Query(None, description="按年级过滤"),
    search: str | None = Query(None, description="按名称搜索"),
    all: bool = Query(False, description="返回所有记录"),
) -> dict:
    """获取班级列表 (支持按专业过滤)"""
    query = select(Class).options(selectinload(Class.major))

    if major_id:
        query = query.where(Class.major_id == major_id)
    if grade:
        query = query.where(Class.grade == grade)
    if search:
        query = query.where(Class.name.ilike(f"%{search}%"))

    count_query = select(func.count()).select_from(query.subquery())
    count_result = await db.execute(count_query)
    total = count_result.scalar_one() or 0

    if not all:
        query = query.offset(skip).limit(limit)
    query = query.order_by(Class.id)
    result = await db.execute(query)
    items = result.scalars().all()

    # 构建响应 (含专业名称)
    data_items = []
    for c in items:
        item = ClassResponse.model_validate(c).model_dump()
        item["major_name"] = c.major.name if c.major else None
        data_items.append(item)

    return {
        "code": 0,
        "message": "success",
        "data": {"total": total, "items": data_items, "skip": skip, "limit": limit},
    }


@router.get("/{class_id}", response_model=dict)
async def get_class(
    class_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """获取班级详情"""
    result = await db.execute(
        select(Class).where(Class.id == class_id).options(selectinload(Class.major))
    )
    class_obj = result.scalar_one_or_none()
    if not class_obj:
        raise HTTPException(status_code=404, detail=f"班级(id={class_id})不存在")

    item = ClassResponse.model_validate(class_obj).model_dump()
    item["major_name"] = class_obj.major.name if class_obj.major else None
    item["student_count_actual"] = len(class_obj.students) if class_obj.students else class_obj.student_count

    return {"code": 0, "message": "success", "data": item}


@router.post("/", response_model=dict)
async def create_class(
    obj_in: ClassCreate,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """创建班级"""
    # 检查专业是否存在
    major = await db.get(Major, obj_in.major_id)
    if not major:
        raise HTTPException(status_code=400, detail=f"专业(id={obj_in.major_id})不存在")

    # 检查同专业下是否重名
    existing = await db.execute(
        select(Class).where(Class.name == obj_in.name, Class.grade == obj_in.grade)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"班级'{obj_in.name}'({obj_in.grade}级)已存在")

    class_obj = await class_crud.create(db, obj_in=obj_in)
    return {
        "code": 0,
        "message": "创建成功",
        "data": ClassResponse.model_validate(class_obj).model_dump(),
    }


@router.put("/{class_id}", response_model=dict)
async def update_class(
    class_id: int,
    obj_in: ClassUpdate,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """更新班级"""
    class_obj = await class_crud.get_or_404(db, class_id)

    if obj_in.major_id is not None:
        major = await db.get(Major, obj_in.major_id)
        if not major:
            raise HTTPException(status_code=400, detail=f"专业(id={obj_in.major_id})不存在")

    class_obj = await class_crud.update(db, db_obj=class_obj, obj_in=obj_in)
    return {
        "code": 0,
        "message": "更新成功",
        "data": ClassResponse.model_validate(class_obj).model_dump(),
    }


@router.delete("/{class_id}", response_model=dict)
async def delete_class(
    class_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """删除班级"""
    class_obj = await class_crud.get_or_404(db, class_id)

    if class_obj.students:
        raise HTTPException(status_code=400, detail="该班级下还有学生，不能删除")

    await class_crud.delete(db, id=class_id)
    return {"code": 0, "message": "删除成功", "data": None}
