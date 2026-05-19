<template>
  <div class="import-export-view">
    <h2 class="page-title">导入 / 导出</h2>

    <!-- 导入区域 -->
    <el-card class="mb-4">
      <template #header>
        <span class="font-semibold">数据导入</span>
      </template>

      <el-alert type="info" :closable="false" class="mb-4">
        <p>支持 Excel（.xlsx）和 CSV 格式。请先下载模板，按模板格式填写数据后再上传。</p>
      </el-alert>

      <div class="import-section mb-4">
        <h3 class="section-subtitle">下载模板</h3>
        <div class="flex flex-wrap gap-2">
          <el-button
            v-for="tpl in templates"
            :key="tpl.key"
            @click="downloadTemplate(tpl.key)"
          >{{ tpl.label }} 模板</el-button>
          <el-button @click="downloadAllInOneTemplate">
            全量导入模板
          </el-button>
        </div>
      </div>

      <!-- 导入方式选项卡 -->
      <el-tabs v-model="importTab" class="mb-4">
        <el-tab-pane label="单类型导入" name="single">
          <div class="import-section">
            <h3 class="section-subtitle">上传数据（单类型）</h3>
            <el-upload
              ref="uploadRef"
              :auto-upload="false"
              :limit="1"
              :on-change="handleFileChange"
              :on-remove="handleRemove"
              accept=".xlsx,.xls,.csv"
              :show-file-list="true"
            >
              <el-button type="primary" :icon="UploadFilled">选择文件</el-button>
              <template #tip>
                <div class="el-upload__tip">仅支持 .xlsx、.xls、.csv 格式</div>
              </template>
            </el-upload>

            <div v-if="selectedFile" class="mt-3">
              <el-button
                type="success"
                :loading="uploading"
                :disabled="!selectedFile"
                @click="uploadFile"
              >确认导入</el-button>
              <el-button @click="handleRemove">取消</el-button>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="全量导入" name="all-in-one">
          <div class="import-section">
            <el-alert type="warning" :closable="false" class="mb-4">
              <p>全量导入会一次性导入 Excel 文件中的所有 Sheet（教师、教室、课程、班级、学生、专业、时段）。请先下载全量导入模板。</p>
            </el-alert>
            <h3 class="section-subtitle">上传全量数据</h3>
            <el-upload
              ref="uploadAllInOneRef"
              :auto-upload="false"
              :limit="1"
              :on-change="handleAllInOneFileChange"
              :on-remove="handleAllInOneRemove"
              accept=".xlsx,.xls"
              :show-file-list="true"
            >
              <el-button type="primary" :icon="UploadFilled">选择全量文件</el-button>
              <template #tip>
                <div class="el-upload__tip">仅支持 .xlsx、.xls 格式，文件需包含多个 Sheet</div>
              </template>
            </el-upload>

            <div v-if="selectedAllInOneFile" class="mt-3">
              <el-button
                type="success"
                :loading="uploadingAllInOne"
                :disabled="!selectedAllInOneFile"
                @click="uploadAllInOneFile"
              >确认全量导入</el-button>
              <el-button @click="handleAllInOneRemove">取消</el-button>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>

      <!-- 导入结果反馈 -->
      <div v-if="importResult" class="import-result mt-4">
        <el-alert
          v-if="importResult.success"
          type="success"
          :closable="false"
          class="mb-2"
        >
          <template #default>
            <span>导入成功: {{ importResult.success_count }} 条</span>
          </template>
        </el-alert>
        <el-alert
          v-else
          type="warning"
          :closable="false"
          class="mb-2"
        >
          <template #default>
            <span>导入完成: {{ importResult.error_count }} 条错误</span>
          </template>
        </el-alert>

        <div v-if="importResult.errors && importResult.errors.length" class="error-table mt-2">
          <h4 class="text-sm font-semibold text-red-600 mb-2">错误详情：</h4>
          <el-table :data="importResult.errors" size="small" max-height="300" border>
            <el-table-column prop="row" label="行号" width="80" />
            <el-table-column prop="message" label="错误信息" />
          </el-table>
        </div>

        <div v-if="importResult.warnings && importResult.warnings.length" class="warning-table mt-2">
          <h4 class="text-sm font-semibold text-orange-600 mb-2">警告信息：</h4>
          <el-table :data="importResult.warnings" size="small" max-height="300" border>
            <el-table-column prop="row" label="行号" width="80" />
            <el-table-column prop="message" label="警告信息" />
          </el-table>
        </div>
      </div>
    </el-card>

    <!-- 数据管理区域 -->
    <el-card class="mb-4">
      <template #header>
        <span class="font-semibold">数据管理</span>
      </template>

      <div class="flex flex-wrap gap-2">
        <el-button type="warning" :loading="initLoading" @click="initTimeSlots">
          初始化时段
        </el-button>
        <el-button type="danger" :loading="clearLoading" @click="clearAllData">
          清除全部数据
        </el-button>
      </div>
    </el-card>

    <!-- 导出区域 -->
    <el-card>
      <template #header>
        <span class="font-semibold">数据导出</span>
      </template>

      <div class="export-desc mb-4">
        <p class="text-sm text-gray-600">导出当前数据库中的所有基础数据和排考结果为文件。</p>
      </div>

      <div class="flex flex-wrap gap-2">
        <el-button type="primary" :loading="exportingExcel" :icon="Download" @click="exportExcel">
          导出 Excel
        </el-button>
        <el-button type="success" :loading="exportingJson" :icon="Download" @click="exportJSON">
          导出 JSON
        </el-button>
        <el-button type="warning" :loading="exportingSql" :icon="Download" @click="exportSQL">
          导出 SQL
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { UploadFilled, Download } from '@element-plus/icons-vue'
import api from '@/api/index.js'

