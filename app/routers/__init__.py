"""
考试排考系统 - 路由包入口

聚合导入所有路由模块，便于 main.py 统一注册。
"""

from app.routers.teachers import router as teachers_router
from app.routers.majors import router as majors_router
from app.routers.classes import router as classes_router
from app.routers.students import router as students_router
from app.routers.classrooms import router as classrooms_router
from app.routers.courses import router as courses_router
from app.routers.time_slots import router as time_slots_router
from app.routers.exams import router as exams_router
from app.routers.scheduler import router as scheduler_router
from app.routers.adjustments import router as adjustments_router
from app.routers.audit_logs import router as audit_logs_router
from app.routers.import_export import router as import_export_router
from app.routers.chat import router as chat_router
from app.routers.kpi import router as kpi_router

__all__ = [
    "teachers_router",
    "majors_router",
    "classes_router",
    "students_router",
    "classrooms_router",
    "courses_router",
    "time_slots_router",
    "exams_router",
    "scheduler_router",
    "adjustments_router",
    "audit_logs_router",
    "import_export_router",
    "chat_router",
    "kpi_router",
]
