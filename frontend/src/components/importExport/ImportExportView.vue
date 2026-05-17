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
        </div>
      </div>

      <div class="import-section">
        <h3 class="section-subtitle">上传数据</h3>
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
    </el-card>

    <!-- 导出区域 -->
    <el-card>
      <template #header>
        <span class="font-semibold">数据导出</span>
      </template>

      <div class="export-desc mb-4">
        <p class="text-sm text-gray-600">导出当前数据库中的所有基础数据和排考结果为 Excel 文件。</p>
      </div>

      <el-button type="primary" :loading="exporting" :icon="Download" @click="exportExcel">
        导出 Excel
      </el-button>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { UploadFilled, Download } from '@element-plus/icons-vue'
import api from '@/api/index.js'

const uploading = ref(false)
const exporting = ref(false)
const selectedFile = ref(null)
const uploadRef = ref(null)

const templates = [
  { key: 'teachers',   label: '教师' },
  { key: 'classrooms', label: '教室' },
  { key: 'courses',    label: '课程' },
  { key: 'classes',    label: '班级' },
  { key: 'students',   label: '学生' },
  { key: 'majors',     label: '专业' },
]

function handleFileChange(uploadFile) {
  selectedFile.value = uploadFile.raw
}

function handleRemove() {
  selectedFile.value = null
  if (uploadRef.value) uploadRef.value.clearFiles()
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
    ElMessage.success(res.message || '导入成功')
    handleRemove()
  } catch (e) {
    const msg = e.response?.data?.detail || e.message || '导入失败'
    ElMessage.error(`导入失败：${msg}`)
  } finally {
    uploading.value = false
  }
}

async function exportExcel() {
  exporting.value = true
  try {
    const res = await fetch('/api/export/excel')
    if (!res.ok) throw new Error('导出失败')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '排考数据导出.xlsx'
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch (e) {
    ElMessage.error(`导出失败：${e.message}`)
  } finally {
    exporting.value = false
  }
}
</script>

<style scoped>
.import-export-view {
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
.mt-3 {
  margin-top: 12px;
}
.section-subtitle {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 12px;
  color: #374151;
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
</style>
