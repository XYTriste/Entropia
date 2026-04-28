# 考试排考系统 — 开发进度报告

> 生成时间：2026-04-28  
> 当前状态：**核心功能已跑通，支持班级拆分排考，10门课程0冲突成功排考**

---

## 一、项目概况

| 项目 | 说明 |
|------|------|
| 技术栈 | FastAPI + SQLAlchemy 2.0 + PostgreSQL 15 + Vanilla JS + Nginx |
| 部署方式 | Docker Compose |
| 核心引擎 | OR-Tools CP-SAT + 贪心分配算法 |
| 前端缓存 | `app.js?v=12` |

---

## 二、已修复/已完成的功能

### 2.1 排考引擎核心

| # | 功能 | 状态 | 说明 |
|---|------|------|------|
| 1 | 公共课排考 | ✅ | 按教务处指定日期+时段 deterministic 分配 |
| 2 | 专业课排考 | ✅ | 贪心+约束传播填充空闲时段 |
| 3 | AB卷自动分卷 | ✅ | 动态规划最小化两组人数差，班级不可拆分 |
| 4 | **教室分配（班级拆分）** | ✅ | 50人班可拆到两个28人教室（25+25），极端情况支持拆到3个教室 |
| 5 | 教室容量约束 HC-04 | ✅ | 每教室总人数 ≤ capacity |
| 6 | 混班约束 HC-03 | ✅ | 同一教室最多来自2个不同班级 |
| 7 | 固定监考分配 | ✅ | 每考场2名固定监考，优先专任教师 |
| 8 | 流动监考分配 | ✅ | 每时段3名流动监考 |
| 9 | 排考结果持久化 | ✅ | 应用版本时将快照写入 `exams`/`exam_classrooms`/`exam_teachers`/`patrol_teachers` |

### 2.2 前端页面与交互

| # | 页面 | 状态 | 说明 |
|---|------|------|------|
| 1 | 仪表盘 | ✅ | 统计卡片、最新版本号、操作记录 |
| 2 | 自动排考 | ✅ | 课程选择、策略选择、进度条、停止按钮、结果展示、应用按钮 |
| 3 | 排考结果 | ✅ | 总览矩阵、教师甘特图、教室矩阵、班级视图、课程视图 |
| 4 | 手动微调 | ✅ | 时段调整、教室更换、教师更换、教师对调 |
| 5 | 基础数据 | ✅ | 教师/教室/课程/班级/学生/专业/时段 — 增删改查+批量删除 |
| 6 | 导入导出 | ✅ | Excel模板下载、Excel批量导入、JSON/SQL/Excel导出 |
| 7 | 审计日志 | ✅ | 多维度过滤、分页（数据为空是因为尚未产生审计记录） |

### 2.3 关键 Bug 修复清单

#### 后端
- `CourseClass.__init__` 缺少 `class_id` 参数
- `Classroom.__init__` 缺少 `is_active` 参数
- `teacher_alloc` 模块绝对导入导致 `ModuleNotFoundError`
- `apply_schedule_version` 仅改状态未持久化到 `exams` 表
- snapshot 缺少 `class_ids` 导致 `ExamClassroomClass` 无法创建
- AB卷合并导致教室/教师/巡逻监考重复，触发唯一约束冲突

#### 前端
- `fetch` body 被 `defaultOptions` 覆盖（批量删除 422 的根源）
- `App.api.get` 返回 `{code, data}`，多处代码未 unwrap `data.data`
- 排考状态轮询未正确读取 `job_id`、`solve_time`、`version_id`
- `applyScheduleResult` URL 与后端路由不匹配（`/versions/{id}/apply` vs `/apply/{id}`）
- select-all checkbox 不同步
- edit modal 在 `hideModal` 之后才读取 DOM 导致空值

---

## 三、已知待优化项

| 优先级 | 事项 | 说明 |
|--------|------|------|
| P2 | 审计日志自动写入 | 当前 `audit_logs` 表为空，需要在各路由的增删改操作中显式写入 |
| P2 | 前端国际化/字符编码 | 部分接口返回中文出现乱码（控制台显示正常，前端偶尔乱码） |
| P3 | 排考引擎性能 | 当前同步执行，大数量级时应改为后台 Celery 任务 |
| P3 | 结果展示详情 | 总览矩阵仅显示课程名，可补充教室名、监考教师 |
| P3 | 数据校验增强 | Excel导入时的字段类型校验、教室容量冲突预警 |

---

## 四、测试验证

### 最近一次端到端测试

```bash
POST /api/scheduler/run  {strategy: "full"}
→ 200 OK
→ status: "completed"
→ exams_scheduled: 10
→ violations: []

POST /api/scheduler/apply/9
→ 200 OK
→ exams=10, exam_classrooms=97, exam_teachers=133, patrol_teachers=40

GET /api/import-export/export/excel
→ 200 OK, content-length: 25,656 bytes
```

---

## 五、文件变更摘要

```
app/engine/classroom_alloc.py      # 完全重写，支持班级拆分
app/engine/scheduler.py             # 修复导入、snapshot补充class_ids
app/engine/models.py                # 无变更（仅确认字段定义）
app/routers/scheduler.py            # 修复CourseClass/Classroom构造、重写apply_schedule_version
app/services/export_service.py      # 无变更
app/static/js/app.js                # 大量unwrap修复、URL修复、字段路径修复
app/static/index.html               # 缓存版本 v=12
app/routers/courses.py              # 无变更
app/routers/students.py             # 无变更
```
