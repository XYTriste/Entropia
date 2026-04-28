"""
考试排考系统 - 考试-教室关联模型

每场考试使用多个教室，每个教室容纳若干班级学生。
"""

from typing import TYPE_CHECKING, List

from sqlalchemy import ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.classroom import Classroom
    from app.models.exam import Exam
    from app.models.exam_classroom_class import ExamClassroomClass


class ExamClassroom(Base):
    """考试-教室关联实体 (中间表，含人数统计)"""

    __tablename__ = "exam_classrooms"
    __table_args__ = (
        UniqueConstraint(
            "exam_id", "classroom_id",
            name="uqx_exam_classroom",
        ),
        {"comment": "考试-教室关联表"},
    )

    exam_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("exams.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        index=True,
        comment="考试ID",
    )

    classroom_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("classrooms.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False,
        index=True,
        comment="教室ID",
    )

    # 该教室分配的学生总数
    total_students: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="该教室容纳的学生总数",
    )

    # 关系: 所属考试
    exam: Mapped["Exam"] = relationship("Exam", back_populates="classroom_assignments")

    # 关系: 使用的教室
    classroom: Mapped["Classroom"] = relationship(
        "Classroom",
        back_populates="exam_assignments",
    )

    # 关系: 该教室中具体哪些班级考试
    class_assignments: Mapped[List["ExamClassroomClass"]] = relationship(
        "ExamClassroomClass",
        back_populates="exam_classroom",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<ExamClassroom(exam_id={self.exam_id}, "
            f"classroom_id={self.classroom_id}, students={self.total_students})>"
        )