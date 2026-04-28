"""
考试排考系统 - CRUD 实例入口

聚合导入所有 CRUD 实例，便于路由层统一引用。
"""

from app.crud.base import CRUDBase
from app.models.audit_log import AuditLog
from app.models.class_ import Class
from app.models.classroom import Classroom
from app.models.course import Course
from app.models.exam import Exam
from app.models.major import Major
from app.models.schedule_version import ScheduleVersion
from app.models.student import Student
from app.models.teacher import Teacher
from app.models.time_slot import TimeSlot
from app.schemas.audit_log import AuditLogCreate, AuditLogUpdate
from app.schemas.class_ import ClassCreate, ClassUpdate
from app.schemas.classroom import ClassroomCreate, ClassroomUpdate
from app.schemas.course import CourseCreate, CourseUpdate
from app.schemas.exam import ExamCreate, ExamUpdate
from app.schemas.major import MajorCreate, MajorUpdate
from app.schemas.schedule_version import ScheduleVersionCreate, ScheduleVersionUpdate
from app.schemas.student import StudentCreate, StudentUpdate
from app.schemas.teacher import TeacherCreate, TeacherUpdate
from app.schemas.time_slot import TimeSlotCreate, TimeSlotUpdate

# 各实体 CRUD 实例
teacher = CRUDBase[Teacher, TeacherCreate, TeacherUpdate](Teacher)
major = CRUDBase[Major, MajorCreate, MajorUpdate](Major)
class_ = CRUDBase[Class, ClassCreate, ClassUpdate](Class)
student = CRUDBase[Student, StudentCreate, StudentUpdate](Student)
classroom = CRUDBase[Classroom, ClassroomCreate, ClassroomUpdate](Classroom)
course = CRUDBase[Course, CourseCreate, CourseUpdate](Course)
time_slot = CRUDBase[TimeSlot, TimeSlotCreate, TimeSlotUpdate](TimeSlot)
exam = CRUDBase[Exam, ExamCreate, ExamUpdate](Exam)
audit_log = CRUDBase[AuditLog, AuditLogCreate, AuditLogUpdate](AuditLog)
schedule_version = CRUDBase[ScheduleVersion, ScheduleVersionCreate, ScheduleVersionUpdate](ScheduleVersion)

__all__ = [
    "teacher",
    "major",
    "class_",
    "student",
    "classroom",
    "course",
    "time_slot",
    "exam",
    "audit_log",
    "schedule_version",
    "CRUDBase",
]
