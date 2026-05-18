<template>
  <div class="results-view">
    <!-- ========== HEADER ========== -->
    <header class="header">
      <div class="header-left">
        <el-icon :size="20" class="header-icon"><DataBoard /></el-icon>
        <h1 class="header-title">排 考 结 果</h1>
      </div>
      <div class="header-right">
        <el-select
          v-model="currentVersionId"
          placeholder="选择版本"
          class="version-select"
          @change="onVersionChange"
        >
          <el-option
            v-for="v in versionList"
            :key="v.id"
            :label="`${v.version_no} [${statusTag(v.status)}]`"
            :value="v.id"
          />
        </el-select>
        <el-button @click="loadVersions" :loading="loadingVersions">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
        <el-button type="success" @click="exportExcel">
          <el-icon><Download /></el-icon>
          导出Excel
        </el-button>
      </div>
    </header>

    <!-- ========== TABS ========== -->
    <div class="tabs-card">
      <el-tabs v-model="activeTab" @tab-change="onTabChange">
        <!-- 总览视图 -->
        <el-tab-pane label="总览视图" name="overview">
          <OverviewPanel :version-id="currentVersionId" />
        </el-tab-pane>

        <!-- 教师视图 -->
        <el-tab-pane label="教师视图" name="teacher">
          <TeacherPanel :version-id="currentVersionId" />
        </el-tab-pane>

        <!-- 教师负荷 -->
        <el-tab-pane label="教师负荷" name="teacher-load">
          <TeacherLoadPanel :version-id="currentVersionId" />
        </el-tab-pane>

        <!-- 教室视图 -->
        <el-tab-pane label="教室视图" name="classroom">
          <ClassroomPanel :version-id="currentVersionId" />
        </el-tab-pane>

        <!-- 流动监考 -->
        <el-tab-pane label="流动监考" name="patrol">
          <PatrolPanel :version-id="currentVersionId" />
        </el-tab-pane>

        <!-- 班级视图 -->
        <el-tab-pane label="班级视图" name="class">
          <ClassPanel :version-id="currentVersionId" />
        </el-tab-pane>

        <!-- 课程视图 -->
        <el-tab-pane label="课程视图" name="course">
          <CoursePanel :version-id="currentVersionId" />
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  DataBoard,
  Refresh,
  Download,
} from '@element-plus/icons-vue'
import OverviewPanel from './OverviewPanel.vue'
import TeacherPanel from './TeacherPanel.vue'
import TeacherLoadPanel from './TeacherLoadPanel.vue'
import ClassroomPanel from './ClassroomPanel.vue'
import PatrolPanel from './PatrolPanel.vue'
import ClassPanel from './ClassPanel.vue'
import CoursePanel from './CoursePanel.vue'
import api from '@/api/index.js'

// ========== VERSION MANAGEMENT ==========
const versionList = ref([])
const currentVersionId = ref(null)
const loadingVersions = ref(false)
const activeTab = ref('overview')

async function loadVersions() {
  loadingVersions.value = true
  try {
    const res = await api.get('/scheduler/versions')
    const items = res.data?.items || []
    versionList.value = items
    // 默认选已发布版本，否则选最新的
    const published = items.find(v => v.status === 'published')
    currentVersionId.value = published?.id || items[0]?.id || null
  } catch (e) {
    ElMessage.error('加载版本列表失败')
  } finally {
    loadingVersions.value = false
  }
}

function statusTag(status) {
  const map = { published: '已发布', draft: '草稿', archived: '已归档' }
  return map[status] || status
}

function onVersionChange() {
  // 各子面板通过 :version-id prop 响应变化
}

function onTabChange() {
  // tab 切换时无需额外操作，el-tab-pane 的 lazy 属性让面板按需加载
}

async function exportExcel() {
  try {
    const response = await fetch('/api/import-export/export/excel')
    if (!response.ok) throw new Error('Export failed')
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `排考结果_${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('Excel 导出成功')
  } catch {
    ElMessage.error('Excel 导出失败')
  }
}

// ========== LIFECYCLE ==========
onMounted(() => {
  loadVersions()
})
</script>

<style scoped>
.results-view {
  --bg-deep: #0a0e27;
  --bg-surface: #1a1f3a;
  --bg-card: rgba(26, 31, 58, 0.85);
  --border: rgba(100, 140, 255, 0.15);
  --accent: #4fc3f7;
  --accent2: #7c4dff;
  --green: #00e676;
  --yellow: #ffd740;
  --red: #ff5252;
  --orange: #ff9100;
  --text: #e0e0e0;
  --text-dim: rgba(224, 224, 224, 0.55);

  min-height: 100vh;
  background: linear-gradient(160deg, #0a0e27 0%, #1a1f3a 100%);
  color: var(--text);
  padding: 0 28px 28px;
  position: relative;
}

.results-view::before {
  content: '';
  position: fixed;
  inset: 0;
  background:
    linear-gradient(rgba(79,195,247,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(79,195,247,0.04) 1px, transparent 1px);
  background-size: 60px 60px;
  pointer-events: none;
  z-index: 0;
}

/* Header */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 0 16px;
  position: relative;
  z-index: 1;
}
.header::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, #4fc3f7, transparent);
}
.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.header-icon { color: var(--accent); }
.header-title {
  font-size: 1.4rem;
  font-weight: 700;
  letter-spacing: 4px;
  background: linear-gradient(90deg, #4fc3f7, #7c4dff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
  z-index: 1;
}
.version-select {
  width: 220px;
}

/* Tabs Card */
.tabs-card {
  position: relative;
  z-index: 1;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
}

/* Element Plus Tabs Dark Override */
.tabs-card :deep(.el-tabs__header) {
  margin: 0;
  background: rgba(79,195,247,0.05);
  border-bottom: 1px solid var(--border);
}
.tabs-card :deep(.el-tabs__nav-wrap::after) {
  display: none;
}
.tabs-card :deep(.el-tabs__item) {
  color: var(--text-dim);
  font-size: 0.9rem;
  padding: 0 24px;
  height: 48px;
  line-height: 48px;
}
.tabs-card :deep(.el-tabs__item:hover) {
  color: var(--accent);
}
.tabs-card :deep(.el-tabs__item.is-active) {
  color: var(--accent);
  font-weight: 600;
}
.tabs-card :deep(.el-tabs__active-bar) {
  background: linear-gradient(90deg, #4fc3f7, #7c4dff);
  height: 3px;
  border-radius: 2px 2px 0 0;
}
.tabs-card :deep(.el-tabs__content) {
  padding: 20px;
}
.tabs-card :deep(.el-tab-pane) {
  outline: none;
}

/* Version Select Dark Override */
.tabs-card :deep(.el-input__wrapper) {
  background: rgba(255,255,255,0.08);
  border-color: var(--border);
  box-shadow: none;
}
.tabs-card :deep(.el-input__inner) {
  color: var(--text);
}
.tabs-card :deep(.el-select__caret) {
  color: var(--text-dim);
}

/* Scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 3px; }
::-webkit-scrollbar-thumb { background: rgba(100,140,255,0.3); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: rgba(100,140,255,0.5); }
</style>
