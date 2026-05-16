# AGENTS.md — 考试排考系统

> 本文件面向 AI 编程助手。阅读者被假设对该项目一无所知。
> 项目主要使用中文编写注释和文档，因此本文件使用中文。

---

## 一、项目概览

**考试排考系统**是一个面向高校学院的智能排考管理平台，专为 **1000–2000 人规模**的学院考试场景设计。

- **核心能力**：自动排考引擎（Google OR-Tools CP-SAT）、手动微调与撤销、教师场次调剂（交换/转移/批量转交）、多维度可视化展示、AB 卷自动分配。
- **目标用户**：高校教务处或学院教学秘书。
- **项目语言**：代码注释、文档、前端界面、API 返回均以中文为主。

---

## 二、技术栈

| 层级 | 技术 | 版本/说明 |
|------|------|----------|
| 后端语言 | Python | 3.11+ |
| Web 框架 | FastAPI | 0.111.0 |
| ORM | SQLAlchemy | 2.0+ |
| 数据库 | PostgreSQL | 15+ |
| 异步驱动 | asyncpg | 0.29.0 |
| 同步驱动 | psycopg2-binary | 2.9.9 |
| 迁移工具 | Alembic | 1.13.1 |
| 求解器 | Google OR-Tools | 9.10.4067 |
| 配置管理 | Pydantic Settings | 2.2.1 |
| 测试框架 | pytest + pytest-asyncio + httpx | — |
| 测试数据 | factory-boy | 3.3.0 |
| 前端 | HTML5 + Tailwind CSS + Vanilla JS | 无构建步骤 |
| 反向代理 | Nginx | Alpine |
| 容器化 | Docker + docker-compose | — |
| Excel 处理 | openpyxl | 3.1.2 |

---

## 三、系统架构

```
用户浏览器
    |
Nginx (80端口) — 反向代理 + 静态文件服务
    |--- /api/*  -> FastAPI (api:8000)
    |--- /static/ -> Nginx 本地文件
    |--- /docs   -> FastAPI Swagger UI
    |
FastAPI 应用
    |
PostgreSQL 15 (db:5432)
```

- **Nginx**：处理静态文件、Gzip、代理超时（排考请求可能长达 300 秒）、SSE 流式响应（`proxy_buffering off`）。
- **FastAPI**：所有业务逻辑、API 路由、排考引擎。
- **PostgreSQL**：基础数据、排考结果、审计日志、排考版本。

---

## 四、目录结构与模块划分

