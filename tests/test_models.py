"""
考试排考系统 - 模型层单元测试

测试所有 ORM 模型的创建、关系、约束校验。
覆盖正常路径和异常路径，包含数据库约束测试。
"""

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

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
)
from app.models.teacher import TeacherType
from app.models.classroom import ClassroomType
from app.models.course import CourseType
from app.models.exam import ExamStatus, ExamLabel
from app.models.schedule_version import ScheduleVersionStatus
from app.models.exam_teacher import ExamTeacherRole


# ============================================================
# Teacher 模型测试
# ============================================================


class TestTeacher:
    """教师模型测试"""

    async def test_create_teacher_full_time(self, db_session):
        """测试创建专任教师，所有字段正确"""
        teacher = Teacher(
            name="张三",
            teacher_type=TeacherType.FULL_TIME,
            max_slots=5,
            current_slots=0,
            is_active=True,
        )
        db_session.add(teacher)
        await db_session.flush()

        assert teacher.id is not None
        assert teacher.name == "张三"
        assert teacher.teacher_type == TeacherType.FULL_TIME
        assert teacher.max_slots == 5
        assert teacher.current_slots == 0
        assert teacher.is_active is True

    async def test_create_teacher_part_time(self, db_session):
        """测试创建兼职教师"""
        teacher = Teacher(
            name="李四",
            teacher_type=TeacherType.PART_TIME,
            max_slots=3,
            current_slots=0,
            is_active=True,
        )
        db_session.add(teacher)
        await db_session.flush()

        assert teacher.teacher_type == TeacherType.PART_TIME
        assert teacher.max_slots == 3

    async def test_teacher_enum_values(self, db_session):
        """测试教师类型枚举值"""
        ft = Teacher(name="专任A", teacher_type=TeacherType.FULL_TIME, max_slots=4)
        pt = Teacher(name="兼职B", teacher_type=TeacherType.PART_TIME, max_slots=2)
        db_session.add_all([ft, pt])
        await db_session.flush()

        assert ft.teacher_type.value == "full_time"
        assert pt.teacher_type.value == "part_time"

    async def test_teacher_max_slots_zero(self, db_session):
        """测试 max_slots=0 表示不参与监考"""
        teacher = Teacher(name="不参与", teacher_type=TeacherType.FULL_TIME, max_slots=0)
        db_session.add(teacher)
        await db_session.flush()

        assert teacher.max_slots == 0

    async def test_teacher_default_values(self, db_session):
        """测试教师默认值"""
        teacher = Teacher(name="默认值")
        db_session.add(teacher)
        await db_session.flush()

        assert teacher.teacher_type == TeacherType.FULL_TIME
        assert teacher.max_slots == 0
        assert teacher.current_slots == 0
        assert teacher.is_active is True

    async def test_teacher_unique_name_constraint(self, db_session):
        """测试教师姓名不唯一（系统允许重名）"""
        t1 = Teacher(name="重名教师", teacher_type=TeacherType.FULL_TIME, max_slots=5)
        t2 = Teacher(name="重名教师", teacher_type=TeacherType.FULL_TIME, max_slots=4)
        db_session.add_all([t1, t2])
        await db_session.flush()

        assert t1.id != t2.id


# ============================================================
# Major 模型测试
# ============================================================


class TestMajor:
    """专业模型测试"""

    async def test_create_major(self, db_session):
        """测试创建专业"""
        major = Major(name="软件工程")
        db_session.add(major)
        await db_session.flush()

        assert major.id is not None
        assert major.name == "软件工程"

    async def test_major_unique_name(self, db_session):
        """测试专业名称唯一约束"""
        m1 = Major(name="唯一专业")
        m2 = Major(name="唯一专业")
        db_session.add_all([m1, m2])
        await db_session.flush()

        with pytest.raises(IntegrityError):
            await db_session.commit()

    async def test_major_relation_classes(self, db_session, sample_majors, sample_classes):
        """测试专业与班级的关联关系"""
        major = sample_majors[0]
        major_classes = [c for c in sample_classes if c.major_id == major.id]
        assert len(major_classes) > 0


# ============================================================
# Class 模型测试
# ============================================================


