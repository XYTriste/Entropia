"""
教师分配算法

功能：为考试分配监考教师，包括固定监考和流动监考。

规则：
- 固定监考：每个考场需要2名固定监考
  - 优先使用专任教师（未达上限的）
  - 专任教师用尽后使用兼职教师
- 流动监考：每个时段需要3名流动监考
  - 优先从兼职教师抽取
  - 兼职不足时从专任教师补充
- 连续场次优化：同一教师优先安排连续时段

硬约束：
- HC-05: 每位教师的监考总场次（固定+流动）不得超过其个人上限 max_slots
- HC-06: 每个时段必须恰好安排3名流动监考教师
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from models import Teacher


# ============================================================
# 教师分配结果
# ============================================================
@dataclass
class TeacherAssignment:
    """教师分配结果项"""
    teacher_id: int
    teacher_name: str
    role: str  # "fixed" | "patrol"
    classroom_id: int | None = None  # fixed时指定考场


@dataclass
class TeacherState:
    """
    教师状态追踪器
    用于在分配过程中动态追踪每位教师的已分配场次
    """
    teacher: Teacher
    assigned_slots: int = 0  # 已分配场次

    @property
    def remaining(self) -> int:
        """剩余可分配场次"""
        return self.teacher.max_slots - self.assigned_slots

    @property
    def is_full(self) -> bool:
        """是否已达上限"""
        return self.assigned_slots >= self.teacher.max_slots

    def assign(self, count: int = 1) -> bool:
        """
        分配场次，返回是否成功
        严格遵循HC-05：不超过max_slots
        """
        if self.assigned_slots + count > self.teacher.max_slots:
            return False
        self.assigned_slots += count
        return True


def _build_teacher_states(teachers: list) -> list[TeacherState]:
    """构建教师状态列表"""
    return [TeacherState(t) for t in teachers]


def _get_available_by_priority(
    states: list[TeacherState],
    priority_type: str,  # "full_time" | "part_time" | "any"
    need: int,
) -> list[TeacherState]:
    """
    按优先级获取可用教师

    参数:
        states: 教师状态列表
        priority_type: 优先类型
        need: 需要的人数

    返回:
        可用教师状态列表，按优先级排序
    """
    available: list[TeacherState] = []

    if priority_type == "full_time":
        # 优先专任教师，再兼职教师
        full = [s for s in states if s.teacher.teacher_type == "full_time" and not s.is_full]
        part = [s for s in states if s.teacher.teacher_type == "part_time" and not s.is_full]
        # 按剩余容量降序排列（优先使用剩余多的）
        full.sort(key=lambda s: s.remaining, reverse=True)
        part.sort(key=lambda s: s.remaining, reverse=True)
        available = full + part
    elif priority_type == "part_time":
        # 优先兼职教师，再专任教师
        part = [s for s in states if s.teacher.teacher_type == "part_time" and not s.is_full]
        full = [s for s in states if s.teacher.teacher_type == "full_time" and not s.is_full]
        part.sort(key=lambda s: s.remaining, reverse=True)
        full.sort(key=lambda s: s.remaining, reverse=True)
        available = part + full
    else:
        available = [s for s in states if not s.is_full]
        available.sort(key=lambda s: s.remaining, reverse=True)

    return available[:need]


def allocate_teachers_fixed(
    exam_id: int,
    classrooms: list,  # ClassroomAssignment列表
    teacher_states: list[TeacherState],
) -> list[TeacherAssignment]:
    """
    为固定监考分配教师。

    参数:
        exam_id: 考试ID
        classrooms: 教室分配结果列表（每个教室需要2名固定监考）
        teacher_states: 教师状态列表（会被修改，记录已分配场次）

    返回:
        TeacherAssignment列表

    规则:
        - 每个考场2名固定监考
        - 优先专任教师（SC-03软约束）
        - HC-05: 不超过教师上限
    """
    assignments: list[TeacherAssignment] = []
    total_needed: int = len(classrooms) * 2  # 每个考场2人

    # 检查总可用容量
    total_available: int = sum(s.remaining for s in teacher_states)
    if total_available < total_needed:
        # 教师资源不足
        return []

    for classroom in classrooms:
        # 每个教室需要2名固定监考
        needed: int = 2
        room_id: int = classroom.classroom_id

        # 优先专任教师（软约束SC-03）
        candidates = _get_available_by_priority(teacher_states, "full_time", needed)

        for _ in range(needed):
            assigned: bool = False
            for state in candidates:
                if state.assign(1):
                    assignments.append(TeacherAssignment(
                        teacher_id=state.teacher.id,
                        teacher_name=state.teacher.name,
                        role="fixed",
                        classroom_id=room_id,
                    ))
                    assigned = True
                    break
                candidates.remove(state)  # 满了就移除

            if not assigned:
                # 尝试任何可用教师
                fallback = _get_available_by_priority(teacher_states, "any", 1)
                if fallback and fallback[0].assign(1):
                    assignments.append(TeacherAssignment(
                        teacher_id=fallback[0].teacher.id,
                        teacher_name=fallback[0].teacher.name,
                        role="fixed",
                        classroom_id=room_id,
                    ))
                else:
                    # 完全无法分配
                    return []

    return assignments


def allocate_teachers_patrol(
    time_slot_id: int,
    teacher_states: list[TeacherState],
    existing_assignments: list[TeacherAssignment] | None = None,
) -> list[TeacherAssignment]:
    """
    为流动监考分配教师。

    参数:
        time_slot_id: 时段ID
        teacher_states: 教师状态列表（会被修改）
        existing_assignments: 该时段已有的教师分配（用于避免重复）

    返回:
        TeacherAssignment列表，恰好3名流动监考

    规则:
        - HC-06: 每个时段恰好3名流动监考
        - 优先兼职教师（SC-04软约束）
        - HC-05: 不超过教师上限
    """
    assignments: list[TeacherAssignment] = []
    needed: int = 3  # HC-06: 恰好3名

    # 已被使用的教师ID集合
    used_ids: set[int] = set()
    if existing_assignments:
        used_ids = {a.teacher_id for a in existing_assignments}

    # 优先兼职教师（软约束SC-04）
    candidates = _get_available_by_priority(teacher_states, "part_time", needed)

    for _ in range(needed):
        assigned: bool = False

        # 过滤掉已使用的教师
        for state in list(candidates):
            if state.teacher.id in used_ids:
                continue
            if state.assign(1):
                assignments.append(TeacherAssignment(
                    teacher_id=state.teacher.id,
                    teacher_name=state.teacher.name,
                    role="patrol",
                    classroom_id=None,
                ))
                used_ids.add(state.teacher.id)
                assigned = True
                break

        if not assigned:
            # 从任何可用教师中补充（包括专任教师）
            fallback = _get_available_by_priority(teacher_states, "any", needed)
            for state in fallback:
                if state.teacher.id in used_ids:
                    continue
                if state.assign(1):
                    assignments.append(TeacherAssignment(
                        teacher_id=state.teacher.id,
                        teacher_name=state.teacher.name,
                        role="patrol",
                        classroom_id=None,
                    ))
                    used_ids.add(state.teacher.id)
                    assigned = True
                    break

        if not assigned:
            # 无法凑齐3名流动监考
            return []

    return assignments


def create_teacher_usage_tracker(teachers: list) -> dict[int, list[int]]:
    """
    创建教师使用时序追踪器。
    用于SC-05连续场次优化：追踪教师被安排的时段ID列表。

    返回:
        dict: teacher_id -> 已安排时段ID列表（按时间排序）
    """
    return {t.id: [] for t in teachers}


def is_continuous_slot(slot_id1: int, slot_id2: int) -> bool:
    """
    判断两个时段是否连续。
    连续定义：同一天的T1-T2，或T3-T4。
    注意：T2与T3不连续（中间有休息时间）。

    时段编号:
        周一: 1-T1, 2-T2, 3-T3, 4-T4
        周二: 5-T1, 6-T2, 7-T3, 8-T4
        ...

    连续条件：
        - 同一天内，slot_id相差1且一个是奇数一个是偶数（即T1-T2）
        - 或同一天内，一个是T3(4k+3)，一个是T4(4k+4)
    """
    day1: int = (slot_id1 - 1) // 4
    day2: int = (slot_id2 - 1) // 4
    if day1 != day2:
        return False

    # 同一天的时段编号（1-4）
    s1: int = ((slot_id1 - 1) % 4) + 1
    s2: int = ((slot_id2 - 1) % 4) + 1

    # T1(1)与T2(2)连续，T3(3)与T4(4)连续
    return (s1 == 1 and s2 == 2) or (s1 == 2 and s2 == 1) or \
           (s1 == 3 and s2 == 4) or (s1 == 4 and s2 == 3)


def find_continuous_slot_assignments(teacher_slots: dict[int, list[int]]) -> int:
    """
    计算连续场次分配数，用于评估SC-05软约束。

    返回:
        连续场次数（相邻时段ID差为1且在同一天）
    """
    continuous_count: int = 0
    for teacher_id, slots in teacher_slots.items():
        sorted_slots = sorted(slots)
        for i in range(len(sorted_slots) - 1):
            if is_continuous_slot(sorted_slots[i], sorted_slots[i + 1]):
                continuous_count += 1
    return continuous_count


# ============================================================
# 单元测试
# ============================================================
if __name__ == "__main__":
    import unittest

    class MockTeacher:
        """测试用模拟教师"""
        def __init__(self, id: int, teacher_type: str, max_slots: int, name: str = "") -> None:
            self.id = id
            self.teacher_type = teacher_type  # "full_time" | "part_time"
            self.max_slots = max_slots
            self.name = name or f"Teacher_{id}"

    class MockClassroomAssign:
        """测试用模拟教室分配"""
        def __init__(self, classroom_id: int, capacity: int = 100) -> None:
            self.classroom_id = classroom_id
            self.capacity = capacity

    class TestTeacherAlloc(unittest.TestCase):
        """教师分配单元测试"""

        def test_fixed_basic(self):
            """测试固定监考基本分配"""
            teachers = [
                MockTeacher(1, "full_time", 5),
                MockTeacher(2, "full_time", 5),
                MockTeacher(3, "part_time", 5),
                MockTeacher(4, "part_time", 5),
            ]
            states = _build_teacher_states(teachers)
            classrooms = [MockClassroomAssign(101)]  # 1个考场 -> 需要2名固定监考
            result = allocate_teachers_fixed(1, classrooms, states)

            self.assertEqual(len(result), 2)
            # 验证HC-05：每人不超过上限
            for state in states:
                self.assertLessEqual(state.assigned_slots, state.teacher.max_slots)

        def test_patrol_basic(self):
            """测试流动监考基本分配"""
            teachers = [
                MockTeacher(1, "full_time", 5),
                MockTeacher(2, "part_time", 5),
                MockTeacher(3, "part_time", 5),
                MockTeacher(4, "part_time", 5),
                MockTeacher(5, "full_time", 5),
            ]
            states = _build_teacher_states(teachers)
            result = allocate_teachers_patrol(1, states)

            # HC-06: 恰好3名流动监考
            self.assertEqual(len(result), 3)
            # 优先兼职教师
            patrol_types = []
            for r in result:
                t = next(s for s in states if s.teacher.id == r.teacher_id)
                patrol_types.append(t.teacher.teacher_type)
            # 至少应有兼职教师优先
            self.assertIn("part_time", patrol_types)

        def test_hc05_max_slots(self):
            """验证HC-05：教师不超过max_slots"""
            teachers = [
                MockTeacher(1, "full_time", 1),  # 只能监考1场
                MockTeacher(2, "full_time", 1),
                MockTeacher(3, "part_time", 5),
                MockTeacher(4, "part_time", 5),
            ]
            states = _build_teacher_states(teachers)
            classrooms = [MockClassroomAssign(101), MockClassroomAssign(102)]  # 2考场=4人
            result = allocate_teachers_fixed(1, classrooms, states)

            self.assertEqual(len(result), 4)
            # 验证HC-05
            for state in states:
                self.assertLessEqual(state.assigned_slots, state.teacher.max_slots)
                self.assertLessEqual(state.assigned_slots, 1)

        def test_insufficient_teachers(self):
            """测试教师资源不足的情况"""
            teachers = [MockTeacher(1, "full_time", 1)]  # 只有1人
            states = _build_teacher_states(teachers)
            classrooms = [MockClassroomAssign(101)]  # 需要2人
            result = allocate_teachers_fixed(1, classrooms, states)
            # 只有1名教师，max_slots=1，最多分配1人，需要2人 -> 失败
            self.assertEqual(len(result), 0)

        def test_continuous_slots(self):
            """测试连续时段判断"""
            self.assertTrue(is_continuous_slot(1, 2))  # 周一T1-T2
            self.assertTrue(is_continuous_slot(3, 4))  # 周一T3-T4
            self.assertTrue(is_continuous_slot(5, 6))  # 周二T1-T2
            self.assertFalse(is_continuous_slot(2, 3))  # T2-T3不连续
            self.assertFalse(is_continuous_slot(4, 5))  # 周一T4-周二T1不连续

        def test_teacher_usage_tracker(self):
            """测试教师使用时序追踪"""
            teachers = [MockTeacher(1, "full_time", 5), MockTeacher(2, "part_time", 5)]
            tracker = create_teacher_usage_tracker(teachers)
            tracker[1].extend([1, 2, 5])  # 教师1安排在时段1,2,5
            tracker[2].extend([3, 4])     # 教师2安排在时段3,4

            continuous = find_continuous_slot_assignments(tracker)
            # 教师1: 1-2连续（1次），2-5不连续 -> 1次连续
            # 教师2: 3-4连续（1次）-> 1次连续
            self.assertEqual(continuous, 2)

    unittest.main()
