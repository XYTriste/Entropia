"""
教室分配算法

功能：为考试分配教室，支持班级拆分到多个教室。

约束：
- HC-03: 单个教室里不同班级来源最多 2 个（同一班级的多个片段必须去不同教室）
- HC-04: 教室实际安排人数不超过容量
- 拆分规则：
  1. 单个班级最多拆到 3 个教室
  2. 优先尽量平均拆分（如 51 → 25+26）
  3. 同一班级尽量集中，教室不够才考虑混班

策略：
1. 阶段一：尽量完整分配班级（不拆分），大班级优先获得大教室
2. 阶段二：对无法完整放入的班级进行拆分，尽量平均分配到多个教室
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from models import Class, Classroom


# ============================================================
# 教室分配结果
# ============================================================
@dataclass
class ClassroomAssignment:
    """单个教室的分配结果"""
    classroom_id: int
    classroom_name: str
    capacity: int
    assignments: list[tuple] = field(default_factory=list)  # [(Class, 分配人数), ...]
    total_students: int = 0


def allocate_classrooms(
    student_count: int,
    classes: list,
    classrooms: list,
) -> list[ClassroomAssignment]:
    """
    为学生分配教室，支持班级拆分。

    参数:
        student_count: 学生总数
        classes: 需要分配的班级列表（每个Class含student_count）
        classrooms: 可用教室列表（每个Classroom含capacity）

    返回:
        ClassroomAssignment列表，表示每个教室分配的班级片段

    约束:
        HC-03: 单个教室里不同班级来源最多2个
        HC-04: 教室实际人数 <= 容量
        拆分: 单个班级最多3个教室，尽量平均拆分
    """
    # --------------------------------------------------------
    # 步骤1: 过滤与基本检查
    # --------------------------------------------------------
    active_rooms = [r for r in classrooms if getattr(r, "is_active", True)]
    if not active_rooms:
        return []

    total_capacity: int = sum(r.capacity for r in active_rooms)
    total_students_actual: int = sum(c.student_count for c in classes)
    if total_capacity < total_students_actual:
        return []

    # --------------------------------------------------------
    # 步骤2: 初始化教室状态
    # --------------------------------------------------------
    room_states: list[dict] = []
    for r in sorted(active_rooms, key=lambda x: x.capacity, reverse=True):
        room_states.append(
            {
                "room": r,
                "remaining": r.capacity,
                "class_ids": set(),
                "assignments": [],
            }
        )

    # --------------------------------------------------------
    # 步骤3: 阶段一 —— 尽量完整分配（不拆分）
    # --------------------------------------------------------
    # 班级按人数降序，大班级优先获得大教室
    sorted_classes = sorted(classes, key=lambda c: c.student_count, reverse=True)
    unplaced: list = []

    for c in sorted_classes:
        placed: bool = False
        candidates: list[tuple] = []

        for rs in room_states:
            # 容量不够
            if c.student_count > rs["remaining"]:
                continue
            # 同一班级的不同片段不能进同一教室
            if c.id in rs["class_ids"]:
                continue

            other_count = len(rs["class_ids"])
            if other_count == 0:
                # 空教室，最高优先级
                score = (0, -rs["remaining"])
            elif other_count == 1:
                # 已有1个其他班级，次优先级
                score = (1, -rs["remaining"])
            else:
                # 已有2个其他班级（HC-03限制）
                continue

            candidates.append((score, rs))

        if candidates:
            candidates.sort(key=lambda x: x[0])
            _, best = candidates[0]
            best["remaining"] -= c.student_count
            best["class_ids"].add(c.id)
            best["assignments"].append((c, c.student_count))
            placed = True

        if not placed:
            unplaced.append(c)

    # --------------------------------------------------------
    # 步骤4: 阶段二 —— 对未分配班级进行拆分
    # --------------------------------------------------------
    for c in unplaced:
        # 收集可用教室（排除已有同班的、已有2个其他班的）
        available = [
            rs
            for rs in room_states
            if rs["remaining"] > 0
            and c.id not in rs["class_ids"]
            and len(rs["class_ids"]) < 2
        ]

        if not available:
            return []

        # 按剩余容量降序
        available.sort(key=lambda x: x["remaining"], reverse=True)

        placed = False
        # 尝试拆成 2 份或 3 份
        for num_chunks in (2, 3):
            if num_chunks > len(available):
                continue

            selected = available[:num_chunks]
            total_rem = sum(rs["remaining"] for rs in selected)
            if total_rem < c.student_count:
                continue

            # 尽量平均拆分
            base = c.student_count // num_chunks
            remainder = c.student_count % num_chunks
            sizes = [base + (1 if i < remainder else 0) for i in range(num_chunks)]

            # 大片段配大教室，检查是否每份都能放入
            can_fit = True
            for size, rs in zip(sorted(sizes, reverse=True), selected):
                if size > rs["remaining"]:
                    can_fit = False
                    break

            if can_fit:
                for size, rs in zip(sorted(sizes, reverse=True), selected):
                    rs["remaining"] -= size
                    rs["class_ids"].add(c.id)
                    rs["assignments"].append((c, size))
                placed = True
                break

        if not placed:
            return []

    # --------------------------------------------------------
    # 步骤5: 构建结果
    # --------------------------------------------------------
    result: list[ClassroomAssignment] = []
    for rs in room_states:
        if rs["assignments"]:
            total = sum(size for _, size in rs["assignments"])
            ca = ClassroomAssignment(
                classroom_id=rs["room"].id,
                classroom_name=rs["room"].name,
                capacity=rs["room"].capacity,
                assignments=rs["assignments"],
                total_students=total,
            )
            result.append(ca)

    return result


# ============================================================
# 单元测试
# ============================================================
if __name__ == "__main__":
    import unittest

    class MockClassroom:
        """测试用模拟教室"""
        def __init__(self, id: int, capacity: int, is_active: bool = True, name: str = "", floor: int = 1) -> None:
            self.id = id
            self.capacity = capacity
            self.is_active = is_active
            self.name = name or f"Room_{id}"
            self.room_type = "regular"
            self.floor = floor

    class MockClass:
        """测试用模拟班级"""
        def __init__(self, id: int, student_count: int) -> None:
            self.id = id
            self.student_count = student_count
            self.name = f"Class_{id}"
            self.grade = 1
            self.major_id = 1

    class TestClassroomAlloc(unittest.TestCase):
        """教室分配单元测试"""

        def test_basic_allocation(self):
            """基本分配测试"""
            classrooms = [MockClassroom(1, 100), MockClassroom(2, 50)]
            classes = [MockClass(1, 80), MockClass(2, 40)]
            result = allocate_classrooms(120, classes, classrooms)
            self.assertEqual(len(result), 2)
            self.assertEqual(result[0].total_students, 80)
            self.assertEqual(result[1].total_students, 40)

        def test_merge_two_classes(self):
            """测试两个班级合并到一个教室（HC-03验证）"""
            classrooms = [MockClassroom(1, 100)]
            classes = [MockClass(1, 40), MockClass(2, 30)]
            result = allocate_classrooms(70, classes, classrooms)
            self.assertEqual(len(result), 1)
            self.assertEqual(len(result[0].assignments), 2)
            self.assertEqual(result[0].total_students, 70)

        def test_max_two_classes_per_room(self):
            """验证HC-03：单个教室最多2个不同班级来源，第3个班级应分配到新教室"""
            classrooms = [MockClassroom(1, 200), MockClassroom(2, 100)]
            classes = [MockClass(1, 40), MockClass(2, 30), MockClass(3, 20)]
            result = allocate_classrooms(90, classes, classrooms)
            self.assertEqual(len(result), 2)
            for r in result:
                self.assertLessEqual(len(r.assignments), 2)

        def test_capacity_limit(self):
            """验证HC-04：人数不超过容量"""
            classrooms = [MockClassroom(1, 50)]
            classes = [MockClass(1, 60)]
            result = allocate_classrooms(60, classes, classrooms)
            # 60人需要拆分到2个教室，但只有1个教室，应该失败
            self.assertEqual(len(result), 0)

        def test_split_single_class(self):
            """测试单个班级拆分到多个教室"""
            classrooms = [MockClassroom(1, 30), MockClassroom(2, 30)]
            classes = [MockClass(1, 50)]
            result = allocate_classrooms(50, classes, classrooms)
            self.assertEqual(len(result), 2)
            # 50人拆到两个30人教室：25+25
            sizes = sorted([r.total_students for r in result])
            self.assertEqual(sizes, [25, 25])

        def test_split_class_three_rooms(self):
            """测试极端情况：班级拆分到3个教室"""
            classrooms = [
                MockClassroom(1, 25),
                MockClassroom(2, 25),
                MockClassroom(3, 25),
            ]
            classes = [MockClass(1, 63)]
            result = allocate_classrooms(63, classes, classrooms)
            self.assertEqual(len(result), 3)
            sizes = sorted([r.total_students for r in result])
            self.assertEqual(sizes, [21, 21, 21])

        def test_split_and_merge_mixed(self):
            """测试拆分与混班混合场景：50人班拆25+25，和两个10人班合并"""
            classrooms = [MockClassroom(1, 35), MockClassroom(2, 35)]
            classes = [MockClass(1, 50), MockClass(2, 10), MockClass(3, 10)]
            result = allocate_classrooms(70, classes, classrooms)
            self.assertGreater(len(result), 0)
            total = sum(r.total_students for r in result)
            self.assertEqual(total, 70)
            for r in result:
                self.assertLessEqual(r.total_students, r.capacity)
                self.assertLessEqual(len({a[0].id for a in r.assignments}), 2)

        def test_split_when_large_room_occupied(self):
            """测试大教室被占用后，小班级被迫拆分进小教室"""
            classrooms = [MockClassroom(1, 90), MockClassroom(2, 28), MockClassroom(3, 28)]
            classes = [MockClass(1, 80), MockClass(2, 50)]
            result = allocate_classrooms(130, classes, classrooms)
            self.assertGreater(len(result), 0)
            # 80人班应进90人教室
            # 50人班无法进90人教室（remaining=10），应拆到两个28人教室：25+25
            sizes = sorted([r.total_students for r in result])
            self.assertIn(80, sizes)
            # 检查50人班是否被拆分
            class2_rooms = [r for r in result if any(a[0].id == 2 for a in r.assignments)]
            self.assertEqual(len(class2_rooms), 2)

        def test_multiple_rooms_merge(self):
            """测试多个教室和多个班级的复杂场景"""
            classrooms = [
                MockClassroom(1, 120),
                MockClassroom(2, 80),
                MockClassroom(3, 60),
            ]
            classes = [
                MockClass(1, 50), MockClass(2, 40),
                MockClass(3, 30), MockClass(4, 30),
            ]
            result = allocate_classrooms(150, classes, classrooms)
            self.assertGreater(len(result), 0)
            for r in result:
                self.assertLessEqual(len({a[0].id for a in r.assignments}), 2)
                self.assertLessEqual(r.total_students, r.capacity)

        def test_insufficient_capacity(self):
            """测试总容量不足的情况"""
            classrooms = [MockClassroom(1, 30)]
            classes = [MockClass(1, 50)]
            result = allocate_classrooms(50, classes, classrooms)
            self.assertEqual(len(result), 0)

        def test_huge_class_exceeds_max_split(self):
            """测试超大班级：即使拆3份也放不下的情况"""
            classrooms = [MockClassroom(1, 20), MockClassroom(2, 20)]
            classes = [MockClass(1, 70)]  # 70 > 3*20=60，放不下
            result = allocate_classrooms(70, classes, classrooms)
            self.assertEqual(len(result), 0)

    unittest.main()
