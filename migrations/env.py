"""
考试排考系统 - Alembic 环境配置

从 app.config 读取数据库同步 URL，支持在线/离线迁移。
"""

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.config import get_settings
from app.models import Base

# Alembic Config 对象
config = context.config

# 读取日志配置
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 目标元数据 (用于 autogenerate)
target_metadata = Base.metadata

# 获取数据库配置
settings = get_settings()
sync_database_url = settings.DATABASE_SYNC_URL


def run_migrations_offline() -> None:
    """离线模式: 不连接数据库直接生成 SQL 脚本。"""
    url = sync_database_url
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    """在线模式执行迁移的核心逻辑。"""
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """异步引擎在线迁移 (使用 asyncpg)。"""
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = sync_database_url

    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """在线模式入口。"""
    # 使用同步引擎直接执行 (最简单)
    from sqlalchemy import create_engine

    connectable = create_engine(sync_database_url, poolclass=pool.NullPool)

    with connectable.connect() as connection:
        do_run_migrations(connection)

    connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
