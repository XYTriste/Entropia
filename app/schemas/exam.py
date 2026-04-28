"""
考试排考系统 - 考试/排考结果数据模型 (Pydantic)

包含考试实体的 CRUD schema，以及排考结果、教室分配、教师分配等。
"""

from typing import List, Optional

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.exam import ExamLabel, ExamStatus


# ---------- 基础 CRUD Schema ----------

class ExamBase(BaseModel):
    """考试基础模型"""
    model_config = ConfigDict(from_attributes=True)

    course_id: int = Field(..., description="所属课程ID")
    time_slot_id: Optional[int] = Field(None, description="分配时段ID")
    exam_label: Optional[ExamLabel] = Field(None, description="考试标签: A/B")
    status: ExamStatus = Field(default=ExamStatus.PENDING, description="考试状态")
    is_locked: bool = Field(default=False, description="是否锁定")


class ExamCreate(ExamBase):
    """创建考试请求模型"""
    pass


class ExamUpdate(BaseModel):
    """更新考试请求模型"""
    model_config = ConfigDict(from_attributes=True)

    time_slot_id: Optional[int] = Field(None, description="时段ID")
    status: Optional[ExamStatus] = Field(None, description="考试状态")
    is_locked: Optional[bool] = Field(None, description="是否锁定")


class ExamResponse(ExamBase):
    """考试响应模型"""
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ---------- 教室分配 Schema ----------

class ClassroomAssignment(BaseModel):
    """教室分配信息"""
    model_config = ConfigDict(from_attributes=True)

    classroom_id: int = Field(..., description="教室ID")
    classroom_name: str = Field(..., description="教室名称")
    capacity: int = Field(..., description="教室容量")
    total_students: int = Field(..., description="分配学生数")
    classes: list[dict] = Field(default_factory=list, description="在该教室考试的班级")


# ---------- 教师分配 Schema ----------

class TeacherAssignment(BaseModel):
    """教师分配信息"""
    model_config = ConfigDict(from_attributes=True)

    teacher_id: int = Field(..., description="教师ID")
    teacher_name: str = Field(..., description="教师姓名")
    role: str = Field(..., description="角色: fixed/patrol")
    classroom_id: Optional[int] = Field(None, description="固定监考的教室ID")


# ---------- 排考结果 Schema ----------

class ExamSchedule(BaseModel):
    """单场考试排考详情"""
    model_config = ConfigDict(from_attributes=True)

    exam_id: int = Field(..., description="考试ID")
    course_id: int = Field(..., description="课程ID")
    course_name: str = Field(..., description="课程名称")
    exam_label: Optional[str] = Field(None, description="A/B卷标签")
    day_of_week: int = Field(..., description="星期几")
    slot_code: str = Field(..., description="时段编码")
    start_time: str = Field(..., description="开始时间")
    end_time: str = Field(..., description="结束时间")
    classrooms: List[ClassroomAssignment] = Field(
        default_factory=list,
        description="教室分配",
    )
    teachers: List[TeacherAssignment] = Field(
        default_factory=list,
        description="教师分配",
    )
    patrol_teachers: list[dict] = Field(
        default_factory=list,
        description="该时段流动监考",
    )


class ScheduleResult(BaseModel):
    """完整排考结果"""
    model_config = ConfigDict(from_attributes=True)

    version_id: int = Field(..., description="排考版本ID")
    version_no: str = Field(..., description="版本号")
    exams: List[ExamSchedule] = Field(..., description="排考列表")
    unscheduled: List[int] = Field(
        default_factory=list,
        description="未排考成功的考试ID列表",
    )


# ---------- 调剂操作 Schema ----------

class SwapRequest(BaseModel):
    """考试对换请求"""
    model_config = ConfigDict(from_attributes=True)

    exam_id_a: int = Field(..., description="考试A ID")
    exam_id_b: int = Field(..., description="考试B ID")
    reason: Optional[str] = Field(None, max_length=255, description="对换原因")


class MoveRequest(BaseModel):
    """考试移动请求 (变更时段/教室)"""
    model_config = ConfigDict(from_attributes=True)

    exam_id: int = Field(..., description="考试ID")
    target_time_slot_id: Optional[int] = Field(None, description="目标时段ID")
    target_classroom_ids: Optional[List[int]] = Field(
        None,
        description="目标教室ID列表",
    )
    reason: Optional[str] = Field(None, max_length=255, description="移动原因")


class ScheduleRunRequest(BaseModel):
    """运行排考引擎请求"""
    model_config = ConfigDict(from_attributes=True)

    course_ids: Optional[List[int]] = Field(
        None,
        description="指定排考的课程ID列表 (None=全部)",
    )
    max_solve_time: int = Field(default=300, ge=10, le=3600, description="最大求解时间(秒)")
    strategy: str = Field(
        default="balanced",
        pattern=r"^(balanced|fast|thorough)$",
        description="求解策略",
    )
