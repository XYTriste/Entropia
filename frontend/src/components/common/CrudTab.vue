<template>
  <div class="crud-tab">
    <!-- 后端不可用警告提示 -->
    <div v-if="isMockMode" class="mock-mode-banner">
      <el-icon class="mock-icon"><Warning /></el-icon>
      <span><strong>测试模式</strong>：后端服务不可用，以下显示的是示例数据</span>
    </div>

    <!-- 工具栏 -->
    <div class="crud-toolbar">
      <div class="toolbar-left">
        <el-button type="primary" :disabled="isMockMode" @click="openDialog()">
          <el-icon><Plus /></el-icon>
          新增
        </el-button>
        <el-button @click="refresh" :loading="loading">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
      <el-input
        v-model="localFilters.search"
        placeholder="搜索..."
        clearable
        class="crud-search"
        @input="onSearch"
      />
    </div>

    <!-- 统一表格：数据源根据模式切换，避免 v-if 双表格带来的双倍 vnode / DOM 开销 -->
    <el-table
      :data="tableData"
      stripe
      border
      v-loading="!isMockMode && loading"
      empty-text="暂无数据"
      class="crud-table"
      :class="{ 'mock-table': isMockMode }"
      :header-cell-style="isMockMode ? () => MOCK_HEADER_STYLE : () => HEADER_STYLE"
      :cell-style="isMockMode ? () => MOCK_CELL_STYLE : () => CELL_STYLE"
    >
      <el-table-column
        v-for="col in columns"
        :key="col.key"
        :prop="col.key"
        :label="col.label"
        :width="col.width"
        :min-width="col.minWidth"
      >
        <template v-if="col.slot" #default="{ row }">
          <el-tag
            v-if="col.slot === 'teacher_type'"
            :type="row.teacher_type === 'full_time' ? 'primary' : 'warning'"
            size="small"
            effect="light"
          >{{ row.teacher_type === 'full_time' ? '专任' : '兼职' }}</el-tag>

          <el-tag
            v-else-if="col.slot === 'classroom_type'"
            :type="row.type === 'Lecture' ? 'primary' : 'success'"
            size="small"
            effect="light"
          >{{ row.type === 'Lecture' ? '教室' : '实验室' }}</el-tag>

          <el-tag
            v-else-if="col.slot === 'is_public'"
            :type="row.is_public ? 'primary' : 'info'"
            size="small"
            effect="light"
          >{{ row.is_public ? '是' : '否' }}</el-tag>

          <el-tag
            v-else-if="col.slot === 'has_ab_split'"
            :type="row.has_ab_split ? 'warning' : 'info'"
            size="small"
            effect="light"
          >{{ row.has_ab_split ? '是' : '否' }}</el-tag>

          <span v-else-if="col.slot === 'major_name'">{{ row.major_name || '-' }}</span>
          <span v-else>{{ row[col.slot] ?? row[col.key] ?? '-' }}</span>
        </template>
      </el-table-column>

      <el-table-column label="操作" :width="180" fixed="right">
        <template #default="{ row }">
          <el-button v-if="!isMockMode" size="small" @click="openDialog(row)">编辑</el-button>
          <el-button v-if="!isMockMode" size="small" type="danger" @click="handleDelete(row)">删除</el-button>
          <el-button v-if="isMockMode" size="small" type="info" disabled>编辑</el-button>
          <el-button v-if="isMockMode" size="small" type="info" disabled>删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页（正常模式） -->
    <el-pagination
      v-if="!isMockMode"
      v-model:current-page="pagination.page"
      v-model:page-size="pagination.page_size"
      :total="pagination.total"
      :page-sizes="[10, 20, 50]"
      layout="total, sizes, prev, pager, next, jumper"
      class="crud-pagination"
      @size-change="fetchData"
      @current-change="fetchData"
    />

    <!-- 新增/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEditing ? '编辑' : '新增'"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item
          v-for="field in formFields"
          :key="field.key"
          :label="field.label"
        >
          <!-- 输入框 -->
          <el-input
            v-if="field.type === 'input'"
            v-model="form[field.key]"
            :placeholder="field.placeholder"
          />

          <!-- 数字输入 -->
          <el-input-number
            v-else-if="field.type === 'number'"
            v-model="form[field.key]"
            :min="field.min || 0"
            :max="field.max"
          />

          <!-- 下拉选择 -->
          <el-select
            v-else-if="field.type === 'select'"
            v-model="form[field.key]"
            :placeholder="field.placeholder"
          >
            <el-option
              v-for="opt in field.options"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>

          <!-- 复选框 -->
          <el-checkbox
            v-else-if="field.type === 'checkbox'"
            v-model="form[field.key]"
          >{{ field.checkboxLabel || '' }}</el-checkbox>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Warning, Refresh } from '@element-plus/icons-vue'
