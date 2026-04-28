"""
集成测试
验证排考引擎的端到端流程，模拟完整的排考场景。
"""

from __future__ import annotations

import unittest

from .models import (
    Class,
    Classroom,
    Course,
    CourseClass,
    Teacher,
    TimeSlot,
)
from .scheduler import SchedulingEngine


class TestIntegration(unittest.TestCase):
    """集成测试：端到端排考验证"""

    def _create_time_slots(self) -> list[TimeSlot]:
        """创建20个时段（周一到周五，每天4个）"""
        slots: list[TimeSlot] = []
        slot_codes = ["T1", "T2", "T3", "T4"]
        start_times = ["08:30", "10:30", "14:00", "16:00"]
        end_times = ["10:10", "12:10", "15:40", "17:40"]
        for day in range(1, 6):  # 周一到周五
            for i in range(4):
                slot_id = (day - 1) * 4 + i + 1
                slots.append(TimeSlot(
                    id=slot_id,
                    day_of_week=day,
                    slot_code=slot_codes[i],
                    start_time=start_times[i],
                    end_time=end_times[i],
                    is_continuous=(i in (0, 2)),  # T1与T2连续，T3与T4连续
                ))
        return slots

    def _create_classrooms(self, count: int = 10) -> list[Classroom]:
        """创建教室列表"""
        capacities = [120, 100, 100, 80, 80, 60, 60, 50, 50, 40]
        room_types = ["tiered", "regular", "regular", "tiered", "regular",
                      "regular", "regular", "regular", "regular", "regular"]
        floors = [1, 1, 2, 2, 3, 1, 2, 1, 2, 3]
        classrooms: list[Classroom] = []
        for i in range(min(count, len(capacities))):
            classrooms.append(Classroom(
                id=i + 1,
                name=f"教室{101 + i}",
                capacity=capacities[i],
                room_type=room_types[i],  # type: ignore[arg-type]
                is_active=True,
                floor=floors[i],
            ))
        return classrooms

    def _create_teachers(self, full_time: int = 10, part_time: int = 10) -> list[Teacher]:
        """创建教师列表"""
        teachers: list[Teacher] = []
        for i in range(full_time):
            teachers.append(Teacher(
                id=i + 1,
                name=f"专任教师{i + 1}",
                teacher_type="full_time",
                max_slots=5,
            ))
        for i in range(part_time):
            teachers.append(Teacher(
                id=full_time + i + 1,
                name=f"兼职教师{i + 1}",
                teacher_type="part_time",
                max_slots=5,
            ))
        return teachers

    def _create_classes(self, count: int, base_id: int = 1) -> list[Class]:
        """创建班级列表"""
        classes: list[Class] = []
        sizes = [45, 48, 42, 50, 38, 46, 44, 40, 47, 43,
                 35, 30, 28, 32, 36, 29, 33, 31, 27, 34]
        for i in range(count):
            classes.append(Class(
                id=base_id + i,
                name=f"班级{base_id + i}",
                student_count=sizes[i % len(sizes)],
                grade=1,
                major_id=1,
            ))
        return classes

    # --------------------------------------------------------
    # 场景1: 仅公共课排考
    # --------------------------------------------------------
    def test_public_courses_only(self):
        """测试仅公共课排考场景"""
        time_slots = self._create_time_slots()
        classrooms = self._create_classrooms()
        teachers = self._create_teachers()
        classes = self._create_classes(6)

        # 创建3门公共课
        courses: list[Course] = [
            Course(
                id=1, name="高等数学", course_type="public",
                needs_ab=False, dept_assigned_date=1, dept_assigned_time_slot_id=1,
                class_links=[CourseClass(1, c.id, c.grade, c) for c in classes[:2]],
            ),
            Course(
                id=2, name="大学英语", course_type="public",
                needs_ab=True, dept_assigned_date=2, dept_assigned_time_slot_id=5,
                class_links=[CourseClass(2, c.id, c.grade, c) for c in classes[2:5]],
            ),
            Course(
                id=3, name="大学物理", course_type="public",
                needs_ab=False, dept_assigned_date=3, dept_assigned_time_slot_id=9,
                class_links=[CourseClass(3, c.id, c.grade, c) for c in classes[5:6]],
            ),
        ]

        engine = SchedulingEngine(max_solve_time=60)
        result = engine.run(
            courses=courses,
            classrooms=classrooms,
            teachers=teachers,
            time_slots=time_slots,
        )

        print(f"\n[场景1] 公共课排考: success={result.success}, exams={len(result.exams)}")
        self.assertTrue(result.success, f"排考失败: {result.violations}")
        self.assertEqual(len(result.exams), 3)

        # 验证HC-02: 公共课在指定时段
        math_exam = next(e for e in result.exams if e.course_id == 1)
        self.assertEqual(math_exam.time_slot_id, 1)

        # 验证流动监考
        self.assertGreater(len(result.patrol_teachers), 0)

    # --------------------------------------------------------
    # 场景2: 公共课+专业课混合排考
    # --------------------------------------------------------
    def test_mixed_courses(self):
        """测试公共课与专业课混合排考"""
        time_slots = self._create_time_slots()
        classrooms = self._create_classrooms()
        teachers = self._create_teachers()
        classes = self._create_classes(12)

        # 2门公共课 + 3门专业课
        courses: list[Course] = [
            Course(
                id=1, name="高等数学", course_type="public",
                needs_ab=False, dept_assigned_date=1, dept_assigned_time_slot_id=1,
                class_links=[CourseClass(1, c.id, c.grade, c) for c in classes[:3]],
            ),
            Course(
                id=2, name="大学英语", course_type="public",
                needs_ab=False, dept_assigned_date=1, dept_assigned_time_slot_id=2,
                class_links=[CourseClass(2, c.id, c.grade, c) for c in classes[3:5]],
            ),
            Course(
                id=10, name="数据结构", course_type="major",
                needs_ab=False,
                class_links=[CourseClass(10, c.id, c.grade, c) for c in classes[5:8]],
            ),
            Course(
                id=11, name="操作系统", course_type="major",
                needs_ab=False,
                class_links=[CourseClass(11, c.id, c.grade, c) for c in classes[8:10]],
            ),
            Course(
                id=12, name="计算机网络", course_type="major",
                needs_ab=False,
                class_links=[CourseClass(12, c.id, c.grade, c) for c in classes[10:12]],
            ),
        ]

        engine = SchedulingEngine(max_solve_time=60)
        result = engine.run(
            courses=courses,
            classrooms=classrooms,
            teachers=teachers,
            time_slots=time_slots,
        )

        print(f"\n[场景2] 混合排考: success={result.success}, exams={len(result.exams)}, "
              f"violations={len(result.violations)}")

        # 5门课都应该安排成功
        self.assertEqual(len(result.exams), 5)

        # 验证HC-09排满策略
        used_slots = sorted(set(e.time_slot_id for e in result.exams))
        if used_slots:
            max_slot = max(used_slots)
            for s in range(1, max_slot):
                if s not in used_slots:
                    self.fail(f"HC-09排满策略违规: 时段{s}为空但后续时段有考试")

    # --------------------------------------------------------
    # 场景3: AB卷专业课
    # --------------------------------------------------------
    def test_major_course_with_ab(self):
        """测试专业课AB卷场景"""
        time_slots = self._create_time_slots()
        classrooms = self._create_classrooms()
        teachers = self._create_teachers()
        classes = self._create_classes(6)

        courses: list[Course] = [
            Course(
                id=10, name="专业核心课", course_type="major",
                needs_ab=True,
                class_links=[CourseClass(10, c.id, c.grade, c) for c in classes[:4]],
            ),
        ]

        engine = SchedulingEngine(max_solve_time=60)
        result = engine.run(
            courses=courses,
            classrooms=classrooms,
            teachers=teachers,
            time_slots=time_slots,
        )

        print(f"\n[场景3] 专业课AB卷: success={result.success}, exams={len(result.exams)}")
        self.assertTrue(result.success, f"排考失败: {result.violations}")
        self.assertEqual(len(result.exams), 1)
        self.assertTrue(result.exams[0].is_ab)

    # --------------------------------------------------------
    # 场景4: 大规模排考（模拟1000-2000人）
    # --------------------------------------------------------
    def test_large_scale(self):
        """测试大规模排考（30门课，约1500名学生）"""
        time_slots = self._create_time_slots()
        classrooms = self._create_classrooms(15)
        teachers = self._create_teachers(15, 15)
        classes = self._create_classes(40)

        # 创建30门课程
        courses: list[Course] = []
        for i in range(5):
            # 5门公共课
            start_slot = i * 4 + 1
            courses.append(Course(
                id=i + 1,
                name=f"公共课{i + 1}",
                course_type="public",
                needs_ab=(i % 2 == 0),
                dept_assigned_date=(i % 5) + 1,
                dept_assigned_time_slot_id=start_slot,
                class_links=[
                    CourseClass(i + 1, classes[i * 2].id, classes[i * 2].grade, classes[i * 2]),
                    CourseClass(i + 1, classes[i * 2 + 1].id, classes[i * 2 + 1].grade, classes[i * 2 + 1]),
                ],
            ))

        for i in range(25):
            # 25门专业课
            idx = 5 + i
            class_idx = 10 + i
            if class_idx + 1 < len(classes):
                courses.append(Course(
                    id=idx + 1,
                    name=f"专业课{i + 1}",
                    course_type="major",
                    needs_ab=False,
                    class_links=[
                        CourseClass(idx + 1, classes[class_idx % len(classes)].id,
                                   classes[class_idx % len(classes)].grade,
                                   classes[class_idx % len(classes)]),
                    ],
                ))

        import time
        start = time.time()
        engine = SchedulingEngine(max_solve_time=120)
        result = engine.run(
            courses=courses,
            classrooms=classrooms,
            teachers=teachers,
            time_slots=time_slots,
        )
        elapsed = time.time() - start

        total_students = sum(e.total_students for e in result.exams)
        print(f"\n[场景4] 大规模排考: courses={len(courses)}, "
              f"success={result.success}, exams={len(result.exams)}, "
              f"students={total_students}, time={elapsed:.2f}s")

        # 验证排考效率（不要求全部安排成功，但大部分应该成功）
        success_rate = len(result.exams) / len(courses) if courses else 0
        print(f"排考成功率: {success_rate:.1%}")
        self.assertGreaterEqual(len(result.exams), len(courses) * 0.5,
                               f"排考成功率过低: {len(result.exams)}/{len(courses)}")
        self.assertLess(elapsed, 60)  # 应在60秒内完成

        # 验证冲突报告
        self.assertIsNotNone(result.conflict_report)
        self.assertGreaterEqual(result.conflict_report.total_capacity, 0)

    # --------------------------------------------------------
    # 场景5: 资源不足边界测试
    # --------------------------------------------------------
    def test_resource_insufficient(self):
        """测试资源不足时的冲突报告"""
        time_slots = self._create_time_slots()
        # 只有少量教室
        classrooms = [Classroom(id=1, name="小教室", capacity=30,
                                 room_type="regular", is_active=True, floor=1)]
        teachers = self._create_teachers(2, 2)
        classes = self._create_classes(2)

        courses: list[Course] = [
            Course(
                id=1, name="大班课", course_type="major",
                needs_ab=False,
                class_links=[CourseClass(1, c.id, c.grade, c) for c in classes],
            ),
        ]

        engine = SchedulingEngine(max_solve_time=30)
        result = engine.run(
            courses=courses,
            classrooms=classrooms,
            teachers=teachers,
            time_slots=time_slots,
        )

        print(f"\n[场景5] 资源不足: success={result.success}, "
              f"bottlenecks={result.conflict_report.bottlenecks}")

        # 应该生成冲突报告
        self.assertIsNotNone(result.conflict_report)
        self.assertGreater(len(result.conflict_report.bottlenecks), 0)


if __name__ == "__main__":
    unittest.main()
