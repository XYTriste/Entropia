# 考试排考系统

## 系统简介

考试排考系统是一个面向高校学院的智能排考管理平台，专为 **1000-2000人规模** 的学院考试场景设计。

- **适用场景**：中大型学院期末考试、补考、清考等各类考试排考
- **核心能力**：
  - 自动排考引擎（基于OR-Tools约束规划）
  - 手动微调与撤销
  - 教师场次调剂（交换/转移/批量转交）
  - 多维度可视化展示
- **技术特色**：
  - Google OR-Tools 约束规划求解器
  - PostgreSQL 关系型数据库
  - FastAPI 高性能异步框架
  - 轻量级前端（纯HTML/JS，无需构建）

## 功能特性

### 1. 自动排考引擎
基于Google OR-Tools CP-SAT求解器，综合考虑教室容量、时间冲突、教师负荷等多维度约束，在秒级到分钟级内完成千人次规模的排考计算。

### 2. AB卷自动分配
支持同一门课程自动生成A/B两种试卷版本，相邻座位分配不同版本，有效防止作弊。

### 3. 教室资源优化
根据考试人数智能匹配教室容量，阶梯教室优先用于大人数考试，最大化教室利用率。

### 4. 教师负荷均衡
支持设置每位教师的最大监考场次，系统通过软约束优化教师负荷分布，避免个别教师负担过重。

### 5. 多维度可视化
- **总览视图**：全部考试的时间轴展示
- **教师视图**：每位教师的监考安排一览
- **教室视图**：每间教室的使用情况
- **班级视图**：每个班级的考试时间表
- **课程视图**：每门课程的考试分布

### 6. 手动微调与撤销
排考结果支持拖拽调整，所有操作可撤销重做，修改后系统自动进行冲突检测。

### 7. 教师场次调剂
支持三种调剂方式：
- **交换**：两位教师互换指定场次
- **转移**：将某位教师的场次转给另一位
- **批量转交**：将某位教师全部场次转给另一位

### 8. 数据导入导出
- **导入**：支持Excel/CSV格式批量导入教师、教室、课程、班级、学生数据
- **导出**：支持Excel/JSON/SQL多种格式导出排考结果

### 9. 审计日志
完整记录所有排考操作（自动排考、手动调整、教师调剂等），支持按时间范围和操作类型查询。

### 10. 版本管理
排考结果自动版本化，支持保存多个排考方案，可随时切换对比不同版本。

## 系统架构

```
                    +------------------+
                    |     用户浏览器    |
                    +--------+---------+
                             |
                    +--------v---------+
                    |  Nginx (80端口)  |
                    |  - 反向代理       |
                    |  - 静态文件服务   |
                    |  - Gzip压缩      |
                    +--------+---------+
                             |
              +--------------+--------------+
              |                             |
    +---------v---------+       +-----------v---------+
    |  /api/* 反向代理   |       |  /static/ 静态文件  |
    |  -> api:8000      |       |  -> Nginx本地服务   |
    +---------+---------+       +--------------------+
              |
    +---------v---------+
    |  FastAPI 应用      |
    |  - API路由         |
    |  - 业务逻辑         |
    |  - OR-Tools排考    |
    +---------+---------+
              |
    +---------v---------+
    |  PostgreSQL 15     |
    |  - 基础数据         |
    |  - 排考结果         |
    |  - 审计日志         |
    +-------------------+
```

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 后端语言 | Python | 3.11+ |
| Web框架 | FastAPI | 0.100+ |
| ORM | SQLAlchemy | 2.0+ |
| 数据库 | PostgreSQL | 15+ |
| 异步驱动 | asyncpg | 0.28+ |
| 求解器 | Google OR-Tools | 9.7+ |
| 迁移工具 | Alembic | 1.12+ |
| Web服务器 | Nginx | Alpine |
| 容器化 | Docker + docker-compose | - |
| 前端 | HTML5 + Tailwind CSS + Vanilla JS | - |

## 快速开始（Docker方式）

> **前置条件**：已安装 Docker 和 docker-compose

### 1. 克隆项目

```bash
git clone <repository-url>
cd exam-scheduler
```

### 2. 复制环境变量配置

```bash
cp .env.example .env
# 按需编辑 .env 文件，生产环境务必修改 SECRET_KEY
```

### 3. 启动所有服务

```bash
docker-compose up -d
```

