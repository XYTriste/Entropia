<template>
  <div class="transfer-view">
    <h2 class="page-title">教师调剂</h2>

    <!-- 说明 -->
    <el-alert type="info" :closable="false" class="mb-4">
      <template #default>
        <p class="text-sm">教师调剂功能：交换、单场转移、批量转交。</p>
        <p class="text-xs text-gray-500 mt-1">注意：已过期场次不可调剂，每场调剂必须填写原因。</p>
      </template>
    </el-alert>

    <!-- 调剂操作卡片 -->
    <el-card class="mb-4">
      <template #header>
        <span class="font-semibold">调剂操作</span>
      </template>

      <el-form :model="form" label-width="100px">
        <el-form-item label="调剂类型">
          <el-radio-group v-model="form.transferType" @change="onTransferTypeChange">
            <el-radio value="swap">教师交换</el-radio>
            <el-radio value="transfer">单场转移</el-radio>
            <el-radio value="batch-transfer">批量转交</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="教师A" required>
          <el-select
            v-model="form.teacherAId"
            filterable
            placeholder="选择教师"
            @change="onTeacherAChange"
          >
            <el-option
              v-for="t in allTeachers"
              :key="t.id"
              :label="`${t.name} (${t.current_slots || 0}/${t.max_slots || 0}场)`"
              :value="t.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="教师B" required>
          <el-select
            v-model="form.teacherBId"
            filterable
            placeholder="选择教师"
          >
            <el-option
              v-for="t in (form.transferType === 'batch-transfer' ? allTeachers : teacherBOptions)"
              :key="t.id"
              :label="t.name"
              :value="t.id"
            />
          </el-select>
        </el-form-item>

        <template v-if="form.transferType === 'transfer' || form.transferType === 'batch-transfer'">
          <el-form-item label="目标考试">
            <el-select v-model="form.targetExamId" filterable placeholder="选择考试">
              <el-option
                v-for="e in teacherAExams"
                :key="e.exam_id"
                :label="`${e.course_name}（${e.day_name} ${e.time_str}）`"
                :value="e.exam_id"
              />
            </el-select>
          </el-form-item>
        </template>

        <el-form-item label="调剂原因" required>
          <el-input v-model="form.reason" type="textarea" :rows="2" placeholder="请输入调剂原因（必填）" />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="submitting" @click="doTransfer">
            确认调剂
          </el-button>
          <el-button @click="undoLastTransfer" :loading="undoing">
            撤销上次调剂
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 教师场次预览 -->
    <el-card v-if="form.teacherAId" class="mb-4">
      <template #header>
        <span class="font-semibold">教师A场次预览</span>
      </template>
      <el-table :data="teacherAExams" stripe border size="small" max-height="300">
        <el-table-column prop="course_name" label="课程" />
        <el-table-column prop="day_name" label="星期" width="80" />
        <el-table-column prop="time_str" label="时间" width="140" />
        <el-table-column prop="classroom_name" label="教室" width="120" />
      </el-table>
    </el-card>

    <!-- 调剂记录 -->
    <el-card v-if="transferHistory.length">
      <template #header>
        <span class="font-semibold">调剂记录（本次会话）</span>
      </template>
      <el-table :data="transferHistory" stripe border size="small">
        <el-table-column prop="transferType" label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="getTransferTypeTag(row.transferType)">
              {{ getTransferTypeLabel(row.transferType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="teacherAName" label="教师A" />
        <el-table-column prop="teacherBName" label="教师B" />
        <el-table-column prop="examInfo" label="考试信息" />
        <el-table-column prop="reason" label="原因" />
        <el-table-column prop="time" label="时间" width="160" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/api/index.js'

const allTeachers = ref([])
const teacherAExams = ref([])
const teacherBOptions = ref([])
const submitting = ref(false)
const undoing = ref(false)
const transferHistory = ref([])

const form = ref({
  transferType: 'swap', // swap | transfer | batch-transfer
  teacherAId: null,
  teacherBId: null,
  targetExamId: null,
  reason: '',
})

async function loadTeachers() {
  try {
    const res = await api.get('/teachers/', { params: { page: 1, page_size: 500 } })
    allTeachers.value = res.items || []
  } catch (e) {
    ElMessage.error('加载教师列表失败')
  }
}

async function loadTeacherExams(teacherId) {
  if (!teacherId) return []
  try {
    const res = await api.get('/exams/', {
      params: { page: 1, page_size: 500 },
    })
    const exams = (res.items || []).filter(e =>
      (e.teachers || []).some(t => t.teacher_id === teacherId)
    )
    return exams.map(e => ({
      exam_id: e.id,
      course_name: e.course_name || '',
      day_name: e.day_name || '',
      time_str: e.time_str || '',
      classroom_name: e.classroom_name || '',
    }))
  } catch (e) {
    return []
  }
}

async function onTeacherAChange(teacherId) {
  form.value.targetExamId = null
  teacherAExams.value = await loadTeacherExams(teacherId)
}

function onTransferTypeChange() {
  form.value.targetExamId = null
  form.value.teacherBId = null
  teacherBOptions.value = []
}

async function doTransfer() {
  if (!form.value.teacherAId || !form.value.teacherBId) {
    ElMessage.warning('请选择教师A和教师B')
    return
  }
  if (form.value.transferType === 'swap') {
    if (!form.value.targetExamId) {
      ElMessage.warning('请选择教师A的考试')
      return
    }
  } else if (form.value.transferType === 'transfer') {
    if (!form.value.targetExamId) {
      ElMessage.warning('请选择目标考试')
      return
    }
  }
  if (!form.value.reason) {
    ElMessage.warning('请填写调剂原因')
    return
  }

  submitting.value = true
  try {
    const type = form.value.transferType
    const teacherAId = form.value.teacherAId
    const teacherBId = form.value.teacherBId
    const reason = form.value.reason

    let result = null
    if (type === 'swap') {
      result = await api.post('/adjustments/teacher-swap', {
        teacher_a_id: teacherAId,
        teacher_b_id: teacherBId,
        exam_a_id: form.value.targetExamId,
        exam_b_id: form.value.targetExamId,
        reason,
      })
    } else if (type === 'transfer') {
      result = await api.post('/adjustments/teacher-transfer', {
        from_teacher_id: teacherAId,
        to_teacher_id: teacherBId,
        exam_id: form.value.targetExamId,
        reason,
      })
    } else if (type === 'batch-transfer') {
      result = await api.post('/adjustments/teacher-batch-transfer', {
        from_teacher_id: teacherAId,
        to_teacher_id: teacherBId,
        reason,
      })
    }

    const teacherAName = allTeachers.value.find(t => t.id === teacherAId)?.name || ''
    const teacherBName = allTeachers.value.find(t => t.id === teacherBId)?.name || ''

    transferHistory.value.push({
      transferType: type,
      teacherAName,
      teacherBName,
      examInfo: type === 'swap'
        ? `考试A: ${form.value.targetExamId}, 考试B: ${form.value.targetExamId}`
        : type === 'transfer'
        ? `考试: ${form.value.targetExamId}`
        : '全部考试',
      reason,
      time: new Date().toLocaleString(),
    })

    ElMessage.success('调剂成功')
    form.value = {
      transferType: 'swap',
      teacherAId: null,
      teacherBId: null,
      targetExamId: null,
      reason: '',
    }
    teacherAExams.value = []
    teacherBOptions.value = []
  } catch (e) {
    ElMessage.error('调剂失败: ' + (e.response?.data?.message || e.message))
  } finally {
    submitting.value = false
  }
}

async function undoLastTransfer() {
  undoing.value = true
  try {
    await api.post('/adjustments/undo-last')
    ElMessage.success('已撤销上次调剂')
    if (form.value.teacherAId) {
      teacherAExams.value = await loadTeacherExams(form.value.teacherAId)
    }
  } catch (e) {
    ElMessage.error('撤销失败: ' + (e.response?.data?.message || e.message))
  } finally {
    undoing.value = false
  }
}

function getTransferTypeTag(type) {
  const map = {
    'swap': 'warning',
    'transfer': 'primary',
    'batch-transfer': 'success',
  }
  return map[type] || 'info'
}

function getTransferTypeLabel(type) {
  const map = {
    'swap': '交换',
    'transfer': '转移',
    'batch-transfer': '批量转交',
  }
  return map[type] || type
}

onMounted(() => {
  loadTeachers()
})
</script>

<style scoped>
.transfer-view {
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

  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
  min-height: calc(100vh - 64px);
  background: var(--bg-start);
  position: relative;
  overflow: hidden;
}

/* 扫光特效 - 青色 */
.transfer-view::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -60%;
  width: 200%;
  height: 200%;
  background: linear-gradient(
    115deg,
    transparent 30%,
    rgba(6, 182, 212, 0.07) 45%,
    rgba(6, 182, 212, 0.12) 50%,
    rgba(6, 182, 212, 0.07) 55%,
    transparent 70%
  );
  transform: rotate(25deg);
  animation: sweepLight 6s infinite linear;
  pointer-events: none;
  z-index: 0;
}

/* 网格纹理背景 */
.transfer-view::after {
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

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 24px;
  position: relative;
  z-index: 2;
}

.mb-4 { margin-bottom: 16px; }

/* Element Plus 深色适配 */
:deep(.el-alert--info) {
  background: rgba(6, 182, 212, 0.1);
  border-color: rgba(6, 182, 212, 0.3);
  color: var(--text-primary);
}
:deep(.el-card) {
  background: var(--card-bg);
  border-color: var(--card-border);
  color: var(--text-primary);
}
:deep(.el-card__header) {
  border-bottom-color: var(--card-border);
}
:deep(.el-form-item__label) {
  color: var(--text-secondary);
}
:deep(.el-input__wrapper) {
  background: rgba(255, 255, 255, 0.08);
  border-color: var(--card-border);
  box-shadow: none;
}
:deep(.el-input__inner) {
  color: var(--text-primary);
}
:deep(.el-select .el-input__wrapper) {
  background: rgba(255, 255, 255, 0.08);
}
:deep(.el-radio-button__inner) {
  background: rgba(255, 255, 255, 0.08);
  border-color: var(--card-border);
  color: var(--text-primary);
}
:deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  background: linear-gradient(135deg, #06b6d4, #22d3ee);
  border-color: transparent;
  color: #fff;
}
:deep(.el-table) {
  background: transparent;
  color: var(--text-primary);
}
:deep(.el-table__header th) {
  background: rgba(6, 182, 212, 0.1);
  color: var(--text-primary);
  border-bottom-color: var(--card-border);
}
:deep(.el-table__body tr) {
  background: transparent;
}
:deep(.el-table__body td) {
  border-bottom-color: var(--card-border);
}
:deep(.el-table--striped .el-table__body tr.el-table__row--striped td) {
  background: rgba(255, 255, 255, 0.03);
}
:deep(.el-tag) {
  border-color: var(--card-border);
}
</style>
