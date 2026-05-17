<template>
  <div class="adjustments-view">
    <h2 class="page-title">手动微调</h2>

    <!-- 版本选择 -->
    <el-card class="mb-4" :body-style="{ padding: '16px' }">
      <div class="flex items-center gap-4">
        <span class="text-sm font-medium">排考版本：</span>
        <el-select v-model="selectedVersion" placeholder="请选择版本" @change="fetchExams" class="version-select">
          <el-option
            v-for="v in versions"
            :key="v.id"
            :label="v.name || `版本 ${v.id}`"
            :value="v.id"
          />
        </el-select>

        <el-button
          type="primary"
          :disabled="!selectedVersion"
          :loading="saving"
          @click="saveAdjustments"
        >保存调整</el-button>

        <el-button
          @click="undoLast"
          :loading="undoing"
        >撤销上次操作</el-button>

        <el-tag v-if="hasChanges" type="warning" size="small">有未保存的修改</el-tag>
      </div>
    </el-card>

    <!-- 考试列表 -->
    <el-card>
      <template #header>
        <span class="font-semibold text-sm">已排考试列表（点击展开查看监考教师）</span>
      </template>

      <el-table
        :data="exams"
        stripe
        border
        v-loading="loading"
        row-key="id"
        class="exams-table"
        @expand-change="onExpand"
      >
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="teachers-in-exam">
              <h4 class="text-sm font-medium mb-2">监考教师</h4>
              <div v-if="row.teacherList && row.teacherList.length" class="flex flex-wrap gap-2">
                <div
                  v-for="t in row.teacherList"
                  :key="t.id"
                  class="teacher-card"
                >
                  <span class="teacher-name">{{ t.name }}</span>
                  <span class="teacher-role">{{ t.role === 'fixed' ? '固定' : '流动' }}</span>
                  <el-button
                    type="danger"
                    size="small"
                    :icon="Close"
                    circle
                    class="remove-btn"
                    @click="removeTeacher(row, t)"
                  />
                </div>
              </div>
              <div v-else class="text-sm text-gray-400">暂无监考教师</div>

              <div class="add-teacher mt-2">
                <el-select
                  v-model="row.addTeacherId"
                  placeholder="添加教师"
                  size="small"
                  filterable
                  class="add-select"
                >
                  <el-option
                    v-for="t in availableTeachers"
                    :key="t.id"
                    :label="t.name"
                    :value="t.id"
                  />
                </el-select>
                <el-button
                  size="small"
                  type="primary"
                  :disabled="!row.addTeacherId"
                  @click="addTeacher(row)"
                >添加</el-button>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="course_name" label="课程" min-width="160" />
        <el-table-column label="卷标" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.exam_label" :type="row.exam_label === 'A' ? 'primary' : 'warning'">
              {{ row.exam_label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="day_name" label="星期" width="100" />
        <el-table-column prop="slot_code" label="时段" width="80" />
        <el-table-column prop="time_str" label="时间" width="140" />
        <el-table-column prop="classroom_name" label="教室" width="120" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button
              type="warning"
              size="small"
              @click="openAdjustModal(row)"
            >调整安排</el-button>
            <el-button
              type="primary"
              size="small"
              @click="openChangeTeacherModal(row)"
            >换教师</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 调整安排模态框 -->
    <el-dialog
      v-model="adjustModal.visible"
      title="调整考试安排"
      width="500px"
      @close="closeAdjustModal"
    >
      <div v-if="adjustModal.exam" class="adjust-modal">
        <div class="mb-3 p-2 bg-blue-50 rounded text-sm">
          <div class="text-gray-600 mb-1"><i class="fas fa-info-circle text-blue-400 mr-1"></i>当前安排</div>
          <div class="font-semibold">{{ adjustModal.exam.course_name }}</div>
          <div class="text-gray-500">时段: {{ adjustModal.exam.day_name }} {{ adjustModal.exam.time_str }} | 教室: {{ adjustModal.exam.classroom_name }}</div>
        </div>

        <el-form :model="adjustModal.form" label-width="80px">
          <el-form-item label="选择时段">
            <el-select
              v-model="adjustModal.form.time_slot_id"
              placeholder="请选择时段"
              @change="onTimeSlotChange"
            >
              <el-option
                v-for="s in allTimeSlots"
                :key="s.id"
                :label="`${s.day_name} ${s.start_time}-${s.end_time}`"
                :value="s.id"
                :disabled="s.disabled"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="选择教室">
            <el-select
              v-model="adjustModal.form.classroom_id"
              placeholder="请选择教室"
            >
              <el-option
                v-for="c in availableClassrooms"
                :key="c.id"
                :label="`${c.name} (容量:${c.capacity})`"
                :value="c.id"
                :disabled="c.disabled"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="调整原因" required>
            <el-input
              v-model="adjustModal.form.reason"
              type="textarea"
              :rows="2"
              placeholder="请输入调整原因"
            />
          </el-form-item>
        </el-form>
      </div>

      <template #footer>
        <el-button @click="closeAdjustModal">取消</el-button>
        <el-button type="primary" :loading="adjustModal.loading" @click="submitAdjust">
          确认调整
        </el-button>
      </template>
    </el-dialog>

    <!-- 更换教师模态框 -->
    <el-dialog
      v-model="changeTeacherModal.visible"
      title="更换监考教师"
      width="500px"
      @close="closeChangeTeacherModal"
    >
      <div v-if="changeTeacherModal.exam" class="change-teacher-modal">
        <el-form :model="changeTeacherModal.form" label-width="100px">
          <el-form-item label="当前教师">
            <el-select v-model="changeTeacherModal.form.old_teacher_id" placeholder="选择要替换的教师">
              <el-option
                v-for="t in changeTeacherModal.currentTeachers"
                :key="`${t.teacher_id}:${t.role}`"
                :label="`${t.teacher_name} (${t.role === 'fixed' ? '固定' : '流动'})`"
                :value="`${t.teacher_id}:${t.role}`"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="新教师" required>
            <el-select
              v-model="changeTeacherModal.form.new_teacher_id"
              placeholder="请选择教师"
              filterable
            >
              <el-option
                v-for="t in teachers"
                :key="t.id"
                :label="`${t.name} (${t.current_slots || 0}/${t.max_slots || 0}场)`"
                :value="t.id"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="调整原因" required>
            <el-input
              v-model="changeTeacherModal.form.reason"
              type="textarea"
              :rows="2"
              placeholder="请输入调整原因"
            />
          </el-form-item>
        </el-form>
      </div>

      <template #footer>
        <el-button @click="closeChangeTeacherModal">取消</el-button>
        <el-button type="primary" :loading="changeTeacherModal.loading" @click="submitChangeTeacher">
          确认更换
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Close } from '@element-plus/icons-vue'
import api from '@/api/index.js'

const exams = ref([])
const versions = ref([])
const teachers = ref([])
const allTimeSlots = ref([])
const allClassrooms = ref([])
const selectedVersion = ref(null)
const loading = ref(false)
const saving = ref(false)
const undoing = ref(false)
const modifiedExams = ref(new Set())

const hasChanges = computed(() => modifiedExams.value.size > 0)
const availableTeachers = computed(() => teachers.value)

// 调整安排模态框
const adjustModal = ref({
  visible: false,
  exam: null,
  loading: false,
  form: {
    time_slot_id: null,
    classroom_id: null,
    reason: '',
  },
})

// 更换教师模态框
const changeTeacherModal = ref({
  visible: false,
  exam: null,
  currentTeachers: [],
  loading: false,
  form: {
    old_teacher_id: '',
    new_teacher_id: null,
    reason: '',
  },
})

const availableClassrooms = computed(() => {
  return allClassrooms.value.filter(c => {
    if (!adjustModal.value.form.time_slot_id) return true
    // 这里可以添加过滤逻辑：该时段该教室是否已被占用
    return true
  })
})

async function fetchVersions() {
  try {
    const res = await api.get('/scheduler/versions', { params: { page: 1, page_size: 100 } })
    versions.value = res.items || []
    const active = versions.value.find(v => v.status === 'active')
    if (active) {
      selectedVersion.value = active.id
      fetchExams()
    }
  } catch (e) {
    ElMessage.error('加载版本失败')
  }
}

async function fetchExams() {
  if (!selectedVersion.value) return
  loading.value = true
  try {
    const res = await api.get('/exams/', {
      params: { version_id: selectedVersion.value, page: 1, page_size: 500 },
    })
    const examItems = res.items || []
    exams.value = examItems.map(e => ({
      ...e,
      teacherList: (e.teachers || []).map(t => ({
        id: t.teacher_id,
        name: t.teacher_name,
        role: t.role,
      })),
      addTeacherId: null,
    }))
  } catch (e) {
    ElMessage.error('加载考试失败')
    exams.value = []
  } finally {
    loading.value = false
  }
}

async function fetchTeachers() {
  try {
    const res = await api.get('/teachers/', { params: { page: 1, page_size: 500 } })
    teachers.value = res.items || []
  } catch (e) {
    teachers.value = []
  }
}

async function fetchTimeSlots() {
  try {
    const res = await api.get('/time-slots/', { params: { page: 1, page_size: 100 } })
    allTimeSlots.value = res.items || []
  } catch (e) {
    allTimeSlots.value = []
  }
}

async function fetchClassrooms() {
  try {
    const res = await api.get('/classrooms/', { params: { page: 1, page_size: 100 } })
    allClassrooms.value = res.items || []
  } catch (e) {
    allClassrooms.value = []
  }
}

function onExpand(expanded, row) {
  // 可以在这里加载每个考试的详细监考信息
}

function removeTeacher(row, teacher) {
  ElMessageBox.confirm(
    `确定将教师「${teacher.name}」从考试中移除吗？`,
    '确认移除',
    { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
  ).then(async () => {
    try {
      // 调用后端 API 移除教师
      await api.post('/adjustments/change-teacher', {
        exam_id: row.id,
        old_teacher_id: teacher.id,
        new_teacher_id: teacher.id, // 临时：需要先删除再添加，或者后端支持直接删除
        role: teacher.role,
        reason: '手动移除教师',
      })
      row.teacherList = row.teacherList.filter(t => t.id !== teacher.id)
      modifiedExams.value.add(row.id)
      ElMessage.success('已移除教师')
    } catch (e) {
      ElMessage.error('移除失败: ' + (e.response?.data?.message || e.message))
    }
  }).catch(() => {})
}

async function addTeacher(row) {
  if (!row.addTeacherId) return
  const teacher = teachers.value.find(t => t.id === row.addTeacherId)
  if (!teacher) return

  if (row.teacherList.some(t => t.id === teacher.id)) {
    ElMessage.warning('该教师已在此考试中')
    return
  }

  try {
    // 调用后端 API 添加教师
    await api.post('/adjustments/change-teacher', {
      exam_id: row.id,
      old_teacher_id: teacher.id, // 临时：需要后端支持添加新教师
      new_teacher_id: teacher.id,
      role: 'fixed',
      reason: '手动添加教师',
    })
    row.teacherList.push({
      id: teacher.id,
      name: teacher.name,
      role: 'fixed',
    })
    row.addTeacherId = null
    modifiedExams.value.add(row.id)
    ElMessage.success('已添加教师')
  } catch (e) {
    ElMessage.error('添加失败: ' + (e.response?.data?.message || e.message))
  }
}

async function saveAdjustments() {
  if (!modifiedExams.value.size) {
    ElMessage.info('没有需要保存的修改')
    return
  }

  saving.value = true
  try {
    // 这里需要调用后端调整 API
    // 暂时用批量更新模拟
    for (const examId of modifiedExams.value) {
      const exam = exams.value.find(e => e.id === examId)
      if (!exam) continue
      // TODO: 调用实际的调整 API
      // await api.post('/adjustments/', { exam_id: examId, teachers: exam.teacherList })
    }
    modifiedExams.value.clear()
    ElMessage.success('调整已保存')
    fetchExams()
  } catch (e) {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

async function undoLast() {
  undoing.value = true
  try {
    await api.post('/adjustments/undo-last')
    ElMessage.success('已撤销上次操作')
    fetchExams()
  } catch (e) {
    ElMessage.error('撤销失败: ' + (e.response?.data?.message || e.message))
  } finally {
    undoing.value = false
  }
}

// 调整安排模态框
function openAdjustModal(exam) {
  adjustModal.value = {
    visible: true,
    exam,
    loading: false,
    form: {
      time_slot_id: exam.time_slot_id,
      classroom_id: exam.classroom_id,
      reason: '',
    },
  }
}

function closeAdjustModal() {
  adjustModal.value.visible = false
}

function onTimeSlotChange() {
  // 时段变化后，刷新教室列表
  adjustModal.value.form.classroom_id = null
}

async function submitAdjust() {
  const modal = adjustModal.value
  if (!modal.form.time_slot_id) {
    ElMessage.warning('请选择时段')
    return
  }
  if (!modal.form.classroom_id) {
    ElMessage.warning('请选择教室')
    return
  }
  if (!modal.form.reason) {
    ElMessage.warning('请输入调整原因')
    return
  }

  modal.loading = true
  try {
    const exam = modal.exam
    const currentTimeSlotId = exam.time_slot_id
    const currentClassroomId = exam.classroom_id

    // 1. 调时段（如果时段变了）
    if (currentTimeSlotId !== modal.form.time_slot_id) {
      await api.post('/adjustments/move-exam-time', {
        exam_id: exam.id,
        new_time_slot_id: modal.form.time_slot_id,
        reason: modal.form.reason,
      })
    }

    // 2. 换教室（如果教室变了）
    if (String(currentClassroomId) !== String(modal.form.classroom_id)) {
      await api.post('/adjustments/change-classroom', {
        exam_id: exam.id,
        old_classroom_id: currentClassroomId,
        new_classroom_id: modal.form.classroom_id,
        reason: modal.form.reason,
      })
    }

    ElMessage.success('考试安排调整成功')
    closeAdjustModal()
    fetchExams()
  } catch (e) {
    ElMessage.error('调整失败: ' + (e.response?.data?.message || e.message))
  } finally {
    modal.loading = false
  }
}

// 更换教师模态框
function openChangeTeacherModal(exam) {
  const currentTeachers = exam.teachers || []
  changeTeacherModal.value = {
    visible: true,
    exam,
    currentTeachers,
    loading: false,
    form: {
      old_teacher_id: '',
      new_teacher_id: null,
      reason: '',
    },
  }
}

function closeChangeTeacherModal() {
  changeTeacherModal.value.visible = false
}

async function submitChangeTeacher() {
  const modal = changeTeacherModal.value
  if (!modal.form.old_teacher_id) {
    ElMessage.warning('请选择要替换的教师')
    return
  }
  if (!modal.form.new_teacher_id) {
    ElMessage.warning('请选择新教师')
    return
  }
  if (!modal.form.reason) {
    ElMessage.warning('请输入调整原因')
    return
  }

  const parts = modal.form.old_teacher_id.split(':')
  const oldTeacherId = parseInt(parts[0])
  const role = parts[1] || 'fixed'

  modal.loading = true
  try {
    await api.post('/adjustments/change-teacher', {
      exam_id: modal.exam.id,
      old_teacher_id: oldTeacherId,
      new_teacher_id: modal.form.new_teacher_id,
      role,
      reason: modal.form.reason,
    })

    ElMessage.success('教师更换成功')
    closeChangeTeacherModal()
    fetchExams()
  } catch (e) {
    ElMessage.error('更换失败: ' + (e.response?.data?.message || e.message))
  } finally {
    modal.loading = false
  }
}

onMounted(() => {
  fetchVersions()
  fetchTeachers()
  fetchTimeSlots()
  fetchClassrooms()
})
</script>

<style scoped>
.adjustments-view {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}
.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1F2937;
  margin-bottom: 24px;
}
.mb-4 { margin-bottom: 16px; }
.mt-2 { margin-top: 8px; }
.flex { display: flex; }
.items-center { align-items: center; }
.gap-4 { gap: 16px; }
.flex-wrap { flex-wrap: wrap; }
.text-sm { font-size: 0.875rem; }
.font-medium { font-weight: 500; }
.text-gray-400 { color: #9CA3AF; }
.exams-table { min-height: 400px; }
.teachers-in-exam { padding: 12px 24px; }
.teacher-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: #F9FAFB;
  border:1px solid #E5E7EB;
  border-radius: 6px;
}
.teacher-name { font-size: 13px; font-weight: 500; }
.teacher-role { font-size: 11px; color: #6B7280; }
.remove-btn { margin-left: 4px; }
.add-teacher { display: flex; align-items: center; gap: 8px; }
.add-select { width: 200px; }
</style>
