"""
考试排考系统 - 审计日志模型

记录所有手动调整操作，支持排考回溯与审计。
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AuditLog(Base):
    """审计日志实体"""

    __tablename__ = "audit_logs"
    __table_args__ = (
        {"comment": "审计日志表"},
    )

    # 操作类型: create / update / delete / transfer / swap / schedule
    action: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        index=True,
        comment="操作类型",
    )

    entity_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        comment="被操作实体类型: exam / teacher / classroom 等",
    )

    entity_id: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="被操作实体ID",
    )

    # 变更前数据快照 (JSON)
    old_value: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="变更前值 (JSON)",
    )

    # 变更后数据快照 (JSON)
    new_value: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="变更后值 (JSON)",
    )

    # 操作原因说明
    reason: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="操作原因",
    )

    # 操作人
    operator: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="system",
        comment="操作人",
    )

    # 创建时间 (继承基类 created_at，但这里显式冗余以便索引)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
        comment="操作时间",
    )

    def __repr__(self) -> str:
        return (
            f"<AuditLog(action={self.action}, entity={self.entity_type}, "
            f"id={self.entity_id}, operator={self.operator})>"
        )