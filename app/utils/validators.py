"""
考试排考系统 - 工具验证函数

提供通用数据校验：学号格式、时间格式、时段编码、容量计算等。
"""

import re
from datetime import datetime
from typing import Optional


# ============================================================
# 格式校验
# ============================================================


def validate_student_no(student_no: str) -> bool:
    """校验学号格式 (6-20位数字/字母组合)"""
    if not student_no:
        return False
    return bool(re.match(r"^[A-Za-z0-9]{6,20}$", student_no))


def validate_slot_code(slot_code: str) -> bool:
    """校验时段编码 (T1/T2/T3/T4)"""
    return slot_code in ("T1", "T2", "T3", "T4")


def validate_time_format(time_str: str) -> bool:
    """校验时间格式 (HH:MM)"""
    if not time_str:
        return False
    return bool(re.match(r"^([01]\d|2[0-3]):([0-5]\d)$", time_str))


def validate_day_of_week(day: int) -> bool:
    """校验星期几 (1-5)"""
    return 1 <= day <= 5


def validate_date_format(date_str: str) -> bool:
    """校验日期格式 (YYYY-MM-DD)"""
    if not date_str:
        return False
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
        return True
    except ValueError:
        return False


def validate_datetime_format(dt_str: str) -> bool:
    """校验日期时间格式 (YYYY-MM-DD HH:MM:SS)"""
    if not dt_str:
        return False
    try:
        datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S")
        return True
    except ValueError:
        return False


# ============================================================
# CSV 数据行校验
# ============================================================


def validate_csv_teacher_row(row: dict, line_no: int) -> tuple[bool, list[str]]:
    """校验 CSV 教师数据行

    返回: (是否通过, 错误信息列表)
    """
    errors: list[str] = []
    name = row.get("name", "").strip()
    if not name:
        errors.append(f"第{line_no}行: 教师姓名为空")
    if len(name) > 50:
        errors.append(f"第{line_no}行: 教师姓名过长(>50字符)")

    teacher_type = row.get("teacher_type", "").strip()
    if teacher_type not in ("full_time", "part_time"):
        errors.append(f"第{line_no}行: 教师类型必须是 full_time 或 part_time")

    try:
        max_slots = int(row.get("max_slots", 0))
        if max_slots < 0:
            errors.append(f"第{line_no}行: 最大场次不能为负数")
    except ValueError:
        errors.append(f"第{line_no}行: 最大场次必须是整数")

    return len(errors) == 0, errors


def validate_csv_classroom_row(row: dict, line_no: int) -> tuple[bool, list[str]]:
    """校验 CSV 教室数据行"""
    errors: list[str] = []
    name = row.get("name", "").strip()
    if not name:
        errors.append(f"第{line_no}行: 教室名称为空")

    try:
        capacity = int(row.get("capacity", 0))
        if capacity < 1:
            errors.append(f"第{line_no}行: 教室容量必须>=1")
    except ValueError:
        errors.append(f"第{line_no}行: 教室容量必须是整数")

    room_type = row.get("room_type", "").strip()
    if room_type not in ("regular", "lecture"):
        errors.append(f"第{line_no}行: 教室类型必须是 regular 或 lecture")

    return len(errors) == 0, errors


def validate_csv_student_row(row: dict, line_no: int) -> tuple[bool, list[str]]:
    """校验 CSV 学生数据行"""
    errors: list[str] = []
    student_no = row.get("student_no", "").strip()
    if not student_no:
        errors.append(f"第{line_no}行: 学号为空")
    elif not validate_student_no(student_no):
        errors.append(f"第{line_no}行: 学号格式不正确")

    name = row.get("name", "").strip()
    if not name:
        errors.append(f"第{line_no}行: 学生姓名为空")

    class_name = row.get("class_name", "").strip()
    if not class_name:
        errors.append(f"第{line_no}行: 班级名称为空")

    try:
        grade = int(row.get("grade", 0))
        if grade < 1 or grade > 4:
            errors.append(f"第{line_no}行: 年级范围应在1-4之间(1=大一,2=大二,3=大三,4=大四)")
    except ValueError:
        errors.append(f"第{line_no}行: 年级必须是整数")

    return len(errors) == 0, errors


def validate_csv_course_row(row: dict, line_no: int) -> tuple[bool, list[str]]:
    """校验 CSV 课程数据行"""
    errors: list[str] = []
    name = row.get("name", "").strip()
    if not name:
        errors.append(f"第{line_no}行: 课程名称为空")

    course_type = row.get("course_type", "").strip()
    if course_type not in ("public", "major"):
        errors.append(f"第{line_no}行: 课程类型必须是 public 或 major")

    needs_ab = row.get("needs_ab", "false").strip().lower()
    if needs_ab not in ("true", "false", "1", "0", "yes", "no"):
        errors.append(f"第{line_no}行: AB卷标记必须是 true/false")

    return len(errors) == 0, errors


