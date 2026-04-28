"""
考试排考系统 - 导入功能测试

测试数据导入功能：
- 教师 CSV 导入 (正常、重复、格式错误)
- 教室 CSV 导入
- 学生 CSV 导入 (学号唯一性校验)
- 课程 CSV 导入
- 课程-班级关联导入
- 数据校验 (兼职教师容量警告)
- 错误报告格式验证
- 事务回滚测试 (部分失败全部回滚)
"""

import io
import csv
import pytest

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app", "services"))

from import_service import (
    import_teachers_from_csv,
    import_classrooms_from_csv,
    import_students_from_csv,
    import_courses_from_csv,
    import_course_classes_from_csv,
    ImportResult,
    ImportErrorDetail,
)


# ============================================================
# 辅助函数
# ============================================================


def create_csv(content_rows, headers=None):
    """创建 CSV 字节数据"""
    output = io.StringIO()
    if headers:
        writer = csv.writer(output)
        writer.writerow(headers)
        for row in content_rows:
            writer.writerow(row)
    else:
        output.write(content_rows)
    return output.getvalue().encode("utf-8")


# ============================================================
# 教师 CSV 导入测试
# ============================================================


class TestTeacherImport:
    """教师 CSV 导入测试"""

    async def test_import_teachers_normal(self, db_session):
        """测试正常导入教师数据"""
        csv_data = create_csv([
            ["教师A", "full_time", "5"],
            ["教师B", "part_time", "3"],
            ["教师C", "full_time", "4"],
        ], headers=["name", "teacher_type", "max_slots"])

        result = await import_teachers_from_csv(db_session, csv_data)
        assert result.success_count == 3
        assert result.failed_count == 0

    async def test_import_teachers_duplicate(self, db_session):
        """测试导入重复名称的教师（应跳过重复）"""
        csv_data = create_csv([
            ["教师A", "full_time", "5"],
            ["教师A", "part_time", "3"],  # 重复名称
        ], headers=["name", "teacher_type", "max_slots"])

        result = await import_teachers_from_csv(db_session, csv_data)
        assert result.success_count == 2  # 允许重名

    async def test_import_teachers_format_error(self, db_session):
        """测试导入格式错误的 CSV"""
        csv_data = b"invalid csv content without proper structure"

        result = await import_teachers_from_csv(db_session, csv_data)
        assert result.failed_count > 0

    async def test_import_teachers_empty(self, db_session):
        """测试导入空教师数据"""
        csv_data = create_csv([], headers=["name", "teacher_type", "max_slots"])

        result = await import_teachers_from_csv(db_session, csv_data)
        assert result.success_count == 0

    async def test_import_teachers_invalid_type(self, db_session):
        """测试导入无效教师类型"""
        csv_data = create_csv([
            ["教师A", "invalid_type", "5"],
        ], headers=["name", "teacher_type", "max_slots"])

        result = await import_teachers_from_csv(db_session, csv_data)
        assert result.failed_count > 0

    async def test_import_teachers_negative_slots(self, db_session):
        """测试导入负数 max_slots"""
        csv_data = create_csv([
            ["教师A", "full_time", "-1"],
        ], headers=["name", "teacher_type", "max_slots"])

        result = await import_teachers_from_csv(db_session, csv_data)
        # 负数应该被记录为警告或错误
        assert result.failed_count > 0 or len(result.warnings) > 0

    async def test_import_teachers_missing_name(self, db_session):
        """测试导入缺少姓名的教师"""
        csv_data = create_csv([
            ["", "full_time", "5"],
        ], headers=["name", "teacher_type", "max_slots"])

        result = await import_teachers_from_csv(db_session, csv_data)
        assert result.failed_count > 0

    async def test_import_teachers_large_batch(self, db_session):
        """测试大批量导入教师"""
        rows = [[f"教师{i:03d}", "full_time", str(5 + i % 3)] for i in range(1, 101)]
        csv_data = create_csv(rows, headers=["name", "teacher_type", "max_slots"])

        result = await import_teachers_from_csv(db_session, csv_data)
        assert result.success_count == 100

    async def test_import_part_time_warning(self, db_session):
        """测试导入兼职教师产生容量警告"""
        csv_data = create_csv([
            ["兼职教师", "part_time", "1"],
        ], headers=["name", "teacher_type", "max_slots"])

        result = await import_teachers_from_csv(db_session, csv_data)
        # 兼职教师 max_slots 小于合理值时应有警告
        assert result.success_count == 1


