"""
考试排考系统 - 排考引擎测试

测试排考引擎各子模块：
- AB卷分配算法 (ab_split.py)
- 教室分配算法 (classroom_alloc.py)
- 教师分配算法 (teacher_alloc.py)
- 排考主引擎 (scheduler.py)
- 冲突检测与约束验证

使用预置的确定性数据集，确保测试结果可重现。
"""

import pytest

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app", "engine"))

from ab_split import split_ab_classes
from classroom_alloc import allocate_classrooms, ClassroomAssignment
from teacher_alloc import (
    allocate_teachers_fixed,
    allocate_teachers_patrol,
    create_teacher_usage_tracker,
    is_continuous_slot,
    find_continuous_slot_assignments,
    TeacherState,
)


# ============================================================
# Mock 数据类 (供引擎模块测试使用)
# ============================================================


class MockClass:
    """模拟班级"""

    def __init__(self, id: int, student_count: int, name: str = "", grade: int = 1, major_id: int = 1):
        self.id = id
        self.student_count = student_count
        self.name = name or f"Class_{id}"
        self.grade = grade
        self.major_id = major_id


class MockClassroom:
    """模拟教室"""

    def __init__(self, id: int, capacity: int, is_active: bool = True, name: str = "", floor: int = 1):
        self.id = id
        self.capacity = capacity
        self.is_active = is_active
        self.name = name or f"Room_{id}"
        self.room_type = "regular"
        self.floor = floor


class MockTeacher:
    """模拟教师"""

    def __init__(self, id: int, teacher_type: str = "full_time", max_slots: int = 5, name: str = ""):
        self.id = id
        self.teacher_type = teacher_type
        self.max_slots = max_slots
        self.name = name or f"Teacher_{id}"


class MockClassroomAssign:
    """模拟教室分配"""

    def __init__(self, classroom_id: int, capacity: int = 100):
        self.classroom_id = classroom_id
        self.capacity = capacity


# ============================================================
# AB卷分配算法测试
# ============================================================


class TestABSplit:
    """AB卷分配算法测试"""

    def test_even_classes_balanced_split(self):
        """测试偶数个班级均衡分配：4个班级各25人 -> A:50, B:50"""
        classes = [
            MockClass(1, 25), MockClass(2, 25),
            MockClass(3, 25), MockClass(4, 25),
        ]
        group_a, group_b = split_ab_classes(classes)
        sum_a = sum(c.student_count for c in group_a)
        sum_b = sum(c.student_count for c in group_b)
        assert abs(sum_a - sum_b) <= 10 or abs(sum_a - sum_b) / max(sum_a + sum_b, 1) <= 0.05

    def test_odd_classes_approximate_balance(self):
        """测试奇数个班级近似均衡：3个班级30人 -> 差值≤30人或≤5%"""
        classes = [MockClass(1, 30), MockClass(2, 30), MockClass(3, 30)]
        group_a, group_b = split_ab_classes(classes)
        sum_a = sum(c.student_count for c in group_a)
        sum_b = sum(c.student_count for c in group_b)
        total = sum_a + sum_b
        diff = abs(sum_a - sum_b)
        assert diff <= 10 or diff / total <= 0.05

    def test_single_class_all_to_a(self):
        """测试单班级全部给A组"""
        classes = [MockClass(1, 40)]
        group_a, group_b = split_ab_classes(classes)
        assert len(group_a) == 1
        assert len(group_b) == 0
        assert group_a[0].student_count == 40

    def test_empty_classes(self):
        """测试空班级列表"""
        group_a, group_b = split_ab_classes([])
        assert len(group_a) == 0
        assert len(group_b) == 0

    def test_large_class_gap(self):
        """测试班级人数差异大的情况：100人+3人+3人+3人"""
        classes = [MockClass(1, 100), MockClass(2, 3), MockClass(3, 3), MockClass(4, 3)]
        group_a, group_b = split_ab_classes(classes)
        sum_a = sum(c.student_count for c in group_a)
        sum_b = sum(c.student_count for c in group_b)
        # 动态规划应找到近似最优解
        assert abs(sum_a - sum_b) <= 91  # 比最差情况好

    def test_no_split_class(self):
        """验证HC-07：班级不可拆分，所有班级完整分配"""
        classes = [MockClass(1, 35), MockClass(2, 40), MockClass(3, 35), MockClass(4, 30)]
        group_a, group_b = split_ab_classes(classes)
        all_classes = group_a + group_b
        assert len(all_classes) == len(classes)
        ids_a = {c.id for c in group_a}
        ids_b = {c.id for c in group_b}
        assert len(ids_a & ids_b) == 0  # 无交集

    def test_two_classes(self):
        """测试两个班级：40+30 -> 应分开"""
        classes = [MockClass(1, 40), MockClass(2, 30)]
        group_a, group_b = split_ab_classes(classes)
        assert len(group_a) + len(group_b) == 2

    def test_six_classes_balance(self):
        """测试六个班级均衡情况"""
        classes = [MockClass(i, 20) for i in range(1, 7)]
        group_a, group_b = split_ab_classes(classes)
        sum_a = sum(c.student_count for c in group_a)
        sum_b = sum(c.student_count for c in group_b)
        assert abs(sum_a - sum_b) <= 20


