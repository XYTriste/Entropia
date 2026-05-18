<template>
  <div class="course-panel">
    <!-- Course Selector -->
    <div class="selector-bar">
      <el-select
        v-model="selectedCourseId"
        placeholder="选择课程"
        filterable
        @change="onCourseChange"
        class="course-select"
      >
        <el-option
          v-for="course in courseList"
          :key="course.id"
          :label="course.name"
          :value="course.id"
        />
      </el-select>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>加载课程数据...</span>
    </div>

    <!-- Empty State -->
    <div v-else-if="!selectedCourseId" class="empty-state">
      <el-icon :size="48"><Reading /></el-icon>
      <p>请选择课程查看考试详情</p>
    </div>

    <div v-else-if="!courseDetail" class="empty-state">
      <el-icon :size="48"><Calendar /></el-icon>
      <p>该课程暂无考试安排</p>
    </div>

    <!-- Course Detail -->
    <div v-else class="course-detail">
      <!-- Basic Info -->
      <div class="info-grid">
        <div class="info-card wide">
          <div class="card-title">
            <el-icon><Reading /></el-icon>
            {{ courseDetail.course_name }}
          </div>
          <div class="info-row">
            <div class="info-item">
              <span class="label">课程类型</span>
              <el-tag :type="courseDetail.course_type === 'public' ? 'warning' : 'primary'" size="small">
                {{ courseDetail.course_type === 'public' ? '公共课' : '专业课' }}
              </el-tag>
            </div>
            <div class="info-item">
              <span class="label">AB卷</span>
              <el-tag :type="courseDetail.needs_ab ? 'success' : 'info'" size="small">
                {{ courseDetail.needs_ab ? '是' : '否' }}
              </el-tag>
            </div>
            <div class="info-item">
              <span class="label">总人数</span>
              <span class="value accent">{{ courseDetail.total_students }} 人</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Exam Sessions -->
      <div class="sessions-section">
        <h3 class="section-title">考试场次</h3>
        <div v-if="courseDetail.exams?.length" class="sessions-list">
          <div v-for="(exam, idx) in courseDetail.exams" :key="idx" class="session-card">
            <div class="session-header">
              <el-tag type="primary" size="small">{{ exam.day_name }} {{ exam.slot_code }}</el-tag>
              <span class="time-range">{{ exam.time_range }}</span>
              <el-tag v-if="exam.exam_label" :type="exam.exam_label === 'A' ? '' : 'warning'" size="small">
                {{ exam.exam_label }}卷
              </el-tag>
            </div>

            <!-- Classrooms and Students -->
            <div class="session-section">
              <div class="section-label">考场安排</div>
              <div class="room-list">
                <div v-for="(cr, rIdx) in exam.classrooms" :key="rIdx" class="room-item">
                  <span class="room-name">{{ cr.classroom_name }}</span>
                  <span class="room-meta">{{ cr.total_students }}人</span>
                  <span class="room-classes">
                    {{ cr.classes?.map(c => c.class_name).join(', ') }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Teachers -->
            <div class="session-section">
              <div class="section-label">监考教师</div>
              <div class="teacher-list">
                <div v-for="(t, tIdx) in exam.teachers" :key="tIdx" class="teacher-item">
                  <el-tag :type="t.role === 'fixed' ? 'primary' : 'success'" size="small">
                    {{ t.role === 'fixed' ? '固定' : '流动' }}
                  </el-tag>
                  <span class="teacher-name">{{ t.teacher_name }}</span>
                  <span v-if="t.assigned_classroom" class="teacher-room">
                    ({{ t.assigned_classroom }})
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="no-sessions">
          <p>暂无考试场次信息</p>
        </div>

        <!-- AB Analysis -->
        <div v-if="courseDetail.needs_ab && courseDetail.ab_analysis" class="ab-analysis">
          <div class="analysis-header">
            <el-icon><DataAnalysis /></el-icon>
            AB卷分析
          </div>
          <div class="analysis-grid">
            <div class="analysis-item">
              <span class="analysis-label">A卷人数</span>
              <span class="analysis-value">{{ courseDetail.ab_analysis.a_student_count }}</span>
            </div>
            <div class="analysis-item">
              <span class="analysis-label">B卷人数</span>
              <span class="analysis-value">{{ courseDetail.ab_analysis.b_student_count }}</span>
            </div>
            <div class="analysis-item">
              <span class="analysis-label">均衡状态</span>
              <el-tag :type="courseDetail.ab_analysis.balance === '均衡' ? 'success' : 'warning'" size="small">
                {{ courseDetail.ab_analysis.balance }}
              </el-tag>
            </div>
            <div class="analysis-item">
              <span class="analysis-label">A卷时段</span>
              <span class="analysis-value">{{ courseDetail.ab_analysis.a_time_slot }}</span>
            </div>
            <div class="analysis-item">
              <span class="analysis-label">B卷时段</span>
              <span class="analysis-value">{{ courseDetail.ab_analysis.b_time_slot }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Reading, Calendar, Loading, DataAnalysis } from '@element-plus/icons-vue'
import api from '@/api/index.js'

const props = defineProps({
  versionId: { type: Number, default: null }
})

const courseList = ref([])
const selectedCourseId = ref(null)
const loading = ref(false)
const courseDetail = ref(null)

async function loadCourses() {
  try {
    const res = await api.get('/courses/')
    courseList.value = res.data?.items || []
  } catch (e) {
    console.error('加载课程列表失败', e)
  }
}

async function loadCourseDetail() {
  if (!selectedCourseId.value) return
  loading.value = true
  try {
    const res = await api.get(`/exams/courses/${selectedCourseId.value}/detail`)
    courseDetail.value = res.data || null
  } catch (e) {
    ElMessage.error('加载课程详情失败')
    courseDetail.value = null
  } finally {
    loading.value = false
  }
}

function onCourseChange() {
  courseDetail.value = null
  loadCourseDetail()
}

watch(() => props.versionId, () => {
  selectedCourseId.value = null
  courseDetail.value = null
  loadCourses()
}, { immediate: true })
</script>

<style scoped>
.course-panel { min-height: 300px; }

.selector-bar { margin-bottom: 16px; }
.course-select { width: 320px; }

.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: rgba(224,224,224,0.55);
  gap: 12px;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  margin-bottom: 20px;
}