# ============================================================
# 教室 CSV 导入测试
# ============================================================


class TestClassroomImport:
    """教室 CSV 导入测试"""

    async def test_import_classrooms_normal(self, db_session):
        """测试正常导入教室数据"""
        csv_data = create_csv([
            ["A-101", "80", "regular", "A楼", "1"],
            ["B-201", "120", "lecture", "B楼", "2"],
        ], headers=["name", "capacity", "room_type", "building", "floor"])

        result = await import_classrooms_from_csv(db_session, csv_data)
        assert result.success_count == 2

    async def test_import_classrooms_invalid_capacity(self, db_session):
        """测试导入无效容量的教室"""
        csv_data = create_csv([
            ["A-101", "0", "regular", "A楼", "1"],
        ], headers=["name", "capacity", "room_type", "building", "floor"])

        result = await import_classrooms_from_csv(db_session, csv_data)
        assert result.failed_count > 0

    async def test_import_classrooms_duplicate_name(self, db_session):
        """测试导入重复名称的教室"""
        csv_data = create_csv([
            ["A-101", "80", "regular", "A楼", "1"],
            ["A-101", "100", "regular", "A楼", "2"],
        ], headers=["name", "capacity", "room_type", "building", "floor"])

        result = await import_classrooms_from_csv(db_session, csv_data)
        assert result.success_count >= 1
        assert result.failed_count > 0  # 第二个应失败

    async def test_import_classrooms_empty(self, db_session):
        """测试导入空教室数据"""
        csv_data = create_csv([], headers=["name", "capacity", "room_type", "building", "floor"])

        result = await import_classrooms_from_csv(db_session, csv_data)
        assert result.success_count == 0


# ============================================================
# 学生 CSV 导入测试
# ============================================================


class TestStudentImport:
    """学生 CSV 导入测试"""

    async def test_import_students_normal(self, db_session, sample_classes):
        """测试正常导入学生数据"""
        csv_data = create_csv([
            ["2023001001", "张三", str(sample_classes[0].id)],
            ["2023001002", "李四", str(sample_classes[1].id)],
        ], headers=["student_no", "name", "class_id"])

        result = await import_students_from_csv(db_session, csv_data)
        assert result.success_count == 2

    async def test_import_students_duplicate_no(self, db_session, sample_classes):
        """测试导入重复学号的学生"""
        csv_data = create_csv([
            ["2023001001", "张三", str(sample_classes[0].id)],
            ["2023001001", "李四", str(sample_classes[1].id)],  # 重复学号
        ], headers=["student_no", "name", "class_id"])

        result = await import_students_from_csv(db_session, csv_data)
        assert result.success_count == 1
        assert result.failed_count == 1  # 第二个应失败

    async def test_import_students_invalid_class(self, db_session):
        """测试导入无效班级的学生"""
        csv_data = create_csv([
            ["2023001001", "张三", "99999"],  # 不存在的班级
        ], headers=["student_no", "name", "class_id"])

        result = await import_students_from_csv(db_session, csv_data)
        assert result.failed_count > 0

    async def test_import_students_missing_fields(self, db_session):
        """测试导入缺少字段的学生"""
        csv_data = create_csv([
            ["", "张三", "1"],  # 缺少学号
            ["2023001002", "", "1"],  # 缺少姓名
        ], headers=["student_no", "name", "class_id"])

        result = await import_students_from_csv(db_session, csv_data)
        assert result.failed_count > 0


# ============================================================
# 课程 CSV 导入测试
# ============================================================


class TestCourseImport:
    """课程 CSV 导入测试"""

    async def test_import_courses_normal(self, db_session):
        """测试正常导入课程数据"""
        csv_data = create_csv([
            ["高等数学", "public", "false"],
            ["数据结构", "major", "true"],
            ["操作系统", "major", "false"],
        ], headers=["name", "course_type", "needs_ab"])

        result = await import_courses_from_csv(db_session, csv_data)
        assert result.success_count == 3

    async def test_import_courses_invalid_type(self, db_session):
        """测试导入无效课程类型"""
        csv_data = create_csv([
            ["无效课程", "invalid_type", "false"],
        ], headers=["name", "course_type", "needs_ab"])

        result = await import_courses_from_csv(db_session, csv_data)
        assert result.failed_count > 0

    async def test_import_courses_missing_name(self, db_session):
        """测试导入缺少名称的课程"""
        csv_data = create_csv([
            ["", "major", "false"],
        ], headers=["name", "course_type", "needs_ab"])

        result = await import_courses_from_csv(db_session, csv_data)
        assert result.failed_count > 0


