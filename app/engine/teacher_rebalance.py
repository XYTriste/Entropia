"""
教师分配后处理 — CP-SAT 负载均衡优化

在贪心排考完成后，对固定监考教师分配做全局优化，
最小化教师场次的极差（max - min）。

约束：
- 每个教室固定监考人数不变
- 同一教师同一时段最多监考一个教室
- 每个教师总场次 <= max_slots
- 每个教师监考天数 <= max_days（若启用）

目标：minimize(max_count - min_count)
"""

from collections import defaultdict

from ortools.sat.python import cp_model


def rebalance_fixed_teachers(
    all_exams: list,
    teachers: list,
    max_days: int | None = None,
    time_limit_seconds: float = 30.0,
) -> None:
    """
    对 all_exams 中的固定监考分配进行 CP-SAT 全局重平衡。
    直接修改 exam.teacher_assignments 中的 fixed 角色记录。

    参数:
        all_exams: 所有 Exam 对象（已含教室分配）
        teachers: 所有 Teacher 对象
        max_days: 最大监考天数上限（None 表示不限制）
        time_limit_seconds: CP-SAT 求解时间上限
    """
    from app.models.exam_teacher import ExamTeacher

    # ============================================================
    # 1. 收集所有固定监考槽位 & 原始日期分布
    # ============================================================
    slots: list[dict] = []
    # 记录每位教师在原始分配中已监考的 fixed 日期，用于连续性软约束
    orig_fixed_days: dict[int, set[int]] = {t.id: set() for t in teachers}
    for exam in all_exams:
        ts_id = exam.time_slot_id if exam.time_slot else None
        dow = exam.time_slot.day_of_week if exam.time_slot else None

        # 按教室统计当前固定监考人数
        fixed_by_room: dict[int, int] = defaultdict(int)
        for ta in exam.teacher_assignments:
            role = ta.role.value if hasattr(ta.role, "value") else ta.role
            if role == "fixed" and ta.classroom_id is not None:
                fixed_by_room[ta.classroom_id] += 1
                if dow is not None and ta.teacher_id in orig_fixed_days:
                    orig_fixed_days[ta.teacher_id].add(dow)

        for cid, needed in fixed_by_room.items():
            if needed > 0:
                slots.append({
                    "exam": exam,
                    "classroom_id": cid,
                    "time_slot_id": ts_id,
                    "day_of_week": dow,
                    "needed": needed,
                })

    if not slots:
        return

    teacher_by_id = {t.id: t for t in teachers}
    teacher_ids = list(teacher_by_id.keys())
    num_slots = len(slots)

    # ============================================================
    # 2. 构建 CP-SAT 模型
    # ============================================================
    model = cp_model.CpModel()

    # x[s][t] = 1 表示教师 t 分配到槽位 s
    x: dict[tuple[int, int], cp_model.IntVar] = {}
    for s_idx in range(num_slots):
        for tid in teacher_ids:
            x[(s_idx, tid)] = model.NewBoolVar(f"x_s{s_idx}_t{tid}")

    # --- 约束 1：每个槽位恰好 needed 个教师 ---
    for s_idx, slot in enumerate(slots):
        model.Add(
            sum(x[(s_idx, tid)] for tid in teacher_ids) == slot["needed"]
        )

    # --- 约束 2：同一时段同一教师最多一个槽位 ---
    slots_by_time: dict[int | None, list[int]] = defaultdict(list)
    for s_idx, slot in enumerate(slots):
        slots_by_time[slot["time_slot_id"]].append(s_idx)

    for ts_id, s_indices in slots_by_time.items():
        if ts_id is None:
            continue
        for tid in teacher_ids:
            model.Add(sum(x[(s_idx, tid)] for s_idx in s_indices) <= 1)

    # --- 约束 3：每个教师总场次 <= max_slots ---
    for tid in teacher_ids:
        t = teacher_by_id[tid]
        model.Add(sum(x[(s_idx, tid)] for s_idx in range(num_slots)) <= t.max_slots)

    # --- 约束 4：日期使用变量（无条件创建，用于连续性软约束）---
    # y[t][ts] = 1 表示教师 t 在时段 ts 有至少一个槽位
    y_vars: dict[tuple[int, int], cp_model.IntVar] = {}
    for tid in teacher_ids:
        for ts_id, s_indices in slots_by_time.items():
            if ts_id is None:
                continue
            y_vars[(tid, ts_id)] = model.NewBoolVar(f"y_t{tid}_ts{ts_id}")
            assigned_in_ts = sum(x[(s_idx, tid)] for s_idx in s_indices)
            model.Add(y_vars[(tid, ts_id)] <= assigned_in_ts)
            model.Add(y_vars[(tid, ts_id)] * len(s_indices) >= assigned_in_ts)

    # 按 day_of_week 分组时段
    ts_ids_by_day: dict[int | None, list[int]] = defaultdict(list)
    for ts_id, s_indices in slots_by_time.items():
        if ts_id is None:
            continue
        day = slots[s_indices[0]]["day_of_week"] if s_indices else None
        ts_ids_by_day[day].append(ts_id)

    teacher_day_vars: dict[int, list[tuple[int, cp_model.IntVar]]] = {}
    for tid in teacher_ids:
        day_used_vars = []
        for day, ts_ids in ts_ids_by_day.items():
            if day is None:
                continue
            dvar = model.NewBoolVar(f"dayused_t{tid}_d{day}")
            y_sum = sum(y_vars[(tid, ts_id)] for ts_id in ts_ids)
            model.Add(dvar <= y_sum)
            model.Add(dvar * len(ts_ids) >= y_sum)
            day_used_vars.append((day, dvar))
        teacher_day_vars[tid] = day_used_vars
        if max_days is not None:
            model.Add(sum(dvar for _, dvar in day_used_vars) <= max_days)

    # ============================================================
    # 3. 目标：最小化加权综合目标
    # ============================================================
    counts: dict[int, cp_model.IntVar] = {}
    for tid in teacher_ids:
        counts[tid] = model.NewIntVar(
            0, teacher_by_id[tid].max_slots, f"count_t{tid}"
        )
        model.Add(
            counts[tid] == sum(x[(s_idx, tid)] for s_idx in range(num_slots))
        )

    max_slots_val = max(t.max_slots for t in teachers)
    max_count = model.NewIntVar(0, max_slots_val, "max_count")
    min_count = model.NewIntVar(0, max_slots_val, "min_count")

    for tid in teacher_ids:
        model.Add(max_count >= counts[tid])
        model.Add(min_count <= counts[tid])

    # 3.1 负载均衡项：max_count - min_count
    balance_gap = model.NewIntVar(-max_slots_val, max_slots_val, "balance_gap")
    model.Add(balance_gap == max_count - min_count)

    # 3.2 日期连续性惩罚：教师被分配到原始日期之外的新日期
    new_day_penalties: list[cp_model.IntVar] = []
    for tid, day_vars in teacher_day_vars.items():
        for day, dvar in day_vars:
            if day not in orig_fixed_days.get(tid, set()):
                new_day_penalties.append(dvar)
    new_day_penalty = model.NewIntVar(0, max(len(new_day_penalties), 1), "new_day_penalty")
    if new_day_penalties:
        model.Add(new_day_penalty == sum(new_day_penalties))
    else:
        model.Add(new_day_penalty == 0)

    # 3.3 加权综合目标：BALANCE_WEIGHT=100, CONTINUITY_WEIGHT=15
    total_obj = model.NewIntVar(
        0,
        max_slots_val * 100 + len(new_day_penalties) * 15,
        "total_objective",
    )
    model.Add(total_obj == balance_gap * 100 + new_day_penalty * 15)
    model.Minimize(total_obj)

    # ============================================================
    # 4. 求解
    # ============================================================
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit_seconds
    solver.parameters.num_search_workers = 8
    solver.parameters.relative_gap_limit = 0.05  # 5% 间隙即可接受

    status = solver.Solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        # 求解失败，保留原分配
        return

    # ============================================================
    # 5. 应用结果
    # ============================================================
    # 移除所有旧的 fixed 分配
    for exam in all_exams:
        exam.teacher_assignments = [
            ta for ta in exam.teacher_assignments
            if (ta.role.value if hasattr(ta.role, "value") else ta.role) != "fixed"
        ]

    # 添加新的 fixed 分配
    for s_idx, slot in enumerate(slots):
        exam = slot["exam"]
        for tid in teacher_ids:
            if solver.Value(x[(s_idx, tid)]) == 1:
                exam.teacher_assignments.append(
                    ExamTeacher(
                        exam_id=exam.id,
                        teacher_id=tid,
                        role="fixed",
                        classroom_id=slot["classroom_id"],
                    )
                )