import { useCrud } from '@/composables/useCrud'

/* ================================================================
 * 防抖工具函数 — 避免搜索时频繁触发请求
 * ================================================================ */
function debounce(fn, delay = 300) {
  let timer = null
  return function (...args) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn.apply(this, args), delay)
  }
}

/* 静态样式对象 — 避免每次渲染返回新引用触发 diff + 强制回流 */
const HEADER_STYLE = {
  background: '#FAFAFA',
  color: 'rgba(0,0,0,0.65)',
  fontWeight: '600',
  fontSize: '13px',
  borderBottom: '1px solid #F0F0F0',
}
const CELL_STYLE = {
  borderBottom: '1px solid #F0F0F0',
  fontSize: '14px',
}
const MOCK_HEADER_STYLE = {
  background: 'rgba(88, 166, 255, 0.1)',
  color: '#58a6ff',
  fontWeight: '600',
  fontSize: '13px',
  borderBottom: '1px solid rgba(88, 166, 255, 0.3)',
}
const MOCK_CELL_STYLE = {
  borderBottom: '1px solid rgba(88, 166, 255, 0.2)',
  fontSize: '14px',
  color: '#e2e8f0',
}

const props = defineProps({
  entity:     { type: String, required: true },
  columns:    { type: Array,  required: true },
  formFields: { type: Array,  required: true },
  rules:      { type: Object,  default: () => ({}) },
  // 懒加载不再需要 active prop（lazy tab-pane 会自动处理）
})

const emit = defineEmits(['saved', 'deleted'])

// 测试数据状态
const isMockMode = ref(false)

// 测试数据映射
const mockDataMap = {
  teachers: [
    { id: 1, name: '张伟', teacher_type: 'full_time', max_slots: 6, current_slots: 4 },
    { id: 2, name: '李娜', teacher_type: 'part_time', max_slots: 4, current_slots: 2 },
    { id: 3, name: '王强', teacher_type: 'full_time', max_slots: 8, current_slots: 6 },
    { id: 4, name: '刘芳', teacher_type: 'full_time', max_slots: 5, current_slots: 3 },
    { id: 5, name: '陈明', teacher_type: 'part_time', max_slots: 3, current_slots: 1 },
  ],
  classrooms: [
    { id: 1, name: 'A101', type: 'Lecture', capacity: 60, building: '博学楼A', floor: 1 },
    { id: 2, name: 'A201', type: 'Lecture', capacity: 80, building: '博学楼A', floor: 2 },
    { id: 3, name: 'B301', type: 'Lab', capacity: 40, building: '博学楼B', floor: 3 },
    { id: 4, name: 'C102', type: 'Lecture', capacity: 120, building: '明德楼', floor: 1 },
    { id: 5, name: 'D201', type: 'Lecture', capacity: 50, building: '崇文楼', floor: 2 },
  ],
  courses: [
    { id: 1, name: '高等数学', is_public: true, has_ab_split: true },
    { id: 2, name: '大学英语', is_public: true, has_ab_split: false },
    { id: 3, name: '计算机网络', is_public: false, has_ab_split: true },
    { id: 4, name: '数据结构', is_public: false, has_ab_split: true },
    { id: 5, name: '线性代数', is_public: true, has_ab_split: false },
  ],
  classes: [
    { id: 1, name: '25软件1', grade: '2025', student_count: 45, major_name: '软件工程' },
    { id: 2, name: '25数媒1', grade: '2025', student_count: 38, major_name: '数字媒体技术' },
    { id: 3, name: '25计科1', grade: '2025', student_count: 42, major_name: '计算机科学与技术' },
    { id: 4, name: '24网络1', grade: '2024', student_count: 36, major_name: '网络工程' },
    { id: 5, name: '24人工智能1', grade: '2024', student_count: 30, major_name: '人工智能' },
  ],
  'time-slots': [
    { id: 1, day_name: '星期一', slot_code: 'T1', start_time: '08:00', end_time: '09:40' },
    { id: 2, day_name: '星期一', slot_code: 'T2', start_time: '10:00', end_time: '11:40' },
    { id: 3, day_name: '星期一', slot_code: 'T3', start_time: '14:00', end_time: '15:40' },
    { id: 4, day_name: '星期二', slot_code: 'T1', start_time: '08:00', end_time: '09:40' },
    { id: 5, day_name: '星期二', slot_code: 'T2', start_time: '10:00', end_time: '11:40' },
  ],
  students: [
    { id: 1, name: '王小明', class_name: '25软件1' },
    { id: 2, name: '李小红', class_name: '25数媒1' },
    { id: 3, name: '张小华', class_name: '25计科1' },
    { id: 4, name: '刘小丽', class_name: '24网络1' },
    { id: 5, name: '陈小军', class_name: '24人工智能1' },
  ],
  majors: [
    { id: 1, name: '软件工程' },
    { id: 2, name: '数字媒体技术' },
    { id: 3, name: '计算机科学与技术' },
    { id: 4, name: '网络工程' },
    { id: 5, name: '人工智能' },
  ],
}