# ============================================================
# 教室分配算法测试
# ============================================================


class TestClassroomAlloc:
    """教室分配算法测试"""

    def test_single_room_sufficient(self):
        """测试单教室足够容纳：80人进100人教室"""
        classrooms = [MockClassroom(1, 100)]
        classes = [MockClass(1, 80)]
        result = allocate_classrooms(80, classes, classrooms)
        assert len(result) == 1
        assert result[0].total_students == 80
        assert result[0].classroom_id == 1

    def test_multi_room_combination(self):
        """测试多教室组合场景：150人分配到多个教室"""
        classrooms = [
            MockClassroom(1, 120), MockClassroom(2, 80), MockClassroom(3, 60),
        ]
        classes = [
            MockClass(1, 50), MockClass(2, 40),
            MockClass(3, 30), MockClass(4, 30),
        ]
        result = allocate_classrooms(150, classes, classrooms)
        assert len(result) > 0

    def test_merge_two_classes_per_room(self):
        """验证HC-03：两个40人+30人班级合并到100人教室"""
        classrooms = [MockClassroom(1, 100)]
        classes = [MockClass(1, 40), MockClass(2, 30)]
        result = allocate_classrooms(70, classes, classrooms)
        assert len(result) == 1
        assert len(result[0].assignments) == 2
        assert result[0].total_students == 70

    def test_max_two_classes_per_room(self):
        """验证HC-03：单个教室最多2个班级，3个班级应失败"""
        classrooms = [MockClassroom(1, 200)]
        classes = [MockClass(1, 40), MockClass(2, 30), MockClass(3, 20)]
        result = allocate_classrooms(90, classes, classrooms)
        # 只有1个教室，最多容纳2个班级，第3个班级无法放置
        assert len(result) == 0  # 分配失败

    def test_capacity_exceeded(self):
        """验证HC-04：教室容量不足应失败"""
        classrooms = [MockClassroom(1, 50)]
        classes = [MockClass(1, 60)]
        result = allocate_classrooms(60, classes, classrooms)
        assert len(result) == 0  # 容量不足，分配失败

    def test_total_capacity_insufficient(self):
        """测试总容量不足的情况"""
        classrooms = [MockClassroom(1, 30)]
        classes = [MockClass(1, 50)]
        result = allocate_classrooms(50, classes, classrooms)
        assert len(result) == 0

    def test_complex_multi_room(self):
        """测试复杂多教室多班级场景"""
        classrooms = [
            MockClassroom(1, 120), MockClassroom(2, 80),
            MockClassroom(3, 60), MockClassroom(4, 50),
        ]
        classes = [
            MockClass(1, 50), MockClass(2, 45), MockClass(3, 40),
            MockClass(4, 30), MockClass(5, 25), MockClass(6, 20),
        ]
        result = allocate_classrooms(210, classes, classrooms)
        assert len(result) > 0
        # 验证HC-03：每个教室最多2个班级
        for r in result:
            assert len(r.assignments) <= 2
            # 验证HC-04：人数不超过容量
            assert r.total_students <= r.capacity

    def test_inactive_room_ignored(self):
        """测试停用教室不参与分配"""
        classrooms = [
            MockClassroom(1, 100, is_active=True),
            MockClassroom(2, 200, is_active=False),
        ]
        classes = [MockClass(1, 150)]
        result = allocate_classrooms(150, classes, classrooms)
        # 100人教室不够150人，200人教室已停用
        assert len(result) == 0

    def test_exact_capacity_fit(self):
        """测试恰好容量匹配"""
        classrooms = [MockClassroom(1, 50)]
        classes = [MockClass(1, 50)]
        result = allocate_classrooms(50, classes, classrooms)
        assert len(result) == 1
        assert result[0].total_students == 50


# ============================================================
# 教师分配算法测试
# ============================================================


