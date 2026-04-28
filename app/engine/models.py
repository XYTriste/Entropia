"""
数据模型定义文件
定义排考系统所需的所有数据模型，供引擎各模块使用
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal


# ============================================================
# 教师模型
# ============================================================
@dataclass
class Teacher:
    """教师模型"""
    id: int
    name: str
    teacher_type: Literal["full_time", "part_time"]  # 专任教师优先
    max_slots: int  # 最大监考场次


# ============================================================
# 教室模型
# ============================================================
@dataclass
class Classroom:
    """教室模型"""
    id: int
    name: str
    capacity: int
    room_type: Literal["regular", "tiered"]  # 阶梯教室
    is_active: bool
    floor: int = 1  # 楼层，用于同楼层优先约束


# ============================================================
# 班级模型
# ============================================================
@dataclass
class Class:
    """班级模型"""
    id: int
    name: str
    student_count: int
    grade: int
    major_id: int


# ============================================================
# 课程-班级关联
# ============================================================
@dataclass
class CourseClass:
    """课程-班级关联"""
    course_id: int
    class_id: int
    grade: int
    class_: Class


# ============================================================
# 课程模型
# ============================================================
@dataclass
class Course:
    """课程模型"""
    id: int
    name: str
    course_type: Literal["public", "major"]  # 公共课/专业课
    needs_ab: bool  # 是否需要AB卷
    dept_assigned_date: int = 0  # 公共课指定日期(1-5)，0表示未指定
    dept_assigned_time_slot_id: int = 0  # 公共课指定时段，0表示未指定
    class_links: list[CourseClass] = field(default_factory=list)  # 关联的班级列表


# ============================================================
# 时段模型（共20个时段，周一到周五每天4个）
# ============================================================
@dataclass
class TimeSlot:
    """时段模型"""
    id: int
    day_of_week: int  # 1-5
    slot_code: str  # T1, T2, T3, T4
    start_time: str  # 08:30
    end_time: str  # 10:10
    is_continuous: bool  # T1与T2连续，T3与T4连续

    # 时段对映射：连续时段对 (T1,T2) -> slot_pair = 1, (T3,T4) -> slot_pair = 2
    @property
    def slot_pair(self) -> int:
        """返回时段对编号：T1/T2=1, T3/T4=2"""
        if self.slot_code in ("T1", "T2"):
            return 1
        return 2


# ============================================================
# 考试-教室-班级
# ============================================================
@dataclass
class ExamClassroomClass:
    """考试-教室-班级关联"""
    class_id: int
    student_count: int


# ============================================================
# 考试-教室
# ============================================================
@dataclass
class ExamClassroom:
    """考试-教室关联"""
    exam_id: int
    classroom_id: int
    total_students: int
    class_assignments: list[ExamClassroomClass] = field(default_factory=list)


# ============================================================
# 监考教师分配
# ============================================================
@dataclass
class ExamTeacher:
    """监考教师分配"""
    exam_id: int
    teacher_id: int
    role: Literal["fixed", "patrol"]
    classroom_id: int | None = None


# ============================================================
# 考试模型
# ============================================================
@dataclass
class Exam:
    """考试模型（每门课程生成1场或2场考试）"""
    id: int
    course_id: int
    time_slot_id: int
    exam_label: Literal["A", "B", None] = None
    status: Literal["pending", "scheduled", "failed"] = "pending"
    course: Course | None = None
    classroom_assignments: list[ExamClassroom] = field(default_factory=list)
    teacher_assignments: list[ExamTeacher] = field(default_factory=list)


# ============================================================
# 结果数据结构
# ============================================================
@dataclass
class ClassroomResult:
    """教室分配结果"""
    classroom_id: int
    classroom_name: str
    class_ids: list[int]  # 分配的班级
    student_count: int


@dataclass
class TeacherResult:
    """教师分配结果"""
    teacher_id: int
    teacher_name: str
    role: str  # fixed/patrol


@dataclass
class ExamResult:
    """考试安排结果"""
    exam_id: int  # 课程对应的考试ID
    course_id: int
    course_name: str
    time_slot_id: int
    day_of_week: int
    slot_code: str
    exam_label: str | None  # A/B/None
    classrooms: list[ClassroomResult]
    teachers: list[TeacherResult]
    total_students: int
    is_ab: bool


@dataclass
class PatrolResult:
    """流动监考分配结果"""
    time_slot_id: int
    day_of_week: int
    slot_code: str
    teacher_ids: list[int]


@dataclass
class ConflictReport:
    """冲突分析报告"""
    total_capacity: int  # 教室总容量
    required_capacity: int  # 所需容量
    total_teacher_slots: int  # 教师总场次容量
    required_teacher_slots: int  # 所需场次
    bottlenecks: list[str]  # 瓶颈列表
    suggestions: list[str]  # 建议


@dataclass
class SchedulingResult:
    """排考总结果"""
    success: bool
    exams: list[ExamResult]  # 考试安排结果
    patrol_teachers: list[PatrolResult]  # 流动监考分配
    violations: list[str]  # 违规信息
    conflict_report: ConflictReport  # 冲突分析
    solve_time: float  # 求解耗时(秒)
