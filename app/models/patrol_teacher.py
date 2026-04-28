"""
考试排考系统 - 时段流动监考教师模型

每个时段恰好分配3名流动监考教师，负责巡场。
"""

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.teacher import Teacher
    from app.models.time_slot import TimeSlot


class PatrolTeacher(Base):
    """时段流动监考教师实体"""

    __tablename__ = "patrol_teachers"
    __table_args__ = (
        UniqueConstraint(
            "time_slot_id", "teacher_id",
            name="uqx_patrol_teacher",
        ),
        {"comment": "时段流动监考教师表"},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    time_slot_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("time_slots.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        index=True,
        comment="时段ID",
    )

    teacher_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("teachers.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False,
        index=True,
        comment="教师ID",
    )

    # 关系
    time_slot: Mapped["TimeSlot"] = relationship(
        "TimeSlot",
        back_populates="patrol_teachers",
    )

    teacher: Mapped["Teacher"] = relationship(
        "Teacher",
        back_populates="patrol_assignments",
    )

    def __repr__(self) -> str:
        return (
            f"<PatrolTeacher(slot={self.time_slot_id}, "
            f"teacher={self.teacher_id})>"
        )