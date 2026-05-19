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
- [x] **修复硬编码数据** (P2) ✓ 2026-05-19
  - 文件：`frontend/src/components/dashboard/DashboardView.vue`
  - 修复1：调用 `/api/teachers/workload/stats` 获取真实监考教师分配率，替换硬编码的91.3%
  - 修复2：使用超负荷教师数量（`overload_teachers.length`）作为冲突告警指标，替换硬编码的7
  - 注意：冲突检测API尚未实现，当前使用超负荷教师数作为代理指标
  - API：`GET /api/teachers/workload/stats`

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
- [x] **停止排考功能无效** (P2) ✓ 2026-05-19
  - 文件：`frontend/src/components/scheduler/SchedulerView.vue`
  - 修复：已禁用停止按钮并添加说明提示（后端同步执行无法真正停止）
  - 方案2实现：按钮改为禁用状态，添加 tooltip 说明原因
  - 如需真正停止功能，需要后端改为异步执行（方案1）
  - 参考：原生JS前端也有此限制，但保留了停止按钮

- [x] **排考配置持久化** (P2) ✓ 2026-05-20
  - 文件：`frontend/src/components/scheduler/SchedulerView.vue`
  - 修复：`loadConfig()` 函数中错误使用 `res.data`（应为 `res`，因为响应拦截器已返回 `response.data`）
  - 验证：后端 API `GET/PUT /api/scheduler/config` 已正确实现
  - 状态：配置现在可以正确加载和保存

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
- [x] **导出功能未实现** (P1) ✓ 2026-05-19
  - 已修复：`exportData()` 函数现已实现
  - 调用后端API：`GET /api/import-export/export/excel?versionId=...&view=...`
  - 支持按当前视图导出Excel格式
  - 使用 axios 发起请求，处理 blob 响应并自动下载文件

- [x] **验证教师负荷统计图** (P2) ✓ 2026-05-19
  - Vue版 `TeacherLoadPanel.vue` 已实现横向柱状图（CSS Bar Chart）
  - 显示教师监考场次、平均负荷、最多/最少/空闲/超额教师统计
  - 功能完整，与原生JS前端等效

- [x] **验证教室/流动监考/班级/课程视图** (P2) ✓ 2026-05-19
  - `ClassPanel.vue`：已完整实现班级时间线视图
  - `CoursePanel.vue`：已完整实现课程详情视图（含AB卷分析）
  - `ClassroomPanel.vue`：已完整实现教室使用矩阵
  - `PatrolPanel.vue`：已完整实现流动监考矩阵
  - 所有视图功能完整，与原生JS前端等效

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

#### ✅ 缺失功能已补全 (P1 - 已完成 ✓ 2026-05-19)
- [x] **time-slots 模板下载** ✓ 2026-05-19
  - 文件：`frontend/src/components/importExport/ImportExportView.vue`
  - 已在 templates 数组中添加 time-slots
  - API：`GET /api/import-export/templates/time-slots`

- [x] **JSON 导出功能** ✓ 2026-05-19
  - 已实现 `exportJSON()` 函数
  - API：`GET /api/import-export/export/json`
  - 添加前端按钮和下载逻辑

- [x] **SQL 导出功能** ✓ 2026-05-19
  - 已实现 `exportSQL()` 函数
  - API：`GET /api/import-export/export/sql`
  - 添加前端按钮和下载逻辑

- [x] **清除全部数据功能** ✓ 2026-05-19
  - 已实现 `clearAllData()` 函数，带确认对话框
  - API：`POST /api/import-export/clear-data`
  - 显示清除结果详情

- [x] **初始化时段功能** ✓ 2026-05-19
  - 已实现 `initTimeSlots()` 函数，带确认对话框
  - API：`POST /api/import-export/init-time-slots`
  - 显示初始化结果

- [x] **导入反馈详细** ✓ 2026-05-19
  - 改进导入结果展示：成功/失败数量
  - 添加错误详情表格（支持 errors 和 warnings）
  - 参考原生JS的 `showImportResult()` 和 `showAllInOneImportResult()`

- [x] **全量导入功能** ✓ 2026-05-19
  - 已添加"全量导入"选项卡
  - API：`POST /api/import-export/import-excel-all`
  - 支持全量导入模板下载

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
1. [x] 导入导出页面缺失功能（time-slots模板、JSON/SQL导出、清除数据、初始化时段、全量导入）✓ 2026-05-19
2. [x] 排考结果导出功能未实现 ✓ 2026-05-19
   - 注意：已在 ImportExportView.vue 中实现 Excel/JSON/SQL 导出

### P2 - 中优先级（功能改进）
1. [x] 修复仪表盘硬编码数据 ✓ 2026-05-19
2. [x] 排考配置持久化验证 ✓ 2026-05-20
   - 修复前端 `loadConfig()` 函数中的响应数据处理（移除错误的 `.data` 访问）
   - 后端 API `GET/PUT /api/scheduler/config` 已正确实现
   - 前端现在可以正确加载和保存排考配置
3. [x] 验证排考结果各子视图完整性 ✓ 2026-05-19
   - 已验证所有7个子视图（Overview/Teachers/TeacherLoad/Classrooms/Patrol/Classes/Courses）
   - 所有视图功能完整，与原生JS前端等效

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
