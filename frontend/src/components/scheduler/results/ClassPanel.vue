<template>
  <div class="class-panel">
    <!-- Class Selector -->
    <div class="selector-bar">
      <el-select
        v-model="selectedClassId"
        placeholder="选择班级"
        filterable
        @change="onClassChange"
        class="class-select"
      >
        <el-option
          v-for="cls in classList"
          :key="cls.id"
          :label="`${cls.name} (${cls.grade}级)`"
          :value="cls.id"
        />
      </el-select>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>加载班级数据...</span>
    </div>

    <!-- Empty State -->
    <div v-else-if="!selectedClassId" class="empty-state">
      <el-icon :size="48"><School /></el-icon>
      <p>请选择班级查看考试安排</p>
    </div>

    <div v-else-if="!scheduleData" class="empty-state">
      <el-icon :size="48"><Calendar /></el-icon>
      <p>该班级暂无考试安排</p>
    </div>

    <!-- Class Info -->
    <div v-else class="class-info">
      <div class="info-card">
        <div class="info-item">
          <span class="info-label">班级名称</span>
          <span class="info-value">{{ scheduleData.class_name }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">年级</span>
          <span class="info-value">{{ scheduleData.grade }}级</span>
        </div>
        <div class="info-item">
          <span class="info-label">考试场次</span>
          <span class="info-value accent">{{ scheduleData.exams.length }}</span>
        </div>
      </div>

      <!-- Schedule Timeline -->
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
            <div class="exam-time">
              <el-tag type="primary" size="small">{{ exam.day_name }}</el-tag>
              <span class="slot-info">{{ exam.slot_code }} {{ exam.time_range }}</span>
            </div>
            <div class="exam-card">
              <div class="exam-title">
                <el-tag :type="exam.course_type === 'public' ? 'warning' : 'primary'" size="small">
                  {{ exam.exam_label || '考试' }}
                </el-tag>
                <span class="course-title">{{ exam.course_name }}</span>
              </div>
              <div class="exam-meta">
                <span class="meta-item">
                  <el-icon><Location /></el-icon>
                  {{ exam.classroom_name }}
                </span>
                <span class="meta-item" v-if="exam.teacher_names.length">
                  <el-icon><User /></el-icon>
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
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { School, Calendar, Loading, Location, User } from '@element-plus/icons-vue'
import api from '@/api/index.js'

const props = defineProps({
  versionId: { type: Number, default: null }
})

const classList = ref([])
const selectedClassId = ref(null)
const loading = ref(false)
const scheduleData = ref(null)

async function loadClasses() {
  try {
    const res = await api.get('/classes/')
    classList.value = res.data?.items || []
  } catch (e) {
    console.error('加载班级列表失败', e)
  }
}

async function loadSchedule() {
  if (!selectedClassId.value) return
  loading.value = true
  try {
    const res = await api.get(`/exams/classes/${selectedClassId.value}/schedule`)
    scheduleData.value = res.data || null
  } catch (e) {
    ElMessage.error('加载班级考试安排失败')
    scheduleData.value = null
  } finally {
    loading.value = false
  }
}

function onClassChange() {
  scheduleData.value = null
  loadSchedule()
}

watch(() => props.versionId, () => {
  selectedClassId.value = null
  scheduleData.value = null
  loadClasses()
}, { immediate: true })
</script>

<style scoped>
.class-panel { min-height: 300px; }

.selector-bar {
  margin-bottom: 16px;
}
.class-select { width: 280px; }

.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: rgba(224,224,224,0.55);
  gap: 12px;
}

.class-info { padding: 0 8px; }

.info-card {
  display: flex;
  gap: 24px;
  background: rgba(26, 31, 58, 0.6);
  border: 1px solid rgba(100, 140, 255, 0.15);
  border-radius: 10px;
  padding: 16px 20px;
  margin-bottom: 20px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.info-label {
  font-size: 0.78rem;
  color: rgba(224, 224, 224, 0.6);
}
.info-value {
  font-size: 1.1rem;
  font-weight: 600;
  color: #e0e0e0;
}
.info-value.accent { color: #4fc3f7; }

.timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.timeline-item {
  display: flex;
  gap: 16px;
}

.timeline-marker {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 20px;
  flex-shrink: 0;
}

.marker-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #4fc3f7;
  box-shadow: 0 0 8px rgba(79, 195, 247, 0.5);
  margin-top: 14px;
  flex-shrink: 0;
}

.marker-line {
  width: 2px;
  flex: 1;
  background: linear-gradient(180deg, rgba(79, 195, 247, 0.5), rgba(79, 195, 247, 0.1));
  min-height: 40px;
}

.timeline-content {
  flex: 1;
  padding-bottom: 20px;
}

.exam-time {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.slot-info {
  font-size: 0.85rem;
  color: rgba(224, 224, 224, 0.6);
}

.exam-card {
  background: rgba(26, 31, 58, 0.6);
  border: 1px solid rgba(100, 140, 255, 0.15);
  border-radius: 8px;
  padding: 12px 16px;
}

.exam-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.course-title {
  font-weight: 600;
  color: #e0e0e0;
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
  font-size: 0.82rem;
  color: rgba(224, 224, 224, 0.7);
}
</style>
