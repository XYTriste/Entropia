"""
考试排考系统 - 排考引擎路由

提供排考引擎的触发、状态查询、版本管理:
- 触发自动排考
- 查询排考状态
- 应用排考结果
- 排考历史版本列表
- 版本详情
- 回滚到版本
"""

import json
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.classroom import Classroom
from app.models.course import Course
from app.models.course_class import CourseClass
from app.models.exam import Exam, ExamLabel, ExamStatus
from app.models.exam_classroom import ExamClassroom
from app.models.exam_classroom_class import ExamClassroomClass
from app.models.exam_teacher import ExamTeacher, ExamTeacherRole
from app.models.patrol_teacher import PatrolTeacher
from app.models.schedule_version import ScheduleVersion, ScheduleVersionStatus
from app.models.teacher import Teacher
from app.models.time_slot import TimeSlot

router = APIRouter()

# 排考任务内存存储 (生产环境应使用 Redis)
_scheduler_jobs: dict[str, dict[str, Any]] = {}


# ============================================================
# 请求模型
# ============================================================


class ScheduleRunRequest(BaseModel):
    """运行排考引擎请求"""
    course_ids: list[int] | None = Field(None, description="指定排考的课程ID列表 (None=全部)")
    strategy: str = Field("full", description="策略: full / public_only / major_only")


# ============================================================
# 辅助函数
# ============================================================


async def _load_scheduler_data(db: AsyncSession, course_ids: list[int] | None = None):
    """加载排考引擎所需数据"""
    if course_ids:
        result = await db.execute(
            select(Course)
            .where(Course.id.in_(course_ids), Course.is_active == True)
            .options(selectinload(Course.class_links).selectinload(CourseClass.class_))
        )
    else:
        result = await db.execute(
            select(Course)
            .where(Course.is_active == True)
            .options(selectinload(Course.class_links).selectinload(CourseClass.class_))
        )
    courses = result.scalars().all()

    result = await db.execute(select(Classroom).where(Classroom.is_active == True))
    classrooms = result.scalars().all()

    result = await db.execute(select(Teacher).where(Teacher.is_active == True))
    teachers = result.scalars().all()

    result = await db.execute(select(TimeSlot).order_by(TimeSlot.id))
    time_slots = result.scalars().all()

    return courses, classrooms, teachers, time_slots


# ============================================================
# 触发排考
# ============================================================


