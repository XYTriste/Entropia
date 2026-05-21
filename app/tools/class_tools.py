"""
Class query tool for AI assistant.

Provides functions to query class exam arrangements.
"""

from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import AsyncSessionLocal
from app.models.class_ import Class
from app.models.exam import Exam, ExamStatus
from app.models.exam_classroom import ExamClassroom
from app.models.exam_classroom_class import ExamClassroomClass
from app.models.exam_teacher import ExamTeacher, ExamTeacherRole
from app.models.patrol_teacher import PatrolTeacher
from app.models.time_slot import TimeSlot


DAY_NAMES_ZH = {1: "星期一", 2: "星期二", 3: "星期三", 4: "星期四", 5: "星期五"}


async def query_class_exams(
    class_name: str,
    day_of_week: Optional[int] = None,
) -> dict:
    """
    查询班级的考试安排。

    Args:
        class_name: 班级名称(支持模糊匹配)
        day_of_week: 可选,过滤星期几(1-5),不传则返回所有安排

    Returns:
        dict with class info and exam arrangements
    """
    async with AsyncSessionLocal() as db:
        # 1. 模糊匹配班级
        all_classes_result = await db.execute(
            select(Class).options(selectinload(Class.major))
        )
        all_classes = all_classes_result.scalars().all()

        pattern = class_name.strip().lower().replace(" ", "")
        matched_classes = []
        for c in all_classes:
            c_name = c.name.lower().replace(" ", "")
            if pattern == c_name or pattern in c_name or c_name in pattern:
                matched_classes.append(c)

        if not matched_classes:
            return {
                "found": False,
                "class_name": class_name,
                "message": f"未找到名为 '{class_name}' 的班级,请确认班级名称是否正确。",
                "classes": [],
                "total_exams": 0,
            }

        # 2. 查询每个匹配班级的考试安排
        class_results = []
        for cls in matched_classes:
            # 通过 ExamClassroomClass 查询该班级实际参与的已排考考试
            # （而非通过 CourseClass → Course → Exam，避免返回班级未参加的 AB 卷另一场）
            exams_query = (
                select(Exam)
                .join(ExamClassroom, ExamClassroom.exam_id == Exam.id)
                .join(
                    ExamClassroomClass,
                    ExamClassroomClass.exam_classroom_id == ExamClassroom.id,
                )
                .where(
                    ExamClassroomClass.class_id == cls.id,
                    Exam.status == ExamStatus.SCHEDULED,
                )
                .distinct()
                .options(
                    selectinload(Exam.course),
                    selectinload(Exam.time_slot)
                    .selectinload(TimeSlot.patrol_teachers)
                    .selectinload(PatrolTeacher.teacher),
                    selectinload(Exam.classroom_assignments)
                    .selectinload(ExamClassroom.classroom),
                    selectinload(Exam.classroom_assignments)
                    .selectinload(ExamClassroom.class_assignments)
                    .selectinload(ExamClassroomClass.class_),
                    selectinload(Exam.teacher_assignments)
                    .selectinload(ExamTeacher.teacher),
                    selectinload(Exam.teacher_assignments)
                    .selectinload(ExamTeacher.classroom),
                )
            )
            exams_result = await db.execute(exams_query)
            exams = exams_result.scalars().all()

            # 过滤星期
            if day_of_week:
                exams = [
                    e for e in exams
                    if e.time_slot and e.time_slot.day_of_week == day_of_week
                ]

            # 整理考试数据
            exams_list = []
            for exam in exams:
                ts = exam.time_slot
                if not ts:
                    continue

                # 筛选该班级相关的教室和人数
                exam_classrooms = []
                student_count = 0
                fixed_teachers = set()

                for ec in exam.classroom_assignments:
                    has_this_class = False
                    classroom_students = 0
                    for ecc in ec.class_assignments:
                        if ecc.class_ and ecc.class_.id == cls.id:
                            has_this_class = True
                            classroom_students = ecc.student_count
                            student_count += ecc.student_count
                            break

                    if has_this_class:
                        if ec.classroom:
                            exam_classrooms.append({
                                "name": ec.classroom.name,
                                "students": classroom_students,
                            })

                        # 获取该教室的固定监考老师
                        for et in exam.teacher_assignments:
                            if (
                                et.role == ExamTeacherRole.FIXED
                                and et.classroom_id == ec.classroom_id
                                and et.teacher
                            ):
                                fixed_teachers.add(et.teacher.name)

                # 获取流动监考老师(按时段)
                patrol_teachers = []
                if ts.patrol_teachers:
                    for pt in ts.patrol_teachers:
                        if pt.teacher:
                            patrol_teachers.append(pt.teacher.name)

                exams_list.append({
                    "course_name": (
                        exam.course.name if exam.course else f"Exam {exam.id}"
                    ),
                    "exam_label": (
                        exam.exam_label.value if exam.exam_label else None
                    ),
                    "day_of_week": ts.day_of_week,
                    "day_name": DAY_NAMES_ZH.get(ts.day_of_week, ""),
                    "slot_code": ts.slot_code,
                    "time_str": f"{ts.start_time}-{ts.end_time}",
                    "classrooms": exam_classrooms if exam_classrooms else None,
                    "student_count": (
                        student_count if student_count > 0 else None
                    ),
                    "fixed_teachers": (
                        sorted(list(fixed_teachers)) if fixed_teachers else None
                    ),
                    "patrol_teachers": (
                        patrol_teachers if patrol_teachers else None
                    ),
                })

            # 按时间排序
            exams_list.sort(key=lambda x: (x["day_of_week"], x["slot_code"]))

            class_results.append({
                "id": cls.id,
                "name": cls.name,
                "grade": cls.grade,
                "major": cls.major.name if cls.major else None,
                "student_count": cls.student_count,
                "exams": exams_list,
                "total_exams": len(exams_list),
            })

        # 构建结果
        result = {
            "found": True,
            "class_name": class_name,
            "matched_count": len(matched_classes),
            "classes": class_results,
            "total_exams": sum(c["total_exams"] for c in class_results),
            "query": {
                "class_name": class_name,
                "day_of_week": day_of_week,
                "day_name": (
                    DAY_NAMES_ZH.get(day_of_week, "全部")
                    if day_of_week else "全部"
                ),
            },
        }

        return result
