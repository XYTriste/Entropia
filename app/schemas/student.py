"""
考试排考系统 - 学生数据模型 (Pydantic)
"""

from typing import Optional

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class StudentBase(BaseModel):
    """学生基础模型"""
    model_config = ConfigDict(from_attributes=True)

    student_no: str = Field(..., max_length=30, description="学号 (全局唯一)")
    name: str = Field(..., max_length=50, description="学生姓名")
    class_id: int = Field(..., description="所属班级ID")


class StudentCreate(StudentBase):
    """创建学生请求模型"""
    class_name: Optional[str] = Field(None, description="班级名称（与grade二选一，优先于class_id）")
    grade: Optional[int] = Field(None, ge=1, le=4, description="年级（与class_name配合使用）")


class StudentUpdate(BaseModel):
    """更新学生请求模型"""
    model_config = ConfigDict(from_attributes=True)

    student_no: Optional[str] = Field(None, max_length=30, description="学号")
    name: Optional[str] = Field(None, max_length=50, description="姓名")
    class_id: Optional[int] = Field(None, description="所属班级ID")
    class_name: Optional[str] = Field(None, description="班级名称（与grade配合使用）")
    grade: Optional[int] = Field(None, ge=1, le=4, description="年级")


class StudentResponse(StudentBase):
    """学生响应模型"""
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class StudentBulkCreate(BaseModel):
    """批量创建学生请求"""
    students: list[StudentCreate]
