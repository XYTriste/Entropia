"""
考试排考系统 - 数据库连接管理

提供 SQLAlchemy engine、sessionmaker、以及 FastAPI 依赖注入。
支持异步操作(asyncpg)。
"""

from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from app.config import get_settings

settings = get_settings()

# 创建异步引擎
async_engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW,
    pool_recycle=settings.DATABASE_POOL_RECYCLE,
    echo=settings.DATABASE_ECHO,
    future=True,
)

# 异步会话工厂
AsyncSessionLocal = async_sessionmaker(
    async_engine,
    class_=AsyncSession,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)

# 同步引擎 (用于 alembic 和后台任务)
from sqlalchemy import create_engine  # noqa: E402

sync_engine = create_engine(
    settings.DATABASE_SYNC_URL,
    poolclass=NullPool,
    echo=settings.DATABASE_ECHO,
)

SyncSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=sync_engine,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI 依赖: 为每个请求创建并关闭异步数据库会话。
    用法: Depends(get_db)
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
