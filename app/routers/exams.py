"""
考试排考系统 - 排考结果查询路由

提供排考结果的多维度查询:
- 考试列表 (支持按时段、课程、状态过滤)
- 考试详情
- 总览视图矩阵 (日期 x 时段)
- 教师视图甘特图数据
- 教室视图矩阵
- 班级考试时间表
- 课程考试详情 (含AB卷分卷情况)

版本说明:
- "应用版本" 时，快照数据会持久化到 Exam 表 (status=SCHEDULED)
- 所有查询始终返回当前已发布版本 (status=SCHEDULED)
- 版本切换由 "应用版本" 接口 (POST /scheduler/apply/{version_id}) 处理
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
import json

from app.crud import exam as exam_crud
from app.database import get_db
from app.models.class_ import Class
from app.models.classroom import Classroom
from app.models.course import Course
from app.models.exam import Exam, ExamStatus
from app.models.exam_classroom import ExamClassroom
from app.models.exam_classroom_class import ExamClassroomClass
from app.models.exam_teacher import ExamTeacher
from app.models.schedule_version import ScheduleVersion
from app.models.teacher import Teacher
from app.models.time_slot import TimeSlot
from app.schemas.exam import ExamResponse

router = APIRouter()

DAY_NAMES = {1: "周一", 2: "周二", 3: "周三", 4: "周四", 5: "周五"}


async def _get_exams_from_snapshot(db: AsyncSession, version_id: int) -> list[dict]:
    """从 ScheduleVersion 快照读取自包含的考试数据列表"""
    version = await db.get(ScheduleVersion, version_id)
    if not version or not version.data_snapshot:
        return []
    try:
        snapshot = json.loads(version.data_snapshot)
    except json.JSONDecodeError:
        return []
    return snapshot.get("exams", [])


# ============================================================
# 考试列表
# ============================================================


@router.get("/", response_model=dict)
async def list_exams(
    db: AsyncSession = Depends(get_db),
    time_slot_id: int | None = Query(None, description="按时段过滤"),
    course_id: int | None = Query(None, description="按课程过滤"),
    status: ExamStatus | None = Query(None, description="按状态过滤"),
    course_type: str | None = Query(None, description="按课程类型过滤: major(专业课)/common(公共课)"),
    version_id: int | None = Query(None, description="按排考版本过滤，默认显示已发布版本"),
    date: str | None = Query(None, description="按日期过滤: 周一/周二/周三/周四/周五"),
    search: str | None = Query(None, description="搜索关键词: 课程名/教室名/教师名"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
) -> dict:
    """获取考试列表 (支持多维度过滤)
    
    - version_id 不指定时默认返回已发布版本 (status=SCHEDULED)
    - version_id 指定时返回该版本的快照数据
    - 支持按 course_type 过滤: common(公共课) / major(专业课)
    - 支持按 date 过滤: 周一/周二/周三/周四/周五
    - 支持 search 关键词搜索: 课程名/教室名/教师名
    """
    # 处理版本过滤逻辑
    if version_id:
        # 从指定版本的快照读取数据
        version = await db.get(ScheduleVersion, version_id)
        if not version:
            raise HTTPException(status_code=404, detail=f"版本(id={version_id})不存在")
        
        snapshot = {}
        if version.data_snapshot:
            try:
                snapshot = json.loads(version.data_snapshot)
            except json.JSONDecodeError:
                snapshot = {}
        
        # 获取时段映射
        time_slot_result = await db.execute(select(TimeSlot))
        time_slots = time_slot_result.scalars().all()
        time_slot_map = {ts.id: ts for ts in time_slots}
        
        # 从快照构建考试列表
        items = []
        for er in snapshot.get("exams", []):
            ts_id = er.get("time_slot_id")
            ts = time_slot_map.get(ts_id) if ts_id else None
            
            # 过滤条件
            if course_id and er.get("course_id") != course_id:
                continue
            if date and ts and DAY_NAMES.get(ts.day_of_week) != date:
                continue
            if course_type:
                er_course_type = er.get("course_type", "major")
                if course_type == "common" and er_course_type != "common":
                    continue
                if course_type == "major" and er_course_type != "major":
                    continue
            
            # 搜索过滤
            if search:
                search_lower = search.lower()
                course_name = er.get("course_name", "").lower()
                classroom_names = [cr.get("classroom_name", "").lower() for cr in er.get("classrooms", [])]
                teacher_names = [tr.get("teacher_name", "").lower() for tr in er.get("teachers", [])]
                if search_lower not in course_name and \
                   not any(search_lower in cn for cn in classroom_names) and \
                   not any(search_lower in tn for tn in teacher_names):
                    continue
            
            # 格式化快照数据
            item = _format_exam_from_snapshot(er, ts)
            items.append(item)
        
        total = len(items)
        paginated_items = items[skip:skip + limit]
        
        return {
            "code": 0,
            "message": "success",
            "data": {"total": total, "items": paginated_items, "skip": skip, "limit": limit},
        }
    
    # 从数据库查询已发布版本
    query = select(Exam).options(
        selectinload(Exam.course),
        selectinload(Exam.time_slot),
        selectinload(Exam.classroom_assignments).selectinload(ExamClassroom.classroom),
        selectinload(Exam.classroom_assignments).selectinload(ExamClassroom.class_assignments).selectinload(ExamClassroomClass.class_),
        selectinload(Exam.teacher_assignments).selectinload(ExamTeacher.teacher),
    )

    # 过滤条件
    if time_slot_id:
        query = query.where(Exam.time_slot_id == time_slot_id)
    if course_id:
        query = query.where(Exam.course_id == course_id)
    if status:
        query = query.where(Exam.status == status)
    else:
        # 默认只返回已发布版本
        query = query.where(Exam.status == ExamStatus.SCHEDULED)
    
    # 日期过滤 (通过 time_slot.day_of_week)
    if date:
        day_map = {"周一": 1, "周二": 2, "周三": 3, "周四": 4, "周五": 5}
        day_of_week = day_map.get(date)
        if day_of_week:
            query = query.join(TimeSlot, Exam.time_slot_id == TimeSlot.id)
            query = query.where(TimeSlot.day_of_week == day_of_week)
    
    # 课程类型过滤
    if course_type:
        # 数据库枚举值是大写：PUBLIC / MAJOR
        course_type_map = {"common": "PUBLIC", "major": "MAJOR"}
        mapped_type = course_type_map.get(course_type)
        if mapped_type:
            query = query.join(Course, Exam.course_id == Course.id)
            query = query.where(Course.course_type == mapped_type)

    # 搜索过滤 (需要子查询)
    if search:
        from sqlalchemy import or_
        search_pattern = f"%{search}%"

        # 搜索课程名、教室名、教师名、班级名
        search_subquery = select(Exam.id).where(
            or_(
                Exam.course_id.in_(
                    select(Course.id).where(Course.name.ilike(search_pattern))
                ),
                Exam.id.in_(
                    select(ExamClassroom.exam_id).join(
                        Classroom, ExamClassroom.classroom_id == Classroom.id
                    ).where(Classroom.name.ilike(search_pattern))
                ),
                Exam.id.in_(
                    select(ExamTeacher.exam_id).join(
                        Teacher, ExamTeacher.teacher_id == Teacher.id
                    ).where(Teacher.name.ilike(search_pattern))
                ),
                # 新增：班级名搜索
                Exam.id.in_(
                    select(ExamClassroom.exam_id).join(
                        ExamClassroomClass, ExamClassroom.id == ExamClassroomClass.exam_classroom_id
                    ).join(
                        Class, ExamClassroomClass.class_id == Class.id
                    ).where(Class.name.ilike(search_pattern))
                ),
            )
        )
        query = query.where(Exam.id.in_(search_subquery))

    count_query = select(func.count()).select_from(query.subquery())
    count_result = await db.execute(count_query)
    total = count_result.scalar_one() or 0

    result = await db.execute(query.offset(skip).limit(limit).order_by(Exam.id))
    exam_items = result.scalars().all()

    data_items = []
    for exam in exam_items:
        item = _format_exam_detail(exam)
        data_items.append(item)

    return {
        "code": 0,
        "message": "success",
        "data": {"total": total, "items": data_items, "skip": skip, "limit": limit},
    }


# ============================================================
# 考试详情
# ============================================================


@router.get("/{exam_id}", response_model=dict)
async def get_exam(
    exam_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """获取考试详情"""
    result = await db.execute(
        select(Exam)
        .where(Exam.id == exam_id)
        .options(
            selectinload(Exam.course),
            selectinload(Exam.time_slot),
            selectinload(Exam.classroom_assignments).selectinload(ExamClassroom.classroom),
            selectinload(Exam.classroom_assignments).selectinload(ExamClassroom.class_assignments).selectinload(ExamClassroomClass.class_),
            selectinload(Exam.teacher_assignments).selectinload(ExamTeacher.teacher),
            selectinload(Exam.teacher_assignments).selectinload(ExamTeacher.classroom),
        )
    )
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail=f"考试(id={exam_id})不存在")

    return {"code": 0, "message": "success", "data": _format_exam_detail(exam)}


# ============================================================
# 总览视图矩阵 (日期 x 时段)
# ============================================================


@router.get("/overview/matrix", response_model=dict)
async def get_exam_overview_matrix(
    db: AsyncSession = Depends(get_db),
    version_id: int | None = Query(None, description="按排考版本过滤，默认显示已发布版本"),
) -> dict:
    """获取总览视图矩阵 (日期 x 时段)，含教室/班级/教师详情
    
    - version_id 不指定时，从 Exam 表读取已发布数据（与其他视图一致）
    - version_id 指定时，从该版本快照读取
    """
    matrix: dict[str, dict[str, list[dict]]] = {}

    if version_id:
        # 从指定版本快照读取
        snapshot_exams = await _get_exams_from_snapshot(db, version_id)
        for er in snapshot_exams:
            date_key = er.get("exam_date") or DAY_NAMES.get(er.get("day_of_week"), str(er.get("day_of_week")))
            slot_code = er.get("slot_code")
            if not date_key or not slot_code:
                continue
            if date_key not in matrix:
                matrix[date_key] = {"T1": [], "T2": [], "T3": [], "T4": []}

            classrooms_detail = []
            total_students = 0
            for cr in er.get("classrooms", []):
                class_list = [
                    {
                        "class_name": ca.get("class_name", f"班级{ca.get('class_id')}"),
                        "student_count": ca.get("student_count", 0),
                    }
                    for ca in cr.get("class_assignments", [])
                ]
                classrooms_detail.append({
                    "classroom_name": cr.get("classroom_name", f"教室{cr.get('classroom_id')}"),
                    "capacity": cr.get("capacity", 0),
                    "total_students": cr.get("student_count", 0),
                    "classes": class_list,
                })
                total_students += cr.get("student_count", 0)

            teachers_detail = []
            for tr in er.get("teachers", []):
                classroom_name = None
                if tr.get("role") == "fixed" and tr.get("classroom_id"):
                    for cr in er.get("classrooms", []):
                        if cr.get("classroom_id") == tr.get("classroom_id"):
                            classroom_name = cr.get("classroom_name", "")
                            break
                teachers_detail.append({
                    "teacher_name": tr.get("teacher_name", f"教师{tr.get('teacher_id')}"),
                    "role": tr.get("role", "fixed"),
                    "classroom_name": classroom_name,
                    "patrol_group_name": tr.get("patrol_group_name"),
                })

            date_label = None
            if er.get("exam_date"):
                from datetime import datetime as _dt
                try:
                    date_label = _dt.fromisoformat(er["exam_date"]).strftime("%m-%d")
                except Exception:
                    pass

            matrix[date_key][slot_code].append({
                "exam_id": er.get("exam_id", 0),
                "course_id": er.get("course_id"),
                "course_name": er.get("course_name", ""),
                "exam_label": er.get("exam_label", ""),
                "course_type": er.get("course_type", "major"),
                "classrooms": classrooms_detail,
                "teachers": teachers_detail,
                "total_students": total_students,
                "exam_date": er.get("exam_date"),
                "date_label": date_label,
            })
    else:
        # 从 Exam 表读取已发布数据
        result = await db.execute(
            select(Exam)
            .where(Exam.status == ExamStatus.SCHEDULED)
            .options(
                selectinload(Exam.course),
                selectinload(Exam.time_slot),
                selectinload(Exam.classroom_assignments).selectinload(ExamClassroom.classroom),
                selectinload(Exam.classroom_assignments).selectinload(ExamClassroom.class_assignments).selectinload(ExamClassroomClass.class_),
                selectinload(Exam.teacher_assignments).selectinload(ExamTeacher.teacher),
            )
        )
        exams = result.scalars().all()

        for exam in exams:
            ts = exam.time_slot
            if not ts:
                continue
            date_key = ts.exam_date.isoformat() if ts.exam_date else DAY_NAMES.get(ts.day_of_week, str(ts.day_of_week))
            slot_code = ts.slot_code
            if not date_key or not slot_code:
                continue
            if date_key not in matrix:
                matrix[date_key] = {"T1": [], "T2": [], "T3": [], "T4": []}

            classrooms_detail = []
            total_students = 0
            for ec in exam.classroom_assignments:
                class_list = [
                    {
                        "class_name": ca.class_.name if ca.class_ else f"班级{ca.class_id}",
                        "student_count": ca.student_count or 0,
                    }
                    for ca in ec.class_assignments
                ]
                classrooms_detail.append({
                    "classroom_name": ec.classroom.name if ec.classroom else f"教室{ec.classroom_id}",
                    "capacity": ec.classroom.capacity if ec.classroom else 0,
                    "total_students": ec.total_students or 0,
                    "classes": class_list,
                })
                total_students += ec.total_students or 0

            teachers_detail = []
            for et in exam.teacher_assignments:
                teachers_detail.append({
                    "teacher_name": et.teacher.name if et.teacher else f"教师{et.teacher_id}",
                    "role": et.role.value if et.role else "fixed",
                    "classroom_name": et.classroom.name if et.classroom else None,
                    "patrol_group_name": et.patrol_group_name,
                })

            date_label = ts.exam_date.strftime("%m-%d") if ts.exam_date else None
            matrix[date_key][slot_code].append({
                "exam_id": exam.id,
                "course_id": exam.course_id,
                "course_name": exam.course.name if exam.course else "",
                "exam_label": exam.exam_label.value if exam.exam_label else "",
                "course_type": exam.course.course_type.value if exam.course else "major",
                "classrooms": classrooms_detail,
                "teachers": teachers_detail,
                "total_students": total_students,
                "exam_date": ts.exam_date.isoformat() if ts.exam_date else None,
                "date_label": date_label,
            })

    return {"code": 0, "message": "success", "data": {"matrix": matrix}}


# ============================================================
# 教师视图甘特图数据
# ============================================================


@router.get("/teachers/gantt", response_model=dict)
async def get_teacher_gantt(
    db: AsyncSession = Depends(get_db),
    version_id: int | None = Query(None, description="按排考版本过滤，默认显示已发布版本"),
) -> dict:
    """获取教师视图甘特图数据
    
    - version_id 不指定时，从 Exam 表读取已发布数据
    - version_id 指定时，从该版本快照读取
    """
    teacher_events: dict[int, dict] = {}

    if version_id:
        snapshot_exams = await _get_exams_from_snapshot(db, version_id)
        for er in snapshot_exams:
            for tr in er.get("teachers", []):
                tid = tr.get("teacher_id")
                if tid not in teacher_events:
                    teacher_events[tid] = {
                        "teacher_id": tid,
                        "teacher_name": tr.get("teacher_name", f"教师{tid}"),
                        "teacher_type": tr.get("teacher_type"),
                        "max_slots": tr.get("max_slots", 5),
                        "events": [],
                    }

                room_details = []
                classrooms = []
                class_names = []
                assigned_classroom = None
                if tr.get("role") == "fixed" and tr.get("classroom_id"):
                    for cr in er.get("classrooms", []):
                        if cr.get("classroom_id") == tr.get("classroom_id"):
                            assigned_classroom = cr.get("classroom_name", "")
                            classrooms.append(cr.get("classroom_name", ""))
                            for ca in cr.get("class_assignments", []):
                                cn = ca.get("class_name", "")
                                if cn and cn not in class_names:
                                    class_names.append(cn)
                            room_details.append({
                                "classroom": cr.get("classroom_name", ""),
                                "class_names": [ca.get("class_name", "") for ca in cr.get("class_assignments", [])][:4],
                                "student_count": cr.get("student_count", 0),
                            })
                            break
                else:
                    for cr in er.get("classrooms", []):
                        classrooms.append(cr.get("classroom_name", ""))
                        for ca in cr.get("class_assignments", []):
                            cn = ca.get("class_name", "")
                            if cn and cn not in class_names:
                                class_names.append(cn)
                        room_details.append({
                            "classroom": cr.get("classroom_name", ""),
                            "class_names": [ca.get("class_name", "") for ca in cr.get("class_assignments", [])][:4],
                            "student_count": cr.get("student_count", 0),
                        })

                student_count = sum(cr.get("student_count", 0) for cr in er.get("classrooms", []))
                date_label = None
                if er.get("exam_date"):
                    from datetime import datetime as _dt
                    try:
                        date_label = _dt.fromisoformat(er["exam_date"]).strftime("%m-%d")
                    except Exception:
                        pass

                teacher_events[tid]["events"].append({
                    "exam_id": er.get("exam_id", 0),
                    "course_name": er.get("course_name", ""),
                    "exam_label": er.get("exam_label", ""),
                    "day_of_week": er.get("day_of_week"),
                    "day_name": DAY_NAMES.get(er.get("day_of_week"), ""),
                    "slot_code": er.get("slot_code"),
                    "time_range": f"{er.get('start_time', '')}-{er.get('end_time', '')}",
                    "exam_date": er.get("exam_date"),
                    "date_label": date_label,
                    "role": tr.get("role", "fixed"),
                    "classrooms": classrooms,
                    "assigned_classroom": assigned_classroom,
                    "class_names": class_names[:4],
                    "student_count": student_count,
                    "room_details": room_details,
                })
    else:
        result = await db.execute(
            select(ExamTeacher)
            .join(Exam, ExamTeacher.exam_id == Exam.id)
            .where(Exam.status == ExamStatus.SCHEDULED)
            .options(
                selectinload(ExamTeacher.teacher),
                selectinload(ExamTeacher.exam).selectinload(Exam.course),
                selectinload(ExamTeacher.exam).selectinload(Exam.time_slot),
                selectinload(ExamTeacher.exam).selectinload(Exam.classroom_assignments).selectinload(ExamClassroom.classroom),
                selectinload(ExamTeacher.exam).selectinload(Exam.classroom_assignments).selectinload(ExamClassroom.class_assignments).selectinload(ExamClassroomClass.class_),
            )
        )
        assignments = result.scalars().all()

        for et in assignments:
            tid = et.teacher_id
            if tid not in teacher_events:
                teacher_events[tid] = {
                    "teacher_id": tid,
                    "teacher_name": et.teacher.name if et.teacher else f"教师{tid}",
                    "teacher_type": et.teacher.teacher_type.value if et.teacher else None,
                    "max_slots": et.teacher.max_slots if et.teacher else 5,
                    "events": [],
                }

            exam = et.exam
            if exam and exam.time_slot:
                ts = exam.time_slot
                room_details = []
                classrooms = []
                class_names = []
                assigned_classroom = None
                if et.role.value == "fixed" and et.classroom_id:
                    for ec in exam.classroom_assignments:
                        if ec.classroom_id == et.classroom_id:
                            if ec.classroom:
                                assigned_classroom = ec.classroom.name
                                classrooms.append(ec.classroom.name)
                            for ca in ec.class_assignments:
                                if ca.class_ and ca.class_.name and ca.class_.name not in class_names:
                                    class_names.append(ca.class_.name)
                            room_details.append({
                                "classroom": ec.classroom.name if ec.classroom else "",
                                "class_names": class_names[:4],
                                "student_count": ec.total_students or 0,
                            })
                            break
                else:
                    for ec in exam.classroom_assignments:
                        if ec.classroom:
                            classrooms.append(ec.classroom.name)
                        for ca in ec.class_assignments:
                            if ca.class_ and ca.class_.name and ca.class_.name not in class_names:
                                class_names.append(ca.class_.name)
                        room_details.append({
                            "classroom": ec.classroom.name if ec.classroom else "",
                            "class_names": [c.class_.name for c in ec.class_assignments if c.class_ and c.class_.name][:4],
                            "student_count": ec.total_students or 0,
                        })

                student_count = sum(ec.total_students or 0 for ec in exam.classroom_assignments)
                date_label = ts.exam_date.strftime("%m-%d") if ts.exam_date else None
                teacher_events[tid]["events"].append({
                    "exam_id": exam.id,
                    "course_name": exam.course.name if exam.course else "",
                    "exam_label": exam.exam_label.value if exam.exam_label else "",
                    "day_of_week": ts.day_of_week,
                    "day_name": DAY_NAMES.get(ts.day_of_week, ""),
                    "slot_code": ts.slot_code,
                    "time_range": f"{ts.start_time}-{ts.end_time}",
                    "exam_date": ts.exam_date.isoformat() if ts.exam_date else None,
                    "date_label": date_label,
                    "role": et.role.value,
                    "classrooms": classrooms,
                    "assigned_classroom": assigned_classroom,
                    "class_names": class_names[:4],
                    "student_count": student_count,
                    "room_details": room_details,
                })

    # 对每位教师的 events 中同 slot_pair 的 patrol 去重（T1/T2 或 T3/T4 只算 1 场）
    for data in teacher_events.values():
        seen_patrol_pairs = set()
        deduped = []
        for ev in data["events"]:
            if ev.get("role") == "patrol":
                sc = ev.get("slot_code", "")
                sp = 1 if sc in ("T1", "T2") else 2 if sc in ("T3", "T4") else 0
                pair_key = (ev.get("day_of_week"), sp)
                if pair_key in seen_patrol_pairs:
                    continue
                seen_patrol_pairs.add(pair_key)
            deduped.append(ev)
        data["events"] = deduped

    # 补充没有监考场次的教师（从数据库查询所有活跃教师）
    all_teachers_result = await db.execute(select(Teacher).where(Teacher.is_active == True))
    all_teachers = all_teachers_result.scalars().all()
    for t in all_teachers:
        if t.id not in teacher_events:
            teacher_events[t.id] = {
                "teacher_id": t.id,
                "teacher_name": t.name,
                "teacher_type": t.teacher_type.value if t.teacher_type else None,
                "max_slots": t.max_slots,
                "events": [],
            }

    # 按监考场次降序排序（场次多的在前）
    teachers_list = sorted(teacher_events.values(), key=lambda x: -len(x["events"]))

    return {
        "code": 0,
        "message": "success",
        "data": {"teachers": teachers_list},
    }


# ============================================================
# 教师监考天数分布
# ============================================================


@router.get("/teachers/day-distribution", response_model=dict)
async def get_teacher_day_distribution(
    db: AsyncSession = Depends(get_db),
    version_id: int | None = Query(None, description="按排考版本过滤，默认显示已发布版本"),
) -> dict:
    """获取每位教师的监考天数分布
    
    用于检查"最大监考天数"约束是否生效。
    - version_id 不指定时，从 Exam 表读取已发布数据
    - version_id 指定时，从该版本快照读取
    """
    teacher_stats: dict[int, dict] = {}

    if version_id:
        snapshot_exams = await _get_exams_from_snapshot(db, version_id)
        for er in snapshot_exams:
            for tr in er.get("teachers", []):
                tid = tr.get("teacher_id")
                if tid not in teacher_stats:
                    teacher_stats[tid] = {
                        "teacher_id": tid,
                        "teacher_name": tr.get("teacher_name", f"教师{tid}"),
                        "total_events": 0,
                        "fixed_count": 0,
                        "patrol_count": 0,
                        "unique_days": set(),
                        "day_list": [],
                        "seen_patrol_pairs": set(),
                    }
                # 流动监考按 slot_pair 去重（T1/T2 或 T3/T4 只算 1 场）
                is_patrol = tr.get("role") != "fixed"
                sc = er.get("slot_code", "")
                sp = 1 if sc in ("T1", "T2") else 2 if sc in ("T3", "T4") else 0
                pair_key = (er.get("day_of_week"), sp)
                if is_patrol and pair_key in teacher_stats[tid]["seen_patrol_pairs"]:
                    continue
                teacher_stats[tid]["total_events"] += 1
                if tr.get("role") == "fixed":
                    teacher_stats[tid]["fixed_count"] += 1
                else:
                    teacher_stats[tid]["patrol_count"] += 1
                    teacher_stats[tid]["seen_patrol_pairs"].add(pair_key)
                day_key = er.get("exam_date") or DAY_NAMES.get(er.get("day_of_week"), str(er.get("day_of_week")))
                if day_key and day_key not in teacher_stats[tid]["unique_days"]:
                    teacher_stats[tid]["unique_days"].add(day_key)
                    teacher_stats[tid]["day_list"].append({
                        "date": day_key,
                        "day_name": DAY_NAMES.get(er.get("day_of_week"), ""),
                        "slot_code": er.get("slot_code"),
                    })
    else:
        result = await db.execute(
            select(ExamTeacher)
            .join(Exam, ExamTeacher.exam_id == Exam.id)
            .where(Exam.status == ExamStatus.SCHEDULED)
            .options(
                selectinload(ExamTeacher.teacher),
                selectinload(ExamTeacher.exam).selectinload(Exam.time_slot),
            )
        )
        assignments = result.scalars().all()

        for et in assignments:
            tid = et.teacher_id
            if tid not in teacher_stats:
                teacher_stats[tid] = {
                    "teacher_id": tid,
                    "teacher_name": et.teacher.name if et.teacher else f"教师{tid}",
                    "total_events": 0,
                    "fixed_count": 0,
                    "patrol_count": 0,
                    "unique_days": set(),
                    "day_list": [],
                    "seen_patrol_pairs": set(),
                }
            exam = et.exam
            if exam and exam.time_slot:
                ts = exam.time_slot
                # 流动监考按 slot_pair 去重
                is_patrol = et.role.value != "fixed"
                sp = 1 if ts.slot_code in ("T1", "T2") else 2 if ts.slot_code in ("T3", "T4") else 0
                pair_key = (ts.day_of_week, sp)
                if is_patrol and pair_key in teacher_stats[tid]["seen_patrol_pairs"]:
                    continue
                teacher_stats[tid]["total_events"] += 1
                if et.role.value == "fixed":
                    teacher_stats[tid]["fixed_count"] += 1
                else:
                    teacher_stats[tid]["patrol_count"] += 1
                    teacher_stats[tid]["seen_patrol_pairs"].add(pair_key)
                day_key = ts.exam_date.isoformat() if ts.exam_date else DAY_NAMES.get(ts.day_of_week, str(ts.day_of_week))
                if day_key and day_key not in teacher_stats[tid]["unique_days"]:
                    teacher_stats[tid]["unique_days"].add(day_key)
                    teacher_stats[tid]["day_list"].append({
                        "date": day_key,
                        "day_name": DAY_NAMES.get(ts.day_of_week, ""),
                        "slot_code": ts.slot_code,
                    })

    # 补充没有监考场次的教师（从数据库查询所有活跃教师）
    all_teachers_result = await db.execute(select(Teacher).where(Teacher.is_active == True))
    all_teachers = all_teachers_result.scalars().all()
    for t in all_teachers:
        if t.id not in teacher_stats:
            teacher_stats[t.id] = {
                "teacher_id": t.id,
                "teacher_name": t.name,
                "total_events": 0,
                "fixed_count": 0,
                "patrol_count": 0,
                "unique_days": set(),
                "day_list": [],
                "seen_patrol_pairs": set(),
            }

    # 转换为列表并排序（按 total_events 降序，再按 unique_days_count 降序）
    items = []
    for stat in teacher_stats.values():
        items.append({
            "teacher_id": stat["teacher_id"],
            "teacher_name": stat["teacher_name"],
            "total_events": stat["total_events"],
            "fixed_count": stat["fixed_count"],
            "patrol_count": stat["patrol_count"],
            "unique_days_count": len(stat["unique_days"]),
            "day_list": stat["day_list"],
        })
    items.sort(key=lambda x: (-x["total_events"], -x["unique_days_count"]))

    return {
        "code": 0,
        "message": "success",
        "data": {"teachers": items},
    }


# ============================================================
# 教室视图矩阵
# ============================================================


@router.get("/classrooms/matrix", response_model=dict)
async def get_classroom_matrix(
    db: AsyncSession = Depends(get_db),
    version_id: int | None = Query(None, description="按排考版本过滤，默认显示已发布版本"),
) -> dict:
    """获取教室视图矩阵
    
    - version_id 不指定时，从 Exam 表读取已发布数据
    - version_id 指定时，从该版本快照读取
    """
    matrix: dict[str, dict[str, list[dict]]] = {}

    if version_id:
        snapshot_exams = await _get_exams_from_snapshot(db, version_id)
        for er in snapshot_exams:
            for cr in er.get("classrooms", []):
                room_name = cr.get("classroom_name", f"教室{cr.get('classroom_id')}")
                if room_name not in matrix:
                    matrix[room_name] = {}
                date_key = er.get("exam_date") or DAY_NAMES.get(er.get("day_of_week"), str(er.get("day_of_week")))
                slot_key = f"{date_key}-{er.get('slot_code')}"
                if slot_key not in matrix[room_name]:
                    matrix[room_name][slot_key] = []
                class_names = [ca.get("class_name", "") for ca in cr.get("class_assignments", [])]
                teacher_names = [
                    tr.get("teacher_name", "")
                    for tr in er.get("teachers", [])
                    if tr.get("role") == "fixed" and tr.get("classroom_id") == cr.get("classroom_id")
                ]
                date_label = None
                if er.get("exam_date"):
                    from datetime import datetime as _dt
                    try:
                        date_label = _dt.fromisoformat(er["exam_date"]).strftime("%m-%d")
                    except Exception:
                        pass
                matrix[room_name][slot_key].append({
                    "exam_id": er.get("exam_id", 0),
                    "course_name": er.get("course_name", ""),
                    "exam_label": er.get("exam_label", ""),
                    "total_students": cr.get("student_count", 0),
                    "class_names": class_names,
                    "teacher_names": teacher_names,
                    "day_of_week": er.get("day_of_week"),
                    "day_name": DAY_NAMES.get(er.get("day_of_week"), ""),
                    "time_range": f"{er.get('start_time', '')}-{er.get('end_time', '')}",
                    "exam_date": date_key,
                    "date_label": date_label,
                })
    else:
        result = await db.execute(
            select(ExamClassroom)
            .join(Exam, ExamClassroom.exam_id == Exam.id)
            .where(Exam.status == ExamStatus.SCHEDULED)
            .options(
                selectinload(ExamClassroom.classroom),
                selectinload(ExamClassroom.exam).selectinload(Exam.course),
                selectinload(ExamClassroom.exam).selectinload(Exam.time_slot),
                selectinload(ExamClassroom.exam).selectinload(Exam.teacher_assignments).selectinload(ExamTeacher.teacher),
                selectinload(ExamClassroom.class_assignments).selectinload(ExamClassroomClass.class_),
            )
        )
        assignments = result.scalars().all()

        for ec in assignments:
            room_name = ec.classroom.name if ec.classroom else f"教室{ec.classroom_id}"
            if room_name not in matrix:
                matrix[room_name] = {}

            exam = ec.exam
            if exam and exam.time_slot:
                ts = exam.time_slot
                date_key = ts.exam_date.isoformat() if ts.exam_date else DAY_NAMES.get(ts.day_of_week, str(ts.day_of_week))
                slot_key = f"{date_key}-{ts.slot_code}"
                if slot_key not in matrix[room_name]:
                    matrix[room_name][slot_key] = []
                class_names = [
                    c.class_.name for c in ec.class_assignments
                    if c.class_ and c.class_.name
                ]
                teacher_names = [
                    et.teacher.name for et in exam.teacher_assignments
                    if et.classroom_id == ec.classroom_id
                    and et.teacher
                    and et.role.value == "fixed"
                ]
                date_label = ts.exam_date.strftime("%m-%d") if ts.exam_date else None
                matrix[room_name][slot_key].append({
                    "exam_id": exam.id,
                    "course_name": exam.course.name if exam.course else "",
                    "exam_label": exam.exam_label.value if exam.exam_label else "",
                    "total_students": ec.total_students,
                    "class_names": class_names,
                    "teacher_names": teacher_names,
                    "day_of_week": ts.day_of_week,
                    "day_name": DAY_NAMES.get(ts.day_of_week, ""),
                    "time_range": f"{ts.start_time}-{ts.end_time}",
                    "exam_date": date_key,
                    "date_label": date_label,
                })

    return {"code": 0, "message": "success", "data": {"matrix": matrix}}


# ============================================================
# 流动监考视图矩阵
# ============================================================


@router.get("/patrol/matrix", response_model=dict)
async def get_patrol_matrix(
    db: AsyncSession = Depends(get_db),
    version_id: int | None = Query(None, description="按排考版本过滤，默认显示已发布版本"),
) -> dict:
    """获取流动监考视图矩阵 (日期 x 时段)
    
    - version_id 不指定时，从 Exam 表读取已发布数据
    - version_id 指定时，从该版本快照读取
    """
    matrix: dict[str, dict[str, list[dict]]] = {}
    group_names: set[str] = set()

    if version_id:
        snapshot_exams = await _get_exams_from_snapshot(db, version_id)
        seen: set[tuple[str, int]] = set()
        for er in snapshot_exams:
            for tr in er.get("teachers", []):
                if tr.get("role") != "patrol":
                    continue
                date_key = er.get("exam_date") or DAY_NAMES.get(er.get("day_of_week"), str(er.get("day_of_week")))
                slot_code = er.get("slot_code")
                key = (date_key, tr.get("teacher_id"))
                if key in seen:
                    continue
                seen.add(key)
                if date_key and slot_code:
                    if date_key not in matrix:
                        matrix[date_key] = {"T1": [], "T2": [], "T3": [], "T4": []}
                    date_label = None
                    if er.get("exam_date"):
                        from datetime import datetime as _dt
                        try:
                            date_label = _dt.fromisoformat(er["exam_date"]).strftime("%m-%d")
                        except Exception:
                            pass
                    matrix[date_key][slot_code].append({
                        "teacher_id": tr.get("teacher_id"),
                        "teacher_name": tr.get("teacher_name", f"教师{tr.get('teacher_id')}"),
                        "patrol_group_name": tr.get("patrol_group_name"),
                        "day_of_week": er.get("day_of_week"),
                        "day_name": DAY_NAMES.get(er.get("day_of_week"), ""),
                        "date_label": date_label,
                    })
                    if tr.get("patrol_group_name"):
                        group_names.add(tr.get("patrol_group_name"))
    else:
        from app.models.exam_teacher import ExamTeacherRole

        result = await db.execute(
            select(ExamTeacher, Teacher, TimeSlot)
            .join(Exam, ExamTeacher.exam_id == Exam.id)
            .join(Teacher, ExamTeacher.teacher_id == Teacher.id)
            .join(TimeSlot, Exam.time_slot_id == TimeSlot.id)
            .where(Exam.status == ExamStatus.SCHEDULED)
            .where(ExamTeacher.role == ExamTeacherRole.PATROL)
        )

        seen: set[tuple[int, int]] = set()
        for et, teacher, ts in result.unique():
            key = (ts.id, et.teacher_id)
            if key in seen:
                continue
            seen.add(key)

            date_key = ts.exam_date.isoformat() if ts.exam_date else DAY_NAMES.get(ts.day_of_week, str(ts.day_of_week))
            slot_code = ts.slot_code
            if date_key and slot_code:
                if date_key not in matrix:
                    matrix[date_key] = {"T1": [], "T2": [], "T3": [], "T4": []}
                matrix[date_key][slot_code].append({
                    "teacher_id": et.teacher_id,
                    "teacher_name": teacher.name if teacher else f"教师{et.teacher_id}",
                    "patrol_group_name": et.patrol_group_name,
                    "day_of_week": ts.day_of_week,
                    "day_name": DAY_NAMES.get(ts.day_of_week, ""),
                    "date_label": ts.exam_date.strftime("%m-%d") if ts.exam_date else None,
                })
                if et.patrol_group_name:
                    group_names.add(et.patrol_group_name)

    # 补充同 slot_pair 的空白时段（T2复用T1，T4复用T3）
    for date_key in matrix:
        if not matrix[date_key]["T2"] and matrix[date_key]["T1"]:
            matrix[date_key]["T2"] = [dict(p) for p in matrix[date_key]["T1"]]
        if not matrix[date_key]["T4"] and matrix[date_key]["T3"]:
            matrix[date_key]["T4"] = [dict(p) for p in matrix[date_key]["T3"]]

    # 为每个分组分配一个柔和的背景色（用于前端高亮）
    palette = [
        "#E0F2FE",  # 浅蓝
        "#FEF3C7",  # 浅黄
        "#D1FAE5",  # 浅绿
        "#FCE7F3",  # 浅粉
        "#EDE9FE",  # 浅紫
        "#FFEDD5",  # 浅橙
        "#E5E7EB",  # 浅灰
    ]
    group_colors = {}
    for idx, name in enumerate(sorted(group_names)):
        group_colors[name] = palette[idx % len(palette)]

    return {
        "code": 0,
        "message": "success",
        "data": {
            "matrix": matrix,
            "group_colors": group_colors,
        },
    }


# ============================================================
# 班级考试时间表
# ============================================================


@router.get("/classes/{class_id}/schedule", response_model=dict)
async def get_class_schedule(
    class_id: int,
    db: AsyncSession = Depends(get_db),
    version_id: int | None = Query(None, description="按排考版本过滤，默认显示已发布版本"),
) -> dict:
    """获取班级考试时间表
    
    - version_id 不指定时，从 Exam 表读取已发布数据
    - version_id 指定时，从该版本快照读取
    """
    cls = await db.get(Class, class_id)
    if not cls:
        raise HTTPException(status_code=404, detail=f"班级(id={class_id})不存在")

    schedule = []

    if version_id:
        snapshot_exams = await _get_exams_from_snapshot(db, version_id)
        for er in snapshot_exams:
            # 检查该考试是否包含此班级
            found = False
            classroom_name = None
            classroom_id = None
            for cr in er.get("classrooms", []):
                for ca in cr.get("class_assignments", []):
                    if ca.get("class_id") == class_id:
                        found = True
                        classroom_name = cr.get("classroom_name", f"教室{cr.get('classroom_id')}")
                        classroom_id = cr.get("classroom_id")
                        break
                if found:
                    break
            if not found:
                continue

            teacher_names = []
            for tr in er.get("teachers", []):
                if tr.get("role") == "fixed" and tr.get("classroom_id") == classroom_id:
                    teacher_names.append(tr.get("teacher_name", f"教师{tr.get('teacher_id')}"))

            date_label = None
            if er.get("exam_date"):
                from datetime import datetime as _dt
                try:
                    date_label = _dt.fromisoformat(er["exam_date"]).strftime("%m-%d")
                except Exception:
                    pass

            schedule.append({
                "exam_id": er.get("exam_id", 0),
                "course_name": er.get("course_name", ""),
                "course_type": er.get("course_type", ""),
                "exam_label": er.get("exam_label", ""),
                "day_of_week": er.get("day_of_week"),
                "day_name": DAY_NAMES.get(er.get("day_of_week"), ""),
                "slot_code": er.get("slot_code"),
                "time_range": f"{er.get('start_time', '')}-{er.get('end_time', '')}",
                "exam_date": er.get("exam_date"),
                "date_label": date_label,
                "status": "scheduled",
                "classroom_name": classroom_name,
                "teacher_names": teacher_names,
            })
    else:
        result = await db.execute(
            select(Exam)
            .join(ExamClassroom, Exam.id == ExamClassroom.exam_id)
            .join(ExamClassroomClass, ExamClassroom.id == ExamClassroomClass.exam_classroom_id)
            .where(
                ExamClassroomClass.class_id == class_id,
                Exam.status == ExamStatus.SCHEDULED,
            )
            .options(
                selectinload(Exam.course),
                selectinload(Exam.time_slot),
                selectinload(Exam.classroom_assignments).selectinload(ExamClassroom.classroom),
                selectinload(Exam.classroom_assignments).selectinload(ExamClassroom.class_assignments),
                selectinload(Exam.teacher_assignments).selectinload(ExamTeacher.teacher),
            )
            .distinct()
        )
        exams = result.scalars().all()

        for exam in exams:
            if not exam.time_slot:
                continue

            classroom_name = None
            classroom_id = None
            for ec in exam.classroom_assignments:
                for ca in ec.class_assignments:
                    if ca.class_id == class_id:
                        classroom_name = ec.classroom.name if ec.classroom else f"教室{ec.classroom_id}"
                        classroom_id = ec.classroom_id
                        break
                if classroom_name:
                    break

            teacher_names = []
            for et in exam.teacher_assignments:
                if et.role.value == "fixed" and et.classroom_id == classroom_id:
                    teacher_names.append(et.teacher.name if et.teacher else f"教师{et.teacher_id}")

            ts = exam.time_slot
            date_label = ts.exam_date.strftime("%m-%d") if ts.exam_date else None
            schedule.append({
                "exam_id": exam.id,
                "course_name": exam.course.name if exam.course else "",
                "course_type": exam.course.course_type.value if exam.course else "",
                "exam_label": exam.exam_label.value if exam.exam_label else "",
                "day_of_week": ts.day_of_week,
                "day_name": DAY_NAMES.get(ts.day_of_week, ""),
                "slot_code": ts.slot_code,
                "time_range": f"{ts.start_time}-{ts.end_time}",
                "exam_date": ts.exam_date.isoformat() if ts.exam_date else None,
                "date_label": date_label,
                "status": exam.status.value,
                "classroom_name": classroom_name,
                "teacher_names": teacher_names,
            })

    schedule.sort(key=lambda x: (x.get("exam_date") or f"week{x['day_of_week']}", x["slot_code"]))

    return {
        "code": 0,
        "message": "success",
        "data": {
            "class_id": class_id,
            "class_name": cls.name,
            "grade": cls.grade,
            "exams": schedule,
            "exam_count": len(schedule),
        },
    }


# ============================================================
# 课程考试详情 (含AB卷分卷情况)
# ============================================================


@router.get("/courses/{course_id}/detail", response_model=dict)
async def get_course_exam_detail(
    course_id: int,
    db: AsyncSession = Depends(get_db),
    version_id: int | None = Query(None, description="按排考版本过滤，默认显示已发布版本"),
) -> dict:
    """获取课程考试详情 (含AB卷分卷情况)
    
    - version_id 不指定时，从 Exam 表读取已发布数据
    - version_id 指定时，从该版本快照读取
    """
    course = await db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail=f"课程(id={course_id})不存在")

    exam_details = []
    ab_analysis = None

    if version_id:
        snapshot_exams = await _get_exams_from_snapshot(db, version_id)
        course_exams = [er for er in snapshot_exams if er.get("course_id") == course_id]

        for er in course_exams:
            classrooms = []
            classroom_name_map = {}
            for cr in er.get("classrooms", []):
                room_id = cr.get("classroom_id")
                room_name = cr.get("classroom_name", f"教室{room_id}")
                classroom_name_map[room_id] = room_name
                classrooms.append({
                    "classroom_name": room_name,
                    "total_students": cr.get("student_count", 0),
                    "classes": [
                        {"class_name": ca.get("class_name", f"班级{ca.get('class_id')}"), "student_count": ca.get("student_count", 0)}
                        for ca in cr.get("class_assignments", [])
                    ],
                })
            fixed_teachers = []
            for tr in er.get("teachers", []):
                if tr.get("role") == "fixed":
                    fixed_teachers.append({
                        "teacher_name": tr.get("teacher_name", f"教师{tr.get('teacher_id')}"),
                        "classroom_name": classroom_name_map.get(tr.get("classroom_id")),
                    })
            exam_details.append({
                "exam_id": er.get("exam_id", 0),
                "exam_label": er.get("exam_label", ""),
                "day_name": DAY_NAMES.get(er.get("day_of_week"), ""),
                "slot_code": er.get("slot_code"),
                "time_range": f"{er.get('start_time', '')}-{er.get('end_time', '')}",
                "exam_date": er.get("exam_date"),
                "classrooms": classrooms,
                "fixed_teachers": fixed_teachers,
            })

        # AB卷分析
        if course.needs_ab and len(course_exams) >= 2:
            a_exam = next((e for e in course_exams if e.get("exam_label") == "A"), None)
            b_exam = next((e for e in course_exams if e.get("exam_label") == "B"), None)
            if a_exam and b_exam:
                a_students = sum(cr.get("student_count", 0) for cr in a_exam.get("classrooms", []))
                b_students = sum(cr.get("student_count", 0) for cr in b_exam.get("classrooms", []))
                ab_analysis = {
                    "a_exam_id": a_exam.get("exam_id"),
                    "b_exam_id": b_exam.get("exam_id"),
                    "a_student_count": a_students,
                    "b_student_count": b_students,
                    "balance": "均衡" if abs(a_students - b_students) <= 5 else "不均衡",
                    "a_time_slot": f"{a_exam.get('exam_date') or DAY_NAMES.get(a_exam.get('day_of_week'), '')}-{a_exam.get('slot_code')}",
                    "b_time_slot": f"{b_exam.get('exam_date') or DAY_NAMES.get(b_exam.get('day_of_week'), '')}-{b_exam.get('slot_code')}",
                }
    else:
        result = await db.execute(
            select(Exam)
            .where(Exam.course_id == course_id)
            .options(
                selectinload(Exam.time_slot),
                selectinload(Exam.classroom_assignments).selectinload(ExamClassroom.classroom),
                selectinload(Exam.classroom_assignments).selectinload(ExamClassroom.class_assignments).selectinload(ExamClassroomClass.class_),
                selectinload(Exam.teacher_assignments).selectinload(ExamTeacher.teacher),
            )
            .order_by(Exam.exam_label)
        )
        exams = result.scalars().all()

        exam_details = [_format_exam_detail(e) for e in exams]

        # AB卷分析
        if course.needs_ab and len(exams) >= 2:
            a_exam = next((e for e in exams if e.exam_label and e.exam_label.value == "A"), None)
            b_exam = next((e for e in exams if e.exam_label and e.exam_label.value == "B"), None)
            if a_exam and b_exam:
                a_students = sum(ec.total_students for ec in a_exam.classroom_assignments)
                b_students = sum(ec.total_students for ec in b_exam.classroom_assignments)
                ab_analysis = {
                    "a_exam_id": a_exam.id,
                    "b_exam_id": b_exam.id,
                    "a_student_count": a_students,
                    "b_student_count": b_students,
                    "balance": "均衡" if abs(a_students - b_students) <= 5 else "不均衡",
                    "a_time_slot": f"{a_exam.time_slot.exam_date.isoformat() if a_exam.time_slot.exam_date else DAY_NAMES.get(a_exam.time_slot.day_of_week, '')}-{a_exam.time_slot.slot_code}" if a_exam.time_slot else None,
                    "b_time_slot": f"{b_exam.time_slot.exam_date.isoformat() if b_exam.time_slot.exam_date else DAY_NAMES.get(b_exam.time_slot.day_of_week, '')}-{b_exam.time_slot.slot_code}" if b_exam.time_slot else None,
                }

    return {
        "code": 0,
        "message": "success",
        "data": {
            "course_id": course_id,
            "course_name": course.name,
            "course_type": course.course_type.value,
            "needs_ab": course.needs_ab,
            "exams": exam_details,
            "ab_analysis": ab_analysis,
        },
    }


# ============================================================
# 辅助函数: 格式化考试详情
# ============================================================


def _format_exam_detail(exam: Exam) -> dict:
    """格式化考试详情为字典"""
    item = ExamResponse.model_validate(exam).model_dump()

    # 时段信息
    if exam.time_slot:
        date_label = exam.time_slot.exam_date.strftime("%m-%d") if exam.time_slot.exam_date else None
        item["time_slot"] = {
            "id": exam.time_slot.id,
            "day_of_week": exam.time_slot.day_of_week,
            "day_name": DAY_NAMES.get(exam.time_slot.day_of_week, ""),
            "slot_code": exam.time_slot.slot_code,
            "time_range": f"{exam.time_slot.start_time}-{exam.time_slot.end_time}",
            "exam_date": exam.time_slot.exam_date.isoformat() if exam.time_slot.exam_date else None,
            "date_label": date_label,
        }

    # 教室信息
    item["classrooms"] = []
    classroom_name_map = {}
    for ec in exam.classroom_assignments:
        room_name = ec.classroom.name if ec.classroom else f"教室{ec.classroom_id}"
        classroom_name_map[ec.classroom_id] = room_name
        room_info = {
            "classroom_id": ec.classroom_id,
            "classroom_name": room_name,
            "capacity": ec.classroom.capacity if ec.classroom else 0,
            "total_students": ec.total_students,
            "classes": [
                {
                    "class_id": ca.class_id,
                    "class_name": ca.class_.name if ca.class_ else f"班级{ca.class_id}",
                    "student_count": ca.student_count,
                }
                for ca in ec.class_assignments
            ],
        }
        item["classrooms"].append(room_info)

    # 教师信息
    item["fixed_teachers"] = []
    item["patrol_teachers"] = []
    item["teachers"] = []
    for et in exam.teacher_assignments:
        t_info = {
            "teacher_id": et.teacher_id,
            "teacher_name": et.teacher.name if et.teacher else f"教师{et.teacher_id}",
            "role": et.role.value,
            "classroom_id": et.classroom_id,
            "classroom_name": classroom_name_map.get(et.classroom_id) if et.classroom_id else None,
        }
        item["teachers"].append(t_info)
        if et.role.value == "fixed":
            item["fixed_teachers"].append(t_info)
        else:
            item["patrol_teachers"].append(t_info)

    # 课程信息
    if exam.course:
        item["course_name"] = exam.course.name
        item["course_type"] = exam.course.course_type.value

    item["total_students"] = sum(ec.total_students for ec in exam.classroom_assignments)

    return item


def _format_exam_from_snapshot(exam_record: dict, time_slot: TimeSlot | None) -> dict:
    """从快照数据格式化考试详情为字典"""
    course_id = exam_record.get("course_id")
    course_name = exam_record.get("course_name", f"课程{course_id}")
    course_type = exam_record.get("course_type", "major")
    exam_label = exam_record.get("exam_label", "")

    # 时段信息
    time_slot_info = {}
    if time_slot:
        date_label = time_slot.exam_date.strftime("%m-%d") if time_slot.exam_date else None
        time_slot_info = {
            "id": time_slot.id,
            "day_of_week": time_slot.day_of_week,
            "day_name": DAY_NAMES.get(time_slot.day_of_week, ""),
            "slot_code": time_slot.slot_code,
            "time_range": f"{time_slot.start_time}-{time_slot.end_time}",
            "exam_date": time_slot.exam_date.isoformat() if time_slot.exam_date else None,
            "date_label": date_label,
        }
    else:
        # 尝试从快照中读取日期信息
        snap_date = exam_record.get("exam_date")
        snap_dow = exam_record.get("day_of_week", 0)
        snap_slot = exam_record.get("slot_code", "")
        time_slot_info = {
            "id": exam_record.get("time_slot_id"),
            "day_of_week": snap_dow,
            "day_name": DAY_NAMES.get(snap_dow, ""),
            "slot_code": snap_slot,
            "time_range": "",
            "exam_date": snap_date,
            "date_label": snap_date[5:10] if isinstance(snap_date, str) and len(snap_date) >= 10 else None,
        }

    # 教室信息
    classrooms = []
    classroom_name_map = {}
    for cr in exam_record.get("classrooms", []):
        room_id = cr.get("classroom_id")
        room_name = cr.get("classroom_name", f"教室{room_id}")
        capacity = cr.get("capacity", 0)
        classroom_name_map[room_id] = room_name
        
        class_list = []
        for ca in cr.get("class_assignments", []):
            class_list.append({
                "class_id": ca.get("class_id"),
                "class_name": ca.get("class_name", f"班级{ca.get('class_id')}"),
                "student_count": ca.get("student_count", 0),
            })
        
        classrooms.append({
            "classroom_id": room_id,
            "classroom_name": room_name,
            "capacity": capacity,
            "total_students": cr.get("student_count", 0),
            "classes": class_list,
        })

    # 教师信息
    fixed_teachers = []
    patrol_teachers = []
    teachers = []
    for tr in exam_record.get("teachers", []):
        teacher_id = tr.get("teacher_id")
        teacher_name = tr.get("teacher_name", f"教师{teacher_id}")
        role = tr.get("role", "fixed")
        classroom_id = tr.get("classroom_id")
        classroom_name = classroom_name_map.get(classroom_id) if classroom_id else None
        
        t_info = {
            "teacher_id": teacher_id,
            "teacher_name": teacher_name,
            "role": role,
            "classroom_id": classroom_id,
            "classroom_name": classroom_name,
        }
        teachers.append(t_info)
        if role == "fixed":
            fixed_teachers.append(t_info)
        else:
            patrol_teachers.append(t_info)

    return {
        "id": exam_record.get("exam_id", 0),
        "course_id": course_id,
        "course_name": course_name,
        "course_type": course_type,
        "exam_label": exam_label,
        "time_slot": time_slot_info,
        "classrooms": classrooms,
        "teachers": teachers,
        "fixed_teachers": fixed_teachers,
        "patrol_teachers": patrol_teachers,
        "total_students": exam_record.get("student_count", 0),
    }


# ============================================================
# 批量班级考试表
# ============================================================


@router.get("/classes/batch-schedule", response_model=dict)
async def get_batch_class_schedule(
    db: AsyncSession = Depends(get_db),
    version_id: int | None = Query(None, description="按排考版本过滤，默认显示已发布版本"),
) -> dict:
    """获取所有班级的考试安排
    
    - version_id 不指定时，从 Exam 表读取已发布数据
    - version_id 指定时，从该版本快照读取
    """
    result = await db.execute(select(Class).order_by(Class.grade.desc(), Class.name))
    classes = result.scalars().all()

    if version_id:
        snapshot_exams = await _get_exams_from_snapshot(db, version_id)

    classes_data = []
    for cls in classes:
        exams_data = []

        if version_id:
            # 从快照筛选包含该班级的考试
            for er in snapshot_exams:
                classroom_name = None
                matched_classroom_id = None
                for cr in er.get("classrooms", []):
                    for ca in cr.get("class_assignments", []):
                        if ca.get("class_id") == cls.id:
                            classroom_name = cr.get("classroom_name", f"教室{cr.get('classroom_id')}")
                            matched_classroom_id = cr.get("classroom_id")
                            break
                    if classroom_name:
                        break
                if not classroom_name:
                    continue

                teacher_names = [
                    tr.get("teacher_name", f"教师{tr.get('teacher_id')}")
                    for tr in er.get("teachers", [])
                    if tr.get("role") == "fixed" and tr.get("classroom_id") == matched_classroom_id
                ]

                exams_data.append({
                    "course_name": er.get("course_name", ""),
                    "day_name": DAY_NAMES.get(er.get("day_of_week"), ""),
                    "slot_code": er.get("slot_code"),
                    "time_range": f"{er.get('start_time', '')}-{er.get('end_time', '')}",
                    "classroom_name": classroom_name,
                    "teacher_names": teacher_names,
                })
        else:
            # 从 Exam 表读取
            exam_result = await db.execute(
                select(Exam)
                .join(ExamClassroom, Exam.id == ExamClassroom.exam_id)
                .join(ExamClassroomClass, ExamClassroom.id == ExamClassroomClass.exam_classroom_id)
                .where(
                    ExamClassroomClass.class_id == cls.id,
                    Exam.status == ExamStatus.SCHEDULED,
                )
                .options(
                    selectinload(Exam.course),
                    selectinload(Exam.time_slot),
                    selectinload(Exam.classroom_assignments).selectinload(ExamClassroom.classroom),
                    selectinload(Exam.teacher_assignments).selectinload(ExamTeacher.teacher),
                )
                .distinct()
            )
            exams = exam_result.scalars().all()

            for exam in exams:
                if not exam.time_slot:
                    continue

                classroom_name = None
                matched_classroom_id = None
                for ec in exam.classroom_assignments:
                    for ca in ec.class_assignments:
                        if ca.class_id == cls.id:
                            classroom_name = ec.classroom.name if ec.classroom else f"教室{ec.classroom_id}"
                            matched_classroom_id = ec.classroom_id
                            break
                    if classroom_name:
                        break

                teacher_names = [
                    et.teacher.name if et.teacher else f"教师{et.teacher_id}"
                    for et in exam.teacher_assignments
                    if et.role.value == "fixed" and et.classroom_id == matched_classroom_id
                ]

                exams_data.append({
                    "course_name": exam.course.name if exam.course else "",
                    "day_name": DAY_NAMES.get(exam.time_slot.day_of_week, ""),
                    "slot_code": exam.time_slot.slot_code,
                    "time_range": f"{exam.time_slot.start_time}-{exam.time_slot.end_time}",
                    "classroom_name": classroom_name,
                    "teacher_names": teacher_names,
                })

        exams_data.sort(key=lambda x: (x["day_name"], x["slot_code"]))

        classes_data.append({
            "class_id": cls.id,
            "class_name": cls.name,
            "grade": cls.grade,
            "exam_count": len(exams_data),
            "exams": exams_data,
        })

    return {
        "code": 0,
        "message": "success",
        "data": {"classes": classes_data},
    }


# ============================================================
# 课程考试安排（与 detail 接口合并，供前端 CoursePanel 使用）
# ============================================================


@router.get("/{course_id}/exams", response_model=dict)
async def get_course_exams(
    course_id: int,
    db: AsyncSession = Depends(get_db),
    version_id: int | None = Query(None, description="按排考版本过滤，默认显示已发布版本"),
) -> dict:
    """获取课程的考试安排（供前端 CoursePanel 使用）
    
    - version_id 不指定时，从 Exam 表读取已发布数据
    - version_id 指定时，从该版本快照读取
    """
    course = await db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail=f"课程(id={course_id})不存在")

    exam_list = []

    if version_id:
        snapshot_exams = await _get_exams_from_snapshot(db, version_id)
        course_exams = [er for er in snapshot_exams if er.get("course_id") == course_id]

        for er in course_exams:
            classrooms_info = []
            for cr in er.get("classrooms", []):
                class_list = [
                    {"class_name": ca.get("class_name", f"班级{ca.get('class_id')}"), "student_count": ca.get("student_count", 0)}
                    for ca in cr.get("class_assignments", [])
                ]
                classrooms_info.append({
                    "classroom_name": cr.get("classroom_name", f"教室{cr.get('classroom_id')}"),
                    "capacity": cr.get("capacity", 0),
                    "total_students": cr.get("student_count", 0),
                    "classes": class_list,
                })

            teachers_info = [
                {"teacher_name": tr.get("teacher_name", f"教师{tr.get('teacher_id')}"), "role": tr.get("role", "fixed")}
                for tr in er.get("teachers", [])
            ]

            exam_list.append({
                "exam_id": er.get("exam_id", 0),
                "exam_label": er.get("exam_label", ""),
                "day_of_week": er.get("day_of_week", 0),
                "day_name": DAY_NAMES.get(er.get("day_of_week"), ""),
                "slot_code": er.get("slot_code", ""),
                "time_range": f"{er.get('start_time', '')}-{er.get('end_time', '')}",
                "classrooms": classrooms_info,
                "teachers": teachers_info,
            })
    else:
        result = await db.execute(
            select(Exam)
            .where(Exam.course_id == course_id)
            .options(
                selectinload(Exam.time_slot),
                selectinload(Exam.classroom_assignments).selectinload(ExamClassroom.classroom),
                selectinload(Exam.classroom_assignments).selectinload(ExamClassroom.class_assignments).selectinload(ExamClassroomClass.class_),
                selectinload(Exam.teacher_assignments).selectinload(ExamTeacher.teacher),
            )
            .order_by(Exam.exam_label)
        )
        exams = result.scalars().all()

        for exam in exams:
            classrooms_info = []
            for ec in exam.classroom_assignments:
                room_name = ec.classroom.name if ec.classroom else f"教室{ec.classroom_id}"
                class_list = [
                    {"class_name": ca.class_.name if ca.class_ else f"班级{ca.class_id}", "student_count": ca.student_count}
                    for ca in ec.class_assignments
                ]
                classrooms_info.append({
                    "classroom_name": room_name,
                    "capacity": ec.classroom.capacity if ec.classroom else 0,
                    "total_students": ec.total_students,
                    "classes": class_list,
                })

            teachers_info = [
                {"teacher_name": et.teacher.name if et.teacher else f"教师{et.teacher_id}", "role": et.role.value}
                for et in exam.teacher_assignments
            ]

            exam_list.append({
                "exam_id": exam.id,
                "exam_label": exam.exam_label.value if exam.exam_label else "",
                "day_of_week": exam.time_slot.day_of_week if exam.time_slot else 0,
                "day_name": DAY_NAMES.get(exam.time_slot.day_of_week, "") if exam.time_slot else "",
                "slot_code": exam.time_slot.slot_code if exam.time_slot else "",
                "time_range": f"{exam.time_slot.start_time}-{exam.time_slot.end_time}" if exam.time_slot else "",
                "classrooms": classrooms_info,
                "teachers": teachers_info,
            })

    return {
        "code": 0,
        "message": "success",
        "data": {
            "course_id": course_id,
            "course_name": course.name,
            "course_type": course.course_type.value,
            "needs_ab": course.needs_ab,
            "exam_count": len(exam_list),
            "exams": exam_list,
        },
    }
