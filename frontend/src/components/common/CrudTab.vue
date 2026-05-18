<template>
  <div class="crud-tab">
    <!-- 工具栏 -->
    <div class="crud-toolbar">
      <el-button type="primary" @click="openDialog()">
        <el-icon><Plus /></el-icon>
        新增
      </el-button>
      <el-input
        v-model="localFilters.search"
        placeholder="搜索..."
        clearable
        class="crud-search"
        @input="onSearch"
      />
    </div>

    <!-- 数据表格 -->
    <el-table
      :data="data"
      stripe
      border
      v-loading="loading"
      empty-text="暂无数据"
      class="crud-table"
      :header-cell-style="headerStyle"
      :cell-style="cellStyle"
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
          <!-- teacher_type: full_time / part_time -->
          <el-tag
            v-if="col.slot === 'teacher_type'"
            :type="row.teacher_type === 'full_time' ? '' : 'warning'"
            size="small"
            effect="light"
          >{{ row.teacher_type === 'full_time' ? '专任' : '兼职' }}</el-tag>

          <!-- classroom type: Lecture / Lab -->
          <el-tag
            v-else-if="col.slot === 'classroom_type'"
            :type="row.type === 'Lecture' ? '' : 'success'"
            size="small"
            effect="light"
          >{{ row.type === 'Lecture' ? '教室' : '实验室' }}</el-tag>

          <!-- boolean slots -->
          <el-tag
            v-else-if="col.slot === 'is_public'"
            :type="row.is_public ? '' : 'info'"
            size="small"
            effect="light"
          >{{ row.is_public ? '是' : '否' }}</el-tag>

          <el-tag
            v-else-if="col.slot === 'has_ab_split'"
            :type="row.has_ab_split ? 'warning' : 'info'"
            size="small"
            effect="light"
          >{{ row.has_ab_split ? '是' : '否' }}</el-tag>

          <!-- major_name: 直接显示 -->
          <span v-else-if="col.slot === 'major_name'">{{ row.major_name || '-' }}</span>

          <!-- fallback: 直接显示 row[col.slot] 或 row[col.key] -->
          <span v-else>{{ row[col.slot] ?? row[col.key] ?? '-' }}</span>
        </template>
      </el-table-column>

      <el-table-column label="操作" :width="180" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="openDialog(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <el-pagination
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
import { ref, watch, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { useCrud } from '@/composables/useCrud'

const props = defineProps({
  entity:     { type: String, required: true },
  columns:    { type: Array,  required: true },
  formFields: { type: Array,  required: true },
  rules:      { type: Object,  default: () => ({}) },
})

const emit = defineEmits(['saved', 'deleted'])

/* 表格样式函数（Ant Design 风格） */
function headerStyle() {
  return {
    background: '#FAFAFA',
    color: 'rgba(0,0,0,0.65)',
    fontWeight: '600',
    fontSize: '13px',
    borderBottom: '1px solid #F0F0F0',
  }
}
function cellStyle() {
  return {
    borderBottom: '1px solid #F0F0F0',
    fontSize: '14px',
  }
}

const {
  data,
  loading,
  pagination,
  filters,
  dialogVisible,
  form,
  isEditing,
  fetchData,
  openDialog,
  save: originalSave,
  deleteItem,
} = useCrud(props.entity)

const formRef = ref(null)
const localFilters = ref({ ...filters.value })

function onSearch() {
  filters.value = { ...localFilters.value }
  pagination.value.page = 1
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

// 把 openDialog 暴露给模板（父组件也可通过 ref 调用）
defineExpose({ openDialog })
</script>

<style scoped>
.crud-tab {
  background: var(--color-bg-container, #FFFFFF);
  border-radius: var(--radius-md, 12px);
  box-shadow: var(--shadow-sm);
  padding: var(--space-lg, 24px);
}

.crud-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-md, 16px);
  gap: var(--space-md, 16px);
}
.crud-search {
  max-width: 320px;
}

.crud-table {
  border-radius: var(--radius-md, 12px);
  overflow: hidden;
  font-size: 14px;
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
