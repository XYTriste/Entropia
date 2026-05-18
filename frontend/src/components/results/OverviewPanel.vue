<template>
  <div class="panel">
    <div class="panel-header">
      <h3>考试总览矩阵</h3>
      <div class="header-actions">
        <span class="exam-count">{{ totalExams }} 场考试</span>
      </div>
    </div>
    
    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="!totalExams" class="empty">暂无考试数据</div>
    <div v-else class="matrix-wrapper">
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
            class="matrix-cell exam-cell"
            :class="getCellClass(day, slot.code)"
            @click="openExamDetail(day, slot.code)"
          >
            <template v-if="getCellExams(day, slot.code).length">
              <div 
                v-for="exam in getCellExams(day, slot.code)" 
                :key="exam.exam_id"
                class="exam-tag"
                :class="{ 
                  'is-public': exam.course_type === 'public',
                  'is-ab': exam.exam_label 
                }"
              >
                <span class="course-name">{{ exam.course_name }}</span>
                <span v-if="exam.exam_label" class="exam-label">{{ exam.exam_label }}</span>
              </div>
            </template>
            <span v-else class="empty-cell">
              <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 考试详情弹窗 -->
    <el-dialog v-model="dialogVisible" title="考试详情" width="700px" :append-to-body="true">
      <div v-if="selectedExam" class="exam-detail">
        <div class="detail-header">
          <div class="detail-title">
            <h4>{{ selectedExam.course_name }}</h4>
            <el-tag v-if="selectedExam.exam_label" size="small" type="warning">{{ selectedExam.exam_label }}卷</el-tag>
            <el-tag v-if="selectedExam.course_type === 'public'" size="small" type="success">公共课</el-tag>
            <el-tag v-else size="small" type="info">专业课</el-tag>
          </div>
          <div class="detail-meta">
            <span>总人数: {{ selectedExam.total_students }} 人</span>
          </div>
        </div>
        
        <div class="detail-section">
          <h5>教室安排</h5>
          <el-table :data="selectedExam.classrooms" size="small" border>
            <el-table-column prop="classroom_name" label="教室" />
            <el-table-column prop="capacity" label="容量" width="80" />
            <el-table-column prop="total_students" label="考试人数" width="90" />
            <el-table-column label="涉及班级">
              <template #default="{ row }">
                <span v-for="(c, i) in row.classes" :key="i">{{ c.class_name }}({{ c.student_count }}人) </span>
              </template>
            </el-table-column>
          </el-table>
        </div>
        
        <div class="detail-section">
          <h5>监考教师</h5>
          <div class="teachers-list">
            <div v-for="t in selectedExam.teachers" :key="t.teacher_name" class="teacher-item">
              <el-tag size="small" :type="t.role === 'fixed' ? '' : 'warning'">
                {{ t.role === 'fixed' ? '固定监考' : '流动监考' }}
              </el-tag>
              <span class="teacher-name">{{ t.teacher_name }}</span>
              <span v-if="t.role === 'fixed' && t.classroom_name" class="teacher-room">
                ({{ t.classroom_name }})
              </span>
            </div>
          </div>
        </div>
      </div>
    </el-dialog>
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
const dialogVisible = ref(false)
const selectedExam = ref(null)

const days = ['周一', '周二', '周三', '周四', '周五']
const slotDefs = [
  { code: 'T1', time: '08:30-10:10' },
  { code: 'T2', time: '10:20-12:00' },
  { code: 'T3', time: '14:00-15:40' },
  { code: 'T4', time: '15:50-17:30' },
]

const totalExams = computed(() => {
  let count = 0
  for (const day of days) {
    const dayData = matrix.value[day] || {}
    for (const slot of slotDefs) {
      count += (dayData[slot.code] || []).length
    }
  }
  return count
})

function getCellExams(day, slotCode) {
  return matrix.value[day]?.[slotCode] || []
}

function getCellClass(day, slotCode) {
  const count = getCellExams(day, slotCode).length
  if (count === 0) return 'empty'
  if (count === 1) return 'single'
  return 'multi'
}

