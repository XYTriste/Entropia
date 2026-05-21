"""
班级查询工具测试

测试 query_class_exams 的各种场景。
"""

import pytest
import pytest_asyncio

from app.models.class_ import Class
from app.models.classroom import Classroom
from app.models.course import Course, CourseType
from app.models.course_class import CourseClass
from app.models.exam import Exam, ExamStatus, ExamLabel
from app.models.exam_classroom import ExamClassroom
from app.models.exam_classroom_class import ExamClassroomClass
from app.models.exam_teacher import ExamTeacher, ExamTeacherRole
from app.models.major import Major
from app.models.patrol_teacher import PatrolTeacher
from app.models.teacher import Teacher, TeacherType
from app.models.time_slot import TimeSlot
from app.tools.class_tools import query_class_exams


@pytest_asyncio.fixture(scope="function")
async def class_exam_setup(db_session):
    """为班级查询测试创建完整数据"""
    # 1. 专业
    major = Major(name="软件工程")
    db_session.add(major)
    await db_session.flush()

    # 2. 班级
    cls1 = Class(name="软件工程2301", major_id=major.id, grade=2023, student_count=35)
    cls2 = Class(name="软件工程2302", major_id=major.id, grade=2023, student_count=38)
    cls3 = Class(name="计算机2301", major_id=major.id, grade=2023, student_count=40)
    db_session.add_all([cls1, cls2, cls3])
    await db_session.flush()

    # 3. 时段 (周一T1, 周一T2, 周二T1)
    ts_mon_t1 = TimeSlot(day_of_week=1, slot_code="T1", start_time="08:30", end_time="10:10", is_continuous=True)
    ts_mon_t2 = TimeSlot(day_of_week=1, slot_code="T2", start_time="10:20", end_time="12:00", is_continuous=False)
    ts_tue_t1 = TimeSlot(day_of_week=2, slot_code="T1", start_time="08:30", end_time="10:10", is_continuous=True)
    db_session.add_all([ts_mon_t1, ts_mon_t2, ts_tue_t1])
    await db_session.flush()

    # 4. 教室
    room1 = Classroom(name="5-201", capacity=60, room_type="regular", building="5号楼", floor=2, is_active=True)
    room2 = Classroom(name="5-202", capacity=60, room_type="regular", building="5号楼", floor=2, is_active=True)
    db_session.add_all([room1, room2])
    await db_session.flush()

    # 5. 教师
    teacher1 = Teacher(name="张老师", teacher_type=TeacherType.FULL_TIME, max_slots=5, current_slots=1, is_active=True)
    teacher2 = Teacher(name="李老师", teacher_type=TeacherType.FULL_TIME, max_slots=5, current_slots=1, is_active=True)
    teacher3 = Teacher(name="王老师", teacher_type=TeacherType.FULL_TIME, max_slots=5, current_slots=1, is_active=True)
    db_session.add_all([teacher1, teacher2, teacher3])
    await db_session.flush()

    # 6. 课程
    course1 = Course(name="数据结构", course_type=CourseType.MAJOR, needs_ab=False, is_active=True)
    course2 = Course(name="操作系统", course_type=CourseType.MAJOR, needs_ab=True, is_active=True)
    course3 = Course(name="计算机网络", course_type=CourseType.MAJOR, needs_ab=False, is_active=True)
    db_session.add_all([course1, course2, course3])
    await db_session.flush()

    # 7. 课程-班级关联
    # cls1 选修 course1, course2
    # cls2 选修 course1
    # cls3 选修 course3
    cc1 = CourseClass(course_id=course1.id, class_id=cls1.id, grade=2023)
    cc2 = CourseClass(course_id=course2.id, class_id=cls1.id, grade=2023)
    cc3 = CourseClass(course_id=course1.id, class_id=cls2.id, grade=2023)
    cc4 = CourseClass(course_id=course3.id, class_id=cls3.id, grade=2023)
    db_session.add_all([cc1, cc2, cc3, cc4])
    await db_session.flush()

    # 8. 考试 (已排考)
    # course1: 周一T1
    exam1 = Exam(course_id=course1.id, time_slot_id=ts_mon_t1.id, status=ExamStatus.SCHEDULED)
    # course2: A卷周一T2, B卷周二T1
    exam2a = Exam(course_id=course2.id, time_slot_id=ts_mon_t2.id, exam_label=ExamLabel.A, status=ExamStatus.SCHEDULED)
    exam2b = Exam(course_id=course2.id, time_slot_id=ts_tue_t1.id, exam_label=ExamLabel.B, status=ExamStatus.SCHEDULED)
    # course3: 待排考 (不创建)
    db_session.add_all([exam1, exam2a, exam2b])
    await db_session.flush()

    # 9. 考试-教室关联
    ec1 = ExamClassroom(exam_id=exam1.id, classroom_id=room1.id, total_students=35)
    ec2a = ExamClassroom(exam_id=exam2a.id, classroom_id=room2.id, total_students=35)
    ec2b = ExamClassroom(exam_id=exam2b.id, classroom_id=room2.id, total_students=35)
    db_session.add_all([ec1, ec2a, ec2b])
    await db_session.flush()

    # 10. 考试-教室-班级关联
    # cls1 参加: exam1(数据结构), exam2a(操作系统A卷)
    # cls2 参加: exam1(数据结构)
    # cls1 不参加 exam2b(操作系统B卷) —— 模拟AB卷业务规则：一个班级只参加一种卷别
    ecc1 = ExamClassroomClass(exam_classroom_id=ec1.id, class_id=cls1.id, student_count=20)
    ecc1b = ExamClassroomClass(exam_classroom_id=ec1.id, class_id=cls2.id, student_count=15)
    ecc2a = ExamClassroomClass(exam_classroom_id=ec2a.id, class_id=cls1.id, student_count=35)
    db_session.add_all([ecc1, ecc1b, ecc2a])
    await db_session.flush()

    # 11. 考试-教师关联 (固定监考)
    et1 = ExamTeacher(exam_id=exam1.id, teacher_id=teacher1.id, role=ExamTeacherRole.FIXED, classroom_id=room1.id)
    et2a = ExamTeacher(exam_id=exam2a.id, teacher_id=teacher2.id, role=ExamTeacherRole.FIXED, classroom_id=room2.id)
    et2b = ExamTeacher(exam_id=exam2b.id, teacher_id=teacher3.id, role=ExamTeacherRole.FIXED, classroom_id=room2.id)
    db_session.add_all([et1, et2a, et2b])
    await db_session.flush()

    # 12. 流动监考
    pt1 = PatrolTeacher(time_slot_id=ts_mon_t1.id, teacher_id=teacher2.id)
    pt2 = PatrolTeacher(time_slot_id=ts_mon_t2.id, teacher_id=teacher3.id)
    db_session.add_all([pt1, pt2])
    await db_session.flush()

    return {
        "major": major,
        "classes": [cls1, cls2, cls3],
        "time_slots": [ts_mon_t1, ts_mon_t2, ts_tue_t1],
        "classrooms": [room1, room2],
        "teachers": [teacher1, teacher2, teacher3],
        "courses": [course1, course2, course3],
        "exams": [exam1, exam2a, exam2b],
    }


