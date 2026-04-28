"""
考试排考系统 - 教室模型

教室有容量、类型(普通/阶梯)、所在建筑楼层等属性。
"""

import enum
from typing import TYPE_CHECKING, List

from sqlalchemy import Boolean, Enum, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.exam_classroom import ExamClassroom


class ClassroomType(str, enum.Enum):
    """教室类型枚举"""

    REGULAR = "regular"     # 普通教室
    LECTURE = "lecture"     # 阶梯教室


class Classroom(Base):
    """教室实体"""

    __tablename__ = "classrooms"
    __table_args__ = {"comment": "教室表"}

    name: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        unique=True,
        comment="教室名称 (如 A-101)",
    )

    capacity: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=40,
        comment="容纳人数",
    )

    room_type: Mapped[ClassroomType] = mapped_column(
        Enum(ClassroomType, name="classroom_type_enum", create_type=True),
        nullable=False,
        default=ClassroomType.REGULAR,
        comment="教室类型: regular(普通), lecture(阶梯)",
    )

    building: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="",
        comment="所在教学楼",
    )

    floor: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
        comment="所在楼层",
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        comment="是否启用",
    )

    # 关系: 考试占用
    exam_assignments: Mapped[List["ExamClassroom"]] = relationship(
        "ExamClassroom",
        back_populates="classroom",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<Classroom(id={self.id}, name={self.name}, "
            f"capacity={self.capacity}, type={self.room_type.value})>"
        )