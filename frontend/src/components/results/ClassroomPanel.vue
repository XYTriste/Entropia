<template>
  <div class="panel">
    <div class="panel-header">
      <h3>教室使用情况</h3>
      <div class="header-actions">
        <span class="room-count">{{ roomList.length }} 间教室</span>
      </div>
    </div>
    
    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="!roomList.length" class="empty">暂无教室数据</div>
    <div v-else class="rooms-grid">
      <div v-for="room in roomList" :key="room" class="room-card">
        <div class="room-header">
          <span class="room-name">{{ room }}</span>
          <span class="exam-count-badge">{{ getRoomExamCount(room) }} 场</span>
        </div>
        <div class="room-schedule">
          <div 
            v-for="slot in slotKeys" 
            :key="slot"
            class="slot-cell"
            :class="{ 'has-exam': getRoomSlotExams(room, slot).length > 0 }"
          >
            <div class="slot-label">{{ slot }}</div>
            <div class="slot-content">
              <div 
                v-for="exam in getRoomSlotExams(room, slot)" 
                :key="exam.exam_id"
                class="slot-exam"
              >
                <span class="course-name">{{ exam.course_name }}</span>
                <span v-if="exam.exam_label" class="exam-label">{{ exam.exam_label }}</span>
                <span class="student-count">{{ exam.total_students }}人</span>
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
const matrix = ref({})

const slotKeys = ['周一-T1', '周一-T2', '周一-T3', '周一-T4', 
                  '周二-T1', '周二-T2', '周二-T3', '周二-T4',
                  '周三-T1', '周三-T2', '周三-T3', '周三-T4',
                  '周四-T1', '周四-T2', '周四-T3', '周四-T4',
                  '周五-T1', '周五-T2', '周五-T3', '周五-T4']

const roomList = computed(() => Object.keys(matrix.value))

function getRoomSlotExams(roomName, slotKey) {
  return matrix.value[roomName]?.[slotKey] || []
}

function getRoomExamCount(roomName) {
  let count = 0
  const roomData = matrix.value[roomName] || {}
  for (const slot of Object.values(roomData)) {
    count += slot.length
  }
  return count
}

async function loadData() {
  if (!props.versionId) return
  loading.value = true
  try {
    const res = await get('/exams/classrooms/matrix')
    matrix.value = res.data?.matrix || {}
  } catch (e) {
    console.error('加载教室数据失败:', e)
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

.room-count {
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

.rooms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  padding: 20px;
}

.room-card {
  background: var(--bg-start);
  border: 1px solid var(--card-border);
  border-radius: var(--radius);
  padding: 16px;
  transition: all 0.2s;
}

.room-card:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
}

.room-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.room-name {
  font-weight: 600;
  font-size: 1rem;
  color: var(--text-primary);
}

.exam-count-badge {
  font-size: 0.75rem;
  padding: 4px 10px;
  background: var(--accent-light);
  color: var(--accent);
  border-radius: 12px;
}

.room-schedule {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.slot-cell {
  background: var(--card-bg);
  border-radius: 4px;
  padding: 6px;
  min-height: 60px;
}

.slot-cell.has-exam {
  background: rgba(22, 119, 255, 0.1);
  border: 1px solid var(--accent);
}

.slot-label {
  font-size: 0.65rem;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.slot-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.slot-exam {
  padding: 4px 6px;
  background: var(--accent-light);
  border-radius: 3px;
  font-size: 0.7rem;
}

.course-name {
  display: block;
  color: var(--text-primary);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.slot-exam .exam-label {
  font-size: 0.6rem;
  background: var(--accent-purple);
  color: white;
  padding: 1px 3px;
  border-radius: 2px;
}

.student-count {
  display: block;
  color: var(--text-muted);
  font-size: 0.6rem;
}
</style>
