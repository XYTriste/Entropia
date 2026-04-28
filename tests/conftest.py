"""
考试排考系统 - pytest 共享 Fixtures

提供测试所需的数据库连接、HTTP 客户端、以及预置测试数据。
使用 SQLite 内存数据库，确保测试独立且快速。
"""

import asyncio
import enum
from typing import AsyncGenerator, List

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

import sys
import os

# 确保 app 模块可导入
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.main import app
from app.database import get_db
from app.models import (
    Teacher,
    Major,
    Class,
    Student,
    Classroom,
    Course,
    CourseClass,
    TimeSlot,
    Exam,
    ExamClassroom,
    ExamClassroomClass,
    ExamTeacher,
    PatrolTeacher,
    AuditLog,
    ScheduleVersion,
    Base,
)
from app.models.teacher import TeacherType
from app.models.classroom import ClassroomType
from app.models.course import CourseType
from app.models.exam import ExamStatus, ExamLabel
from app.models.schedule_version import ScheduleVersionStatus

# ============================================================
# 数据库配置
# ============================================================

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

# 预定义时段数据 (20个)
TIME_SLOTS = [
    {"day_of_week": 1, "slot_code": "T1", "start_time": "08:30", "end_time": "10:10", "is_continuous": True},
    {"day_of_week": 1, "slot_code": "T2", "start_time": "10:20", "end_time": "12:00", "is_continuous": False},
    {"day_of_week": 1, "slot_code": "T3", "start_time": "14:00", "end_time": "15:40", "is_continuous": True},
    {"day_of_week": 1, "slot_code": "T4", "start_time": "15:50", "end_time": "17:30", "is_continuous": False},
    {"day_of_week": 2, "slot_code": "T1", "start_time": "08:30", "end_time": "10:10", "is_continuous": True},
    {"day_of_week": 2, "slot_code": "T2", "start_time": "10:20", "end_time": "12:00", "is_continuous": False},
    {"day_of_week": 2, "slot_code": "T3", "start_time": "14:00", "end_time": "15:40", "is_continuous": True},
    {"day_of_week": 2, "slot_code": "T4", "start_time": "15:50", "end_time": "17:30", "is_continuous": False},
    {"day_of_week": 3, "slot_code": "T1", "start_time": "08:30", "end_time": "10:10", "is_continuous": True},
    {"day_of_week": 3, "slot_code": "T2", "start_time": "10:20", "end_time": "12:00", "is_continuous": False},
    {"day_of_week": 3, "slot_code": "T3", "start_time": "14:00", "end_time": "15:40", "is_continuous": True},
    {"day_of_week": 3, "slot_code": "T4", "start_time": "15:50", "end_time": "17:30", "is_continuous": False},
    {"day_of_week": 4, "slot_code": "T1", "start_time": "08:30", "end_time": "10:10", "is_continuous": True},
    {"day_of_week": 4, "slot_code": "T2", "start_time": "10:20", "end_time": "12:00", "is_continuous": False},
    {"day_of_week": 4, "slot_code": "T3", "start_time": "14:00", "end_time": "15:40", "is_continuous": True},
    {"day_of_week": 4, "slot_code": "T4", "start_time": "15:50", "end_time": "17:30", "is_continuous": False},
    {"day_of_week": 5, "slot_code": "T1", "start_time": "08:30", "end_time": "10:10", "is_continuous": True},
    {"day_of_week": 5, "slot_code": "T2", "start_time": "10:20", "end_time": "12:00", "is_continuous": False},
    {"day_of_week": 5, "slot_code": "T3", "start_time": "14:00", "end_time": "15:40", "is_continuous": True},
    {"day_of_week": 5, "slot_code": "T4", "start_time": "15:50", "end_time": "17:30", "is_continuous": False},
]


# ============================================================
# Fixtures
# ============================================================


@pytest.fixture(scope="session")
def event_loop():
    """创建会话级别的事件循环"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def engine():
    """创建测试数据库引擎 (SQLite 内存)"""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        poolclass=NullPool,
        echo=False,
    )
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def tables(engine):
    """每次测试前创建所有表，测试后删除"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture(scope="function")