```
exam-scheduler/
├── app/                          # FastAPI 应用主目录
│   ├── main.py                   # 入口：注册路由、CORS、静态文件、生命周期
│   ├── config.py                 # 全局配置（Pydantic Settings，SCHEDULER_ 前缀）
│   ├── database.py               # 异步/同步引擎、SessionLocal、get_db 依赖
│   ├── models/                   # SQLAlchemy ORM 模型（16+ 张表）
│   │   ├── base.py               # declarative_base()
│   │   ├── teacher.py, classroom.py, course.py, class_.py, student.py
│   │   ├── time_slot.py, exam.py, exam_classroom.py, exam_classroom_class.py
│   │   ├── exam_teacher.py, patrol_teacher.py
│   │   ├── schedule_version.py, audit_log.py, schedule_config.py
│   │   └── course_class.py       # 课程-班级多对多关联
│   ├── schemas/                  # Pydantic 请求/响应模型
│   ├── crud/                     # 通用 CRUDBase + 各实体实例
│   │   └── base.py               # CRUDBase[Model, CreateSchema, UpdateSchema]
│   ├── routers/                  # FastAPI APIRouter（14 个模块）
│   │   ├── scheduler.py          # 排考引擎路由（/run, /apply, /status）
│   │   ├── adjustments.py        # 手动微调
│   │   ├── exams.py              # 考试安排管理
│   │   ├── import_export.py      # 数据导入导出
│   │   ├── teachers.py, classrooms.py, courses.py, classes.py
│   │   ├── students.py, majors.py, time_slots.py
│   │   ├── audit_logs.py, chat.py
│   │   └── __init__.py           # 集中导出所有 router
│   ├── engine/                   # OR-Tools 排考核心
│   │   ├── scheduler.py          # 主求解器入口
│   │   ├── constraints.py        # 硬约束定义
│   │   ├── objectives.py         # 软约束/优化目标
│   │   ├── classroom_alloc.py    # 教室分配（支持班级拆分）
│   │   ├── teacher_alloc.py      # 教师分配（固定+流动监考）
│   │   ├── ab_split.py           # AB 卷分组算法
│   │   ├── models.py             # 引擎内部数据结构
│   │   └── test_integration.py   # 引擎集成测试
│   ├── services/                 # 业务逻辑层
│   │   ├── import_service.py     # Excel/CSV 导入
│   │   ├── export_service.py     # Excel/JSON/SQL 导出
│   │   ├── teacher_transfer.py   # 教师调剂
│   │   ├── adjustment_service.py # 手动微调服务
│   │   └── ai_service.py         # AI 助手接口
│   ├── utils/                    # 通用工具
│   ├── tools/                    # 专用工具（classroom_tools.py）
│   └── static/                   # 前端静态文件
│       ├── index.html            # 单页应用入口
│       ├── css/style.css
│       └── js/app.js             # 前端全部逻辑（Vanilla JS）
├── tests/                        # 测试套件
│   ├── conftest.py               # pytest fixtures（SQLite 内存数据库）
│   ├── factories.py              # FactoryBoy 工厂
│   ├── test_scheduler.py         # 排考引擎测试
│   ├── test_api.py               # API 集成测试
│   ├── test_import.py            # 导入功能测试
│   ├── test_adjustment.py        # 微调功能测试
│   ├── test_export.py            # 导出功能测试
│   └── test_models.py            # 模型测试
├── scripts/                      # 辅助脚本
│   ├── init_db.py                # 创建表 + 插入 20 个标准时段
│   └── generate_test_data.py     # 生成示例数据（专业/班级/学生/教师/教室/课程）
├── migrations/                   # Alembic 迁移
│   ├── env.py                    # 从 app.config 读取 DATABASE_SYNC_URL
│   └── versions/                 # 迁移脚本
├── requirements.txt              # Python 依赖
├── alembic.ini                   # Alembic 配置
├── Dockerfile                    # 多阶段构建（builder + runtime）
├── docker-compose.yml            # 三服务编排：db / api / nginx
├── nginx.conf                    # 反向代理配置（注意 SSE 缓冲关闭）
├── Makefile                      # 常用命令快捷方式
├── .env.example                  # 环境变量模板
├── check_violations.py           # 调试脚本：检查排考版本快照中的违规
├── export_results.py             # 独立脚本：从数据库导出 Excel 报表
├── README.md                     # 面向人类用户的完整说明
├── OPERATIONS.md                 # 面向部署人员和最终用户的操作手册
├── PROGRESS.md                   # 开发进度与已知问题备忘录
└── CONTEXT.md                    # 算法修复上下文备忘录
```

---

## 五、环境变量

所有环境变量均以 `SCHEDULER_` 为前缀，通过 `.env` 文件加载。

**关键变量：**

| 变量名 | 说明 |
|--------|------|
| `SCHEDULER_DATABASE_URL` | 异步 PostgreSQL 连接（`postgresql+asyncpg://`） |
| `SCHEDULER_DATABASE_SYNC_URL` | 同步 PostgreSQL 连接（`postgresql://`），用于 Alembic 和脚本 |
| `SCHEDULER_SECRET_KEY` | JWT 签名密钥（生产环境必须修改） |
| `SCHEDULER_MAX_SOLVE_TIME` | 排考引擎最大求解时间（秒，默认 300） |
| `SCHEDULER_DEBUG` | 调试模式（生产环境必须设为 `false`） |

**注意**：`docker-compose.yml` 内部使用服务名 `db` 作为主机名，而非 `localhost`。`.env.example` 中同时提供了宿主机和容器内两种配置示例。

---

## 六、构建与运行

### 6.1 Docker 方式（推荐）

```bash
# 复制环境变量
cp .env.example .env
# 按需编辑 .env，尤其是数据库密码和 SECRET_KEY

# 启动全部服务
docker-compose up -d

# 初始化数据库（创建表 + 20 个标准时段）
docker-compose exec api python scripts/init_db.py

# 生成测试数据（可选）
docker-compose exec api python scripts/generate_test_data.py

# 访问系统
# 前端 http://localhost
# API 文档 http://localhost/docs
```

### 6.2 本地开发方式（非 Docker）

