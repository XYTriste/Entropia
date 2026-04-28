"""
考试排考系统 - 考试模型

一门课程生成1场或2场考试(AB卷)。
每场考试占用一个时段，使用多个教室。
"""

import enum
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    Boolean,
    Enum,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.course import Course
    from app.models.exam_classroom import ExamClassroom
    from app.models.exam_teacher import ExamTeacher
    from app.models.time_slot import TimeSlot


class ExamStatus(str, enum.Enum):
    """考试状态枚举"""

    PENDING = "pending"       # 待排考
    SCHEDULED = "scheduled"  # 已排考
    FAILED = "failed"        # 排考失败


class ExamLabel(str, enum.Enum):
    """考试场次标签 (AB卷)"""

    A = "A"                 # A卷
    B = "B"                 # B卷


class Exam(Base):
    """考试实体"""

    __tablename__ = "exams"
    __table_args__ = (
        UniqueConstraint(
            "course_id", "exam_label",
            name="uqx_exam_course_label",
        ),
        {"comment": "考试表"},
    )

    course_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("courses.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        index=True,
        comment="所属课程ID",
    )

    time_slot_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("time_slots.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
        index=True,
        comment="分配时段ID",
    )

    # A卷 / B卷 / 无 (单卷考试为 NULL)
    exam_label: Mapped[Optional[ExamLabel]] = mapped_column(
        Enum(ExamLabel, name="exam_label_enum", create_type=True),
        nullable=True,
        comment="考试标签: A(A卷), B(B卷)",
    )

    status: Mapped[ExamStatus] = mapped_column(
        Enum(ExamStatus, name="exam_status_enum", create_type=True),
        nullable=False,
        default=ExamStatus.PENDING,
        comment="考试状态: pending(待排), scheduled(已排), failed(失败)",
    )

    is_locked: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="是否锁定 (防止自动调整)",
    )

    # 关系: 所属课程
    course: Mapped["Course"] = relationship("Course", back_populates="exams")

    # 关系: 分配的时段
    time_slot: Mapped[Optional["TimeSlot"]] = relationship(
        "TimeSlot",
        back_populates="exams",
        lazy="selectin",
    )

    # 关系: 使用的教室
    classroom_assignments: Mapped[List["ExamClassroom"]] = relationship(
        "ExamClassroom",
        back_populates="exam",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    # 关系: 分配的监考教师
    teacher_assignments: Mapped[List["ExamTeacher"]] = relationship(
        "ExamTeacher",
        back_populates="exam",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<Exam(id={self.id}, course_id={self.course_id}, "
            f"label={self.exam_label}, status={self.status.value})>"
        )