@pytest.mark.asyncio
async def test_query_class_exams_exact_match(class_exam_setup):
    """精确匹配班级名称,返回正确的考试安排"""
    result = await query_class_exams("软件工程2301")

    assert result["found"] is True
    assert result["matched_count"] == 1
    # cls1 实际参加 2 场: 数据结构 + 操作系统A卷 (不参加B卷)
    assert result["total_exams"] == 2

    cls_data = result["classes"][0]
    assert cls_data["name"] == "软件工程2301"
    assert cls_data["grade"] == 2023
    assert cls_data["major"] == "软件工程"
    assert cls_data["total_exams"] == 2

    # 验证考试内容
    exams = cls_data["exams"]
    assert len(exams) == 2

    # 按时间排序: 周一T1(数据结构), 周一T2(操作系统A)
    assert exams[0]["course_name"] == "数据结构"
    assert exams[0]["day_of_week"] == 1
    assert exams[0]["slot_code"] == "T1"
    assert exams[0]["classrooms"] == ["5-201"]
    assert exams[0]["student_count"] == 20  # 该班级在此教室的人数
    assert "张老师" in exams[0]["fixed_teachers"]
    assert "李老师" in exams[0]["patrol_teachers"]

    assert exams[1]["course_name"] == "操作系统"
    assert exams[1]["exam_label"] == "A"
    assert exams[1]["day_of_week"] == 1
    assert exams[1]["slot_code"] == "T2"

    # 关键验证: 不应返回操作系统B卷
    exam_labels = [e["exam_label"] for e in exams if e["course_name"] == "操作系统"]
    assert "B" not in exam_labels


@pytest.mark.asyncio
async def test_query_class_exams_fuzzy_match(class_exam_setup):
    """模糊匹配班级名称,返回多个班级的考试安排"""
    result = await query_class_exams("软件工程")

    assert result["found"] is True
    assert result["matched_count"] == 2  # 软件工程2301 和 软件工程2302

    names = [c["name"] for c in result["classes"]]
    assert "软件工程2301" in names
    assert "软件工程2302" in names

    # 软件工程2301 实际参加 2 场考试 (数据结构 + 操作系统A卷, 不参加B卷)
    cls1 = next(c for c in result["classes"] if c["name"] == "软件工程2301")
    assert cls1["total_exams"] == 2

    # 软件工程2302 只有 1 场考试 (course1)
    cls2 = next(c for c in result["classes"] if c["name"] == "软件工程2302")
    assert cls2["total_exams"] == 1
    assert cls2["exams"][0]["course_name"] == "数据结构"


@pytest.mark.asyncio
async def test_query_class_exams_not_found():
    """班级不存在,返回 found: false"""
    result = await query_class_exams("不存在的班级999")

    assert result["found"] is False
    assert "未找到" in result["message"]
    assert result["total_exams"] == 0


@pytest.mark.asyncio
async def test_query_class_exams_filter_by_day(class_exam_setup):
    """按 day_of_week 过滤,只返回指定日期的考试"""
    result = await query_class_exams("软件工程2301", day_of_week=1)

    assert result["found"] is True
    assert result["total_exams"] == 2  # 只有周一的 2 场

    exams = result["classes"][0]["exams"]
    assert len(exams) == 2
    assert exams[0]["day_of_week"] == 1
    assert exams[1]["day_of_week"] == 1

    # 关键验证: 周一的2场中不应包含操作系统B卷
    labels = [e["exam_label"] for e in exams if e["course_name"] == "操作系统"]
    assert labels == ["A"]


@pytest.mark.asyncio
async def test_query_class_exams_no_scheduled_exams(class_exam_setup):
    """班级无已排考考试,返回空列表但 found: true"""
    # 计算机2301 选修了 course3, 但 course3 没有创建考试
    result = await query_class_exams("计算机2301")

    assert result["found"] is True
    assert result["matched_count"] == 1
    assert result["total_exams"] == 0

    cls_data = result["classes"][0]
    assert cls_data["name"] == "计算机2301"
    assert cls_data["total_exams"] == 0
    assert cls_data["exams"] == []
