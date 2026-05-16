#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
考试排考系统 - 测试数据生成脚本

生成完整的测试数据集，包含：
  - 5个专业
  - 40个班级（每专业8个，大一/大二各4个）
  - 50名教师（35专任 + 15兼职）
  - 1000名学生
  - 15个教室（含3个阶梯教室）
  - 12门课程（5公共 + 7专业）
  - 课程-班级关联关系

使用方式：
  python scripts/generate_test_data.py

Docker环境中：
  docker-compose exec api python scripts/generate_test_data.py
"""

import os
import sys
import random

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session

try:
    from app.models.base import Base
    from app.models.major import Major
    from app.models.class_ import Class
    from app.models.teacher import Teacher, TeacherType
    from app.models.student import Student
    from app.models.classroom import Classroom, ClassroomType
    from app.models.course import Course, CourseType
    from app.models.course_class import CourseClass
    MODELS_AVAILABLE = True
except ImportError as e:
    MODELS_AVAILABLE = False
    print(f"[WARN] 应用模型导入失败: {e}，将使用原始SQL方式插入数据")

random.seed(42)

MAJOR_NAMES = [
    "计算机科学与技术",
    "软件工程",
    "网络工程",
    "数据科学与大数据技术",
    "人工智能",
]

GRADE_YEARS = [1, 2]
CLASS_SEQ = [1, 2, 3, 4]

TEACHER_SURNAMES = [
    "赵", "钱", "孙", "李", "周", "吴", "郑", "王", "冯", "陈",
    "褚", "卫", "蒋", "沈", "韩", "杨", "朱", "秦", "尤", "许",
    "何", "吕", "施", "张", "孔", "曹", "严", "华", "金", "魏",
]
TEACHER_NAMES = [
    "伟", "芳", "娜", "敏", "静", "丽", "强", "磊", "军", "洋",
    "勇", "艳", "杰", "娟", "涛", "明", "超", "秀", "霞", "平",
    "刚", "桂英", "华", "秀兰", "建华", "玉梅",
]

CLASSROOM_BUILDINGS = ["A", "B", "C"]
CLASSROOM_FLOORS = [1, 2, 3, 4, 5]

COURSE_DATA = [
    # 公共课 (5门)
    {"name": "高等数学A", "course_type": "public", "needs_ab": True},
    {"name": "大学英语", "course_type": "public", "needs_ab": True},
    {"name": "线性代数", "course_type": "public", "needs_ab": True},
    {"name": "概率论与数理统计", "course_type": "public", "needs_ab": True},
    {"name": "大学物理", "course_type": "public", "needs_ab": True},
    # 专业课 (7门)
    {"name": "数据结构与算法", "course_type": "major", "needs_ab": True},
    {"name": "操作系统", "course_type": "major", "needs_ab": True},
    {"name": "计算机网络", "course_type": "major", "needs_ab": True},
    {"name": "数据库原理", "course_type": "major", "needs_ab": True},
    {"name": "软件工程", "course_type": "major", "needs_ab": False},
    {"name": "机器学习", "course_type": "major", "needs_ab": True},
    {"name": "Web开发技术", "course_type": "major", "needs_ab": False},
]


def get_database_url() -> str:
    url = os.environ.get("SCHEDULER_DATABASE_SYNC_URL")
    if url:
        return url
    async_url = os.environ.get("SCHEDULER_DATABASE_URL", "")
    if async_url:
        return async_url.replace("postgresql+asyncpg", "postgresql", 1)
    raise RuntimeError(
        "未找到数据库连接配置。请设置环境变量 SCHEDULER_DATABASE_SYNC_URL 或 SCHEDULER_DATABASE_URL。"
        "参考 .env.example 文件配置。"
    )


def generate_majors():
    return [{"name": name} for name in MAJOR_NAMES]


def generate_classes(majors):
    classes = []
    grade_names = {1: "大一", 2: "大二"}
    for major_idx, major in enumerate(majors):
        for grade in GRADE_YEARS:
            for seq in CLASS_SEQ:
                class_name = f"{major['name']}{grade_names[grade]}{seq}班"
                classes.append({
                    "name": class_name,
                    "major_index": major_idx,
                    "grade": grade,
                    "student_count": random.randint(23, 35),
                })
    return classes


def generate_teachers():
    teachers = []
    used_names = set()
    for i in range(50):
        while True:
            name = random.choice(TEACHER_SURNAMES) + random.choice(TEACHER_NAMES)
            if name not in used_names:
                used_names.add(name)
                break
        teacher_type = "full_time" if i < 35 else "part_time"
        max_slots = random.choice([4, 5, 6, 7, 8]) if teacher_type == "full_time" else random.choice([2, 3, 4, 5])
        teachers.append({
            "name": name,
            "teacher_type": teacher_type,
            "max_slots": max_slots,
            "current_slots": 0,
            "is_active": True,
        })
    return teachers


def generate_students(classes, total=1000):
    students = []
    student_id = 1
    for cls in classes:
        count = cls.get("student_count", 25)
        for _ in range(count):
            students.append({
                "name": f"学生{student_id}",
                "student_no": f"STU{student_id:06d}",
                "class_index": classes.index(cls),
            })
            student_id += 1
            if len(students) >= total:
                return students
    while len(students) < total:
        random_class = random.choice(classes)
        students.append({
            "name": f"学生{student_id}",
            "student_no": f"STU{student_id:06d}",
            "class_index": classes.index(random_class),
        })
        student_id += 1
    return students[:total]


def generate_classrooms():
    classrooms = []
    room_id = 1
    for building in CLASSROOM_BUILDINGS:
        for floor in CLASSROOM_FLOORS:
            if room_id > 12:
                break
            room_num = building + str(floor) + str(random.randint(1, 9))
            classrooms.append({
                "name": room_num,
                "capacity": random.choice([40, 45, 50, 55, 60]),
                "room_type": "regular",
                "building": f"{building}教学楼",
                "floor": floor,
                "is_active": True,
            })
            room_id += 1
    for i in range(1, 4):
        classrooms.append({
            "name": f"J{i}01",
            "capacity": random.choice([120, 150, 180]),
            "room_type": "lecture",
            "building": "阶梯教室楼",
            "floor": 1,
            "is_active": True,
        })
    return classrooms


def generate_courses():
    return [dict(c) for c in COURSE_DATA]


def generate_course_classes(courses, classes):
    course_classes = []
    classes_by_major = {}
    for idx, cls in enumerate(classes):
        mid = cls["major_index"]
        if mid not in classes_by_major:
            classes_by_major[mid] = []
        classes_by_major[mid].append(idx)

    for course_idx, course in enumerate(courses):
        if course["course_type"] == "public":
            for class_idx in range(len(classes)):
                course_classes.append({
                    "course_index": course_idx,
                    "class_index": class_idx,
                    "grade": classes[class_idx]["grade"],
                })
        else:
            major_ids = sorted(classes_by_major.keys())[:2]
            for mid in major_ids:
                for class_idx in classes_by_major.get(mid, []):
                    course_classes.append({
                        "course_index": course_idx,
                        "class_index": class_idx,
                        "grade": classes[class_idx]["grade"],
                    })
    return course_classes


def insert_data_orm(session: Session):
    stats = {}

    # 1. Majors
    majors_data = generate_majors()
    majors = [Major(name=m["name"]) for m in majors_data]
    session.add_all(majors)
    session.flush()
    stats["majors"] = len(majors)

    # 2. Classes
    classes_data = generate_classes(majors_data)
    classes = []
    for c in classes_data:
        cls = Class(
            name=c["name"],
            major_id=majors[c["major_index"]].id,
            grade=c["grade"],
            student_count=c["student_count"],
        )
        session.add(cls)
        classes.append(cls)
    session.flush()
    stats["classes"] = len(classes)

    # 3. Teachers
    teachers_data = generate_teachers()
    teachers = []
    for t in teachers_data:
        tt = TeacherType.FULL_TIME if t["teacher_type"] == "full_time" else TeacherType.PART_TIME
        teacher = Teacher(
            name=t["name"],
            teacher_type=tt,
            max_slots=t["max_slots"],
            current_slots=t["current_slots"],
            is_active=t["is_active"],
        )
        session.add(teacher)
        teachers.append(teacher)
    session.flush()
    stats["teachers"] = len(teachers)

    # 4. Students
    students_data = generate_students(classes_data)
    students = []
    for s in students_data:
        student = Student(
            name=s["name"],
            student_no=s["student_no"],
            class_id=classes[s["class_index"]].id,
        )
        session.add(student)
        students.append(student)
    session.flush()
    stats["students"] = len(students)

    # 5. Classrooms
    classrooms_data = generate_classrooms()
    classrooms = []
    for cr in classrooms_data:
        rt = ClassroomType.REGULAR if cr["room_type"] == "regular" else ClassroomType.LECTURE
        classroom = Classroom(
            name=cr["name"],
            capacity=cr["capacity"],
            room_type=rt,
            building=cr["building"],
            floor=cr["floor"],
            is_active=cr["is_active"],
        )
        session.add(classroom)
        classrooms.append(classroom)
    session.flush()
    stats["classrooms"] = len(classrooms)

    # 6. Courses
    courses_data = generate_courses()
    courses = []
    for c in courses_data:
        ct = CourseType.PUBLIC if c["course_type"] == "public" else CourseType.MAJOR
        course = Course(
            name=c["name"],
            course_type=ct,
            needs_ab=c["needs_ab"],
            is_active=True,
        )
        if ct == CourseType.PUBLIC:
            course.dept_assigned_date = random.randint(1, 5)
            course.dept_assigned_time_slot_id = random.randint(1, 20)
        session.add(course)
        courses.append(course)
    session.flush()
    stats["courses"] = len(courses)

    # 7. CourseClasses
    course_classes_data = generate_course_classes(courses_data, classes_data)
    for cc in course_classes_data:
        cc_obj = CourseClass(
            course_id=courses[cc["course_index"]].id,
            class_id=classes[cc["class_index"]].id,
            grade=cc["grade"],
        )
        session.add(cc_obj)
    session.flush()
    stats["course_classes"] = len(course_classes_data)

    session.commit()
    return stats


def insert_data_sql(session: Session):
    """原始SQL兜底方案（字段与ORM模型严格一致）"""
    stats = {}

    majors_data = generate_majors()
    for i, m in enumerate(majors_data, 1):
        session.execute(text(
            "INSERT INTO majors (id, name) VALUES (:id, :name) ON CONFLICT (id) DO NOTHING"
        ), {"id": i, "name": m["name"]})
    stats["majors"] = len(majors_data)

    classes_data = generate_classes(majors_data)
    for i, c in enumerate(classes_data, 1):
        session.execute(text(
            """
            INSERT INTO classes (id, name, major_id, grade, student_count)
            VALUES (:id, :name, :major_id, :grade, :student_count)
            ON CONFLICT (id) DO NOTHING
            """
        ), {"id": i, "name": c["name"], "major_id": c["major_index"] + 1,
            "grade": c["grade"], "student_count": c["student_count"]})
    stats["classes"] = len(classes_data)

    teachers_data = generate_teachers()
    for i, t in enumerate(teachers_data, 1):
        session.execute(text(
            """
            INSERT INTO teachers (id, name, teacher_type, max_slots, current_slots, is_active)
            VALUES (:id, :name, :teacher_type, :max_slots, :current_slots, :is_active)
            ON CONFLICT (id) DO NOTHING
            """
        ), {"id": i, **t})
    stats["teachers"] = len(teachers_data)

    students_data = generate_students(classes_data)
    for i, s in enumerate(students_data, 1):
        session.execute(text(
            """
            INSERT INTO students (id, name, student_no, class_id)
            VALUES (:id, :name, :student_no, :class_id)
            ON CONFLICT (id) DO NOTHING
            """
        ), {"id": i, "name": s["name"], "student_no": s["student_no"],
            "class_id": s["class_index"] + 1})
    stats["students"] = len(students_data)

    classrooms_data = generate_classrooms()
    for i, cr in enumerate(classrooms_data, 1):
        session.execute(text(
            """
            INSERT INTO classrooms (id, name, capacity, room_type, building, floor, is_active)
            VALUES (:id, :name, :capacity, :room_type, :building, :floor, :is_active)
            ON CONFLICT (id) DO NOTHING
            """
        ), {"id": i, **cr})
    stats["classrooms"] = len(classrooms_data)

    courses_data = generate_courses()
    for i, c in enumerate(courses_data, 1):
        dept_date = random.randint(1, 5) if c["course_type"] == "public" else None
        dept_slot = random.randint(1, 20) if c["course_type"] == "public" else None
        session.execute(text(
            """
            INSERT INTO courses (id, name, course_type, needs_ab, dept_assigned_date, dept_assigned_time_slot_id, is_active)
            VALUES (:id, :name, :course_type, :needs_ab, :dept_date, :dept_slot, :is_active)
            ON CONFLICT (id) DO NOTHING
            """
        ), {"id": i, "name": c["name"], "course_type": c["course_type"],
            "needs_ab": c["needs_ab"], "dept_date": dept_date,
            "dept_slot": dept_slot, "is_active": True})
    stats["courses"] = len(courses_data)

    course_classes_data = generate_course_classes(courses_data, classes_data)
    for i, cc in enumerate(course_classes_data, 1):
        session.execute(text(
            """
            INSERT INTO course_classes (id, course_id, class_id, grade)
            VALUES (:id, :course_id, :class_id, :grade)
            ON CONFLICT (id) DO NOTHING
            """
        ), {"id": i, "course_id": cc["course_index"] + 1,
            "class_id": cc["class_index"] + 1, "grade": cc["grade"]})
    stats["course_classes"] = len(course_classes_data)

    session.commit()
    return stats


def generate_test_data():
    print("=" * 60)
    print("考试排考系统 - 测试数据生成")
    print("=" * 60)

    db_url = get_database_url()
    print(f"[INFO] 数据库连接: {db_url.replace('://', '://***:***@')}")

    try:
        engine = create_engine(db_url, echo=False)

        with engine.connect() as conn:
            conn.execute(text("SELECT version()"))
            print("[OK] PostgreSQL连接成功")

        with engine.connect() as conn:
            result = conn.execute(text("SELECT COUNT(*) FROM time_slots"))
            slot_count = result.scalar()
            if slot_count == 0:
                print("[WARN] 时段数据为空，请先运行: python scripts/init_db.py")
                sys.exit(1)
            print(f"[OK] 已检测到 {slot_count} 个考试时段")

        SessionLocal = sessionmaker(bind=engine)

        print("[INFO] 正在生成测试数据...")
        with SessionLocal() as session:
            if MODELS_AVAILABLE:
                stats = insert_data_orm(session)
            else:
                stats = insert_data_sql(session)

        print("=" * 60)
        print("[OK] 测试数据生成完成!")
        print("=" * 60)
        print(f"  专业:        {stats['majors']} 个")
        print(f"  班级:        {stats['classes']} 个")
        print(f"  教师:        {stats['teachers']} 名")
        print(f"  学生:        {stats['students']} 名")
        print(f"  教室:        {stats['classrooms']} 个")
        print(f"  课程:        {stats['courses']} 门")
        print(f"  课程-班级:   {stats['course_classes']} 条关联")
        print("=" * 60)

    except Exception as e:
        print(f"[ERROR] 测试数据生成失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    generate_test_data()
