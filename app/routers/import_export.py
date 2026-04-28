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
from app.services.export_service import export_excel, export_json, export_sql
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
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Excel 导出排考结果 (多 Sheet)"""
    excel_bytes = await export_excel(db)
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=exam_schedule.xlsx"},
    )


# ============================================================
# JSON 导出
# ============================================================


@router.get("/export/json", response_model=dict)
async def export_json_file(
    db: AsyncSession = Depends(get_db),
) -> dict:
    """JSON 导出排考结果"""
    result = await export_json(db)
    return {"code": 0, "message": "success", "data": result}


# ============================================================
# SQL 导出
# ============================================================


@router.get("/export/sql")
async def export_sql_file(
    db: AsyncSession = Depends(get_db),
) -> Response:
    """SQL 导出排考结果"""
    sql_content = await export_sql(db)
    return Response(
        content=sql_content.encode("utf-8"),
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=exam_schedule.sql"},
    )


# ============================================================
# Excel 模板下载
# ============================================================


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
