"""
考试排考系统 - 班级数据模型 (Pydantic)
"""

from typing import Optional

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ClassBase(BaseModel):
    """班级基础模型"""
    model_config = ConfigDict(from_attributes=True)

    name: str = Field(..., max_length=50, description="班级名称")
    major_id: int = Field(..., description="所属专业ID")
    grade: int = Field(..., ge=1, le=4, description="年级 (1=大一, 2=大二, 3=大三, 4=大四)")
    student_count: int = Field(default=0, ge=0, description="学生人数")


class ClassCreate(ClassBase):
    """创建班级请求模型"""
    pass


class ClassUpdate(BaseModel):
    """更新班级请求模型"""
    model_config = ConfigDict(from_attributes=True)

    name: Optional[str] = Field(None, max_length=50, description="班级名称")
    major_id: Optional[int] = Field(None, description="所属专业ID")
    grade: Optional[int] = Field(None, ge=1, le=4, description="年级 (1=大一, 2=大二, 3=大三, 4=大四)")
    student_count: Optional[int] = Field(None, ge=0, description="学生人数")


class ClassResponse(ClassBase):
    """班级响应模型"""
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
