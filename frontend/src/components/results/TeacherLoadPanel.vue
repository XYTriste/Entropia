<template>
  <div class="panel">
    <div class="panel-header">
      <h3>教师监考负荷分析</h3>
      <div class="header-actions">
        <span class="avg-load">平均负荷 {{ avgLoad.toFixed(1) }} 场/人</span>
      </div>
    </div>
    
    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="!teacherData.length" class="empty">暂无数据</div>
    <div v-else class="chart-container">
      <div class="bar-chart">
        <div 
          v-for="t in teacherData" 
          :key="t.teacher_id" 
          class="bar-item"
        >
          <div class="bar-label">{{ t.teacher_name }}</div>
          <div class="bar-wrapper">
            <div 
              class="bar" 
              :style="{ width: `${(t.count / maxCount) * 100}%` }"
              :class="{ high: t.count > avgLoad * 1.5, low: t.count === 0 }"
            >
              <span v-if="t.count > 0" class="bar-value">{{ t.count }}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="stats-row">
        <div class="stat-item">
          <div class="stat-label">最多</div>
          <div class="stat-value high">{{ maxLoad }} 场</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">最少</div>
          <div class="stat-value">{{ minLoad }} 场</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">空闲教师</div>
          <div class="stat-value success">{{ zeroLoadCount }} 人</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">超额(>8场)</div>
          <div class="stat-value danger">{{ overLoadCount }} 人</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { get } from '@/api'

const props = defineProps({
  versionId: { type: [Number, String], default: null }
})

const loading = ref(false)
const teacherData = ref([])

const maxCount = computed(() => Math.max(...teacherData.value.map(t => t.count), 1))
const avgLoad = computed(() => {
  if (!teacherData.value.length) return 0
  return teacherData.value.reduce((acc, t) => acc + t.count, 0) / teacherData.value.length
})
const maxLoad = computed(() => Math.max(...teacherData.value.map(t => t.count), 0))
const minLoad = computed(() => Math.min(...teacherData.value.map(t => t.count), 0))
const zeroLoadCount = computed(() => teacherData.value.filter(t => t.count === 0).length)
const overLoadCount = computed(() => teacherData.value.filter(t => t.count > 8).length)

async function loadTeacherData() {
  if (!props.versionId) return
  loading.value = true
  try {
    const res = await get('/exams/teachers/gantt')
    const teachers = res.data?.teachers || []
    teacherData.value = teachers
      .map(t => ({ ...t, count: t.events?.length || 0 }))
      .sort((a, b) => b.count - a.count)
  } catch (e) {
    console.error('加载教师负荷数据失败:', e)
  } finally {
    loading.value = false
  }
}

watch(() => props.versionId, loadTeacherData, { immediate: true })
</script>

<style scoped>
.panel {
  --bg-start: #0a0e27;
  --bg-end: #1a1f3a;
  --card-bg: #111827;
  --card-border: #1f2937;
  --accent: #1677ff;
  --accent-light: rgba(22, 119, 255, 0.15);
  --accent-cyan: #06b6d4;
  --accent-green: #10b981;
  --accent-yellow: #f59e0b;
  --accent-red: #ef4444;
  --text-primary: #ffffff;
  --text-secondary: #9ca3af;
  --text-muted: #6b7280;
  --radius: 8px;
}

.panel {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius);
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--card-border);
}

.panel-header h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.avg-load {
  font-size: 0.85rem;
  color: var(--accent);
  background: var(--accent-light);
  padding: 4px 12px;
  border-radius: 12px;
}

.loading, .empty {
  padding: 60px 20px;
  text-align: center;
  color: var(--text-muted);
}

.chart-container {
  padding: 20px;
}

.bar-chart {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 24px;
}

.bar-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.bar-label {
  width: 80px;
  font-size: 0.85rem;
  color: var(--text-secondary);
  text-align: right;
  flex-shrink: 0;
}

.bar-wrapper {
  flex: 1;
  height: 28px;
  background: var(--bg-start);
  border-radius: 4px;
  overflow: hidden;
}

.bar {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-cyan), var(--accent));
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 8px;
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  min-width: 40px;
}

.bar.high {
  background: linear-gradient(90deg, var(--accent-yellow), var(--accent-red));
}

.bar.low {
  background: var(--card-border);
  min-width: 4px;
}

.bar-value {
  font-size: 0.75rem;
  font-weight: 600;
  color: white;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--card-border);
}

.stat-item {
  padding: 16px;
  background: var(--bg-start);
  border-radius: var(--radius);
  text-align: center;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-bottom: 6px;
  text-transform: uppercase;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
}

.stat-value.high {
  color: var(--accent-yellow);
}

.stat-value.danger {
  color: var(--accent-red);
}

.stat-value.success {
  color: var(--accent-green);
}
</style>
