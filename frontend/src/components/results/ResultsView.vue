<template>
  <div class="results-view">
    <h2 class="page-title">排考结果</h2>

    <!-- 筛选栏 -->
    <el-card class="mb-4" :body-style="{ padding: '16px' }">
      <div class="filter-bar">
        <el-select
          v-model="filters.day_of_week"
          placeholder="全部星期"
          clearable
          class="filter-item"
        >
          <el-option label="星期一" :value="1" />
          <el-option label="星期二" :value="2" />
          <el-option label="星期三" :value="3" />
          <el-option label="星期四" :value="4" />
          <el-option label="星期五" :value="5" />
        </el-select>

        <el-select
          v-model="filters.slot_code"
          placeholder="全部时段"
          clearable
          class="filter-item"
        >
          <el-option label="上午第一节 (T1)" value="T1" />
          <el-option label="上午第二节 (T2)" value="T2" />
          <el-option label="下午第一节 (T3)" value="T3" />
          <el-option label="下午第二节 (T4)" value="T4" />
        </el-select>

        <el-input
          v-model="filters.classroom"
          placeholder="教室名称..."
          clearable
          class="filter-item"
        />

        <el-input
          v-model="filters.teacher"
          placeholder="教师姓名..."
          clearable
          class="filter-item"
        />

        <el-button type="primary" @click="fetchResults">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </div>
    </el-card>

    <!-- 结果表格 -->
    <el-card>
      <template #header>
        <div class="flex items-center justify-between">
          <span class="font-semibold">共 {{ pagination.total }} 条记录</span>
          <el-button type="success" size="small" @click="exportCurrent">
            <el-icon><Download /></el-icon>
            导出当前结果
          </el-button>
        </div>
      </template>

      <el-table
        :data="results"
        stripe
        border
        v-loading="loading"
        empty-text="暂无排考结果，请先运行排考"
        class="results-table"
      >
        <el-table-column prop="exam_id" label="考试ID" width="90" />
        <el-table-column prop="course_name" label="课程名称" min-width="160" />
        <el-table-column prop="exam_label" label="卷标" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.exam_label" :type="row.exam_label === 'A' ? 'primary' : 'warning'">
              {{ row.exam_label }}
            </el-tag>
            <span v-else class="text-gray-400">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="day_name" label="星期" width="100" />
        <el-table-column prop="slot_code" label="时段" width="80" />
        <el-table-column prop="time_str" label="时间" width="140" />
        <el-table-column prop="classroom" label="教室" width="120" />
        <el-table-column label="涉考班级" min-width="180">
          <template #default="{ row }">
            {{ (row.class_names || []).join('、') || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="人数" width="80" align="center">
          <template #default="{ row }">
            {{ row.total_students || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="监考教师" min-width="160">
          <template #default="{ row }">
            {{ (row.fixed_teachers || []).join('、') || '-' }}
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.page_size"
        :total="pagination.total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        class="mt-4"
        @size-change="fetchResults"
        @current-change="fetchResults"
      />
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Download } from '@element-plus/icons-vue'
import api from '@/api/index.js'

const results = ref([])
const loading = ref(false)
const filters = ref({
  day_of_week: null,
  slot_code: '',
  classroom: '',
  teacher: '',
})
const pagination = ref({
  page: 1,
  page_size: 20,
  total: 0,
})

async function fetchResults() {
  loading.value = true
  try {
    const params = {
      page: pagination.value.page,
      page_size: pagination.value.page_size,
      status: 'scheduled',
    }
    if (filters.value.day_of_week) params.day_of_week = filters.value.day_of_week
    if (filters.value.slot_code) params.slot_code = filters.value.slot_code
    if (filters.value.classroom) params.classroom = filters.value.classroom
    if (filters.value.teacher) params.teacher = filters.value.teacher

    const res = await api.get('/exams/', { params })
    results.value = res.items || []
    pagination.value.total = res.total || 0
  } catch (e) {
    ElMessage.error('加载失败')
    results.value = []
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  filters.value = { day_of_week: null, slot_code: '', classroom: '', teacher: '' }
  pagination.value.page = 1
  fetchResults()
}

async function exportCurrent() {
  try {
    const res = await fetch('/api/export/excel')
    if (!res.ok) throw new Error('导出失败')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '排考结果.xlsx'
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch (e) {
    ElMessage.error(`导出失败：${e.message}`)
  }
}

onMounted(() => {
  fetchResults()
})
</script>

<style scoped>
.results-view {
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
.results-table {
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
</style>
