"""
考试排考系统 - 课程-班级关联表

多对多中间表: 一门课程可以包含多个班级，一个班级可以有多门课程。
(course_id, class_id, grade) 联合唯一。
"""

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.class_ import Class
    from app.models.course import Course


class CourseClass(Base):
    """课程-班级关联实体 (中间表)"""

    __tablename__ = "course_classes"
    __table_args__ = (
        UniqueConstraint(
            "course_id", "class_id", "grade",
            name="uqx_course_class_grade",
        ),
        {"comment": "课程-班级关联表"},
    )

    course_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("courses.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        index=True,
        comment="课程ID",
    )

    class_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("classes.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        index=True,
        comment="班级ID",
    )

    grade: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="年级 (冗余用于联合唯一约束)",
    )

    # 关系
    course: Mapped["Course"] = relationship("Course", back_populates="class_links")
    class_: Mapped["Class"] = relationship("Class", back_populates="course_links")

    def __repr__(self) -> str:
        return f"<CourseClass(course_id={self.course_id}, class_id={self.class_id})>"