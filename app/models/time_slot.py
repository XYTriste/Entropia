"""
考试排考系统 - 时段模型

周一到周五，每天4个时段:
    T1 = 08:30-10:10
    T2 = 10:20-12:00
    T3 = 14:00-15:40
    T4 = 15:50-17:30
"""

from typing import TYPE_CHECKING, List

from sqlalchemy import Boolean, ForeignKey, Integer, String, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.exam import Exam
    from app.models.patrol_teacher import PatrolTeacher


class TimeSlot(Base):
    """时段实体"""

    __tablename__ = "time_slots"
    __table_args__ = {"comment": "时段表"}

    # 星期几 (1=周一, ..., 5=周五)
    day_of_week: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        index=True,
        comment="星期几 (1=周一, ..., 5=周五)",
    )

    # 时段编码 T1/T2/T3/T4
    slot_code: Mapped[str] = mapped_column(
        String(5),
        nullable=False,
        comment="时段编码 (T1, T2, T3, T4)",
    )

    start_time: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        comment="开始时间 (如 08:30)",
    )

    end_time: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        comment="结束时间 (如 10:10)",
    )

    # 是否与下一时段连排 (T2与T3不连排，中间有午休)
    is_continuous: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        comment="是否与下一时段连续",
    )

    # 关系: 该时段的考试
    exams: Mapped[List["Exam"]] = relationship(
        "Exam",
        back_populates="time_slot",
        lazy="selectin",
    )

    # 关系: 该时段的流动监考教师 (恰好3名)
    patrol_teachers: Mapped[List["PatrolTeacher"]] = relationship(
        "PatrolTeacher",
        back_populates="time_slot",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<TimeSlot(day={self.day_of_week}, slot={self.slot_code}, "
            f"time={self.start_time}-{self.end_time})>"
        )