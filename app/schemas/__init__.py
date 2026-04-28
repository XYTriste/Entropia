"""
考试排考系统 - Schema 包入口

聚合导入所有 Pydantic 模型，便于路由层统一引用。
"""

from app.schemas.audit_log import (
    AuditLogCreate,
    AuditLogFilter,
    AuditLogResponse,
)
from app.schemas.class_ import ClassCreate, ClassResponse, ClassUpdate
from app.schemas.classroom import (
    ClassroomCreate,
    ClassroomResponse,
    ClassroomUpdate,
)
from app.schemas.course import (
    CourseClassLink,
    CourseCreate,
    CourseResponse,
    CourseUpdate,
    CourseWithClassesResponse,
)
from app.schemas.exam import (
    ClassroomAssignment,
    ExamCreate,
    ExamResponse,
    ExamSchedule,
    ExamUpdate,
    MoveRequest,
    ScheduleResult,
    ScheduleRunRequest,
    SwapRequest,
    TeacherAssignment,
)
from app.schemas.major import MajorCreate, MajorResponse, MajorUpdate
from app.schemas.schedule_version import (
    ScheduleVersionCreate,
    ScheduleVersionResponse,
    ScheduleVersionUpdate,
)
from app.schemas.student import (
    StudentBulkCreate,
    StudentCreate,
    StudentResponse,
    StudentUpdate,
)
from app.schemas.teacher import (
    TeacherCreate,
    TeacherResponse,
    TeacherTransferRequest,
    TeacherUpdate,
)
from app.schemas.time_slot import TimeSlotCreate, TimeSlotResponse, TimeSlotUpdate

__all__ = [
    # Teacher
    "TeacherCreate",
    "TeacherUpdate",
    "TeacherResponse",
    "TeacherTransferRequest",
    # Major
    "MajorCreate",
    "MajorUpdate",
    "MajorResponse",
    # Class
    "ClassCreate",
    "ClassUpdate",
    "ClassResponse",
    # Student
    "StudentCreate",
    "StudentUpdate",
    "StudentResponse",
    "StudentBulkCreate",
    # Classroom
    "ClassroomCreate",
    "ClassroomUpdate",
    "ClassroomResponse",
    # Course
    "CourseCreate",
    "CourseUpdate",
    "CourseResponse",
    "CourseWithClassesResponse",
    "CourseClassLink",
    # TimeSlot
    "TimeSlotCreate",
    "TimeSlotUpdate",
    "TimeSlotResponse",
    # Exam / Schedule
    "ExamCreate",
    "ExamUpdate",
    "ExamResponse",
    "ClassroomAssignment",
    "TeacherAssignment",
    "ExamSchedule",
    "ScheduleResult",
    "SwapRequest",
    "MoveRequest",
    "ScheduleRunRequest",
    # ScheduleVersion
    "ScheduleVersionCreate",
    "ScheduleVersionUpdate",
    "ScheduleVersionResponse",
    # AuditLog
    "AuditLogCreate",
    "AuditLogResponse",
    "AuditLogFilter",
]