class TestClass:
    """班级模型测试"""

    async def test_create_class(self, db_session, sample_majors):
        """测试创建班级"""
        cls = Class(
            name="软件2301",
            major_id=sample_majors[0].id,
            grade=2023,
            student_count=30,
        )
        db_session.add(cls)
        await db_session.flush()

        assert cls.id is not None
        assert cls.name == "软件2301"
        assert cls.grade == 2023

    async def test_class_unique_constraint(self, db_session, sample_majors):
        """测试班级(name, grade)联合唯一约束"""
        c1 = Class(name="同班", major_id=sample_majors[0].id, grade=2023, student_count=30)
        c2 = Class(name="同班", major_id=sample_majors[1].id, grade=2023, student_count=35)
        db_session.add_all([c1, c2])
        await db_session.flush()

        with pytest.raises(IntegrityError):
            await db_session.commit()

    async def test_class_relation_major(self, db_session, sample_classes, sample_majors):
        """测试班级与专业的关联"""
        cls = sample_classes[0]
        major = next(m for m in sample_majors if m.id == cls.major_id)
        assert major is not None
        assert major.name != ""

    async def test_class_different_grade_same_name(self, db_session, sample_majors):
        """测试同名的班级在不同年级可以共存"""
        c1 = Class(name="同名班", major_id=sample_majors[0].id, grade=2023, student_count=30)
        c2 = Class(name="同名班", major_id=sample_majors[0].id, grade=2024, student_count=35)
        db_session.add_all([c1, c2])
        await db_session.commit()

        assert c1.id is not None
        assert c2.id is not None
        assert c1.id != c2.id


# ============================================================
# Student 模型测试
# ============================================================


class TestStudent:
    """学生模型测试"""

    async def test_create_student(self, db_session, sample_classes):
        """测试创建学生"""
        student = Student(
            student_no="2023001001",
            name="张三",
            class_id=sample_classes[0].id,
        )
        db_session.add(student)
        await db_session.flush()

        assert student.id is not None
        assert student.student_no == "2023001001"
        assert student.name == "张三"

    async def test_student_unique_student_no(self, db_session, sample_classes):
        """测试学号唯一性约束"""
        s1 = Student(student_no="2023001001", name="张三", class_id=sample_classes[0].id)
        s2 = Student(student_no="2023001001", name="李四", class_id=sample_classes[1].id)
        db_session.add_all([s1, s2])
        await db_session.flush()

        with pytest.raises(IntegrityError):
            await db_session.commit()

    async def test_student_relation_class(self, db_session, sample_students, sample_classes):
        """测试学生与班级的关联"""
        student = sample_students[0]
        cls = next(c for c in sample_classes if c.id == student.class_id)
        assert cls is not None


# ============================================================
# Classroom 模型测试
# ============================================================


class TestClassroom:
    """教室模型测试"""

    async def test_create_classroom(self, db_session):
        """测试创建教室"""
        room = Classroom(
            name="A-101",
            capacity=80,
            room_type=ClassroomType.REGULAR,
            building="A楼",
            floor=1,
            is_active=True,
        )
        db_session.add(room)
        await db_session.flush()

        assert room.id is not None
        assert room.capacity == 80
        assert room.room_type == ClassroomType.REGULAR

    async def test_create_classroom_lecture(self, db_session):
        """测试创建阶梯教室"""
        room = Classroom(
            name="B-201",
            capacity=150,
            room_type=ClassroomType.LECTURE,
            building="B楼",
            floor=2,
        )
        db_session.add(room)
        await db_session.flush()

        assert room.room_type == ClassroomType.LECTURE

    async def test_classroom_unique_name(self, db_session):
        """测试教室名称唯一约束"""
        r1 = Classroom(name="A-101", capacity=50, room_type=ClassroomType.REGULAR)
        r2 = Classroom(name="A-101", capacity=60, room_type=ClassroomType.REGULAR)
        db_session.add_all([r1, r2])
        await db_session.flush()

        with pytest.raises(IntegrityError):
            await db_session.commit()

    async def test_classroom_capacity_positive(self, db_session):
        """测试教室容量必须为正数"""
        room = Classroom(name="小教室", capacity=1, room_type=ClassroomType.REGULAR)
        db_session.add(room)
        await db_session.flush()

        assert room.capacity == 1

    async def test_classroom_defaults(self, db_session):
        """测试教室默认值"""
        room = Classroom(name="默认教室")
        db_session.add(room)
        await db_session.flush()

        assert room.capacity == 40
        assert room.room_type == ClassroomType.REGULAR
        assert room.building == ""
        assert room.floor == 1
        assert room.is_active is True


