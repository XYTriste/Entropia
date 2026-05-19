"""
考试排考系统 - 学生管理路由

提供学生的 CRUD 操作 (支持按班级过滤)。
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.crud import student as student_crud
from app.database import get_db
from app.models.class_ import Class
from app.models.student import Student
from app.schemas.student import StudentCreate, StudentResponse, StudentUpdate

router = APIRouter()


@router.get("/", response_model=dict)
async def list_students(
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=10000),
    class_id: int | None = Query(None, description="按班级过滤"),
    search: str | None = Query(None, description="按学号或姓名搜索"),
    all: bool = Query(False, description="返回所有记录"),
) -> dict:
    """获取学生列表 (支持按班级过滤)"""
    query = select(Student).options(selectinload(Student.class_))

    if class_id:
        query = query.where(Student.class_id == class_id)
    if search:
        query = query.where(
            (Student.name.ilike(f"%{search}%")) | (Student.student_no.ilike(f"%{search}%"))
        )

    count_query = select(func.count()).select_from(query.subquery())
    count_result = await db.execute(count_query)
    total = count_result.scalar_one() or 0

    if not all:
        query = query.offset(skip).limit(limit)
    query = query.order_by(Student.id)
    result = await db.execute(query)
    items = result.scalars().all()

    data_items = []
    for s in items:
        item = StudentResponse.model_validate(s).model_dump()
        item["class_name"] = s.class_.name if s.class_ else None
        item["grade"] = s.class_.grade if s.class_ else None
        data_items.append(item)

    return {
        "code": 0,
        "message": "success",
        "data": {"total": total, "items": data_items, "skip": skip, "limit": limit},
    }


@router.get("/{student_id}", response_model=dict)
async def get_student(
    student_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """获取学生详情"""
    result = await db.execute(
        select(Student).where(Student.id == student_id).options(selectinload(Student.class_))
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail=f"学生(id={student_id})不存在")

    item = StudentResponse.model_validate(student).model_dump()
    item["class_name"] = student.class_.name if student.class_ else None
    item["major_id"] = student.class_.major_id if student.class_ else None

    return {"code": 0, "message": "success", "data": item}


async def _resolve_class_id(db: AsyncSession, obj_in: StudentCreate | StudentUpdate) -> StudentCreate | StudentUpdate:
    """如果提供了 class_name + grade，自动查找 class_id"""
    if obj_in.class_id is None and obj_in.class_name and obj_in.grade is not None:
        result = await db.execute(
            select(Class).where(Class.name == obj_in.class_name.strip(), Class.grade == obj_in.grade)
        )
        cls = result.scalar_one_or_none()
        if not cls:
            raise HTTPException(
                status_code=400,
                detail=f"班级 '{obj_in.class_name}'({obj_in.grade}级) 不存在"
            )
        obj_in.class_id = cls.id
    return obj_in


@router.post("/", response_model=dict)
async def create_student(
    obj_in: StudentCreate,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """创建学生"""
    # 检查学号是否重复
    existing = await db.execute(select(Student).where(Student.student_no == obj_in.student_no))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"学号'{obj_in.student_no}'已存在")

    obj_in = await _resolve_class_id(db, obj_in)
    student = await student_crud.create(db, obj_in=obj_in)
    return {
        "code": 0,
        "message": "创建成功",
        "data": StudentResponse.model_validate(student).model_dump(),
    }


@router.put("/{student_id}", response_model=dict)
async def update_student(
    student_id: int,
    obj_in: StudentUpdate,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """更新学生"""
    student = await student_crud.get_or_404(db, student_id)

    if obj_in.student_no is not None and obj_in.student_no != student.student_no:
        existing = await db.execute(
            select(Student).where(Student.student_no == obj_in.student_no, Student.id != student_id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail=f"学号'{obj_in.student_no}'已存在")

    obj_in = await _resolve_class_id(db, obj_in)
    student = await student_crud.update(db, db_obj=student, obj_in=obj_in)
    return {
        "code": 0,
        "message": "更新成功",
        "data": StudentResponse.model_validate(student).model_dump(),
    }


@router.delete("/{student_id}", response_model=dict)
async def delete_student(
    student_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """删除学生"""
    await student_crud.delete(db, id=student_id)
    return {"code": 0, "message": "删除成功", "data": None}