服务启动过程：
1. PostgreSQL 数据库容器启动（约5-10秒）
2. 数据库健康检查通过
3. FastAPI 应用容器启动
4. Nginx 反向代理启动

### 4. 初始化数据库

```bash
docker-compose exec api python scripts/init_db.py
```

此步骤将：
- 创建所有数据表
- 插入20个预置考试时段（周一到周五，每天4场）

### 5. 生成测试数据（可选）

```bash
docker-compose exec api python scripts/generate_test_data.py
```

此步骤将生成：
- 5个专业、40个班级、1000名学生
- 50名教师、15个教室、12门课程

### 6. 访问系统

打开浏览器访问：http://localhost

- 系统首页：http://localhost
- API文档：http://localhost/docs
- ReDoc文档：http://localhost/redoc

### 常用Docker命令

```bash
# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f api
docker-compose logs -f db
docker-compose logs -f nginx

# 重启服务
docker-compose restart api

# 停止所有服务
docker-compose down

# 完全清理（含数据卷）
docker-compose down -v

# 重新构建镜像
docker-compose build --no-cache
```

## 手动安装（非Docker方式）

### 环境要求

- Python 3.11+
- PostgreSQL 15+
- pip 包管理器
- git

### 安装步骤

#### 1. 创建Python虚拟环境

```bash
python3.11 -m venv .venv
source .venv/bin/activate  # Linux/Mac
# .venv\Scripts\activate   # Windows
```

#### 2. 安装Python依赖

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

#### 3. 创建PostgreSQL数据库

```bash
# 连接到PostgreSQL
psql -U postgres

# 创建数据库和用户
CREATE USER scheduler WITH PASSWORD 'scheduler';
CREATE DATABASE exam_scheduler OWNER scheduler;
GRANT ALL PRIVILEGES ON DATABASE exam_scheduler TO scheduler;
\q
```

#### 4. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，根据实际情况修改数据库连接地址
```

#### 5. 运行数据库迁移

```bash
alembic upgrade head
```

#### 6. 初始化考试时段数据

```bash
python scripts/init_db.py
```

#### 7. 启动服务

```bash
# 开发模式（热重载）
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 生产模式
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

服务启动后，访问 http://localhost:8000 即可。

## 项目目录结构