// 根据 entity 获取测试数据 — 普通常量，props.entity 在组件生命周期内不变
const mockData = mockDataMap[props.entity] || []

// 表格显示数据：mock 模式用测试数据，正常模式用接口数据
const tableData = computed(() => isMockMode.value ? mockData : data.value)

/* 样式已提取为模块顶部静态常量，避免每次渲染返回新引用 */

const {
  data,
  loading,
  pagination,
  filters,
  dialogVisible,
  form,
  isEditing,
  fetchData: originalFetchData,
  openDialog,
  save: originalSave,
  deleteItem,
} = useCrud(props.entity)

// Mock 模式已确认后，不再尝试请求后端（除非手动刷新）
let mockModeConfirmed = false

// 覆盖 fetchData，检测后端是否可用
// 注意：Mock 模式下跳过请求，避免无效网络开销
async function fetchData() {
  // Mock 模式已确认时，直接返回，不发请求
  if (isMockMode.value && mockModeConfirmed) {
    return
  }

  try {
    await originalFetchData()
    // 请求成功，关闭 mock 模式
    isMockMode.value = false
    mockModeConfirmed = false
  } catch (e) {
    // 后端不可用，启用测试模式（只设置一次）
    if (!mockModeConfirmed) {
      isMockMode.value = true
      mockModeConfirmed = true
    }
  }
}

const formRef = ref(null)
const localFilters = ref({ ...filters.value })

// 搜索防抖：300ms 内不重复请求
const debouncedFetchData = debounce(() => {
  filters.value = { ...localFilters.value }
  pagination.value.page = 1
  fetchData()
}, 300)

function onSearch() {
  debouncedFetchData()
}

// 手动刷新时强制重新检测后端
function refresh() {
  mockModeConfirmed = false
  fetchData()
}

async function save() {
  if (!formRef.value) {
    await originalSave()
    ElMessage.success('保存成功')
    emit('saved')
    return
  }
  try {
    await formRef.value.validate(async (valid) => {
      if (!valid) {
        ElMessage.warning('请检查表单输入')
        return
      }
      await originalSave()
      ElMessage.success('保存成功')
      emit('saved')
    })
  } catch (e) {
    ElMessage.error('保存失败')
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm('确定要删除该记录吗？此操作不可恢复。', '确认删除', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await deleteItem(row.id)
    ElMessage.success('删除成功')
    emit('deleted')
  } catch (e) {
    // 用户取消或删除失败
  }
}

onMounted(() => {
  fetchData()
})

// 把 openDialog 和 refresh 暴露给父组件
defineExpose({ openDialog, refresh })
</script>

<style scoped>
.crud-tab {
  background: var(--color-bg-container, #FFFFFF);
  border-radius: var(--radius-md, 12px);
  box-shadow: var(--shadow-sm);
  padding: var(--space-lg, 24px);
}

/* 测试模式提示横幅 */
.mock-mode-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: linear-gradient(135deg, rgba(88, 166, 255, 0.15), rgba(88, 166, 255, 0.05));
  border: 1px solid rgba(88, 166, 255, 0.4);
  border-radius: 8px;
  margin-bottom: 16px;
  color: #58a6ff;
  font-size: 14px;
  /* 移除无限 CSS 动画，避免持续触发合成/布局计算 */
}

.mock-icon {
  font-size: 18px;
}

.crud-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-md, 16px);
  gap: var(--space-md, 16px);
}
.toolbar-left {
  display: flex;
  gap: 8px;
}
.crud-search {
  max-width: 320px;
}

.crud-table {
  border-radius: var(--radius-md, 12px);
  overflow: hidden;
  font-size: 14px;
}

/* 测试数据表格的样式覆盖 */
.mock-table {
  background: rgba(10, 14, 39, 0.8) !important;
  border: 1px solid rgba(88, 166, 255, 0.3);
}

.crud-pagination {
  display: flex;
  justify-content: flex-end;
  padding-top: var(--space-md, 16px);
}

/* 对话框表单间距 */
.crud-dialog-form :deep(.el-form-item) {
  margin-bottom: 20px;
}
</style>
