"""
考试排考系统 - 班级模型

班级属于某一专业，包含多名学生。
同一专业下，(name, grade) 联合唯一。
"""

from typing import TYPE_CHECKING, List

from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.course_class import CourseClass
    from app.models.exam_classroom_class import ExamClassroomClass
    from app.models.major import Major
    from app.models.student import Student


class Class(Base):
    """班级实体"""

    __tablename__ = "classes"
    __table_args__ = (
        UniqueConstraint("name", "grade", name="uqx_class_name_grade"),
        {"comment": "班级表"},
    )

    name: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="班级名称",
    )

    major_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("majors.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False,
        index=True,
        comment="所属专业ID",
    )

    grade: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="年级 (如 2023)",
    )

    student_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="学生人数",
    )

    # 关系: 所属专业
    major: Mapped["Major"] = relationship("Major", back_populates="classes")

    # 关系: 班级学生
    students: Mapped[List["Student"]] = relationship(
        "Student",
        back_populates="class_",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    # 关系: 课程关联 (通过 CourseClass 中间表)
    course_links: Mapped[List["CourseClass"]] = relationship(
        "CourseClass",
        back_populates="class_",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    # 关系: 考试教室分配
    exam_classroom_assignments: Mapped[List["ExamClassroomClass"]] = relationship(
        "ExamClassroomClass",
        back_populates="class_",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Class(id={self.id}, name={self.name}, grade={self.grade}, major_id={self.major_id})>"