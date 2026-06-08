"""
考试排考系统 - 导入导出路由

提供 CSV 导入和多种格式导出:
- CSV 导入: 教师、教室、学生、课程、课程-班级关联
- 数据校验
- Excel 导出 (多 Sheet)
- JSON 导出
- SQL 导出
"""

import io
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from pydantic import BaseModel
from fastapi.responses import FileResponse, Response, StreamingResponse
from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.class_ import Class
from app.models.classroom import Classroom
from app.models.course import Course
from app.models.course_class import CourseClass
from app.models.major import Major
from app.models.student import Student
from app.models.teacher import Teacher
from app.models.time_slot import TimeSlot
from app.models.exam import Exam
from app.models.exam_classroom import ExamClassroom
from app.models.exam_classroom_class import ExamClassroomClass
from app.models.exam_teacher import ExamTeacher
from app.models.patrol_teacher import PatrolTeacher
from app.models.schedule_version import ScheduleVersion
from app.models.audit_log import AuditLog
from app.services.export_service import export_excel, export_json, export_sql, export_teacher_stats_excel
from app.services.import_service import (
    import_classrooms_csv,
    import_course_classes_csv,
    import_courses_csv,
    import_students_csv,
    import_teachers_csv,
    validate_all_data,
    generate_excel_template,
    import_excel,
)
from app.services.import_service_allinone import import_all_in_one, generate_all_in_one_template

router = APIRouter()


# ============================================================
# CSV 导入
# ============================================================


@router.post("/import/teachers", response_model=dict)
async def import_teachers(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """CSV 导入教师"""
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="请上传 CSV 文件")

    content = (await file.read()).decode("utf-8-sig")
    report = await import_teachers_csv(db, content)
    await db.commit()
    return {"code": 0, **report.to_dict()}


@router.post("/import/classrooms", response_model=dict)
async def import_classrooms(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """CSV 导入教室"""
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="请上传 CSV 文件")

    content = (await file.read()).decode("utf-8-sig")
    report = await import_classrooms_csv(db, content)
    await db.commit()
    return {"code": 0, **report.to_dict()}


@router.post("/import/students", response_model=dict)
async def import_students(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """CSV 导入学生"""
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="请上传 CSV 文件")

    content = (await file.read()).decode("utf-8-sig")
    report = await import_students_csv(db, content)
    await db.commit()
    return {"code": 0, **report.to_dict()}


@router.post("/import/courses", response_model=dict)
async def import_courses(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """CSV 导入课程"""
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="请上传 CSV 文件")

    content = (await file.read()).decode("utf-8-sig")
    report = await import_courses_csv(db, content)
    await db.commit()
    return {"code": 0, **report.to_dict()}


@router.post("/import/course-classes", response_model=dict)
async def import_course_classes(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """CSV 导入课程-班级关联"""
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="请上传 CSV 文件")

    content = (await file.read()).decode("utf-8-sig")
    report = await import_course_classes_csv(db, content)
    await db.commit()
    return {"code": 0, **report.to_dict()}


# ============================================================
# 数据校验
# ============================================================


@router.get("/import/validate", response_model=dict)
async def validate_data(
    db: AsyncSession = Depends(get_db),
) -> dict:
    """校验全部数据的完整性与一致性"""
    result = await validate_all_data(db)
    return {"code": 0, "message": "success", "data": result}


# ============================================================
# Excel 导出
# ============================================================


