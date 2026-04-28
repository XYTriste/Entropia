"""
考试排考系统 - 教室数据模型 (Pydantic)
"""

from typing import Optional

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.classroom import ClassroomType


class ClassroomBase(BaseModel):
    """教室基础模型"""
    model_config = ConfigDict(from_attributes=True)

    name: str = Field(..., max_length=50, description="教室名称")
    capacity: int = Field(default=40, ge=1, description="容纳人数")
    room_type: ClassroomType = Field(
        default=ClassroomType.REGULAR,
        description="教室类型: regular(普通), lecture(阶梯)",
    )
    building: str = Field(default="", max_length=50, description="所在教学楼")
    floor: int = Field(default=1, ge=1, le=20, description="所在楼层")
    is_active: bool = Field(default=True, description="是否启用")


class ClassroomCreate(ClassroomBase):
    """创建教室请求模型"""
    pass


class ClassroomUpdate(BaseModel):
    """更新教室请求模型"""
    model_config = ConfigDict(from_attributes=True)

    name: Optional[str] = Field(None, max_length=50, description="教室名称")
    capacity: Optional[int] = Field(None, ge=1, description="容纳人数")
    room_type: Optional[ClassroomType] = Field(None, description="教室类型")
    building: Optional[str] = Field(None, max_length=50, description="所在教学楼")
    floor: Optional[int] = Field(None, ge=1, le=20, description="所在楼层")
    is_active: Optional[bool] = Field(None, description="是否启用")


class ClassroomResponse(ClassroomBase):
    """教室响应模型"""
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
