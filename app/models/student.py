"""
考试排考系统 - 学生模型

学生属于某一班级，学号全局唯一。
"""

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.class_ import Class


class Student(Base):
    """学生实体"""

    __tablename__ = "students"
    __table_args__ = {"comment": "学生表"}

    student_no: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        unique=True,
        index=True,
        comment="学号 (全局唯一)",
    )

    name: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="学生姓名",
    )

    class_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("classes.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        index=True,
        comment="所属班级ID",
    )

    # 关系: 所属班级
    class_: Mapped["Class"] = relationship("Class", back_populates="students")

    def __repr__(self) -> str:
        return f"<Student(id={self.id}, student_no={self.student_no}, name={self.name})>"