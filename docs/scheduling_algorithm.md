# 排考算法设计文档

> 基于 `app/engine/` 模块代码整理，记录当前排考系统的核心算法逻辑与约束体系。

---

## 一、总体架构

排考引擎采用 **两阶段 + 贪心 + 约束规划（CP-SAT）** 的混合策略：

```
输入（课程、教室、教师、时段）
  │
  ├─ 阶段一：公共课排考（确定性，教务处指定时段）
  │
  ├─ 阶段二：专业课排考（贪心填充空闲时段）
  │
  └─ 阶段三：全局验证与冲突分析（CP-SAT）
        │
        └─ 输出：SchedulingResult（考试安排 + 监考分配 + 违规报告）
```

**核心文件：**
- `app/engine/scheduler.py` — `SchedulingEngine` 主引擎
- `app/engine/teacher_alloc.py` — 教师分配算法（固定监考 + 流动监考）
- `app/engine/classroom_alloc.py` — 教室分配算法
- `app/engine/constraints.py` — 硬约束（HC-01 ~ HC-09）建模
- `app/engine/objectives.py` — 优化目标（软约束）

---

## 二、硬约束（Hard Constraints, HC）

必须满足，否则排考失败或记录违规。

| 编号 | 约束名称 | 说明 | 实现方式 |
|------|---------|------|-----------|
| HC-01 | 同课程同日完成 | 同一门课的所有考试（含AB卷）必须在同一天 | CP-SAT：`AddDivisionEquality` 提取 `day_of_week`，强制相等 |
| HC-02 | 公共课指定时段 | 公共课必须安排在教务处指定的 `dept_assigned_time_slot_id` | CP-SAT：变量等于指定值；调度器层直接按指定时段分配 |
| HC-03 | 教室班级数上限 | 单个教室同一时段内涉及班级数量 ≤ 2 | 贪心分配层保证（每教室最多2个 `class_links`） |
| HC-04 | 教室容量限制 | 教室实际安排人数不得超过其 `capacity` | CP-SAT：`student_count * var <= capacity` |
| HC-05 | 教师场次上限 | 每位教师监考总场次（固定+流动）不超过 `max_slots` | CP-SAT：`sum(assignment_vars) <= max_slots`；分配层实时追踪 `TeacherState.assigned_slots` |
| HC-06 | 流动监考覆盖 | 每个上下午场次对（slot_pair）必须恰好有 `patrol_count` 名流动监考 | CP-SAT：`sum(patrol_vars[slot_pair]) == patrol_count`；调度器层按 `(day_of_week, slot_pair)` 聚合去重 |
| HC-07 | AB卷班级不拆分 | 分AB卷时，同一班级整体划入A卷或B卷，不得拆分 | CP-SAT：`sum(ab_class_vars[course, "A", class], ab_class_vars[course, "B", class]) == 1` |
| HC-08 | 专业课空闲时段 | 专业课只能安排在公共课排完后的空闲时段内 | CP-SAT：`major_exam_var != used_slot`（逐个排除） |
| HC-09 | 排满策略（紧凑性） | 按周一到周五顺序紧凑排考，不允许前面有空洞后面却有考试 | CP-SAT：创建 `slot_used[s]` 布尔变量，约束 `slot_used[s] >= slot_used[s+1]`（不允许后面有前面没有） |

---

## 三、软约束 / 优化目标（Soft Constraints, SC）

影响质量评分，不满足不会直接导致排考失败。

| 编号 | 优化目标 | 说明 | 实现方式 |
|------|---------|------|-----------|
| SC-01 | 负载均衡 | 教师之间的监考场次尽量均匀 | 优先级评分：`assigned_slots` 越低越优先 |
| SC-02 | 连续性优化 | 同一教师的监考日期尽量连续（减少通勤） | `TeacherState.day_continuity_score()` 计算连续性得分，评分越高越优先 |
| SC-03 | 固定监考优先专职 | 固定监考优先从专任教师中抽取 | `_get_available_by_priority(,"full_time",...)` 专职教师排在前面 |
| SC-04 | 流动监考优先兼职 | 流动监考优先从兼职教师中抽取 | `_get_available_by_priority(,"part_time",...)` 兼职教师排在前面 |
| SC-05 | 轮询平局打破 | 当多名教师 `assigned_slots` 和连续性得分相同时，按轮询顺序公平分配 | `TeacherState.last_picked_round` + `PickRound` 共享计数器 |

---

## 四、核心算法逻辑

### 4.1 阶段一：公共课排考（确定性）

```
对每门公共课（按学生总数降序）：
  1. 读取教务处指定的时段 dept_assigned_time_slot_id
  2. 检查指定时段容量是否足够（AB卷需同时检查连续两个时段）
  3. 调用 _schedule_public_course()：
     a. 分配教室（allocate_classrooms）
     b. 分配固定监考（allocate_teachers_fixed）
     c. 分配流动监考（allocate_teachers_patrol）
  4. AB卷：A卷和B卷必须同时成功，否则回退所有资源
```