```
exam-scheduler/
├── app/                          # FastAPI应用主目录
│   ├── __init__.py
│   ├── main.py                   # FastAPI入口，注册路由和中间件
│   ├── config.py                 # 应用配置（环境变量读取）
│   ├── database.py               # 数据库连接（异步+同步引擎）
│   ├── models/                   # SQLAlchemy数据模型
│   │   ├── __init__.py
│   │   ├── major.py              # 专业模型
│   │   ├── class_group.py        # 班级模型
│   │   ├── teacher.py            # 教师模型
│   │   ├── student.py            # 学生模型
│   │   ├── classroom.py          # 教室模型
│   │   ├── course.py             # 课程模型
│   │   ├── time_slot.py          # 考试时段模型
│   │   ├── exam.py               # 考试安排模型
│   │   ├── audit_log.py          # 审计日志模型
│   │   └── schedule_version.py   # 排考版本模型
│   ├── schemas/                  # Pydantic数据验证模型
│   │   ├── __init__.py
│   │   ├── major.py
│   │   ├── class_group.py
│   │   ├── teacher.py
│   │   ├── student.py
│   │   ├── classroom.py
│   │   ├── course.py
│   │   ├── time_slot.py
│   │   ├── exam.py
│   │   └── audit_log.py
│   ├── crud/                     # 数据库CRUD操作
│   │   ├── __init__.py
│   │   ├── base.py               # 基础CRUD类
│   │   ├── major.py
│   │   ├── class_group.py
│   │   ├── teacher.py
│   │   ├── student.py
│   │   ├── classroom.py
│   │   ├── course.py
│   │   ├── exam.py
│   │   └── audit_log.py
│   ├── routers/                  # API路由
│   │   ├── __init__.py
│   │   ├── majors.py             # 专业管理API
│   │   ├── class_groups.py       # 班级管理API
│   │   ├── teachers.py           # 教师管理API
│   │   ├── students.py           # 学生管理API
│   │   ├── classrooms.py         # 教室管理API
│   │   ├── courses.py            # 课程管理API
│   │   ├── time_slots.py         # 时段管理API
│   │   ├── scheduler.py          # 排考引擎API
│   │   ├── exams.py              # 考试安排API
│   │   ├── audit_logs.py         # 审计日志API
│   │   └── health.py             # 健康检查API
│   ├── engine/                   # OR-Tools排考引擎
│   │   ├── __init__.py
│   │   ├── scheduler.py          # 排考求解器核心
│   │   ├── constraints.py        # 约束定义
│   │   ├── objective.py          # 优化目标
│   │   └── utils.py              # 引擎工具函数
│   ├── services/                 # 业务逻辑层
│   │   ├── __init__.py
│   │   ├── import_service.py     # 数据导入服务
│   │   ├── export_service.py     # 数据导出服务
│   │   └── teacher_transfer.py   # 教师调剂服务
│   ├── utils/                    # 工具函数
│   │   ├── __init__.py
│   │   ├── excel_parser.py       # Excel解析工具
│   │   ├── csv_parser.py         # CSV解析工具
│   │   └── validators.py         # 数据验证工具
│   └── static/                   # 前端静态文件
│       ├── index.html            # 主页入口
│       ├── css/
│       │   └── style.css         # 自定义样式
│       └── js/
│           └── app.js            # 前端应用逻辑
├── tests/                        # 测试目录
│   ├── __init__.py
│   ├── conftest.py               # Pytest配置和夹具
│   ├── test_scheduler.py         # 排考引擎测试
│   ├── test_api.py               # API接口测试
│   └── test_import.py            # 数据导入测试
├── migrations/                   # Alembic数据库迁移
│   ├── versions/                 # 迁移脚本
│   └── env.py                    # 迁移环境配置
├── scripts/                      # 辅助脚本
│   ├── init_db.py                # 数据库初始化
│   └── generate_test_data.py     # 测试数据生成
├── requirements.txt              # Python依赖清单
├── alembic.ini                   # Alembic配置文件
├── Dockerfile                    # Docker多阶段构建
├── docker-compose.yml            # Docker编排
├── nginx.conf                    # Nginx反向代理配置
├── .dockerignore                 # Docker构建忽略
├── .env.example                  # 环境变量模板
├── Makefile                      # 常用命令快捷方式
└── README.md                     # 项目说明文档
```

## API文档

系统启动后，可通过以下地址访问自动生成的API文档：

- **Swagger UI**（交互式API测试）：http://localhost/docs
- **ReDoc**（美观的API文档）：http://localhost/redoc
- **OpenAPI JSON**：http://localhost/openapi.json

### 主要API端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/majors` | CRUD | 专业管理 |
| `/api/class-groups` | CRUD | 班级管理 |
| `/api/teachers` | CRUD | 教师管理 |
| `/api/students` | CRUD | 学生管理 |
| `/api/classrooms` | CRUD | 教室管理 |
| `/api/courses` | CRUD | 课程管理 |
| `/api/time-slots` | CRUD | 时段管理 |
| `/api/scheduler/run` | POST | 执行自动排考 |
| `/api/scheduler/status` | GET | 查询排考状态 |
| `/api/exams` | CRUD | 考试安排管理 |
| `/api/exams/export` | GET | 导出排考结果 |
| `/api/audit-logs` | GET | 审计日志查询 |

## 测试

### 运行全部测试

```bash
# Docker环境
docker-compose exec api pytest tests/ -v

# 本地环境
pytest tests/ -v
```

### 运行指定模块

```bash
pytest tests/test_scheduler.py -v
pytest tests/test_api.py -v
```

### 覆盖率报告

```bash
pytest tests/ --cov=app --cov-report=term-missing
pytest tests/ --cov=app --cov-report=html
# 覆盖率报告将在 htmlcov/index.html 生成
```

### 持续集成测试

```bash
# 完整CI测试流程（lint + test）
make lint
make test
```

## 数据导入格式

### CSV模板说明

系统支持CSV格式批量导入基础数据。以下是各表的字段说明：

#### 教师表（teachers.csv）

| 字段 | 说明 | 类型 | 必填 | 示例 |
|------|------|------|------|------|
| name | 姓名 | 字符串 | 是 | 张三 |
| teacher_type | 教师类型 | 枚举 | 是 | full_time/part_time |
| max_slots | 最大监考场次 | 整数 | 是 | 6 |
| phone | 联系电话 | 字符串 | 否 | 13800138000 |

