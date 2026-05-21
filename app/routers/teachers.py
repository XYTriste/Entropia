"""
考试排考系统 - 教师管理路由

提供教师的 CRUD 操作以及负荷统计:
- 列表(支持分页、搜索、按类型过滤)
- 详情
- 创建
- 更新(含 max_slots 调整)
- 删除
- 启用/禁用切换
- 教师负荷统计
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud import teacher as teacher_crud
from app.database import get_db
from app.models.teacher import Teacher, TeacherType
from app.models.exam import Exam
from app.models.exam_teacher import ExamTeacher
from app.models.time_slot import TimeSlot
from app.models.classroom import Classroom
from app.models.course import Course
from app.models.exam_classroom import ExamClassroom
from app.models.exam_classroom_class import ExamClassroomClass
from app.schemas.teacher import TeacherCreate, TeacherResponse, TeacherUpdate
from sqlalchemy.orm import selectinload

router = APIRouter()


# ---------- 列表 (支持分页、搜索、按类型过滤) ----------


@router.get("/", response_model=dict)
async def list_teachers(
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0, description="跳过记录数"),
    limit: int = Query(100, ge=1, le=10000, description="每页记录数"),
    search: Optional[str] = Query(None, description="按姓名搜索"),
    teacher_type: Optional[TeacherType] = Query(None, description="按类型过滤"),
    is_active: Optional[bool] = Query(None, description="按启用状态过滤"),
    all: bool = Query(False, description="返回所有记录，忽略分页"),
) -> dict:
    """获取教师列表，支持分页、搜索、类型过滤"""
    query = select(Teacher)

    # 搜索过滤
    if search:
        query = query.where(Teacher.name.ilike(f"%{search}%"))
    if teacher_type:
        query = query.where(Teacher.teacher_type == teacher_type)
    if is_active is not None:
        query = query.where(Teacher.is_active == is_active)

    # 总数
    count_query = select(func.count()).select_from(query.subquery())
    count_result = await db.execute(count_query)
    total = count_result.scalar_one() or 0

    # 分页数据（all=true 时忽略分页）
    if not all:
        query = query.offset(skip).limit(limit)
    query = query.order_by(Teacher.id)
    result = await db.execute(query)
    items = result.scalars().all()

    return {
        "code": 0,
        "message": "success",
        "data": {
            "total": total,
            "items": [TeacherResponse.model_validate(t).model_dump() for t in items],
            "skip": skip,
            "limit": limit,
        },
    }




# ---------- 详情 ----------


@router.get("/{teacher_id}", response_model=dict)
async def get_teacher(
    teacher_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """获取教师详情"""
    teacher = await teacher_crud.get_or_404(db, teacher_id)
    return {
        "code": 0,
        "message": "success",
        "data": TeacherResponse.model_validate(teacher).model_dump(),
    }


# ---------- 创建 ----------


@router.post("/", response_model=dict)
async def create_teacher(
    obj_in: TeacherCreate,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """创建教师"""
    teacher = await teacher_crud.create(db, obj_in=obj_in)
    return {
        "code": 0,
        "message": "创建成功",
        "data": TeacherResponse.model_validate(teacher).model_dump(),
    }


# ---------- 更新 ----------


@router.put("/{teacher_id}", response_model=dict)
async def update_teacher(
    teacher_id: int,
    obj_in: TeacherUpdate,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """更新教师信息 (含 max_slots 调整)"""
    teacher = await teacher_crud.get_or_404(db, teacher_id)

    # 如果下调 max_slots，检查是否会导致当前已排场次超限
    if obj_in.max_slots is not None and obj_in.max_slots < teacher.current_slots:
        raise HTTPException(
            status_code=400,
            detail=f"最大场次不能小于当前已排场次({teacher.current_slots})",
        )

    teacher = await teacher_crud.update(db, db_obj=teacher, obj_in=obj_in)
    return {
        "code": 0,
        "message": "更新成功",
        "data": TeacherResponse.model_validate(teacher).model_dump(),
    }


# ---------- 删除 ----------


@router.delete("/{teacher_id}", response_model=dict)
async def delete_teacher(
    teacher_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """删除教师"""
    teacher = await teacher_crud.get_or_404(db, teacher_id)

    # 检查是否有监考安排
    if teacher.current_slots > 0:
        raise HTTPException(
            status_code=400,
            detail=f"该教师已有{teacher.current_slots}场监考安排，不能删除",
        )

    await teacher_crud.delete(db, id=teacher_id)
    return {"code": 0, "message": "删除成功", "data": None}


# ---------- 启用/禁用切换 ----------


@router.patch("/{teacher_id}/toggle-active", response_model=dict)
async def toggle_teacher_active(
    teacher_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """切换教师启用/禁用状态"""
    teacher = await teacher_crud.get_or_404(db, teacher_id)
    teacher.is_active = not teacher.is_active
    db.add(teacher)
    await db.commit()
    await db.refresh(teacher)

    status_str = "启用" if teacher.is_active else "禁用"
    return {
        "code": 0,
        "message": f"已{status_str}",
        "data": TeacherResponse.model_validate(teacher).model_dump(),
    }


# ---------- 教师负荷统计 ----------


@router.get("/workload/stats", response_model=dict)
async def get_teacher_workload(
    db: AsyncSession = Depends(get_db),
) -> dict:
    """获取教师负荷统计"""
    # 专任教师统计
    ft_result = await db.execute(
        select(func.count(Teacher.id), func.sum(Teacher.current_slots), func.sum(Teacher.max_slots))
        .where(Teacher.teacher_type == TeacherType.FULL_TIME)
    )
    ft_count, ft_used, ft_total = ft_result.one()

    # 兼职教师统计
    pt_result = await db.execute(
        select(func.count(Teacher.id), func.sum(Teacher.current_slots), func.sum(Teacher.max_slots))
        .where(Teacher.teacher_type == TeacherType.PART_TIME)
    )
    pt_count, pt_used, pt_total = pt_result.one()

    # 超负荷教师列表
    overload_result = await db.execute(
        select(Teacher).where(Teacher.current_slots > Teacher.max_slots)
    )
    overload_teachers = overload_result.scalars().all()

    return {
        "code": 0,
        "message": "success",
        "data": {
            "full_time": {
                "count": ft_count or 0,
                "used_slots": ft_used or 0,
                "total_slots": ft_total or 0,
                "utilization": f"{(ft_used or 0) / (ft_total or 1) * 100:.1f}%",
            },
            "part_time": {
                "count": pt_count or 0,
                "used_slots": pt_used or 0,
                "total_slots": pt_total or 0,
                "utilization": f"{(pt_used or 0) / (pt_total or 1) * 100:.1f}%",
            },
            "overload_teachers": [
                {"id": t.id, "name": t.name, "current": t.current_slots, "max": t.max_slots}
                for t in overload_teachers
            ],
        },
    }


# ---------- 教师监考安排 ----------


@router.get("/{teacher_id}/exams", response_model=dict)
async def get_teacher_exams(
    teacher_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """获取教师的监考安排详情"""
    teacher = await teacher_crud.get_or_404(db, teacher_id)

    # 查询该教师的所有监考（固定+流动）
    result = await db.execute(
        select(ExamTeacher)
        .where(ExamTeacher.teacher_id == teacher_id)
        .options(
            selectinload(ExamTeacher.exam).selectinload(Exam.course),
            selectinload(ExamTeacher.exam).selectinload(Exam.time_slot),
            selectinload(ExamTeacher.exam).selectinload(Exam.classroom_assignments).selectinload(ExamClassroom.classroom),
            selectinload(ExamTeacher.exam).selectinload(Exam.classroom_assignments).selectinload(ExamClassroom.class_assignments).selectinload(ExamClassroomClass.class_),
        )
    )
    exam_teachers = result.scalars().all()

    fixed_exams = []
    patrol_exams = []
    for et in exam_teachers:
        exam = et.exam
        if not exam:
            continue
        slot = exam.time_slot
        date_label = slot.exam_date.strftime("%m-%d") if slot and slot.exam_date else None
        exam_info = {
            "exam_id": exam.id,
            "course_id": exam.course_id,
            "course_name": exam.course.name if exam.course else "",
            "course_type": exam.course.course_type.value if exam.course else "",
            "exam_paper": exam.exam_label.value if exam.exam_label else "",
            "date": f"周{'一二三四五'[(slot.day_of_week or 1) - 1]}" if slot else "",
            "time_slot": f"{slot.start_time}-{slot.end_time}" if slot else "",
            "day_of_week": slot.day_of_week if slot else None,
            "day_name": f"周{'一二三四五'[(slot.day_of_week or 1) - 1]}" if slot else "",
            "slot_code": slot.slot_code if slot else "",
            "time_range": f"{slot.start_time}-{slot.end_time}" if slot else "",
            "exam_date": slot.exam_date.isoformat() if slot and slot.exam_date else None,
            "date_label": date_label,
            "classrooms": [
                {
                    "classroom_id": ec.classroom_id,
                    "classroom_name": ec.classroom.name if ec.classroom else f"教室{ec.classroom_id}",
                    "total_students": ec.total_students,
                }
                for ec in (exam.classroom_assignments or [])
            ],
        }
        if et.role.value == "fixed":
            # 固定监考需标注具体教室及该教室人数
            classroom = None
            assigned_student_count = 0
            assigned_classes = []
            if et.classroom_id:
                for ec in exam.classroom_assignments:
                    if ec.classroom_id == et.classroom_id:
                        classroom = ec.classroom.name if ec.classroom else f"教室{ec.classroom_id}"
                        assigned_student_count = ec.total_students or 0
                        # 获取该教室的班级信息
                        assigned_classes = [
                            {
                                "class_name": ecc.class_.name if ecc.class_ else f"班级{ecc.class_id}",
                                "student_count": ecc.student_count or 0,
                            }
                            for ecc in (ec.class_assignments or [])
                        ]
                        break
            exam_info["assigned_classroom"] = classroom
            exam_info["assigned_student_count"] = assigned_student_count
            exam_info["assigned_classes"] = assigned_classes
            fixed_exams.append(exam_info)
        else:
            patrol_exams.append(exam_info)

    return {
        "code": 0,
        "message": "success",
        "data": {
            "teacher_id": teacher_id,
            "teacher_name": teacher.name,
            "current_slots": teacher.current_slots,
            "max_slots": teacher.max_slots,
            "fixed_count": len(fixed_exams),
            "patrol_count": len(patrol_exams),
            "fixed_exams": sorted(fixed_exams, key=lambda x: (x["day_of_week"] or 0, x["slot_code"] or "")),
            "patrol_exams": sorted(patrol_exams, key=lambda x: (x["day_of_week"] or 0, x["slot_code"] or "")),
        },
    }
