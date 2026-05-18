<template>
  <div class="patrol-panel">
    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>加载流动监考数据...</span>
    </div>

    <!-- Empty State -->
    <div v-else-if="!hasData" class="empty-state">
      <el-icon :size="48"><Guide /></el-icon>
      <p>暂无流动监考数据</p>
    </div>

    <!-- Matrix Grid -->
    <div v-else class="matrix-container">
      <!-- Legend -->
      <div v-if="Object.keys(groupColors).length > 0" class="legend">
        <span class="legend-title">监考分组：</span>
        <el-tag
          v-for="(color, name) in groupColors"
          :key="name"
          :style="{ background: color, color: '#333', border: 'none' }"
          size="small"
        >
          {{ name }}
        </el-tag>
      </div>

      <table class="matrix-table">
        <thead>
          <tr>
            <th class="corner-cell"></th>
            <th v-for="day in DAYS" :key="day" :colspan="4" class="day-header">{{ day }}</th>
          </tr>
          <tr>
            <th class="corner-cell"></th>
            <th v-for="i in 20" :key="i" class="slot-header">{{ SLOTS[(i - 1) % 4] }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, rowIdx) in matrixRows" :key="rowIdx">
            <td class="row-label">
              {{ row.slot }}<br>
              <span class="time-range">{{ SLOT_TIME_RANGES[row.slot] }}</span>
            </td>
            <td
              v-for="(cell, cellIdx) in row.cells"
              :key="cellIdx"
              class="matrix-cell"
              :style="getCellStyle(cell)"
            >
              <div v-if="cell.teachers.length" class="cell-content">
                <div
                  v-for="teacher in cell.teachers.slice(0, 3)"
                  :key="teacher.teacher_id"
                  class="teacher-item"
                  :style="{ background: getGroupBg(teacher.patrol_group_name) }"
                >
                  {{ teacher.teacher_name }}
                </div>
                <div v-if="cell.teachers.length > 3" class="more-count">
                  +{{ cell.teachers.length - 3 }}
                </div>
              </div>
              <div v-else class="empty-cell">-</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Guide, Loading } from '@element-plus/icons-vue'
import api from '@/api/index.js'

const props = defineProps({
  versionId: { type: Number, default: null }
})

const DAYS = ['周一', '周二', '周三', '周四', '周五']
const SLOTS = ['T1', 'T2', 'T3', 'T4']
const SLOT_TIME_RANGES = {
  'T1': '08:00-10:00',
  'T2': '10:30-12:30',
  'T3': '14:00-16:00',
  'T4': '16:30-18:30',
}

const loading = ref(false)
const matrixData = ref({})
const groupColors = ref({})

const hasData = computed(() => Object.keys(matrixData.value).length > 0)

const matrixRows = computed(() => {
  if (!matrixData.value) return []
  const rows = []
  for (const slot of SLOTS) {
    const cells = []
    for (const day of DAYS) {
      const teachers = matrixData.value[day]?.[slot] || []
      cells.push({ day, slot, teachers })
    }
    rows.push({ slot, cells })
  }
  return rows
})

function getGroupBg(groupName) {
  if (!groupName || !groupColors.value[groupName]) return 'rgba(79, 195, 247, 0.1)'
  return groupColors.value[groupName]
}

function getCellStyle(cell) {
  if (!cell.teachers.length) return {}
  // 整体边框颜色取第一个分组的颜色
  const firstGroup = cell.teachers[0]?.patrol_group_name
  const color = groupColors.value[firstGroup] || '#4fc3f7'
  return { borderLeft: `3px solid ${color}` }
}

async function loadData() {
  if (!props.versionId) return
  loading.value = true
  try {
    const res = await api.get('/exams/patrol/matrix')
    matrixData.value = res.data?.matrix || {}
    groupColors.value = res.data?.group_colors || {}
  } catch (e) {
    ElMessage.error('加载流动监考数据失败')
    matrixData.value = {}
    groupColors.value = {}
  } finally {
    loading.value = false
  }
}

watch(() => props.versionId, loadData, { immediate: true })
</script>

<style scoped>
.patrol-panel { min-height: 300px; }

.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: rgba(224,224,224,0.55);
  gap: 12px;
}

.legend {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.legend-title {
  font-size: 0.85rem;
  color: rgba(224, 224, 224, 0.6);
}

.matrix-container { overflow-x: auto; }

.matrix-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 2px;
  min-width: 900px;
}

.matrix-table th, .matrix-table td {
  border: 1px solid rgba(100, 140, 255, 0.15);
  padding: 0;
  vertical-align: top;
}

.corner-cell {
  width: 80px;
  background: transparent;
  border: none;
}

.day-header {
  background: rgba(124, 77, 255, 0.1);
  color: #7c4dff;
  font-weight: 600;
  text-align: center;
  padding: 8px 4px;
  font-size: 0.9rem;
}

.slot-header {
  background: rgba(124, 77, 255, 0.05);
  color: rgba(224, 224, 224, 0.7);
  font-size: 0.75rem;
  font-weight: normal;
  text-align: center;
  padding: 4px 2px;
}

.row-label {
  background: rgba(124, 77, 255, 0.08);
  color: #7c4dff;
  font-size: 0.85rem;
  font-weight: 600;
  padding: 8px;
  text-align: center;
}
.time-range {
  font-size: 0.7rem;
  font-weight: normal;
  color: rgba(224, 224, 224, 0.55);
}

.matrix-cell {
  min-height: 60px;
  background: rgba(26, 31, 58, 0.6);
}

.cell-content {
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.teacher-item {
  padding: 3px 6px;
  border-radius: 4px;
  font-size: 0.75rem;
  color: #333;
  font-weight: 500;
}

.more-count {
  font-size: 0.75rem;
  color: #7c4dff;
  text-align: center;
}

.empty-cell {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(224, 224, 224, 0.3);
}
</style>