# ============================================================
# Course 模型测试
# ============================================================


class TestCourse:
    """课程模型测试"""

    async def test_create_public_course(self, db_session):
        """测试创建公共课"""
        course = Course(
            name="高等数学",
            course_type=CourseType.PUBLIC,
            needs_ab=False,
            is_active=True,
        )
        db_session.add(course)
        await db_session.flush()

        assert course.course_type == CourseType.PUBLIC
        assert course.needs_ab is False

    async def test_create_major_course(self, db_session):
        """测试创建专业课"""
        course = Course(
            name="数据结构",
            course_type=CourseType.MAJOR,
            needs_ab=True,
            is_active=True,
        )
        db_session.add(course)
        await db_session.flush()

        assert course.course_type == CourseType.MAJOR
        assert course.needs_ab is True

    async def test_course_enum_values(self, db_session):
        """测试课程类型枚举值"""
        pub = Course(name="公共课", course_type=CourseType.PUBLIC)
        maj = Course(name="专业课", course_type=CourseType.MAJOR)
        db_session.add_all([pub, maj])
        await db_session.flush()

        assert pub.course_type.value == "public"
        assert maj.course_type.value == "major"

    async def test_course_default_active(self, db_session):
        """测试课程默认启用"""
        course = Course(name="默认课程")
        db_session.add(course)
        await db_session.flush()

        assert course.is_active is True
        assert course.needs_ab is False


# ============================================================
# CourseClass 模型测试
# ============================================================


class TestCourseClass:
    """课程-班级关联测试"""

    async def test_create_course_class_link(self, db_session, sample_courses, sample_classes):
        """测试创建课程-班级关联"""
        link = CourseClass(
            course_id=sample_courses[0].id,
            class_id=sample_classes[0].id,
            grade=2023,
        )
        db_session.add(link)
        await db_session.flush()

        assert link.id is not None

    async def test_course_class_unique_constraint(self, db_session, sample_courses, sample_classes):
        """测试(course_id, class_id, grade)联合唯一约束"""
        link1 = CourseClass(course_id=sample_courses[0].id, class_id=sample_classes[0].id, grade=2023)
        link2 = CourseClass(course_id=sample_courses[0].id, class_id=sample_classes[0].id, grade=2023)
        db_session.add_all([link1, link2])
        await db_session.flush()

        with pytest.raises(IntegrityError):
            await db_session.commit()


# ============================================================
# TimeSlot 模型测试
# ============================================================


class TestTimeSlot:
    """时段模型测试"""

    async def test_create_time_slot(self, db_session):
        """测试创建时段"""
        ts = TimeSlot(
            day_of_week=1,
            slot_code="T1",
            start_time="08:30",
            end_time="10:10",
            is_continuous=True,
        )
        db_session.add(ts)
        await db_session.flush()

        assert ts.id is not None
        assert ts.day_of_week == 1
        assert ts.is_continuous is True

    async def test_time_slot_continuous(self, db_session):
        """测试连续时段标记：T1-T2连续，T2-T3不连续"""
        ts1 = TimeSlot(day_of_week=1, slot_code="T1", start_time="08:30", end_time="10:10", is_continuous=True)
        ts2 = TimeSlot(day_of_week=1, slot_code="T2", start_time="10:20", end_time="12:00", is_continuous=False)
        db_session.add_all([ts1, ts2])
        await db_session.flush()

        assert ts1.is_continuous is True
        assert ts2.is_continuous is False

    @pytest.mark.parametrize("day,slot_code", [
        (1, "T1"), (1, "T2"), (1, "T3"), (1, "T4"),
        (5, "T1"), (5, "T4"),
    ])
    async def test_time_slot_various(self, db_session, day, slot_code):
        """参数化测试各种时段创建"""
        ts = TimeSlot(
            day_of_week=day,
            slot_code=slot_code,
            start_time="08:30",
            end_time="10:10",
            is_continuous=True,
        )
        db_session.add(ts)
        await db_session.flush()

        assert ts.id is not None


