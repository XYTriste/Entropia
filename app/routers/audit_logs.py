"""
考试排考系统 - 审计日志路由

提供审计日志的查询功能 (支持按操作类型、实体、时间范围过滤)。
"""

from datetime import datetime, time
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.audit_log import AuditLog

router = APIRouter()

# 操作类型中文映射
ACTION_DISPLAY_MAP = {
    "teacher_transfer": "教师调剂",
    "change_teacher": "教师变更",
    "adjust_patrol": "监考调整",
    "lock_exam": "锁定考试",
    "unlock_exam": "解锁考试",
    "import_data": "导入数据",
    "export_data": "导出数据",
    "publish_schedule": "发布排考",
    "archive_schedule": "归档排考",
    "CREATE": "创建",
    "UPDATE": "更新",
    "DELETE": "删除",
}


async def get_entity_name(db: AsyncSession, entity_type: str, entity_id: int) -> str:
    """根据实体类型和ID获取实体名称"""
    try:
        if entity_type == "exam_teacher":
            # 查询监考安排表，关联教师表
            result = await db.execute(
                text("""
                    SELECT t.name, et.exam_id
                    FROM exam_teachers et
                    JOIN teachers t ON et.teacher_id = t.id
                    WHERE et.id = :entity_id
                """),
                {"entity_id": entity_id}
            )
            row = result.fetchone()
            if row:
                # 如果找到记录，返回教师名和考试ID
                return f"{row[0]} (考试#{row[1]})"
            # 如果找不到（可能已被删除），返回原实体ID
            return f"教师安排 #{entity_id}（已删除）"

        elif entity_type == "exam":
            # 查询考试表，关联课程表
            result = await db.execute(
                text("""
                    SELECT c.name, e.time_slot_id
                    FROM exams e
                    JOIN courses c ON e.course_id = c.id
                    WHERE e.id = :entity_id
                """),
                {"entity_id": entity_id}
            )
            row = result.fetchone()
            if row:
                return f"考试: {row[0]} (#{row[1]})"
            return f"考试 #{entity_id}（已删除）"

        elif entity_type == "course":
            result = await db.execute(
                text("SELECT name FROM courses WHERE id = :entity_id"),
                {"entity_id": entity_id}
            )
            row = result.fetchone()
            return row[0] if row else f"课程 #{entity_id}（已删除）"

        elif entity_type == "teacher":
            result = await db.execute(
                text("SELECT name FROM teachers WHERE id = :entity_id"),
                {"entity_id": entity_id}
            )
            row = result.fetchone()
            return row[0] if row else f"教师 #{entity_id}（已删除）"

        elif entity_type == "classroom":
            result = await db.execute(
                text("SELECT name FROM classrooms WHERE id = :entity_id"),
                {"entity_id": entity_id}
            )
            row = result.fetchone()
            return row[0] if row else f"教室 #{entity_id}（已删除）"

        else:
            return f"{entity_type} #{entity_id}（已删除）"
    except Exception:
        return f"{entity_type} #{entity_id}"


@router.get("/", response_model=dict)
async def list_audit_logs(
    db: AsyncSession = Depends(get_db),
    action: str | None = Query(None, description="按操作类型过滤"),
    entity_type: str | None = Query(None, description="按实体类型过滤"),
    entity_id: int | None = Query(None, description="按实体ID过滤"),
    operator: str | None = Query(None, description="按操作人过滤"),
    date_from: str | None = Query(None, description="起始日期 (YYYY-MM-DD)"),
    date_to: str | None = Query(None, description="结束日期 (YYYY-MM-DD)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
) -> dict:
    """获取审计日志列表 (支持多维过滤)"""
    query = select(AuditLog)

    if action:
        query = query.where(AuditLog.action == action)
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
    if entity_id:
        query = query.where(AuditLog.entity_id == entity_id)
    if operator:
        query = query.where(AuditLog.operator == operator)
    if date_from:
        try:
            dt_from = datetime.strptime(date_from, "%Y-%m-%d")
            query = query.where(AuditLog.created_at >= dt_from)
        except ValueError:
            pass
    if date_to:
        try:
            dt_to = datetime.strptime(date_to, "%Y-%m-%d")
            # 设置为当天结束
            dt_to = datetime.combine(dt_to.date(), time.max)
            query = query.where(AuditLog.created_at <= dt_to)
        except ValueError:
            pass

    count_result = await db.execute(select(func.count(AuditLog.id)).select_from(query.subquery()))
    total = count_result.scalar_one()

    result = await db.execute(query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit))
    items = result.scalars().all()

    # 转换为前端友好的格式
    items_data = []
    for log in items:
        entity_name = await get_entity_name(db, log.entity_type, log.entity_id)
        items_data.append({
            "id": log.id,
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "old_value": log.old_value,
            "new_value": log.new_value,
            "reason": log.reason,
            "operator": log.operator,
            "created_at": log.created_at.isoformat() if log.created_at else None,
            # 前端友好的字段
            "operation_type": log.action,
            "operation_type_display": ACTION_DISPLAY_MAP.get(log.action, log.action),
            "entity_name": entity_name,
        })

    return {
        "code": 0,
        "message": "success",
        "data": {
            "total": total,
            "items": items_data,
            "skip": skip,
            "limit": limit,
        },
    }
