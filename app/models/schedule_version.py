"""
考试排考系统 - 排考版本模型

每次排考生成一个版本，保存排考快照，支持版本切换与回滚。
"""

import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ScheduleVersionStatus(str, enum.Enum):
    """排考版本状态"""

    DRAFT = "draft"           # 草稿
    PUBLISHED = "published"   # 已发布
    ARCHIVED = "archived"     # 已归档


class ScheduleVersion(Base):
    """排考版本实体"""

    __tablename__ = "schedule_versions"
    __table_args__ = (
        {"comment": "排考版本表"},
    )

    # 版本号 (如 2024-01-15-001)
    version_no: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        unique=True,
        index=True,
        comment="版本号",
    )

    status: Mapped[ScheduleVersionStatus] = mapped_column(
        Enum(ScheduleVersionStatus, name="version_status_enum", create_type=True),
        nullable=False,
        default=ScheduleVersionStatus.DRAFT,
        comment="状态: draft(草稿), published(已发布), archived(已归档)",
    )

    # 版本描述
    description: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="版本描述",
    )

    # 排考数据快照 (JSON 格式，包含完整排考结果)
    data_snapshot: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="排考快照 (JSON)",
    )

    # 创建时间 (继承基类)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        comment="创建时间",
    )

    def __repr__(self) -> str:
        return (
            f"<ScheduleVersion(id={self.id}, version={self.version_no}, "
            f"status={self.status.value})>"
        )