.info-card {
  background: rgba(26, 31, 58, 0.6);
  border: 1px solid rgba(100, 140, 255, 0.15);
  border-radius: 10px;
  padding: 16px 20px;
}
.info-card.wide { grid-column: 1; }

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.1rem;
  font-weight: 600;
  color: #4fc3f7;
  margin-bottom: 12px;
}

.info-row {
  display: flex;
  gap: 32px;
  flex-wrap: wrap;
}
.info-item {
  display: flex;
  align-items: center;
  gap: 8px;
}
.label {
  font-size: 0.82rem;
  color: rgba(224, 224, 224, 0.6);
}
.value { color: #e0e0e0; font-weight: 600; }
.value.accent { color: #4fc3f7; }

.sessions-section { margin-top: 8px; }
.section-title {
  font-size: 0.95rem;
  color: #e0e0e0;
  margin: 0 0 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(100, 140, 255, 0.15);
}

.sessions-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.session-card {
  background: rgba(26, 31, 58, 0.6);
  border: 1px solid rgba(100, 140, 255, 0.15);
  border-radius: 10px;
  padding: 16px;
}

.session-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.time-range {
  font-size: 0.85rem;
  color: rgba(224, 224, 224, 0.6);
}

.session-section {
  margin-bottom: 10px;
}
.session-section:last-child { margin-bottom: 0; }

.section-label {
  font-size: 0.78rem;
  color: rgba(224, 224, 224, 0.5);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.room-list, .teacher-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.room-item {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(79, 195, 247, 0.05);
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 0.85rem;
}
.room-name {
  font-weight: 500;
  color: #4fc3f7;
  min-width: 80px;
}
.room-meta {
  color: rgba(224, 224, 224, 0.6);
}
.room-classes {
  color: rgba(224, 224, 224, 0.7);
  font-size: 0.82rem;
}

.teacher-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
}
.teacher-name { color: #e0e0e0; }
.teacher-room { color: rgba(224, 224, 224, 0.6); font-size: 0.82rem; }

.no-sessions {
  text-align: center;
  padding: 20px;
  color: rgba(224, 224, 224, 0.5);
}

.ab-analysis {
  background: rgba(26, 31, 58, 0.6);
  border: 1px solid rgba(100, 140, 255, 0.15);
  border-radius: 10px;
  padding: 16px;
  margin-top: 16px;
}
.analysis-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.95rem;
  color: #7c4dff;
  font-weight: 600;
  margin-bottom: 12px;
}
.analysis-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}
.analysis-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: center;
}
.analysis-label {
  font-size: 0.75rem;
  color: rgba(224, 224, 224, 0.5);
}
.analysis-value {
  font-size: 1.1rem;
  font-weight: 600;
  color: #7c4dff;
}
</style>
