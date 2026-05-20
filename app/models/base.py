"""
考试排考系统 - SQLAlchemy 模型基类

所有 ORM 模型继承自 Base，自动包含 created_at / updated_at 审计字段。
"""

from datetime import datetime, timezone, timedelta
from typing import Any

from sqlalchemy import DateTime, Integer
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# 国内时区 UTC+8（模块级别，供 lambda 访问）
CN_TZ = timezone(timedelta(hours=8))


class Base(DeclarativeBase):
    """
    SQLAlchemy 声明式基类

    所有模型继承此类，自动获得：
    - id: 主键
    - created_at: 创建时间 (国内时区 UTC+8)
    - updated_at: 更新时间 (国内时区 UTC+8)
    """

    __abstract__ = True

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True, comment="主键ID"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(CN_TZ),
        nullable=False,
        comment="创建时间 (国内时区)",
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(CN_TZ),
        onupdate=lambda: datetime.now(CN_TZ),
        nullable=False,
        comment="更新时间 (国内时区)",
    )
