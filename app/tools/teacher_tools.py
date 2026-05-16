"""
Teacher query tool for AI assistant.

Provides functions to query teacher exam assignments.
"""

from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import AsyncSessionLocal
from app.models.exam import Exam, ExamStatus
from app.models.exam_classroom import ExamClassroom
from app.models.exam_classroom_class import ExamClassroomClass
from app.models.exam_teacher import ExamTeacher, ExamTeacherRole
from app.models.patrol_teacher import PatrolTeacher
from app.models.teacher import Teacher
from app.models.time_slot import TimeSlot
from app.models.classroom import Classroom


DAY_NAMES_ZH = {1: "星期一", 2: "星期二", 3: "星期三", 4: "星期四", 5: "星期五"}


async def query_teacher_assignments(
    teacher_name: str,
    day_of_week: Optional[int] = None,
) -> dict:
    """
    查询教师监考安排。

    Args:
        teacher_name: 教师姓名（支持模糊匹配）
        day_of_week: 可选，过滤星期几（1-5），不传则返回所有安排

    Returns:
        dict with teacher info and assignments
    """
    async with AsyncSessionLocal() as db:
        # 1. 模糊匹配教师
        all_teachers_result = await db.execute(
            select(Teacher).where(Teacher.is_active == True)  # noqa: E712
        )
        all_teachers = all_teachers_result.scalars().all()

        # 模糊匹配
        pattern = teacher_name.strip().lower().replace(" ", "")
        matched_teachers = []
        for t in all_teachers:
            t_name = t.name.lower().replace(" ", "")
            if pattern == t_name or pattern in t_name or t_name in pattern:
                matched_teachers.append(t)

        if not matched_teachers:
            return {
                "found": False,
                "teacher_name": teacher_name,
                "message": f"未找到名为 '{teacher_name}' 的教师，请确认姓名是否正确。",
                "assignments": [],
                "patrol_slots": [],
            }

        # 查询所有匹配教师的监考安排
        teacher_results = []
        for teacher in matched_teachers:
            teacher_data = await _query_single_teacher(db, teacher, day_of_week)
            teacher_results.append(teacher_data)

        # 构建结果：包含所有教师的完整数据
        result = {
            "found": True,
            "teacher_name": teacher_name,
            "matched_count": len(matched_teachers),
            "teachers": teacher_results,
            # 保留向后兼容的字段（指向第一个教师）
            "teacher": teacher_results[0]["teacher"],
            "assignments": teacher_results[0]["assignments"],
            "patrol_slots": teacher_results[0]["patrol_slots"],
            "total_assignments": teacher_results[0]["total_assignments"],
            "ambiguous": None,
            "query": {
                "teacher_name": teacher_name,
                "day_of_week": day_of_week,
                "day_name": DAY_NAMES_ZH.get(day_of_week, "全部") if day_of_week else "全部",
            },
        }

        return result


async def _query_single_teacher(db, teacher, day_of_week=None) -> dict:
    """查询单个教师的监考安排"""
    # 1. 查询该教师的考试监考安排（ExamTeacher）
    exam_assignments_result = await db.execute(
        select(ExamTeacher)
        .options(
            selectinload(ExamTeacher.exam)
            .selectinload(Exam.course),
            selectinload(ExamTeacher.exam)
            .selectinload(Exam.time_slot),
            selectinload(ExamTeacher.exam)
            .selectinload(Exam.classroom_assignments)
            .selectinload(ExamClassroom.class_assignments)
            .selectinload(ExamClassroomClass.class_),
            selectinload(ExamTeacher.classroom),
        )
        .where(ExamTeacher.teacher_id == teacher.id)
        .join(ExamTeacher.exam)
        .where(Exam.status == ExamStatus.SCHEDULED)
        .join(Exam.time_slot)
    )
    exam_assignments = exam_assignments_result.scalars().all()

    # 过滤星期
    if day_of_week:
        exam_assignments = [
            ea for ea in exam_assignments
            if ea.exam.time_slot and ea.exam.time_slot.day_of_week == day_of_week
        ]

    # 2. 查询该教师的流动监考安排（PatrolTeacher）
    patrol_query = (
        select(PatrolTeacher)
        .options(
            selectinload(PatrolTeacher.time_slot),
        )
        .where(PatrolTeacher.teacher_id == teacher.id)
    )
    patrol_result = await db.execute(patrol_query)
    patrol_assignments = patrol_result.scalars().all()

    if day_of_week:
        patrol_assignments = [
            pa for pa in patrol_assignments
            if pa.time_slot and pa.time_slot.day_of_week == day_of_week
        ]

    # 3. 整理考试监考安排
    assignments_list = []
    for ea in exam_assignments:
        exam = ea.exam
        ts = exam.time_slot
        if not ts:
            continue

        # 获取该教师在当前考试、当前教室中监考的班级和人数
        class_names = []
        total_students = 0
        if exam.classroom_assignments:
            target_exam_classroom = None
            for ec in exam.classroom_assignments:
                if ec.classroom_id == ea.classroom_id:
                    target_exam_classroom = ec
                    break

            if target_exam_classroom:
                total_students = target_exam_classroom.total_students
                if target_exam_classroom.class_assignments:
                    for ecc in target_exam_classroom.class_assignments:
                        if ecc.class_:
                            class_names.append(ecc.class_.name)

        assignment_info = {
            "exam_id": exam.id,
            "course_name": exam.course.name if exam.course else f"Exam {exam.id}",
            "exam_label": exam.exam_label.value if exam.exam_label else None,
            "day_of_week": ts.day_of_week,
            "day_name": DAY_NAMES_ZH.get(ts.day_of_week, ""),
            "slot_code": ts.slot_code,
            "time_str": f"{ts.start_time}-{ts.end_time}",
            "role": "固定监考" if ea.role.value == "fixed" else "流动监考",
            "classroom": ea.classroom.name if ea.classroom else None,
            "class_names": class_names if class_names else None,
            "total_students": total_students if total_students > 0 else None,
            "patrol_group": ea.patrol_group_name if ea.patrol_group_name else None,
        }
        assignments_list.append(assignment_info)

    # 按天和时段排序
    assignments_list.sort(key=lambda x: (x["day_of_week"], x["slot_code"]))

    # 4. 整理流动监考安排（PatrolTeacher 表）
    patrol_list = []
    for pa in patrol_assignments:
        ts = pa.time_slot
        if not ts:
            continue
        patrol_list.append({
            "time_slot_id": ts.id,
            "day_of_week": ts.day_of_week,
            "day_name": DAY_NAMES_ZH.get(ts.day_of_week, ""),
            "slot_code": ts.slot_code,
            "time_str": f"{ts.start_time}-{ts.end_time}",
        })

    patrol_list.sort(key=lambda x: (x["day_of_week"], x["slot_code"]))

    # 5. 统计
    total_assignments = len(assignments_list) + len(patrol_list)

    return {
        "teacher": {
            "id": teacher.id,
            "name": teacher.name,
            "teacher_type": teacher.teacher_type.value,
            "max_slots": teacher.max_slots,
            "current_slots": teacher.current_slots,
        },
        "total_assignments": total_assignments,
        "assignments": assignments_list,
        "patrol_slots": patrol_list,
    }
