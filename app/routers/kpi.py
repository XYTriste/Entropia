"""
KPI 数据接口

提供仪表盘所需的各项 KPI 指标数据。
"""

from fastapi import APIRouter
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models import (
    Exam,
    Classroom,
    ExamClassroom,
    ExamClassroomClass,
    ExamTeacher,
    Teacher,
)
from app.models.exam import ExamStatus

router = APIRouter(tags=["KPI 数据"])


@router.get("/")
async def get_kpi_data():
    """
    获取仪表盘 KPI 数据

    返回:
    - 已安排考试场次
    - 未安排考试场次
    - 教室利用率
    - 监考教师分配率
    - 排考冲突告警（暂返回 0）
    - 考生人次流量
    - 平均考场负载
    """
    try:
        async with AsyncSessionLocal() as session:
            # 1. 已安排考试场次（状态为 scheduled）
            scheduled_exams = await session.execute(
                select(func.count(Exam.id)).where(
                    Exam.status == ExamStatus.SCHEDULED
                )
            )
            scheduled_count = scheduled_exams.scalar() or 0

            # 2. 未安排考试场次（状态为 pending）
            pending_exams = await session.execute(
                select(func.count(Exam.id)).where(
                    Exam.status == ExamStatus.PENDING
                )
            )
            pending_count = pending_exams.scalar() or 0

            # 3. 教室利用率 = 已使用的教室数 / 总教室数
            total_classrooms = await session.execute(
                select(func.count(Classroom.id))
            )
            total_classrooms_count = total_classrooms.scalar() or 0

            used_classrooms = await session.execute(
                select(func.count(func.distinct(ExamClassroom.classroom_id)))
            )
            used_classrooms_count = used_classrooms.scalar() or 0

            classroom_utilization = (
                round(used_classrooms_count / total_classrooms_count * 100, 1)
                if total_classrooms_count > 0 else 0
            )

            # 4. 监考教师分配率 = 已分配的监考教师总人次 / 所有教师的最大监考次数之和 × 100
            # 已分配的监考教师总人次
            total_assigned_slots = await session.execute(
                select(func.count(ExamTeacher.id))
            )
            total_assigned_slots_count = total_assigned_slots.scalar() or 0

            # 所有教师的最大监考次数之和
            max_slots_sum = await session.execute(
                select(func.coalesce(func.sum(Teacher.max_slots), 0))
            )
            max_slots_sum_value = max_slots_sum.scalar() or 0

            teacher_assignment_rate = (
                round(total_assigned_slots_count / max_slots_sum_value * 100, 1)
                if max_slots_sum_value > 0 else 0
            )

            # 5. 总考试场次 = 所有时间段内使用的教室数量总和
            total_exam_sessions = await session.execute(
                select(func.count(ExamClassroom.id)).where(
                    ExamClassroom.classroom_id.isnot(None)
                )
            )
            total_exam_sessions_count = total_exam_sessions.scalar() or 0

            # 6. 排考冲突告警（暂返回 0，后续可接入冲突检测算法）
            conflict_count = 0

            # 7. 考生人次流量 = 所有已排考考试的学生人数之和
            student_flow = await session.execute(
                select(func.coalesce(func.sum(ExamClassroomClass.student_count), 0))
            )
            student_flow_count = student_flow.scalar() or 0

            # 8. 平均考场负载 = 平均每个已使用教室的学生数 / 教室容量
            # 简化：直接计算所有已用教室的平均负载
            classroom_loads_result = await session.execute(
                select(
                    func.coalesce(ExamClassroomClass.student_count, 0) / Classroom.capacity
                )
                .select_from(ExamClassroom)
                .join(ExamClassroomClass, ExamClassroomClass.exam_classroom_id == ExamClassroom.id)
                .join(Classroom, Classroom.id == ExamClassroom.classroom_id)
                .where(ExamClassroom.classroom_id.isnot(None))
            )
            loads = classroom_loads_result.scalars().all()
            avg_classroom_load_percent = round(
                sum(loads) / len(loads) * 100, 1
            ) if loads else 0

            return {
                "code": 0,
                "data": {
                    "scheduled_exams": scheduled_count,
                    "pending_exams": pending_count,
                    "total_exam_sessions": total_exam_sessions_count,
                    "classroom_utilization": classroom_utilization,
                    "teacher_assignment_rate": teacher_assignment_rate,
                    "conflict_count": conflict_count,
                    "student_flow": student_flow_count,
                    "avg_classroom_load": avg_classroom_load_percent,
                },
                "message": "success"
            }
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"KPI API Error: {error_detail}")
        return {
            "code": 500,
            "data": None,
            "message": f"Error: {str(e)}"
        }
