import json
import sys
sys.path.insert(0, "/app")

from sqlalchemy import create_engine, text

engine = create_engine("postgresql://scheduler:scheduler@db:5432/exam_scheduler")
with engine.connect() as conn:
    row = conn.execute(text("SELECT data_snapshot FROM schedule_versions WHERE id = 26")).fetchone()
    snap = json.loads(row[0])
    print("=== Violations ===")
    for v in snap.get("violations", []):
        print(v)
    print()
    print("Total exams in snapshot:", len(snap.get("exams", [])))
    course_ids = set(e["course_id"] for e in snap.get("exams", []))
    print("Unique course IDs scheduled:", sorted(course_ids))
    print()
    print("=== Patrol assignments ===")
    for p in snap.get("patrol_teachers", []):
        print(f"Slot {p['time_slot_id']}: teachers {p['teacher_ids']}")
