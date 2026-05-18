<template>
  <div class="panel">
    <div class="panel-header">
      <h3>班级考试安排</h3>
      <div class="header-actions">
        <el-select v-model="selectedClassId" placeholder="选择班级" size="small" style="width: 200px" clearable>
          <el-option v-for="c in classes" :key="c.id" :label="c.name" :value="c.id" />
        </el-select>
      </div>
    </div>
    
    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="!selectedClassId" class="empty">请选择班级查看考试安排</div>
    <div v-else-if="!scheduleData.exams?.length" class="empty">该班级暂无考试安排</div>
    <div v-else class="timeline-container">
      <div class="class-info">
        <span class="class-name">{{ scheduleData.class_name }}</span>
        <span class="class-grade">年级: {{ scheduleData.grade }}</span>
        <span class="exam-total">{{ scheduleData.exams.length }} 场考试</span>
      </div>
      
      <div class="timeline">
        <div 
          v-for="(exam, idx) in scheduleData.exams" 
          :key="exam.exam_id"
          class="timeline-item"
        >
          <div class="timeline-marker">
            <div class="marker-dot"></div>
            <div v-if="idx < scheduleData.exams.length - 1" class="marker-line"></div>
          </div>
          <div class="timeline-content">
            <div class="timeline-header">
              <span class="exam-date">
                周{{ ['一','二','三','四','五','六','日'][exam.day_of_week - 1] || exam.day_name }}
                {{ exam.slot_code }} {{ exam.time_range }}
              </span>
              <el-tag v-if="exam.exam_label" size="small" type="warning">{{ exam.exam_label }}卷</el-tag>
              <el-tag v-if="exam.course_type === 'public'" size="small" type="success">公共课</el-tag>
            </div>
            <div class="timeline-body">
              <div class="exam-course">{{ exam.course_name }}</div>
              <div class="exam-meta">
                <span class="meta-item">
                  <svg class="meta-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z"/></svg>
                  {{ exam.classroom_name || '-' }}
                </span>
                <span v-if="exam.teacher_names?.length" class="meta-item">
                  <svg class="meta-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
                  {{ exam.teacher_names.join(', ') }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { get } from '@/api'

const props = defineProps({
  versionId: { type: [Number, String], default: null }
})

const loading = ref(false)
const classes = ref([])
const selectedClassId = ref(null)
const scheduleData = ref({ exams: [] })

async function loadClasses() {
  try {
    const res = await get('/classes/')
    classes.value = res.data || []
    if (classes.value.length > 0 && !selectedClassId.value) {
      selectedClassId.value = classes.value[0].id
    }
  } catch (e) {
    console.error('加载班级数据失败:', e)
  }
}

async function loadSchedule() {
  if (!selectedClassId.value) return
  loading.value = true
  try {
    const res = await get(`/exams/classes/${selectedClassId.value}/schedule`)
    scheduleData.value = res.data || { exams: [] }
  } catch (e) {
    console.error('加载班级考试安排失败:', e)
    scheduleData.value = { exams: [] }
  } finally {
    loading.value = false
  }
}

watch(selectedClassId, loadSchedule)
watch(() => props.versionId, () => {
  loadClasses()
})

onMounted(loadClasses)
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
  --accent-green: #10b981;
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

.loading, .empty {
  padding: 60px 20px;
  text-align: center;
  color: var(--text-muted);
}

.timeline-container {
  padding: 24px;
}

.class-info {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
  padding: 16px;
  background: var(--bg-start);
  border-radius: var(--radius);
}

.class-name {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--accent);
}

.class-grade {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.exam-total {
  margin-left: auto;
  font-size: 0.85rem;
  padding: 4px 12px;
  background: var(--accent-light);
  color: var(--accent);
  border-radius: 12px;
}

.timeline {
  position: relative;
  padding-left: 30px;
}

.timeline-item {
  position: relative;
  padding-bottom: 24px;
}

.timeline-marker {
  position: absolute;
  left: -24px;
  top: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.marker-dot {
  width: 12px;
  height: 12px;
  background: linear-gradient(135deg, var(--accent-cyan), var(--accent));
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 10px rgba(6, 182, 212, 0.5);
}

.marker-line {
  width: 2px;
  flex: 1;
  background: linear-gradient(180deg, var(--accent-cyan), var(--accent), transparent);
  margin-top: 4px;
}

.timeline-content {
  background: var(--bg-start);
  border: 1px solid var(--card-border);
  border-radius: var(--radius);
  padding: 16px;
  transition: all 0.2s;
}

.timeline-content:hover {
  border-color: var(--accent);
  transform: translateX(4px);
}

.timeline-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.exam-date {
  font-weight: 600;
  color: var(--accent);
  font-size: 0.9rem;
}

.exam-course {
  font-size: 1rem;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.exam-meta {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.meta-icon {
  width: 14px;
  height: 14px;
  color: var(--text-muted);
}

/* Element Plus */
:deep(.el-select) {
  --el-fill-color-blank: var(--bg-start);
  --el-text-color-regular: var(--text-primary);
  --el-border-color: var(--card-border);
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
</style>
