"""
考试排考系统 - 专业数据模型 (Pydantic)
"""

from typing import List, Optional

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class MajorBase(BaseModel):
    """专业基础模型"""
    model_config = ConfigDict(from_attributes=True)

    name: str = Field(..., max_length=100, description="专业名称")


class MajorCreate(MajorBase):
    """创建专业请求模型"""
    pass


class MajorUpdate(BaseModel):
    """更新专业请求模型"""
    model_config = ConfigDict(from_attributes=True)

    name: Optional[str] = Field(None, max_length=100, description="专业名称")


class MajorResponse(MajorBase):
    """专业响应模型"""
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
