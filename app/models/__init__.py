"""
考试排考系统 - 模型包入口

聚合导入所有 ORM 模型，便于 Alembic 和外部模块统一引用。
"""

from app.models.audit_log import AuditLog
from app.models.base import Base
from app.models.class_ import Class
from app.models.classroom import Classroom
from app.models.course import Course
from app.models.course_class import CourseClass
from app.models.exam import Exam
from app.models.exam_classroom import ExamClassroom
from app.models.exam_classroom_class import ExamClassroomClass
from app.models.exam_teacher import ExamTeacher
from app.models.major import Major
from app.models.patrol_teacher import PatrolTeacher
from app.models.schedule_config import ScheduleConfig
from app.models.schedule_version import ScheduleVersion
from app.models.student import Student
from app.models.teacher import Teacher
from app.models.time_slot import TimeSlot

__all__ = [
    "Base",
    "Teacher",
    "Major",
    "Class",
    "Student",
    "Classroom",
    "Course",
    "CourseClass",
    "TimeSlot",
    "Exam",
    "ExamClassroom",
    "ExamClassroomClass",
    "ExamTeacher",
    "PatrolTeacher",
    "ScheduleConfig",
    "AuditLog",
    "ScheduleVersion",
]