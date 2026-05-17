<template>
  <div class="audit-logs-view">
    <h2 class="page-title">审计日志</h2>

    <!-- 筛选栏 -->
    <el-card class="mb-4" :body-style="{ padding: '16px' }">
      <div class="filter-bar">
        <el-select
          v-model="filters.action"
          placeholder="全部操作"
          clearable
          class="filter-item"
        >
          <el-option label="创建" value="create" />
          <el-option label="更新" value="update" />
          <el-option label="删除" value="delete" />
          <el-option label="排考" value="schedule" />
        </el-select>

        <el-input
          v-model="filters.entity"
          placeholder="实体类型..."
          clearable
          class="filter-item"
        />

        <el-button type="primary" @click="fetchLogs">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </div>
    </el-card>

    <!-- 日志表格 -->
    <el-card>
      <template #header>
        <div class="flex items-center justify-between">
          <span class="font-semibold">共 {{ pagination.total }} 条记录</span>
        </div>
      </template>

      <el-table
        :data="logs"
        stripe
        border
        v-loading="loading"
        empty-text="暂无日志记录"
        class="logs-table"
      >
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="action" label="操作" width="100">
          <template #default="{ row }">
            <el-tag
              :type="
                row.action === 'create' ? 'success' :
                row.action === 'delete' ? 'danger' :
                row.action === 'schedule' ? 'warning' : 'info'
              "
            >
              {{
                create: '创建',
                update: '更新',
                delete: '删除',
                schedule: '排考',
              }[row.action] || row.action }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="entity_type" label="实体类型" width="130" />
        <el-table-column prop="entity_id" label="实体ID" width="100" />
        <el-table-column prop="user" label="操作用户" width="120" />
        <el-table-column prop="timestamp" label="时间" width="180" />
        <el-table-column prop="details" label="详情" min-width="200" />
      </el-table>

      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.page_size"
        :total="pagination.total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next, jumper"
        class="mt-4"
        @size-change="fetchLogs"
        @current-change="fetchLogs"
      />
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/api/index.js'

const logs = ref([])
const loading = ref(false)
const filters = ref({
  action: null,
  entity: '',
})
const pagination = ref({
  page: 1,
  page_size: 20,
  total: 0,
})

async function fetchLogs() {
  loading.value = true
  try {
    const params = {
      page: pagination.value.page,
      page_size: pagination.value.page_size,
    }
    if (filters.value.action) params.action = filters.value.action
    if (filters.value.entity) params.entity_type = filters.value.entity

    const res = await api.get('/audit-logs/', { params })
    logs.value = res.items || []
    pagination.value.total = res.total || 0
  } catch (e) {
    ElMessage.error('加载失败')
    logs.value = []
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  filters.value = { action: null, entity: '' }
  pagination.value.page = 1
  fetchLogs()
}

onMounted(() => {
  fetchLogs()
})
</script>

<style scoped>
.audit-logs-view {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}
.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1F2937;
  margin-bottom: 24px;
}
.mb-4 {
  margin-bottom: 16px;
}
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}
.filter-item {
  width: 160px;
}
.mt-4 {
  margin-top: 16px;
}
.logs-table {
  min-height: 400px;
}
.flex {
  display: flex;
}
.items-center {
  align-items: center;
}
.justify-between {
  justify-content: space-between;
}
.font-semibold {
  font-weight: 600;
}
</style>
