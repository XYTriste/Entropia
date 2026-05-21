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
from datetime import date, datetime, timezone, timedelta
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, update
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
from app.models.schedule_config import ScheduleConfig
from app.models.schedule_version import ScheduleVersion, ScheduleVersionStatus
from app.models.teacher import Teacher
from app.models.time_slot import TimeSlot

router = APIRouter()

# 国内时区 UTC+8
CN_TZ = timezone(timedelta(hours=8))

# 排考任务内存存储 (生产环境应使用 Redis)
_scheduler_jobs: dict[str, dict[str, Any]] = {}


# ============================================================
# 请求模型
# ============================================================


class ScheduleRunRequest(BaseModel):
    """运行排考引擎请求"""
    course_ids: list[int] | None = Field(None, description="指定排考的课程ID列表 (None=全部)")
    strategy: str = Field("full", description="策略: full / public_only / major_only")
    fixed_teachers_per_room: int | None = Field(None, ge=1, le=2, description="每教室固定监考人数 (None=使用数据库配置)")
    enable_max_days_constraint: bool | None = Field(None, description="是否启用最大监考天数约束 (None=使用数据库配置)")
    enable_day_continuity_constraint: bool | None = Field(None, description="是否启用日期连续性约束 (None=使用数据库配置)")
    max_days: int | None = Field(None, ge=1, le=5, description="最大监考天数上限 (None=使用数据库配置或引擎自动计算)")
    exam_start_date: Optional[date] = Field(None, description="考试起始日期 (None=使用数据库配置)")
    exam_weeks: Optional[int] = Field(None, ge=1, le=4, description="考试周数 (None=使用数据库配置)")


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

        # 校验/确定考试起始日期和周数
        exam_start_date = req.exam_start_date
        exam_weeks = req.exam_weeks
        if exam_start_date is None:
            exam_start_date = config.exam_start_date if config else None
        if exam_weeks is None:
            exam_weeks = config.exam_weeks if config else 1

        # 过滤出带 exam_date 的生成记录（排除模板记录）
        generated_slots = [ts for ts in time_slots if ts.exam_date is not None]
        expected_count = exam_weeks * 20

        if len(generated_slots) != expected_count:
            _scheduler_jobs[job_id]["status"] = "failed"
            _scheduler_jobs[job_id]["error"] = (
                f"考试时段未正确生成。当前有 {len(generated_slots)} 个生成时段，"
                f"但期望 {expected_count} 个（{exam_weeks} 周）。"
                f"请先调用 /time-slots/generate 生成时段。"
            )
            return {"code": 0, "message": "success", "data": _scheduler_jobs[job_id]}

        # 构建模板 -> 生成时段的映射（用于公共课映射）
        template_slots = {ts.id: ts for ts in time_slots if ts.exam_date is None}
        # 按 (day_of_week, slot_code) 分组生成记录，取 exam_date 最小者（第一周）
        generated_slot_map: dict[tuple[int, str], TimeSlot] = {}
        for ts in sorted(generated_slots, key=lambda x: x.exam_date):
            key = (ts.day_of_week, ts.slot_code)
            if key not in generated_slot_map:
                generated_slot_map[key] = ts

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

        # 读取排考配置
        config_result = await db.execute(select(ScheduleConfig).order_by(ScheduleConfig.id.desc()).limit(1))
        config = config_result.scalar_one_or_none()

        fixed_teachers_per_room = req.fixed_teachers_per_room
        if fixed_teachers_per_room is None:
            fixed_teachers_per_room = config.fixed_teachers_per_room if config else 2
        patrol_teacher_count = config.patrol_teacher_count_per_slot_pair if config else 2
        import json
        patrol_group_rules = json.loads(config.patrol_group_rules) if config and config.patrol_group_rules else None
        classroom_priority_rules = json.loads(config.classroom_priority_rules) if config and config.classroom_priority_rules else None
        enable_max_days_constraint = req.enable_max_days_constraint
        if enable_max_days_constraint is None:
            enable_max_days_constraint = config.enable_max_days_constraint if config else True
        enable_day_continuity_constraint = req.enable_day_continuity_constraint
        if enable_day_continuity_constraint is None:
            enable_day_continuity_constraint = config.enable_day_continuity_constraint if config else True
        max_days = req.max_days
        if max_days is None:
            max_days = config.max_days if config else None

        engine = SchedulingEngine(
            max_solve_time=300,
            fixed_teachers_per_room=fixed_teachers_per_room,
            patrol_teacher_count=patrol_teacher_count,
            patrol_group_rules=patrol_group_rules,
            classroom_priority_rules=classroom_priority_rules,
            enable_max_days_constraint=enable_max_days_constraint,
            enable_day_continuity_constraint=enable_day_continuity_constraint,
            max_days=max_days,
        )

        engine_courses = []
        for c in courses:
            dept_slot_id = c.dept_assigned_time_slot_id or 0
            # 如果公共课指定了模板时段，映射到第一周的对应生成时段
            if dept_slot_id and dept_slot_id in template_slots:
                tmpl = template_slots[dept_slot_id]
                mapped = generated_slot_map.get((tmpl.day_of_week, tmpl.slot_code))
                if mapped:
                    dept_slot_id = mapped.id
                else:
                    _scheduler_jobs[job_id]["status"] = "failed"
                    _scheduler_jobs[job_id]["error"] = (
                        f"公共课 '{c.name}' 指定的时段 ({tmpl.day_of_week} {tmpl.slot_code}) "
                        f"在生成的考试时段中不存在。请检查起始日期和周数设置。"
                    )
                    return {"code": 0, "message": "success", "data": _scheduler_jobs[job_id]}

            ec = EngineCourse(
                id=c.id,
                name=c.name,
                course_type=c.course_type.value,
                needs_ab=c.needs_ab,
                dept_assigned_date=c.dept_assigned_date,
                dept_assigned_time_slot_id=dept_slot_id,
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
                exam_date=ts.exam_date.isoformat() if ts.exam_date else None,
            )
            for ts in generated_slots
        ]

        schedule_result = engine.run(
            courses=engine_courses,
            classrooms=engine_classrooms,
            teachers=engine_teachers,
            time_slots=engine_time_slots,
            exam_start_date=exam_start_date,
            exam_weeks=exam_weeks,
        )

        version_no = datetime.now().strftime("%Y%m%d-%H%M%S")
        # 使用原始 Exam 对象生成 snapshot，保留 A/B 卷独立记录及 classroom_id
        snapshot = {
            "exams": [
                {
                    "exam_id": exam.id,
                    "course_id": exam.course_id,
                    "course_name": exam.course.name if exam.course else "",
                    "time_slot_id": exam.time_slot_id,
                    "exam_date": next(
                        (ts.exam_date.isoformat() for ts in generated_slots if ts.id == exam.time_slot_id),
                        None
                    ),
                    "day_of_week": next(
                        (ts.day_of_week for ts in generated_slots if ts.id == exam.time_slot_id),
                        None
                    ),
                    "slot_code": next(
                        (ts.slot_code for ts in generated_slots if ts.id == exam.time_slot_id),
                        None
                    ),
                    "exam_label": exam.exam_label,
                    "classrooms": [
                        {
                            "classroom_id": ec.classroom_id,
                            "student_count": ec.total_students,
                            "class_ids": [ca.class_id for ca in ec.class_assignments],
                            "class_assignments": [
                                {
                                    "class_id": ca.class_id,
                                    "student_count": ca.student_count,
                                }
                                for ca in ec.class_assignments
                            ],
                        }
                        for ec in exam.classroom_assignments
                    ],
                    "teachers": [
                        {
                            "teacher_id": et.teacher_id,
                            "role": et.role,
                            "classroom_id": et.classroom_id,
                            "patrol_group_name": getattr(et, "patrol_group_name", None),
                        }
                        for et in exam.teacher_assignments
                    ],
                }
                for exam in schedule_result.raw_exams
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
        import traceback
        _scheduler_jobs[job_id]["status"] = "failed"
        _scheduler_jobs[job_id]["error"] = f"{str(e)}\n{traceback.format_exc()}"
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
        elif label_str == "A+B":
            # A+B 表示合并展示，实际应创建两场考试
            # 这里保持 compatibility：如果 snapshot 存的是 A+B，
            # 说明是旧版合并结果，按单场无标签处理
            exam_label = None

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

            # 班级分配：优先使用 snapshot 中的 class_assignments（含具体人数）
            # 兼容旧版 snapshot 没有 class_assignments 的情况，退化为平均分配
            class_assignments = []
            for cr in er.get("classrooms", []):
                if cr.get("classroom_id") == rid:
                    class_assignments = cr.get("class_assignments", [])
                    break

            if class_assignments:
                # 使用 snapshot 中的具体人数
                seen_class_ids = set()
                for ca in class_assignments:
                    cid = ca.get("class_id")
                    if not cid or cid in seen_class_ids:
                        continue
                    seen_class_ids.add(cid)
                    db.add(ExamClassroomClass(
                        exam_classroom_id=ec.id,
                        class_id=cid,
                        student_count=ca.get("student_count", 0),
                    ))
            else:
                # 兼容旧版 snapshot：按 class_ids 平均分配
                class_ids = list(dict.fromkeys(info["class_ids"]))
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

        # 教师分配 (去重：同一考试同一教师同一角色同一教室只出现一次)
        seen_teachers = set()
        for tr in er.get("teachers", []):
            tkey = (tr["teacher_id"], tr.get("role", "fixed"), tr.get("classroom_id"))
            if tkey in seen_teachers:
                continue
            seen_teachers.add(tkey)
            role = ExamTeacherRole.FIXED if tr.get("role") == "fixed" else ExamTeacherRole.PATROL
            db.add(ExamTeacher(
                exam_id=exam.id,
                teacher_id=tr["teacher_id"],
                role=role,
                classroom_id=tr.get("classroom_id"),
                patrol_group_name=tr.get("patrol_group_name"),
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

    # 5. 更新教师 current_slots（统计每个教师被分配的总场次）
    teacher_slot_counts: dict[int, set[int]] = {}  # teacher_id -> set of time_slot_ids
    # 在创建 ExamTeacher 时已经遍历过 teachers，直接利用 seen_teachers 和 snapshot 数据
    for er in snapshot.get("exams", []):
        time_slot_id = er.get("time_slot_id")
        for tr in er.get("teachers", []):
            tid = tr["teacher_id"]
            if tid not in teacher_slot_counts:
                teacher_slot_counts[tid] = set()
            if time_slot_id:
                teacher_slot_counts[tid].add(time_slot_id)
    # 流动监考也计入场次
    for pr in snapshot.get("patrol_teachers", []):
        for tid in pr.get("teacher_ids", []):
            if tid not in teacher_slot_counts:
                teacher_slot_counts[tid] = set()
            teacher_slot_counts[tid].add(pr["time_slot_id"])
    # 先重置所有教师的 current_slots，避免旧版本数据残留
    await db.execute(update(Teacher).values(current_slots=0))

    # 写入数据库
    for tid, slots in teacher_slot_counts.items():
        teacher = await db.get(Teacher, tid)
        if teacher:
            teacher.current_slots = len(slots)
            db.add(teacher)

    # 6. 更新版本状态
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


# ============================================================
# 删除排考版本
# ============================================================


@router.delete("/versions/{version_id}", response_model=dict)
async def delete_schedule_version(
    version_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """删除排考版本

    - 如果是草稿版本(DRAFT)：直接删除版本记录
    - 如果是已发布版本(PUBLISHED)：同时删除相关的 exams 表数据
    - 已归档版本(ARCHIVED)：直接删除版本记录
    """
    version = await db.get(ScheduleVersion, version_id)
    if not version:
        raise HTTPException(status_code=404, detail=f"排考版本(id={version_id})不存在")

    deleted_exams = 0

    # 如果是已发布版本，需要同时删除关联的考试数据
    if version.status == ScheduleVersionStatus.PUBLISHED:
        # 先获取该版本关联的考试数据（通过快照中的exam_id）
        snapshot = {}
        if version.data_snapshot:
            try:
                snapshot = json.loads(version.data_snapshot)
            except json.JSONDecodeError:
                snapshot = {}

        # 清除关联的 ExamTeacher、ExamClassroomClass、ExamClassroom、PatrolTeacher
        exam_ids = [er.get("exam_id") for er in snapshot.get("exams", []) if er.get("exam_id")]
        if exam_ids:
            # 删除 ExamTeacher
            await db.execute(
                delete(ExamTeacher).where(ExamTeacher.exam_id.in_(exam_ids))
            )
            # 获取所有相关的 ExamClassroom
            result = await db.execute(
                select(ExamClassroom.id).where(ExamClassroom.exam_id.in_(exam_ids))
            )
            exam_classroom_ids = [ec.id for ec in result.scalars().all()]
            # 删除 ExamClassroomClass
            if exam_classroom_ids:
                await db.execute(
                    delete(ExamClassroomClass).where(ExamClassroomClass.exam_classroom_id.in_(exam_classroom_ids))
                )
            # 删除 ExamClassroom
            await db.execute(
                delete(ExamClassroom).where(ExamClassroom.exam_id.in_(exam_ids))
            )
            # 删除 Exam
            await db.execute(delete(Exam).where(Exam.id.in_(exam_ids)))
            deleted_exams = len(exam_ids)

        # 删除所有 PatrolTeacher（因为PUBLISHED版本的流动监考会写入数据库）
        await db.execute(delete(PatrolTeacher))

        # 重置教师的 current_slots
        await db.execute(update(Teacher).values(current_slots=0))

    # 删除版本记录
    await db.delete(version)
    await db.commit()

    return {
        "code": 0,
        "message": f"版本已删除{'，同时删除了 ' + str(deleted_exams) + ' 条考试记录' if deleted_exams > 0 else ''}",
        "data": {"deleted_exams": deleted_exams}
    }


# ============================================================
# 排考配置管理
# ============================================================


class ScheduleConfigUpdate(BaseModel):
    """更新排考配置请求"""
    fixed_teachers_per_room: int = Field(2, ge=1, le=2, description="每教室固定监考人数")
    patrol_teacher_count_per_slot_pair: int = Field(2, ge=1, le=5, description="每时段对流动监考人数")
    patrol_group_rules: list[dict] = Field(default_factory=list, description="流动监考分组规则")
    classroom_priority_rules: list[dict] = Field(default_factory=list, description="教室优先级规则")
    enable_max_days_constraint: bool = Field(True, description="是否启用最大监考天数约束")
    enable_day_continuity_constraint: bool = Field(True, description="是否启用日期连续性约束")
    max_days: int = Field(3, ge=1, le=5, description="最大监考天数上限")
    exam_start_date: Optional[date] = Field(None, description="考试起始日期")
    exam_weeks: int = Field(1, ge=1, le=4, description="考试周数")


@router.get("/config", response_model=dict)
async def get_schedule_config(
    db: AsyncSession = Depends(get_db),
) -> dict:
    """获取排考配置"""
    result = await db.execute(select(ScheduleConfig).order_by(ScheduleConfig.id.desc()).limit(1))
    config = result.scalar_one_or_none()
    if not config:
        return {
            "code": 0,
            "message": "success",
            "data": {
                "fixed_teachers_per_room": 2,
                "patrol_teacher_count_per_slot_pair": 2,
                "patrol_group_rules": [
                    {"group_name": "流动监考5-2和理东二", "patterns": ["5-2*", "理东二"]},
                    {"group_name": "流动监考5-3", "patterns": ["5-3*"]},
                ],
                "classroom_priority_rules": [
                    {"priority": 1, "patterns": ["5-2*"]},
                    {"priority": 2, "patterns": ["5-3*"]},
                ],
                "enable_max_days_constraint": True,
                "enable_day_continuity_constraint": True,
                "max_days": 3,
                "exam_start_date": None,
                "exam_weeks": 1,
            },
        }
    import json
    return {
        "code": 0,
        "message": "success",
        "data": {
            "fixed_teachers_per_room": config.fixed_teachers_per_room,
            "patrol_teacher_count_per_slot_pair": config.patrol_teacher_count_per_slot_pair,
            "patrol_group_rules": json.loads(config.patrol_group_rules) if config.patrol_group_rules else [],
            "classroom_priority_rules": json.loads(config.classroom_priority_rules) if config.classroom_priority_rules else [],
            "enable_max_days_constraint": config.enable_max_days_constraint,
            "enable_day_continuity_constraint": config.enable_day_continuity_constraint,
            "max_days": config.max_days,
            "exam_start_date": config.exam_start_date.isoformat() if config.exam_start_date else None,
            "exam_weeks": config.exam_weeks,
        },
    }


@router.put("/config", response_model=dict)
async def update_schedule_config(
    req: ScheduleConfigUpdate,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """更新排考配置"""
    import json
    result = await db.execute(select(ScheduleConfig).order_by(ScheduleConfig.id.desc()).limit(1))
    config = result.scalar_one_or_none()
    if not config:
        config = ScheduleConfig()
        db.add(config)

    config.fixed_teachers_per_room = req.fixed_teachers_per_room
    config.patrol_teacher_count_per_slot_pair = req.patrol_teacher_count_per_slot_pair
    config.patrol_group_rules = json.dumps(req.patrol_group_rules, ensure_ascii=False)
    config.classroom_priority_rules = json.dumps(req.classroom_priority_rules, ensure_ascii=False)
    config.enable_max_days_constraint = req.enable_max_days_constraint
    config.enable_day_continuity_constraint = req.enable_day_continuity_constraint
    config.max_days = req.max_days
    config.exam_start_date = req.exam_start_date
    config.exam_weeks = req.exam_weeks

    await db.commit()
    await db.refresh(config)

    return {
        "code": 0,
        "message": "配置已更新",
        "data": {
            "fixed_teachers_per_room": config.fixed_teachers_per_room,
            "patrol_teacher_count_per_slot_pair": config.patrol_teacher_count_per_slot_pair,
            "patrol_group_rules": req.patrol_group_rules,
            "classroom_priority_rules": req.classroom_priority_rules,
            "enable_max_days_constraint": config.enable_max_days_constraint,
            "enable_day_continuity_constraint": config.enable_day_continuity_constraint,
            "max_days": config.max_days,
            "exam_start_date": config.exam_start_date.isoformat() if config.exam_start_date else None,
            "exam_weeks": config.exam_weeks,
        },
    }


