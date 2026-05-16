"""
Classroom query tool for AI assistant.

Provides functions to query classroom availability.
"""

from typing import Any, Optional

from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload

from app.database import AsyncSessionLocal
from app.models.class_ import Class
from app.models.classroom import Classroom
from app.models.exam import Exam, ExamStatus
from app.models.exam_classroom import ExamClassroom
from app.models.exam_classroom_class import ExamClassroomClass
from app.models.time_slot import TimeSlot


DAY_NAMES = {1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday"}
DAY_NAMES_ZH = {1: "星期一", 2: "星期二", 3: "星期三", 4: "星期四", 5: "星期五"}


async def query_classrooms(
    day_of_week: Optional[int] = None,
    slot_code: Optional[str] = None,
    classroom: Optional[Any] = None,
    show_all: bool = False
) -> dict:
    """
    Query classroom status.

    Args:
        day_of_week: 1-5, or None for all
        slot_code: T1/T2/T3/T4, or None for all
        classroom: specific classroom name(s), e.g. "5-201" or "5-201,5-202".
                    None means query all classrooms.
        show_all: whether to show all classrooms including occupied

    Returns:
        dict with classroom list and usage info
    """
    # Normalize classroom input to a list or None
    classroom_filter = None
    if classroom is not None:
        if isinstance(classroom, str):
            parts = [c.strip() for c in classroom.split(",") if c.strip()]
            classroom_filter = parts if parts else None
        elif isinstance(classroom, list):
            classroom_filter = list(classroom)
        else:
            classroom_filter = [str(classroom)]

    async with AsyncSessionLocal() as db:
        # 1. Get all active classrooms
        all_classrooms_result = await db.execute(
            select(Classroom).where(Classroom.is_active == True)  # noqa: E712
        )
        all_classrooms = all_classrooms_result.scalars().all()

        # Fuzzy match classrooms if filter specified (Python-side, simple and reliable)
        if classroom_filter:
            matched = []
            for pattern in classroom_filter:
                pat = pattern.strip().lower()
                pat_clean = pat.replace("-", "").replace(" ", "")
                for c in all_classrooms:
                    c_name = c.name.lower()
                    c_clean = c_name.replace("-", "").replace(" ", "")
                    if pat == c_name or pat in c_name or pat == c_clean or pat_clean in c_clean:
                        matched.append(c)
            if not matched:
                return {
                    "total_classrooms": 0,
                    "occupied_count": 0,
                    "free_count": 0,
                    "query": {
                        "day_of_week": day_of_week,
                        "day_name": DAY_NAMES.get(day_of_week, "All") if day_of_week else "All",
                        "slot_code": slot_code or "All",
                        "classroom": classroom or "All",
                    },
                    "occupied": [],
                    "free": [],
                }
            all_classrooms = matched

        classroom_map = {c.id: c for c in all_classrooms}

        # 2. Query scheduled exams and their classrooms
        query = (
            select(Exam)
            .options(
                selectinload(Exam.course),
                selectinload(Exam.time_slot),
                selectinload(Exam.classroom_assignments)
                .selectinload(ExamClassroom.class_assignments)
                .selectinload(ExamClassroomClass.class_),
                selectinload(Exam.classroom_assignments).selectinload(ExamClassroom.classroom)
            )
            .where(Exam.status == ExamStatus.SCHEDULED)
        )

        if day_of_week:
            query = query.where(Exam.time_slot.has(day_of_week=day_of_week))
        if slot_code:
            codes = [c.strip() for c in slot_code.split(",") if c.strip()]
            if len(codes) == 1:
                query = query.where(Exam.time_slot.has(slot_code=codes[0]))
            else:
                query = query.where(Exam.time_slot.has(or_(*[TimeSlot.slot_code == c for c in codes])))

        exams_result = await db.execute(query)
        exams = exams_result.scalars().all()

        # 3. Build occupancy map (only for classrooms we care about)
        occupied_classroom_ids = set()
        occupied_details = {}

        for exam in exams:
            ts = exam.time_slot
            for ec in exam.classroom_assignments:
                cid = ec.classroom_id
                # 如果指定了教室过滤，只统计这些教室
                if classroom_filter and cid not in classroom_map:
                    continue
                occupied_classroom_ids.add(cid)
                if cid not in occupied_details:
                    occupied_details[cid] = []
                # 只获取在这个教室考试的班级
                classes = []
                if ec.class_assignments:
                    classes = sorted([
                        ecc.class_.name for ecc in ec.class_assignments
                        if ecc.class_
                    ])
                occupied_details[cid].append({
                    "exam_id": exam.id,
                    "course_name": exam.course.name if exam.course else f"Exam {exam.id}",
                    "exam_label": exam.exam_label.value if exam.exam_label else None,
                    "classes": classes,
                    "day_of_week": ts.day_of_week if ts else 0,
                    "slot_code": ts.slot_code if ts else "T0",
                    "time_str": f"{DAY_NAMES_ZH.get(ts.day_of_week, '')} {ts.start_time}-{ts.end_time}" if ts else "",
                    "student_count": ec.total_students,
                })

        # 4. Categorize results
        result_classroom_value = classroom if classroom else "All"
        result = {
            "total_classrooms": len(all_classrooms),
            "occupied_count": len(occupied_classroom_ids),
            "free_count": len(all_classrooms) - len(occupied_classroom_ids),
            "query": {
                "day_of_week": day_of_week,
                "day_name": DAY_NAMES.get(day_of_week, "All") if day_of_week else "All",
                "slot_code": slot_code or "All",
                "classroom": result_classroom_value,
            },
            "occupied": [],
            "free": [],
        }

        # Occupied classrooms
        for cid in sorted(occupied_classroom_ids):
            c = classroom_map.get(cid)
            if not c:
                continue
            exams_info = sorted(occupied_details[cid], key=lambda x: (x["day_of_week"], x["slot_code"]))
            exam_summary = []
            for info in exams_info:
                exam_summary.append({
                    "course": info["course_name"],
                    "exam_label": info["exam_label"],
                    "classes": info["classes"],
                    "time_str": info["time_str"],
                    "students": info["student_count"],
                })
            result["occupied"].append({
                "id": cid,
                "name": c.name,
                "building": c.building,
                "capacity": c.capacity,
                "type": "Lecture" if c.room_type.value == "lecture" else "Regular",
                "exams": exam_summary,
            })

        # Free classrooms
        for c in all_classrooms:
            if c.id not in occupied_classroom_ids:
                result["free"].append({
                    "id": c.id,
                    "name": c.name,
                    "building": c.building,
                    "capacity": c.capacity,
                    "type": "Lecture" if c.room_type.value == "lecture" else "Regular",
                })

        return result


def format_classroom_status(data: dict) -> str:
    """
    Format classroom data into a human-readable text.
    """
    lines = []
    query = data["query"]

    if query["day_of_week"] is None:
        lines.append("Classroom status overview")
    else:
        lines.append(f"Classroom status: {query['day_name']} {query['slot_code']}")

    lines.append("")
    lines.append(f"Total classrooms: {data['total_classrooms']}")
    lines.append(f"Occupied: {data['occupied_count']}")
    lines.append(f"Free: {data['free_count']}")
    lines.append("")

    if data["free"]:
        lines.append("Free classrooms:")
        for c in data["free"]:
            lines.append(f"  - {c['name']} ({c['building']}) - Capacity: {c['capacity']}")
    else:
        lines.append("No free classrooms available")

    if data["occupied"]:
        lines.append("")
        lines.append("Occupied classrooms:")
        for c in data["occupied"]:
            lines.append(f"  - {c['name']} ({c['building']}) - Capacity: {c['capacity']}")
            for e in c["exams"]:
                classes_str = ", ".join(e["classes"]) if e.get("classes") else "N/A"
                lines.append(f"    * Course: {e['course']}")
                lines.append(f"      Classes: {classes_str}")
                lines.append(f"      Time: {e['time_str']}")
                lines.append(f"      Students: {e['students']}")
                lines.append("")

    return "\n".join(lines)
