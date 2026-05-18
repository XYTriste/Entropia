<template>
  <div class="panel">
    <div class="panel-header">
      <h3>课程考试详情</h3>
      <div class="header-actions">
        <el-select v-model="selectedCourseId" placeholder="选择课程" size="small" style="width: 280px" clearable>
          <el-option v-for="c in courses" :key="c.id" :label="c.name" :value="c.id" />
        </el-select>
      </div>
    </div>
    
    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="!selectedCourseId" class="empty">请选择课程查看详情</div>
    <div v-else-if="!courseDetail.course_name" class="empty">课程详情加载失败</div>
    <div v-else class="detail-container">
      <!-- 课程基本信息 -->
      <div class="info-card">
        <div class="card-header">
          <div class="course-title">
            <h4>{{ courseDetail.course_name }}</h4>
            <el-tag v-if="courseDetail.course_type === 'public'" size="small" type="success">公共课</el-tag>
            <el-tag v-else size="small" type="info">专业课</el-tag>
          </div>
          <div class="course-id">课程ID: {{ courseDetail.course_id }}</div>
        </div>
      </div>

      <!-- AB卷分析 -->
      <div v-if="courseDetail.needs_ab && courseDetail.ab_analysis" class="info-card highlight">
        <div class="card-header">
          <span class="card-title">AB卷分析</span>
          <el-tag size="small" type="success">已启用</el-tag>
        </div>
        <div class="ab-grid">
          <div class="ab-item">
            <span class="ab-label">A卷人数</span>
            <span class="ab-value a">{{ courseDetail.ab_analysis.a_student_count }}</span>
          </div>
          <div class="ab-item">
            <span class="ab-label">B卷人数</span>
            <span class="ab-value b">{{ courseDetail.ab_analysis.b_student_count }}</span>
          </div>
          <div class="ab-item">
            <span class="ab-label">人数差异</span>
            <span class="ab-value" :class="{ warning: courseDetail.ab_analysis.balance !== '均衡' }">
              {{ Math.abs(courseDetail.ab_analysis.a_student_count - courseDetail.ab_analysis.b_student_count) }} 人
            </span>
          </div>
          <div class="ab-item">
            <span class="ab-label">均衡状态</span>
            <el-tag size="small" :type="courseDetail.ab_analysis.balance === '均衡' ? 'success' : 'warning'">
              {{ courseDetail.ab_analysis.balance }}
            </el-tag>
          </div>
        </div>
        <div class="ab-times" v-if="courseDetail.ab_analysis.a_time_slot">
          <span>A卷: {{ courseDetail.ab_analysis.a_time_slot }}</span>
          <span v-if="courseDetail.ab_analysis.b_time_slot"> | B卷: {{ courseDetail.ab_analysis.b_time_slot }}</span>
        </div>
      </div>

      <!-- 考试安排详情 -->
      <div v-if="courseDetail.exams?.length" class="info-card">
        <div class="card-header">
          <span class="card-title">考试安排</span>
          <span class="exam-count">{{ courseDetail.exams.length }} 场考试</span>
        </div>
        <div class="exams-list">
          <div v-for="exam in courseDetail.exams" :key="exam.exam_id" class="exam-item">
            <div class="exam-header">
              <el-tag v-if="exam.exam_label" size="small" type="warning">{{ exam.exam_label }}卷</el-tag>
              <span class="exam-time">
                {{ exam.time_slot?.day_name || '' }} {{ exam.time_slot?.slot_code || '' }} 
                {{ exam.time_slot?.start_time || '' }}-{{ exam.time_slot?.end_time || '' }}
              </span>
            </div>
            
            <div class="exam-body">
              <!-- 教室 -->
              <div class="exam-section" v-if="exam.classrooms?.length">
                <div class="section-title">教室安排</div>
                <div class="classrooms-grid">
                  <div v-for="room in exam.classrooms" :key="room.classroom_id" class="classroom-item">
                    <span class="room-name">{{ room.classroom_name }}</span>
                    <span class="room-info">{{ room.capacity }}人 | {{ room.total_students }}考生</span>
                  </div>
                </div>
              </div>
              
              <!-- 监考教师 -->
              <div class="exam-section" v-if="exam.teachers?.length">
                <div class="section-title">监考教师</div>
                <div class="teachers-row">
                  <div v-for="t in exam.teachers" :key="t.teacher_name" class="teacher-item">
                    <el-tag size="small" :type="t.role === 'fixed' ? '' : 'warning'">
                      {{ t.role === 'fixed' ? '固定' : '流动' }}
                    </el-tag>
                    <span class="teacher-name">{{ t.teacher_name }}</span>
                    <span v-if="t.role === 'fixed' && t.classroom_name" class="teacher-room">
                      {{ t.classroom_name }}
                    </span>
                  </div>
                </div>
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
const courses = ref([])
const selectedCourseId = ref(null)
const courseDetail = ref({})

async function loadCourses() {
  try {
    const res = await get('/courses/')
    courses.value = res.data || []
    if (courses.value.length > 0 && !selectedCourseId.value) {
      selectedCourseId.value = courses.value[0].id
    }
  } catch (e) {
    console.error('加载课程数据失败:', e)
  }
}

async function loadCourseDetail() {
  if (!selectedCourseId.value) return
  loading.value = true
  try {
    const res = await get(`/exams/courses/${selectedCourseId.value}/detail`)
    courseDetail.value = res.data || {}
  } catch (e) {
    console.error('加载课程详情失败:', e)
    courseDetail.value = {}
  } finally {
    loading.value = false
  }
}

watch(selectedCourseId, loadCourseDetail)
watch(() => props.versionId, () => {
  loadCourses()
})

onMounted(loadCourses)
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
  --accent-yellow: #f59e0b;
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

.detail-container {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.info-card {
  background: var(--bg-start);
  border: 1px solid var(--card-border);
  border-radius: var(--radius);
  padding: 20px;
}

.info-card.highlight {
  border-color: var(--accent-purple);
  background: rgba(139, 92, 246, 0.1);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.course-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.course-title h4 {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.course-id {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.card-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
}

.exam-count {
  font-size: 0.8rem;
  color: var(--accent);
  background: var(--accent-light);
  padding: 4px 12px;
  border-radius: 12px;
}

/* AB卷分析 */
.ab-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 12px;
}

.ab-item {
  text-align: center;
  padding: 12px;
  background: var(--card-bg);
  border-radius: 6px;
}

.ab-label {
  display: block;
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-bottom: 6px;
}

.ab-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
}

.ab-value.a {
  color: var(--accent);
}

.ab-value.b {
  color: var(--accent-purple);
}

.ab-value.warning {
  color: var(--accent-yellow);
}

.ab-times {
  font-size: 0.8rem;
  color: var(--text-secondary);
  text-align: center;
}

/* 考试安排列表 */
.exams-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.exam-item {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 6px;
  padding: 16px;
}

.exam-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--card-border);
}

.exam-time {
  font-weight: 500;
  color: var(--accent-cyan);
}

.exam-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.exam-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.classrooms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 8px;
}

.classroom-item {
  display: flex;
  flex-direction: column;
  padding: 8px 12px;
  background: var(--bg-start);
  border-radius: 4px;
}

.room-name {
  font-weight: 500;
  color: var(--text-primary);
}

.room-info {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.teachers-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
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
  font-size: 0.75rem;
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
:deep(.el-tag--info) {
  background: var(--accent-light);
  border-color: var(--accent);
  color: var(--accent);
}
</style>