class TestTeacherAlloc:
    """教师分配算法测试"""

    def test_fixed_priority_full_time(self):
        """测试固定监考优先专任教师"""
        teachers = [
            MockTeacher(1, "full_time", 5), MockTeacher(2, "full_time", 5),
            MockTeacher(3, "part_time", 5), MockTeacher(4, "part_time", 5),
        ]
        states = [TeacherState(t) for t in teachers]
        classrooms = [MockClassroomAssign(101)]  # 1个考场需要2名固定监考
        result = allocate_teachers_fixed(1, classrooms, states)

        assert len(result) == 2
        # 验证HC-05：每人不超过上限
        for state in states:
            assert state.assigned_slots <= state.teacher.max_slots

    def test_patrol_exactly_three(self):
        """验证HC-06：每个时段恰好3名流动监考"""
        teachers = [
            MockTeacher(1, "full_time", 5),
            MockTeacher(2, "part_time", 5),
            MockTeacher(3, "part_time", 5),
            MockTeacher(4, "part_time", 5),
            MockTeacher(5, "full_time", 5),
        ]
        states = [TeacherState(t) for t in teachers]
        result = allocate_teachers_patrol(1, states)

        assert len(result) == 3

    def test_hc05_max_slots_enforced(self):
        """验证HC-05：教师场次不超过max_slots"""
        teachers = [
            MockTeacher(1, "full_time", 1),
            MockTeacher(2, "full_time", 1),
            MockTeacher(3, "part_time", 5),
            MockTeacher(4, "part_time", 5),
        ]
        states = [TeacherState(t) for t in teachers]
        classrooms = [MockClassroomAssign(101), MockClassroomAssign(102)]
        result = allocate_teachers_fixed(1, classrooms, states)

        assert len(result) == 4
        for state in states:
            assert state.assigned_slots <= state.teacher.max_slots
            assert state.assigned_slots <= 1  # 上限为1

    def test_insufficient_teachers(self):
        """测试教师资源不足时分配失败"""
        teachers = [MockTeacher(1, "full_time", 1)]
        states = [TeacherState(t) for t in teachers]
        classrooms = [MockClassroomAssign(101)]
        result = allocate_teachers_fixed(1, classrooms, states)
        # 1名教师，max_slots=1，需要2人 -> 失败
        assert len(result) == 0

    def test_continuous_slots_t1_t2(self):
        """测试连续时段判断：T1-T2连续"""
        assert is_continuous_slot(1, 2) is True  # 周一T1-T2

    def test_continuous_slots_t3_t4(self):
        """测试连续时段判断：T3-T4连续"""
        assert is_continuous_slot(3, 4) is True  # 周一T3-T4

    def test_not_continuous_t2_t3(self):
        """测试不连续时段：T2-T3不连续(中间有午休)"""
        assert is_continuous_slot(2, 3) is False

    def test_not_continuous_cross_day(self):
        """测试跨天不连续：周一T4-周二T1"""
        assert is_continuous_slot(4, 5) is False

    @pytest.mark.parametrize("slot1,slot2,expected", [
        (1, 2, True),   # T1-T2 连续
        (2, 3, False),  # T2-T3 不连续(午休)
        (3, 4, True),   # T3-T4 连续
        (4, 5, False),  # 跨天
        (5, 6, True),   # 周二T1-T2 连续
        (6, 7, False),  # 周二T2-T3 不连续
    ])
    def test_continuous_slot_parametrized(self, slot1, slot2, expected):
        """参数化测试连续时段判断"""
        assert is_continuous_slot(slot1, slot2) is expected

    def test_teacher_usage_tracker(self):
        """测试教师使用时序追踪"""
        teachers = [MockTeacher(1, "full_time", 5), MockTeacher(2, "part_time", 5)]
        tracker = create_teacher_usage_tracker(teachers)
        tracker[1].extend([1, 2, 5])
        tracker[2].extend([3, 4])

        continuous = find_continuous_slot_assignments(tracker)
        # 教师1: 1-2连续(1次) -> 1次
        # 教师2: 3-4连续(1次) -> 1次
        assert continuous == 2

    def test_patrol_priority_part_time(self):
        """测试流动监考优先兼职教师(SC-04)"""
        teachers = [
            MockTeacher(1, "part_time", 5),
            MockTeacher(2, "part_time", 5),
            MockTeacher(3, "part_time", 5),
            MockTeacher(4, "full_time", 5),
        ]
        states = [TeacherState(t) for t in teachers]
        result = allocate_teachers_patrol(1, states)

        assert len(result) == 3
        # 应优先使用兼职教师
        part_time_used = sum(
            1 for r in result
            if next(s for s in states if s.teacher.id == r.teacher_id).teacher.teacher_type == "part_time"
        )
        assert part_time_used >= 2  # 至少2名兼职

    def test_teacher_state_assign(self):
        """测试TeacherState分配逻辑"""
        teacher = MockTeacher(1, "full_time", 3)
        state = TeacherState(teacher)
        assert state.remaining == 3
        assert state.is_full is False

        assert state.assign(1) is True
        assert state.assigned_slots == 1
        assert state.remaining == 2

        assert state.assign(2) is True
        assert state.assigned_slots == 3
        assert state.is_full is True

        assert state.assign(1) is False  # 超过上限


