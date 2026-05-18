# 排考系统前端重构 - 功能迁移待办清单

> 本文档对比原生 JS 前端（app/static/）与 Vue 3 重构前端（frontend/src/）的功能差异
> 
> **使用说明**：此文档可作为自动化任务的输入，AI 应读取本文档，按优先级完成迁移工作，并实时更新完成状态。

---

## 一、功能对比总览

| 页面 | 原生JS前端 | Vue 3前端 | 状态 | 优先级 |
|------|-----------|---------|------|---------|
| 仪表盘 | ✅ 完整 | ✅ 基础实现 | ⚠️ 部分硬编码 | P2 |
| 基础数据 | ✅ 7种类型完整CRUD | ✅ 7种类型完整CRUD | ✅ 已完成 | - |
| 排考引擎 | ✅ 完整 | ✅ 基础实现 | ⚠️ 停止功能无效 | P2 |
| 手动微调 | ✅ 完整 | ✅ 完整 | ✅ 已完成 | - |
| 排考结果 | ✅ 6种视图 | ✅ 7种视图 | ✅ 已完成（超预期） | - |
| 教师调剂 | ✅ 3种类型 | ✅ 3种类型 | ✅ 已完成 | - |
| 导入导出 | ✅ 完整 | ⚠️ 部分实现 | ❌ 缺失功能 | P1 |
| 审计日志 | ✅ 完整 | ✅ 完整 | ✅ 已完成 | - |

---

## 二、详细功能对比

### 1. 仪表盘 (Dashboard)

#### ✅ 已实现
- [x] KPI指标卡片（6个）
- [x] 实时时钟显示
- [x] AI聊天助手界面
- [x] 快捷操作按钮

#### ⚠️ 需要修复
- [ ] **修复硬编码数据** (P2)
  - 文件：`frontend/src/components/dashboard/DashboardView.vue`
  - 问题1：第286行 `kpiData.value[2].value = teacherTotal > 0 ? 91.3 : 0`（监考教师分配率硬编码91.3%）
  - 问题2：第287行 `kpiData.value[3].value = 7 // TODO: get from API`（冲突数硬编码）
  - 方案：需要从后端API获取真实数据，或计算真实值
  - API：可能需要新增 `/api/scheduler/conflicts` 或类似接口

- [ ] **各考场/楼栋考试占用率图表** (P3)
  - 原生JS前端有3D图表区域，Vue版被聊天助手替代
  - 需要确认是否有必要保留此功能

---

### 2. 基础数据 (Base Data)

#### ✅ 已完成
- [x] 7种数据类型管理（教师、教室、课程、班级、学生、专业、时段）
- [x] 完整的CRUD操作（新增、编辑、删除）
- [x] 搜索功能
- [x] 分页功能
- [x] 查看关联数据（教师监考安排、课程关联班级）
- [x] 批量删除

#### ⚠️ 需要验证
- [ ] **验证课程时段冲突检测** (P3)
  - 原生JS有 `checkCourseTimeSlotConflict()` 函数
  - 需要确认Vue版是否实现相同功能

---

### 3. 排考引擎 (Scheduler)

#### ✅ 已实现
- [x] 课程列表展示（带复选框）
- [x] 排考策略选择
- [x] 排考配置管理（固定监考人数、最大天数约束、连续排考约束）
- [x] 排考进度显示
- [x] 排考结果展示

#### ⚠️ 需要修复
- [ ] **停止排考功能无效** (P2)
  - 文件：`frontend/src/components/scheduler/SchedulerView.vue`
  - 原因：后端是同步执行，无法真正停止
  - 方案选项1：后端改为异步执行（推荐）
  - 方案选项2：前端禁用停止按钮，或改为"取消应用"功能
  - 参考：原生JS前端也有此限制，但保留了停止按钮

- [ ] **排考配置持久化** (P2)
  - 文件：`frontend/src/components/scheduler/SchedulerView.vue`
  - 需要确认 `loadConfig()` 和 `saveConfig()` 是否正常工作
  - API：`GET/PUT /api/scheduler/config`

---

### 4. 手动微调 (Adjustments)

#### ✅ 已完成
- [x] 考试安排列表展示
- [x] 调整安排（修改时段、教室）
- [x] 更换教师
- [x] 添加/移除监考教师
- [x] 撤销上次操作
- [x] 未保存提示

---

### 5. 排考结果 (Results)

#### ✅ 已完成（7种视图，超过原生JS的6种）
- [x] Overview - 总览矩阵
- [x] Teachers - 监考教师甘特图
- [x] Teacher Load - 教师负荷统计
- [x] Classrooms - 教室占用矩阵
- [x] Patrol - 流动监考矩阵
- [x] Classes - 班级视图
- [x] Courses - 课程详情视图

#### ⚠️ 需要修复
- [ ] **导出功能未实现** (P1)
  - 文件：`frontend/src/components/results/ResultsView.vue`
  - 第244-246行 `exportData()` 函数只有 `console.log`
  - 需要实现：
    - 导出当前视图数据
    - 支持Excel格式
    - 调用后端API：`GET /api/import-export/export/excel`

- [ ] **验证教师负荷统计图** (P2)
  - 原生JS有横向柱状图展示
  - 需要确认Vue版 `TeacherLoadPanel.vue` 是否有图表，还是只有表格

- [ ] **验证教室/流动监考/班级/课程视图** (P2)
  - 需要逐一验证这些视图是否完整实现
  - 检查：`ClassPanel.vue`, `CoursePanel.vue`, `ClassroomPanel.vue`, `PatrolPanel.vue`

---

### 6. 教师调剂 (Transfer)

