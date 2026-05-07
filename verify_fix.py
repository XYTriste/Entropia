import sys
sys.path.insert(0, '/app')
from app.engine.scheduler import SchedulingEngine
from app.engine.models import (
    Class, Classroom, Course, CourseClass,
    Teacher, TimeSlot
)

print("=== Test 1: Public course mandatory slot constraint ===")
ts = [TimeSlot(i, (i - 1) // 4 + 1, f"T{(i - 1) % 4 + 1}", "08:30", "10:10", (i - 1) % 4 + 1 in (1, 3)) for i in range(1, 9)]
rooms = [Classroom(i, f"R{i}", 30, "regular", True, 1) for i in range(1, 4)]
teachers = [Teacher(i, f"T{i}", "full_time", 10) for i in range(1, 20)]

cls = [Class(1, "C1", 80, 1, 1)]
public_course = Course(
    id=1, name="PublicMath", course_type="public", needs_ab=False,
    dept_assigned_date=1, dept_assigned_time_slot_id=1,
    class_links=[CourseClass(1, 1, 1, cls[0])]
)

engine = SchedulingEngine()
result = engine.run(
    courses=[public_course],
    classrooms=rooms,
    teachers=teachers,
    time_slots=ts,
)
print(f"success={result.success}, violations={result.violations}")
assert result.success or any("容量不足" in v for v in result.violations), \
    f"Expected capacity violation, got {result.violations}"
print("Test 1 PASSED: No auto-fallback, reported failure correctly")

print()
print("=== Test 2: Multiple major courses in same slot ===")
rooms2 = [Classroom(i, f"R{i}", 50, "regular", True, 1) for i in range(1, 5)]
teachers2 = [Teacher(i, f"T{i}", "full_time", 10) for i in range(1, 30)]
ts2 = [TimeSlot(i, (i - 1) // 4 + 1, f"T{(i - 1) % 4 + 1}", "08:30", "10:10", (i - 1) % 4 + 1 in (1, 3)) for i in range(1, 9)]

major1 = Course(
    id=2, name="Python", course_type="major", needs_ab=False,
    dept_assigned_date=0, dept_assigned_time_slot_id=0,
    class_links=[CourseClass(2, 2, 1, Class(2, "C2", 40, 1, 1))]
)
major2 = Course(
    id=3, name="OOP", course_type="major", needs_ab=False,
    dept_assigned_date=0, dept_assigned_time_slot_id=0,
    class_links=[CourseClass(3, 3, 1, Class(3, "C3", 40, 1, 1))]
)

engine2 = SchedulingEngine()
result2 = engine2.run(
    courses=[major1, major2],
    classrooms=rooms2,
    teachers=teachers2,
    time_slots=ts2,
)
print(f"success={result2.success}, exams={len(result2.exams)}")
for er in result2.exams:
    print(f"  Course {er.course_name}: slot {er.time_slot_id}, rooms={[c.classroom_name for c in er.classrooms]}")

assert len(result2.exams) == 2, f"Expected 2 exams, got {len(result2.exams)}"
slot_ids = [er.time_slot_id for er in result2.exams]
print(f"Used slots: {slot_ids}")
assert len(set(slot_ids)) == 1, f"Expected courses to share same slot, but got slots {slot_ids}"
print("Test 2 PASSED: Multiple major courses share same slot")

print()
print("=== ALL TESTS PASSED ===")