#### 教室表（classrooms.csv）

| 字段 | 说明 | 类型 | 必填 | 示例 |
|------|------|------|------|------|
| name | 教室名称 | 字符串 | 是 | A101 |
| capacity | 容量 | 整数 | 是 | 50 |
| room_type | 类型 | 枚举 | 是 | regular/tiered |
| building | 所属教学楼 | 字符串 | 否 | A教学楼 |
| floor | 楼层 | 整数 | 否 | 1 |

#### 课程表（courses.csv）

| 字段 | 说明 | 类型 | 必填 | 示例 |
|------|------|------|------|------|
| name | 课程名称 | 字符串 | 是 | 数据结构 |
| code | 课程代码 | 字符串 | 是 | CS201 |
| course_type | 课程类型 | 枚举 | 是 | public/major |
| credits | 学分 | 整数 | 是 | 3 |
| has_ab_paper | 是否有AB卷 | 布尔 | 否 | true |

#### 班级表（class_groups.csv）

| 字段 | 说明 | 类型 | 必填 | 示例 |
|------|------|------|------|------|
| name | 班级名称 | 字符串 | 是 | 计算机科学大一1班 |
| code | 班级代码 | 字符串 | 是 | CLS0001 |
| major_id | 所属专业ID | 整数 | 是 | 1 |
| grade_year | 年级 | 整数 | 是 | 1 |
| student_count | 学生人数 | 整数 | 是 | 30 |

#### 学生表（students.csv）

| 字段 | 说明 | 类型 | 必填 | 示例 |
|------|------|------|------|------|
| name | 姓名 | 字符串 | 是 | 学生001 |
| student_code | 学号 | 字符串 | 是 | STU000001 |
| class_id | 所属班级ID | 整数 | 是 | 1 |

### Excel导入

系统同时支持Excel(.xlsx)格式导入，要求：
- 每个Sheet对应一个数据表
- 第一行为表头（字段名）
- 数据从第二行开始
- 支持多个Sheet同时导入

## 排考流程

### 标准排考流程

```
1. 导入基础数据
   ├── 教师信息（姓名、类型、最大场次）
   ├── 教室信息（名称、容量、类型）
   ├── 课程信息（名称、代码、是否AB卷）
   ├── 班级信息（名称、所属专业、年级）
   └── 学生信息（姓名、学号、所属班级）
           |
           v
2. 配置排考参数
   ├── 标记需要AB卷的课程
   ├── 调整教师可用时段/最大场次
   ├── 禁用不可用教室
   └── 设置求解时间限制
           |
           v
3. 执行自动排考
   ├── 系统根据约束条件求解
   ├── 生成最优排考方案
   └── 显示求解统计信息
           |
           v
4. 查看排考结果
   ├── 总览视图：全部考试一览
   ├── 教师视图：每位教师监考安排
   ├── 教室视图：教室使用情况
   ├── 班级视图：学生考试时间表
   └── 课程视图：每门考试安排
           |
           v
5. 手动微调（如需）
   ├── 拖拽调整考试位置
   ├── 修改监考教师
   ├── 更换教室
   └── 撤销/重做操作
           |
           v
6. 导出结果
   ├── Excel报表
   ├── JSON数据
   └── SQL备份
```

## 教师调剂流程

### 调剂操作步骤

```
1. 进入教师调剂页面
           |
           v
2. 选择调出方教师
   └── 显示该教师当前所有监考场次
           |
           v
3. 选择调入方教师
   └── 系统检查调入方是否还有余量
           |
           v
4. 选择调剂类型
   ├── 交换：双方互换指定场次
   ├── 转移：单方场次转给另一方
   └── 批量转交：全部场次一次性转移
           |
           v
5. 填写调剂原因
   └── 必填，用于审计记录
           |
           v
6. 确认执行
   └── 系统更新数据，记录审计日志
```

### 调剂约束

- 调入方教师剩余场次必须足够
- 调剂后不能导致时间冲突
- 兼职教师不能接收超过其上限的场次
- 所有调剂操作记录审计日志

## 硬约束说明

硬约束是不可违反的规则，求解器必须满足：

