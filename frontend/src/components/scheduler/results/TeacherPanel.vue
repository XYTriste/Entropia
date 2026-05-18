<template>
  <div class="teacher-panel">
    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>加载教师甘特图...</span>
    </div>

    <!-- Empty State -->
    <div v-else-if="!hasData" class="empty-state">
      <el-icon :size="48"><User /></el-icon>
      <p>暂无教师监考数据</p>
    </div>

    <!-- Teacher List with Gantt -->
    <div v-else class="gantt-container">
      <div v-for="teacher in teacherData" :key="teacher.teacher_id" class="teacher-card">
        <div class="teacher-header">
          <el-avatar :size="32" :style="{ background: getAvatarColor(teacher.teacher_id) }">
            {{ teacher.teacher_name[0] }}
          </el-avatar>
          <span class="teacher-name">{{ teacher.teacher_name }}</span>
          <el-tag type="info" size="small">{{ teacher.events.length }} 场</el-tag>
        </div>

        <!-- Mini Gantt -->
        <div class="gantt-grid">
          <div v-for="day in 5" :key="day" class="gantt-day">
            <div class="day-label">{{ ['周一','周二','周三','周四','周五'][day-1] }}</div>
            <div class="day-slots">
              <div v-for="slot in 4" :key="slot" class="gantt-slot">
                <div
                  v-for="event in getEvents(day, slot, teacher.events)"
                  :key="event.exam_id"
                  class="gantt-bar"
                  :class="'role-' + event.role"
                  :title="`${event.course_name} ${event.time_range}`"
                >
                  <span class="bar-label">{{ event.course_name }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Event Detail Dialog -->
    <el-dialog v-model="dialogVisible" title="监考详情" width="500px" destroy-on-close>
      <el-descriptions v-if="selectedEvent" :column="1" border>
        <el-descriptions-item label="课程">{{ selectedEvent.course_name }}</el-tag></el-descriptions-item>
        <el-descriptions-item label="时间">{{ selectedEvent.day_name }} {{ selectedEvent.time_range }}</el-descriptions-item>
        <el-descriptions-item label="角色">
          <el-tag :type="selectedEvent.role === 'fixed' ? 'primary' : 'success'" size="small">
            {{ selectedEvent.role === 'fixed' ? '固定监考' : '流动监考' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="教室">{{ selectedEvent.assigned_classroom || selectedEvent.classrooms?.join(', ') }}</el-descriptions-item>
        <el-descriptions-item label="监考班级">{{ selectedEvent.class_names?.join(', ') }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { User, Loading } from '@element-plus/icons-vue'
import api from '@/api/index.js'

const props = defineProps({
  versionId: { type: Number, default: null }
})

const loading = ref(false)
const teacherData = ref([])
const dialogVisible = ref(false)
const selectedEvent = ref(null)

const hasData = computed(() => teacherData.value.length > 0)

const AVATAR_COLORS = [
  '#4fc3f7', '#7c4dff', '#00e676', '#ffd740', '#ff7043',
  '#26c6da', '#ab47bc', '#5c6bc0', '#26a69a', '#ec407a'
]

function getAvatarColor(id) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length]
}

function getEvents(day, slot, events) {
  return events.filter(e => e.day_of_week === day && e.slot_code === `T${slot}`)
}

function showDetail(event) {
  selectedEvent.value = event
  dialogVisible.value = true
}

async function loadData() {
  if (!props.versionId) return
  loading.value = true
  try {
    const res = await api.get('/exams/teachers/gantt')
    teacherData.value = res.data?.teachers || []
  } catch (e) {
    ElMessage.error('加载教师数据失败')
    teacherData.value = []
  } finally {
    loading.value = false
  }
}

watch(() => props.versionId, loadData, { immediate: true })
</script>

<style scoped>
.teacher-panel { min-height: 300px; }

.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: var(--text-dim, rgba(224,224,224,0.55));
  gap: 12px;
}

.gantt-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 600px;
  overflow-y: auto;
}

.teacher-card {
  background: rgba(26, 31, 58, 0.6);
  border: 1px solid rgba(100, 140, 255, 0.15);
  border-radius: 10px;
  padding: 12px 16px;
}

.teacher-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.teacher-name {
  font-weight: 600;
  color: #e0e0e0;
  flex: 1;
}

.gantt-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}

.gantt-day { display: flex; flex-direction: column; gap: 4px; }
.day-label {
  font-size: 0.75rem;
  color: rgba(224, 224, 224, 0.6);
  text-align: center;
}
.day-slots { display: flex; flex-direction: column; gap: 3px; }

.gantt-slot {
  height: 28px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 4px;
  position: relative;
  overflow: hidden;
}

.gantt-bar {
  position: absolute;
  inset: 2px;
  border-radius: 3px;
  display: flex;
  align-items: center;
  padding: 0 4px;
  cursor: pointer;
  transition: opacity 0.2s;
}
.gantt-bar:hover { opacity: 0.8; }
.gantt-bar.role-fixed { background: rgba(79, 195, 247, 0.7); }
.gantt-bar.role-patrol { background: rgba(124, 77, 255, 0.7); }

.bar-label {
  font-size: 0.65rem;
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Scrollbar */
.gantt-container::-webkit-scrollbar { width: 6px; }
.gantt-container::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 3px; }
.gantt-container::-webkit-scrollbar-thumb { background: rgba(100,140,255,0.3); border-radius: 3px; }
</style>