**关键特性：**
- 公共课时段由教务处硬性指定，引擎不做自由调度
- AB卷占用连续两个时段（T1+T2 或 T3+T4）

---

### 4.2 阶段二：专业课排考（贪心填充）

```
对每门专业课（按学生总数降序）：
  1. 获取所有未被公共课占用的空闲时段（按时间顺序排序）
  2. 如果需要AB卷：
     a. 查找一对连续时段（T1+T2 或 T3+T4）
     b. 分别试分配A卷教室和B卷教室（先预估，再实际分配）
     c. AB卷必须同时成功，否则尝试下一对连续时段
  3. 如果不需要AB卷：
     a. 按时间顺序遍历空闲时段，找到第一个能容纳的时段
  4. 调用 _create_single_exam()：
     a. 分配教室
     b. 分配固定监考
     c. 分配流动监考
  5. 若找不到可用时段或教室不足，记录违规
```

**关键特性：**
- 贪心策略：大课优先（学生总数降序），优先排在前面时段
- 支持多周排考：`exam_weeks` 参数，`exam_start_date` 决定日期

---

### 4.3 教师分配算法

#### 固定监考分配（`allocate_teachers_fixed`）

```
对每间考场：
  1. 计算优先级评分：(assigned_slots, last_picked_round, -continuity_score)
     - assigned_slots 越低越优先（负载均衡）
     - last_picked_round 越小越优先（轮询平局打破）
     - continuity_score 越高越优先（连续性）
  2. 优先专任教师（SC-03），专任教师用尽后使用兼职教师
  3. 检查 HC-05（max_slots 上限）和约束A（最大监考天数）
  4. 若资源不足，触发多级 Fallback：
     Fallback-1：仍优先专职，但禁用最大天数约束
     Fallback-2：任意教师类型，禁用最大天数约束
  5. 分配成功后更新 last_picked_round（PickRound 计数器+1）
```

#### 流动监考分配（`allocate_teachers_patrol`）

```
对每个 slot_pair（上/下午场次对）：
  1. 若同 (day_of_week, slot_pair) 已分配过，直接复用（HC-06）
  2. 计算优先级评分（同固定监考）
  3. 优先兼职教师（SC-04），兼职教师用尽后从专职补充
  4. 检查 HC-05 和约束A
  5. 若资源不足，触发多级 Fallback（同固定监考）
  6. 分配成功后按分组规则（patrol_group_rules）分配分组名称
```

**轮询机制（PickRound）：**
- `PickRound` 是一个跨考试共享的计数器
- 初始值 = 上一次排考的最大轮询序号（`engine._teacher_last_picked` 字典持久化）
- 每次选中一名教师，`state.last_picked_round = pick_round.next()`
- 下轮排序时 `last_picked_round` 越小越优先（最久未被选中的教师优先）
- 解决"同负载同连续性"教师之间的公平分配问题

---

### 4.4 教室分配算法（`allocate_classrooms`）

```
输入：学生总数、班级列表、可用教室列表、排除教室ID集合、优先级规则
输出：每间教室分配的班级及人数

算法：
  1. 过滤出 is_active=True 且不在排除列表中的教室
  2. 按优先级规则排序教室（若有）：
     - 按楼层、容量、名称等规则排序
  3. 贪心分配：
     a. 将班级按学生数降序排列
     b. 依次将班级分配到当前最合适的教室（容量足够且未超过2个班级）
  4. 返回每间教室的 (classroom_id, [ (class, count) ]) 列表
```

**HC-03 保证：** 每间教室最多分配2个班级。

---

### 4.5 阶段三：全局验证（CP-SAT）

使用 **OR-Tools CP-SAT** 求解器对整体排考方案进行验证和优化：

```
1. 构建 CP-SAT 模型
2. 添加所有硬约束（HC-01 ~ HC-09）
3. 添加辅助约束：
   - 每个考试恰好分配一个时段（add_each_exam_one_slot）
   - 一个教室一个时段只能用于一场考试（add_room_no_overlap）
   - 同一班级同一时段不能有两场考试（add_class_no_overlap）
4. 构建优化目标（objectives.py）：
   - 最小化教师负载方差（SC-01）
   - 最大化教师监考日期连续性（SC-02）
   - 其他软约束加权目标
5. 求解：设置最大求解时间（max_solve_time，默认300秒）
6. 提取求解结果，更新排考方案
```

---

## 五、特殊规则

### 5.1 AB卷处理

- AB卷课程：`needs_ab = True`
- 班级拆分：`split_ab_classes(classes)` 将班级按学生数大致均分
- A卷和B卷分别创建 `Exam` 对象，但合并为同一个 `ExamResult`
- `is_ab = True` 的 `ExamResult` 的 `slot_code` 格式为 `T1+T2`
- AB卷必须占用**连续两个时段**（T1+T2 或 T3+T4）

