<template>
  <div class="overview-panel">
    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>加载总览数据...</span>
    </div>

    <!-- Empty State -->
    <div v-else-if="!hasData" class="empty-state">
      <el-icon :size="48"><Calendar /></el-icon>
      <p>暂无排考数据</p>
      <p class="hint">请先运行排考生成考试安排</p>
    </div>

    <!-- Matrix Grid -->
    <div v-else class="matrix-container">
      <table class="matrix-table">
        <thead>
          <tr>
            <th class="corner-cell"></th>
            <th v-for="day in DAYS" :key="day" :colspan="4" class="day-header">
              {{ day }}
            </th>
          </tr>
          <tr>
            <th class="corner-cell"></th>
            <th v-for="i in 20" :key="i" class="slot-header">
              {{ SLOTS[(i - 1) % 4] }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, rowIdx) in matrixRows" :key="rowIdx">
            <td class="row-label">
              {{ row.slot }}<br>
              <span class="time-range">{{ row.timeRange }}</span>
            </td>
            <td
              v-for="(cell, cellIdx) in row.cells"
              :key="cellIdx"
              class="matrix-cell"
              :class="getCellClass(cell)"
              @click="cell.exams.length && showExamDetail(cell.exams)"
            >
              <div v-if="cell.exams.length" class="cell-content">
                <div
                  v-for="exam in cell.exams.slice(0, 2)"
                  :key="exam.exam_id"
                  class="exam-item"
                >
                  <el-tag :type="exam.course_type === 'public' ? 'warning' : 'primary'" size="small">
                    {{ exam.exam_label || '考试' }}
                  </el-tag>
                  <span class="course-name">{{ exam.course_name }}</span>
                </div>
                <div v-if="cell.exams.length > 2" class="more-count">
                  +{{ cell.exams.length - 2 }} 场
                </div>
              </div>
              <div v-else class="empty-cell"></div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Exam Detail Dialog -->
    <el-dialog v-model="dialogVisible" title="考试详情" width="600px" destroy-on-close>
      <el-descriptions :column="2" border v-if="selectedExams.length">
        <el-descriptions-item
          v-for="exam in selectedExams"
          :key="exam.exam_id"
          :label="exam.course_name"
          :span="2"
        >
          <div class="exam-detail">
            <div class="detail-row">
              <el-tag :type="exam.course_type === 'public' ? 'warning' : 'primary'" size="small">
                {{ exam.exam_label || '考试' }}
              </el-tag>
              <span class="detail-label">{{ exam.course_type === 'public' ? '公共课' : '专业课' }}</span>
            </div>
            <div class="detail-row">
              <strong>总人数：</strong>{{ exam.total_students }} 人
            </div>
            <div class="detail-row">
              <strong>教室：</strong>
              <span v-for="(cr, idx) in exam.classrooms" :key="idx" class="room-tag">
                {{ cr.classroom_name }} ({{ cr.total_students }}人)
              </span>
            </div>
            <div class="detail-row">
              <strong>班级：</strong>
              <span v-for="(cr, idx) in exam.classrooms" :key="idx">
                <span v-for="(cls, cidx) in cr.classes" :key="cidx" class="class-tag">
                  {{ cls.class_name }}
                </span>
              </span>
            </div>
            <div class="detail-row">
              <strong>监考教师：</strong>
              <span v-for="(t, idx) in exam.teachers" :key="idx" class="teacher-tag">
                {{ t.teacher_name }}
                <el-tag v-if="t.role === 'patrol'" type="success" size="small">流动</el-tag>
              </span>
            </div>
          </div>
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Calendar, Loading } from '@element-plus/icons-vue'
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
const matrixData = ref(null)
const dialogVisible = ref(false)
const selectedExams = ref([])

const hasData = computed(() => matrixData.value && Object.keys(matrixData.value).length > 0)

const matrixRows = computed(() => {
  if (!matrixData.value) return []
  const rows = []
  for (const slot of SLOTS) {
    const cells = []
    for (const day of DAYS) {
      const exams = matrixData.value[day]?.[slot] || []
      cells.push({ day, slot, exams })
    }
    rows.push({ slot, timeRange: SLOT_TIME_RANGES[slot], cells })
  }
  return rows
})

function getCellClass(cell) {
  if (!cell.exams.length) return 'cell-empty'
  if (cell.exams.length === 1) return 'cell-single'
  return 'cell-multi'
}

function showExamDetail(exams) {
  selectedExams.value = exams
  dialogVisible.value = true
}

async function loadData() {
  if (!props.versionId) return
  loading.value = true
  try {
    const res = await api.get('/exams/overview/matrix')
    matrixData.value = res.data?.matrix || {}
  } catch (e) {
    ElMessage.error('加载总览数据失败')
    matrixData.value = {}
  } finally {
    loading.value = false
  }
}

watch(() => props.versionId, loadData, { immediate: true })
</script>

<style scoped>
.overview-panel {
  min-height: 400px;
}

.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  color: var(--text-dim, rgba(224,224,224,0.55));
  gap: 12px;
}
.empty-state p { margin: 0; }
.empty-state .hint { font-size: 0.85rem; opacity: 0.7; }

.matrix-container {
  overflow-x: auto;
}

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
  background: rgba(79, 195, 247, 0.1);
  color: #4fc3f7;
  font-weight: 600;
  text-align: center;
  padding: 8px 4px;
  font-size: 0.9rem;
}

.slot-header {
  background: rgba(79, 195, 247, 0.05);
  color: rgba(224, 224, 224, 0.7);
  font-size: 0.75rem;
  font-weight: normal;
  text-align: center;
  padding: 4px 2px;
}

.row-label {
  background: rgba(79, 195, 247, 0.08);
  color: #4fc3f7;
  font-size: 0.85rem;
  font-weight: 600;
  padding: 8px;
  text-align: center;
  white-space: nowrap;
}
.row-label .time-range {
  font-size: 0.7rem;
  font-weight: normal;
  color: rgba(224, 224, 224, 0.55);
}

.matrix-cell {
  min-height: 80px;
  background: rgba(26, 31, 58, 0.6);
  cursor: pointer;
  transition: all 0.2s;
}
.matrix-cell:hover { background: rgba(79, 195, 247, 0.1); }
.cell-single { border-left: 3px solid #4fc3f7; }
.cell-multi { border-left: 3px solid #7c4dff; }

.cell-content {
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.exam-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.78rem;
}
.course-name {
  color: #e0e0e0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 120px;
}

.more-count {
  font-size: 0.75rem;
  color: #7c4dff;
  text-align: center;
}

.empty-cell {
  height: 80px;
}

/* Dialog */
.exam-detail {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.detail-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.room-tag, .class-tag {
  background: rgba(79, 195, 247, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.85rem;
  margin: 2px;
}
.teacher-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 2px;
}
.detail-label {
  color: rgba(224, 224, 224, 0.7);
  font-size: 0.85rem;
}
</style>
