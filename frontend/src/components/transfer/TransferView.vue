<template>
  <div class="transfer-view">
    <h2 class="page-title">教师调剂</h2>

    <!-- 说明 -->
    <el-alert type="info" :closable="false" class="mb-4">
      <p class="text-sm">在此处可以将教师从一场考试调剂到另一场，或批量调剂。</p>
    </el-alert>

    <!-- 调剂操作卡片 -->
    <el-card class="mb-4">
      <template #header>
        <span class="font-semibold">批量调剂</span>
      </template>

      <el-form :model="form" label-width="100px">
        <el-form-item label="源教师">
          <el-select v-model="form.fromTeacherId" filterable placeholder="选择教师">
            <el-option
              v-for="t in teachers"
              :key="t.id"
              :label="t.name"
              :value="t.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="目标考试">
          <el-select v-model="form.toExamId" filterable placeholder="选择考试">
            <el-option
              v-for="e in availableExams"
              :key="e.exam_id"
              :label="`${e.course_name}（${e.day_name} ${e.time_str}）`"
              :value="e.exam_id"
            />
          </el-select>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="submitting" @click="doTransfer">
            确认调剂
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 当前调剂预览 -->
    <el-card v-if="transferHistory.length">
      <template #header>
        <span class="font-semibold">调剂记录（本次会话）</span>
      </template>
      <el-table :data="transferHistory" stripe border size="small">
        <el-table-column prop="teacherName" label="教师" />
        <el-table-column prop="fromExam" label="原考试" />
        <el-table-column prop="toExam" label="目标考试" />
        <el-table-column prop="time" label="时间" width="160" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/api/index.js'

const teachers = ref([])
const availableExams = ref([])
const submitting = ref(false)
const transferHistory = ref([])

const form = ref({
  fromTeacherId: null,
  toExamId: null,
})

async function loadTeachers() {
  try {
    const res = await api.get('/teachers/', { params: { page: 1, page_size: 500 } })
    teachers.value = res.items || []
  } catch {}
}

async function loadExams() {
  try {
    const res = await api.get('/exams/', { params: { status: 'scheduled', page: 1, page_size: 500 } })
    availableExams.value = res.items || []
  } catch {}
}

async function doTransfer() {
  if (!form.value.fromTeacherId || !form.value.toExamId) {
    ElMessage.warning('请完整填写调剂信息')
    return
  }
  submitting.value = true
  try {
    // TODO: 调用真实调剂 API，当前为演示
    const teacher = teachers.value.find(t => t.id === form.value.fromTeacherId)
    const exam = availableExams.value.find(e => e.exam_id === form.value.toExamId)
    transferHistory.value.push({
      teacherName: teacher?.name || form.value.fromTeacherId,
      fromExam: '—',
      toExam: `${exam?.course_name || ''}（${exam?.day_name || ''}）`,
      time: new Date().toLocaleString(),
    })
    ElMessage.success('调剂已提交（演示模式）')
    form.value = { fromTeacherId: null, toExamId: null }
  } catch (e) {
    ElMessage.error('调剂失败')
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  loadTeachers()
  loadExams()
})
</script>

<style scoped>
.transfer-view {
  padding: 20px;
  max-width: 1000px;
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
