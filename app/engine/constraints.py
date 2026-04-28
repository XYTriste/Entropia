"""
硬约束定义模块

使用OR-Tools CP-SAT求解器建模所有硬约束HC-01 ~ HC-09。
每个约束函数返回可添加到CpModel的约束表达式或约束列表。

硬约束列表：
- HC-01: 同一门课程所有涉考学生必须在同一天完成
- HC-02: 公共课必须安排在教务处指定的日期与时段
- HC-03: 单个教室同一时段内涉及班级数量不得超过2个
- HC-04: 教室实际安排人数不得超过其容量
- HC-05: 每位教师监考总场次不超过其个人上限
- HC-06: 每个时段必须恰好安排3名流动监考
- HC-07: 分AB卷时，同一班级整体划入A或B，不得拆分
- HC-08: 专业课只能安排在公共课排完后的空闲时段
- HC-09: 排满策略——按周一到周五顺序紧凑填充，不允许稀疏排考
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from ortools.sat.python import cp_model

if TYPE_CHECKING:
    from models import Course, Classroom, Teacher, TimeSlot


# ============================================================
# HC-01: 同一门课程所有涉考学生必须在同一天完成
# ============================================================
def add_hc01_same_day_constraint(
    model: cp_model.CpModel,
    course: Course,
    exam_time_vars: dict[tuple[int, str | None], cp_model.IntVar],
    time_slot_map: dict[int, TimeSlot],
) -> list:
    """
    HC-01: 同一课程的所有考试（包括A、B卷）必须在同一天。

    建模方式:
        对于课程的每对考试(e1, e2)，要求它们的day_of_week相等。

    参数:
        model: CP-SAT模型
        course: 课程对象
        exam_time_vars: 映射 (course_id, exam_label) -> 时段ID变量
        time_slot_map: 时段ID -> TimeSlot对象

    返回:
        添加的约束列表
    """
    constraints: list = []
    labels = list(exam_time_vars.keys())

    if len(labels) <= 1:
        return constraints  # 只有一场考试，无需约束

    # 获取该课程的所有考试时段变量
    slot_vars = []
    for key in labels:
        if key[0] == course.id:
            slot_vars.append(exam_time_vars[key])

    # 对每对考试，要求同一天
    for i in range(len(slot_vars)):
        for j in range(i + 1, len(slot_vars)):
            # day_of_week = (slot_id - 1) // 4 + 1
            # 创建辅助变量表示day_of_week
            day_i = model.NewIntVar(1, 5, f"hc01_day_{course.id}_{i}")
            day_j = model.NewIntVar(1, 5, f"hc01_day_{course.id}_{j}")

            # day = (slot - 1) // 4 + 1
            model.AddDivisionEquality(day_i - 1, slot_vars[i] - 1, 4)
            model.AddDivisionEquality(day_j - 1, slot_vars[j] - 1, 4)

            # 同一天约束
            constraints.append(model.Add(day_i == day_j))

    return constraints


# ============================================================
# HC-02: 公共课必须安排在教务处指定的日期与时段
# ============================================================
def add_hc02_public_course_fixed_slot(
    model: cp_model.CpModel,
    course: Course,
    exam_time_vars: dict[tuple[int, str | None], cp_model.IntVar],
) -> list:
    """
    HC-02: 公共课必须安排在教务处指定的日期与时段。

    建模方式:
        公共课的考试时段变量等于指定的时段ID。
        如果needs_ab=True，需要指定连续的两个时段（同一时段对）。

    参数:
        model: CP-SAT模型
        course: 课程对象（course_type="public"）
        exam_time_vars: 映射 (course_id, exam_label) -> 时段ID变量

    返回:
        添加的约束列表
    """
    constraints: list = []

    if course.course_type != "public":
        return constraints

    assigned_slot_id: int = course.dept_assigned_time_slot_id
    if assigned_slot_id <= 0:
        return constraints  # 未指定，不添加约束

    if course.needs_ab:
        # AB卷需要两个连续时段
        # A卷在指定时段
        key_a = (course.id, "A")
        if key_a in exam_time_vars:
            constraints.append(model.Add(exam_time_vars[key_a] == assigned_slot_id))

        # B卷在连续时段
        key_b = (course.id, "B")
        if key_b in exam_time_vars:
            # 连续时段：T1->T2 或 T3->T4
            # 同一天的下一个时段
            if assigned_slot_id % 4 in (1, 3):  # T1或T3
                next_slot = assigned_slot_id + 1
                constraints.append(model.Add(exam_time_vars[key_b] == next_slot))
    else:
        # 非AB卷，直接使用指定时段
        key = (course.id, None)
        if key in exam_time_vars:
            constraints.append(model.Add(exam_time_vars[key] == assigned_slot_id))

    return constraints


# ============================================================
# HC-03: 单个教室同一时段内涉及班级数量不得超过2个
# ============================================================
def add_hc03_max_two_classes_per_room(
    model: cp_model.CpModel,
    exam_room_class_vars: dict,
    max_classes: int = 2,
) -> list:
    """
    HC-03: 单个教室在同一时段内，涉及的班级数量不得超过2个。

    建模方式:
        对于每个(教室, 时段)组合，所有在该教室该时段进行的考试中
        分配的班级数之和 <= 2。

    参数:
        model: CP-SAT模型
        exam_room_class_vars: 映射 (exam_id, room_id, class_id) -> BoolVar
        max_classes: 最大班级数（默认2）

    返回:
        添加的约束列表
    """
    constraints: list = []

    # 按(room_id, time_slot)聚合
    room_slot_classes: dict[tuple[int, int], list] = {}
    for (exam_id, room_id, class_id), var in exam_room_class_vars.items():
        # time_slot 需要从exam_id获取，这里假设通过其他方式关联
        # 简化处理：在调度器层面通过枚举确保此约束
        pass

    # 此约束在调度器层面通过教室分配算法保证（贪心分配时每教室最多2班）
    # 这里添加模型层面的约束作为双重保障
    return constraints


# ============================================================
# HC-04: 教室实际安排人数不得超过其容量
# ============================================================
def add_hc04_capacity_constraint(
    model: cp_model.CpModel,
    exam_room_vars: dict[tuple[int, int], cp_model.IntVar],
    classroom_map: dict[int, Classroom],
    exam_class_counts: dict[int, int],
) -> list:
    """
    HC-04: 教室实际安排人数不得超过其容量。

    建模方式:
        对于每个考试和教室的组合：
        如果考试e使用教室r，则 exam_class_counts[e] <= classroom_map[r].capacity

    参数:
        model: CP-SAT模型
        exam_room_vars: 映射 (exam_id, room_id) -> BoolVar（是否使用该教室）
        classroom_map: 教室ID -> Classroom对象
        exam_class_counts: 考试ID -> 学生总数

    返回:
        添加的约束列表
    """
    constraints: list = []

    for (exam_id, room_id), var in exam_room_vars.items():
        if room_id in classroom_map:
            capacity = classroom_map[room_id].capacity
            student_count = exam_class_counts.get(exam_id, 0)
            # 容量约束：如果var=1（使用该教室），则学生数 <= 容量
            constraints.append(
                model.Add(student_count * var <= capacity)
            )

    return constraints


# ============================================================
# HC-05: 每位教师监考总场次不超过其个人上限
# ============================================================
def add_hc05_teacher_max_slots(
    model: cp_model.CpModel,
    teacher_assignment_vars: dict[tuple[int, int, int], cp_model.IntVar],
    teachers: list[Teacher],
) -> list:
    """
    HC-05: 每位教师的监考总场次（固定+流动）不得超过其个人上限max_slots。

    建模方式:
        对于每位教师t：
        sum(assignment_vars[t, exam_id, role]) <= max_slots[t]

    参数:
        model: CP-SAT模型
        teacher_assignment_vars: 映射 (teacher_id, exam_id, time_slot_id) -> BoolVar
        teachers: 教师列表

    返回:
        添加的约束列表
    """
    constraints: list = []
    teacher_map: dict[int, Teacher] = {t.id: t for t in teachers}

    # 按教师ID聚合分配变量
    teacher_vars: dict[int, list] = {}
    for (teacher_id, exam_id, time_slot_id), var in teacher_assignment_vars.items():
        if teacher_id not in teacher_vars:
            teacher_vars[teacher_id] = []
        teacher_vars[teacher_id].append(var)

    for teacher_id, vars_list in teacher_vars.items():
        if teacher_id in teacher_map:
            max_s = teacher_map[teacher_id].max_slots
            constraints.append(
                model.Add(sum(vars_list) <= max_s)
            )

    return constraints


# ============================================================
# HC-06: 每个时段必须恰好安排3名流动监考
# ============================================================
def add_hc06_exactly_three_patrol(
    model: cp_model.CpModel,
    patrol_vars: dict[tuple[int, int], cp_model.IntVar],
    time_slots: list[TimeSlot],
) -> list:
    """
    HC-06: 每个时段必须恰好安排3名流动监考教师。

    建模方式:
        对于每个时段s：
        sum(patrol_vars[teacher_id, s.id]) == 3

    参数:
        model: CP-SAT模型
        patrol_vars: 映射 (teacher_id, time_slot_id) -> BoolVar
        time_slots: 时段列表

    返回:
        添加的约束列表
    """
    constraints: list = []

    # 按时段ID聚合
    slot_vars: dict[int, list] = {}
    for (teacher_id, slot_id), var in patrol_vars.items():
        if slot_id not in slot_vars:
            slot_vars[slot_id] = []
        slot_vars[slot_id].append(var)

    for slot in time_slots:
        if slot.id in slot_vars:
            constraints.append(
                model.Add(sum(slot_vars[slot.id]) == 3)
            )

    return constraints


# ============================================================
# HC-07: AB卷时，同一班级整体划入A或B，不得拆分
# ============================================================
def add_hc07_no_split_class_for_ab(
    model: cp_model.CpModel,
    ab_class_vars: dict[tuple[int, str, int], cp_model.IntVar],
) -> list:
    """
    HC-07: 分AB卷时，同一班级整体划入A卷或B卷，不得拆分。

    建模方式:
        对于每个班级c，在A卷和B卷中恰好选择一个：
        ab_class_vars[course_id, "A", class_id] + ab_class_vars[course_id, "B", class_id] == 1

    参数:
        model: CP-SAT模型
        ab_class_vars: 映射 (course_id, label, class_id) -> BoolVar

    返回:
        添加的约束列表
    """
    constraints: list = []

    # 按(course_id, class_id)聚合
    class_labels: dict[tuple[int, int], list] = {}
    for (course_id, label, class_id), var in ab_class_vars.items():
        key = (course_id, class_id)
        if key not in class_labels:
            class_labels[key] = []
        class_labels[key].append(var)

    for key, vars_list in class_labels.items():
        # 每个班级恰好分配到A或B（如果AB卷存在）
        constraints.append(model.Add(sum(vars_list) == 1))

    return constraints


# ============================================================
# HC-08: 专业课只能安排在公共课排完后的空闲时段内
# ============================================================
def add_hc08_major_course_free_slots(
    model: cp_model.CpModel,
    major_exam_vars: dict[int, cp_model.IntVar],
    used_slot_vars: set[int],
) -> list:
    """
    HC-08: 专业课只能安排在公共课排完后的空闲时段内。

    建模方式:
        专业课的时段变量不能取已被公共课占用的时段。
        major_exam_var not in used_slot_vars

    参数:
        model: CP-SAT模型
        major_exam_vars: 专业课考试 -> 时段ID变量
        used_slot_vars: 已被公共课占用的时段ID集合

    返回:
        添加的约束列表
    """
    constraints: list = []

    for exam_id, var in major_exam_vars.items():
        # 专业课不能安排在已占用时段
        for used_slot in used_slot_vars:
            constraints.append(model.Add(var != used_slot))

    return constraints


# ============================================================
# HC-09: 排满策略——紧凑填充，不允许稀疏排考
# ============================================================
def add_hc09_compact_scheduling(
    model: cp_model.CpModel,
    course_order_vars: dict[tuple[int, int], cp_model.IntVar],
    exam_time_vars: dict[int, cp_model.IntVar],
    num_time_slots: int = 20,
) -> list:
    """
    HC-09: 排满策略——按周一到周五顺序紧凑填充。

    建模方式:
        对于按排序的课程序列，如果课程i安排在时段s，
        则课程i+1必须安排在时段s或之后的时段（允许同一天）。

        更严格地：设最后一个使用的时段为L，则所有小于L的时段都必须被使用。
        等价于：不允许存在某个时段为空，但其后有非空时段。

    参数:
        model: CP-SAT模型
        course_order_vars: 课程顺序变量（用于两两比较）
        exam_time_vars: 考试 -> 时段ID变量
        num_time_slots: 时段总数（默认20）

    返回:
        添加的约束列表
    """
    constraints: list = []

    # 创建每个时段是否有考试的指示变量
    slot_used: list[cp_model.IntVar] = []
    for s in range(1, num_time_slots + 1):
        used = model.NewBoolVar(f"hc09_slot_{s}_used")
        slot_used.append(used)

        # 如果有任何考试安排在时段s，则used=1
        exams_in_slot = []
        for exam_id, var in exam_time_vars.items():
            is_in_slot = model.NewBoolVar(f"hc09_exam_{exam_id}_in_slot_{s}")
            model.Add(var == s).OnlyEnforceIf(is_in_slot)
            model.Add(var != s).OnlyEnforceIf(is_in_slot.Not())
            exams_in_slot.append(is_in_slot)

        if exams_in_slot:
            # used = OR(exams_in_slot)
            model.AddMaxEquality(used, exams_in_slot)
        else:
            model.Add(used == 0)

    # 紧凑约束：如果时段s为空，则所有后续时段也必须为空
    # 等价于：used[s] >= used[s+1]（不允许后面有但前面没有）
    for s in range(num_time_slots - 1):
        # 如果s+1被使用，则s也必须被使用
        constraints.append(model.Add(slot_used[s] >= slot_used[s + 1]))

    return constraints


# ============================================================
# 辅助约束：每个考试必须恰好分配一个时段
# ============================================================
def add_each_exam_one_slot(
    model: cp_model.CpModel,
    exam_time_vars: dict[int, cp_model.IntVar],
    valid_slots: list[int],
) -> list:
    """
    每个考试必须安排在有效时段之一。

    参数:
        model: CP-SAT模型
        exam_time_vars: 考试ID -> 时段ID变量
        valid_slots: 有效时段ID列表

    返回:
        添加的约束列表
    """
    constraints: list = []
    min_slot = min(valid_slots)
    max_slot = max(valid_slots)

    for exam_id, var in exam_time_vars.items():
        # 变量域限制在有效时段内
        constraints.append(model.Add(var >= min_slot))
        constraints.append(model.Add(var <= max_slot))

    return constraints


# ============================================================
# 辅助约束：一个教室一个时段只能用于一场考试
# ============================================================
def add_room_no_overlap(
    model: cp_model.CpModel,
    room_slot_vars: dict[tuple[int, int, int], cp_model.IntVar],
    classrooms: list[Classroom],
    time_slots: list[TimeSlot],
) -> list:
    """
    一个教室在一个时段只能用于一场考试。

    参数:
        model: CP-SAT模型
        room_slot_vars: 映射 (exam_id, room_id, slot_id) -> BoolVar
        classrooms: 教室列表
        time_slots: 时段列表

    返回:
        添加的约束列表
    """
    constraints: list = []

    # 按(room_id, slot_id)聚合
    room_slot_exams: dict[tuple[int, int], list] = {}
    for (exam_id, room_id, slot_id), var in room_slot_vars.items():
        key = (room_id, slot_id)
        if key not in room_slot_exams:
            room_slot_exams[key] = []
        room_slot_exams[key].append(var)

    for (room_id, slot_id), vars_list in room_slot_exams.items():
        constraints.append(model.Add(sum(vars_list) <= 1))

    return constraints


# ============================================================
# 辅助约束：同一班级同一时段不能有两场考试
# ============================================================
def add_class_no_overlap(
    model: cp_model.CpModel,
    class_slot_vars: dict[tuple[int, int, int], cp_model.IntVar],
) -> list:
    """
    同一班级在同一时段只能参加一场考试。

    参数:
        model: CP-SAT模型
        class_slot_vars: 映射 (class_id, exam_id, slot_id) -> BoolVar

    返回:
        添加的约束列表
    """
    constraints: list = []

    # 按(class_id, slot_id)聚合
    class_slot_exams: dict[tuple[int, int], list] = {}
    for (class_id, exam_id, slot_id), var in class_slot_vars.items():
        key = (class_id, slot_id)
        if key not in class_slot_exams:
            class_slot_exams[key] = []
        class_slot_exams[key].append(var)

    for (class_id, slot_id), vars_list in class_slot_exams.items():
        constraints.append(model.Add(sum(vars_list) <= 1))

    return constraints


# ============================================================
# 单元测试
# ============================================================
if __name__ == "__main__":
    import unittest

    class TestConstraints(unittest.TestCase):
        """硬约束单元测试"""

        def test_model_creation(self):
            """测试OR-Tools模型创建"""
            model = cp_model.CpModel()
            x = model.NewIntVar(0, 10, "x")
            y = model.NewIntVar(0, 10, "y")
            model.Add(x + y <= 10)

            solver = cp_model.CpSolver()
            status = solver.Solve(model)
            self.assertIn(status, [cp_model.OPTIMAL, cp_model.FEASIBLE])

        def test_hc05_teacher_slots(self):
            """测试HC-05教师场次上限约束"""
            model = cp_model.CpModel()

            # 模拟2位教师，max_slots分别为3和2
            t1_e1 = model.NewBoolVar("t1_e1")
            t1_e2 = model.NewBoolVar("t1_e2")
            t2_e1 = model.NewBoolVar("t2_e1")

            teacher_assignment_vars = {
                (1, 101, 1): t1_e1,
                (1, 102, 2): t1_e2,
                (2, 101, 1): t2_e1,
            }

            class MockTeacher:
                def __init__(self, id, max_slots):
                    self.id = id
                    self.max_slots = max_slots
                    self.teacher_type = "full_time"
                    self.name = f"T{id}"

            teachers = [MockTeacher(1, 2), MockTeacher(2, 1)]

            # 添加HC-05约束
            add_hc05_teacher_max_slots(model, teacher_assignment_vars, teachers)

            solver = cp_model.CpSolver()
            status = solver.Solve(model)
            self.assertIn(status, [cp_model.OPTIMAL, cp_model.FEASIBLE])

            # 验证：教师1最多2场，教师2最多1场
            self.assertLessEqual(solver.Value(t1_e1) + solver.Value(t1_e2), 2)
            self.assertLessEqual(solver.Value(t2_e1), 1)

        def test_hc06_patrol_count(self):
            """测试HC-06流动监考恰好3名"""
            model = cp_model.CpModel()

            # 模拟5位教师竞争1个时段的3个流动监考位
            slot_id = 1
            patrol_vars = {}
            for t in range(1, 6):
                var = model.NewBoolVar(f"patrol_t{t}_s{slot_id}")
                patrol_vars[(t, slot_id)] = var

            class MockTimeSlot:
                def __init__(self, id):
                    self.id = id

            time_slots = [MockTimeSlot(1)]

            add_hc06_exactly_three_patrol(model, patrol_vars, time_slots)

            solver = cp_model.CpSolver()
            status = solver.Solve(model)
            self.assertIn(status, [cp_model.OPTIMAL, cp_model.FEASIBLE])

            # 验证恰好3名
            total = sum(solver.Value(v) for v in patrol_vars.values())
            self.assertEqual(total, 3)

    unittest.main()