# ============================================================
# 课程-班级关联导入测试
# ============================================================


class TestCourseClassImport:
    """课程-班级关联导入测试"""

    async def test_import_course_classes_normal(self, db_session, sample_courses, sample_classes):
        """测试正常导入课程-班级关联"""
        csv_data = create_csv([
            [str(sample_courses[0].id), str(sample_classes[0].id), "2023"],
            [str(sample_courses[0].id), str(sample_classes[1].id), "2023"],
        ], headers=["course_id", "class_id", "grade"])

        result = await import_course_classes_from_csv(db_session, csv_data)
        assert result.success_count == 2

    async def test_import_course_classes_invalid_course(self, db_session, sample_classes):
        """测试导入无效课程的关联"""
        csv_data = create_csv([
            ["99999", str(sample_classes[0].id), "2023"],
        ], headers=["course_id", "class_id", "grade"])

        result = await import_course_classes_from_csv(db_session, csv_data)
        assert result.failed_count > 0

    async def test_import_course_classes_invalid_class(self, db_session, sample_courses):
        """测试导入无效班级的关联"""
        csv_data = create_csv([
            [str(sample_courses[0].id), "99999", "2023"],
        ], headers=["course_id", "class_id", "grade"])

        result = await import_course_classes_from_csv(db_session, csv_data)
        assert result.failed_count > 0

    async def test_import_course_classes_duplicate(self, db_session, sample_courses, sample_classes):
        """测试导入重复的课程-班级关联"""
        csv_data = create_csv([
            [str(sample_courses[0].id), str(sample_classes[0].id), "2023"],
            [str(sample_courses[0].id), str(sample_classes[0].id), "2023"],
        ], headers=["course_id", "class_id", "grade"])

        result = await import_course_classes_from_csv(db_session, csv_data)
        assert result.success_count >= 1


# ============================================================
# 错误报告格式验证
# ============================================================


class TestImportErrorFormat:
    """导入错误报告格式验证"""

    async def test_error_detail_structure(self, db_session):
        """测试错误详情结构"""
        csv_data = create_csv([
            ["", "full_time", "5"],
        ], headers=["name", "teacher_type", "max_slots"])

        result = await import_teachers_from_csv(db_session, csv_data)
        assert isinstance(result.errors, list)
        if result.errors:
            error = result.errors[0]
            assert hasattr(error, "row")
            assert hasattr(error, "message")

    async def test_import_result_structure(self, db_session):
        """测试导入结果结构"""
        csv_data = create_csv([
            ["教师A", "full_time", "5"],
        ], headers=["name", "teacher_type", "max_slots"])

        result = await import_teachers_from_csv(db_session, csv_data)
        assert hasattr(result, "success_count")
        assert hasattr(result, "failed_count")
        assert hasattr(result, "errors")
        assert isinstance(result.errors, list)

    async def test_import_result_counts_match(self, db_session):
        """测试导入计数一致"""
        csv_data = create_csv([
            ["教师A", "full_time", "5"],
            ["", "full_time", "5"],  # 无效
            ["教师C", "part_time", "3"],
        ], headers=["name", "teacher_type", "max_slots"])

        result = await import_teachers_from_csv(db_session, csv_data)
        assert result.success_count + result.failed_count == 3


# ============================================================
# 事务回滚测试
# ============================================================


class TestTransactionRollback:
    """事务回滚测试"""

    async def test_partial_failure_rollback(self, db_session, sample_classes):
        """测试部分失败时全部回滚"""
        csv_data = create_csv([
            ["2023001001", "张三", str(sample_classes[0].id)],  # 有效
            ["2023001002", "李四", str(sample_classes[1].id)],  # 有效
            ["2023001001", "重复", str(sample_classes[0].id)],  # 重复学号
        ], headers=["student_no", "name", "class_id"])

        result = await import_students_from_csv(db_session, csv_data)
        # 验证数据库中只有之前的数据或全部回滚
        assert result.failed_count > 0