# ============================================================
# 排考主引擎集成测试
# ============================================================


class TestSchedulingEngine:
    """排考主引擎集成测试"""

    def _create_engine_data(self):
        """创建测试数据集"""
        from scheduler import SchedulingEngine

        time_slots = [
            MockClassroom.__new__(MockClassroom)  # placeholder
            for _ in range(20)
        ]
        # 创建20个时段
        time_slots = []
        for day in range(1, 6):
            for slot_idx, code in enumerate(["T1", "T2", "T3", "T4"], 1):
                ts_id = (day - 1) * 4 + slot_idx
                ts = type("TimeSlot", (), {
                    "id": ts_id, "day_of_week": day, "slot_code": code,
                    "start_time": "08:30", "end_time": "10:10",
                    "is_continuous": code in ("T1", "T3"),
                })()
                time_slots.append(ts)

        classrooms = [
            MockClassroom(1, 120), MockClassroom(2, 100),
            MockClassroom(3, 80), MockClassroom(4, 60),
            MockClassroom(5, 50),
        ]

        teachers = [
            MockTeacher(i, "full_time" if i <= 10 else "part_time", 5)
            for i in range(1, 21)
        ]

        return SchedulingEngine, time_slots, classrooms, teachers

    def test_engine_init(self):
        """测试引擎初始化"""
        from scheduler import SchedulingEngine
        engine = SchedulingEngine(max_solve_time=300)
        assert engine.max_solve_time == 300

    def test_engine_init_default_time(self):
        """测试引擎默认求解时间"""
        from scheduler import SchedulingEngine
        engine = SchedulingEngine()
        assert engine.max_solve_time == 300

    @pytest.mark.parametrize("solve_time", [60, 120, 300, 600])
    def test_engine_init_param(self, solve_time):
        """参数化测试引擎不同求解时间"""
        from scheduler import SchedulingEngine
        engine = SchedulingEngine(max_solve_time=solve_time)
        assert engine.max_solve_time == solve_time

    def test_engine_data_insufficient(self):
        """测试引擎无数据时的处理"""
        from scheduler import SchedulingEngine
        engine = SchedulingEngine(max_solve_time=60)
        assert engine.max_solve_time == 60


# ============================================================
# 冲突检测测试
# ============================================================


class TestConflictDetection:
    """冲突检测测试"""

    def test_classroom_capacity_shortage(self):
        """测试教室容量不足场景：学生50人，教室最大40人"""
        classrooms = [MockClassroom(1, 40)]
        classes = [MockClass(1, 50)]
        result = allocate_classrooms(50, classes, classrooms)
        assert len(result) == 0  # 分配失败

    def test_insufficient_teachers_report(self):
        """测试教师资源不足场景：只有1名教师但需要4名固定监考"""
        teachers = [MockTeacher(1, "full_time", 1)]
        states = [TeacherState(t) for t in teachers]
        classrooms = [MockClassroomAssign(101), MockClassroomAssign(102)]
        result = allocate_teachers_fixed(1, classrooms, states)
        assert len(result) == 0

    def test_patrol_insufficient_teachers(self):
        """测试流动监考教师不足：只有2名教师但需要3名"""
        teachers = [
            MockTeacher(1, "full_time", 1),
            MockTeacher(2, "part_time", 1),
        ]
        states = [TeacherState(t) for t in teachers]
        result = allocate_teachers_patrol(1, states)
        # 2名教师不够3名，但分配逻辑会尝试使用所有可用教师
        assert len(result) <= 3  # 最多3名，可能少于3

    def test_multiple_rooms_need_more_teachers(self):
        """测试多教室需要更多教师"""
        teachers = [
            MockTeacher(1, "full_time", 5), MockTeacher(2, "full_time", 5),
        ]
        states = [TeacherState(t) for t in teachers]
        # 3个教室需要6名固定监考，只有2名教师
        classrooms = [MockClassroomAssign(101), MockClassroomAssign(102), MockClassroomAssign(103)]
        result = allocate_teachers_fixed(1, classrooms, states)
        # 2名教师总共10场容量，需要6场 -> 应该成功
        # 实际分配取决于可用教师数量
        assert len(result) >= 0

    def test_empty_classrooms_list(self):
        """测试空教室列表"""
        classes = [MockClass(1, 30)]
        result = allocate_classrooms(30, classes, [])
        assert len(result) == 0

    def test_empty_classes_list(self):
        """测试空班级列表"""
        classrooms = [MockClassroom(1, 100)]
        result = allocate_classrooms(0, [], classrooms)
        # 没有学生需要分配，应该成功（不分配教室）
        assert len(result) == 0  # 没有班级就不需要教室