@router.get("/export/excel")
async def export_excel_file(
    version_id: int | None = Query(None, description="指定版本ID，导出版本对应的排考数据"),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Excel 导出排考结果 (多 Sheet)

    - 不指定 version_id：导出所有已排考的考试
    - 指定 version_id：仅导出版本对应的考试数据
    """
    excel_bytes = await export_excel(db, version_id=version_id)
    # 使用 ASCII 文件名 + RFC 5987 中文文件名
    filename_ascii = f"exam_schedule_v{version_id}.xlsx" if version_id else "exam_schedule.xlsx"
    filename_cn = f"排考结果_v{version_id}.xlsx" if version_id else "排考结果.xlsx"
    # RFC 5987: filename*=UTF-8''%XX%XX%XX...
    import urllib.parse
    encoded_name = urllib.parse.quote(filename_cn, safe='')
    header_value = f"attachment; filename=\"{filename_ascii}\"; filename*=UTF-8''{encoded_name}"
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": header_value},
    )


@router.get("/export/teacher-stats")
async def export_teacher_stats_file(
    version_id: int | None = Query(None, description="指定版本ID，导出版本对应的排考数据"),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """导出教师监考场次统计表（矩阵格式）

    - 不指定 version_id：导出所有已排考的考试对应的教师监考统计
    - 指定 version_id：仅导出版本对应的教师监考统计
    """
    excel_bytes = await export_teacher_stats_excel(db, version_id=version_id)
    today = datetime.now().strftime("%Y-%m-%d")
    filename_ascii = f"teacher_invigilation_stats_v{version_id}_{today}.xlsx" if version_id else f"teacher_invigilation_stats_{today}.xlsx"
    filename_cn = f"教师监考场次统计表_v{version_id}_{today}.xlsx" if version_id else f"教师监考场次统计表_{today}.xlsx"
    import urllib.parse
    encoded_name = urllib.parse.quote(filename_cn, safe='')
    header_value = f"attachment; filename=\"{filename_ascii}\"; filename*=UTF-8''{encoded_name}"
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": header_value},
    )


# ============================================================
# JSON 导出
# ============================================================


@router.get("/export/json", response_model=dict)
async def export_json_file(
    version_id: int | None = Query(None, description="指定版本ID，导出版本对应的排考数据"),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """JSON 导出排考结果

    - 不指定 version_id：导出所有已排考的考试
    - 指定 version_id：仅导出版本对应的考试数据
    """
    result = await export_json(db, version_id=version_id)
    return {"code": 0, "message": "success", "data": result}


# ============================================================
# SQL 导出
# ============================================================


@router.get("/export/sql")
async def export_sql_file(
    version_id: int | None = Query(None, description="指定版本ID，导出版本对应的排考数据"),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """SQL 导出排考结果

    - 不指定 version_id：导出所有已排考的考试
    - 指定 version_id：仅导出版本对应的考试数据
    """
    sql_content = await export_sql(db, version_id=version_id)
    # 使用 ASCII 文件名 + RFC 5987 中文文件名
    filename_ascii = f"exam_schedule_v{version_id}.sql" if version_id else "exam_schedule.sql"
    filename_cn = f"排考结果_v{version_id}.sql" if version_id else "排考结果.sql"
    import urllib.parse
    encoded_name = urllib.parse.quote(filename_cn, safe='')
    header_value = f"attachment; filename=\"{filename_ascii}\"; filename*=UTF-8''{encoded_name}"
    return Response(
        content=sql_content.encode("utf-8"),
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": header_value},
    )


# ============================================================
# Excel 模板下载
# ============================================================


@router.get("/templates/all-in-one")
async def download_all_in_one_template():
    """下载全量数据导入模板（多Sheet）"""
    excel_bytes = generate_all_in_one_template()
    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=all_in_one_template.xlsx"},
    )


@router.get("/templates/{entity}")
async def download_template(entity: str):
    """下载指定实体的 Excel 导入模板"""
    try:
        excel_bytes = generate_excel_template(entity)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={entity}_template.xlsx"},
    )


# ============================================================
# Excel 批量导入
# ============================================================


@router.post("/import-excel/{entity}", response_model=dict)
async def import_excel_endpoint(
    entity: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Excel 批量导入数据"""
    if not file.filename.endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="请上传 .xlsx 格式的 Excel 文件")

    file_bytes = await file.read()
    report = await import_excel(db, file_bytes, entity)
    await db.commit()
    return {"code": 0, **report.to_dict()}


# ============================================================
# 批量删除
# ============================================================


class BatchDeleteRequest(BaseModel):
    ids: list[int]


# 实体到模型和主键的映射
ENTITY_MODEL_MAP = {
    "teachers": (Teacher, "id"),
    "classrooms": (Classroom, "id"),
    "students": (Student, "id"),
    "courses": (Course, "id"),
    "classes": (Class, "id"),
    "majors": (Major, "id"),
    "course-classes": (CourseClass, "id"),
    "time-slots": (TimeSlot, "id"),
}


