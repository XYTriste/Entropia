"""
考试排考系统 - 课程模型

课程分为公共课与专业课，公共课支持教务处统一分配时段。
"""

import enum
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, Date, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.course_class import CourseClass
    from app.models.exam import Exam
    from app.models.time_slot import TimeSlot


class CourseType(str, enum.Enum):
    """课程类型枚举"""

    PUBLIC = "public"       # 公共课 (全校统一)
    MAJOR = "major"         # 专业课 (各学院自行)


class Course(Base):
    """课程实体"""

    __tablename__ = "courses"
    __table_args__ = {"comment": "课程表"}

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="课程名称",
    )

    course_type: Mapped[CourseType] = mapped_column(
        Enum(CourseType, name="course_type_enum", create_type=True),
        nullable=False,
        default=CourseType.MAJOR,
        comment="课程类型: public(公共课), major(专业课)",
    )

    # 是否需要 AB 卷 (同课程分两场考试)
    needs_ab: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="是否需要分AB卷考试",
    )

    # --- 公共课专用: 教务处已统一分配的时段 ---

    # 公共课由教务处统一分配的日期 (周一~周五中的某一天)
    dept_assigned_date: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        comment="公共课已分配日期 (1=周一, ..., 5=周五)",
    )

    dept_assigned_time_slot_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("time_slots.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
        index=True,
        comment="公共课已分配时段ID",
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        comment="是否启用",
    )

    # 关系: 公共课分配的时段
    dept_assigned_time_slot: Mapped[Optional["TimeSlot"]] = relationship(
        "TimeSlot",
        foreign_keys=[dept_assigned_time_slot_id],
        lazy="selectin",
    )

    # 关系: 课程-班级关联
    class_links: Mapped[List["CourseClass"]] = relationship(
        "CourseClass",
        back_populates="course",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    # 关系: 课程生成的考试 (1或2场)
    exams: Mapped[List["Exam"]] = relationship(
        "Exam",
        back_populates="course",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Course(id={self.id}, name={self.name}, type={self.course_type.value})>"