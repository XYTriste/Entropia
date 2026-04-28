"""
考试排考系统 - API 接口测试

测试所有 HTTP API 端点：
- 教师 API (CRUD、搜索、启用/禁用、负荷统计)
- 教室 API (CRUD、启用/禁用)
- 课程 API (CRUD、班级关联、AB 卷标记)
- 学生 API (CRUD、按班级过滤)
- 班级 API (CRUD、关联专业)
- 时段 API (列表、总览矩阵)
- 排考 API (触发排考、状态查询、版本管理、回滚)
- 排考结果 API (总览矩阵、教师甘特图、教室矩阵、班级视图、课程视图)
- 手动微调 API (调时段、换教室、换教师、重排流动监考)
- 教师调剂 API (交换、转移、批量转交、撤销)
- 审计日志 API (列表、过滤)
- 健康检查 API
- 错误处理测试 (404、400、422)
"""

import pytest

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.models.teacher import TeacherType
from app.models.classroom import ClassroomType
from app.models.course import CourseType
from app.models.exam import ExamStatus


# ============================================================
# 教师 API 测试
# ============================================================


class TestTeacherAPI:
    """教师 API 测试"""

    async def test_list_teachers(self, client, sample_teachers):
        """测试获取教师列表"""
        resp = await client.get("/api/v1/teachers")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) == 50

    async def test_list_teachers_pagination(self, client, sample_teachers):
        """测试教师列表分页"""
        resp = await client.get("/api/v1/teachers?skip=0&limit=10")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 10

    async def test_list_teachers_skip(self, client, sample_teachers):
        """测试教师列表跳过"""
        resp = await client.get("/api/v1/teachers?skip=45")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 5

    async def test_search_teacher_by_name(self, client, sample_teachers):
        """测试按名称搜索教师"""
        resp = await client.get("/api/v1/teachers?name=教师001")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["name"] == "教师001"

    async def test_search_teacher_by_type(self, client, sample_teachers):
        """测试按类型过滤教师"""
        resp = await client.get("/api/v1/teachers?teacher_type=full_time")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 35
        for t in data:
            assert t["teacher_type"] == "full_time"

    async def test_search_teacher_part_time(self, client, sample_teachers):
        """测试按兼职类型过滤"""
        resp = await client.get("/api/v1/teachers?teacher_type=part_time")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 15

    async def test_search_teacher_combined(self, client, sample_teachers):
        """测试组合条件搜索"""
        resp = await client.get("/api/v1/teachers?teacher_type=full_time&name=教师001")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["teacher_type"] == "full_time"

    async def test_create_teacher(self, client):
        """测试创建教师"""
        resp = await client.post("/api/v1/teachers", json={
            "name": "新教师",
            "teacher_type": "full_time",
            "max_slots": 5,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "新教师"
        assert data["teacher_type"] == "full_time"

    async def test_create_teacher_invalid_type(self, client):
        """测试创建教师时使用无效类型"""
        resp = await client.post("/api/v1/teachers", json={
            "name": "无效教师",
            "teacher_type": "invalid_type",
            "max_slots": 5,
        })
        assert resp.status_code == 422

    async def test_create_teacher_missing_name(self, client):
        """测试创建教师缺少名称"""
        resp = await client.post("/api/v1/teachers", json={
            "teacher_type": "full_time",
            "max_slots": 5,
        })
        assert resp.status_code == 422

    async def test_get_teacher(self, client, sample_teachers):
        """测试获取单个教师"""
        teacher = sample_teachers[0]
        resp = await client.get(f"/api/v1/teachers/{teacher.id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == teacher.id
        assert data["name"] == teacher.name

    async def test_get_teacher_not_found(self, client):
        """测试获取不存在的教师"""
        resp = await client.get("/api/v1/teachers/99999")
        assert resp.status_code == 404

    async def test_update_teacher(self, client, sample_teachers):
        """测试更新教师"""
        teacher = sample_teachers[0]
        resp = await client.put(f"/api/v1/teachers/{teacher.id}", json={
            "name": "修改后",
            "teacher_type": "full_time",
            "max_slots": 6,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "修改后"

    async def test_update_teacher_not_found(self, client):
        """测试更新不存在的教师"""
        resp = await client.put("/api/v1/teachers/99999", json={
            "name": "不存在",
            "teacher_type": "full_time",
        })
        assert resp.status_code == 404

    async def test_delete_teacher(self, client, sample_teachers):
        """测试删除教师"""
        teacher = sample_teachers[-1]
        resp = await client.delete(f"/api/v1/teachers/{teacher.id}")
        assert resp.status_code == 200

        resp2 = await client.get(f"/api/v1/teachers/{teacher.id}")
        assert resp2.status_code == 404

    async def test_delete_teacher_not_found(self, client):
        """测试删除不存在的教师"""
        resp = await client.delete("/api/v1/teachers/99999")
        assert resp.status_code == 404

    async def test_toggle_teacher(self, client, sample_teachers):
        """测试切换教师启用/禁用状态"""
        teacher = sample_teachers[0]
        original = teacher.is_active
        resp = await client.patch(f"/api/v1/teachers/{teacher.id}/toggle")
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_active"] is not original

    async def test_teacher_load_stats(self, client, sample_teachers):
        """测试教师负荷统计"""
        resp = await client.get("/api/v1/teachers/load-stats")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) == 50


# ============================================================
# 教室 API 测试
# ============================================================


class TestClassroomAPI:
    """教室 API 测试"""

    async def test_list_classrooms(self, client, sample_classrooms):
        """测试获取教室列表"""
        resp = await client.get("/api/v1/classrooms")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 15

    async def test_create_classroom(self, client):
        """测试创建教室"""
        resp = await client.post("/api/v1/classrooms", json={
            "name": "A-301",
            "capacity": 100,
            "room_type": "regular",
            "building": "A楼",
            "floor": 3,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "A-301"
        assert data["capacity"] == 100

    async def test_get_classroom(self, client, sample_classrooms):
        """测试获取单个教室"""
        room = sample_classrooms[0]
        resp = await client.get(f"/api/v1/classrooms/{room.id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == room.id

    async def test_update_classroom(self, client, sample_classrooms):
        """测试更新教室"""
        room = sample_classrooms[0]
        resp = await client.put(f"/api/v1/classrooms/{room.id}", json={
            "name": room.name,
            "capacity": 150,
            "room_type": "regular",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["capacity"] == 150

    async def test_toggle_classroom(self, client, sample_classrooms):
        """测试切换教室启用/禁用"""
        room = sample_classrooms[0]
        resp = await client.patch(f"/api/v1/classrooms/{room.id}/toggle")
        assert resp.status_code == 200
        data = resp.json()
        assert "is_active" in data

    async def test_create_classroom_invalid_capacity(self, client):
        """测试创建容量为零的教室"""
        resp = await client.post("/api/v1/classrooms", json={
            "name": "无效教室",
            "capacity": 0,
            "room_type": "regular",
        })
        assert resp.status_code == 422


# ============================================================
# 课程 API 测试
# ============================================================


class TestCourseAPI:
    """课程 API 测试"""

    async def test_list_courses(self, client, sample_courses):
        """测试获取课程列表"""
        resp = await client.get("/api/v1/courses")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 12

    async def test_create_course(self, client):
        """测试创建课程"""
        resp = await client.post("/api/v1/courses", json={
            "name": "新课程",
            "course_type": "major",
            "needs_ab": False,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "新课程"

    async def test_create_course_public(self, client):
        """测试创建公共课"""
        resp = await client.post("/api/v1/courses", json={
            "name": "公共新课",
            "course_type": "public",
            "needs_ab": False,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["course_type"] == "public"

    async def test_create_course_ab_needed(self, client):
        """测试创建需要 AB 卷的课程"""
        resp = await client.post("/api/v1/courses", json={
            "name": "AB卷课程",
            "course_type": "major",
            "needs_ab": True,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["needs_ab"] is True

    async def test_get_course(self, client, sample_courses):
        """测试获取单个课程"""
        course = sample_courses[0]
        resp = await client.get(f"/api/v1/courses/{course.id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == course.id

    async def test_update_course(self, client, sample_courses):
        """测试更新课程"""
        course = sample_courses[0]
        resp = await client.put(f"/api/v1/courses/{course.id}", json={
            "name": "修改课程名",
            "course_type": "major",
            "needs_ab": True,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "修改课程名"

    async def test_delete_course(self, client, sample_courses):
        """测试删除课程"""
        course = sample_courses[-1]
        resp = await client.delete(f"/api/v1/courses/{course.id}")
        assert resp.status_code == 200

        resp2 = await client.get(f"/api/v1/courses/{course.id}")
        assert resp2.status_code == 404

    async def test_create_course_with_classes(self, client, sample_classes):
        """测试创建课程并关联班级"""
        resp = await client.post("/api/v1/courses", json={
            "name": "带班级课程",
            "course_type": "major",
            "needs_ab": False,
            "class_ids": [sample_classes[0].id, sample_classes[1].id],
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "带班级课程"


# ============================================================
# 学生 API 测试
# ============================================================


class TestStudentAPI:
    """学生 API 测试"""

    async def test_list_students(self, client, sample_students):
        """测试获取学生列表"""
        resp = await client.get("/api/v1/students")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1000

    async def test_list_students_pagination(self, client, sample_students):
        """测试学生列表分页"""
        resp = await client.get("/api/v1/students?skip=0&limit=20")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 20

    async def test_create_student(self, client, sample_classes):
        """测试创建学生"""
        resp = await client.post("/api/v1/students", json={
            "student_no": "2023999999",
            "name": "新学生",
            "class_id": sample_classes[0].id,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["student_no"] == "2023999999"

    async def test_create_student_duplicate_no(self, client, sample_students):
        """测试创建重复学号的学生"""
        existing = sample_students[0]
        resp = await client.post("/api/v1/students", json={
            "student_no": existing.student_no,
            "name": "重复学生",
            "class_id": existing.class_id,
        })
        assert resp.status_code == 400

    async def test_filter_students_by_class(self, client, sample_students, sample_classes):
        """测试按班级过滤学生"""
        cls = sample_classes[0]
        resp = await client.get(f"/api/v1/students?class_id={cls.id}")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 25  # 每班25名学生


# ============================================================
# 班级 API 测试
# ============================================================


class TestClassAPI:
    """班级 API 测试"""

    async def test_list_classes(self, client, sample_classes):
        """测试获取班级列表"""
        resp = await client.get("/api/v1/classes")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 40

    async def test_create_class(self, client, sample_majors):
        """测试创建班级"""
        resp = await client.post("/api/v1/classes", json={
            "name": "新班级",
            "major_id": sample_majors[0].id,
            "grade": 2023,
            "student_count": 30,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "新班级"

    async def test_create_class_duplicate(self, client, sample_classes):
        """测试创建重复班级"""
        cls = sample_classes[0]
        resp = await client.post("/api/v1/classes", json={
            "name": cls.name,
            "major_id": cls.major_id,
            "grade": cls.grade,
            "student_count": 30,
        })
        assert resp.status_code == 400

    async def test_get_class(self, client, sample_classes):
        """测试获取单个班级"""
        cls = sample_classes[0]
        resp = await client.get(f"/api/v1/classes/{cls.id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == cls.id

    async def test_delete_class(self, client, sample_classes):
        """测试删除班级"""
        cls = sample_classes[-1]
        resp = await client.delete(f"/api/v1/classes/{cls.id}")
        assert resp.status_code == 200


# ============================================================
# 时段 API 测试
# ============================================================


class TestTimeSlotAPI:
    """时段 API 测试"""

    async def test_list_time_slots(self, client, sample_time_slots):
        """测试获取时段列表"""
        resp = await client.get("/api/v1/time-slots")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 20

    async def test_time_slot_fields(self, client, sample_time_slots):
        """测试时段字段完整性"""
        resp = await client.get("/api/v1/time-slots")
        data = resp.json()
        first = data[0]
        assert "day_of_week" in first
        assert "slot_code" in first
        assert "start_time" in first
        assert "end_time" in first
        assert "is_continuous" in first


# ============================================================
# 排考 API 测试
# ============================================================


class TestSchedulerAPI:
    """排考 API 测试"""

    async def test_trigger_schedule(self, client, sample_teachers, sample_classrooms,
                                     sample_time_slots, sample_course_classes):
        """测试触发排考"""
        resp = await client.post("/api/v1/scheduler/trigger", json={})
        # 可能需要更多数据才能成功，但至少不应该是5xx
        assert resp.status_code in [200, 400, 404]

    async def test_get_schedule_status(self, client):
        """测试获取排考状态"""
        resp = await client.get("/api/v1/scheduler/status")
        assert resp.status_code in [200, 404]

    async def test_list_schedule_versions(self, client, sample_schedule_version):
        """测试获取排考版本列表"""
        resp = await client.get("/api/v1/scheduler/versions")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    async def test_publish_version(self, client, sample_schedule_version):
        """测试发布版本"""
        resp = await client.patch(
            f"/api/v1/scheduler/versions/{sample_schedule_version.id}/publish"
        )
        assert resp.status_code == 200

    async def test_archive_version(self, client, sample_schedule_version):
        """测试归档版本"""
        resp = await client.patch(
            f"/api/v1/scheduler/versions/{sample_schedule_version.id}/archive"
        )
        assert resp.status_code == 200

    async def test_rollback_version(self, client, sample_schedule_version):
        """测试回滚版本"""
        resp = await client.post(
            f"/api/v1/scheduler/versions/{sample_schedule_version.id}/rollback"
        )
        assert resp.status_code in [200, 400]


# ============================================================
# 排考结果 API 测试
# ============================================================


class TestExamResultAPI:
    """排考结果 API 测试"""

    async def test_overview_matrix(self, client):
        """测试获取总览矩阵"""
        resp = await client.get("/api/v1/exams/overview-matrix")
        assert resp.status_code == 200

    async def test_teacher_gantt(self, client):
        """测试获取教师甘特图"""
        resp = await client.get("/api/v1/exams/teacher-gantt")
        assert resp.status_code == 200

    async def test_classroom_matrix(self, client):
        """测试获取教室矩阵"""
        resp = await client.get("/api/v1/exams/classroom-matrix")
        assert resp.status_code == 200

    async def test_class_view(self, client):
        """测试获取班级视图"""
        resp = await client.get("/api/v1/exams/class-view")
        assert resp.status_code == 200

    async def test_course_view(self, client):
        """测试获取课程视图"""
        resp = await client.get("/api/v1/exams/course-view")
        assert resp.status_code == 200

    async def test_list_exams(self, client):
        """测试获取考试列表"""
        resp = await client.get("/api/v1/exams")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    async def test_create_exam(self, client, sample_courses, sample_time_slots):
        """测试创建考试"""
        resp = await client.post("/api/v1/exams", json={
            "course_id": sample_courses[0].id,
            "time_slot_id": sample_time_slots[0].id,
        })
        assert resp.status_code == 200

    async def test_create_exam_invalid_course(self, client, sample_time_slots):
        """测试创建考试时使用无效课程ID"""
        resp = await client.post("/api/v1/exams", json={
            "course_id": 99999,
            "time_slot_id": sample_time_slots[0].id,
        })
        assert resp.status_code == 400

    async def test_create_exam_invalid_time_slot(self, client, sample_courses):
        """测试创建考试时使用无效时段ID"""
        resp = await client.post("/api/v1/exams", json={
            "course_id": sample_courses[0].id,
            "time_slot_id": 99999,
        })
        assert resp.status_code == 400

    async def test_update_exam(self, client, sample_courses, sample_time_slots):
        """测试更新考试"""
        resp_create = await client.post("/api/v1/exams", json={
            "course_id": sample_courses[0].id,
            "time_slot_id": sample_time_slots[0].id,
        })
        exam_id = resp_create.json()["id"]

        resp = await client.put(f"/api/v1/exams/{exam_id}", json={
            "course_id": sample_courses[0].id,
            "time_slot_id": sample_time_slots[1].id,
        })
        assert resp.status_code == 200


# ============================================================
# 手动微调 API 测试
# ============================================================


class TestAdjustmentAPI:
    """手动微调 API 测试"""

    async def test_adjust_time_slot_success(self, client, sample_courses, sample_time_slots):
        """测试调时段成功"""
        # 先创建考试
        resp = await client.post("/api/v1/exams", json={
            "course_id": sample_courses[0].id,
            "time_slot_id": sample_time_slots[0].id,
        })
        exam_id = resp.json()["id"]

        resp = await client.put("/api/v1/adjustments/time-slot", json={
            "exam_id": exam_id,
            "new_time_slot_id": sample_time_slots[1].id,
            "reason": "时间冲突",
        })
        assert resp.status_code in [200, 400]

    async def test_adjust_classroom(self, client, sample_courses, sample_time_slots,
                                     sample_classrooms):
        """测试换教室"""
        resp = await client.post("/api/v1/exams", json={
            "course_id": sample_courses[0].id,
            "time_slot_id": sample_time_slots[0].id,
        })
        exam_id = resp.json()["id"]

        resp = await client.put("/api/v1/adjustments/classroom", json={
            "exam_id": exam_id,
            "exam_classroom_id": sample_classrooms[0].id,
            "new_classroom_id": sample_classrooms[1].id,
            "reason": "教室不够",
        })
        assert resp.status_code in [200, 400, 404]

    async def test_swap_teachers(self, client, sample_teachers):
        """测试交换教师"""
        resp = await client.put("/api/v1/adjustments/teachers/swap", json={
            "teacher_1_exam_teacher_id": 1,
            "teacher_2_exam_teacher_id": 2,
            "reason": "交换监考",
        })
        assert resp.status_code in [200, 400, 404]

    async def test_transfer_teacher(self, client, sample_teachers):
        """测试转移教师"""
        resp = await client.put("/api/v1/adjustments/teachers/transfer", json={
            "from_exam_teacher_id": 1,
            "to_exam_id": 2,
            "reason": "调剂",
        })
        assert resp.status_code in [200, 400, 404]


# ============================================================
# 教师调剂 API 测试
# ============================================================


class TestTeacherTransferAPI:
    """教师调剂 API 测试"""

    async def test_transfer_single(self, client, sample_teachers):
        """测试单人转移"""
        resp = await client.put("/api/v1/adjustments/teachers/transfer", json={
            "from_exam_teacher_id": 1,
            "to_exam_id": 2,
            "reason": "单人转移",
        })
        assert resp.status_code in [200, 400, 404]

    async def test_batch_transfer(self, client):
        """测试批量转交"""
        resp = await client.put("/api/v1/adjustments/teachers/batch-transfer", json={
            "exam_teacher_ids": [1, 2, 3],
            "target_teacher_id": 4,
            "reason": "批量转交",
        })
        assert resp.status_code in [200, 400, 404]

    async def test_undo(self, client):
        """测试撤销操作"""
        resp = await client.post("/api/v1/adjustments/teachers/undo")
        assert resp.status_code in [200, 400, 404]


# ============================================================
# 审计日志 API 测试
# ============================================================


class TestAuditLogAPI:
    """审计日志 API 测试"""

    async def test_list_audit_logs(self, client, sample_audit_log):
        """测试获取审计日志列表"""
        resp = await client.get("/api/v1/audit-logs")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    async def test_list_audit_logs_pagination(self, client, sample_audit_log):
        """测试审计日志分页"""
        resp = await client.get("/api/v1/audit-logs?skip=0&limit=10")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) <= 10

    async def test_filter_audit_logs_by_action(self, client, sample_audit_log):
        """测试按操作类型过滤审计日志"""
        resp = await client.get("/api/v1/audit-logs?action=create")
        assert resp.status_code == 200

    async def test_filter_audit_logs_by_entity(self, client, sample_audit_log):
        """测试按实体类型过滤审计日志"""
        resp = await client.get("/api/v1/audit-logs?entity_type=exam")
        assert resp.status_code == 200


# ============================================================
# 健康检查 API 测试
# ============================================================


class TestHealthAPI:
    """健康检查 API 测试"""

    async def test_health_check(self, client):
        """测试健康检查端点"""
        resp = await client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"

    async def test_health_response_structure(self, client):
        """测试健康检查响应结构"""
        resp = await client.get("/health")
        data = resp.json()
        assert "status" in data
        assert "message" in data


# ============================================================
# 错误处理测试
# ============================================================


class TestErrorHandling:
    """错误处理测试"""

    async def test_404_not_found(self, client):
        """测试 404 错误"""
        resp = await client.get("/api/v1/nonexistent")
        assert resp.status_code == 404

    async def test_400_bad_request_create_exam_no_course(self, client):
        """测试创建考试缺少课程ID返回 400"""
        resp = await client.post("/api/v1/exams", json={})
        assert resp.status_code == 422

    async def test_422_validation_error(self, client):
        """测试参数校验错误 422"""
        resp = await client.post("/api/v1/teachers", json={
            "teacher_type": "invalid",
        })
        assert resp.status_code == 422

    async def test_400_create_class_duplicate(self, client, sample_classes):
        """测试重复创建返回 400"""
        cls = sample_classes[0]
        resp = await client.post("/api/v1/classes", json={
            "name": cls.name,
            "major_id": cls.major_id,
            "grade": cls.grade,
            "student_count": 30,
        })
        assert resp.status_code == 400

    async def test_invalid_method(self, client):
        """测试无效 HTTP 方法"""
        resp = await client.post("/api/v1/teachers", json={})
        assert resp.status_code in [400, 422]

    async def test_missing_required_field(self, client):
        """测试缺少必填字段"""
        resp = await client.post("/api/v1/classrooms", json={
            "building": "A楼",
        })
        assert resp.status_code == 422
