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
              <div
                v-for="(t, idx) in row.teacherList"
                :key="idx"
                class="teacher-card"
              >
                <el-tag size="small" :type="t.role === 'fixed' ? '' : 'warning'">
                  {{ t.role === 'fixed' ? '固定监考' : '流动监考' }}
                </el-tag>
                <span class="teacher-name">{{ t.name }}</span>
                <el-button
                  class="remove-btn"
                  type="danger"
                  size="small"
                  :icon="Delete"
                  circle
                  @click="removeTeacher(row, t)"
                />
              </div>
              <div class="add-teacher">
                <el-select
                  v-model="row.addTeacherId"
                  filterable
                  placeholder="添加教师"
                  class="add-select"
                >
                  <el-option
                    v-for="t in allTeachers"
                    :key="t.id"
                    :label="t.name"
                    :value="t.id"
                  />
                </el-select>
                <el-button type="success" size="small" @click="addTeacher(row)">添加</el-button>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="course_name" label="课程" />
        <el-table-column prop="exam_date" label="日期" width="100" />
        <el-table-column prop="start_time" label="开始" width="80" />
        <el-table-column prop="end_time" label="结束" width="80" />
        <el-table-column prop="room_name" label="教室" width="120" />
        <el-table-column prop="class_name" label="班级" />
        <el-table-column prop="student_count" label="人数" width="80" />
        <el-table-column label="操作" width="160">
          <template #default="{ row }">
            <el-button size="small" @click="openAdjustModal(row)">调整安排</el-button>
            <el-button size="small" @click="openChangeTeacherModal(row)">更换教师</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 调整安排模态框 -->
    <el-dialog v-model="adjustModal.visible" title="调整考试安排" width="500px">
      <el-form :model="adjustModal.form" label-width="100px">
        <el-form-item label="时段">
          <el-select v-model="adjustModal.form.time_slot_id" @change="onTimeSlotChange">
            <el-option
              v-for="ts in allTimeSlots"
              :key="ts.id"
              :label="`${ts.day_name} ${ts.start_time}-${ts.end_time}`"
              :value="ts.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="教室">
          <el-select v-model="adjustModal.form.classroom_id">
            <el-option
              v-for="c in allClassrooms"
              :key="c.id"
              :label="c.name"
              :value="c.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="调整原因">
          <el-input v-model="adjustModal.form.reason" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="adjustModal.visible = false">取消</el-button>
        <el-button type="primary" :loading="adjustModal.loading" @click="submitAdjust">确定</el-button>
      </template>
    </el-dialog>

    <!-- 更换教师模态框 -->
    <el-dialog v-model="changeTeacherModal.visible" title="更换教师" width="500px">
      <el-form :model="changeTeacherModal.form" label-width="100px">
        <el-form-item label="原教师">
          <el-select v-model="changeTeacherModal.form.old_teacher_id">
            <el-option
              v-for="t in changeTeacherModal.currentTeachers"
              :key="t.teacher_id"
              :label="t.teacher_name"
              :value="`${t.teacher_id}:${t.role}`"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="新教师">
          <el-select v-model="changeTeacherModal.form.new_teacher_id">
            <el-option
              v-for="t in allTeachers"
              :key="t.id"
              :label="t.name"
              :value="t.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="调整原因">
          <el-input v-model="changeTeacherModal.form.reason" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="changeTeacherModal.visible = false">取消</el-button>
        <el-button type="primary" :loading="changeTeacherModal.loading" @click="submitChangeTeacher">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete } from '@element-plus/icons-vue'
import api from '@/api'

const versions = ref([])
const selectedVersion = ref(null)
const exams = ref([])
const allTeachers = ref([])
const allTimeSlots = ref([])
const allClassrooms = ref([])
const loading = ref(false)
const saving = ref(false)
const undoing = ref(false)
const hasChanges = ref(false)
const modifiedExams = ref(new Set())