@router.post("/batch-delete/{entity}", response_model=dict)
async def batch_delete(
    entity: str,
    req: BatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """批量删除指定实体的数据

    请求体: { "ids": [1, 2, 3] }
    """
    if entity not in ENTITY_MODEL_MAP:
        raise HTTPException(status_code=400, detail=f"不支持的实体类型: {entity}")

    ids = req.ids
    if not ids:
        raise HTTPException(status_code=400, detail="ids 不能为空")

    model, pk_field = ENTITY_MODEL_MAP[entity]

    # 执行批量删除
    result = await db.execute(delete(model).where(getattr(model, pk_field).in_(ids)))
    await db.commit()
    deleted_count = result.rowcount

    return {
        "code": 0,
        "message": "删除成功",
        "data": {"deleted_count": deleted_count},
    }


# ============================================================
# 时段重新初始化
# ============================================================


@router.post("/init-time-slots", response_model=dict)
async def init_time_slots(
    db: AsyncSession = Depends(get_db),
) -> dict:
    """安全重新初始化标准考试时段

    步骤:
      1. 检查是否有课程引用了现有时段 (防止外键冲突)
      2. 清空时段表并重置序列
      3. 插入20个标准时段
    """
    # 1. 检查是否有课程引用了时段
    result = await db.execute(select(Course).where(Course.dept_assigned_time_slot_id.isnot(None)))
    linked_courses = result.scalars().all()
    if linked_courses:
        course_names = [c.name for c in linked_courses]
        raise HTTPException(
            status_code=400,
            detail=f"以下课程仍引用了现有时段，请先删除或修改这些课程: {', '.join(course_names[:5])}{' 等' if len(course_names) > 5 else ''}"
        )

    # 2. 清空时段表并重置序列
    await db.execute(delete(TimeSlot))
    await db.execute(text("ALTER SEQUENCE time_slots_id_seq RESTART WITH 1"))

    # 3. 插入20个标准时段
    slots = []
    slot_configs = [
        ("T1", "08:30", "10:10", True),
        ("T2", "10:20", "12:00", True),
        ("T3", "14:00", "15:40", True),
        ("T4", "15:50", "17:30", False),
    ]
    for day in range(1, 6):  # 周一到周五
        for code, start, end, continuous in slot_configs:
            slots.append(TimeSlot(
                day_of_week=day,
                slot_code=code,
                start_time=start,
                end_time=end,
                is_continuous=continuous,
            ))

    db.add_all(slots)
    await db.commit()

    return {
        "code": 0,
        "message": f"成功初始化 {len(slots)} 个标准考试时段",
        "data": {
            "inserted_count": len(slots),
            "slots": [
                {"id": i + 1, "day_of_week": s.day_of_week, "slot_code": s.slot_code,
                 "start_time": s.start_time, "end_time": s.end_time}
                for i, s in enumerate(slots)
            ],
        },
    }


# ============================================================
# 全量数据级联导入
# ============================================================


@router.post("/import-excel-all", response_model=dict)
async def import_excel_all_endpoint(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """全量数据级联导入（单文件多Sheet）"""
    if not file.filename.endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="请上传 .xlsx 格式的 Excel 文件")

    file_bytes = await file.read()
    result = await import_all_in_one(db, file_bytes)
    await db.commit()
    return {"code": 0, "message": result["overall_summary"], "data": result}


@router.get("/templates/all-in-one")
async def download_all_in_one_template():
    """下载全量数据导入模板（多Sheet）"""
    excel_bytes = generate_all_in_one_template()
    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=all_in_one_template.xlsx"},
    )


# ============================================================
# 一键清除基础数据
# ============================================================


class ClearDataRequest(BaseModel):
    confirm: bool = False
    preserve_audit_logs: bool = True


@router.post("/clear-data", response_model=dict)
async def clear_all_data(
    req: ClearDataRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """一键清除全部基础数据（保留时段）

    请求体: { "confirm": true, "preserve_audit_logs": true }

    清除顺序（从依赖链末端开始，避免外键冲突）：
    监考分配 → 巡考分配 → 考场班级分配 → 考场 → 考试 → 课程班级关联 → 学生 → 班级 → 课程 → 专业 → 教师 → 教室

    保留：时段表、（可选）审计日志
    """
    if not req.confirm:
        raise HTTPException(
            status_code=400,
            detail="此操作将清空所有基础数据，请在请求体中设置 confirm: true 以确认执行"
        )

    cleared_counts = {}

    # 使用 TRUNCATE ... CASCADE 高效清除，按依赖顺序
    tables_to_truncate = [
        ("exam_teachers", ExamTeacher.__tablename__),
        ("patrol_teachers", PatrolTeacher.__tablename__),
        ("exam_classroom_classes", ExamClassroomClass.__tablename__),
        ("exam_classrooms", ExamClassroom.__tablename__),
        ("exams", Exam.__tablename__),
        ("course_classes", CourseClass.__tablename__),
        ("students", Student.__tablename__),
        ("classes", Class.__tablename__),
        ("courses", Course.__tablename__),
        ("majors", Major.__tablename__),
        ("teachers", Teacher.__tablename__),
        ("classrooms", Classroom.__tablename__),
    ]

    if not req.preserve_audit_logs:
        tables_to_truncate.insert(0, ("audit_logs", AuditLog.__tablename__))
        tables_to_truncate.insert(0, ("schedule_versions", ScheduleVersion.__tablename__))

    for label, table_name in tables_to_truncate:
        try:
            result = await db.execute(text(f"TRUNCATE TABLE {table_name} CASCADE"))
            cleared_counts[label] = "已清空"
        except Exception as e:
            cleared_counts[label] = f"失败: {e}"

    await db.commit()

    return {
        "code": 0,
        "message": "数据清除完成",
        "data": {
            "cleared": cleared_counts,
            "preserved": ["time_slots"] + (["audit_logs", "schedule_versions"] if req.preserve_audit_logs else []),
        },
    }