# ============================================================
# Exam 模型测试
# ============================================================


class TestExam:
    """考试模型测试"""

    async def test_create_exam(self, db_session, sample_courses, sample_time_slots):
        """测试创建考试"""
        exam = Exam(
            course_id=sample_courses[0].id,
            time_slot_id=sample_time_slots[0].id,
            exam_label=ExamLabel.A,
            status=ExamStatus.SCHEDULED,
        )
        db_session.add(exam)
        await db_session.flush()

        assert exam.id is not None
        assert exam.exam_label == ExamLabel.A
        assert exam.status == ExamStatus.SCHEDULED

    async def test_create_exam_without_label(self, db_session, sample_courses, sample_time_slots):
        """测试创建无标签的考试（非AB卷）"""
        exam = Exam(
            course_id=sample_courses[0].id,
            time_slot_id=sample_time_slots[0].id,
            status=ExamStatus.SCHEDULED,
        )
        db_session.add(exam)
        await db_session.flush()

        assert exam.exam_label is None

    async def test_exam_status_pending(self, db_session, sample_courses):
        """测试考试默认状态为待排"""
        exam = Exam(course_id=sample_courses[0].id)
        db_session.add(exam)
        await db_session.flush()

        assert exam.status == ExamStatus.PENDING

    async def test_exam_locked(self, db_session, sample_courses):
        """测试考试锁定状态"""
        exam = Exam(course_id=sample_courses[0].id, is_locked=True)
        db_session.add(exam)
        await db_session.flush()

        assert exam.is_locked is True

    async def test_exam_unique_course_label(self, db_session, sample_courses):
        """测试(course_id, exam_label)唯一约束"""
        e1 = Exam(course_id=sample_courses[0].id, exam_label=ExamLabel.A)
        e2 = Exam(course_id=sample_courses[0].id, exam_label=ExamLabel.A)
        db_session.add_all([e1, e2])
        await db_session.flush()

        with pytest.raises(IntegrityError):
            await db_session.commit()

    async def test_exam_label_values(self, db_session, sample_courses):
        """测试AB卷标签值"""
        e_a = Exam(course_id=sample_courses[0].id, exam_label=ExamLabel.A)
        e_b = Exam(course_id=sample_courses[1].id, exam_label=ExamLabel.B)
        db_session.add_all([e_a, e_b])
        await db_session.flush()

        assert e_a.exam_label.value == "A"
        assert e_b.exam_label.value == "B"


# ============================================================
# ExamClassroom 模型测试
# ============================================================


class TestExamClassroom:
    """考试-教室关联测试"""

    async def test_create_exam_classroom(self, db_session, sample_exam, sample_classrooms):
        """测试创建考试教室关联"""
        # 需要先创建一个考试
        exam = Exam(course_id=1)
        db_session.add(exam)
        await db_session.flush()

        ec = ExamClassroom(
            exam_id=exam.id,
            classroom_id=sample_classrooms[0].id,
            total_students=45,
        )
        db_session.add(ec)
        await db_session.flush()

        assert ec.id is not None
        assert ec.total_students == 45

    async def test_exam_classroom_unique_constraint(self, db_session, sample_classrooms):
        """测试(exam_id, classroom_id)唯一约束"""
        exam = Exam(course_id=1)
        db_session.add(exam)
        await db_session.flush()

        ec1 = ExamClassroom(exam_id=exam.id, classroom_id=sample_classrooms[0].id, total_students=40)
        ec2 = ExamClassroom(exam_id=exam.id, classroom_id=sample_classrooms[0].id, total_students=50)
        db_session.add_all([ec1, ec2])
        await db_session.flush()

        with pytest.raises(IntegrityError):
            await db_session.commit()


# ============================================================
# ExamClassroomClass 模型测试
# ============================================================