```bash
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # Linux/Mac

pip install -r requirements.txt

# 创建 PostgreSQL 数据库和用户
# 配置 .env
alembic upgrade head
python scripts/init_db.py

# 开发模式（热重载）
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 6.3 Makefile 快捷命令

```bash
make dev         # docker-compose up -d
make build       # 重建镜像
make init-db     # 初始化数据库
make test-data   # 生成测试数据
make test        # 运行测试
make test-cov    # 带覆盖率测试
make lint        # flake8 代码检查
make format      # black + isort 格式化
make migrate     # alembic upgrade head
make clean       # 停止并清理容器和卷
```

---

## 七、数据库与迁移

- **ORM**：SQLAlchemy 2.0，采用 `declarative_base()` 定义模型。
- **异步引擎**：`create_async_engine` + `AsyncSession`，用于 FastAPI 请求处理。
- **同步引擎**：`create_engine` + `NullPool`，用于 Alembic 迁移和后台脚本。
- **迁移工具**：Alembic，`migrations/env.py` 从 `app.config.get_settings()` 读取 `DATABASE_SYNC_URL`。
- **初始化脚本**：`scripts/init_db.py` 在应用模型不可用时回退到原始 SQL。

**核心表清单：**

| 表名 | 说明 |
|------|------|
| `teachers` | 教师（含教师类型、最大场次） |
| `classrooms` | 教室（含容量、类型、楼宇、楼层） |
| `courses` | 课程（含公共课/专业课、是否 AB 卷、教务处指定时段） |
| `classes` | 班级（含专业、年级、学生人数） |
| `students` | 学生 |
| `time_slots` | 考试时段（周一到周五，每天 4 场） |
| `course_classes` | 课程-班级关联（多对多） |
| `exams` | 考试安排（时段、AB 卷标签、状态） |
| `exam_classrooms` | 考试-教室关联（支持一个考试多个教室） |
| `exam_classroom_classes` | 考试-教室-班级关联（记录每个教室里的班级及人数） |
| `exam_teachers` | 考试-教师关联（固定监考） |
| `patrol_teachers` | 流动监考（按时段分配） |
| `schedule_versions` | 排考版本（快照 JSON，草稿/已发布/已归档） |
| `audit_logs` | 审计日志（当前各路由未显式写入，表为空） |

---

## 八、排考引擎核心

引擎代码位于 `app/engine/`，是项目的核心算法模块。

### 8.1 算法流程

1. **数据加载**：从数据库读取教师、教室、课程、班级、学生、时段。
2. **AB 卷分组**：`ab_split.py` 使用动态规划最小化两组人数差，班级不可拆分。
3. **公共课排考**：按教务处指定的 `dept_assigned_date` + `dept_assigned_time_slot_id` 确定性分配。
4. **专业课排考**：贪心 + 约束传播填充空闲时段。
5. **教室分配**：`classroom_alloc.py` 根据人数智能匹配教室容量，支持班级拆分到多个教室（极端情况支持拆到 3 个教室）。
6. **教师分配**：`teacher_alloc.py` 每考场分配 2 名固定监考（优先专任教师），每时段分配 3 名流动监考。
7. **结果持久化**：生成快照 JSON 保存到 `schedule_versions` 表，需调用 `/apply/{id}` 才写入 `exams` 等表。

### 8.2 硬约束（不可违反）

- 同一学生在同一时段只能参加一门考试。
- 同一教室在同一时段只能安排一场考试。
- 同一教师在同一时段只能监考一场考试。
- 每场考试人数不能超过教室容量。
- 每位教师监考场次不超过其最大值。
- 只能在预定义的可用时段内排考。
- 同一门课程在同一时段只能安排一场。
- AB 卷必须正确交替分配。
- 同一教室最多来自 2 个不同班级（混班约束）。

### 8.3 软约束（优化目标）

- 教室匹配（容量接近考试人数）
- 教师负荷均衡
- 同一学生的多门考试时间分散
- 大人数考试优先使用阶梯教室
- 同专业考试尽量安排在同一时段
- 优先安排上午时段

---

## 九、测试策略

### 9.1 测试环境

- **测试数据库**：SQLite 内存数据库（`sqlite+aiosqlite:///:memory:`），确保测试独立且快速。
- **HTTP 客户端**：`httpx.AsyncClient`，通过 `app.dependency_overrides[get_db]` 注入测试会话。
- **测试数据**：`tests/conftest.py` 提供大量 fixtures（35 名专任教师 + 15 名兼职教师、15 个教室、5 个专业、40 个班级、1000 名学生、12 门课程、20 个时段）。
- **工厂模式**：`tests/factories.py` 使用 FactoryBoy 快速生成模型实例。

### 9.2 运行测试

```bash
# Docker 环境
docker-compose exec api pytest tests/ -v

# 本地环境
pytest tests/ -v
pytest tests/ --cov=app --cov-report=term-missing
pytest tests/ --cov=app --cov-report=html   # 报告在 htmlcov/index.html
```

### 9.3 测试模块

| 文件 | 说明 |
|------|------|
| `test_scheduler.py` | 排考引擎单元测试与集成测试 |
| `test_api.py` | API 端点集成测试 |
| `test_import.py` | Excel/CSV 导入功能测试 |
| `test_adjustment.py` | 手动微调与教师调剂测试 |
| `test_export.py` | 导出功能测试 |
| `test_models.py` | ORM 模型基础测试 |

---

## 十、代码风格与开发约定

### 10.1 导入风格

