"""
Test CP-SAT teacher rebalancing post-processing.
"""
import pytest
from collections import defaultdict

from app.engine.teacher_rebalance import rebalance_fixed_teachers
from app.models.exam_teacher import ExamTeacher, ExamTeacherRole


class FakeTimeSlot:
    def __init__(self, id, day_of_week):
        self.id = id
        self.day_of_week = day_of_week


class FakeTeacher:
    def __init__(self, id, max_slots, teacher_type="full_time"):
        self.id = id
        self.max_slots = max_slots
        self.teacher_type = teacher_type


class FakeExam:
    def __init__(self, exam_id, time_slot, needed_by_room: dict[int, int]):
        self.id = exam_id
        self.time_slot = time_slot
        self.time_slot_id = time_slot.id if time_slot else None
        self.teacher_assignments = []
        for cid, needed in needed_by_room.items():
            for _ in range(needed):
                self.teacher_assignments.append(
                    ExamTeacher(
                        exam_id=exam_id,
                        teacher_id=-1,  # placeholder
                        role=ExamTeacherRole.FIXED,
                        classroom_id=cid,
                    )
                )


def test_rebalance_reduces_range():
    """
    10 teachers, 20 slots, each slot needs 1 teacher.
    Initial greedy assignment gives some teachers 3, some 1.
    After rebalance, range should be <= 1.
    """
    teachers = [FakeTeacher(i, 5) for i in range(10)]
    slots = []
    for day in range(5):
        for slot_idx in range(4):
            ts = FakeTimeSlot(id=day * 4 + slot_idx, day_of_week=day + 1)
            slots.append(ts)

    exams = []
    for s_idx, ts in enumerate(slots):
        # 每个时段 1 个教室，需要 1 个 fixed 教师
        exams.append(FakeExam(s_idx, ts, {100 + s_idx: 1}))

    # 初始不平衡分配：前几个教师多分配
    teacher_idx = 0
    for exam in exams:
        for ta in exam.teacher_assignments:
            ta.teacher_id = teachers[teacher_idx % 3].id  # 只分配给前3人
            teacher_idx += 1

    rebalance_fixed_teachers(exams, teachers, max_days=None, time_limit_seconds=5.0)

    # 统计
    counts = defaultdict(int)
    for exam in exams:
        for ta in exam.teacher_assignments:
            if ta.role == ExamTeacherRole.FIXED:
                counts[ta.teacher_id] += 1

    values = list(counts.values())
    range_val = max(values) - min(values)
    print(f"Counts: {sorted(values)}")
    assert range_val <= 1, f"Range too large: {range_val}, counts={values}"


def test_rebalance_respects_max_slots():
    """教师 max_slots 约束必须被满足。"""
    teachers = [FakeTeacher(i, 2) for i in range(10)]
    ts = FakeTimeSlot(id=1, day_of_week=1)
    exams = [FakeExam(i, ts, {100 + i: 1}) for i in range(10)]

    # 初始任意分配
    for exam in exams:
        for ta in exam.teacher_assignments:
            ta.teacher_id = 0

    rebalance_fixed_teachers(exams, teachers, max_days=None, time_limit_seconds=5.0)

    counts = defaultdict(int)
    for exam in exams:
        for ta in exam.teacher_assignments:
            if ta.role == ExamTeacherRole.FIXED:
                counts[ta.teacher_id] += 1

    for tid, cnt in counts.items():
        assert cnt <= 2, f"Teacher {tid} assigned {cnt} > max_slots 2"


def test_rebalance_respects_same_time_slot():
    """同一时段同一教师不能出现在两个教室。"""
    teachers = [FakeTeacher(i, 10) for i in range(3)]
    ts = FakeTimeSlot(id=1, day_of_week=1)
    # 同一时段 2 个教室，每个需要 1 个教师
    exams = [FakeExam(1, ts, {100: 1, 101: 1})]

    # 初始全部给教师0（非法）
    for ta in exams[0].teacher_assignments:
        ta.teacher_id = 0

    rebalance_fixed_teachers(exams, teachers, max_days=None, time_limit_seconds=5.0)

    fixed_teachers = [ta.teacher_id for ta in exams[0].teacher_assignments if ta.role == ExamTeacherRole.FIXED]
    assert len(set(fixed_teachers)) == 2, f"Same teacher assigned to both rooms: {fixed_teachers}"


def test_rebalance_with_max_days():
    """max_days 约束必须被满足。"""
    teachers = [FakeTeacher(i, 10) for i in range(5)]
    # 5 天，每天 1 个时段，每个时段 1 个教室
    exams = []
    for day in range(5):
        ts = FakeTimeSlot(id=day, day_of_week=day + 1)
        exams.append(FakeExam(day, ts, {100 + day: 1}))

    # 初始全给教师0
    for exam in exams:
        for ta in exam.teacher_assignments:
            ta.teacher_id = 0

    rebalance_fixed_teachers(exams, teachers, max_days=2, time_limit_seconds=5.0)

    days_per_teacher = defaultdict(set)
    for exam in exams:
        for ta in exam.teacher_assignments:
            if ta.role == ExamTeacherRole.FIXED:
                days_per_teacher[ta.teacher_id].add(exam.time_slot.day_of_week)

    for tid, days in days_per_teacher.items():
        assert len(days) <= 2, f"Teacher {tid} works {len(days)} days > max_days 2"