| # | 约束名称 | 说明 |
|---|----------|------|
| H1 | 时间互斥 | 同一学生在同一时段只能参加一门考试 |
| H2 | 教室互斥 | 同一教室在同一时段只能安排一场考试 |
| H3 | 教师互斥 | 同一教师在同一时段只能监考一场考试 |
| H4 | 容量限制 | 每场考试人数不能超过教室容量 |
| H5 | 教师上限 | 每位教师监考场次不超过其最大值 |
| H6 | 时段可用 | 只能在预定义的可用时段内排考 |
| H7 | 每课一场 | 同一门课程在同一时段只能安排一场 |
| H8 | AB卷正确 | AB卷必须正确交替分配 |

## 软约束说明

软约束是优化目标，尽量满足但不强制：

| 优先级 | 约束名称 | 说明 | 权重 |
|--------|----------|------|------|
| P1 | 教室匹配 | 优先使用容量接近考试人数的教室 | 80 |
| P2 | 教师均衡 | 教师监考场次尽量均匀分布 | 90 |
| P3 | 时间分散 | 同一学生的多门考试尽量分散 | 70 |
| P4 | 阶梯教室优化 | 大人数考试优先使用阶梯教室 | 75 |
| P5 | 专业聚集 | 同专业考试尽量安排在同一时段 | 60 |
| P6 | 上午优先 | 优先安排上午时段 | 50 |

## 常见问题

### Q: 排考失败怎么办？

**A:** 排考失败通常由以下原因导致：

1. **资源不足**：教室容量总和小于考试人数需求
   - 解决：增加可用教室或减少单场次人数

2. **时间冲突**：硬约束冲突无法避免
   - 解决：增加考试时段，或拆分大班级

3. **求解超时**：问题规模过大
   - 解决：增加 `SCHEDULER_MAX_SOLVE_TIME` 环境变量值

4. **教师不足**：可用教师总数不够
   - 解决：增加兼职教师或放宽教师上限

系统会在排考失败时返回冲突分析报告，根据建议调整参数后重新排考。

### Q: 如何调整已排考的考试？

**A:** 在手动微调页面可以进行以下操作：

1. **拖拽调整**：在时间轴上拖拽考试卡片到新的时段/教室
2. **修改教师**：点击考试卡片，在弹窗中修改监考教师
3. **更换教室**：在考试详情中更换分配教室
4. **撤销操作**：使用Ctrl+Z撤销最近的操作

所有修改都会自动进行冲突检测，如有冲突会给出提示。

### Q: 如何备份排考数据？

**A:** 有多种备份方式：

1. **版本保存**：在排考页面点击"保存版本"，可随时恢复
2. **导出SQL**：导出完整数据库备份
3. **导出Excel**：导出可阅读的Excel报表
4. **容器备份**：备份Docker卷
   ```bash
   docker run --rm -v exam-scheduler-postgres-data:/data -v $(pwd):/backup alpine tar czf /backup/backup.tar.gz -C /data .
   ```

### Q: Docker启动后数据库连接失败？

**A:** 排查步骤：

1. 检查数据库容器是否健康：`docker-compose ps`
2. 查看数据库日志：`docker-compose logs db`
3. 确认环境变量中的数据库地址正确
4. 在Docker环境中应使用 `db` 作为主机名，而非 `localhost`

### Q: 如何升级系统？

**A:** 升级步骤：

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 重建镜像
docker-compose build --no-cache

# 3. 执行数据库迁移
docker-compose up -d db
docker-compose run --rm api alembic upgrade head

# 4. 重启服务
docker-compose up -d
```

## 版本历史

| 版本 | 日期 | 更新内容 |
|------|------|----------|
| v1.0.0 | 2024-01 | 初始版本，核心排考功能 |
| v1.1.0 | 2024-02 | 新增教师调剂功能 |
| v1.2.0 | 2024-03 | 新增多维度可视化 |
| v1.3.0 | 2024-04 | 新增审计日志和版本管理 |

## License

本项目基于 [MIT License](LICENSE) 开源协议发布。

Copyright (c) 2024 Exam Scheduler Team

## 致谢

- [FastAPI](https://fastapi.tiangolo.com/) - 高性能Web框架
- [SQLAlchemy](https://www.sqlalchemy.org/) - Python SQL工具包
- [Google OR-Tools](https://developers.google.com/optimization) - 约束规划求解器
- [PostgreSQL](https://www.postgresql.org/) - 开源关系型数据库
- [Tailwind CSS](https://tailwindcss.com/) - 实用优先CSS框架
