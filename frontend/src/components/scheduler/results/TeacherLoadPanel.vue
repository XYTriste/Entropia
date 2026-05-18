<template>
  <div class="teacher-load-panel">
    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>加载教师负荷数据...</span>
    </div>

    <!-- Empty State -->
    <div v-else-if="!hasData" class="empty-state">
      <el-icon :size="48"><TrendCharts /></el-icon>
      <p>暂无教师负荷数据</p>
    </div>

    <!-- Stats Cards -->
    <div v-else class="stats-row">
      <div class="stat-card">
        <div class="stat-label">监考教师总数</div>
        <div class="stat-value accent">{{ loadData.length }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">平均监考场次</div>
        <div class="stat-value purple">{{ avgLoad }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">最高场次</div>
        <div class="stat-value red">{{ maxLoad }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">最低场次</div>
        <div class="stat-value green">{{ minLoad }}</div>
      </div>
    </div>

    <!-- Bar Chart -->
    <div v-if="hasData" class="chart-container">
      <h3 class="chart-title">教师监考场次排名</h3>
      <div class="bar-chart">
        <div
          v-for="item in sortedData"
          :key="item.teacher_id"
          class="bar-row"
        >
          <div class="bar-label" :title="item.teacher_name">
            {{ item.teacher_name }}
          </div>
          <div class="bar-track">
            <div
              class="bar-fill"
              :class="getBarClass(item.count)"
              :style="{ width: getBarWidth(item.count) + '%' }"
            >
              <span v-if="item.count > 0" class="bar-value">{{ item.count }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Threshold Warning -->
    <div v-if="hasData && overloadedTeachers.length > 0" class="warning-box">
      <el-icon><Warning /></el-icon>
      <span>以下教师监考场次超过上限，请注意调配：</span>
      <el-tag
        v-for="t in overloadedTeachers"
        :key="t.teacher_id"
        type="danger"
        size="small"
      >
        {{ t.teacher_name }} ({{ t.count }}场)
      </el-tag>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { TrendCharts, Loading, Warning } from '@element-plus/icons-vue'
import api from '@/api/index.js'

const props = defineProps({
  versionId: { type: Number, default: null }
})

const loading = ref(false)
const loadData = ref([])

const hasData = computed(() => loadData.value.length > 0)

const avgLoad = computed(() => {
  if (!loadData.value.length) return 0
  const total = loadData.value.reduce((sum, t) => sum + t.events.length, 0)
  return (total / loadData.value.length).toFixed(1)
})

const maxLoad = computed(() => Math.max(...loadData.value.map(t => t.events.length), 0))
const minLoad = computed(() => Math.min(...loadData.value.map(t => t.events.length), 0))

const sortedData = computed(() => {
  return loadData.value
    .map(t => ({ teacher_id: t.teacher_id, teacher_name: t.teacher_name, count: t.events.length }))
    .sort((a, b) => b.count - a.count)
})

const overloadedTeachers = computed(() => {
  return sortedData.value.filter(t => t.count > 6) // 超过6场视为超负荷
})

function getBarWidth(count) {
  if (!maxLoad.value) return 0
  return Math.max((count / maxLoad.value) * 100, count > 0 ? 8 : 0)
}

function getBarClass(count) {
  if (count > 6) return 'bar-danger'
  if (count > 4) return 'bar-warning'
  return 'bar-normal'
}

async function loadData() {
  if (!props.versionId) return
  loading.value = true
  try {
    const res = await api.get('/exams/teachers/gantt')
    const teachers = res.data?.teachers || []
    // 按监考场次排序
    loadData.value = teachers.sort((a, b) => b.events.length - a.events.length)
  } catch (e) {
    ElMessage.error('加载教师负荷数据失败')
    loadData.value = []
  } finally {
    loading.value = false
  }
}

watch(() => props.versionId, loadData, { immediate: true })
</script>

<style scoped>
.teacher-load-panel { min-height: 300px; }

.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: rgba(224,224,224,0.55);
  gap: 12px;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.stat-card {
  background: rgba(26, 31, 58, 0.6);
  border: 1px solid rgba(100, 140, 255, 0.15);
  border-radius: 10px;
  padding: 16px;
  text-align: center;
}
.stat-label {
  font-size: 0.8rem;
  color: rgba(224, 224, 224, 0.6);
  margin-bottom: 8px;
}
.stat-value {
  font-size: 2rem;
  font-weight: 700;
}
.stat-value.accent { color: #4fc3f7; }
.stat-value.purple { color: #7c4dff; }
.stat-value.red { color: #ff5252; }
.stat-value.green { color: #00e676; }

.chart-container {
  background: rgba(26, 31, 58, 0.6);
  border: 1px solid rgba(100, 140, 255, 0.15);
  border-radius: 10px;
  padding: 16px;
}

.chart-title {
  font-size: 0.95rem;
  color: #e0e0e0;
  margin: 0 0 16px;
}

.bar-chart {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;
}

.bar-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.bar-label {
  width: 100px;
  font-size: 0.82rem;
  color: rgba(224, 224, 224, 0.8);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 0;
}

.bar-track {
  flex: 1;
  height: 24px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 6px;
  transition: width 0.3s ease;
}
.bar-normal { background: linear-gradient(90deg, #4fc3f7, #26c6da); }
.bar-warning { background: linear-gradient(90deg, #ffd740, #ff9100); }
.bar-danger { background: linear-gradient(90deg, #ff5252, #ff1744); }

.bar-value {
  font-size: 0.75rem;
  color: #fff;
  font-weight: 600;
}

.warning-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 82, 82, 0.1);
  border: 1px solid rgba(255, 82, 82, 0.3);
  border-radius: 8px;
  padding: 12px 16px;
  margin-top: 16px;
  color: #ff5252;
  font-size: 0.85rem;
  flex-wrap: wrap;
}

.bar-chart::-webkit-scrollbar { width: 6px; }
.bar-chart::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 3px; }
.bar-chart::-webkit-scrollbar-thumb { background: rgba(100,140,255,0.3); border-radius: 3px; }
</style>
