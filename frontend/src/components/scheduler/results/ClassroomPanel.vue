<template>
  <div class="classroom-panel">
    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>加载教室数据...</span>
    </div>

    <!-- Empty State -->
    <div v-else-if="!hasData" class="empty-state">
      <el-icon :size="48"><OfficeBuilding /></el-icon>
      <p>暂无教室使用数据</p>
    </div>

    <!-- Classroom List -->
    <div v-else class="classroom-grid">
      <div v-for="(slots, roomName) in matrixData" :key="roomName" class="room-card">
        <div class="room-header">
          <el-icon><Location /></el-icon>
          <span class="room-name">{{ roomName }}</span>
          <el-tag type="info" size="small">{{ getUsedCount(slots) }} 场</el-tag>
        </div>

        <div class="slot-list">
          <div v-for="(exams, key) in slots" :key="key" class="slot-row">
            <span class="slot-label">{{ formatSlotKey(key) }}</span>
            <div class="slot-exams">
              <el-tag
                v-for="exam in exams"
                :key="exam.exam_id"
                type="primary"
                size="small"
                class="exam-tag"
              >
                {{ exam.course_name }}
                <span class="exam-count">({{ exam.total_students }}人)</span>
              </el-tag>
              <span v-if="!exams || exams.length === 0" class="empty-slot">-</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { OfficeBuilding, Location, Loading } from '@element-plus/icons-vue'
import api from '@/api/index.js'

const props = defineProps({
  versionId: { type: Number, default: null }
})

const loading = ref(false)
const matrixData = ref({})

const hasData = computed(() => Object.keys(matrixData.value).length > 0)

const DAYS = ['周一', '周二', '周三', '周四', '周五']
const SLOTS = ['T1', 'T2', 'T3', 'T4']

function formatSlotKey(key) {
  // key format: "周X-TY"
  return key
}

function getUsedCount(slots) {
  let count = 0
  for (const key in slots) {
    count += (slots[key]?.length || 0)
  }
  return count
}

async function loadData() {
  if (!props.versionId) return
  loading.value = true
  try {
    const res = await api.get('/exams/classrooms/matrix')
    matrixData.value = res.data?.matrix || {}
  } catch (e) {
    ElMessage.error('加载教室数据失败')
    matrixData.value = {}
  } finally {
    loading.value = false
  }
}

watch(() => props.versionId, loadData, { immediate: true })
</script>

<style scoped>
.classroom-panel { min-height: 300px; }

.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: rgba(224,224,224,0.55);
  gap: 12px;
}

.classroom-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  max-height: 600px;
  overflow-y: auto;
}

.room-card {
  background: rgba(26, 31, 58, 0.6);
  border: 1px solid rgba(100, 140, 255, 0.15);
  border-radius: 10px;
  padding: 14px;
}

.room-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  color: #4fc3f7;
  font-weight: 600;
}
.room-name {
  flex: 1;
  color: #e0e0e0;
}

.slot-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.slot-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.slot-label {
  width: 60px;
  font-size: 0.78rem;
  color: rgba(224, 224, 224, 0.6);
  flex-shrink: 0;
  background: rgba(79, 195, 247, 0.05);
  padding: 3px 6px;
  border-radius: 4px;
  text-align: center;
}

.slot-exams {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-height: 24px;
}

.exam-tag {
  background: rgba(79, 195, 247, 0.15);
  border-color: rgba(79, 195, 247, 0.3);
  color: #4fc3f7;
}
.exam-count {
  font-size: 0.7rem;
  opacity: 0.7;
}

.empty-slot {
  color: rgba(224, 224, 224, 0.3);
  font-size: 0.85rem;
}

.classroom-grid::-webkit-scrollbar { width: 6px; }
.classroom-grid::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 3px; }
.classroom-grid::-webkit-scrollbar-thumb { background: rgba(100,140,255,0.3); border-radius: 3px; }
</style>
