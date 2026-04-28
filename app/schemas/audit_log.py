"""
考试排考系统 - 审计日志数据模型 (Pydantic)
"""

from typing import Optional

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AuditLogBase(BaseModel):
    """审计日志基础模型"""
    model_config = ConfigDict(from_attributes=True)

    action: str = Field(..., max_length=30, description="操作类型")
    entity_type: str = Field(..., max_length=30, description="被操作实体类型")
    entity_id: int = Field(..., description="被操作实体ID")
    old_value: Optional[str] = Field(None, description="变更前值 (JSON)")
    new_value: Optional[str] = Field(None, description="变更后值 (JSON)")
    reason: Optional[str] = Field(None, max_length=255, description="操作原因")
    operator: str = Field(default="system", max_length=50, description="操作人")


class AuditLogCreate(AuditLogBase):
    """创建审计日志请求"""
    pass


class AuditLogUpdate(AuditLogBase):
    """更新审计日志请求"""
    action: Optional[str] = Field(None, max_length=30, description="操作类型")
    entity_type: Optional[str] = Field(None, max_length=30, description="被操作实体类型")
    entity_id: Optional[int] = Field(None, description="被操作实体ID")
    old_value: Optional[str] = Field(None, description="变更前值 (JSON)")
    new_value: Optional[str] = Field(None, description="变更后值 (JSON)")
    reason: Optional[str] = Field(None, max_length=255, description="操作原因")
    operator: Optional[str] = Field(None, max_length=50, description="操作人")


class AuditLogResponse(AuditLogBase):
    """审计日志响应"""
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AuditLogFilter(BaseModel):
    """审计日志筛选条件"""
    model_config = ConfigDict(from_attributes=True)

    action: Optional[str] = Field(None, description="操作类型")
    entity_type: Optional[str] = Field(None, description="实体类型")
    entity_id: Optional[int] = Field(None, description="实体ID")
    operator: Optional[str] = Field(None, description="操作人")
    date_from: Optional[str] = Field(None, description="起始日期")
    date_to: Optional[str] = Field(None, description="结束日期")
