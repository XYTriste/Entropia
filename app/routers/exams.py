"""
考试排考系统 - 排考结果查询路由

提供排考结果的多维度查询:
- 考试列表 (支持按时段、课程、状态过滤)
- 考试详情
- 总览视图矩阵 (日期 x 时段)
- 教师视图甘特图数据
- 教室视图矩阵
- 班级考试时间表
- 课程考试详情 (含AB卷分卷情况)
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.crud import exam as exam_crud
from app.database import get_db
from app.models.class_ import Class
from app.models.classroom import Classroom
from app.models.course import Course
from app.models.exam import Exam, ExamStatus
from app.models.exam_classroom import ExamClassroom
from app.models.exam_teacher import ExamTeacher
from app.models.teacher import Teacher
from app.models.time_slot import TimeSlot
from app.schemas.exam import ExamResponse

router = APIRouter()

DAY_NAMES = {1: "周一", 2: "周二", 3: "周三", 4: "周四", 5: "周五"}


# ============================================================
# 考试列表
# ============================================================


@router.get("/", response_model=dict)
async def list_exams(
    db: AsyncSession = Depends(get_db),
    time_slot_id: int | None = Query(None, description="按时段过滤"),
    course_id: int | None = Query(None, description="按课程过滤"),
    status: ExamStatus | None = Query(None, description="按状态过滤"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
) -> dict:
    """获取考试列表 (支持多维度过滤)"""
    query = select(Exam).options(
        selectinload(Exam.course),
        selectinload(Exam.time_slot),
        selectinload(Exam.classroom_assignments).selectinload(ExamClassroom.classroom),
        selectinload(Exam.classroom_assignments).selectinload(ExamClassroom.class_assignments),
        selectinload(Exam.teacher_assignments).selectinload(ExamTeacher.teacher),
    )

    if time_slot_id:
        query = query.where(Exam.time_slot_id == time_slot_id)
    if course_id:
        query = query.where(Exam.course_id == course_id)
    if status:
        query = query.where(Exam.status == status)

    from sqlalchemy import func
    count_result = await db.execute(select(func.count(Exam.id)).select_from(query.subquery()))
    total = count_result.scalar_one()

    result = await db.execute(query.offset(skip).limit(limit).order_by(Exam.id))
    items = result.scalars().all()

    data_items = []
    for exam in items:
        item = _format_exam_detail(exam)
        data_items.append(item)

    return {
        "code": 0,
        "message": "success",
        "data": {"total": total, "items": data_items, "skip": skip, "limit": limit},
    }


# ============================================================
# 考试详情
# ============================================================


@router.get("/{exam_id}", response_model=dict)
async def get_exam(
    exam_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """获取考试详情"""
    result = await db.execute(
        select(Exam)
        .where(Exam.id == exam_id)
        .options(
            selectinload(Exam.course),
            selectinload(Exam.time_slot),
            selectinload(Exam.classroom_assignments).selectinload(ExamClassroom.classroom),
            selectinload(Exam.classroom_assignments).selectinload(ExamClassroom.class_assignments),
            selectinload(Exam.teacher_assignments).selectinload(ExamTeacher.teacher),
        )
    )
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail=f"考试(id={exam_id})不存在")

    return {"code": 0, "message": "success", "data": _format_exam_detail(exam)}


# ============================================================
# 总览视图矩阵 (日期 x 时段)
# ============================================================


@router.get("/overview/matrix", response_model=dict)
async def get_exam_overview_matrix(
    db: AsyncSession = Depends(get_db),
) -> dict:
    """获取总览视图矩阵 (日期 x 时段)"""
    result = await db.execute(
        select(Exam)
        .where(Exam.status == ExamStatus.SCHEDULED)
        .options(selectinload(Exam.course), selectinload(Exam.time_slot))
    )
    exams = result.scalars().all()

    matrix: dict[str, dict[str, list[dict]]] = {}
    for day in range(1, 6):
        matrix[DAY_NAMES[day]] = {"T1": [], "T2": [], "T3": [], "T4": []}

    for exam in exams:
        if exam.time_slot:
            day_name = DAY_NAMES.get(exam.time_slot.day_of_week)
            slot_code = exam.time_slot.slot_code
            if day_name and slot_code:
                matrix[day_name][slot_code].append({
                    "exam_id": exam.id,
                    "course_id": exam.course_id,
                    "course_name": exam.course.name,
                    "exam_label": exam.exam_label.value if exam.exam_label else "",
                    "course_type": exam.course.course_type.value,
                })

    return {"code": 0, "message": "success", "data": {"matrix": matrix}}


# ============================================================
# 教师视图甘特图数据
# ============================================================


@router.get("/teachers/gantt", response_model=dict)
async def get_teacher_gantt(
    db: AsyncSession = Depends(get_db),
) -> dict:
    """获取教师视图甘特图数据"""
    result = await db.execute(
        select(ExamTeacher)
        .join(Exam, ExamTeacher.exam_id == Exam.id)
        .where(Exam.status == ExamStatus.SCHEDULED)
        .options(
            selectinload(ExamTeacher.teacher),
            selectinload(ExamTeacher.exam).selectinload(Exam.course),
            selectinload(ExamTeacher.exam).selectinload(Exam.time_slot),
        )
    )
    assignments = result.scalars().all()

    teacher_events: dict[int, dict] = {}
    for et in assignments:
        tid = et.teacher_id
        if tid not in teacher_events:
            teacher_events[tid] = {
                "teacher_id": tid,
                "teacher_name": et.teacher.name if et.teacher else f"教师{tid}",
                "events": [],
            }

        exam = et.exam
        if exam and exam.time_slot:
            teacher_events[tid]["events"].append({
                "exam_id": exam.id,
                "course_name": exam.course.name if exam.course else "",
                "exam_label": exam.exam_label.value if exam.exam_label else "",
                "day_of_week": exam.time_slot.day_of_week,
                "day_name": DAY_NAMES.get(exam.time_slot.day_of_week, ""),
                "slot_code": exam.time_slot.slot_code,
                "time_range": f"{exam.time_slot.start_time}-{exam.time_slot.end_time}",
                "role": et.role.value,
            })

    return {
        "code": 0,
        "message": "success",
        "data": {"teachers": list(teacher_events.values())},
    }


# ============================================================
# 教室视图矩阵
# ============================================================


@router.get("/classrooms/matrix", response_model=dict)
async def get_classroom_matrix(
    db: AsyncSession = Depends(get_db),
) -> dict:
    """获取教室视图矩阵"""
    result = await db.execute(
        select(ExamClassroom)
        .join(Exam, ExamClassroom.exam_id == Exam.id)
        .where(Exam.status == ExamStatus.SCHEDULED)
        .options(
            selectinload(ExamClassroom.classroom),
            selectinload(ExamClassroom.exam).selectinload(Exam.course),
            selectinload(ExamClassroom.exam).selectinload(Exam.time_slot),
        )
    )
    assignments = result.scalars().all()

    matrix: dict[str, dict[str, list[dict]]] = {}
    for ec in assignments:
        room_name = ec.classroom.name if ec.classroom else f"教室{ec.classroom_id}"
        if room_name not in matrix:
            matrix[room_name] = {}

        exam = ec.exam
        if exam and exam.time_slot:
            slot_key = f"{DAY_NAMES.get(exam.time_slot.day_of_week, '')}-{exam.time_slot.slot_code}"
            if slot_key not in matrix[room_name]:
                matrix[room_name][slot_key] = []
            matrix[room_name][slot_key].append({
                "exam_id": exam.id,
                "course_name": exam.course.name if exam.course else "",
                "exam_label": exam.exam_label.value if exam.exam_label else "",
                "total_students": ec.total_students,
            })

    return {"code": 0, "message": "success", "data": {"matrix": matrix}}


# ============================================================
# 班级考试时间表
# ============================================================


@router.get("/classes/{class_id}/schedule", response_model=dict)
async def get_class_schedule(
    class_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """获取班级考试时间表"""
    # 检查班级是否存在
    cls = await db.get(Class, class_id)
    if not cls:
        raise HTTPException(status_code=404, detail=f"班级(id={class_id})不存在")

    from app.models.exam_classroom_class import ExamClassroomClass

    result = await db.execute(
        select(Exam)
        .join(ExamClassroom, Exam.id == ExamClassroom.exam_id)
        .join(ExamClassroomClass, ExamClassroom.id == ExamClassroomClass.exam_classroom_id)
        .where(
            ExamClassroomClass.class_id == class_id,
            Exam.status == ExamStatus.SCHEDULED,
        )
        .options(
            selectinload(Exam.course),
            selectinload(Exam.time_slot),
            selectinload(Exam.classroom_assignments).selectinload(ExamClassroom.classroom),
        )
        .distinct()
    )
    exams = result.scalars().all()

    schedule = []
    for exam in exams:
        if exam.time_slot:
            schedule.append({
                "exam_id": exam.id,
                "course_name": exam.course.name if exam.course else "",
                "exam_label": exam.exam_label.value if exam.exam_label else "",
                "day_of_week": exam.time_slot.day_of_week,
                "day_name": DAY_NAMES.get(exam.time_slot.day_of_week, ""),
                "slot_code": exam.time_slot.slot_code,
                "time_range": f"{exam.time_slot.start_time}-{exam.time_slot.end_time}",
                "status": exam.status.value,
            })

    schedule.sort(key=lambda x: (x["day_of_week"], x["slot_code"]))

    return {
        "code": 0,
        "message": "success",
        "data": {
            "class_id": class_id,
            "class_name": cls.name,
            "grade": cls.grade,
            "exams": schedule,
        },
    }


# ============================================================
# 课程考试详情 (含AB卷分卷情况)
# ============================================================


@router.get("/courses/{course_id}/detail", response_model=dict)
async def get_course_exam_detail(
    course_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """获取课程考试详情 (含AB卷分卷情况)"""
    course = await db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail=f"课程(id={course_id})不存在")

    result = await db.execute(
        select(Exam)
        .where(Exam.course_id == course_id)
        .options(
            selectinload(Exam.time_slot),
            selectinload(Exam.classroom_assignments).selectinload(ExamClassroom.classroom),
            selectinload(Exam.classroom_assignments).selectinload(ExamClassroom.class_assignments),
            selectinload(Exam.teacher_assignments).selectinload(ExamTeacher.teacher),
        )
        .order_by(Exam.exam_label)
    )
    exams = result.scalars().all()

    exam_details = [_format_exam_detail(e) for e in exams]

    # AB卷分析
    ab_analysis = None
    if course.needs_ab and len(exams) >= 2:
        a_exam = next((e for e in exams if e.exam_label and e.exam_label.value == "A"), None)
        b_exam = next((e for e in exams if e.exam_label and e.exam_label.value == "B"), None)
        if a_exam and b_exam:
            a_students = sum(ec.total_students for ec in a_exam.classroom_assignments)
            b_students = sum(ec.total_students for ec in b_exam.classroom_assignments)
            ab_analysis = {
                "a_exam_id": a_exam.id,
                "b_exam_id": b_exam.id,
                "a_student_count": a_students,
                "b_student_count": b_students,
                "balance": "均衡" if abs(a_students - b_students) <= 5 else "不均衡",
                "a_time_slot": f"{DAY_NAMES.get(a_exam.time_slot.day_of_week, '')}-{a_exam.time_slot.slot_code}" if a_exam.time_slot else None,
                "b_time_slot": f"{DAY_NAMES.get(b_exam.time_slot.day_of_week, '')}-{b_exam.time_slot.slot_code}" if b_exam.time_slot else None,
            }

    return {
        "code": 0,
        "message": "success",
        "data": {
            "course_id": course_id,
            "course_name": course.name,
            "course_type": course.course_type.value,
            "needs_ab": course.needs_ab,
            "exams": exam_details,
            "ab_analysis": ab_analysis,
        },
    }


# ============================================================
# 辅助函数: 格式化考试详情
# ============================================================


def _format_exam_detail(exam: Exam) -> dict:
    """格式化考试详情为字典"""
    item = ExamResponse.model_validate(exam).model_dump()

    # 时段信息
    if exam.time_slot:
        item["time_slot"] = {
            "id": exam.time_slot.id,
            "day_of_week": exam.time_slot.day_of_week,
            "day_name": DAY_NAMES.get(exam.time_slot.day_of_week, ""),
            "slot_code": exam.time_slot.slot_code,
            "time_range": f"{exam.time_slot.start_time}-{exam.time_slot.end_time}",
        }

    # 教室信息
    item["classrooms"] = []
    for ec in exam.classroom_assignments:
        room_info = {
            "classroom_id": ec.classroom_id,
            "classroom_name": ec.classroom.name if ec.classroom else f"教室{ec.classroom_id}",
            "capacity": ec.classroom.capacity if ec.classroom else 0,
            "total_students": ec.total_students,
            "classes": [
                {"class_id": ca.class_id, "student_count": ca.student_count}
                for ca in ec.class_assignments
            ],
        }
        item["classrooms"].append(room_info)

    # 教师信息
    item["fixed_teachers"] = []
    item["patrol_teachers"] = []
    for et in exam.teacher_assignments:
        t_info = {
            "teacher_id": et.teacher_id,
            "teacher_name": et.teacher.name if et.teacher else f"教师{et.teacher_id}",
            "role": et.role.value,
            "classroom_id": et.classroom_id,
        }
        if et.role.value == "fixed":
            item["fixed_teachers"].append(t_info)
        else:
            item["patrol_teachers"].append(t_info)

    # 课程信息
    if exam.course:
        item["course_name"] = exam.course.name
        item["course_type"] = exam.course.course_type.value

    item["total_students"] = sum(ec.total_students for ec in exam.classroom_assignments)

    return item
