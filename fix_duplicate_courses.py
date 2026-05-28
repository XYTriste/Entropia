"""
数据库重复课程清理脚本

问题：课程表中存在同名重复记录（如两个"面向对象程序设计2/2"），
其中先插入的一条没有班级关联，导致排考时人数为0。

用法：
    cd Entropia
    python fix_duplicate_courses.py

脚本会自动：
1. 找出所有同名重复课程
2. 保留有班级关联的那条（或保留id最大的那条作为兜底）
3. 删除多余的重复记录及其关联
"""

import asyncio
import sys

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

sys.path.insert(0, "app")

from app.database import async_session_maker
from app.models.course import Course
from app.models.course_class import CourseClass
from app.models.exam import Exam
from app.models.exam_classroom import ExamClassroom
from app.models.exam_teacher import ExamTeacher
from app.models.exam_classroom_class import ExamClassroomClass


async def find_duplicate_courses(db: AsyncSession) -> dict[str, list[Course]]:
    """找出所有同名重复的课程"""
    result = await db.execute(select(Course).order_by(Course.id))
    all_courses = result.scalars().all()

    name_map: dict[str, list[Course]] = {}
    for c in all_courses:
        name_map.setdefault(c.name, []).append(c)

    return {name: courses for name, courses in name_map.items() if len(courses) > 1}


async def delete_course_safe(db: AsyncSession, course: Course) -> None:
    """安全删除课程及其所有关联数据"""
    course_id = course.id
    print(f"  正在删除 course_id={course_id} ('{course.name}') 及其关联...")

    # 1. 删除 exam_classroom_class 关联
    result = await db.execute(
        select(ExamClassroomClass).where(
            ExamClassroomClass.exam_id.in_(
                select(Exam.id).where(Exam.course_id == course_id)
            )
        )
    )
    for ecc in result.scalars().all():
        await db.delete(ecc)

    # 2. 删除 exam_teachers
    result = await db.execute(
        select(ExamTeacher).where(
            ExamTeacher.exam_id.in_(
                select(Exam.id).where(Exam.course_id == course_id)
            )
        )
    )
    for et in result.scalars().all():
        await db.delete(et)

    # 3. 删除 exam_classrooms
    result = await db.execute(
        select(ExamClassroom).where(ExamClassroom.exam_id.in_(
            select(Exam.id).where(Exam.course_id == course_id)
        ))
    )
    for ec in result.scalars().all():
        await db.delete(ec)

    # 4. 删除 exams
    result = await db.execute(select(Exam).where(Exam.course_id == course_id))
    for exam in result.scalars().all():
        await db.delete(exam)

    # 5. 删除 course_classes
    result = await db.execute(select(CourseClass).where(CourseClass.course_id == course_id))
    for cc in result.scalars().all():
        await db.delete(cc)

    # 6. 删除 course
    await db.delete(course)

    await db.flush()
    print(f"  已删除 course_id={course_id}")


async def main():
    async with async_session_maker() as db:
        print("=" * 60)
        print("重复课程清理工具")
        print("=" * 60)

        duplicates = await find_duplicate_courses(db)

        if not duplicates:
            print("\n未发现同名重复课程，数据库状态正常。")
            return

        print(f"\n发现 {len(duplicates)} 组同名重复课程：")
        for name, courses in duplicates.items():
            print(f"\n  课程名: '{name}'")
            for c in courses:
                link_count = len(c.class_links)
                exam_count = len(c.exams)
                print(f"    - id={c.id}, 关联班级={link_count}, 考试记录={exam_count}")

        print("\n" + "-" * 60)
        print("清理策略：保留关联班级最多（或id最大）的记录，删除其余")
        print("-" * 60)

        for name, courses in duplicates.items():
            print(f"\n处理 '{name}':")

            # 策略：优先保留有班级关联的；如果都没有/都有，保留id最大的
            courses_sorted = sorted(
                courses,
                key=lambda c: (len(c.class_links), c.id),
                reverse=True
            )
            keep = courses_sorted[0]
            to_delete = courses_sorted[1:]

            print(f"  保留: id={keep.id} (关联班级={len(keep.class_links)})")
            print(f"  删除: {', '.join(f'id={c.id}' for c in to_delete)}")

            for c in to_delete:
                await delete_course_safe(db, c)

        await db.commit()
        print("\n" + "=" * 60)
        print("清理完成！数据库已提交。")
        print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