#### ✅ 已完成
- [x] 交换两位教师的监考（swap）
- [x] 将监考转给另一位教师（transfer）
- [x] 批量转交所有监考（batch-transfer）
- [x] 撤销上次调剂

---

### 7. 导入导出 (Import/Export) ⚠️ 重点缺失

#### ✅ 已实现
- [x] 下载模板（6种类型）
- [x] 上传Excel文件导入
- [x] 导出Excel

#### ❌ 缺失功能 (P1 - 高优先级)
- [ ] **缺少 time-slots 模板下载**
  - 文件：`frontend/src/components/importExport/ImportExportView.vue`
  - 原生JS支持7种导入类型，Vue版只有6种
  - 需要添加 `time-slots` 到 templates 数组
  - API：`GET /api/import-export/templates/time-slots`

- [ ] **缺少 JSON 导出功能**
  - 原生JS有 `exportJSON()` 函数
  - API：`GET /api/import-export/export/json`
  - 需要实现前端按钮和下载逻辑

- [ ] **缺少 SQL 导出功能**
  - 原生JS有 `exportSQL()` 函数
  - API：`GET /api/import-export/export/sql`
  - 需要实现前端按钮和下载逻辑

- [ ] **缺少清除全部数据功能**
  - 原生JS有 `clearAllData()` 函数
  - API：`POST /api/import-export/clear-data`
  - 需要添加危险操作按钮（带确认对话框）

- [ ] **缺少初始化时段功能**
  - 原生JS有 `initTimeSlots()` 函数
  - API：`POST /api/import-export/init-time-slots`
  - 需要添加按钮（带确认对话框）

- [ ] **导入反馈不够详细**
  - 原生JS显示：成功数、失败数、错误详情表格
  - Vue版需要改进导入结果展示
  - 参考：原生JS的 `showImportResult()` 和 `showAllInOneImportResult()`

- [ ] **缺少全量导入功能**
  - 原生JS支持 `all-in-one` 导入（单个Excel文件包含多个Sheet）
  - API：`POST /api/import-export/import-excel-all`
  - 需要添加"全量导入"选项卡

---

### 8. 审计日志 (Audit Logs)

#### ✅ 已完成
- [x] 分页展示
- [x] 按操作类型过滤
- [x] 按日期范围过滤
- [x] 关键词搜索
- [x] 显示完整变更记录

---

## 三、后端API对接状态

### ✅ 已对接的API
- [x] `GET /api/teachers/` - 教师管理
- [x] `GET /api/classrooms/` - 教室管理
- [x] `GET /api/courses/` - 课程管理
- [x] `GET /api/classes/` - 班级管理
- [x] `GET /api/students/` - 学生管理
- [x] `GET /api/majors/` - 专业管理
- [x] `GET /api/time-slots/` - 时段管理
- [x] `POST /api/scheduler/run` - 启动排考
- [x] `GET /api/scheduler/status/{jobId}` - 排考状态
- [x] `POST /api/adjustments/*` - 手动调整和教师调剂
- [x] `GET /api/exams/overview/matrix` - 总览矩阵
- [x] `GET /api/audit-logs/` - 审计日志

### ⚠️ 需要验证的API
- [ ] `GET /api/scheduler/config` - 排考配置加载
- [ ] `PUT /api/scheduler/config` - 排考配置保存
- [ ] `POST /api/scheduler/apply/{versionId}` - 应用排考结果
- [ ] `GET /api/chat/stream` - AI聊天助手（需要确认后端是否实现）

### ❌ 可能缺失的API（需要后端实现）
- [ ] `GET /api/scheduler/conflicts` - 获取冲突数（用于仪表盘）
- [ ] 异步排考API - 支持真正停止排考（需要重构后端）

---

## 四、优先级总结

### P0 - 紧急（阻塞功能）
*无*

### P1 - 高优先级（核心功能缺失）
1. [ ] 导入导出页面缺失功能（time-slots模板、JSON/SQL导出、清除数据、初始化时段、全量导入）
2. [ ] 排考结果导出功能未实现

### P2 - 中优先级（功能改进）
1. [ ] 修复仪表盘硬编码数据
2. [ ] 排考配置持久化验证
3. [ ] 验证排考结果各子视图完整性

### P3 - 低优先级（优化项）
1. [ ] 各考场/楼栋考试占用率图表（需求确认）
2. [ ] 导入反馈信息优化

---

## 五、自动化任务执行说明

当使用此文档作为自动化任务输入时，AI 应遵循以下流程：

### 执行流程
1. **读取本文档**，理解当前迁移状态
2. **按优先级选择任务**（P1 > P2 > P3）
3. **读取相关源代码**（原生JS前端 + Vue 3前端）
4. **实现缺失功能**（参考原生JS前端的实现）
5. **测试验证**（编译前端，确保无错误）
6. **更新本文档**（将完成的任务标记为 `[x]`，添加完成日期）
7. **提交代码**（如果需要）
8. **继续下一个任务**

### 更新格式
完成任务后，在对应任务后添加完成信息：
```
- [x] 任务描述 ✓ 2026-05-19
```

### 注意事项
- 实现功能时，参考原生JS前端的实现逻辑（`app/static/js/app.js`）
- Vue 3前端使用 Composition API（`<script setup>`）
- 保持代码风格一致（暗色主题、扫光效果等）
- 不要破坏现有功能
- 如遇阻塞（需要后端支持），在任务后添加 `[Blocked: 原因]`

---

## 六、更新日志

### 2026-05-19
- 创建本文档
- 完成初步功能对比
- 识别主要缺失功能：导入导出页面缺失多项功能
