"""
考试排考系统 - 课程管理路由

提供课程的 CRUD 操作以及班级关联、AB卷标记:
- 获取课程关联的班级
- 关联班级
- 取消关联班级
- 标记AB卷
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.crud import course as course_crud
from app.database import get_db
from app.models.class_ import Class
from app.models.course import Course
from app.models.course_class import CourseClass
from app.schemas.course import CourseClassLink, CourseCreate, CourseResponse, CourseUpdate

router = APIRouter()


@router.get("/", response_model=dict)
async def list_courses(
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    course_type: str | None = Query(None, description="按类型过滤 public/major"),
    search: str | None = Query(None, description="按名称搜索"),
) -> dict:
    """获取课程列表"""
    query = select(Course).options(selectinload(Course.class_links).selectinload(CourseClass.class_))

    if course_type:
        query = query.where(Course.course_type == course_type)
    if search:
        query = query.where(Course.name.ilike(f"%{search}%"))

    count_result = await db.execute(select(func.count(Course.id)).select_from(query.subquery()))
    total = count_result.scalar_one()

    result = await db.execute(query.offset(skip).limit(limit).order_by(Course.id))
    items = result.scalars().all()

    data_items = []
    for c in items:
        item = CourseResponse.model_validate(c).model_dump()
        item["linked_classes"] = [
            {"class_id": cl.class_id, "class_name": cl.class_.name if cl.class_ else None, "grade": cl.grade}
            for cl in c.class_links
        ]
        item["linked_class_count"] = len(c.class_links)
        data_items.append(item)

    return {
        "code": 0,
        "message": "success",
        "data": {"total": total, "items": data_items, "skip": skip, "limit": limit},
    }


@router.get("/{course_id}", response_model=dict)
async def get_course(
    course_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """获取课程详情"""
    result = await db.execute(
        select(Course)
        .where(Course.id == course_id)
        .options(selectinload(Course.class_links).selectinload(CourseClass.class_))
    )
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail=f"课程(id={course_id})不存在")

    item = CourseResponse.model_validate(course).model_dump()
    item["linked_classes"] = [
        {"class_id": cl.class_id, "class_name": cl.class_.name if cl.class_ else None, "grade": cl.grade}
        for cl in course.class_links
    ]

    return {"code": 0, "message": "success", "data": item}


@router.post("/", response_model=dict)
async def create_course(
    obj_in: CourseCreate,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """创建课程 (含班级关联)"""
    # 提取 class_ids 后创建课程
    class_links = obj_in.class_ids
    course_data = obj_in.model_dump(exclude={"class_ids"})

    course = Course(**course_data)
    db.add(course)
    await db.flush()

    # 创建课程-班级关联
    if class_links:
        for link in class_links:
            # 验证班级存在
            cls = await db.get(Class, link.class_id)
            if not cls:
                raise HTTPException(status_code=400, detail=f"班级(id={link.class_id})不存在")

            cc = CourseClass(course_id=course.id, class_id=link.class_id, grade=link.grade)
            db.add(cc)
        await db.flush()

    return {
        "code": 0,
        "message": "创建成功",
        "data": CourseResponse.model_validate(course).model_dump(),
    }


@router.put("/{course_id}", response_model=dict)
async def update_course(
    course_id: int,
    obj_in: CourseUpdate,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """更新课程"""
    course = await course_crud.get_or_404(db, course_id)
    course = await course_crud.update(db, db_obj=course, obj_in=obj_in)
    return {
        "code": 0,
        "message": "更新成功",
        "data": CourseResponse.model_validate(course).model_dump(),
    }


@router.delete("/{course_id}", response_model=dict)
async def delete_course(
    course_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """删除课程"""
    course = await course_crud.get_or_404(db, course_id)

    if course.exams:
        raise HTTPException(status_code=400, detail="该课程已有排考记录，不能删除")

    await course_crud.delete(db, id=course_id)
    return {"code": 0, "message": "删除成功", "data": None}


# ---------- 课程关联班级 ----------


@router.get("/{course_id}/classes", response_model=dict)
async def get_course_classes(
    course_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """获取课程关联的班级"""
    course = await course_crud.get_or_404(db, course_id)

    classes = []
    for cc in course.class_links:
        classes.append({
            "class_id": cc.class_id,
            "class_name": cc.class_.name if hasattr(cc, "class_") and cc.class_ else None,
            "grade": cc.grade,
        })

    return {"code": 0, "message": "success", "data": {"course_id": course_id, "classes": classes}}


@router.post("/{course_id}/link-class", response_model=dict)
async def link_class_to_course(
    course_id: int,
    link: CourseClassLink,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """关联班级到课程"""
    course = await course_crud.get_or_404(db, course_id)

    cls = await db.get(Class, link.class_id)
    if not cls:
        raise HTTPException(status_code=404, detail=f"班级(id={link.class_id})不存在")

    # 检查是否已关联
    existing = await db.execute(
        select(CourseClass).where(
            CourseClass.course_id == course_id,
            CourseClass.class_id == link.class_id,
            CourseClass.grade == link.grade,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="该班级已关联此课程")

    cc = CourseClass(course_id=course_id, class_id=link.class_id, grade=link.grade)
    db.add(cc)
    await db.commit()

    return {"code": 0, "message": "关联成功", "data": None}


@router.delete("/{course_id}/unlink-class/{class_id}", response_model=dict)
async def unlink_class_from_course(
    course_id: int,
    class_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """取消班级与课程的关联"""
    result = await db.execute(
        select(CourseClass).where(
            CourseClass.course_id == course_id,
            CourseClass.class_id == class_id,
        )
    )
    cc = result.scalar_one_or_none()
    if not cc:
        raise HTTPException(status_code=404, detail="关联记录不存在")

    await db.delete(cc)
    await db.commit()

    return {"code": 0, "message": "取消关联成功", "data": None}


@router.patch("/{course_id}/mark-ab", response_model=dict)
async def mark_course_ab(
    course_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """标记/取消标记课程为AB卷"""
    course = await course_crud.get_or_404(db, course_id)
    course.needs_ab = not course.needs_ab
    db.add(course)
    await db.commit()
    await db.refresh(course)

    status_str = "已标记" if course.needs_ab else "已取消"
    return {
        "code": 0,
        "message": f"{status_str}AB卷",
        "data": CourseResponse.model_validate(course).model_dump(),
    }
