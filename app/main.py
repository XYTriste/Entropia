"""
考试排考系统 - FastAPI 应用入口

注册所有路由、CORS、静态文件服务、健康检查。
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.routers import (
    adjustments_router,
    audit_logs_router,
    chat_router,
    classes_router,
    classrooms_router,
    courses_router,
    exams_router,
    import_export_router,
    majors_router,
    scheduler_router,
    students_router,
    teachers_router,
    time_slots_router,
)

settings = get_settings()


# 生命周期管理
@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用启动/关闭钩子"""
    # 启动: 可在此预加载时段数据、初始化 OR-Tools 等
    yield
    # 关闭: 清理资源


# 创建 FastAPI 实例
app = FastAPI(
    title="考试排考系统",
    version=settings.APP_VERSION,
    description="考试自动排考系统 - OR-Tools + FastAPI + PostgreSQL",
    lifespan=lifespan,
)

# CORS 中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=settings.CORS_ALLOW_METHODS,
    allow_headers=settings.CORS_ALLOW_HEADERS,
)

# 静态文件服务 (前端 HTML + CSS + JS)
app.mount("/static", StaticFiles(directory="app/static"), name="static")


# 健康检查端点
@app.get("/api/health", tags=["系统"])
async def health_check() -> dict:
    """服务健康检查"""
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }


# 根路径
@app.get("/", tags=["系统"], include_in_schema=False)
async def root() -> dict:
    """根路径 - 返回系统信息"""
    return {
        "message": "考试排考系统 API",
        "version": settings.APP_VERSION,
        "docs": "/docs",
    }


# ============================================================
# 注册路由
# ============================================================

app.include_router(teachers_router, prefix="/api/teachers", tags=["教师管理"])
app.include_router(majors_router, prefix="/api/majors", tags=["专业管理"])
app.include_router(classes_router, prefix="/api/classes", tags=["班级管理"])
app.include_router(students_router, prefix="/api/students", tags=["学生管理"])
app.include_router(classrooms_router, prefix="/api/classrooms", tags=["教室管理"])
app.include_router(courses_router, prefix="/api/courses", tags=["课程管理"])
app.include_router(time_slots_router, prefix="/api/time-slots", tags=["时段管理"])
app.include_router(exams_router, prefix="/api/exams", tags=["考试管理"])
app.include_router(scheduler_router, prefix="/api/scheduler", tags=["排考引擎"])
app.include_router(adjustments_router, prefix="/api/adjustments", tags=["排考调剂"])
app.include_router(audit_logs_router, prefix="/api/audit-logs", tags=["审计日志"])
app.include_router(import_export_router, prefix="/api/import-export", tags=["导入导出"])
app.include_router(chat_router, prefix="/api/chat", tags=["AI 助手"])