- **绝对导入**：所有模块使用 `from app.models.xxx import ...`，不推荐使用相对导入。
- **集中导出**：每个包（`models/`、`schemas/`、`crud/`、`routers/`）的 `__init__.py` 集中导出公共成员，`main.py` 统一从 `app.routers` 导入。

### 10.2 命名约定

- 模型类：`PascalCase`（如 `ExamClassroomClass`）
- 表名：`snake_case`，复数形式（如 `exam_classroom_classes`）
- 路由函数：`snake_case`
- 环境变量：`SCHEDULER_SNAKE_CASE`

### 10.3 注释与文档

- 所有模块文件头包含中文 docstring，说明文件用途。
- 复杂算法段内嵌中文注释。
- API 路由使用 FastAPI 原生 docstring 生成 OpenAPI 描述。

### 10.4 格式化工具

- **Black**：代码格式化
- **isort**：导入排序
- **flake8**：代码风格检查

Makefile 中已封装：`make lint` 和 `make format`。

---

## 十一、部署与安全

### 11.1 Docker 安全

- Dockerfile 使用多阶段构建（builder + runtime），减小最终镜像体积。
- runtime 阶段创建非 root 用户 `scheduler` 运行应用。
- 安装最小系统依赖（`libgomp1`、`curl`）。
- 健康检查：`curl -f http://localhost:8000/api/health`，连续 3 次失败标记为 unhealthy。

### 11.2 生产环境注意事项

- **必须修改** `.env` 中的 `SCHEDULER_SECRET_KEY` 和 `POSTGRES_PASSWORD`。
- `SCHEDULER_DEBUG` 必须设为 `false`。
- Nginx 配置中 HTTPS 部分被注释掉，如需生产使用需配置 SSL 证书。
- 上传文件大小限制为 50MB（`client_max_body_size`），用于 Excel 导入。

### 11.3 前端缓存

前端 `app.js` 通过查询参数控制缓存版本（如 `app.js?v=12`）。修改前端代码后，记得更新 `index.html` 中的版本号，否则用户可能加载旧代码。

---

## 十二、已知问题与注意事项

1. **审计日志为空**：`audit_logs` 表存在，但当前各路由未在增删改操作中显式写入审计记录（P2 待优化项）。
2. **前端中文乱码**：部分接口返回中文偶尔出现乱码（控制台正常），可能与编码配置有关。
3. **排考同步执行**：当前排考引擎在请求线程中同步运行，大数量级时应改为后台 Celery 任务（P3 待优化）。
4. **排考结果必须先应用**：自动排考生成的是 `schedule_versions` 草稿，必须调用 **"应用此排考结果"**（`/api/scheduler/apply/{id}`）才会将数据写入 `exams` / `exam_classrooms` / `exam_teachers` / `patrol_teachers` 表。否则排考结果页面和导出 Excel 将为空。
5. **时段数据是前置条件**：`time_slots` 表必须有 20 条标准数据（周一到周五每天 4 场）。如果时段被误删，可通过前端 "导入导出" 页面重置，或调用 `POST /api/import-export/init-time-slots`。
6. **CONTEXT.md 与 PROGRESS.md**：这两个文件是前一轮会话留下的上下文备忘录，记录了特定 bug 的修复过程和数据库实际数据。修改排考引擎前应优先阅读 `CONTEXT.md`。

---

## 十三、常用调试命令

```bash
# 查看容器状态
docker-compose ps

# 查看 API 日志（最近 100 行）
docker-compose logs api --tail=100

# 进入数据库
docker-compose exec db psql -U scheduler -d exam_scheduler

# 检查 exams 表是否有数据
docker-compose exec db psql -U scheduler -d exam_scheduler -c "SELECT COUNT(*) FROM exams;"

# 手动运行初始化
docker-compose exec api python scripts/init_db.py

# 检查排考版本快照中的违规（本地调试）
python check_violations.py   # 需要 SCHEDULER_DATABASE_SYNC_URL 环境变量
```

---

## 十四、AI 助手操作建议

- **修改模型时**：同步修改对应的 `schemas/` 和 `crud/`；如变更数据库结构，需生成 Alembic 迁移（`alembic revision --autogenerate -m "描述"`）。
- **修改引擎时**：优先阅读 `CONTEXT.md` 和 `PROGRESS.md`，了解当前算法状态和数据约束。
- **修改路由时**：检查是否需要同步更新前端 `app/static/js/app.js` 中的 URL 和字段路径。前端大量使用 `data.data` unwrap 模式。
- **新增测试时**：在 `tests/conftest.py` 补充 fixtures，或使用 `tests/factories.py` 的工厂类。
- **任何修改后**：运行 `make test` 确保测试通过；如修改了前端静态文件，考虑更新 `index.html` 中的 `app.js?v=` 版本号。
