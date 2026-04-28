# 考试排考系统 — 操作手册

> 本手册面向部署人员和最终用户，涵盖环境搭建、日常操作、常见问题排查。

---

## 目录

1. [环境要求](#一环境要求)
2. [首次部署](#二首次部署)
3. [日常启停](#三日常启停)
4. [基础数据维护](#四基础数据维护)
5. [排考完整流程](#五排考完整流程)
6. [结果查看与导出](#六结果查看与导出)
7. [手动微调](#七手动微调)
8. [常见问题 FAQ](#八常见问题-faq)

---

## 一、环境要求

| 组件 | 版本 | 说明 |
|------|------|------|
| Docker Desktop | ≥ 4.20 | Windows 需开启 WSL2 后端 |
| Docker Compose | ≥ 2.20 | 通常随 Docker Desktop 安装 |
| Git | 任意 | 用于克隆/更新代码 |
| 浏览器 | Chrome/Edge/Firefox 最新版 | 前端为 Vanilla JS，无框架依赖 |

**端口占用检查**：
- 确保本机 **80 端口** 未被占用（Nginx 使用）
- 确保本机 **5432 端口** 未被其他 PostgreSQL 占用（若被占用，docker-compose 内部映射不会冲突，但宿主机 psql 直连会走本地实例）

---

## 二、首次部署

### 2.1 进入项目目录

```powershell
cd D:\Code\best_exam_scheduler\exam-scheduler
```

### 2.2 启动服务

```powershell
docker-compose up -d
```

首次启动会执行：
1. 拉取 `postgres:15-alpine`、`nginx:alpine`、构建 FastAPI 镜像
2. 创建数据库表（`Base.metadata.create_all`）
3. 运行 `init_db.py` 初始化标准时段（周一到周五 4 场/天，共 20 个时段）

### 2.3 验证启动

```powershell
# 查看容器状态
docker-compose ps

# 应看到 3 个容器均为 Up (healthy)
# - exam-scheduler-api
# - exam-scheduler-db
# - exam-scheduler-nginx
```

浏览器访问：
- **前端页面**：`http://localhost`
- **API 文档（Swagger）**：`http://localhost/api/docs`
- **健康检查**：`http://localhost/api/health`

### 2.4 初始化标准时段（如需要）

如果数据库中的时段被误删或需要重置：

```powershell
# 方法1：通过前端导入页面 → 重置标准时段
# 方法2：直接调用 API
Invoke-RestMethod -Uri "http://localhost/api/import-export/init-time-slots" -Method POST
```

### 2.5 导入基础数据（推荐顺序）

1. **专业**（Majors）
2. **班级**（Classes）
3. **学生**（Students）
4. **教师**（Teachers）
5. **教室**（Classrooms）
6. **课程**（Courses）
7. **课程-班级关联**（CourseClasses）

支持两种方式：
- **Excel 模板导入**：前端 "导入导出" 页面 → 下载模板 → 填写后上传
- **单条增删改查**：各基础数据页面的表单

---

## 三、日常启停

```powershell
# 启动
docker-compose up -d

# 停止
docker-compose down

# 查看日志（实时）
docker-compose logs -f api

# 重启 API（代码热更新通常自动生效，无需手动重启）
docker-compose restart api
```

> **热更新说明**：`app/` 和 `app/static/` 已挂载为 Docker Volume，修改本地文件后 API 会自动重载（Uvicorn `--reload`）。

---

## 四、基础数据维护

### 4.1 页面入口

前端导航栏 → "基础数据" → 选择子标签：
- 教师管理
- 教室管理
- 课程管理
- 班级管理
- 学生管理
- 专业管理
- 时段管理

### 4.2 Excel 批量导入

1. 进入 "导入导出" 页面
2. 选择导入类型（教师/教室/课程/班级/学生/课程班级关联/时段）
3. 点击 "下载模板"
4. 按模板说明填写（必填项标 `*`）
5. 上传文件，系统会返回成功/失败报告

### 4.3 批量删除

1. 在表格左侧勾选需要删除的行
2. 点击表头 "全选" 可批量勾选当前页
3. 点击 "批量删除" 按钮

---

## 五、排考完整流程

### Step 1：确认基础数据完整

- 课程列表中，公共课必须填写 **"分配日期"** 和 **"分配时段"**
- 需要 AB 卷的课程，勾选 **"需要AB卷"**
- 教室容量总和应 ≥ 最大考试人数（系统会自动拆分班级到多个教室）
- 教师数量应 ≥ 考场数 × 2（固定监考） + 时段数 × 3（流动监考）

### Step 2：进入自动排考页面

前端 → "自动排考"

### Step 3：选择课程与策略

| 策略 | 说明 |
|------|------|
| `full`（全部） | 公共课 + 专业课一起排 |
| `public_only` | 仅排公共课 |
| `major_only` | 仅排专业课 |

- 勾选需要排考的课程（留空则排全部）
- 点击 "开始自动排考"

### Step 4：等待排考完成

- 进度条实时更新
- 可随时点击 "停止排考" 取消（仅停止前端轮询，后端同步任务会继续执行完毕）

### Step 5：查看结果摘要

排考完成后，页面会显示：
- 求解耗时
- 排考版本号
- 安排考试数
- 冲突/违规列表（如有）

### Step 6：应用排考结果

点击 **"应用此排考结果"** 按钮：
- 将当前版本标记为 **已发布**
- 自动归档上一个已发布版本
- 将排考数据写入 `exams` / `exam_classrooms` / `exam_teachers` / `patrol_teachers` 表

> ⚠️ **必须先点击"应用"，否则排考结果页面和导出 Excel 将为空。**

---

## 六、结果查看与导出

### 6.1 排考结果页面

前端 → "排考结果" → 切换子视图：

| 视图 | 内容 |
|------|------|
| 总览矩阵 | 日期 × 时段 二维表格，直观显示每场考试 |
| 教师监考 | 每位教师的监考安排时间轴 |
| 教室矩阵 | 每个教室的占用情况 |
| 班级视图 | 每个班级的考试安排 |
| 课程视图 | 每门课程的考场分配、AB卷情况 |

### 6.2 导出 Excel

在排考成功后的结果面板，点击 **"导出Excel"**：
- Sheet 1：排考总览表
- Sheet 2：教师监考表
- Sheet 3：班级通知表
- Sheet 4：考场签到表
- Sheet 5：流动监考巡查表

### 6.3 导出 JSON / SQL

在 "导入导出" 页面，可选择导出 JSON 或 SQL 格式。

---

## 七、手动微调

若自动排考结果不理想，可在 "手动微调" 页面调整：

1. **调整考试时段**：拖拽或选择新时段
2. **更换教室**：选择同一时段内的空闲教室
3. **更换监考教师**：在教师池中选择替换
4. **教师对调**：交换两位教师的监考任务

> 微调后系统会自动检查冲突（教室容量、教师时间冲突等）。

---

## 八、常见问题 FAQ

### Q1：排考失败，提示"教室分配失败"

**原因**：总教室容量不足，或单个班级人数超过最大教室容量且无法拆分（超过3个教室限制）。

**解决**：
- 增加大容量教室（≥ 50人）
- 或减小班级人数（拆分班级）
- 或减少同时段考试数量

### Q2：应用排考结果后，排考结果页面仍为空

**原因**：未点击 "应用此排考结果"，或应用时发生错误。

**解决**：
1. 检查 API 日志：`docker-compose logs api --tail=50`
2. 重新运行排考 → 应用版本
3. 确认 `exams` 表有数据：`docker-compose exec db psql -U scheduler -d exam_scheduler -c "SELECT COUNT(*) FROM exams;"`

### Q3：导出 Excel 只有标题栏，没有数据

**原因**：同 Q2，`exams` 表为空。

### Q4：前端页面白屏或按钮无反应

**原因**：浏览器缓存了旧版 `app.js`。

**解决**：按 `Ctrl + F5` 强制刷新。

### Q5：时段管理页面为空

**原因**：`time_slots` 表数据被删除。

**解决**：前端 "导入导出" → "重置标准时段"，或调用 `POST /api/import-export/init-time-slots`。

### Q6：Docker 启动时 5432 端口冲突

**原因**：本地已安装 PostgreSQL 并占用了 5432。

**解决**：Docker 内部映射不会冲突。若需要在宿主机用 psql 连接容器数据库，使用：
```powershell
docker-compose exec db psql -U scheduler -d exam_scheduler
```

### Q7：审计日志页面始终显示"暂无数据"

**原因**：系统尚未产生审计记录（当前各路由未显式写入审计日志）。

**解决**：此为已知待优化项，不影响排考核心功能。

---

## 附录：快速命令速查

```powershell
# 启动
docker-compose up -d

# 查看日志
docker-compose logs api --tail=100

# 进入数据库
docker-compose exec db psql -U scheduler -d exam_scheduler

# 重置数据库（删表重建）
docker-compose down -v
docker-compose up -d

# 手动运行初始化脚本
docker-compose exec api python init_db.py

# 重新构建镜像
docker-compose up -d --build
```