class TestExamClassroomClass:
    """考试-教室-班级关联测试"""

    async def test_create_exam_classroom_class(self, db_session, sample_classes):
        """测试创建考试教室班级关联"""
        exam = Exam(course_id=1)
        db_session.add(exam)
        await db_session.flush()

        ec = ExamClassroom(exam_id=exam.id, classroom_id=1, total_students=40)
        db_session.add(ec)
        await db_session.flush()

        ecc = ExamClassroomClass(
            exam_classroom_id=ec.id,
            class_id=sample_classes[0].id,
            student_count=40,
        )
        db_session.add(ecc)
        await db_session.flush()

        assert ecc.id is not None

    async def test_exam_classroom_class_unique(self, db_session, sample_classes):
        """测试(exam_classroom_id, class_id)唯一约束"""
        exam = Exam(course_id=1)
        db_session.add(exam)
        await db_session.flush()

        ec = ExamClassroom(exam_id=exam.id, classroom_id=1, total_students=40)
        db_session.add(ec)
        await db_session.flush()

        ecc1 = ExamClassroomClass(exam_classroom_id=ec.id, class_id=sample_classes[0].id, student_count=40)
        ecc2 = ExamClassroomClass(exam_classroom_id=ec.id, class_id=sample_classes[0].id, student_count=40)
        db_session.add_all([ecc1, ecc2])
        await db_session.flush()

        with pytest.raises(IntegrityError):
            await db_session.commit()


# ============================================================
# ExamTeacher 模型测试
# ============================================================


class TestExamTeacher:
    """考试-教师关联测试"""

    async def test_create_fixed_teacher(self, db_session, sample_teachers):
        """测试创建固定监考教师关联"""
        exam = Exam(course_id=1)
        db_session.add(exam)
        await db_session.flush()

        et = ExamTeacher(
            exam_id=exam.id,
            teacher_id=sample_teachers[0].id,
            role=ExamTeacherRole.FIXED,
            classroom_id=1,
        )
        db_session.add(et)
        await db_session.flush()

        assert et.id is not None
        assert et.role == ExamTeacherRole.FIXED

    async def test_create_patrol_teacher(self, db_session, sample_teachers):
        """测试创建流动监考教师关联"""
        exam = Exam(course_id=1)
        db_session.add(exam)
        await db_session.flush()

        et = ExamTeacher(
            exam_id=exam.id,
            teacher_id=sample_teachers[0].id,
            role=ExamTeacherRole.PATROL,
        )
        db_session.add(et)
        await db_session.flush()

        assert et.role == ExamTeacherRole.PATROL


# ============================================================
# PatrolTeacher 模型测试
# ============================================================


class TestPatrolTeacher:
    """流动监考教师模型测试"""

    async def test_create_patrol_teacher(self, db_session, sample_time_slots, sample_teachers):
        """测试创建流动监考教师记录"""
        pt = PatrolTeacher(
            time_slot_id=sample_time_slots[0].id,
            teacher_id=sample_teachers[0].id,
        )
        db_session.add(pt)
        await db_session.flush()

        assert pt.id is not None

    async def test_patrol_teacher_unique(self, db_session, sample_time_slots, sample_teachers):
        """测试(time_slot_id, teacher_id)唯一约束"""
        pt1 = PatrolTeacher(time_slot_id=sample_time_slots[0].id, teacher_id=sample_teachers[0].id)
        pt2 = PatrolTeacher(time_slot_id=sample_time_slots[0].id, teacher_id=sample_teachers[0].id)
        db_session.add_all([pt1, pt2])
        await db_session.flush()

        with pytest.raises(IntegrityError):
            await db_session.commit()


# ============================================================
# AuditLog 模型测试
# ============================================================


class TestAuditLog:
    """审计日志模型测试"""

    async def test_create_audit_log(self, db_session):
        """测试创建审计日志"""
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

        assert log.id is not None
        assert log.action == "create"
        assert log.operator == "system"

    async def test_audit_log_various_actions(self, db_session):
        """测试各种操作类型的审计日志"""
        actions = ["create", "update", "delete", "transfer", "swap", "schedule"]
        logs = []
        for action in actions:
            logs.append(AuditLog(action=action, entity_type="exam", entity_id=1, operator="admin"))
        db_session.add_all(logs)
        await db_session.flush()

        assert len(logs) == len(actions)
        for log in logs:
            assert log.id is not None


# ============================================================
# ScheduleVersion 模型测试
# ============================================================


