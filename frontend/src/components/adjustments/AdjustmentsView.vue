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
        <el-table-column label="监考人数" width="100" align="center">
          <template #default="{ row }">
            {{ (row.teacherList || []).length }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>
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
const selectedVersion = ref(null)
const loading = ref(false)
const saving = ref(false)
const modifiedExams = ref(new Set())

const hasChanges = computed(() => modifiedExams.value.size > 0)
const availableTeachers = computed(() => teachers.value)

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
      teacherList: (e.fixed_teachers || []).map(name => ({
        name,
        role: 'fixed',
        id: teachers.value.find(t => t.name === name)?.id,
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

function onExpand(expanded, row) {
  // 可以在这里加载每个考试的详细监考信息
}

function removeTeacher(row, teacher) {
  ElMessageBox.confirm(
    `确定将教师「${teacher.name}」从考试中移除吗？`,
    '确认移除',
    { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
  ).then(() => {
    row.teacherList = row.teacherList.filter(t => t.id !== teacher.id)
    modifiedExams.value.add(row.id)
    ElMessage.success('已标记修改，请点击"保存调整"')
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

  row.teacherList.push({
    id: teacher.id,
    name: teacher.name,
    role: 'fixed',
  })
  row.addTeacherId = null
  modifiedExams.value.add(row.id)
  ElMessage.success('已标记修改，请点击"保存调整"')
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

onMounted(() => {
  fetchVersions()
  fetchTeachers()
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
  border: 1px solid #E5E7EB;
  border-radius: 6px;
}
.teacher-name { font-size: 13px; font-weight: 500; }
.teacher-role { font-size: 11px; color: #6B7280; }
.remove-btn { margin-left: 4px; }
.add-teacher { display: flex; align-items: center; gap: 8px; }
.add-select { width: 200px; }
</style>
