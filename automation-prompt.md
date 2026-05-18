# 排考系统前端功能迁移 - 自动化任务提示词

## 任务说明
你是排考系统前端重构项目的开发者。请读取功能迁移待办清单，按优先级自动完成缺失功能的实现。

---

## 执行流程

### 1. 读取任务清单
首先读取文件：`D:\Code\best_exam_scheduler\exam-scheduler\frontend-migration-todo.md`

### 2. 选择任务
按照优先级选择未完成的任务：
- P1（高优先级）优先
- 如果 P1 任务都被阻塞，选择 P2 任务
- 如果都完成，报告"所有功能迁移已完成"

### 3. 研究原生实现
读取原生 JS 前端的实现作为参考：
- 文件路径：`D:\Code\best_exam_scheduler\exam-scheduler\app\static\js\app.js`
- 找到对应功能的实现代码
- 理解逻辑、API 调用、数据处理

### 4. 实现功能
在 Vue 3 前端中实现对应功能：
- 读取相关 Vue 组件
- 参考原生 JS 的实现逻辑
- 使用 Vue 3 Composition API 重写
- 保持暗色主题和扫光效果风格一致
- 确保 TypeScript 类型正确（如适用）

### 5. 验证
- 前端编译：`cd D:\Code\best_exam_scheduler\exam-scheduler\frontend && npm run build`
- 确保编译通过，无错误
- 如需要后端 API，检查后端是否正确实现

### 6. 更新任务清单
完成功能后，更新 `frontend-migration-todo.md`：
- 将 `- [ ]` 改为 `- [x]`
- 添加完成日期，例如：`- [x] 任务描述 ✓ 2026-05-19`
- 如有注意事项，在任务后添加说明

### 7. 提交代码（可选）
如果需要，提交代码到 Git：
```bash
cd D:\Code\best_exam_scheduler\exam-scheduler
git add -A
git commit -m "feat(frontend): 实现XXX功能"
git push origin master
```

---

## 处理阻塞

### 如果遇到阻塞问题：
1. 在任务清单中添加 `[Blocked: 原因]`
2. 说明需要后端实现或需要用户确认
3. 跳过此任务，继续下一个

### 常见阻塞情况：
- 后端 API 未实现 → 标记 `[Blocked: 需要后端实现 /api/xxx]`
- 需求不明确 → 标记 `[Blocked: 需要用户确认XXX]`
- 编译错误 → 尝试修复，如无法修复，报告错误并标记阻塞

---

## 输出格式

每完成一个任务，输出：

```
✅ 完成任务：[任务描述]

实现内容：
- 修改文件：xxx.vue
- 新增功能：xxx
- API 对接：xxx

验证结果：
- 编译：通过/失败
- 功能：正常/需要后端支持

已更新 frontend-migration-todo.md
```

如果所有任务完成：

```
🎉 所有功能迁移已完成！

完成情况：
- P1 任务：X/Y 已完成
- P2 任务：X/Y 已完成
- P3 任务：X/Y 已完成

剩余阻塞任务：
1. [描述] - 原因：XXX
```

---

## 注意事项

1. **保持代码风格一致**：
   - 使用 Composition API (`<script setup>`)
   - 使用 `ref`, `computed`, `watch` 等响应式 API
   - CSS 变量使用 `--text-primary`, `--card-bg` 等
   - 暗色主题，扫光效果

2. **不要破坏现有功能**：
   - 修改前先读取完整文件
   - 使用 `Edit` 工具精确修改
   - 修改后验证编译通过

3. **参考原生实现，但不照搬**：
   - 理解原生 JS 的逻辑
   - 用 Vue 3 的方式重写（组件化、响应式、计算属性）
   - 优化用户体验（加载状态、错误提示等）

4. **记录重要决策**：
   - 如果有多种实现方案，说明理由
   - 更新 `frontend-migration-todo.md` 的"更新日志"部分

---

## 示例执行

**输入**：自动化任务触发器

**执行步骤**：
1. 读取 `frontend-migration-todo.md`
2. 发现 P1 任务："导入导出页面缺失功能"
3. 读取原生 JS 的 `app.js` 中导入导出相关代码
4. 读取 Vue 3 的 `ImportExportView.vue`
5. 实现缺失功能（time-slots 模板、JSON/SQL 导出等）
6. 编译验证通过
7. 更新 `frontend-migration-todo.md`
8. 输出完成报告

---

## 定时任务配置建议

**执行频率**：每天 1-2 次（例如：每天上午 10:00，或每天晚上 20:00）

**任务名称**：排考系统前端功能迁移

**提示词**：（复制本文档内容）

**注意事项**：
- 确保 WorkBuddy 在定时任务触发时处于运行状态
- 定时任务会在后台执行，完成后通知用户
- 如遇到阻塞问题，任务会暂停并等待用户确认

---

## 任务清单文件路径

- **待办清单**：`D:\Code\best_exam_scheduler\exam-scheduler\frontend-migration-todo.md`
- **原生 JS 前端**：`D:\Code\best_exam_scheduler\exam-scheduler\app\static\js\app.js`
- **Vue 3 前端**：`D:\Code\best_exam_scheduler\exam-scheduler\frontend\src\`

---

## 开始执行

现在，请：
1. 读取 `frontend-migration-todo.md`
2. 选择第一个未完成的 P1 任务
3. 开始研究和实现

祝您任务执行顺利！🚀
