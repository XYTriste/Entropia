<template>
  <div class="panel">
    <div class="panel-header">
      <h3>监考教师安排</h3>
      <div class="header-actions">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索教师姓名..."
          class="search-input"
        />
        <span class="teacher-count">{{ filteredTeachers.length }} 位教师</span>
      </div>
    </div>
    
    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="!filteredTeachers.length" class="empty">暂无教师数据</div>
    <div v-else class="teachers-grid">
      <div 
        v-for="(teacher, index) in filteredTeachers" 
        :key="teacher.teacher_id" 
        class="teacher-card"
        :class="[
          index % 2 === 0 ? 'card-even' : 'card-odd',
          { 'card-expanded': selectedTeacherId === teacher.teacher_id }
        ]"
        @click="toggleTeacher(teacher)"
      >
        <div class="teacher-avatar" :class="isFullTime(teacher) ? 'fulltime' : 'parttime'">
          {{ teacher.teacher_name?.charAt(0) || '?' }}
        </div>
        <div class="teacher-info">
          <div class="teacher-name">{{ teacher.teacher_name }}</div>
          <div class="teacher-type" :class="isFullTime(teacher) ? 'fulltime' : 'parttime'">
            {{ isFullTime(teacher) ? '专任' : '兼任' }}
          </div>
        </div>
        <div class="teacher-stats">
          <div class="stat-item">
            <span class="stat-value">{{ teacher.total_exams || 0 }}</span>
            <span class="stat-label">监考场次</span>
          </div>
        </div>
        
        <div v-if="selectedTeacherId === teacher.teacher_id" class="teacher-detail">
          <div class="detail-header">
            <span class="teacher-name-large">{{ teacher.teacher_name }}</span>
            <span class="detail-count">{{ getTeacherExams(teacher.teacher_id).length }} 场考试</span>
          </div>
          <div class="detail-list">
            <div
              v-for="(exam, idx) in getTeacherExams(teacher.teacher_id)"
              :key="idx"
              class="detail-item"
            >
              <div class="detail-row">
                <span class="detail-label">时间</span>
                <span class="detail-value">{{ formatTime(exam) }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">科目</span>
                <span class="detail-value">{{ exam.course_name || '未知科目' }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">类型</span>
                <span class="detail-value type-value" :class="exam.is_fixed ? 'is-fixed' : 'floating'">{{ exam.is_fixed ? '固定' : '流动' }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">AB卷</span>
                <span class="detail-value">{{ exam.paper_type || '未指定' }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">教室</span>
                <span class="detail-value">{{ exam.room_name || '未安排' }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">班级</span>
                <span class="detail-value">{{ exam.class_name || '未知班级' }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">人数</span>
                <span class="detail-value">{{ exam.class_size || 0 }} 人</span>
              </div>
            </div>
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
const teachers = ref([])
const searchQuery = ref('')
const selectedTeacherId = ref(null)
const teacherExamsMap = ref({})

const filteredTeachers = computed(() => {
  if (!searchQuery.value.trim()) return teachers.value
  const q = searchQuery.value.toLowerCase()
  return teachers.value.filter(t => 
    t.teacher_name?.toLowerCase().includes(q) || 
    String(t.teacher_id).includes(q)
  )
})

function isFullTime(teacher) {
  return String(teacher?.teacher_type || '').toLowerCase().includes('full')
}

function toggleTeacher(teacher) {
  if (selectedTeacherId.value === teacher.teacher_id) {
    selectedTeacherId.value = null
  } else {
    selectedTeacherId.value = teacher.teacher_id
  }
}

function getTeacherExams(teacherId) {
  const exams = teacherExamsMap.value[teacherId] || []
  const dayOrder = { '周一': 1, '周二': 2, '周三': 3, '周四': 4, '周五': 5, '周六': 6, '周日': 7 }
  return [...exams].sort((a, b) => {
    const aDay = dayOrder[a.exam_date] || 0
    const bDay = dayOrder[b.exam_date] || 0
    if (aDay !== bDay) return aDay - bDay
    return (a.start_time || '').localeCompare(b.start_time || '')
  })
}

function formatTime(exam) {
  const dayName = exam.exam_date || ''
  const start = exam.start_time || ''
  const end = exam.end_time || ''
  if (dayName && start && end) {
    return dayName + ' ' + start + '-' + end
  }
  if (dayName) return dayName
  return exam.time_slot || '时间未定'
}

async function loadData() {
  if (!props.versionId) return
  loading.value = true
  
  try {
    const teachersRes = await get('/teachers/', { size: 1000 })
    const allTeachers = teachersRes?.data?.items || []
    
    const ganttRes = await get('/exams/teachers/gantt')
    const teacherEvents = ganttRes?.data?.teachers || []
    
    const examCountMap = {}
    const examsDetailMap = {}
    
    for (const t of teacherEvents) {
      examCountMap[t.teacher_id] = (t.events || []).length
      const details = []
      for (const e of (t.events || [])) {
        const timeRange = e.time_range || ''
        const parts = timeRange.split('-')
        details.push({
          course_name: e.course_name || '未知科目',
          exam_date: e.day_name || '',
          start_time: parts[0] || '',
          end_time: parts[1] || '',
          time_slot: e.slot_code || '',
          is_fixed: e.role === 'fixed',
          paper_type: e.exam_label || '未指定',
          room_name: e.assigned_classroom || (e.classrooms || []).join(', ') || '未安排',
          class_name: (e.class_names || []).join(', ') || '未知班级',
          class_size: e.student_count || 0,
        })
      }
      examsDetailMap[t.teacher_id] = details
    }
    
    teachers.value = allTeachers.map(t => ({
      teacher_id: t.id,
      teacher_name: t.name,
      teacher_type: t.teacher_type,
      total_exams: examCountMap[t.id] || 0
    }))
    
    teacherExamsMap.value = examsDetailMap
  } catch (e) {
    console.error('加载教师数据失败:', e)
  } finally {
    loading.value = false
  }
}

watch(() => props.versionId, loadData, { immediate: true })
</script>

<style>
.panel {
  --bg-start: #0a0e27;
  --bg-end: #1a1f3a;
  --card-bg: #111827;
  --card-border: #1f2937;
  --accent: #1677ff;
  --accent-light: rgba(22, 119, 255, 0.15);
  --text-primary: #ffffff;
  --text-secondary: #9ca3af;
  --text-muted: #6b7280;
  --radius: 8px;
  
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-start);
  position: relative;
  overflow: hidden;
}

/* 全局扫光特效 */
.panel::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -60%;
  width: 200%;
  height: 200%;
  background: linear-gradient(
    115deg,
    transparent 30%,
    rgba(0, 255, 255, 0.07) 45%,
    rgba(0, 255, 255, 0.12) 50%,
    rgba(0, 255, 255, 0.07) 55%,
    transparent 70%
  );
  transform: rotate(25deg);
  animation: sweepLight 6s infinite linear;
  pointer-events: none;
  z-index: 0;
}

/* 全局网格纹理背景 */
.panel::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image:
    repeating-linear-gradient(0deg, rgba(0, 255, 255, 0.03) 0px, rgba(0, 255, 255, 0.03) 1px, transparent 1px, transparent 12px),
    repeating-linear-gradient(90deg, rgba(0, 255, 255, 0.03) 0px, rgba(0, 255, 255, 0.03) 1px, transparent 1px, transparent 12px);
  pointer-events: none;
  z-index: 0;
}

@keyframes sweepLight {
  0% { transform: rotate(25deg) translateX(-30%) translateY(-30%); }
  100% { transform: rotate(25deg) translateX(30%) translateY(30%); }
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom:1px solid var(--card-border);
  flex-wrap: wrap;
  gap: 12px;
  flex-shrink: 0;
  position: relative;
  z-index: 2;
}

.panel-header h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-input {
  padding: 6px 12px;
  background: var(--card-bg);
  border:1px solid var(--card-border);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 0.85rem;
  outline: none;
  width: 200px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.search-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-light);
}

.search-input::placeholder {
  color: var(--text-muted);
}

.teacher-count {
  font-size: 0.85rem;
  color: var(--accent);
  background: var(--accent-light);
  padding: 4px 12px;
  border-radius: 12px;
}

.loading, .empty {
  display: flex;
  align-items: center;
  justify-content: center;
  flex:1;
  min-height: 200px;
  color: var(--text-muted);
  position: relative;
  z-index: 2;
}

.teachers-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 16px;
  padding: 20px;
  overflow-y: auto;
  flex:1;
  position: relative;
  z-index: 2;
}

.teacher-card {
  border-radius: var(--radius);
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  transition: all 0.3s ease;
  border: 1px solid transparent;
  cursor: pointer;
  overflow: hidden;
  min-height: 180px;
  justify-content: center;
  position: relative;
  z-index: 2;
}

.teacher-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.card-odd {
  background: var(--card-bg);
  border-color: var(--card-border);
}

.card-odd:hover {
  border-color: var(--accent);
}

.card-even {
  background: rgba(17, 24, 39, 0.6);
  border-color: rgba(31, 41, 55, 0.4);
}

.card-even:hover {
  border-color: var(--accent);
}

.teacher-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size:1.2rem;
  font-weight: 600;
}