def validate_csv_course_class_row(row: dict, line_no: int) -> tuple[bool, list[str]]:
    """校验 CSV 课程-班级关联数据行"""
    errors: list[str] = []
    course_name = row.get("course_name", "").strip()
    if not course_name:
        errors.append(f"第{line_no}行: 课程名称为空")

    class_name = row.get("class_name", "").strip()
    if not class_name:
        errors.append(f"第{line_no}行: 班级名称为空")

    try:
        grade = int(row.get("grade", 0))
        if grade < 1 or grade > 4:
            errors.append(f"第{line_no}行: 年级范围应在1-4之间(1=大一,2=大二,3=大三,4=大四)")
    except ValueError:
        errors.append(f"第{line_no}行: 年级必须是整数")

    return len(errors) == 0, errors


# ============================================================
# 容量计算校验
# ============================================================


def validate_capacity(student_count: int, classroom_capacity: int) -> tuple[bool, str]:
    """校验教室容量是否满足学生人数

    返回: (是否满足, 提示信息)
    """
    if classroom_capacity >= student_count:
        return True, "容量充足"
    return False, f"教室容量({classroom_capacity})不足，需要容纳{student_count}人"


def validate_classroom_fit(
    total_students: int, classrooms: list[dict]
) -> tuple[bool, str, int]:
    """校验教室组合是否足够容纳所有学生

    参数:
        total_students: 总学生数
        classrooms: 教室列表，每个含 capacity 字段

    返回: (是否满足, 信息, 总容量)
    """
    total_capacity = sum(c.get("capacity", 0) for c in classrooms)
    if total_capacity >= total_students:
        return True, f"教室总容量{total_capacity} >= 学生{total_students}人", total_capacity
    return False, f"教室总容量{total_capacity} < 学生{total_students}人", total_capacity


def validate_teacher_workload(
    teacher_max_slots: int, teacher_current_slots: int, delta: int = 1
) -> tuple[bool, str]:
    """校验教师场次是否超限

    参数:
        teacher_max_slots: 教师最大场次上限
        teacher_current_slots: 教师当前已排场次
        delta: 新增场次(默认1)

    返回: (是否超限, 提示信息)
    """
    new_count = teacher_current_slots + delta
    if new_count > teacher_max_slots:
        return False, f"教师场次超限: {new_count}/{teacher_max_slots}"
    return True, f"教师场次: {new_count}/{teacher_max_slots}"


# ============================================================
# 时段冲突校验
# ============================================================


def check_time_slot_conflict(
    slot_a_day: int, slot_a_code: str, slot_b_day: int, slot_b_code: str
) -> bool:
    """检查两个时段是否为同一时段(冲突)

    返回: True 表示冲突(同一时段)
    """
    return slot_a_day == slot_b_day and slot_a_code == slot_b_code


def is_continuous_slots(slot_code_a: str, slot_code_b: str) -> bool:
    """检查两个时段是否连续 (T1-T2 或 T3-T4)"""
    pairs = [("T1", "T2"), ("T2", "T1"), ("T3", "T4"), ("T4", "T3")]
    return (slot_code_a, slot_code_b) in pairs


# ============================================================
# 数据完整性校验
# ============================================================


def check_foreign_key_reference(
    fk_value: int, reference_set: set[int], field_name: str, line_no: int
) -> tuple[bool, Optional[str]]:
    """校验外键引用是否有效

    返回: (是否有效, 错误信息或None)
    """
    if fk_value in reference_set:
        return True, None
    return False, f"第{line_no}行: {field_name}={fk_value} 在引用表中不存在"


def check_unique_values(values: list, field_name: str) -> tuple[bool, list[str]]:
    """检查值列表中的重复项

    返回: (是否全部唯一, 重复项错误列表)
    """
    seen = set()
    errors = []
    for i, v in enumerate(values, 1):
        if v in seen:
            errors.append(f"第{i}行: {field_name}='{v}' 重复")
        seen.add(v)
    return len(errors) == 0, errors


# ============================================================
# 排考约束校验
# ============================================================


def validate_hc03_max_two_classes_per_room(class_count: int) -> tuple[bool, str]:
    """HC-03: 校验每个教室最多容纳2个班级"""
    if class_count <= 2:
        return True, "OK"
    return False, f"教室容纳班级数{class_count}超过上限(最多2个)"


def validate_hc04_room_capacity(room_capacity: int, assigned_students: int) -> tuple[bool, str]:
    """HC-04: 校验教室容量是否足够"""
    if room_capacity >= assigned_students:
        return True, "OK"
    return False, f"教室容量{room_capacity}不足，已分配{assigned_students}人"


def validate_hc05_teacher_max_slots(max_slots: int, used_slots: int) -> tuple[bool, str]:
    """HC-05: 校验教师场次上限"""
    if used_slots <= max_slots:
        return True, "OK"
    return False, f"教师已排{used_slots}场，上限{max_slots}场"


def validate_hc06_patrol_teacher_count(count: int) -> tuple[bool, str]:
    """HC-06: 校验流动监考恰好3名"""
    if count == 3:
        return True, "OK"
    return False, f"流动监考{count}名，应为恰好3名"
