"""
考试排考系统 - 专业模型

专业作为顶层组织单位，包含多个班级。
"""

from typing import TYPE_CHECKING, List

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.class_ import Class


class Major(Base):
    """专业实体"""

    __tablename__ = "majors"
    __table_args__ = {"comment": "专业表"}

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        unique=True,
        index=True,
        comment="专业名称",
    )

    # 关系: 专业下的班级
    classes: Mapped[List["Class"]] = relationship(
        "Class",
        back_populates="major",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Major(id={self.id}, name={self.name})>"