.teacher-avatar.fulltime {
  background: var(--accent-light);
  color: var(--accent);
}

.teacher-avatar.parttime {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}

.teacher-info {
  text-align: center;
}

.teacher-name {
  font-weight: 600;
  font-size: 1rem;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.teacher-type {
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 10px;
  display: inline-block;
}

.teacher-type.fulltime {
  background: var(--accent-light);
  color: var(--accent);
}

.teacher-type.parttime {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}

.teacher-stats {
  width: 100%;
  padding-top: 12px;
  border-top: 1px solid var(--card-border);
}

.card-even .teacher-stats {
  border-top-color: rgba(31, 41, 55, 0.4);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
}

.stat-label {
  font-size: 0.7rem;
  color: var(--text-muted);
}

.card-expanded {
  grid-column: 1 / -1;
  align-items: flex-start;
  padding: 24px;
  cursor: default;
  min-height: 450px;
}

.card-expanded .teacher-avatar,
.card-expanded .teacher-info {
  display: none;
}

.card-expanded .teacher-stats {
  width: auto;
  padding:0;
  border: none;
  margin-bottom: 16px;
}

.teacher-detail {
  width: 100%;
  animation: slideDown 0.3s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--card-border);
  font-weight: 600;
  color: var(--text-primary);
  position: relative;
  z-index: 2;
}

.teacher-name-large {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--text-primary);
}

.detail-count {
  font-size: 0.85rem;
  color: var(--accent);
  background: var(--accent-light);
  padding: 4px 12px;
  border-radius: 12px;
}

.detail-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
  position: relative;
  z-index: 2;
}

.detail-item {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  padding: 12px;
  border: 1px solid var(--card-border);
}

.detail-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  width: 100%;
  box-sizing: border-box;
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-label {
  font-size: 0.8rem;
  color: #6b7280;
  white-space: nowrap;
  flex-shrink: 0;
  margin-right: 8px;
}

.detail-value {
  font-size: 0.85rem;
  font-weight: 500;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
  flex-shrink: 1;
  min-width: 0;
}

.detail-value.type-value.is-fixed {
  color: #10b981;
}

.detail-value.type-value.floating {
  color: #f59e0b;
}
</style>
