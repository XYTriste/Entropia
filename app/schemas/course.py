"""
考试排考系统 - 课程数据模型 (Pydantic)
"""

from typing import List, Optional

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.course import CourseType


class CourseClassLink(BaseModel):
    """课程-班级关联 (创建课程时传递)"""
    class_id: int = Field(..., description="班级ID")
    grade: int = Field(..., description="年级")


class CourseBase(BaseModel):
    """课程基础模型"""
    model_config = ConfigDict(from_attributes=True)

    name: str = Field(..., max_length=100, description="课程名称")
    course_type: CourseType = Field(
        default=CourseType.MAJOR,
        description="课程类型: public(公共课), major(专业课)",
    )
    needs_ab: bool = Field(default=False, description="是否需要分AB卷考试")
    dept_assigned_date: Optional[int] = Field(
        None, ge=1, le=5,
        description="公共课已分配日期 (1-5)",
    )
    dept_assigned_time_slot_id: Optional[int] = Field(
        None,
        description="公共课已分配时段ID",
    )
    is_active: bool = Field(default=True, description="是否启用")


class CourseCreate(CourseBase):
    """创建课程请求模型"""
    class_ids: List[CourseClassLink] = Field(
        default_factory=list,
        description="关联的班级列表",
    )


class CourseUpdate(BaseModel):
    """更新课程请求模型"""
    model_config = ConfigDict(from_attributes=True)

    name: Optional[str] = Field(None, max_length=100, description="课程名称")
    course_type: Optional[CourseType] = Field(None, description="课程类型")
    needs_ab: Optional[bool] = Field(None, description="是否需要AB卷")
    dept_assigned_date: Optional[int] = Field(None, ge=1, le=5, description="已分配日期")
    dept_assigned_time_slot_id: Optional[int] = Field(None, description="已分配时段ID")
    is_active: Optional[bool] = Field(None, description="是否启用")


class CourseResponse(CourseBase):
    """课程响应模型"""
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CourseWithClassesResponse(CourseResponse):
    """课程响应模型 (含关联班级)"""
    classes: List[dict] = Field(default_factory=list, description="关联班级列表")
