"""
考试排考系统 - 通用 CRUD 基类

提供增删改查的标准实现，各业务 CRUD 继承此类后按需扩展。
"""

from typing import Any, Generic, Optional, Type, TypeVar

from fastapi import HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import Base

ModelType = TypeVar("ModelType", bound=Base)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)


class CRUDBase(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    """
    通用 CRUD 基类 (支持泛型 Schema 类型)

    泛型参数:
        ModelType: SQLAlchemy ORM 模型类
        CreateSchemaType: Pydantic 创建模型类
        UpdateSchemaType: Pydantic 更新模型类
    """

    def __init__(self, model: Type[ModelType]) -> None:
        self.model = model

    async def get(self, db: AsyncSession, id: int) -> Optional[ModelType]:
        """根据 ID 获取单条记录"""
        result = await db.execute(select(self.model).where(self.model.id == id))
        return result.scalar_one_or_none()

    async def get_or_404(self, db: AsyncSession, id: int) -> ModelType:
        """根据 ID 获取记录，不存在则抛出 404"""
        obj = await self.get(db, id)
        if obj is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{self.model.__tablename__}(id={id}) 不存在",
            )
        return obj

    async def get_multi(
        self,
        db: AsyncSession,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> list[ModelType]:
        """分页查询多条记录"""
        result = await db.execute(
            select(self.model).offset(skip).limit(limit)
        )
        return list(result.scalars().all())

    async def create(
        self, db: AsyncSession, *, obj_in: CreateSchemaType
    ) -> ModelType:
        """创建记录 (从 Pydantic 模型创建)"""
        obj_data = obj_in.model_dump(exclude_unset=True)
        db_obj = self.model(**obj_data)
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def update(
        self,
        db: AsyncSession,
        *,
        db_obj: ModelType,
        obj_in: UpdateSchemaType,
    ) -> ModelType:
        """更新记录 (仅更新非 None 字段)"""
        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if value is not None:
                setattr(db_obj, field, value)
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def delete(self, db: AsyncSession, *, id: int) -> ModelType:
        """删除记录"""
        obj = await self.get_or_404(db, id)
        await db.delete(obj)
        await db.commit()
        return obj

    async def count(self, db: AsyncSession) -> int:
        """获取总记录数"""
        from sqlalchemy import func

        result = await db.execute(select(func.count(self.model.id)))
        return result.scalar_one()
