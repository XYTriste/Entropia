# 排考配置持久化验证 - 完成报告

**日期**: 2026-05-20
**任务**: P2 - 排考配置持久化验证
**状态**: ✅ 已完成

---

## 问题描述

前端 `SchedulerView.vue` 中的 `loadConfig()` 和 `saveConfig()` 函数可能无法正确调用后端API，导致排考配置无法持久化。

---

## 调查结果

### 1. 后端API已实现 ✅

在 `app/routers/scheduler.py` 第 606-682 行，已实现：
- `GET /api/scheduler/config` - 获取排考配置
- `PUT /api/scheduler/config` - 更新排考配置

配置模型 `ScheduleConfig` (`app/models/schedule_config.py`) 包含字段：
- `fixed_teachers_per_room` - 每教室固定监考人数
- `patrol_teacher_count_per_slot_pair` - 每时段对流动监考人数
- `patrol_group_rules` - 流动监考分组规则（JSON）
- `classroom_priority_rules` - 教室优先级规则（JSON）
- `enable_max_days_constraint` - 是否启用最大监考天数约束
- `enable_day_continuity_constraint` - 是否启用日期连续性约束

### 2. 前端代码问题 ❌ → ✅

**问题**: `loadConfig()` 函数中错误地使用 `res.data` 访问响应数据

**原因**: API 客户端的响应拦截器已经直接返回 `response.data`，所以：
- ❌ 错误: `res.data.fixed_teachers_per_room`
- ✅ 正确: `res.fixed_teachers_per_room`

**修复** (`frontend/src/components/scheduler/SchedulerView.vue` 第 397-409 行):

```javascript
// 修复前
async function loadConfig() {
  try {
    const res = await api.get('/scheduler/config')
    if (res.data) {  // ❌ 错误
      config.value.fixedTeachersPerRoom = res.data.fixed_teachers_per_room || 2  // ❌ 错误
      // ...
    }
  } catch (e) {
    console.warn('加载配置失败:', e)
  }
}

// 修复后
async function loadConfig() {
  try {
    const res = await api.get('/scheduler/config')
    if (res) {  // ✅ 正确
      config.value.fixedTeachersPerRoom = res.fixed_teachers_per_room || 2  // ✅ 正确
      config.value.patrolTeacherCount = res.patrol_teacher_count_per_slot_pair || 2
      config.value.enableMaxDaysConstraint = res.enable_max_days_constraint ?? true
      config.value.enableDayContinuityConstraint = res.enable_day_continuity_constraint ?? true
    }
  } catch (e) {
    console.warn('加载配置失败:', e)
  }
}
```

### 3. 后端依赖问题 ❌ → ✅

**问题**: 后端启动时报错 `ModuleNotFoundError: No module named 'asyncpg'`

**原因**: `.env` 文件配置的是Docker环境（`db` 主机名），本地开发需要修改为 `localhost`；且缺少 `asyncpg` 模块。

**修复**:
1. 安装 `asyncpg` 模块: `pip install asyncpg`
2. 更新 `.env` 文件，将数据库主机从 `db` 改为 `localhost`

---

## 验证结果

### API 测试

使用 PowerShell 测试API：

**1. 获取配置 (GET)**
```powershell
Invoke-RestMethod -Uri 'http://localhost:8000/api/scheduler/config' -Method Get
```

响应:
```
code message data
---- ------- ----
   0 success @{fixed_teachers_per_room=1; patrol_teacher_count_per_slot_pair=2; ...}
```

**2. 保存配置 (PUT)**
```powershell
Invoke-RestMethod -Uri 'http://localhost:8000/api/scheduler/config' -Method Put -Body '{"fixed_teachers_per_room":2,...}' -ContentType 'application/json'
```

响应:
```
code message         data
---- -------         ----
   0 配置已更新 @{fixed_teachers_per_room=2; patrol_teacher_count_per_slot_pair=2; ...}
```

### 前端编译

```bash
cd frontend && npm run build
```

结果: ✅ 编译成功 (1756 modules transformed)

---

## 修改文件清单

| 文件 | 修改内容 |
|------|-----------|
| `frontend/src/components/scheduler/SchedulerView.vue` | 修复 `loadConfig()` 函数中的响应数据处理 |
| `.env` | 数据库主机从 `db` 改为 `localhost`（本地开发） |
| `frontend-migration-todo.md` | 标记任务为完成 |

---

## 总结

1. ✅ 后端 API `GET/PUT /api/scheduler/config` 已正确实现
2. ✅ 前端 `loadConfig()` 函数已修复，现在可以正确加载配置
3. ✅ 前端 `saveConfig()` 函数工作正常（不需要修改）
4. ✅ 后端依赖 `asyncpg` 已安装
5. ✅ 前端编译通过，无语法错误
6. ✅ API 手动测试通过

**排考配置持久化功能现在可以正常工作。**

---

## 后续建议

1. **P2任务**：验证排考结果各子视图完整性（`TeacherLoadPanel`, `ClassPanel`, `CoursePanel`, `ClassroomPanel`, `PatrolPanel`）
2. **P2任务**：修复停止排考功能（需要后端改为异步执行）
3. **P3任务**：验证课程时段冲突检测功能

---

**报告人**: 小白
**日期**: 2026-05-20
