import json
import os
import sys
sys.path.insert(0, "/app")

from sqlalchemy import create_engine, text

db_url = os.environ.get("SCHEDULER_DATABASE_SYNC_URL")
if not db_url:
    raise RuntimeError(
        "未找到环境变量 SCHEDULER_DATABASE_SYNC_URL。"
        "请在 .env 文件中配置数据库连接信息，参考 .env.example。"
    )
engine = create_engine(db_url)
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
