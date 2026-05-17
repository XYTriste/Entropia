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
              v-for="t in allTeachers"
              :key="t.id"
              :label="`${t.name} (${t.current_slots || 0}/${t.max_slots || 0}场)`"
              :value="t.id"
            />
          </el-select>
        </el-form-item>

        <template v-if="form.transferType === 'swap' || form.transferType === 'transfer'">
          <el-form-item :label="form.transferType === 'swap' ? '教师A考试' : '目标考试'" required>
            <el-select
              v-model="form.examAId"
              filterable
              placeholder="选择考试"
            >
              <el-option
                v-for="e in teacherAExams"
                :key="e.exam_id"
                :label="`${e.course_name}（${e.day_name} ${e.time_str}）`"
                :value="e.exam_id"
              />
            </el-select>
          </el-form-item>
        </template>

        <template v-if="form.transferType === 'swap'">
          <el-form-item label="教师B考试" required>
            <el-select
              v-model="form.examBId"
              filterable
              placeholder="选择考试"
            >
              <el-option
                v-for="e in teacherBExams"
                :key="e.exam_id"
                :label="`${e.course_name}（${e.day_name} ${e.time_str}）`"
                :value="e.exam_id"
              />
            </el-select>
          </el-form-item>
        </template>

        <el-form-item label="调剂原因" required>
          <el-input
            v-model="form.reason"
            type="textarea"
            :rows="2"
            placeholder="请输入调剂原因（必填）"
          />
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
const teacherBExams = ref([])
const submitting = ref(false)
const undoing = ref(false)
const transferHistory = ref([])

const form = ref({
  transferType: 'swap', // swap | transfer | batch-transfer
  teacherAId: null,
  teacherBId: null,
  examAId: null,
  examBId: null,
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
    // 获取教师的监考安排
    const res = await api.get('/exams/', {
      params: { page: 1, page_size: 500 },
    })
    // 过滤出该教师的考试
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
  form.value.examAId = null
  teacherAExams.value = await loadTeacherExams(teacherId)
}

async function onTeacherBChange(teacherId) {
  form.value.examBId = null
  teacherBExams.value = await loadTeacherExams(teacherId)
}

function onTransferTypeChange() {
  form.value.examAId = null
  form.value.examBId = null
}

async function doTransfer() {
  if (!form.value.teacherAId || !form.value.teacherBId) {
    ElMessage.warning('请选择教师A和教师B')
    return
  }
  if (form.value.transferType === 'swap') {
    if (!form.value.examAId || !form.value.examBId) {
      ElMessage.warning('请选择教师A和教师B的考试')
      return
    }
  } else if (form.value.transferType === 'transfer') {
    if (!form.value.examAId) {
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
        exam_a_id: form.value.examAId,
        exam_b_id: form.value.examBId,
        reason,
      })
    } else if (type === 'transfer') {
      result = await api.post('/adjustments/teacher-transfer', {
        from_teacher_id: teacherAId,
        to_teacher_id: teacherBId,
        exam_id: form.value.examAId,
        role: 'fixed',
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
        ? `考试A: ${form.value.examAId}, 考试B: ${form.value.examBId}`
        : type === 'transfer'
        ? `考试: ${form.value.examAId}`
        : '全部考试',
      reason,
      time: new Date().toLocaleString(),
    })

    ElMessage.success('调剂成功')
    form.value = {
      transferType: 'swap',
      teacherAId: null,
      teacherBId: null,
      examAId: null,
      examBId: null,
      reason: '',
    }
    teacherAExams.value = []
    teacherBExams.value = []
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
    // 刷新教师场次
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
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}
.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1F2937;
  margin-bottom: 24px;
}
.mb-4 {
  margin-bottom: 16px;
}
</style>
