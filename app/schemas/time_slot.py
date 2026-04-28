"""
考试排考系统 - 时段数据模型 (Pydantic)
"""

from typing import Optional

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TimeSlotBase(BaseModel):
    """时段基础模型"""
    model_config = ConfigDict(from_attributes=True)

    day_of_week: int = Field(..., ge=1, le=5, description="星期几 (1=周一, ..., 5=周五)")
    slot_code: str = Field(..., pattern=r"^T[1-4]$", description="时段编码 (T1-T4)")
    start_time: str = Field(..., max_length=10, description="开始时间 (如 08:30)")
    end_time: str = Field(..., max_length=10, description="结束时间 (如 10:10)")
    is_continuous: bool = Field(default=True, description="是否与下一时段连续")


class TimeSlotCreate(TimeSlotBase):
    """创建时段请求模型"""
    pass


class TimeSlotUpdate(BaseModel):
    """更新时段请求模型"""
    model_config = ConfigDict(from_attributes=True)

    day_of_week: Optional[int] = Field(None, ge=1, le=5, description="星期几")
    slot_code: Optional[str] = Field(None, pattern=r"^T[1-4]$", description="时段编码")
    start_time: Optional[str] = Field(None, max_length=10, description="开始时间")
    end_time: Optional[str] = Field(None, max_length=10, description="结束时间")
    is_continuous: Optional[bool] = Field(None, description="是否连续")


class TimeSlotResponse(TimeSlotBase):
    """时段响应模型"""
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TimeSlotWithPatrolResponse(TimeSlotResponse):
    """时段响应模型 (含流动监考教师)"""
    patrol_teachers: list[dict] = Field(
        default_factory=list,
        description="该时段流动监考教师列表",
    )