@router.post("/run", response_model=dict)
async def run_scheduler(
    req: ScheduleRunRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """触发自动排考"""
    job_id = str(uuid.uuid4())

    _scheduler_jobs[job_id] = {
        "job_id": job_id,
        "status": "running",
        "created_at": datetime.now().isoformat(),
        "result": None,
    }

    try:
        courses, classrooms, teachers, time_slots = await _load_scheduler_data(
            db, req.course_ids
        )

        if not courses:
            _scheduler_jobs[job_id]["status"] = "failed"
            _scheduler_jobs[job_id]["error"] = "没有可用的课程"
            return {"code": 0, "message": "success", "data": _scheduler_jobs[job_id]}

        if not classrooms:
            _scheduler_jobs[job_id]["status"] = "failed"
            _scheduler_jobs[job_id]["error"] = "没有可用的教室"
            return {"code": 0, "message": "success", "data": _scheduler_jobs[job_id]}

        if not time_slots:
            _scheduler_jobs[job_id]["status"] = "failed"
            _scheduler_jobs[job_id]["error"] = "没有可用的时段"
            return {"code": 0, "message": "success", "data": _scheduler_jobs[job_id]}

        if req.strategy == "public_only":
            courses = [c for c in courses if c.course_type.value == "public"]
        elif req.strategy == "major_only":
            courses = [c for c in courses if c.course_type.value == "major"]

        from app.engine.scheduler import SchedulingEngine
        from app.engine.models import (
            Class as EngineClass,
            Classroom as EngineClassroom,
            Course as EngineCourse,
            CourseClass as EngineCourseClass,
            Teacher as EngineTeacher,
            TimeSlot as EngineTimeSlot,
        )

        engine = SchedulingEngine(max_solve_time=300)

        engine_courses = []
        for c in courses:
            ec = EngineCourse(
                id=c.id,
                name=c.name,
                course_type=c.course_type.value,
                needs_ab=c.needs_ab,
                dept_assigned_date=c.dept_assigned_date,
                dept_assigned_time_slot_id=c.dept_assigned_time_slot_id or 0,
            )
            for cc in c.class_links:
                if cc.class_:
                    ec.class_links.append(EngineCourseClass(
                        course_id=c.id,
                        class_id=cc.class_id,
                        class_=EngineClass(
                            id=cc.class_.id,
                            name=cc.class_.name,
                            student_count=cc.class_.student_count,
                            grade=cc.grade,
                            major_id=cc.class_.major_id,
                        ),
                        grade=cc.grade,
                    ))
            engine_courses.append(ec)

        engine_classrooms = [
            EngineClassroom(
                id=r.id, name=r.name, capacity=r.capacity,
                room_type=r.room_type.value, floor=r.floor,
                is_active=r.is_active,
            )
            for r in classrooms
        ]
        engine_teachers = [
            EngineTeacher(
                id=t.id, name=t.name, teacher_type=t.teacher_type.value,
                max_slots=t.max_slots,
            )
            for t in teachers
        ]
        engine_time_slots = [
            EngineTimeSlot(
                id=ts.id, day_of_week=ts.day_of_week,
                slot_code=ts.slot_code, start_time=ts.start_time,
                end_time=ts.end_time, is_continuous=ts.is_continuous,
            )
            for ts in time_slots
        ]

        schedule_result = engine.run(
            courses=engine_courses,
            classrooms=engine_classrooms,
            teachers=engine_teachers,
            time_slots=engine_time_slots,
        )

        version_no = datetime.now().strftime("%Y%m%d-%H%M%S")
        snapshot = {
            "exams": [
                {
                    "exam_id": er.exam_id,
                    "course_id": er.course_id,
                    "course_name": er.course_name,
                    "time_slot_id": er.time_slot_id,
                    "day_of_week": er.day_of_week,
                    "slot_code": er.slot_code,
                    "exam_label": er.exam_label,
                    "classrooms": [
                        {"classroom_id": cr.classroom_id, "student_count": cr.student_count, "class_ids": cr.class_ids}
                        for cr in er.classrooms
                    ],
                    "teachers": [
                        {"teacher_id": tr.teacher_id, "role": tr.role}
                        for tr in er.teachers
                    ],
                }
                for er in schedule_result.exams
            ],
            "patrol_teachers": [
                {
                    "time_slot_id": pr.time_slot_id,
                    "teacher_ids": pr.teacher_ids,
                }
                for pr in schedule_result.patrol_teachers
            ],
            "violations": schedule_result.violations,
            "solve_time": schedule_result.solve_time,
        }

        version = ScheduleVersion(
            version_no=version_no,
            status=ScheduleVersionStatus.DRAFT,
            description=f"自动排考结果 (策略: {req.strategy}, 课程数: {len(courses)})",
            data_snapshot=json.dumps(snapshot, ensure_ascii=False),
            created_at=datetime.now(),
        )
        db.add(version)
        await db.commit()
        await db.refresh(version)

        _scheduler_jobs[job_id]["status"] = "completed" if schedule_result.success else "completed_with_violations"
        _scheduler_jobs[job_id]["result"] = {
            "version_id": version.id,
            "version_no": version_no,
            "success": schedule_result.success,
            "exams_scheduled": len(schedule_result.exams),
            "violations": schedule_result.violations,
            "solve_time": f"{schedule_result.solve_time:.2f}s",
        }

        return {"code": 0, "message": "success", "data": _scheduler_jobs[job_id]}

    except Exception as e:
        _scheduler_jobs[job_id]["status"] = "failed"
        _scheduler_jobs[job_id]["error"] = str(e)
        return {"code": 0, "message": "排考失败", "data": _scheduler_jobs[job_id]}


# ============================================================
# 查询排考状态
# ============================================================


@router.get("/status/{job_id}", response_model=dict)
async def get_scheduler_status(
    job_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """查询排考任务状态"""
    job = _scheduler_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"排考任务(id={job_id})不存在")
    return {"code": 0, "message": "success", "data": job}


# ============================================================
# 应用排考结果
# ============================================================


@router.post("/apply/{version_id}", response_model=dict)
async def apply_schedule_version(
    version_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """应用排考版本 (将草稿版本变为已发布，并持久化到 exams 表)"""
    version = await db.get(ScheduleVersion, version_id)
    if not version:
        raise HTTPException(status_code=404, detail=f"排考版本(id={version_id})不存在")

    if version.status == ScheduleVersionStatus.PUBLISHED:
        return {"code": 0, "message": "该版本已发布", "data": None}

    # 1. 将其他已发布版本归档
    result = await db.execute(
        select(ScheduleVersion).where(ScheduleVersion.status == ScheduleVersionStatus.PUBLISHED)
    )
    for v in result.scalars().all():
        v.status = ScheduleVersionStatus.ARCHIVED
        db.add(v)

    # 2. 清除旧的已排考记录
    from sqlalchemy import delete
    await db.execute(delete(Exam).where(Exam.status == ExamStatus.SCHEDULED))
    await db.execute(delete(PatrolTeacher))
    await db.flush()

    # 3. 解析快照并创建新记录
    snapshot = {}
    if version.data_snapshot:
        try:
            snapshot = json.loads(version.data_snapshot)
        except json.JSONDecodeError:
            snapshot = {}

    exam_map: dict[int, Exam] = {}
    for er in snapshot.get("exams", []):
        label_str = er.get("exam_label")
        exam_label = None
        if label_str == "A":
            exam_label = ExamLabel.A
        elif label_str == "B":
            exam_label = ExamLabel.B

        exam = Exam(
            course_id=er["course_id"],
            time_slot_id=er.get("time_slot_id"),
            exam_label=exam_label,
            status=ExamStatus.SCHEDULED,
            is_locked=False,
        )
        db.add(exam)
        await db.flush()
        exam_map[er.get("exam_id", 0)] = exam

        # 教室分配 (去重：同一考试同一教室只出现一次，人数累加)
        room_dict: dict[int, dict] = {}
        for cr in er.get("classrooms", []):
            rid = cr["classroom_id"]
            if rid not in room_dict:
                room_dict[rid] = {"student_count": 0, "class_ids": []}
            room_dict[rid]["student_count"] += cr.get("student_count", 0)
            room_dict[rid]["class_ids"].extend(cr.get("class_ids", []))

        for rid, info in room_dict.items():
            ec = ExamClassroom(
                exam_id=exam.id,
                classroom_id=rid,
                total_students=info["student_count"],
            )
            db.add(ec)
            await db.flush()

            # 班级分配 (snapshot 中 class_ids 可能没有，兼容处理)
            class_ids = list(dict.fromkeys(info["class_ids"]))  # 去重保留顺序
            total = info["student_count"]
            if class_ids:
                base = total // len(class_ids)
                rem = total % len(class_ids)
                for idx, cid in enumerate(class_ids):
                    if not cid:
                        continue
                    count = base + (1 if idx < rem else 0)
                    db.add(ExamClassroomClass(
                        exam_classroom_id=ec.id,
                        class_id=cid,
                        student_count=count,
                    ))

        # 教师分配 (去重：同一考试同一教师同一角色只出现一次)
        seen_teachers = set()
        for tr in er.get("teachers", []):
            tkey = (tr["teacher_id"], tr.get("role", "fixed"))
            if tkey in seen_teachers:
                continue
            seen_teachers.add(tkey)
            role = ExamTeacherRole.FIXED if tr.get("role") == "fixed" else ExamTeacherRole.PATROL
            db.add(ExamTeacher(
                exam_id=exam.id,
                teacher_id=tr["teacher_id"],
                role=role,
            ))

    # 4. 流动监考 (去重)
    seen_patrols = set()
    for pr in snapshot.get("patrol_teachers", []):
        for tid in pr.get("teacher_ids", []):
            pkey = (pr["time_slot_id"], tid)
            if pkey in seen_patrols:
                continue
            seen_patrols.add(pkey)
            db.add(PatrolTeacher(
                time_slot_id=pr["time_slot_id"],
                teacher_id=tid,
            ))

    # 5. 更新版本状态
    version.status = ScheduleVersionStatus.PUBLISHED
    db.add(version)
    await db.commit()

    return {"code": 0, "message": "版本已发布，排考结果已应用", "data": {"version_id": version_id}}


# ============================================================
# 版本列表
# ============================================================


@router.get("/versions", response_model=dict)
async def list_schedule_versions(
    db: AsyncSession = Depends(get_db),
) -> dict:
    """获取排考历史版本列表"""
    result = await db.execute(
        select(ScheduleVersion).order_by(ScheduleVersion.created_at.desc())
    )
    versions = result.scalars().all()

    return {
        "code": 0,
        "message": "success",
        "data": {
            "total": len(versions),
            "items": [
                {
                    "id": v.id,
                    "version_no": v.version_no,
                    "status": v.status.value,
                    "description": v.description,
                    "created_at": v.created_at.isoformat() if v.created_at else None,
                }
                for v in versions
            ],
        },
    }


# ============================================================
# 版本详情
# ============================================================


@router.get("/versions/{version_id}", response_model=dict)
async def get_schedule_version(
    version_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """获取排考版本详情"""
    version = await db.get(ScheduleVersion, version_id)
    if not version:
        raise HTTPException(status_code=404, detail=f"排考版本(id={version_id})不存在")

    data = {
        "id": version.id,
        "version_no": version.version_no,
        "status": version.status.value,
        "description": version.description,
        "created_at": version.created_at.isoformat() if version.created_at else None,
    }
    if version.data_snapshot:
        try:
            data["snapshot"] = json.loads(version.data_snapshot)
        except json.JSONDecodeError:
            data["snapshot"] = None

    return {"code": 0, "message": "success", "data": data}


# ============================================================
# 回滚到版本
# ============================================================


@router.post("/rollback/{version_id}", response_model=dict)
async def rollback_schedule_version(
    version_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """回滚到指定排考版本"""
    version = await db.get(ScheduleVersion, version_id)
    if not version:
        raise HTTPException(status_code=404, detail=f"排考版本(id={version_id})不存在")

    result = await db.execute(select(ScheduleVersion))
    for v in result.scalars().all():
        if v.status == ScheduleVersionStatus.PUBLISHED:
            v.status = ScheduleVersionStatus.ARCHIVED
            db.add(v)

    version.status = ScheduleVersionStatus.PUBLISHED
    db.add(version)
    await db.commit()

    return {"code": 0, "message": f"已回滚到版本 {version.version_no}", "data": {"version_id": version_id}}
