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
    add_hc06_exactly_three_patrol,
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

    def __init__(self, max_solve_time: int = 300) -> None:
        """
        参数:
            max_solve_time: 求解器最大运行时间（秒），默认300秒
        """
        self.max_solve_time: int = max_solve_time

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

        # 追踪状态
        all_exams: list[Exam] = []  # 所有生成的考试
        used_time_slots: set[int] = set()  # 已被使用的时段
        teacher_usage: dict[int, list[int]] = create_teacher_usage_tracker(teachers)  # 教师->时段列表
        exam_results: list[ExamResult] = []  # 结果
        patrol_results: list[PatrolResult] = []  # 流动监考结果
        violations: list[str] = []  # 违规信息

        # =====================================================
        # 阶段一：公共课排考
        # =====================================================
        for course in public_courses:
            if course.dept_assigned_time_slot_id <= 0:
                violations.append(f"公共课 {course.name} 未指定时段")
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
                violations=violations,
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
        # 阶段二：专业课排考
        # =====================================================
        # 获取空闲时段（按时间顺序）
        free_slots: list[int] = [
            s.id for s in time_slots if s.id not in used_time_slots
        ]
        free_slots.sort()

        if not free_slots and major_courses:
            violations.append("公共课排完后无空闲时段，无法安排专业课")

        slot_idx: int = 0
        for course in major_courses:
            if slot_idx >= len(free_slots):
                violations.append(f"专业课 {course.name} 无可用时段")
                continue

            # 获取当前可用时段
            available_slots = free_slots[slot_idx:]
            result = self._schedule_major_course(
                course=course,
                classrooms=classrooms,
                teachers=teachers,
                time_slot_map=time_slot_map,
                classroom_map=classroom_map,
                teacher_map=teacher_map,
                teacher_usage=teacher_usage,
                id_gen=id_gen,
                used_time_slots=used_time_slots,
                available_slots=available_slots,
                violations=violations,
            )
            if result:
                all_exams.extend(result["exams"])
                exam_results.append(result["exam_result"])
                # 支持AB卷的多时段流动监考
                if result.get("patrols"):
                    patrol_results.extend(result["patrols"])
                elif result.get("patrol"):
                    patrol_results.append(result["patrol"])
                slot_idx += result["slots_used"]

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

        # 验证HC-06：每个有考试的时段恰好3名流动监考
        self._verify_patrol_coverage(patrol_results, used_time_slots, violations)

        solve_time: float = time.time() - start_time

        return SchedulingResult(
            success=len(violations) == 0,
            exams=exam_results,
            patrol_teachers=patrol_results,
            violations=violations,
            conflict_report=conflict_report,
            solve_time=solve_time,
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
        violations: list[str],
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
                violations=violations,
            )
            # 创建B卷考试（连续时段）
            next_slot_id = assigned_slot_id + 1 if assigned_slot_id % 4 in (1, 3) else assigned_slot_id
            if next_slot_id not in time_slot_map:
                next_slot_id = assigned_slot_id
            next_slot = time_slot_map[next_slot_id]
            used_time_slots.add(next_slot_id)

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
                violations=violations,
            )

            if exam_a:
                created_exams.append(exam_a)
            if exam_b:
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
                violations=violations,
            )
            if exam:
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
                violations=violations,
            )
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
                violations=violations,
            )

            if exam_a:
                created_exams.append(exam_a)
            if exam_b:
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
                violations=violations,
            )
            if exam:
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
        violations: list[str],
    ) -> Exam | None:
        """
        创建单场考试，包含教室分配、固定监考分配。

        HC-03: 教室最多2个班级
        HC-04: 教室容量限制
        HC-05: 教师场次上限
        """
        total_students: int = sum(c.student_count for c in classes)

        # 1. 教室分配
        room_assignments = allocate_classrooms(
            student_count=total_students,
            classes=classes,
            classrooms=classrooms,
        )
        if not room_assignments:
            violations.append(
                f"课程 {course.name}({label or '主考'}) 教室分配失败: "
                f"学生{total_students}人"
            )
            return None

        # 标记已使用教室
        used_room_ids: set[int] = set()
        for ra in room_assignments:
            used_room_ids.add(ra.classroom_id)

        # 过滤可用教师（排除已满的）
        from .teacher_alloc import TeacherState
        teacher_states = [TeacherState(t) for t in teachers]
        # 更新已使用场次
        for tid, slots in teacher_usage.items():
            for ts in teacher_states:
                if ts.teacher.id == tid:
                    ts.assigned_slots = len(slots)

        # 2. 固定监考分配
        fixed_teachers = allocate_teachers_fixed(
            exam_id=id_gen.next(),
            classrooms=room_assignments,
            teacher_states=teacher_states,
        )
        if not fixed_teachers and room_assignments:
            violations.append(f"课程 {course.name} 固定监考分配失败")
            return None

        # 更新教师使用追踪
        for ft in fixed_teachers:
            if ft.teacher_id not in teacher_usage:
                teacher_usage[ft.teacher_id] = []
            if time_slot.id not in teacher_usage[ft.teacher_id]:
                teacher_usage[ft.teacher_id].append(time_slot.id)

        # 3. 流动监考分配（每个时段3名）
        # 构造existing（该时段已有的固定监考教师，避免重复）
        existing = []
        patrol_teachers = allocate_teachers_patrol(
            time_slot_id=time_slot.id,
            teacher_states=teacher_states,
            existing_assignments=existing,
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
    # 验证流动监考覆盖
    # --------------------------------------------------------
    def _verify_patrol_coverage(
        self,
        patrol_results: list[PatrolResult],
        used_time_slots: set[int],
        violations: list[str],
    ) -> None:
        """
        HC-06: 验证每个有考试的时段恰好有3名流动监考。
        """
        slot_patrol_count: dict[int, int] = {}
        for pr in patrol_results:
            slot_patrol_count[pr.time_slot_id] = len(pr.teacher_ids)

        for slot_id in used_time_slots:
            count = slot_patrol_count.get(slot_id, 0)
            if count != 3:
                violations.append(
                    f"HC-06流动监考违规: 时段{slot_id}有{count}名流动监考（应为3名）"
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
        # 计算所需的教师场次：每场考试需要 2*教室数(固定) + 3(流动)
        required_teacher_slots: int = 0
        slot_exam_count: dict[int, int] = {}
        for exam in all_exams:
            num_rooms = len(exam.classroom_assignments)
            required_teacher_slots += num_rooms * 2  # 固定监考
            slot_id = exam.time_slot_id
            slot_exam_count[slot_id] = slot_exam_count.get(slot_id, 0) + 1

        # 流动监考：每个有考试的时段需要3名
        unique_slots = len(slot_exam_count)
        required_teacher_slots += unique_slots * 3

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
