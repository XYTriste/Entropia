"""
考试排考系统 - 考试-教室-班级关联模型

记录某个考试在某个教室中具体有哪些班级参加考试。
每个教室最多容纳2个班级。
"""

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.class_ import Class
    from app.models.exam_classroom import ExamClassroom


class ExamClassroomClass(Base):
    """考试-教室-班级关联实体 (明确哪个班级在哪个教室考)"""

    __tablename__ = "exam_classroom_classes"
    __table_args__ = (
        UniqueConstraint(
            "exam_classroom_id", "class_id",
            name="uqx_exam_classroom_class",
        ),
        {"comment": "考试-教室-班级关联表"},
    )

    exam_classroom_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("exam_classrooms.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        index=True,
        comment="考试-教室关联ID",
    )

    class_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("classes.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False,
        index=True,
        comment="班级ID",
    )

    # 该班级在该教室的考生数
    student_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="该班级在此教室的考生人数",
    )

    # 关系
    exam_classroom: Mapped["ExamClassroom"] = relationship(
        "ExamClassroom",
        back_populates="class_assignments",
    )

    class_: Mapped["Class"] = relationship("Class", back_populates="exam_classroom_assignments")

    def __repr__(self) -> str:
        return (
            f"<ExamClassroomClass(ec_id={self.exam_classroom_id}, "
            f"class_id={self.class_id}, count={self.student_count})>"
        )