### 5.2 多周排考

- 支持 `exam_weeks` 参数（默认1周）
- `TimeSlot` 新增 `exam_date` 字段（具体日期）
- 时段编号规则不变：`(day_of_week - 1) * 4 + slot_index`
- 跨周段的 `day_of_week` 会重复（第1周周一和第2周周一都是 `day_of_week=1`），此时用 `exam_date` 区分

### 5.3 教师紧张度自适应

- 引擎启动前估算总需求：
  ```
  est_rooms = Σ ceil(课程学生总数 / 平均教室容量)
  est_fixed = est_rooms * fixed_teachers_per_room
  est_patrol = ((总场次 + 1) // 2) * patrol_teacher_count
  ```
- 若 `est_fixed + est_patrol > Σ teacher.max_slots`：
  - 设置 `force_one_teacher_per_room = True`
  - 全局降为每考场1名固定监考（确保能排下去）

---

## 六、冲突报告（ConflictReport）

排考完成后生成冲突报告，包含：

| 字段 | 说明 |
|------|------|
| `total_capacity` | 所有可用教室总容量 |
| `required_capacity` | 所有考试所需总容量 |
| `total_teacher_slots` | 所有教师可提供的总监考场次 |
| `required_teacher_slots` | 所有考试所需的总监考场次 |
| `bottlenecks` | 瓶颈描述列表（如"教室容量紧张"、"教师资源不足"） |
| `suggestions` | 优化建议列表（如"建议增加可用教室"） |

**瓶颈判定规则：**
- 教室利用率 > 80% → 记录瓶颈
- 教师场次缺口 > 0 → 记录瓶颈
- 无任何考试被安排 → 记录严重瓶颈

---

## 七、数据流

```
数据库（PostgreSQL）
  │
  ├─ 课程表（courses）─── 含 course_type（public/major）、needs_ab、dept_assigned_time_slot_id
  ├─ 教室表（classrooms）─── 含 capacity、is_active、room_type、floor
  ├─ 教师表（teachers）─── 含 teacher_type（full_time/part_time）、max_slots
  ├─ 时段表（time_slots）─── 含 day_of_week、slot_code、is_continuous、exam_date
  ├─ 班级表（classes）─── 含 student_count、grade
  │
  ▼
API 层（app/routers/scheduler.py）
  │  读取配置（ScheduleConfig）
  │  转换 ORM 对象 → 引擎数据类
  ▼
引擎层（app/engine/scheduler.py）
  │  SchedulingEngine.run()
  │    │
  │    ├─ 阶段一：_schedule_public_course()
  │    ├─ 阶段二：遍历 major_courses → _create_single_exam()
  │    └─ 阶段三：_build_conflict_report() + _verify_compact_scheduling()
  │
  ▼
结果层（SchedulingResult）
  │  ├─ exams: list[ExamResult]（前端展示用）
  │  ├─ patrol_teachers: list[PatrolResult]（流动监考安排）
  │  ├─ violations: list[str]（违规信息）
  │  ├─ conflict_report: ConflictReport（冲突分析）
  │  └─ raw_exams: list[Exam]（引擎内部对象，用于后续处理）
  ▼
写入数据库（通过 API 层）
```

---

## 八、配置参数（SchedulerConfig）

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `max_solve_time` | int | 300 | CP-SAT 最大求解时间（秒） |
| `fixed_teachers_per_room` | int | 2 | 每考场固定监考人数（资源紧张时降为1） |
| `patrol_teacher_count` | int | 2 | 每时段对流动监考人数 |
| `patrol_group_rules` | list[dict] | None | 流动监考分组规则 |
| `classroom_priority_rules` | list[dict] | None | 教室优先级规则 |
| `enable_max_days_constraint` | bool | True | 是否启用最大监考天数约束 |
| `enable_day_continuity_constraint` | bool | True | 是否启用日期连续性约束 |
| `max_days` | int/None | None | 最大监考天数上限（None=引擎自动计算） |

---

## 九、关键设计决策

1. **两阶段而非全局优化**：公共课时段固定，全局优化空间有限；分阶段可以使用更简单的贪心算法，速度远快于纯CP-SAT。

2. **贪心 + CP-SAT 混合**：贪心处理主要分配（速度快），CP-SAT 处理全局约束验证和局部优化（质量高）。

3. **轮询机制解决公平性**：当多名教师评分相同时，传统算法会始终优先列表前面的教师；`PickRound` 通过持久化轮询状态，实现跨考试的公平轮转。

4. **AB卷原子性**：AB卷的两场考试必须同时成功或同时失败，任何一场失败都会回退所有已分配资源（教室、教师、时段占用）。

5. **流动监考时段对共享**：同一时段对（如周一T1+T2）只分配一次流动监考，后续同对的考试直接复用，避免重复分配和人数不一致。

---

*文档生成时间：2026-05-23*
*对应代码版本：`app/engine/` commit `c8be80f`*
