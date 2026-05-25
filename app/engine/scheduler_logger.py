"""
排考引擎调试日志模块 — 直接输出到 stdout（Docker 日志可见）
"""

import os
import sys
from datetime import datetime
from typing import Any


def _resolve_log_dir() -> str:
    """解析可用的日志目录，支持环境变量覆盖和自动 fallback"""
    env_dir = os.environ.get("SCHEDULER_LOG_DIR")
    if env_dir:
        return env_dir

    candidates = [
        os.path.join(os.getcwd(), "logs", "scheduler"),
        "/tmp/logs/scheduler",
        "/var/tmp/logs/scheduler",
    ]
    for d in candidates:
        try:
            os.makedirs(d, exist_ok=True)
            test_file = os.path.join(d, ".write_test")
            with open(test_file, "w") as f:
                f.write("1")
            os.remove(test_file)
            return d
        except (OSError, PermissionError):
            continue

    return os.getcwd()


# ============================================================
# 文件句柄（按需打开，写一行刷新一行）
# ============================================================

_fh = None
_log_file: str | None = None


def _ensure_fh():
    """确保有一个可写的文件句柄，每次写入后刷新"""
    global _fh, _log_file
    if _fh is None:
        log_dir = _resolve_log_dir()
        if _log_file is None:
            timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
            _log_file = os.path.join(log_dir, f"scheduler_{timestamp}.log")
        _fh = open(_log_file, "a", encoding="utf-8")
    return _fh


# ============================================================
# 格式化辅助函数
# ============================================================

def _fmt_bool(v: bool) -> str:
    return "是" if v else "否"


def _fmt_set(s: set) -> str:
    return ",".join(str(x) for x in sorted(s)) if s else "-"


# ============================================================
# 主日志函数
# ============================================================

def log_exam_allocation(
    exam_count: int,
    exam: Any,
    teacher_states: list,
    fixed_teachers: list,
    patrol_teachers: list,
    alloc_decisions: list[dict],
) -> None:
    """
    记录一场考试分配完成后的完整快照。
    同时输出到 stdout（Docker logs 可见）和日志文件。
    """
    lines: list[str] = []
    sep = "=" * 80

    lines.append("")
    lines.append(sep)
    lines.append(f"【第 {exam_count} 场考试】")
    lines.append(sep)

    # --------------------------------------------------------
    # 1. 考试基本信息
    # --------------------------------------------------------
    lines.append("")
    lines.append("--- 考试信息 ---")
    course_name = (
        getattr(exam.course, "name", f"课程{exam.course_id}")
        if exam.course
        else f"课程{exam.course_id}"
    )
    label = exam.exam_label if exam.exam_label else "-"
    ts = exam.time_slot
    ts_str = f"周{ts.day_of_week} {ts.slot_code} ({ts.start_time}-{ts.end_time})"
    if ts.exam_date:
        ts_str += f" 日期={ts.exam_date}"

    lines.append(f"  课程: {course_name} (ID={exam.course_id}, 标签={label})")
    lines.append(f"  时段: {ts_str}")

    room_lines = []
    for ec in exam.classroom_assignments:
        room = getattr(ec, "classroom", None)
        room_name = (
            getattr(room, "name", f"教室{ec.classroom_id}")
            if room
            else f"教室{ec.classroom_id}"
        )
        cap = getattr(room, "capacity", "?") if room else "?"
        room_lines.append(f"{room_name}(容量{cap}, {ec.total_students}人)")
    lines.append(f"  教室: {'; '.join(room_lines)}")

    # --------------------------------------------------------
    # 2. 该场考试分配的教师
    # --------------------------------------------------------
    lines.append("")
    lines.append("--- 本场分配教师 ---")
    for ft in fixed_teachers:
        room = f"教室{ft.classroom_id}" if ft.classroom_id else "-"
        lines.append(
            f"  [固定] ID={ft.teacher_id:3d} 姓名={ft.teacher_name:8s} 教室={room}"
        )
    for pt in patrol_teachers:
        lines.append(
            f"  [流动] ID={pt.teacher_id:3d} 姓名={pt.teacher_name:8s}"
        )

    # --------------------------------------------------------
    # 3. 分配决策信息
    # --------------------------------------------------------
    if alloc_decisions:
        lines.append("")
        lines.append("--- 分配决策 ---")
        for dec in alloc_decisions:
            role = dec.get("role", "?")
            lines.append(
                f"  [{role}] candidates前5: {dec.get('candidates_top5', [])}"
            )
            lines.append(
                f"  [{role}] fallback: {dec.get('fallback_triggered', '否')} "
                f"级别={dec.get('fallback_level', '-')}"
            )

    # --------------------------------------------------------
    # 4. 所有教师状态表
    # --------------------------------------------------------
    lines.append("")
    lines.append("--- 教师状态快照 ---")
    header = (
        f"{'ID':>4} │ {'姓名':>8} │ {'类型':>6} │ "
        f"{'已排场次':>6} │ {'已排天数':>6} │ {'剩余场次':>6} │ {'已满':>4} │ {'last_picked':>11}"
    )
    lines.append(header)
    lines.append("-" * len(header))

    full_time = [
        s for s in teacher_states if s.teacher.teacher_type == "full_time"
    ]
    part_time = [
        s for s in teacher_states if s.teacher.teacher_type == "part_time"
    ]
    full_time.sort(key=lambda s: (-s.assigned_slots, s.teacher.id))
    part_time.sort(key=lambda s: (-s.assigned_slots, s.teacher.id))

    for s in full_time:
        lines.append(
            f"{s.teacher.id:>4d} │ {s.teacher.name:>8s} │ {'专任':>6s} │ "
            f"{s.assigned_slots:>6d} │ {len(s.assigned_days):>6d} │ {s.remaining:>6d} │ {_fmt_bool(s.is_full):>4s} │ {s.last_picked_round:>11d}"
        )
    for s in part_time:
        lines.append(
            f"{s.teacher.id:>4d} │ {s.teacher.name:>8s} │ {'兼任':>6s} │ "
            f"{s.assigned_slots:>6d} │ {len(s.assigned_days):>6d} │ {s.remaining:>6d} │ {_fmt_bool(s.is_full):>4s} │ {s.last_picked_round:>11d}"
        )

    # --------------------------------------------------------
    # 5. 统计摘要
    # --------------------------------------------------------
    total_full = sum(s.assigned_slots for s in full_time)
    total_part = sum(s.assigned_slots for s in part_time)
    total_all = total_full + total_part

    lines.append("")
    lines.append("--- 统计摘要 ---")
    full_avg = f"{total_full / len(full_time):.1f}" if full_time else "N/A"
    part_avg = f"{total_part / len(part_time):.1f}" if part_time else "N/A"
    lines.append(
        f"  全体教师: 总场次={total_all} "
        f"(本场固定={len(fixed_teachers)}, 本场流动={len(patrol_teachers)})"
    )
    lines.append(
        f"  专任教师: 总场次={total_full}, 平均={full_avg}场/人 (人数={len(full_time)})"
    )
    lines.append(
        f"  兼任教师: 总场次={total_part}, 平均={part_avg}场/人 (人数={len(part_time)})"
    )
    lines.append(sep)

    text = "\n".join(lines)

    # 1. 输出到 stdout（Docker logs 可见）
    try:
        print(text, flush=True)
    except Exception:
        pass

    # 2. 同时追加到日志文件
    try:
        fh = _ensure_fh()
        fh.write(text + "\n")
        fh.flush()
    except Exception:
        pass
