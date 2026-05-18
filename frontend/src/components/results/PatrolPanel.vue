<template>
  <div class="panel">
    <div class="panel-header">
      <h3>流动监考安排</h3>
      <div class="header-actions">
        <span class="patrol-count">{{ totalPatrols }} 人次</span>
      </div>
    </div>
    
    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="!totalPatrols" class="empty">暂无流动监考数据</div>
    <div v-else class="patrol-container">
      <div class="matrix">
        <!-- 表头 -->
        <div class="matrix-row header">
          <div class="matrix-cell corner"></div>
          <div v-for="day in days" :key="day" class="matrix-cell day-header">
            {{ day }}
          </div>
        </div>
        
        <!-- 时段行 -->
        <div v-for="slot in slotDefs" :key="slot.code" class="matrix-row">
          <div class="matrix-cell slot-label">
            <span class="slot-code">{{ slot.code }}</span>
            <span class="slot-time">{{ slot.time }}</span>
          </div>
          <div 
            v-for="day in days" 
            :key="`${day}-${slot.code}`"
            class="matrix-cell patrol-cell"
          >
            <div 
              v-for="(patrol, idx) in getPatrols(day, slot.code)" 
              :key="idx"
              class="patrol-tag"
              :style="{ backgroundColor: getGroupColor(patrol.patrol_group_name) }"
            >
              {{ patrol.teacher_name }}
            </div>
            <span v-if="!getPatrols(day, slot.code).length" class="empty-text">-</span>
          </div>
        </div>
      </div>
      
      <div class="group-legend">
        <div class="legend-title">分组说明</div>
        <div class="legend-items">
          <div v-for="(color, group) in groupColors" :key="group" class="legend-item">
            <span class="legend-color" :style="{ backgroundColor: color }"></span>
            <span class="legend-label">{{ group || '未分组' }}</span>
          </div>
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
const matrix = ref({})
const groupColors = ref({})

const days = ['周一', '周二', '周三', '周四', '周五']
const slotDefs = [
  { code: 'T1', time: '08:30' },
  { code: 'T2', time: '10:20' },
  { code: 'T3', time: '14:00' },
  { code: 'T4', time: '15:50' },
]

const totalPatrols = computed(() => {
  let count = 0
  for (const day of days) {
    const dayData = matrix.value[day] || {}
    for (const slot of slotDefs) {
      count += (dayData[slot.code] || []).length
    }
  }
  return count
})

function getPatrols(day, slotCode) {
  return matrix.value[day]?.[slotCode] || []
}

function getGroupColor(groupName) {
  const color = groupColors.value[groupName] || 'rgba(107, 114, 128, 0.3)'
  return color
}

async function loadData() {
  if (!props.versionId) return
  loading.value = true
  try {
    const res = await get('/exams/patrol/matrix')
    matrix.value = res.data?.matrix || {}
    groupColors.value = res.data?.group_colors || {}
  } catch (e) {
    console.error('加载流动监考数据失败:', e)
  } finally {
    loading.value = false
  }
}

watch(() => props.versionId, loadData, { immediate: true })
</script>

<style scoped>
.panel {
  --bg-start: #0a0e27;
  --bg-end: #1a1f3a;
  --card-bg: #111827;
  --card-border: #1f2937;
  --accent: #1677ff;
  --accent-purple: #8b5cf6;
  --accent-light: rgba(22, 119, 255, 0.15);
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

.patrol-count {
  font-size: 0.85rem;
  color: var(--accent-purple);
  background: rgba(139, 92, 246, 0.15);
  padding: 4px 12px;
  border-radius: 12px;
}

.loading, .empty {
  padding: 60px 20px;
  text-align: center;
  color: var(--text-muted);
}

.patrol-container {
  padding: 20px;
  overflow-x: auto;
}

.matrix {
  min-width: 700px;
  margin-bottom: 20px;
}

.matrix-row {
  display: grid;
  grid-template-columns: 100px repeat(5, 1fr);
  gap: 2px;
  margin-bottom: 2px;
}

.matrix-row.header {
  margin-bottom: 4px;
}

.matrix-cell {
  padding: 10px 8px;
  text-align: center;
  font-size: 0.85rem;
  background: var(--bg-start);
  border-radius: 4px;
}

.corner {
  background: transparent;
}

.day-header {
  font-weight: 600;
  color: var(--accent-purple);
  background: rgba(139, 92, 246, 0.15) !important;
}

.slot-label {
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: var(--card-bg) !important;
  border-right: 1px solid var(--card-border);
}

.slot-code {
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--text-primary);
}

.slot-time {
  font-size: 0.7rem;
  color: var(--text-muted);
}

.patrol-cell {
  min-height: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.patrol-tag {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  color: #333;
  font-weight: 500;
  white-space: nowrap;
}

.empty-text {
  color: var(--text-muted);
}

.group-legend {
  padding: 16px;
  background: var(--bg-start);
  border-radius: var(--radius);
  border: 1px solid var(--card-border);
}

.legend-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12px;
}

.legend-items {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 4px;
}

.legend-label {
  font-size: 0.8rem;
  color: var(--text-secondary);
}
</style>