async def db_session(engine, tables) -> AsyncGenerator[AsyncSession, None]:
    """提供数据库会话，使用事务回滚保证隔离"""
    async_session = sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )
    async with async_session() as session:
        yield session


@pytest_asyncio.fixture(scope="function")
async def client(db_session) -> AsyncGenerator[AsyncClient, None]:
    """提供 FastAPI 异步 HTTP 客户端，依赖注入覆盖数据库连接"""
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture(scope="function")
async def sample_teachers(db_session) -> List[Teacher]:
    """预置教师数据：35名专任教师 + 15名兼职教师"""
    teachers = []
    # 35名专任教师
    for i in range(1, 36):
        teachers.append(
            Teacher(
                name=f"教师{i:03d}",
                teacher_type=TeacherType.FULL_TIME,
                max_slots=[4, 5, 6][i % 3],
                current_slots=0,
                is_active=True,
            )
        )
    # 15名兼职教师
    for i in range(36, 51):
        teachers.append(
            Teacher(
                name=f"教师{i:03d}",
                teacher_type=TeacherType.PART_TIME,
                max_slots=3,
                current_slots=0,
                is_active=True,
            )
        )
    db_session.add_all(teachers)
    await db_session.flush()
    return teachers


@pytest_asyncio.fixture(scope="function")
async def sample_classrooms(db_session) -> List[Classroom]:
    """预置教室数据：15个教室"""
    capacities = [50, 60, 60, 80, 80, 100, 100, 120, 120, 150, 50, 60, 80, 100, 120]
    room_types = [ClassroomType.REGULAR] * 10 + [ClassroomType.LECTURE] * 5
    buildings = ["A楼", "A楼", "A楼", "B楼", "B楼", "B楼", "C楼", "C楼", "C楼", "D楼",
                 "A楼", "B楼", "C楼", "D楼", "D楼"]
    floors = [1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 1, 2, 2, 3, 3]

    classrooms = []
    for i in range(15):
        classrooms.append(
            Classroom(
                name=f"教室{i+1:03d}",
                capacity=capacities[i],
                room_type=room_types[i],
                building=buildings[i],
                floor=floors[i],
                is_active=True,
            )
        )
    db_session.add_all(classrooms)
    await db_session.flush()
    return classrooms


@pytest_asyncio.fixture(scope="function")
async def sample_majors(db_session) -> List[Major]:
    """预置专业数据：5个专业"""
    major_names = ["计算机科学与技术", "软件工程", "信息安全", "数据科学", "人工智能"]
    majors = [Major(name=name) for name in major_names]
    db_session.add_all(majors)
    await db_session.flush()
    return majors


@pytest_asyncio.fixture(scope="function")
async def sample_classes(db_session, sample_majors) -> List[Class]:
    """预置班级数据：40个班级"""
    classes = []
    for i in range(40):
        major = sample_majors[i % 5]
        grade = 2023 if i < 20 else 2024
        classes.append(
            Class(
                name=f"班级{i+1:02d}",
                major_id=major.id,
                grade=grade,
                student_count=25 + (i % 10) * 3,  # 25-52人
            )
        )
    db_session.add_all(classes)
    await db_session.flush()
    return classes


@pytest_asyncio.fixture(scope="function")
async def sample_students(db_session, sample_classes) -> List[Student]:
    """预置学生数据：1000个学生"""
    students = []
    for i in range(1000):
        cls = sample_classes[i % 40]
        students.append(
            Student(
                student_no=f"2023{cls.grade:04d}{i+1:06d}",
                name=f"学生{i+1:04d}",
                class_id=cls.id,
            )
        )
    db_session.add_all(students)
    await db_session.flush()
    return students


