"""
考试排考系统 - 全局配置模块

使用 Pydantic Settings 管理环境变量配置，
所有环境变量以 SCHEDULER_ 为前缀。
"""

from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """应用全局配置类"""

    model_config = SettingsConfigDict(
        env_prefix="SCHEDULER_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # 应用基础配置
    APP_NAME: str = "ExamScheduler"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # 数据库配置 (PostgreSQL)
    # 注意：生产环境请通过环境变量 SCHEDULER_DATABASE_URL 设置
    # 默认值仅用于本地开发，勿在生产环境使用
    DATABASE_URL: str = ""
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10
    DATABASE_POOL_RECYCLE: int = 3600
    DATABASE_ECHO: bool = False

    # 同步数据库URL (用于alembic)
    # 注意：生产环境请通过环境变量 SCHEDULER_DATABASE_SYNC_URL 设置
    DATABASE_SYNC_URL: str = ""

    # CORS 配置
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",   # React/Vite 开发服务器
        "http://127.0.0.1:5173",
        "http://localhost:3000",   # Next.js / CRA 开发服务器
        "http://127.0.0.1:3000",
        "http://localhost:8080",  # 原生 JS 前端
        "http://127.0.0.1:8080",
    ]
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: List[str] = ["*"]
    CORS_ALLOW_HEADERS: List[str] = ["*"]

    # 排考引擎配置
    SCHEDULER_MAX_SOLVE_TIME: int = 300  # 秒
    SCHEDULER_LOG_SEARCH_PROGRESS: bool = False

    # 日志配置
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

    # 安全
    SECRET_KEY: str = "change-me-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60


@lru_cache
def get_settings() -> Settings:
    """获取配置单例 (缓存避免重复读取环境变量)"""
    return Settings()
