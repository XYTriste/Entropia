"""
教师分配算法

功能：为考试分配监考教师，包括固定监考和流动监考。

规则：
- 固定监考：每个考场默认需要2名固定监考
  - 优先使用专任教师（未达上限的）
  - 专任教师用尽后使用兼职教师
- 流动监考：每个上下午场次对需要2名流动监考
  - 优先从兼职教师抽取
  - 兼职不足时从专任教师补充
- 连续场次优化：同一教师优先安排连续时段

硬约束：
- HC-05: 每位教师的监考总场次（固定+流动）不得超过其个人上限 max_slots
- HC-06: 每个上下午场次对(slot_pair)必须恰好安排 patrol_count 名流动监考教师
  同一场次对内的两个时段（如T1/T2 或 T3/T4）共享同一组流动监考。
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
    patrol_group_name: str | None = None  # 流动监考分组名称


@dataclass
class TeacherState:
    """
    教师状态追踪器
    用于在分配过程中动态追踪每位教师的已分配场次和监考日期。
    """
    teacher: Teacher
    assigned_slots: int = 0  # 已分配场次
    assigned_days: set[int] = field(default_factory=set)  # 已分配的监考日期集合 (day_of_week)

    @property
    def remaining(self) -> int:
        """剩余可分配场次"""
        return self.teacher.max_slots - self.assigned_slots

    @property
    def is_full(self) -> bool:
        """是否已达场次上限"""
        return self.assigned_slots >= self.teacher.max_slots

    def assign(self, count: int = 1, day: int | None = None) -> bool:
        """
        分配场次，返回是否成功。
        严格遵循HC-05：不超过max_slots。

        参数:
            count: 分配场次数
            day: 该场次对应的星期几（day_of_week），用于追踪监考日期
        """
        if self.assigned_slots + count > self.teacher.max_slots:
            return False
        self.assigned_slots += count
        if day is not None:
            self.assigned_days.add(day)
        return True

    def days_count(self) -> int:
        """当前已监考的天数"""
        return len(self.assigned_days)

    def would_exceed_max_days(self, new_day: int, max_days: int) -> bool:
        """
        判断如果加入 new_day 后，是否会超过最大监考天数限制。
        即：如果 new_day 不在已有日期集合中，且 len(assigned_days) + 1 > max_days，则超过。
        """
        if new_day in self.assigned_days:
            return False
        return len(self.assigned_days) + 1 > max_days

    def day_continuity_score(self, new_day: int | None = None) -> float:
        """
        计算当前监考日期的连续性得分。

        评分规则：
        - 连续天数越多分数越高
        - 最大间隔越大分数越低（越不连续）
        - 若 new_day 不为 None，模拟加入新天后的连续性评分

        返回:
            连续性得分，越高表示越连续（越优）
        """
        days = set(self.assigned_days)
        if new_day is not None:
            days = days | {new_day}

        if len(days) <= 1:
            return float(len(days))  # 1天=1分，完全连续

        sorted_days = sorted(days)
        num_days = len(sorted_days)
        num_consecutive_pairs = 0
        max_gap = 0

        # 统计连续对
        for i in range(len(sorted_days) - 1):
            if sorted_days[i + 1] - sorted_days[i] == 1:
                num_consecutive_pairs += 1

        # 统计最大间隔（跳过的天数）
        for i in range(len(sorted_days) - 1):
            gap = sorted_days[i + 1] - sorted_days[i] - 1  # 跳过多少天
            if gap > 0:
                max_gap = max(max_gap, gap)

        # 得分 = 连续对数量 - 最大间隔 * 2
        # 连续对越多越好，间隔越大越差
        score = num_consecutive_pairs - max_gap * 2.0
        return score


def _build_teacher_states(teachers: list) -> list[TeacherState]:
    """构建教师状态列表"""
    return [TeacherState(t) for t in teachers]


def _get_available_by_priority(
    states: list[TeacherState],
    priority_type: str,  # "full_time" | "part_time" | "any"
    need: int,
    candidate_day: int | None = None,
    max_days: int | None = None,
    prefer_continuous: bool = False,
) -> list[TeacherState]:
    """
    按优先级获取可用教师，同时考虑最大天数约束和日期连续性约束。

    参数:
        states: 教师状态列表
        priority_type: 优先类型
        need: 需要的人数
        candidate_day: 候选日期（day_of_week），用于评估约束
        max_days: 最大监考天数上限（仅当 enable_max_days_constraint=True 时生效）
        prefer_continuous: 是否优先选择连续性更好的教师（仅当 enable_day_continuity_constraint=True 时生效）

    返回:
        可用教师状态列表，按优先级排序
    """
    available: list[TeacherState] = []

    def _score(state: TeacherState) -> tuple:
        """
        计算教师优先级评分，返回 (主要分数, 连续性分数)。
        主要分数越低越优先（先排满的人靠后），连续性分数越高越优先。
        """
        primary = state.assigned_slots  # 已分配场次越多越靠后（负载均衡）

        # 约束A：超过最大天数 → 大幅降分（但不禁用，因为是软约束）
        if max_days is not None and state.would_exceed_max_days(candidate_day, max_days):
            primary += 1000  # 惩罚项：超过天数的教师优先级大幅降低

        # 约束B：日期连续性
        continuity_score = 0.0
        if prefer_continuous and candidate_day is not None:
            continuity_score = state.day_continuity_score(candidate_day)
            # 连续性分数越低越靠后
            continuity_score = -continuity_score  # 转为越小越优先

        return (primary, continuity_score)

    if priority_type == "full_time":
        # 优先专任教师，再兼职教师
        full = [s for s in states if s.teacher.teacher_type == "full_time" and not s.is_full]
        part = [s for s in states if s.teacher.teacher_type == "part_time" and not s.is_full]
        full.sort(key=_score)
        part.sort(key=_score)
        available = full + part
    elif priority_type == "part_time":
        # 优先兼职教师，再专任教师
        part = [s for s in states if s.teacher.teacher_type == "part_time" and not s.is_full]
        full = [s for s in states if s.teacher.teacher_type == "full_time" and not s.is_full]
        part.sort(key=_score)
        full.sort(key=_score)
        available = part + full
    else:
        available = [s for s in states if not s.is_full]
        available.sort(key=_score)

    return available[:need]


def _match_patrol_group(name: str, pattern: str) -> bool:
    if pattern.endswith("*"):
        return name.startswith(pattern[:-1])
    return name == pattern


def allocate_teachers_fixed(
    exam_id: int,
    classrooms: list,  # ClassroomAssignment列表
    teacher_states: list[TeacherState],
    teachers_per_room: int = 2,
    exam_day: int | None = None,
    enable_max_days_constraint: bool = False,
    max_days: int | None = None,
    enable_day_continuity_constraint: bool = False,
) -> list[TeacherAssignment]:
    """
    为固定监考分配教师。

    参数:
        exam_id: 考试ID
        classrooms: 教室分配结果列表（每个教室需要 teachers_per_room 名固定监考）
        teacher_states: 教师状态列表（会被修改，记录已分配场次）
        teachers_per_room: 每教室固定监考人数
        exam_day: 考试日期（day_of_week），用于约束A和约束B评估
        enable_max_days_constraint: 是否启用最大监考天数约束
        max_days: 最大监考天数上限
        enable_day_continuity_constraint: 是否启用日期连续性约束

    返回:
        TeacherAssignment列表（即使教师不足，也尽力分配至少1人/考场）

    规则:
        - 资源充足时每考场 teachers_per_room 名，紧张时每考场至少1名
        - 优先专任教师（SC-03软约束）
        - HC-05: 不超过教师上限
        - 约束A: 尽量不超过最大监考天数（通过优先级调整）
        - 约束B: 尽量保持日期连续性（通过优先级调整）
    """
    assignments: list[TeacherAssignment] = []
    if not classrooms:
        return assignments

    total_needed = len(classrooms) * teachers_per_room
    total_available = sum(s.remaining for s in teacher_states)
    # 若全局总可用量不足标准需求，统一降为1人/考场，确保公平
    per_room = 1 if total_available < total_needed else teachers_per_room

    for classroom in classrooms:
        room_id: int = classroom.classroom_id
        needed: int = per_room

        candidates = _get_available_by_priority(
            teacher_states, "full_time", needed,
            candidate_day=exam_day,
            max_days=max_days if enable_max_days_constraint else None,
            prefer_continuous=enable_day_continuity_constraint,
        )

        for _ in range(needed):
            assigned: bool = False
            for state in list(candidates):
                if state.assign(1, day=exam_day):
                    assignments.append(TeacherAssignment(
                        teacher_id=state.teacher.id,
                        teacher_name=state.teacher.name,
                        role="fixed",
                        classroom_id=room_id,
                    ))
                    assigned = True
                    candidates.remove(state)
                    break
                else:
                    candidates.remove(state)

            if not assigned:
                fallback = _get_available_by_priority(
                    teacher_states, "any", 1,
                    candidate_day=exam_day,
                    max_days=max_days if enable_max_days_constraint else None,
                    prefer_continuous=enable_day_continuity_constraint,
                )
                for state in list(fallback):
                    if state.assign(1, day=exam_day):
                        assignments.append(TeacherAssignment(
                            teacher_id=state.teacher.id,
                            teacher_name=state.teacher.name,
                            role="fixed",
                            classroom_id=room_id,
                        ))
                        assigned = True
                        break

            # 若完全无法分配，跳过该考场（后续生成警告）
            if not assigned:
                break

    return assignments


def allocate_teachers_patrol(
    time_slot_id: int,
    slot_pair: int,  # 1 for 上午(T1/T2), 2 for 下午(T3/T4)
    day_of_week: int,
    teacher_states: list[TeacherState],
    existing_assignments: list[TeacherAssignment] | None = None,
    patrol_count: int = 2,
    group_rules: list[dict] | None = None,
    used_slot_pairs: set[tuple[int, int]] | None = None,
    classrooms_in_slot: list | None = None,
    enable_max_days_constraint: bool = False,
    max_days: int | None = None,
    enable_day_continuity_constraint: bool = False,
) -> list[TeacherAssignment]:
    """
    为流动监考分配教师。

    参数:
        time_slot_id: 时段ID
        slot_pair: 场次对，1=上午(T1/T2)，2=下午(T3/T4)
        day_of_week: 星期几
        teacher_states: 教师状态列表（会被修改）
        existing_assignments: 该时段已有的教师分配（用于避免重复）
        patrol_count: 需要的流动监考人数（默认2）
        group_rules: 分组规则列表
        used_slot_pairs: 已分配过的(day_of_week, slot_pair)集合
        classrooms_in_slot: 该时段使用的教室列表
        enable_max_days_constraint: 是否启用最大监考天数约束
        max_days: 最大监考天数上限
        enable_day_continuity_constraint: 是否启用日期连续性约束

    返回:
        TeacherAssignment列表，尽量 patrol_count 名流动监考，不足时尽力分配

    规则:
        - HC-06: 每个上下午场次对尽量 patrol_count 名流动监考
        - 优先兼职教师（SC-04软约束）
        - HC-05: 不超过教师上限
        - 约束A: 尽量不超过最大监考天数（通过优先级调整）
        - 约束B: 尽量保持日期连续性（通过优先级调整）
    """
    if used_slot_pairs is None:
        used_slot_pairs = set()

    if (day_of_week, slot_pair) in used_slot_pairs:
        return []
    used_slot_pairs.add((day_of_week, slot_pair))

    assignments: list[TeacherAssignment] = []
    needed: int = patrol_count

    used_ids: set[int] = set()
    if existing_assignments:
        used_ids = {a.teacher_id for a in existing_assignments}

    candidates = _get_available_by_priority(
        teacher_states, "part_time", needed,
        candidate_day=day_of_week,
        max_days=max_days if enable_max_days_constraint else None,
        prefer_continuous=enable_day_continuity_constraint,
    )

    for _ in range(needed):
        assigned: bool = False

        for state in list(candidates):
            if state.teacher.id in used_ids:
                continue
            if state.assign(1, day=day_of_week):
                assignments.append(TeacherAssignment(
                    teacher_id=state.teacher.id,
                    teacher_name=state.teacher.name,
                    role="patrol",
                    classroom_id=None,
                    patrol_group_name=None,
                ))
                used_ids.add(state.teacher.id)
                assigned = True
                break

        if not assigned:
            fallback = _get_available_by_priority(
                teacher_states, "any", needed,
                candidate_day=day_of_week,
                max_days=max_days if enable_max_days_constraint else None,
                prefer_continuous=enable_day_continuity_constraint,
            )
            for state in fallback:
                if state.teacher.id in used_ids:
                    continue
                if state.assign(1, day=day_of_week):
                    assignments.append(TeacherAssignment(
                        teacher_id=state.teacher.id,
                        teacher_name=state.teacher.name,
                        role="patrol",
                        classroom_id=None,
                        patrol_group_name=None,
                    ))
                    used_ids.add(state.teacher.id)
                    assigned = True
                    break

        if not assigned:
            # 无法继续分配，返回已分配的教师
            break

    # 确定活跃分组并按轮询分配
    active_group_names: list[str] = []
    if group_rules and classrooms_in_slot:
        for rule in group_rules:
            matched = False
            for classroom in classrooms_in_slot:
                classroom_name = getattr(classroom, "name", None) or getattr(classroom, "classroom_name", None) or ""
                if any(_match_patrol_group(classroom_name, p) for p in rule.get("patterns", [])):
                    matched = True
                    break
            if matched:
                active_group_names.append(rule["group_name"])

    for i, assignment in enumerate(assignments):
        if active_group_names:
            assignment.patrol_group_name = active_group_names[i % len(active_group_names)]
        else:
            assignment.patrol_group_name = None

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
        def __init__(self, classroom_id: int, capacity: int = 100, name: str = "") -> None:
            self.classroom_id = classroom_id
            self.capacity = capacity
            self.name = name

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
            used = set()
            result = allocate_teachers_patrol(1, 1, 1, states, used_slot_pairs=used)

            # HC-06: 恰好2名流动监考（默认）
            self.assertEqual(len(result), 2)
            # 优先兼职教师
            patrol_types = []
            for r in result:
                t = next(s for s in states if s.teacher.id == r.teacher_id)
                patrol_types.append(t.teacher.teacher_type)
            # 至少应有兼职教师优先
            self.assertIn("part_time", patrol_types)

        def test_patrol_slot_pair_dedup(self):
            """测试同一场次对只分配一次流动监考"""
            teachers = [
                MockTeacher(1, "part_time", 5),
                MockTeacher(2, "part_time", 5),
            ]
            states = _build_teacher_states(teachers)
            used = set()
            result1 = allocate_teachers_patrol(1, 1, 1, states, used_slot_pairs=used)
            result2 = allocate_teachers_patrol(2, 1, 1, states, used_slot_pairs=used)

            self.assertEqual(len(result1), 2)
            self.assertEqual(len(result2), 0)  # 同一场次对已分配

        def test_patrol_group_names(self):
            """测试流动监考分组名称分配"""
            teachers = [
                MockTeacher(1, "part_time", 5),
                MockTeacher(2, "part_time", 5),
                MockTeacher(3, "part_time", 5),
            ]
            states = _build_teacher_states(teachers)
            classrooms = [
                MockClassroomAssign(101, name="5-201"),
                MockClassroomAssign(102, name="理东二101"),
            ]
            group_rules = [
                {"group_name": "5-2及理东二", "patterns": ["5-2*", "理东二"]},
                {"group_name": "5-3", "patterns": ["5-3*"]},
            ]
            used = set()
            result = allocate_teachers_patrol(
                1, 1, 1, states,
                used_slot_pairs=used,
                classrooms_in_slot=classrooms,
                group_rules=group_rules,
                patrol_count=3,
            )

            self.assertEqual(len(result), 3)
            # 只有 "5-2及理东二" 分组匹配
            group_names = [r.patrol_group_name for r in result]
            self.assertIn("5-2及理东二", group_names)
            # 轮询分配：3个教师都应分配到该分组（唯一活跃分组）
            self.assertEqual(group_names, ["5-2及理东二", "5-2及理东二", "5-2及理东二"])

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
            classrooms = [MockClassroomAssign(101)]  # 需要2人，但只有1人可用
            result = allocate_teachers_fixed(1, classrooms, states)
            # 资源不足时降为1人/考场，所以能分配1人
            self.assertEqual(len(result), 1)

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
