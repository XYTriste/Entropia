"""
考试排考系统 - 考试教师关联模型

记录每场考试的固定监考教师和流动监考教师。
"""

import enum
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Enum, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.exam import Exam
    from app.models.teacher import Teacher


class ExamTeacherRole(str, enum.Enum):
    """监考角色枚举"""

    FIXED = "fixed"         # 固定监考 (在某教室)
    PATROL = "patrol"       # 流动监考 (巡场)


class ExamTeacher(Base):
    """考试-教师关联实体 (监考分配)"""

    __tablename__ = "exam_teachers"
    __table_args__ = (
        UniqueConstraint(
            "exam_id", "teacher_id", "role",
            name="uqx_exam_teacher_role",
        ),
        {"comment": "考试-监考教师关联表"},
    )

    exam_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("exams.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        index=True,
        comment="考试ID",
    )

    teacher_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("teachers.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False,
        index=True,
        comment="教师ID",
    )

    role: Mapped[ExamTeacherRole] = mapped_column(
        Enum(ExamTeacherRole, name="exam_teacher_role_enum", create_type=True),
        nullable=False,
        default=ExamTeacherRole.FIXED,
        comment="角色: fixed(固定监考), patrol(流动监考)",
    )

    # 如果是固定监考，可能关联某个教室
    classroom_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("classrooms.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
        comment="固定监考的教室ID",
    )

    # 关系
    exam: Mapped["Exam"] = relationship("Exam", back_populates="teacher_assignments")
    teacher: Mapped["Teacher"] = relationship("Teacher", back_populates="exam_teachers")

    def __repr__(self) -> str:
        return (
            f"<ExamTeacher(exam_id={self.exam_id}, "
            f"teacher_id={self.teacher_id}, role={self.role.value})>"
        )