function openExamDetail(day, slotCode) {
  const exams = getCellExams(day, slotCode)
  if (exams.length === 1) {
    selectedExam.value = exams[0]
    dialogVisible.value = true
  } else if (exams.length > 1) {
    selectedExam.value = exams[0]
    dialogVisible.value = true
  }
}

async function loadData() {
  if (!props.versionId) return
  loading.value = true
  try {
    const res = await get('/exams/overview/matrix')
    matrix.value = res.data?.matrix || {}
  } catch (e) {
    console.error('加载考试数据失败:', e)
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
  --accent-light: rgba(22, 119, 255, 0.15);
  --accent-cyan: #06b6d4;
  --accent-purple: #8b5cf6;
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

.exam-count {
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

.matrix-wrapper {
  padding: 20px;
  overflow-x: auto;
}

.matrix {
  min-width: 700px;
}

.matrix-row {
  display: grid;
  grid-template-columns: 120px repeat(5, 1fr);
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
  color: var(--text-primary);
  background: var(--accent-light) !important;
  font-size: 1rem;
}

.slot-label {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: var(--card-bg) !important;
  gap: 2px;
}

.slot-code {
  font-weight: 600;
  font-size: 1rem;
  color: var(--text-primary);
}

.slot-time {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.exam-cell {
  min-height: 100px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  padding: 4px;
  gap: 4px;
}

.exam-cell:hover {
  background: var(--accent-light);
  transform: scale(1.02);
}

.exam-cell.empty {
  background: var(--bg-start);
}

.exam-cell.single {
  border-left: 3px solid var(--accent-cyan);
}

.exam-cell.multi {
  border-left: 3px solid var(--accent-purple);
}

.exam-tag {
  flex: 1;
  min-height: 0;
  padding: 6px 8px;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition: all 0.2s;
  overflow: hidden;
}

.exam-tag:hover {
  background: var(--accent-light);
  border-color: var(--accent);
  flex: 1.1;
}

.exam-tag.is-public {
  border-left: 3px solid #10b981;
}

.exam-tag.is-ab {
  border-left: 3px solid var(--accent-purple);
}

.course-name {
  font-size: 0.75rem;
  color: var(--text-primary);
  font-weight: 500;
  text-align: center;
  word-break: break-word;
  line-height: 1.3;
}

.exam-label {
  font-size: 0.65rem;
  background: var(--accent-purple);
  color: white;
  padding: 2px 4px;
  border-radius: 2px;
  flex-shrink: 0;
}

.empty-cell {
  color: var(--text-muted);
}

/* 弹窗样式 */
.detail-header {
  margin-bottom: 20px;
}

.detail-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.detail-title h4 {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.detail-meta {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.detail-section {
  margin-top: 16px;
}

.detail-section h5 {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 10px;
}

.teachers-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.teacher-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--bg-start);
  border-radius: 4px;
}

.teacher-name {
  color: var(--text-primary);
}

.teacher-room {
  color: var(--text-muted);
  font-size: 0.8rem;
}

/* Element Plus 深色适配 */
:deep(.el-dialog) {
  background: var(--card-bg) !important;
  border: 1px solid var(--card-border);
}
:deep(.el-dialog__header) {
  border-bottom: 1px solid var(--card-border);
  padding: 16px 20px;
}
:deep(.el-dialog__title) {
  color: var(--text-primary);
}
:deep(.el-dialog__body) {
  padding: 20px;
  color: var(--text-primary);
}
:deep(.el-table) {
  background: var(--bg-start);
  color: var(--text-primary);
}
:deep(.el-table th) {
  background: var(--card-bg);
  color: var(--text-secondary);
}
:deep(.el-table td) {
  border-color: var(--card-border);
}
:deep(.el-table--border .el-table__cell) {
  border-color: var(--card-border);
}
:deep(.el-tag) {
  border-color: var(--card-border);
}
:deep(.el-tag--success) {
  background: rgba(16, 185, 129, 0.2);
  border-color: #10b981;
  color: #10b981;
}
:deep(.el-tag--warning) {
  background: rgba(139, 92, 246, 0.2);
  border-color: var(--accent-purple);
  color: var(--accent-purple);
}
:deep(.el-tag--info) {
  background: var(--accent-light);
  border-color: var(--accent);
  color: var(--accent);
}
</style>