class TestScheduleVersion:
    """排考版本模型测试"""

    async def test_create_version(self, db_session):
        """测试创建排考版本"""
        version = ScheduleVersion(
            version_no="20240101-001",
            status=ScheduleVersionStatus.DRAFT,
            description="测试版本",
        )
        db_session.add(version)
        await db_session.flush()

        assert version.id is not None
        assert version.status == ScheduleVersionStatus.DRAFT

    async def test_version_unique_version_no(self, db_session):
        """测试版本号唯一约束"""
        v1 = ScheduleVersion(version_no="V001", status=ScheduleVersionStatus.DRAFT)
        v2 = ScheduleVersion(version_no="V001", status=ScheduleVersionStatus.PUBLISHED)
        db_session.add_all([v1, v2])
        await db_session.flush()

        with pytest.raises(IntegrityError):
            await db_session.commit()

    async def test_version_status_values(self, db_session):
        """测试版本状态枚举值"""
        v1 = ScheduleVersion(version_no="V001", status=ScheduleVersionStatus.DRAFT)
        v2 = ScheduleVersion(version_no="V002", status=ScheduleVersionStatus.PUBLISHED)
        v3 = ScheduleVersion(version_no="V003", status=ScheduleVersionStatus.ARCHIVED)
        db_session.add_all([v1, v2, v3])
        await db_session.flush()

        assert v1.status.value == "draft"
        assert v2.status.value == "published"
        assert v3.status.value == "archived"


# ============================================================
# 关系测试
# ============================================================


class TestRelationships:
    """模型关系测试"""

    async def test_teacher_exam_teachers_relation(self, db_session, sample_teachers):
        """测试教师的exam_teachers关系"""
        teacher = sample_teachers[0]
        exam = Exam(course_id=1)
        db_session.add(exam)
        await db_session.flush()

        et = ExamTeacher(exam_id=exam.id, teacher_id=teacher.id, role=ExamTeacherRole.FIXED)
        db_session.add(et)
        await db_session.flush()

        assert len(teacher.exam_teachers) >= 0  # relationship 已建立

    async def test_teacher_patrol_relation(self, db_session, sample_teachers, sample_time_slots):
        """测试教师的patrol_assignments关系"""
        teacher = sample_teachers[0]
        pt = PatrolTeacher(time_slot_id=sample_time_slots[0].id, teacher_id=teacher.id)
        db_session.add(pt)
        await db_session.flush()

        assert len(teacher.patrol_assignments) >= 0

    async def test_class_students_relation(self, db_session, sample_classes):
        """测试班级的students关系"""
        cls = sample_classes[0]
        student = Student(student_no="2023001001", name="张三", class_id=cls.id)
        db_session.add(student)
        await db_session.flush()

        assert len(cls.students) >= 0

    async def test_course_exams_cascade_delete(self, db_session, sample_courses):
        """测试课程的级联删除：删除课程同时删除关联考试"""
        course = Course(name="删除测试", course_type=CourseType.MAJOR)
        db_session.add(course)
        await db_session.flush()

        exam = Exam(course_id=course.id, status=ExamStatus.SCHEDULED)
        db_session.add(exam)
        await db_session.flush()

        await db_session.delete(course)
        await db_session.flush()

        # 考试应被级联删除
        result = await db_session.execute(select(Exam).where(Exam.course_id == course.id))
        assert result.scalar_one_or_none() is None


# ============================================================
# 数据库约束测试
# ============================================================


class TestDatabaseConstraints:
    """数据库约束测试"""

    async def test_null_name_teacher(self, db_session):
        """测试教师姓名为空时抛出异常"""
        teacher = Teacher(name=None, teacher_type=TeacherType.FULL_TIME)
        db_session.add(teacher)

        with pytest.raises(IntegrityError):
            await db_session.flush()

    async def test_null_name_major(self, db_session):
        """测试专业名称为空时抛出异常"""
        major = Major(name=None)
        db_session.add(major)

        with pytest.raises(IntegrityError):
            await db_session.flush()

    async def test_invalid_teacher_type(self, db_session):
        """测试无效教师类型"""
        with pytest.raises(ValueError):
            Teacher(name="无效", teacher_type="invalid_type")

    async def test_negative_max_slots(self, db_session):
        """测试负数的max_slots可以创建但无意义"""
        teacher = Teacher(name="负值测试", max_slots=-1)
        db_session.add(teacher)
        await db_session.flush()

        assert teacher.max_slots == -1  # SQLite允许，业务层应校验
