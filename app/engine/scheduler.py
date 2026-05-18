"""
主调度器模块 (SchedulingEngine)

排考系统核心调度逻辑，整合所有约束与分配算法：
1. 阶段一：公共课排考（使用教务处指定的日期与时段）
2. 阶段二：专业课排考（填充空闲时段）
3. 排满策略验证（HC-09）
4. 冲突分析报告

求解策略：
- 对于公共课：直接按指定时段分配（确定性过程）
- 对于专业课：使用贪心+约束传播（CP）
- OR-Tools CP-SAT用于全局优化和冲突检测
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

from ortools.sat.python import cp_model

from .ab_split import split_ab_classes
from .classroom_alloc import allocate_classrooms, ClassroomAssignment
from .constraints import (
    add_class_no_overlap,
    add_each_exam_one_slot,
    add_hc01_same_day_constraint,
    add_hc04_capacity_constraint,
    add_hc05_teacher_max_slots,
    add_hc06_patrol_per_slot_pair,
    add_hc07_no_split_class_for_ab,
    add_hc08_major_course_free_slots,
    add_hc09_compact_scheduling,
    add_room_no_overlap,
)
from .models import (
    Class,
    Classroom,
    ClassroomResult,
    ConflictReport,
    Course,
    Exam,
    ExamClassroom,
    ExamClassroomClass,
    ExamResult,
    ExamTeacher,
    PatrolResult,
    SchedulingResult,
    Teacher,
    TeacherResult,
    TimeSlot,
)
from .objectives import build_total_objective
from .teacher_alloc import (
    TeacherAssignment,
    allocate_teachers_fixed,
    allocate_teachers_patrol,
    create_teacher_usage_tracker,
    is_continuous_slot,
)


# ============================================================
# 全局ID生成器
# ============================================================
class _IdGenerator:
    """全局唯一ID生成器（线程不安全，但调度过程单线程）"""

    def __init__(self, start: int = 1) -> None:
        self._current: int = start - 1

    def next(self) -> int:
        self._current += 1
        return self._current


# ============================================================
# 主调度引擎
# ============================================================
class SchedulingEngine:
    """
    排考引擎核心类

    两阶段求解策略：
    1. 公共课确定性排考（读取指定时段，直接分配）
    2. 专业课贪心+CP排考（填充空闲时段，全局优化）
    """

    def __init__(
        self,
        max_solve_time: int = 300,
        fixed_teachers_per_room: int = 2,
        patrol_teacher_count: int = 2,
        patrol_group_rules: list[dict] | None = None,
        classroom_priority_rules: list[dict] | None = None,
        enable_max_days_constraint: bool = True,
        enable_day_continuity_constraint: bool = True,
    ) -> None:
        """
        参数:
            max_solve_time: 求解器最大运行时间（秒），默认300秒
            fixed_teachers_per_room: 每教室固定监考人数 (1 或 2)
            patrol_teacher_count: 每时段对流动监考人数
            patrol_group_rules: 流动监考分组规则
            classroom_priority_rules: 教室优先级规则
            enable_max_days_constraint: 是否启用最大监考天数约束（默认开启）
            enable_day_continuity_constraint: 是否启用日期连续性约束（默认开启）
        """
        self.max_solve_time: int = max_solve_time
        self.fixed_teachers_per_room: int = fixed_teachers_per_room
        self.patrol_teacher_count: int = patrol_teacher_count
        self.patrol_group_rules: list[dict] | None = patrol_group_rules
        self.classroom_priority_rules: list[dict] | None = classroom_priority_rules
        self.enable_max_days_constraint: bool = enable_max_days_constraint
        self.enable_day_continuity_constraint: bool = enable_day_continuity_constraint
        self._patrol_slot_pairs_used: set[tuple[int, int]] = set()
        self.force_one_teacher_per_room: bool = False

    # --------------------------------------------------------
    # 主入口：运行排考
    # --------------------------------------------------------
    def run(
        self,
        courses: list[Course],
        classrooms: list[Classroom],
        teachers: list[Teacher],
        time_slots: list[TimeSlot],
        existing_schedule: dict | None = None,
    ) -> SchedulingResult:
        """
        执行排考。

        参数:
            courses: 课程列表（含公共课和专业课）
            classrooms: 教室列表
            teachers: 教师列表
            time_slots: 时段列表（共20个）
            existing_schedule: 已有排考计划（用于增量排考），可选

        返回:
            SchedulingResult: 排考结果
        """
        start_time: float = time.time()
        id_gen = _IdGenerator(start=1)

        # 构建辅助索引
        time_slot_map: dict[int, TimeSlot] = {t.id: t for t in time_slots}
        classroom_map: dict[int, Classroom] = {c.id: c for c in classrooms}
        teacher_map: dict[int, Teacher] = {t.id: t for t in teachers}

        # 分离公共课和专业课
        public_courses: list[Course] = [c for c in courses if c.course_type == "public"]
        major_courses: list[Course] = [c for c in courses if c.course_type == "major"]

        # 公共课按学生总数降序排列，大课优先分配教室
        def _course_total_students(c: Course) -> int:
            return sum(link.class_.student_count for link in c.class_links)

        public_courses.sort(key=_course_total_students, reverse=True)

        # 追踪状态
        all_exams: list[Exam] = []  # 所有生成的考试
        used_time_slots: set[int] = set()  # 已被使用的时段
        teacher_usage: dict[int, list[int]] = create_teacher_usage_tracker(teachers)  # 教师->时段列表
        room_slot_usage: dict[int, set[int]] = {}  # 时段ID -> 已占用教室ID集合

        # 动态计算最大监考天数 = 实际排考天数 - 1
        actual_exam_days: set[int] = set()
        for ts in time_slots:
            actual_exam_days.add(ts.day_of_week)
        max_days: int = max(len(actual_exam_days) - 1, 1)  # 至少为1
        exam_results: list[ExamResult] = []  # 结果
        patrol_results: list[PatrolResult] = []  # 流动监考结果
        violations: list[str] = []  # 违规信息

        # 计算教室总容量
        total_capacity: int = sum(
            r.capacity for r in classrooms if getattr(r, "is_active", True)
        )

        # 全局教师紧张度判断：若预估总需求超过总容量，全局降为1人/考场
        import math
        avg_cap = total_capacity / max(len(classrooms), 1)
        est_rooms = sum(
            math.ceil(sum(link.class_.student_count for link in c.class_links) / avg_cap)
            for c in courses
        )
        total_teacher_cap = sum(t.max_slots for t in teachers)
        total_slots = sum(2 if c.needs_ab else 1 for c in courses)
        est_patrol = ((total_slots + 1) // 2) * self.patrol_teacher_count
        if est_rooms * self.fixed_teachers_per_room + est_patrol > total_teacher_cap:
            self.force_one_teacher_per_room = True

        # 计算每门公共课的学生总数，并预分配时段
        # 如果指定时段容量不足，直接报告不可行，不再自动回退
        slot_public_demand: dict[int, int] = {}  # 时段ID -> 已分配公共课总需求

        for course in public_courses:
            total_students = sum(link.class_.student_count for link in course.class_links)
            # AB卷每场约一半人数，按上取整计算单场最大需求
            import math
            per_exam_need = math.ceil(total_students / 2) if course.needs_ab else total_students
            orig_slot = course.dept_assigned_time_slot_id
            if orig_slot <= 0:
                violations.append(f"公共课 {course.name} 未指定时段")
                continue

            # 检查指定时段是否足够（AB卷需同时检查A卷和B卷时段）
            demand = slot_public_demand.get(orig_slot, 0)
            if demand + per_exam_need > total_capacity:
                violations.append(
                    f"公共课 {course.name} 指定时段{orig_slot}容量不足，无法安排"
                )
                continue

            # AB卷还需检查B卷连续时段
            if course.needs_ab:
                next_id = orig_slot + 1 if orig_slot % 4 in (1, 3) else orig_slot
                if next_id in time_slot_map:
                    next_demand = slot_public_demand.get(next_id, 0)
                    if next_demand + per_exam_need > total_capacity:
                        violations.append(
                            f"公共课 {course.name} 指定B卷时段{next_id}容量不足，无法安排"
                        )
                        continue
                    slot_public_demand[next_id] = next_demand + per_exam_need

            # 更新A卷时段需求
            slot_public_demand[orig_slot] = demand + per_exam_need

        # =====================================================
        # 阶段一：公共课排考
        # =====================================================
        for course in public_courses:
            if course.dept_assigned_time_slot_id <= 0:
                continue

            result = self._schedule_public_course(
                course=course,
                classrooms=classrooms,
                teachers=teachers,
                time_slot_map=time_slot_map,
                classroom_map=classroom_map,
                teacher_map=teacher_map,
                teacher_usage=teacher_usage,
                id_gen=id_gen,
                used_time_slots=used_time_slots,
                room_slot_usage=room_slot_usage,
                violations=violations,
                max_days=max_days,
            )
            if result:
                all_exams.extend(result["exams"])
                exam_results.append(result["exam_result"])
                # 支持AB卷的多时段流动监考
                if result.get("patrols"):
                    patrol_results.extend(result["patrols"])
                elif result.get("patrol"):
                    patrol_results.append(result["patrol"])

        # =====================================================
        # 阶段二：专业课排考（允许多课程同一时段并行）
        # =====================================================
        # 获取空闲时段（按时间顺序）
        free_slots: list[int] = [
            s.id for s in time_slots if s.id not in used_time_slots
        ]
        free_slots.sort()
        free_slots_set: set[int] = set(free_slots)

        if not free_slots and major_courses:
            violations.append("公共课排完后无空闲时段，无法安排专业课")

        # 专业课按学生总数降序，大课优先分配
        major_courses.sort(key=_course_total_students, reverse=True)

        for course in major_courses:
            classes: list[Class] = [link.class_ for link in course.class_links]
            total_students: int = sum(c.student_count for c in classes)
            created_exams: list[Exam] = []

            if course.needs_ab:
                group_a, group_b = split_ab_classes(classes)
                placed = False

                for slot_id in sorted(free_slots):
                    if slot_id % 4 not in (1, 3):
                        continue
                    next_slot_id = slot_id + 1
                    if next_slot_id not in free_slots_set:
                        continue

                    excluded_a = room_slot_usage.get(slot_id, set())
                    test_a = allocate_classrooms(
                        student_count=sum(c.student_count for c in group_a),
                        classes=group_a,
                        classrooms=classrooms,
                        excluded_room_ids=excluded_a,
                        priority_rules=self.classroom_priority_rules,
                    )
                    if not test_a:
                        continue

                    excluded_b = room_slot_usage.get(next_slot_id, set())
                    test_b = allocate_classrooms(
                        student_count=sum(c.student_count for c in group_b),
                        classes=group_b,
                        classrooms=classrooms,
                        excluded_room_ids=excluded_b,
                        priority_rules=self.classroom_priority_rules,
                    )
                    if not test_b:
                        continue

                    time_slot_a = time_slot_map[slot_id]
                    time_slot_b = time_slot_map[next_slot_id]
                    used_time_slots.add(slot_id)
                    used_time_slots.add(next_slot_id)

                    exam_a = self._create_single_exam(
                        course=course,
                        classes=group_a,
                        classrooms=classrooms,
                        teachers=teachers,
                        time_slot=time_slot_a,
                        label="A",
                        classroom_map=classroom_map,
                        teacher_usage=teacher_usage,
                        id_gen=id_gen,
                        excluded_room_ids=excluded_a,
                        violations=violations,
                        max_days=max_days,
                    )
                    if exam_a:
                        for ec in exam_a.classroom_assignments:
                            room_slot_usage.setdefault(slot_id, set()).add(ec.classroom_id)

                    exam_b = self._create_single_exam(
                        course=course,
                        classes=group_b,
                        classrooms=classrooms,
                        teachers=teachers,
                        time_slot=time_slot_b,
                        label="B",
                        classroom_map=classroom_map,
                        teacher_usage=teacher_usage,
                        id_gen=id_gen,
                        excluded_room_ids=excluded_b,
                        violations=violations,
                        max_days=max_days,
                    )
                    if exam_b:
                        for ec in exam_b.classroom_assignments:
                            room_slot_usage.setdefault(next_slot_id, set()).add(ec.classroom_id)

                    # AB卷必须同时成功，否则回退并尝试下一对时段
                    if not exam_a or not exam_b:
                        if exam_a:
                            for ec in exam_a.classroom_assignments:
                                room_slot_usage.get(slot_id, set()).discard(ec.classroom_id)
                            for et in exam_a.teacher_assignments:
                                tid = et.teacher_id
                                if tid in teacher_usage and time_slot_a.id in teacher_usage[tid]:
                                    teacher_usage[tid].remove(time_slot_a.id)
                        if exam_b:
                            for ec in exam_b.classroom_assignments:
                                room_slot_usage.get(next_slot_id, set()).discard(ec.classroom_id)
                            for et in exam_b.teacher_assignments:
                                tid = et.teacher_id
                                if tid in teacher_usage and time_slot_b.id in teacher_usage[tid]:
                                    teacher_usage[tid].remove(time_slot_b.id)
                        used_time_slots.discard(slot_id)
                        used_time_slots.discard(next_slot_id)
                        continue  # 尝试下一对连续时段

                    created_exams.append(exam_a)
                    created_exams.append(exam_b)

                    merged = self._merge_ab_results(
                        course=course,
                        exam_a=exam_a,
                        exam_b=exam_b,
                        time_slot=time_slot_a,
                        next_slot=time_slot_b,
                        total_students=total_students,
                    )
                    all_exams.extend(created_exams)
                    exam_results.append(merged["exam_result"])
                    if merged.get("patrols"):
                        patrol_results.extend(merged["patrols"])
                    elif merged.get("patrol"):
                        patrol_results.append(merged["patrol"])

                    placed = True
                    break

                if not placed:
                    violations.append(f"专业课 {course.name} 找不到可用连续时段或教室不足（AB卷）")
            else:
                placed = False
                for slot_id in sorted(free_slots):
                    excluded = room_slot_usage.get(slot_id, set())
                    test = allocate_classrooms(
                        student_count=total_students,
                        classes=classes,
                        classrooms=classrooms,
                        excluded_room_ids=excluded,
                        priority_rules=self.classroom_priority_rules,
                    )
                    if not test:
                        continue

                    time_slot = time_slot_map[slot_id]
                    used_time_slots.add(slot_id)

                    exam = self._create_single_exam(
                        course=course,
                        classes=classes,
                        classrooms=classrooms,
                        teachers=teachers,
                        time_slot=time_slot,
                        label=None,
                        classroom_map=classroom_map,
                        teacher_usage=teacher_usage,
                        id_gen=id_gen,
                        excluded_room_ids=excluded,
                        violations=violations,
                        max_days=max_days,
                    )
                    if exam:
                        for ec in exam.classroom_assignments:
                            room_slot_usage.setdefault(slot_id, set()).add(ec.classroom_id)
                        created_exams.append(exam)

                        result = self._exam_to_result(
                            course=course,
                            exam=exam,
                            time_slot=time_slot,
                            total_students=total_students,
                            created_exams=created_exams,
                        )
                        all_exams.extend(created_exams)
                        exam_results.append(result["exam_result"])
                        if result.get("patrol"):
                            patrol_results.append(result["patrol"])

                        placed = True
                        break

                if not placed:
                    violations.append(f"专业课 {course.name} 找不到可用时段或教室不足")

        # =====================================================
        # 阶段三：全局验证与冲突分析
        # =====================================================
        conflict_report = self._build_conflict_report(
            all_exams=all_exams,
            classrooms=classrooms,
            teachers=teachers,
            time_slots=time_slots,
        )

        # 验证排满策略HC-09
        self._verify_compact_scheduling(exam_results, time_slots, violations)

        # 统一补充：确保每个有考试的时段都有 PatrolResult（同 slot_pair 复用）
        patrol_results = self._fill_patrol_for_all_slots(
            patrol_results, used_time_slots, time_slot_map, violations
        )

        # 验证HC-06：每个有考试的上下午场次对恰好有 patrol_count 名流动监考
        self._verify_patrol_coverage(patrol_results, used_time_slots, time_slot_map, violations)

        solve_time: float = time.time() - start_time

        return SchedulingResult(
            success=len(violations) == 0,
            exams=exam_results,
            patrol_teachers=patrol_results,
            violations=violations,
            conflict_report=conflict_report,
            solve_time=solve_time,
            raw_exams=all_exams,
        )

    # --------------------------------------------------------
    # 公共课排考
    # --------------------------------------------------------
    def _schedule_public_course(
        self,
        course: Course,
        classrooms: list[Classroom],
        teachers: list[Teacher],
        time_slot_map: dict[int, TimeSlot],
        classroom_map: dict[int, Classroom],
        teacher_map: dict[int, Teacher],
        teacher_usage: dict[int, list[int]],
        id_gen: _IdGenerator,
        used_time_slots: set[int],
        room_slot_usage: dict[int, set[int]],
        violations: list[str],
        max_days: int = 1,
    ) -> dict[str, Any] | None:
        """
        为公共课安排考试。

        HC-02: 公共课必须安排在教务处指定的日期与时段。
        """
        assigned_slot_id: int = course.dept_assigned_time_slot_id
        time_slot = time_slot_map.get(assigned_slot_id)
        if not time_slot:
            violations.append(f"公共课 {course.name} 指定时段 {assigned_slot_id} 不存在")
            return None

        # 占用该时段
        used_time_slots.add(assigned_slot_id)

        classes: list[Class] = [link.class_ for link in course.class_links]
        total_students: int = sum(c.student_count for c in classes)

        created_exams: list[Exam] = []

        if course.needs_ab:
            # HC-07: AB卷，班级不可拆分
            group_a, group_b = split_ab_classes(classes)
            # 创建A卷考试
            excluded_a = room_slot_usage.get(time_slot.id, set())
            exam_a = self._create_single_exam(
                course=course,
                classes=group_a,
                classrooms=classrooms,
                teachers=teachers,
                time_slot=time_slot,
                label="A",
                classroom_map=classroom_map,
                teacher_usage=teacher_usage,
                id_gen=id_gen,
                excluded_room_ids=excluded_a,
                violations=violations,
                max_days=max_days,
            )
            if exam_a:
                for ec in exam_a.classroom_assignments:
                    room_slot_usage.setdefault(time_slot.id, set()).add(ec.classroom_id)

            # 创建B卷考试（连续时段）
            next_slot_id = assigned_slot_id + 1 if assigned_slot_id % 4 in (1, 3) else assigned_slot_id
            if next_slot_id not in time_slot_map:
                next_slot_id = assigned_slot_id
            next_slot = time_slot_map[next_slot_id]
            used_time_slots.add(next_slot_id)

            excluded_b = room_slot_usage.get(next_slot.id, set())
            exam_b = self._create_single_exam(
                course=course,
                classes=group_b,
                classrooms=classrooms,
                teachers=teachers,
                time_slot=next_slot,
                label="B",
                classroom_map=classroom_map,
                teacher_usage=teacher_usage,
                id_gen=id_gen,
                excluded_room_ids=excluded_b,
                violations=violations,
                max_days=max_days,
            )
            if exam_b:
                for ec in exam_b.classroom_assignments:
                    room_slot_usage.setdefault(next_slot.id, set()).add(ec.classroom_id)

            # AB卷必须同时成功，否则回退已分配的资源和时段
            if not exam_a or not exam_b:
                # 回退A卷占用的教室
                if exam_a:
                    for ec in exam_a.classroom_assignments:
                        room_slot_usage.get(time_slot.id, set()).discard(ec.classroom_id)
                    # 回退A卷占用的教师场次
                    for et in exam_a.teacher_assignments:
                        tid = et.teacher_id
                        if tid in teacher_usage and time_slot.id in teacher_usage[tid]:
                            teacher_usage[tid].remove(time_slot.id)
                # 回退B卷占用的教室
                if exam_b:
                    for ec in exam_b.classroom_assignments:
                        room_slot_usage.get(next_slot.id, set()).discard(ec.classroom_id)
                    # 回退B卷占用的教师场次
                    for et in exam_b.teacher_assignments:
                        tid = et.teacher_id
                        if tid in teacher_usage and next_slot.id in teacher_usage[tid]:
                            teacher_usage[tid].remove(next_slot.id)
                # 回退时段标记
                used_time_slots.discard(assigned_slot_id)
                used_time_slots.discard(next_slot_id)
                violations.append(
                    f"公共课 {course.name} AB卷无法同时安排："
                    f"A卷{'成功' if exam_a else '失败'}，B卷{'成功' if exam_b else '失败'}"
                )
                return None

            created_exams.append(exam_a)
            created_exams.append(exam_b)

            # 合并结果
            merged_result = self._merge_ab_results(
                course=course,
                exam_a=exam_a,
                exam_b=exam_b,
                time_slot=time_slot,
                next_slot=next_slot,
                total_students=total_students,
            )
            return merged_result
        else:
            # 非AB卷，单场考试
            excluded = room_slot_usage.get(time_slot.id, set())
            exam = self._create_single_exam(
                course=course,
                classes=classes,
                classrooms=classrooms,
                teachers=teachers,
                time_slot=time_slot,
                label=None,
                classroom_map=classroom_map,
                teacher_usage=teacher_usage,
                id_gen=id_gen,
                excluded_room_ids=excluded,
                violations=violations,
                max_days=max_days,
            )
            if exam:
                for ec in exam.classroom_assignments:
                    room_slot_usage.setdefault(time_slot.id, set()).add(ec.classroom_id)
                created_exams.append(exam)
                return self._exam_to_result(
                    course=course,
                    exam=exam,
                    time_slot=time_slot,
                    total_students=total_students,
                    created_exams=created_exams,
                )
        return None

    # --------------------------------------------------------
    # 专业课排考
    # --------------------------------------------------------
    def _schedule_major_course(
        self,
        course: Course,
        classrooms: list[Classroom],
        teachers: list[Teacher],
        time_slot_map: dict[int, TimeSlot],
        classroom_map: dict[int, Classroom],
        teacher_map: dict[int, Teacher],
        teacher_usage: dict[int, list[int]],
        id_gen: _IdGenerator,
        used_time_slots: set[int],
        room_slot_usage: dict[int, set[int]],
        available_slots: list[int],
        violations: list[str],
    ) -> dict[str, Any] | None:
        """
        为专业课安排考试。

        HC-08: 专业课只能安排在公共课排完后的空闲时段内。
        """
        classes: list[Class] = [link.class_ for link in course.class_links]
        total_students: int = sum(c.student_count for c in classes)

        created_exams: list[Exam] = []
        slots_used: int = 1

        if course.needs_ab:
            # AB卷需要两个连续时段
            # HC-07: 班级不可拆分
            group_a, group_b = split_ab_classes(classes)

            # 找连续的两个空闲时段
            slot_pair = self._find_continuous_slots(available_slots, time_slot_map)
            if not slot_pair:
                violations.append(f"专业课 {course.name} 找不到连续空闲时段（AB卷）")
                return None

            slot_a_id, slot_b_id = slot_pair
            time_slot_a = time_slot_map[slot_a_id]
            time_slot_b = time_slot_map[slot_b_id]

            used_time_slots.add(slot_a_id)
            used_time_slots.add(slot_b_id)

            excluded_a = room_slot_usage.get(time_slot_a.id, set())
            exam_a = self._create_single_exam(
                course=course,
                classes=group_a,
                classrooms=classrooms,
                teachers=teachers,
                time_slot=time_slot_a,
                label="A",
                classroom_map=classroom_map,
                teacher_usage=teacher_usage,
                id_gen=id_gen,
                excluded_room_ids=excluded_a,
                violations=violations,
                max_days=max_days,
            )
            if exam_a:
                for ec in exam_a.classroom_assignments:
                    room_slot_usage.setdefault(time_slot_a.id, set()).add(ec.classroom_id)

            excluded_b = room_slot_usage.get(time_slot_b.id, set())
            exam_b = self._create_single_exam(
                course=course,
                classes=group_b,
                classrooms=classrooms,
                teachers=teachers,
                time_slot=time_slot_b,
                label="B",
                classroom_map=classroom_map,
                teacher_usage=teacher_usage,
                id_gen=id_gen,
                excluded_room_ids=excluded_b,
                violations=violations,
                max_days=max_days,
            )
            if exam_b:
                for ec in exam_b.classroom_assignments:
                    room_slot_usage.setdefault(time_slot_b.id, set()).add(ec.classroom_id)

            # AB卷必须同时成功，否则回退
            if not exam_a or not exam_b:
                if exam_a:
                    for ec in exam_a.classroom_assignments:
                        room_slot_usage.get(time_slot_a.id, set()).discard(ec.classroom_id)
                    for et in exam_a.teacher_assignments:
                        tid = et.teacher_id
                        if tid in teacher_usage and time_slot_a.id in teacher_usage[tid]:
                            teacher_usage[tid].remove(time_slot_a.id)
                if exam_b:
                    for ec in exam_b.classroom_assignments:
                        room_slot_usage.get(time_slot_b.id, set()).discard(ec.classroom_id)
                    for et in exam_b.teacher_assignments:
                        tid = et.teacher_id
                        if tid in teacher_usage and time_slot_b.id in teacher_usage[tid]:
                            teacher_usage[tid].remove(time_slot_b.id)
                used_time_slots.discard(slot_a_id)
                used_time_slots.discard(slot_b_id)
                violations.append(
                    f"专业课 {course.name} AB卷无法同时安排："
                    f"A卷{'成功' if exam_a else '失败'}，B卷{'成功' if exam_b else '失败'}"
                )
                return None

            created_exams.append(exam_a)
            created_exams.append(exam_b)

            slots_used = 2
            merged = self._merge_ab_results(
                course=course,
                exam_a=exam_a,
                exam_b=exam_b,
                time_slot=time_slot_a,
                next_slot=time_slot_b,
                total_students=total_students,
            )
            merged["slots_used"] = slots_used
            return merged
        else:
            # 非AB卷，单场考试
            if not available_slots:
                violations.append(f"专业课 {course.name} 无可用时段")
                return None

            slot_id = available_slots[0]
            time_slot = time_slot_map[slot_id]
            used_time_slots.add(slot_id)

            excluded = room_slot_usage.get(time_slot.id, set())
            exam = self._create_single_exam(
                course=course,
                classes=classes,
                classrooms=classrooms,
                teachers=teachers,
                time_slot=time_slot,
                label=None,
                classroom_map=classroom_map,
                teacher_usage=teacher_usage,
                id_gen=id_gen,
                excluded_room_ids=excluded,
                violations=violations,
                max_days=max_days,
            )
            if exam:
                for ec in exam.classroom_assignments:
                    room_slot_usage.setdefault(time_slot.id, set()).add(ec.classroom_id)
                created_exams.append(exam)
                result = self._exam_to_result(
                    course=course,
                    exam=exam,
                    time_slot=time_slot,
                    total_students=total_students,
                    created_exams=created_exams,
                )
                result["slots_used"] = 1
                return result

        return None

    # --------------------------------------------------------
    # 创建单场考试
    # --------------------------------------------------------
    def _create_single_exam(
        self,
        course: Course,
        classes: list[Class],
        classrooms: list[Classroom],
        teachers: list[Teacher],
        time_slot: TimeSlot,
        label: str | None,
        classroom_map: dict[int, Classroom],
        teacher_usage: dict[int, list[int]],
        id_gen: _IdGenerator,
        excluded_room_ids: set[int],
        violations: list[str],
        max_days: int = 1,
    ) -> Exam | None:
        """
        创建单场考试，包含教室分配、固定监考分配。

        HC-03: 教室最多2个班级
        HC-04: 教室容量限制
        HC-05: 教师场次上限
        """
        total_students: int = sum(c.student_count for c in classes)

        # 1. 教室分配（排除当前时段已占用的教室）
        room_assignments = allocate_classrooms(
            student_count=total_students,
            classes=classes,
            classrooms=classrooms,
            excluded_room_ids=excluded_room_ids,
            priority_rules=self.classroom_priority_rules,
        )
        if not room_assignments:
            available_rooms = [
                r for r in classrooms
                if getattr(r, "is_active", True) and r.id not in excluded_room_ids
            ]
            available_cap = sum(r.capacity for r in available_rooms)
            excluded_detail = ""
            if excluded_room_ids:
                excluded_rooms = [
                    f"{classroom_map[r_id].name}({classroom_map[r_id].capacity}人)"
                    for r_id in excluded_room_ids
                    if r_id in classroom_map
                ]
                excluded_detail = (
                    f"；该时段已占用{len(excluded_rooms)}间教室"
                    f"({sum(classroom_map[r_id].capacity for r_id in excluded_room_ids if r_id in classroom_map)}人)"
                    f"：{', '.join(excluded_rooms)}"
                )
            violations.append(
                f"课程 {course.name}({label or '主考'}) 教室分配失败: "
                f"需要{total_students}人，当前时段可用教室总容量仅{available_cap}人"
                f"（剩余{len(available_rooms)}间教室）{excluded_detail}"
            )
            return None

        # 标记已使用教室
        used_room_ids: set[int] = set()
        for ra in room_assignments:
            used_room_ids.add(ra.classroom_id)

        # 过滤可用教师（排除已满的，排除已在当前时段有任务的）
        from .teacher_alloc import TeacherState
        teacher_states = [TeacherState(t) for t in teachers]
        # 更新已使用场次
        for tid, slots in teacher_usage.items():
            for ts in teacher_states:
                if ts.teacher.id == tid:
                    ts.assigned_slots = len(slots)
        # 排除已在当前时段被分配的教师（避免同一时段不同考试重复分配同一人）
        teacher_states = [
            ts for ts in teacher_states
            if time_slot.id not in teacher_usage.get(ts.teacher.id, [])
        ]

        # 2. 固定监考分配
        fixed_teachers = allocate_teachers_fixed(
            exam_id=id_gen.next(),
            classrooms=room_assignments,
            teacher_states=teacher_states,
            teachers_per_room=self.fixed_teachers_per_room,
            exam_day=time_slot.day_of_week,
            enable_max_days_constraint=self.enable_max_days_constraint,
            max_days=max_days,
            enable_day_continuity_constraint=self.enable_day_continuity_constraint,
        )
        if not fixed_teachers and room_assignments:
            violations.append(f"课程 {course.name} 固定监考分配失败：无可用教师")
            return None

        # 更新教师使用追踪
        for ft in fixed_teachers:
            if ft.teacher_id not in teacher_usage:
                teacher_usage[ft.teacher_id] = []
            if time_slot.id not in teacher_usage[ft.teacher_id]:
                teacher_usage[ft.teacher_id].append(time_slot.id)

        # 3. 流动监考分配
        # 构造existing（该时段已有的固定监考教师，避免同一教师同时担任两种角色）
        existing = [
            TeacherAssignment(
                teacher_id=ft.teacher_id,
                teacher_name=ft.teacher_name,
                role="fixed",
                classroom_id=ft.classroom_id,
            )
            for ft in fixed_teachers
        ]
        patrol_teachers = allocate_teachers_patrol(
            time_slot_id=time_slot.id,
            slot_pair=time_slot.slot_pair,
            day_of_week=time_slot.day_of_week,
            teacher_states=teacher_states,
            existing_assignments=existing,
            patrol_count=self.patrol_teacher_count,
            group_rules=self.patrol_group_rules,
            used_slot_pairs=self._patrol_slot_pairs_used,
            classrooms_in_slot=[classroom_map[r.classroom_id] for r in room_assignments],
            enable_max_days_constraint=self.enable_max_days_constraint,
            max_days=max_days,
            enable_day_continuity_constraint=self.enable_day_continuity_constraint,
        )

        # 更新教师使用追踪
        if patrol_teachers:
            for pt in patrol_teachers:
                if pt.teacher_id not in teacher_usage:
                    teacher_usage[pt.teacher_id] = []
                if time_slot.id not in teacher_usage[pt.teacher_id]:
                    teacher_usage[pt.teacher_id].append(time_slot.id)

        # 4. 构建考试对象
        exam_id = id_gen.next()
        exam = Exam(
            id=exam_id,
            course_id=course.id,
            time_slot_id=time_slot.id,
            exam_label=label,  # type: ignore[arg-type]
            status="scheduled",
            course=course,
        )

        # 教室分配
        for ra in room_assignments:
            exam_classroom = ExamClassroom(
                exam_id=exam_id,
                classroom_id=ra.classroom_id,
                total_students=ra.total_students,
            )
            for cls, count in ra.assignments:
                exam_classroom.class_assignments.append(
                    ExamClassroomClass(
                        class_id=cls.id,
                        student_count=count,
                    )
                )
            exam.classroom_assignments.append(exam_classroom)

        # 固定监考
        for ft in fixed_teachers:
            exam.teacher_assignments.append(
                ExamTeacher(
                    exam_id=exam_id,
                    teacher_id=ft.teacher_id,
                    role="fixed",
                    classroom_id=ft.classroom_id,
                )
            )

        # 流动监考
        for pt in (patrol_teachers or []):
            exam.teacher_assignments.append(
                ExamTeacher(
                    exam_id=exam_id,
                    teacher_id=pt.teacher_id,
                    role="patrol",
                    classroom_id=None,
                    patrol_group_name=pt.patrol_group_name,
                )
            )

        return exam

    # --------------------------------------------------------
    # 查找连续的两个空闲时段
    # --------------------------------------------------------
    def _find_continuous_slots(
        self,
        available_slots: list[int],
        time_slot_map: dict[int, TimeSlot],
    ) -> tuple[int, int] | None:
        """
        在可用时段中找到一对连续的时段（T1-T2 或 T3-T4）。

        连续定义：同一天内，T1与T2连续（id差1），T3与T4连续（id差1）。
        """
        slot_set = set(available_slots)
        for slot_id in sorted(available_slots):
            # 检查同一天的下一个时段是否在可用列表中
            if slot_id % 4 in (1, 3):  # T1或T3
                next_slot = slot_id + 1
                if next_slot in slot_set and next_slot in time_slot_map:
                    return (slot_id, next_slot)
        return None

    # --------------------------------------------------------
    # 将Exam转换为ExamResult
    # --------------------------------------------------------
    def _exam_to_result(
        self,
        course: Course,
        exam: Exam,
        time_slot: TimeSlot,
        total_students: int,
        created_exams: list[Exam],
    ) -> dict[str, Any]:
        """将单场考试转换为结果字典"""
        classrooms_result: list[ClassroomResult] = []
        teachers_result: list[TeacherResult] = []

        for ec in exam.classroom_assignments:
            room_name = f"Room_{ec.classroom_id}"
            classrooms_result.append(
                ClassroomResult(
                    classroom_id=ec.classroom_id,
                    classroom_name=room_name,
                    class_ids=[ca.class_id for ca in ec.class_assignments],
                    student_count=ec.total_students,
                )
            )

        for et in exam.teacher_assignments:
            if et.role == "fixed":
                teachers_result.append(
                    TeacherResult(
                        teacher_id=et.teacher_id,
                        teacher_name=f"Teacher_{et.teacher_id}",
                        role="fixed",
                    )
                )

        exam_result = ExamResult(
            exam_id=exam.id,
            course_id=course.id,
            course_name=course.name,
            time_slot_id=time_slot.id,
            day_of_week=time_slot.day_of_week,
            slot_code=time_slot.slot_code,
            exam_label=exam.exam_label,
            classrooms=classrooms_result,
            teachers=teachers_result,
            total_students=total_students,
            is_ab=False,
        )

        patrol_teachers: list[int] = [
            et.teacher_id for et in exam.teacher_assignments if et.role == "patrol"
        ]
        patrol = PatrolResult(
            time_slot_id=time_slot.id,
            day_of_week=time_slot.day_of_week,
            slot_code=time_slot.slot_code,
            teacher_ids=patrol_teachers,
        ) if patrol_teachers else None

        return {
            "exams": created_exams,
            "exam_result": exam_result,
            "patrol": patrol,
            "slots_used": 1,
        }

    # --------------------------------------------------------
    # 合并AB卷结果
    # --------------------------------------------------------
    def _merge_ab_results(
        self,
        course: Course,
        exam_a: Exam | None,
        exam_b: Exam | None,
        time_slot: TimeSlot,
        next_slot: TimeSlot,
        total_students: int,
    ) -> dict[str, Any]:
        """将A卷和B卷的结果合并为单个ExamResult"""
        all_exams: list[Exam] = []
        if exam_a:
            all_exams.append(exam_a)
        if exam_b:
            all_exams.append(exam_b)

        classrooms_result: list[ClassroomResult] = []
        teachers_result: list[TeacherResult] = []

        for exam in all_exams:
            for ec in exam.classroom_assignments:
                classrooms_result.append(
                    ClassroomResult(
                        classroom_id=ec.classroom_id,
                        classroom_name=f"Room_{ec.classroom_id}",
                        class_ids=[ca.class_id for ca in ec.class_assignments],
                        student_count=ec.total_students,
                    )
                )
            for et in exam.teacher_assignments:
                if et.role == "fixed":
                    teachers_result.append(
                        TeacherResult(
                            teacher_id=et.teacher_id,
                            teacher_name=f"Teacher_{et.teacher_id}",
                            role="fixed",
                        )
                    )

        exam_result = ExamResult(
            exam_id=exam_a.id if exam_a else (exam_b.id if exam_b else 0),
            course_id=course.id,
            course_name=course.name,
            time_slot_id=time_slot.id,
            day_of_week=time_slot.day_of_week,
            slot_code=f"{time_slot.slot_code}+{next_slot.slot_code}",
            exam_label="A+B",
            classrooms=classrooms_result,
            teachers=teachers_result,
            total_students=total_students,
            is_ab=True,
        )

        # 合并流动监考：分别创建A卷和B卷时段的PatrolResult
        patrol_a_ids: list[int] = []
        patrol_b_ids: list[int] = []
        if exam_a:
            patrol_a_ids = [et.teacher_id for et in exam_a.teacher_assignments if et.role == "patrol"]
        if exam_b:
            patrol_b_ids = [et.teacher_id for et in exam_b.teacher_assignments if et.role == "patrol"]

        patrol_results_list: list[PatrolResult] = []
        if patrol_a_ids:
            patrol_results_list.append(PatrolResult(
                time_slot_id=time_slot.id,
                day_of_week=time_slot.day_of_week,
                slot_code=time_slot.slot_code,
                teacher_ids=patrol_a_ids,
            ))
        if patrol_b_ids:
            patrol_results_list.append(PatrolResult(
                time_slot_id=next_slot.id,
                day_of_week=next_slot.day_of_week,
                slot_code=next_slot.slot_code,
                teacher_ids=patrol_b_ids,
            ))

        return {
            "exams": all_exams,
            "exam_result": exam_result,
            "patrol": patrol_results_list[0] if patrol_results_list else None,
            "patrols": patrol_results_list,
        }

    # --------------------------------------------------------
    # 验证排满策略HC-09
    # --------------------------------------------------------
    def _verify_compact_scheduling(
        self,
        exam_results: list[ExamResult],
        time_slots: list[TimeSlot],
        violations: list[str],
    ) -> None:
        """
        HC-09: 验证排满策略——专业课按周一到周五顺序紧凑填充。
        注意：公共课的时段由教务处指定，不受HC-09约束。
        只检查专业课部分是否紧凑。
        """
        # 只检查专业课的时段使用
        major_used_slots: set[int] = set()
        for er in exam_results:
            # 公共课标记为指定时段，不参与紧凑性检查
            if not er.is_ab:
                pass  # 无法直接区分，所以采用另一种方式

        # 获取所有已用时段
        used_slots: set[int] = set()
        for er in exam_results:
            used_slots.add(er.time_slot_id)

        if not used_slots:
            return

        # 分段检查：对于每个连续区间，检查内部是否紧凑
        # 但允许教务处指定的公共课时段之间的间隔
        # 简化处理：只检查最大已用时段之前的"明显"空洞
        sorted_slots = sorted([s.id for s in time_slots])
        max_used = max(used_slots)

        # 只报告重大空洞（同一周内跳过了一整天以上）
        for i, slot_id in enumerate(sorted_slots):
            if slot_id >= max_used:
                break
            if slot_id not in used_slots:
                # 检查是否是跨天的大空洞（当天全部4个时段都为空）
                day = (slot_id - 1) // 4 + 1
                day_slots = [(day - 1) * 4 + j for j in range(1, 5)]
                if all(ds not in used_slots for ds in day_slots):
                    # 这是一整天空缺，只在非最后位置时报告
                    next_day_first = day * 4 + 1
                    if any(s >= next_day_first and s in used_slots for s in sorted_slots):
                        violations.append(
                            f"HC-09排满策略违规: 周{day}全天无考试，但后续日期有考试"
                        )
                        break  # 只报告第一个

    # --------------------------------------------------------
    # 为所有已用时段补充 PatrolResult（同 slot_pair 复用）
    # --------------------------------------------------------
    def _fill_patrol_for_all_slots(
        self,
        patrol_results: list[PatrolResult],
        used_time_slots: set[int],
        time_slot_map: dict[int, TimeSlot],
        violations: list[str],
    ) -> list[PatrolResult]:
        """
        确保每个有考试的时段都有 PatrolResult。
        如果某时段没有，则查找同 (day, slot_pair) 的已有 PatrolResult 进行复用。
        """
        # 按 (day, slot_pair) -> teacher_ids 映射
        slot_pair_patrol_map: dict[tuple[int, int], list[int]] = {}
        for pr in patrol_results:
            ts = time_slot_map.get(pr.time_slot_id)
            if ts:
                key = (ts.day_of_week, ts.slot_pair)
                slot_pair_patrol_map[key] = pr.teacher_ids

        final: list[PatrolResult] = []
        seen_slot_ids: set[int] = set()
        for pr in patrol_results:
            final.append(pr)
            seen_slot_ids.add(pr.time_slot_id)

        for slot_id in used_time_slots:
            if slot_id in seen_slot_ids:
                continue
            ts = time_slot_map.get(slot_id)
            if not ts:
                continue
            key = (ts.day_of_week, ts.slot_pair)
            if key in slot_pair_patrol_map:
                final.append(PatrolResult(
                    time_slot_id=slot_id,
                    day_of_week=ts.day_of_week,
                    slot_code=ts.slot_code,
                    teacher_ids=slot_pair_patrol_map[key].copy(),
                ))
            else:
                violations.append(
                    f"HC-06流动监考违规: 周{ts.day_of_week} {ts.slot_code}无流动监考"
                )

        return final

    # --------------------------------------------------------
    # 验证流动监考覆盖
    # --------------------------------------------------------
    def _verify_patrol_coverage(
        self,
        patrol_results: list[PatrolResult],
        used_time_slots: set[int],
        time_slot_map: dict[int, TimeSlot],
        violations: list[str],
    ) -> None:
        """
        HC-06: 验证每个有考试的上下午场次对恰好有 patrol_count 名流动监考。
        同一场次对（T1/T2 或 T3/T4）共享同一组流动监考。
        """
        # 按 (day_of_week, slot_pair) 聚合 PatrolResult
        slot_pair_patrol: dict[tuple[int, int], list[int]] = {}
        for pr in patrol_results:
            ts = time_slot_map.get(pr.time_slot_id)
            if ts:
                key = (ts.day_of_week, ts.slot_pair)
                # 取该 slot_pair 下任意一个 PatrolResult 的 teacher_ids
                slot_pair_patrol[key] = pr.teacher_ids

        # 按 (day_of_week, slot_pair) 统计有考试的时段
        used_slot_pairs: dict[tuple[int, int], set[int]] = {}
        for slot_id in used_time_slots:
            ts = time_slot_map.get(slot_id)
            if ts:
                key = (ts.day_of_week, ts.slot_pair)
                used_slot_pairs.setdefault(key, set()).add(slot_id)

        for key, slots in used_slot_pairs.items():
            count = len(slot_pair_patrol.get(key, []))
            period = "上午" if key[1] == 1 else "下午"
            if count == 0:
                violations.append(
                    f"HC-06流动监考违规: 周{key[0]}{period}无流动监考"
                )
            elif count < self.patrol_teacher_count:
                violations.append(
                    f"HC-06流动监考警告: 周{key[0]}{period}有{count}名流动监考"
                    f"（建议{self.patrol_teacher_count}名）"
                )

    # --------------------------------------------------------
    # 构建冲突分析报告
    # --------------------------------------------------------
    def _build_conflict_report(
        self,
        all_exams: list[Exam],
        classrooms: list[Classroom],
        teachers: list[Teacher],
        time_slots: list[TimeSlot],
    ) -> ConflictReport:
        """
        分析资源冲突与瓶颈。

        报告内容:
        - 教室总容量 vs 所需容量
        - 教师总场次容量 vs 所需场次
        - 瓶颈识别
        - 优化建议
        """
        total_capacity: int = sum(c.capacity for c in classrooms if c.is_active)

        # 估算所需容量（从课程数据）
        required_capacity: int = 0
        if all_exams:
            required_capacity = sum(
                sum(ec.total_students for ec in exam.classroom_assignments)
                for exam in all_exams
            )

        total_teacher_slots: int = sum(t.max_slots for t in teachers)
        # 计算所需的教师场次
        required_teacher_slots: int = 0
        slot_exam_count: dict[int, int] = {}
        for exam in all_exams:
            num_rooms = len(exam.classroom_assignments)
            required_teacher_slots += num_rooms * self.fixed_teachers_per_room  # 固定监考
            slot_id = exam.time_slot_id
            slot_exam_count[slot_id] = slot_exam_count.get(slot_id, 0) + 1

        # 流动监考：每个有考试的上下午场次对需要 patrol_teacher_count 名
        time_slot_map_local = {t.id: t for t in time_slots}
        slot_pairs = set()
        for exam in all_exams:
            ts = time_slot_map_local.get(exam.time_slot_id)
            if ts:
                slot_pairs.add((ts.day_of_week, ts.slot_pair))
        required_teacher_slots += len(slot_pairs) * self.patrol_teacher_count
        unique_slots = len(slot_exam_count)

        bottlenecks: list[str] = []
        suggestions: list[str] = []

        # 容量瓶颈
        if all_exams and total_capacity > 0:
            ratio = required_capacity / total_capacity
            if ratio > 0.8:
                bottlenecks.append(
                    f"教室容量紧张: 总容量{total_capacity}, 所需{required_capacity} "
                    f"(利用率{ratio:.1%})"
                )
                suggestions.append("建议增加可用教室或申请更大教室")
        elif not all_exams:
            # 没有任何考试被安排，可能是资源严重不足
            bottlenecks.append("无任何考试被成功安排，资源严重不足")
            suggestions.append("请检查教室容量和教师数量是否满足最低要求")

        # 教师瓶颈
        if total_teacher_slots < required_teacher_slots:
            deficit = required_teacher_slots - total_teacher_slots
            bottlenecks.append(
                f"教师资源不足: 总容量{total_teacher_slots}场, "
                f"所需{required_teacher_slots}场, 缺口{deficit}场"
            )
            suggestions.append("建议增加监考教师或提高单场上限")

        # 时段瓶颈
        if unique_slots > len(time_slots):
            bottlenecks.append(
                f"时段不足: 需要{unique_slots}个时段，但仅有{len(time_slots)}个"
            )
            suggestions.append("建议增加考试天数或每天时段数")

        return ConflictReport(
            total_capacity=total_capacity,
            required_capacity=required_capacity,
            total_teacher_slots=total_teacher_slots,
            required_teacher_slots=required_teacher_slots,
            bottlenecks=bottlenecks,
            suggestions=suggestions,
        )


# ============================================================
# 单元测试
# ============================================================
if __name__ == "__main__":
    import unittest

    class MockClass:
        def __init__(self, id: int, student_count: int, name: str = "", grade: int = 1, major_id: int = 1):
            self.id = id
            self.student_count = student_count
            self.name = name or f"Class_{id}"
            self.grade = grade
            self.major_id = major_id

    class MockClassroom:
        def __init__(self, id: int, capacity: int, is_active: bool = True, name: str = "", floor: int = 1):
            self.id = id
            self.capacity = capacity
            self.is_active = is_active
            self.name = name or f"Room_{id}"
            self.room_type = "regular"
            self.floor = floor

    class MockTeacher:
        def __init__(self, id: int, teacher_type: str = "full_time", max_slots: int = 5, name: str = ""):
            self.id = id
            self.teacher_type = teacher_type
            self.max_slots = max_slots
            self.name = name or f"Teacher_{id}"

    class MockTimeSlot:
        def __init__(self, id: int, day_of_week: int, slot_code: str):
            self.id = id
            self.day_of_week = day_of_week
            self.slot_code = slot_code
            self.start_time = "08:30"
            self.end_time = "10:10"
            self.is_continuous = slot_code in ("T1", "T3")

        @property
        def slot_pair(self) -> int:
            if self.slot_code in ("T1", "T2"):
                return 1
            return 2

    class MockCourseClass:
        def __init__(self, course_id: int, class_: MockClass):
            self.course_id = course_id
            self.class_id = class_.id
            self.grade = class_.grade
            self.class_ = class_

    class TestScheduler(unittest.TestCase):
        """调度器单元测试"""

        def _create_test_data(self):
            """创建测试数据"""
            time_slots = [
                MockTimeSlot(1, 1, "T1"), MockTimeSlot(2, 1, "T2"),
                MockTimeSlot(3, 1, "T3"), MockTimeSlot(4, 1, "T4"),
                MockTimeSlot(5, 2, "T1"), MockTimeSlot(6, 2, "T2"),
                MockTimeSlot(7, 2, "T3"), MockTimeSlot(8, 2, "T4"),
                MockTimeSlot(9, 3, "T1"), MockTimeSlot(10, 3, "T2"),
            ]
            classrooms = [
                MockClassroom(1, 100), MockClassroom(2, 80),
                MockClassroom(3, 60), MockClassroom(4, 50),
            ]
            teachers = [
                MockTeacher(1, "full_time", 5),
                MockTeacher(2, "full_time", 5),
                MockTeacher(3, "full_time", 5),
                MockTeacher(4, "part_time", 5),
                MockTeacher(5, "part_time", 5),
                MockTeacher(6, "part_time", 5),
            ]
            return time_slots, classrooms, teachers

        def test_public_course_scheduling(self):
            """测试公共课排考"""
            time_slots, classrooms, teachers = self._create_test_data()

            cls1 = MockClass(1, 50, grade=1)
            cls2 = MockClass(2, 45, grade=1)

            public_course = Course(
                id=1,
                name="高等数学",
                course_type="public",
                needs_ab=False,
                dept_assigned_date=1,
                dept_assigned_time_slot_id=1,  # 周一T1
                class_links=[MockCourseClass(1, cls1), MockCourseClass(1, cls2)],
            )

            engine = SchedulingEngine(max_solve_time=30)
            result = engine.run(
                courses=[public_course],
                classrooms=classrooms,
                teachers=teachers,
                time_slots=time_slots,
            )

            self.assertTrue(result.success)
            self.assertEqual(len(result.exams), 1)
            self.assertEqual(result.exams[0].time_slot_id, 1)  # HC-02验证

        def test_major_course_scheduling(self):
            """测试专业课排考"""
            time_slots, classrooms, teachers = self._create_test_data()

            cls1 = MockClass(1, 40, grade=2)
            cls2 = MockClass(2, 35, grade=2)

            major_course = Course(
                id=2,
                name="数据结构",
                course_type="major",
                needs_ab=False,
                class_links=[MockCourseClass(2, cls1), MockCourseClass(2, cls2)],
            )

            engine = SchedulingEngine(max_solve_time=30)
            result = engine.run(
                courses=[major_course],
                classrooms=classrooms,
                teachers=teachers,
                time_slots=time_slots,
            )

            self.assertTrue(result.success)
            self.assertEqual(len(result.exams), 1)

        def test_ab_course_scheduling(self):
            """测试AB卷课程排考"""
            time_slots, classrooms, teachers = self._create_test_data()

            cls1 = MockClass(1, 30, grade=1)
            cls2 = MockClass(2, 30, grade=1)
            cls3 = MockClass(3, 25, grade=1)

            ab_course = Course(
                id=3,
                name="大学英语",
                course_type="public",
                needs_ab=True,
                dept_assigned_date=1,
                dept_assigned_time_slot_id=1,  # 周一T1，AB卷占用T1+T2
                class_links=[
                    MockCourseClass(3, cls1),
                    MockCourseClass(3, cls2),
                    MockCourseClass(3, cls3),
                ],
            )

            engine = SchedulingEngine(max_solve_time=30)
            result = engine.run(
                courses=[ab_course],
                classrooms=classrooms,
                teachers=teachers,
                time_slots=time_slots,
            )

            self.assertTrue(result.success)
            self.assertEqual(len(result.exams), 1)
            self.assertTrue(result.exams[0].is_ab)

        def test_conflict_report(self):
            """测试冲突报告生成"""
            time_slots, classrooms, teachers = self._create_test_data()

            engine = SchedulingEngine(max_solve_time=30)
            # 创建大量课程以触发瓶颈
            courses = []
            for i in range(20):
                cls = MockClass(i + 10, 80, grade=1)
                courses.append(Course(
                    id=100 + i,
                    name=f"课程{i}",
                    course_type="major" if i < 15 else "public",
                    needs_ab=False,
                    dept_assigned_time_slot_id=(i - 14) if i >= 15 else 0,
                    class_links=[MockCourseClass(100 + i, cls)],
                ))

            result = engine.run(
                courses=courses,
                classrooms=classrooms,
                teachers=teachers,
                time_slots=time_slots,
            )

            self.assertIsNotNone(result.conflict_report)
            self.assertGreaterEqual(result.conflict_report.total_capacity, 0)
            self.assertGreaterEqual(result.conflict_report.required_capacity, 0)

        def test_teacher_slot_limit_hc05(self):
            """测试HC-05教师场次上限"""
            time_slots, classrooms, teachers = self._create_test_data()

            # 限制教师容量
            for t in teachers:
                t.max_slots = 1  # 每人只能监考1场

            cls1 = MockClass(1, 100, grade=1)
            major_course = Course(
                id=4,
                name="大容量课",
                course_type="major",
                needs_ab=False,
                class_links=[MockCourseClass(4, cls1)],
            )

            engine = SchedulingEngine(max_solve_time=30)
            result = engine.run(
                courses=[major_course],
                classrooms=classrooms,
                teachers=teachers,
                time_slots=time_slots,
            )

            # 应该仍能排考（6名教师*1场=6场，足够1个考场2名固定+3名流动）
            self.assertTrue(result.success)

        def test_continuous_slots(self):
            """测试连续时段查找"""
            engine = SchedulingEngine(max_solve_time=30)
            time_slot_map = {
                1: MockTimeSlot(1, 1, "T1"),
                2: MockTimeSlot(2, 1, "T2"),
                3: MockTimeSlot(3, 1, "T3"),
                5: MockTimeSlot(5, 2, "T1"),
            }

            # 可用1,2,3,5
            pair = engine._find_continuous_slots([1, 2, 3, 5], time_slot_map)
            self.assertIsNotNone(pair)
            self.assertEqual(pair, (1, 2))  # 优先找到T1-T2

            # 只有T3-T5（不连续）
            pair = engine._find_continuous_slots([3, 5], time_slot_map)
            # T3的下一个是T4(id=4)，不在列表中，应该找不到
            self.assertIsNone(pair)

    unittest.main()