const uploading = ref(false)
const uploadingAllInOne = ref(false)
const exportingExcel = ref(false)
const exportingJson = ref(false)
const exportingSql = ref(false)
const initLoading = ref(false)
const clearLoading = ref(false)
const selectedFile = ref(null)
const selectedAllInOneFile = ref(null)
const uploadRef = ref(null)
const uploadAllInOneRef = ref(null)
const importTab = ref('single')
const importResult = ref(null)

const templates = [
  { key: 'teachers',   label: '教师' },
  { key: 'classrooms', label: '教室' },
  { key: 'courses',    label: '课程' },
  { key: 'classes',    label: '班级' },
  { key: 'students',   label: '学生' },
  { key: 'majors',     label: '专业' },
  { key: 'time-slots', label: '时段' },
]

// 单文件导入相关函数
function handleFileChange(uploadFile) {
  selectedFile.value = uploadFile.raw
  importResult.value = null
}

function handleRemove() {
  selectedFile.value = null
  if (uploadRef.value) uploadRef.value.clearFiles()
  importResult.value = null
}

async function downloadTemplate(key) {
  try {
    const res = await fetch(`/api/import-export/template?type=${key}`)
    if (!res.ok) throw new Error('下载失败')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${key}_模板.xlsx`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('模板下载成功')
  } catch (e) {
    ElMessage.error(`模板下载失败：${e.message}`)
  }
}

async function uploadFile() {
  if (!selectedFile.value) return
  uploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', selectedFile.value)
    const res = await api.post('/import-export/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    importResult.value = res
    if (res.success) {
      ElMessage.success(`成功导入 ${res.success_count} 条数据`)
    } else {
      ElMessage.warning(`导入完成，${res.error_count} 条错误`)
    }
    handleRemove()
  } catch (e) {
    const msg = e.response?.data?.detail || e.message || '导入失败'
    ElMessage.error(`导入失败：${msg}`)
  } finally {
    uploading.value = false
  }
}

// 全量导入相关函数
function handleAllInOneFileChange(uploadFile) {
  selectedAllInOneFile.value = uploadFile.raw
  importResult.value = null
}

function handleAllInOneRemove() {
  selectedAllInOneFile.value = null
  if (uploadAllInOneRef.value) uploadAllInOneRef.value.clearFiles()
  importResult.value = null
}

async function downloadAllInOneTemplate() {
  try {
    const url = '/api/import-export/templates/all-in-one'
    const a = document.createElement('a')
    a.href = url
    a.download = 'all_in_one_template.xlsx'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    ElMessage.success('全量模板下载成功')
  } catch (e) {
    ElMessage.error(`全量模板下载失败：${e.message}`)
  }
}

async function uploadAllInOneFile() {
  if (!selectedAllInOneFile.value) return
  uploadingAllInOne.value = true
  try {
    const formData = new FormData()
    formData.append('file', selectedAllInOneFile.value)
    const res = await api.post('/import-export/import-excel-all', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    importResult.value = res.data || res
    if (res.data?.success || res.success) {
      ElMessage.success('全量导入成功')
    } else {
      ElMessage.warning('全量导入完成，部分数据有错误')
    }
    handleAllInOneRemove()
  } catch (e) {
    const msg = e.response?.data?.detail || e.message || '导入失败'
    ElMessage.error(`全量导入失败：${msg}`)
  } finally {
    uploadingAllInOne.value = false
  }
}

// 数据管理函数
async function initTimeSlots() {
  try {
    await ElMessageBox.confirm(
      '确定要清空并重新初始化20个标准考试时段吗？这会删除所有自定义时段，且如果有课程引用了现有时段将无法重置。',
      '确认重置时段',
      {
        confirmButtonText: '确定重置',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )

    initLoading.value = true
    const res = await api.post('/import-export/init-time-slots')
    ElMessage.success(res.message || '时段初始化成功')

    // 显示初始化结果
    const data = res.data || {}
    const slots = data.slots || []
    let info = '已初始化时段:\n'
    for (const s of slots) {
      const dayNames = ['', '一', '二', '三', '四', '五']
      info += `ID=${s.id}: 周${dayNames[s.day_of_week]} ${s.slot_code} (${s.start_time}-${s.end_time})\n`
    }
    ElMessageBox.alert(`<pre>${info}</pre>`, '时段初始化完成', {
      dangerouslyUseHTMLString: true,
      confirmButtonText: '确定',
    })
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') {
      const msg = e.response?.data?.detail || e.message || '重置失败'
      ElMessage.error(`时段初始化失败：${msg}`)
    }
  } finally {
    initLoading.value = false
  }
}

async function clearAllData() {
  try {
    await ElMessageBox.confirm(
      '此操作将删除所有基础数据（专业、教师、教室、班级、课程、学生、排考记录等），且无法撤销！\n\n保留数据：考试时段、审计日志',
      '⚠️ 确认清除全部数据',
      {
        confirmButtonText: '确认清除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger',
      }
    )

    clearLoading.value = true
    const res = await api.post('/import-export/clear-data', {
      confirm: true,
      preserve_audit_logs: true
    })

    const data = res.data || {}
    const cleared = data.cleared || {}
    const preserved = data.preserved || []

    let html = '<div class="space-y-2 text-sm">'
    html += '<div><span class="font-semibold">已清除：</span></div>'
    html += '<div class="grid grid-cols-2 gap-1 text-xs">'
    for (const [k, v] of Object.entries(cleared)) {
      html += `<div class="px-2 py-1 rounded ${v.includes('失败') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}">${k}: ${v}</div>`
    }
    html += '</div>'
    html += `<div class="mt-2"><span class="font-semibold">已保留：</span> ${preserved.join('、')}</div>`
    html += '</div>'

    ElMessageBox.alert(html, '清除结果', {
      dangerouslyUseHTMLString: true,
      confirmButtonText: '确定',
    })

    ElMessage.success('数据清除完成')
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') {
      const msg = e.response?.data?.detail || e.message || '清除失败'
      ElMessage.error(`数据清除失败：${msg}`)
    }
  } finally {
    clearLoading.value = false
  }
}

// 导出函数
async function exportExcel() {
  exportingExcel.value = true
  try {
    const res = await fetch('/api/import-export/export/excel')
    if (!res.ok) throw new Error('导出失败')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const date = new Date()
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    a.download = `排考数据导出_${dateStr}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('Excel 导出成功')
  } catch (e) {
    ElMessage.error(`Excel 导出失败：${e.message}`)
  } finally {
    exportingExcel.value = false
  }
}

