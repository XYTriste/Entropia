"""
考试排考系统 - 审计日志路由

提供审计日志的查询功能 (支持按操作类型、实体、时间范围过滤)。
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.audit_log import AuditLog

router = APIRouter()


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
            from datetime import time, timedelta
            dt_to = datetime.combine(dt_to.date(), time.max)
            query = query.where(AuditLog.created_at <= dt_to)
        except ValueError:
            pass

    from sqlalchemy import func
    count_result = await db.execute(select(func.count(AuditLog.id)).select_from(query.subquery()))
    total = count_result.scalar_one()

    result = await db.execute(query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit))
    items = result.scalars().all()

    return {
        "code": 0,
        "message": "success",
        "data": {
            "total": total,
            "items": [
                {
                    "id": log.id,
                    "action": log.action,
                    "entity_type": log.entity_type,
                    "entity_id": log.entity_id,
                    "old_value": log.old_value,
                    "new_value": log.new_value,
                    "reason": log.reason,
                    "operator": log.operator,
                    "created_at": log.created_at.isoformat() if log.created_at else None,
                }
                for log in items
            ],
            "skip": skip,
            "limit": limit,
        },
    }
