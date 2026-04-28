"""
考试排考系统 - FactoryBoy 测试数据工厂

提供各模型的数据工厂，用于快速生成测试数据。
"""

import factory
from factory import Faker, Sequence, Iterator

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.models import (
    Teacher,
    Major,
    Class,
    Student,
    Classroom,
    Course,
    CourseClass,
    TimeSlot,
    Exam,
    ExamClassroom,
    ExamClassroomClass,
    ExamTeacher,
    PatrolTeacher,
    AuditLog,
    ScheduleVersion,
)
from app.models.teacher import TeacherType
from app.models.classroom import ClassroomType
from app.models.course import CourseType
from app.models.exam import ExamStatus, ExamLabel
from app.models.schedule_version import ScheduleVersionStatus
from app.models.exam_teacher import ExamTeacherRole


class TeacherFactory(factory.Factory):
    """教师工厂"""

    class Meta:
        model = Teacher

    name = Sequence(lambda n: f"教师{n:03d}")
    teacher_type = Iterator([TeacherType.FULL_TIME, TeacherType.PART_TIME])
    max_slots = Iterator([4, 5, 6])
    current_slots = 0
    is_active = True


class ClassroomFactory(factory.Factory):
    """教室工厂"""

    class Meta:
        model = Classroom

    name = Sequence(lambda n: f"A{n+1:03d}")
    capacity = Iterator([50, 60, 80, 120])
    room_type = Iterator([ClassroomType.REGULAR, ClassroomType.LECTURE])
    building = "A楼"
    floor = Iterator([1, 2, 3])
    is_active = True


class MajorFactory(factory.Factory):
    """专业工厂"""

    class Meta:
        model = Major

    name = Sequence(lambda n: f"专业{n+1:02d}")


class ClassFactory(factory.Factory):
    """班级工厂"""

    class Meta:
        model = Class

    name = Sequence(lambda n: f"班级{n+1:02d}")
    major_id = 1
    grade = Iterator([2023, 2024])
    student_count = Iterator(range(25, 55))


class StudentFactory(factory.Factory):
    """学生工厂"""

    class Meta:
        model = Student

    student_no = Sequence(lambda n: f"2023{n+1:08d}")
    name = Sequence(lambda n: f"学生{n+1:04d}")
    class_id = 1


class CourseFactory(factory.Factory):
    """课程工厂"""

    class Meta:
        model = Course

    name = Sequence(lambda n: f"课程{n+1:02d}")
    course_type = CourseType.MAJOR
    needs_ab = False
    is_active = True


class TimeSlotFactory(factory.Factory):
    """时段工厂"""

    class Meta:
        model = TimeSlot

    day_of_week = Iterator([1, 2, 3, 4, 5])
    slot_code = Iterator(["T1", "T2", "T3", "T4"])
    start_time = "08:30"
    end_time = "10:10"
    is_continuous = True


class CourseClassFactory(factory.Factory):
    """课程-班级关联工厂"""

    class Meta:
        model = CourseClass

    course_id = 1
    class_id = 1
    grade = 2023


class ExamFactory(factory.Factory):
    """考试工厂"""

    class Meta:
        model = Exam

    course_id = 1
    time_slot_id = 1
    status = ExamStatus.SCHEDULED


class ExamClassroomFactory(factory.Factory):
    """考试-教室关联工厂"""

    class Meta:
        model = ExamClassroom

    exam_id = 1
    classroom_id = 1
    total_students = 40


class ExamClassroomClassFactory(factory.Factory):
    """考试-教室-班级关联工厂"""

    class Meta:
        model = ExamClassroomClass

    exam_classroom_id = 1
    class_id = 1
    student_count = 40


class ExamTeacherFactory(factory.Factory):
    """考试-教师关联工厂"""

    class Meta:
        model = ExamTeacher

    exam_id = 1
    teacher_id = 1
    role = ExamTeacherRole.FIXED


class AuditLogFactory(factory.Factory):
    """审计日志工厂"""

    class Meta:
        model = AuditLog

    action = "create"
    entity_type = "exam"
    entity_id = 1
    reason = "测试操作"
    operator = "system"


class ScheduleVersionFactory(factory.Factory):
    """排考版本工厂"""

    class Meta:
        model = ScheduleVersion

    version_no = Sequence(lambda n: f"20240101-{n+1:03d}")
    status = ScheduleVersionStatus.DRAFT
    description = "测试版本"