async function exportJSON() {
  exportingJson.value = true
  try {
    const res = await fetch('/api/import-export/export/json')
    if (!res.ok) throw new Error('导出失败')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const date = new Date()
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    a.download = `排考数据导出_${dateStr}.json`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('JSON 导出成功')
  } catch (e) {
    ElMessage.error(`JSON 导出失败：${e.message}`)
  } finally {
    exportingJson.value = false
  }
}

async function exportSQL() {
  exportingSql.value = true
  try {
    const res = await fetch('/api/import-export/export/sql')
    if (!res.ok) throw new Error('导出失败')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const date = new Date()
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    a.download = `排考数据导出_${dateStr}.sql`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('SQL 导出成功')
  } catch (e) {
    ElMessage.error(`SQL 导出失败：${e.message}`)
  } finally {
    exportingSql.value = false
  }
}
</script>

<style scoped>
.import-export-view {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}
.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary, #1F2937);
  margin-bottom: 24px;
}
.mb-4 {
  margin-bottom: 16px;
}
.mt-3 {
  margin-top: 12px;
}
.mt-4 {
  margin-top: 16px;
}
.mb-2 {
  margin-bottom: 8px;
}
.section-subtitle {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--text-primary, #374151);
}
.export-desc {
  padding: 8px 0;
}
.flex {
  display: flex;
}
.flex-wrap {
  flex-wrap: wrap;
}
.gap-2 {
  gap: 8px;
}
.text-sm {
  font-size: 0.875rem;
}
.text-gray-600 {
  color: #4B5563;
}
.import-result {
  padding: 16px;
  background: var(--card-bg, #F9FAFB);
  border-radius: 8px;
  border: 1px solid var(--border-color, #E5E7EB);
}
.error-table,
.warning-table {
  max-height: 300px;
  overflow-y: auto;
}
</style>
