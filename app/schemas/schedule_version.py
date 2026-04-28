"""
考试排考系统 - 排考版本数据模型 (Pydantic)
"""

from typing import Optional

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.schedule_version import ScheduleVersionStatus


class ScheduleVersionBase(BaseModel):
    """排考版本基础模型"""
    model_config = ConfigDict(from_attributes=True)

    version_no: str = Field(..., max_length=30, description="版本号")
    status: ScheduleVersionStatus = Field(default=ScheduleVersionStatus.DRAFT, description="状态")
    description: Optional[str] = Field(None, max_length=255, description="版本描述")


class ScheduleVersionCreate(ScheduleVersionBase):
    """创建排考版本请求模型"""
    data_snapshot: Optional[str] = Field(None, description="排考快照 JSON")


class ScheduleVersionUpdate(BaseModel):
    """更新排考版本请求模型"""
    model_config = ConfigDict(from_attributes=True)

    status: Optional[ScheduleVersionStatus] = Field(None, description="状态")
    description: Optional[str] = Field(None, max_length=255, description="版本描述")


class ScheduleVersionResponse(ScheduleVersionBase):
    """排考版本响应模型"""
    id: int
    data_snapshot: Optional[str] = None
    created_at: Optional[datetime] = None
