"""
考试排考系统 - 排考配置模型

存储排考引擎的运行时配置，包括：
- 每教室固定监考人数
- 流动监考人数及分组规则
- 教室优先级规则
- 教师分配软约束
"""

from datetime import date, datetime, timezone, timedelta
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, Float, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

# 国内时区 UTC+8
CN_TZ = timezone(timedelta(hours=8))


class ScheduleConfig(Base):
    """排考配置实体 (单条记录表)"""

    __tablename__ = "schedule_configs"
    __table_args__ = {"comment": "排考配置表"}

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        comment="配置ID",
    )

    # 每教室固定监考人数 (1 或 2)
    fixed_teachers_per_room: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
        comment="每教室固定监考人数",
    )

    # 每个时段对(上午/下午)的流动监考人数
    patrol_teacher_count_per_slot_pair: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=2,
        comment="每时段对流动监考人数",
    )

    # 流动监考分组规则 (JSON)
    patrol_group_rules: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment='流动监考分组规则JSON，例如: [{"group_name":"5-2及理东二","patterns":["5-2*","理东二"]},{"group_name":"5-3","patterns":["5-3*"]}]',
    )

    # 教室优先级规则 (JSON)
    classroom_priority_rules: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment='教室优先级规则JSON，例如: [{"priority":1,"patterns":["5-2*"]},{"priority":2,"patterns":["5-3*"]}]',
    )

    # 教师分配软约束：最大监考天数上限
    max_days: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=3,
        comment="最大监考天数上限",
    )

    # 教师分配软约束：是否启用最大监考天数约束（默认开启）
    enable_max_days_constraint: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        comment="是否启用最大监考天数约束",
    )

    # 教师分配软约束：是否启用日期连续性约束（默认开启）
    enable_day_continuity_constraint: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        comment="是否启用日期连续性约束",
    )

    # 考试起始日期 (多周排考支持)
    exam_start_date: Mapped[Optional[date]] = mapped_column(
        Date,
        nullable=True,
        comment="考试起始日期",
    )

    # 考试周数 (默认1周, 最多4周)
    exam_weeks: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
        comment="考试周数 (1-4)",
    )

    # AB卷分配：是否优先将同专业班级集中到同一卷
    ab_major_preference: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="AB卷同专业集中偏好",
    )

    # AB卷分配：人数均衡容忍度（0.0~1.0）
    ab_major_tolerance: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0.15,
        comment="AB卷同专业集中的人数均衡容忍度",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(CN_TZ),
        comment="创建时间 (国内时区)",
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(CN_TZ),
        onupdate=lambda: datetime.now(CN_TZ),
        comment="更新时间 (国内时区)",
    )
