"""
考试排考系统 - 教师模型

教师分为专任与兼职，有最大监考场次上限。
"""

import enum
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, Enum, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.exam_teacher import ExamTeacher
    from app.models.patrol_teacher import PatrolTeacher


class TeacherType(str, enum.Enum):
    """教师类型枚举"""

    FULL_TIME = "full_time"    # 专任教师
    PART_TIME = "part_time"    # 兼职教师


class Teacher(Base):
    """教师实体"""

    __tablename__ = "teachers"
    __table_args__ = {"comment": "教师表"}

    name: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="教师姓名",
    )

    teacher_type: Mapped[TeacherType] = mapped_column(
        Enum(TeacherType, name="teacher_type_enum", create_type=True),
        nullable=False,
        default=TeacherType.FULL_TIME,
        comment="教师类型: full_time(专任), part_time(兼职)",
    )

    # 最大监考场次上限 (0 表示不参与监考)
    max_slots: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="最大监考场次上限",
    )

    # 当前已排监考场次 (由排考引擎维护，手动调整后需同步)
    current_slots: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="当前已排监考场次",
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        comment="是否启用",
    )

    # 关系: 固定监考分配
    exam_teachers: Mapped[List["ExamTeacher"]] = relationship(
        "ExamTeacher",
        back_populates="teacher",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    # 关系: 流动监考分配
    patrol_assignments: Mapped[List["PatrolTeacher"]] = relationship(
        "PatrolTeacher",
        back_populates="teacher",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Teacher(id={self.id}, name={self.name}, type={self.teacher_type.value})>"