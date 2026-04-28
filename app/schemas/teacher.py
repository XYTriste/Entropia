"""
考试排考系统 - 教师数据模型 (Pydantic)

对应 Teacher ORM 模型的 CRUD Schema。
"""

from typing import Optional

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.teacher import TeacherType


class TeacherBase(BaseModel):
    """教师基础模型"""
    model_config = ConfigDict(from_attributes=True)

    name: str = Field(..., max_length=50, description="教师姓名")
    teacher_type: TeacherType = Field(
        default=TeacherType.FULL_TIME,
        description="教师类型: full_time(专任), part_time(兼职)",
    )
    max_slots: int = Field(default=0, ge=0, description="最大监考场次上限")
    current_slots: int = Field(default=0, ge=0, description="当前已排监考场次")
    is_active: bool = Field(default=True, description="是否启用")


class TeacherCreate(TeacherBase):
    """创建教师请求模型"""
    pass


class TeacherUpdate(BaseModel):
    """更新教师请求模型 (所有字段可选)"""
    model_config = ConfigDict(from_attributes=True)

    name: Optional[str] = Field(None, max_length=50, description="教师姓名")
    teacher_type: Optional[TeacherType] = Field(None, description="教师类型")
    max_slots: Optional[int] = Field(None, ge=0, description="最大监考场次上限")
    is_active: Optional[bool] = Field(None, description="是否启用")


class TeacherResponse(TeacherBase):
    """教师响应模型 (含ID和时间戳)"""
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class TeacherTransferRequest(BaseModel):
    """教师调剂请求"""
    model_config = ConfigDict(from_attributes=True)

    from_teacher_id: int = Field(..., description="源教师ID")
    to_teacher_id: int = Field(..., description="目标教师ID")
    exam_id: int = Field(..., description="考试ID")
    reason: Optional[str] = Field(None, max_length=255, description="调剂原因")
