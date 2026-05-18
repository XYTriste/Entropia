# 【未解决】基础数据页面切换 Tab 仍然卡顿

## 问题描述

**环境**: Windows, 排考系统前端 (Vue 3 + Vite + Element Plus)

**现象**: 切换到「基础数据」页面后出现明显卡顿。ElTag type="" 警告已修复，但卡顿仍然存在，怀疑是某个地方在持续发请求或反复渲染。

---

## 已完成的排查 / 修复

| 文件 | 修改内容 | 效果 |
|------|----------|------|
| `CrudTab.vue` | `:type=""` → `:type="primary"` | 控制台无 type 警告了 ✅ |
| `BaseDataView.vue` | Options API → Composition API + 模块级常量 | mount 时减少了大量 Proxy 开销 |
| `useCrud.js` | `ref([])` → `shallowRef([])` | 消除表格数据的深度响应式追踪 |
| `api/index.js` | 新增 `API_MAP` | 替换字符串拼接 |

---

## 待排查方向

### 1. 请求循环（最可疑）
检查 `useCrud.js` 中的 `fetchData()` 是否在某处被重复触发。可能的触发路径：
- `watch` 监听器触发
- `onMounted` 重复调用
- `computed` 间接触发
- `save()` / `deleteItem()` 成功后自动调用 `fetchData()`

**验证方法**: Chrome DevTools Network 面板，观察是否反复发送 API 请求。

### 2. Mock 模式切换逻辑问题
`CrudTab.vue` 第 279-289 行的 `fetchData` 覆盖函数：

```javascript
async function fetchData() {
  try {
    await originalFetchData()
    isMockMode.value = false
  } catch (e) {
    isMockMode.value = true
  }
}
```

如果后端响应慢（超时边缘），可能先走 mock → 后端最终返回 → 走真实数据 → 反复横跳。每次切换 `isMockMode` 会触发 `tableData` computed 重新计算，导致 el-table 重新渲染。

### 3. el-table 布局计算循环
`el-table` 的 `updateColumnsWidth` 在 debounce 期间，如果表格数据或列定义反复变化，可能触发循环重排。每次 `tableData` 变化都会让 el-table 重新计算布局。

### 4. Element Plus el-table 已知问题
Element Plus 2.x 在某些场景下（大数据量 + slot 使用 + debounce）可能有性能问题。

---

## 关键文件

| 文件 | 作用 |
|------|------|
| `frontend/src/components/baseData/BaseDataView.vue` | Tab 容器，包含 7 个 lazy tab-pane |
| `frontend/src/components/common/CrudTab.vue` | 表格 CRUD 组件，包含 mock 模式检测逻辑 |
| `frontend/src/composables/useCrud.js` | 数据请求 composable，`data` 用 `shallowRef` |
| `frontend/src/api/index.js` | API 函数，`API_MAP` 查找表 |

---

## 建议的排查步骤

### Step 1: 确认是否有高频请求
- 打开 Chrome DevTools → Network 面板
- 切换到「基础数据」页面
- 观察是否有大量重复的 API 请求（如 `/api/teachers` 每秒发 N 次）

### Step 2: 如果有高频请求
在 `useCrud.js` 的 `fetchData()` 开头加一行日志：
```javascript
console.trace('[fetchData]', entityPath, new Date().toISOString())
```
然后追踪调用栈，找出是什么触发了重复请求。

### Step 3: 如果无高频请求，但仍然卡
- 打开 Performance 面板重新录制
- 重点看是否有 `updateColumnsWidth` 反复触发
- 检查是否有大量 `appendHTML` / `重新计算样式` / `布局` 时间

### Step 4: Mock 模式临时测试
在 `CrudTab.vue` 中强制禁用 mock 模式：
```javascript
// 临时改成：
const isMockMode = ref(false)  // 强制不走 mock
```
看是否还卡。如果不卡了，问题在 mock 切换逻辑。

---

## 可能的修复方案

1. **加请求防抖**: 在 `useCrud.js` 中对 `fetchData` 加 debounce，防止短时间内重复请求
2. **固定数据源**: 不根据后端可用性切换 mock/真实数据，而是让用户手动选择模式
3. **el-table 优化**: 检查 el-table 的 `:show-header`、`:data` 等属性是否有不必要的响应式更新
4. **虚拟滚动**: 如果数据量大（200+ 行），考虑使用 el-table-v2 虚拟滚动

---

## 相关提交记录

- `d672dbe` - performance: 修复 ElTag type="" 无效 prop 警告导致的 flushJobs 卡顿