const adjustModal = ref({ visible: false, exam: null, loading: false, form: { time_slot_id: null, classroom_id: null, reason: '' } })
const changeTeacherModal = ref({ visible: false, exam: null, currentTeachers: [], loading: false, form: { old_teacher_id: '', new_teacher_id: null, reason: '' } })

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
    allTeachers.value = res.items || []
  } catch (e) {
    allTeachers.value = []
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
      await api.post('/adjustments/change-teacher', {
        exam_id: row.id,
        old_teacher_id: teacher.id,
        new_teacher_id: teacher.id,
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
  const teacher = allTeachers.value.find(t => t.id === row.addTeacherId)
  if (!teacher) return

  if (row.teacherList.some(t => t.id === teacher.id)) {
    ElMessage.warning('该教师已在此考试中')
    return
  }

  try {
    await api.post('/adjustments/change-teacher', {
      exam_id: row.id,
      old_teacher_id: teacher.id,
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
    for (const examId of modifiedExams.value) {
      const exam = exams.value.find(e => e.id === examId)
      if (!exam) continue
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

    if (currentTimeSlotId !== modal.form.time_slot_id) {
      await api.post('/adjustments/move-exam-time', {
        exam_id: exam.id,
        new_time_slot_id: modal.form.time_slot_id,
        reason: modal.form.reason,
      })
    }

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
  max-width: 1400px;
  margin: 0 auto;
  min-height: calc(100vh - 64px);
  background: var(--bg-start);
  position: relative;
  overflow: hidden;
}

/* 扫光特效 - 橙色 */
.adjustments-view::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -60%;
  width: 200%;
  height: 200%;
  background: linear-gradient(
    115deg,
    transparent 30%,
    rgba(245, 158, 11, 0.07) 45%,
    rgba(245, 158, 11, 0.12) 50%,
    rgba(245, 158, 11, 0.07) 55%,
    transparent 70%
  );
  transform: rotate(25deg);
  animation: sweepLight 6s infinite linear;
  pointer-events: none;
  z-index: 0;
}

/* 网格纹理背景 */
.adjustments-view::after {
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
.mt-2 { margin-top: 8px; }
.flex { display: flex; }
.items-center { align-items: center; }
.gap-4 { gap: 16px; }
.flex-wrap { flex-wrap: wrap; }
.text-sm { font-size: 0.875rem; }
.font-medium { font-weight: 500; }
.text-gray-400 { color: var(--text-secondary); }

.exams-table {
  min-height: 400px;
  position: relative;
  z-index: 2;
}

.teachers-in-exam {
  padding: 12px 24px;
  position: relative;
  z-index: 2;
}

.teacher-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 6px;
  position: relative;
  z-index: 2;
}

.teacher-name { font-size: 13px; font-weight: 500; color: var(--text-primary); }
.teacher-role { font-size: 11px; color: var(--text-muted); }
.remove-btn { margin-left: 4px; }
.add-teacher { display: flex; align-items: center; gap: 8px; }
.add-select { width: 200px; }

/* Element Plus 深色适配 */
:deep(.el-card) {
  background: var(--card-bg);
  border-color: var(--card-border);
  color: var(--text-primary);
}
:deep(.el-card__header) {
  border-bottom-color: var(--card-border);
}
:deep(.el-table) {
  background: transparent;
  color: var(--text-primary);
}
:deep(.el-table tr) {
  background: transparent;
}
:deep(.el-table th.el-table__cell) {
  background: rgba(22, 119, 255, 0.1);
  color: var(--text-primary);
  border-bottom-color: var(--card-border);
}
:deep(.el-table td.el-table__cell) {
  border-bottom-color: var(--card-border);
}
:deep(.el-table--striped .el-table__body tr.el-table__row--striped td) {
  background: rgba(255, 255, 255, 0.03);
}
:deep(.el-tag) {
  border-color: var(--card-border);
}
</style>