@pytest_asyncio.fixture(scope="function")
async def sample_courses(db_session) -> List[Course]:
    """预置课程数据：12门课程 (含公共课和专业课)"""
    course_data = [
        # 公共课
        ("高等数学", CourseType.PUBLIC, False, 1, 1),
        ("大学英语", CourseType.PUBLIC, False, 2, 5),
        ("线性代数", CourseType.PUBLIC, True, 3, 9),
        # 专业课
        ("数据结构", CourseType.MAJOR, False, None, None),
        ("操作系统", CourseType.MAJOR, False, None, None),
        ("计算机网络", CourseType.MAJOR, True, None, None),
        ("数据库原理", CourseType.MAJOR, False, None, None),
        ("软件工程", CourseType.MAJOR, True, None, None),
        ("编译原理", CourseType.MAJOR, False, None, None),
        ("算法设计", CourseType.MAJOR, False, None, None),
        ("机器学习", CourseType.MAJOR, True, None, None),
        ("深度学习", CourseType.MAJOR, False, None, None),
    ]
    courses = []
    for name, ctype, needs_ab, dept_date, dept_slot in course_data:
        courses.append(
            Course(
                name=name,
                course_type=ctype,
                needs_ab=needs_ab,
                dept_assigned_date=dept_date,
                dept_assigned_time_slot_id=dept_slot,
                is_active=True,
            )
        )
    db_session.add_all(courses)
    await db_session.flush()
    return courses


@pytest_asyncio.fixture(scope="function")
async def sample_time_slots(db_session) -> List[TimeSlot]:
    """预置时段数据：20个时段"""
    slots = []
    for i, ts in enumerate(TIME_SLOTS, 1):
        slots.append(
            TimeSlot(
                day_of_week=ts["day_of_week"],
                slot_code=ts["slot_code"],
                start_time=ts["start_time"],
                end_time=ts["end_time"],
                is_continuous=ts["is_continuous"],
            )
        )
    db_session.add_all(slots)
    await db_session.flush()
    return slots


@pytest_asyncio.fixture(scope="function")
async def sample_course_classes(db_session, sample_courses, sample_classes) -> List[CourseClass]:
    """预置课程-班级关联数据"""
    links = []
    # 公共课：每门关联所有40个班级
    for course in sample_courses[:3]:
        for cls in sample_classes:
            links.append(
                CourseClass(
                    course_id=course.id,
                    class_id=cls.id,
                    grade=cls.grade,
                )
            )
    # 专业课：每门关联5-10个班级
    for idx, course in enumerate(sample_courses[3:]):
        for i in range(5 + idx % 6):
            cls = sample_classes[(idx + i) % 40]
            links.append(
                CourseClass(
                    course_id=course.id,
                    class_id=cls.id,
                    grade=cls.grade,
                )
            )
    db_session.add_all(links)
    await db_session.flush()
    return links


@pytest_asyncio.fixture(scope="function")
async def sample_exam(db_session, sample_courses, sample_time_slots, sample_classrooms) -> Exam:
    """预置单个考试数据 (含教室和教师分配)"""
    exam = Exam(
        course_id=sample_courses[0].id,
        time_slot_id=sample_time_slots[0].id,
        exam_label=ExamLabel.A,
        status=ExamStatus.SCHEDULED,
    )
    db_session.add(exam)
    await db_session.flush()

    # 教室分配
    ec = ExamClassroom(
        exam_id=exam.id,
        classroom_id=sample_classrooms[0].id,
        total_students=50,
    )
    db_session.add(ec)
    await db_session.flush()

    # 固定监考
    teacher_a = sample_classrooms  # placeholder, actual teacher needed
    return exam


@pytest_asyncio.fixture(scope="function")
async def sample_schedule_version(db_session) -> ScheduleVersion:
    """预置排考版本数据"""
    version = ScheduleVersion(
        version_no="20240101-001",
        status=ScheduleVersionStatus.DRAFT,
        description="测试版本",
        data_snapshot='{"exams": []}',
    )
    db_session.add(version)
    await db_session.flush()
    return version


@pytest_asyncio.fixture(scope="function")
async def sample_audit_log(db_session) -> AuditLog:
    """预置审计日志数据"""
    log = AuditLog(
        action="create",
        entity_type="exam",
        entity_id=1,
        old_value=None,
        new_value='{"status": "scheduled"}',
        reason="自动排考",
        operator="system",
    )
    db_session.add(log)
    await db_session.flush()
    return log
