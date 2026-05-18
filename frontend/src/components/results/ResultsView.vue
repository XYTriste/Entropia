<template>
  <div class="results-container">
    <!-- 左侧导航卡片 -->
    <aside class="nav-sidebar">
      <div class="sidebar-header">
        <h2>排考结果</h2>
        <div class="version-select">
          <select v-model="currentVersionId" @change="onVersionChange">
            <option v-for="v in versions" :key="v.id" :value="v.id">
              {{ v.name }}
            </option>
          </select>
        </div>
      </div>
      
      <nav class="nav-cards">
        <div 
          v-for="panel in panels" 
          :key="panel.id"
          class="nav-card"
          :class="{ active: currentPanel === panel.id }"
          @click="currentPanel = panel.id"
        >
          <div class="nav-card-icon" v-html="panel.icon"></div>
          <div class="nav-card-content">
            <div class="nav-card-title">{{ panel.title }}</div>
            <div class="nav-card-desc">{{ panel.desc }}</div>
          </div>
        </div>
      </nav>
    </aside>

    <!-- 中间主视图 -->
    <main class="main-view">
      <OverviewPanel v-if="currentPanel === 'overview'" :version-id="currentVersionId" />
      <TeacherPanel v-if="currentPanel === 'teachers'" :version-id="currentVersionId" />
      <TeacherLoadPanel v-if="currentPanel === 'teacher-load'" :version-id="currentVersionId" />
      <ClassroomPanel v-if="currentPanel === 'classrooms'" :version-id="currentVersionId" />
      <PatrolPanel v-if="currentPanel === 'patrol'" :version-id="currentVersionId" />
      <ClassPanel v-if="currentPanel === 'classes'" :version-id="currentVersionId" />
      <CoursePanel v-if="currentPanel === 'courses'" :version-id="currentVersionId" />
    </main>

    <!-- 右侧统计面板 -->
    <aside class="stats-sidebar">
      <div class="stats-header">
        <h3>数据统计</h3>
      </div>
      <div class="stats-content">
        <div class="stats-card">
          <div class="stats-label">版本</div>
          <div class="stats-value">{{ selectedVersionName }}</div>
        </div>
        <div class="stats-card highlight">
          <div class="stats-label">考试总数</div>
          <div class="stats-value">{{ stats.totalExams }}</div>
        </div>
        <div class="stats-card">
          <div class="stats-label">监考教师</div>
          <div class="stats-value">{{ stats.totalTeachers }}</div>
        </div>
        <div class="stats-card">
          <div class="stats-label">使用教室</div>
          <div class="stats-value">{{ stats.totalClassrooms }}</div>
        </div>
        <div class="stats-card">
          <div class="stats-label">涉及班级</div>
          <div class="stats-value">{{ stats.totalClasses }}</div>
        </div>
        <div class="stats-card">
          <div class="stats-label">涉及课程</div>
          <div class="stats-value">{{ stats.totalCourses }}</div>
        </div>
        <div class="stats-card">
          <div class="stats-label">流动监考</div>
          <div class="stats-value">{{ stats.totalPatrols }}</div>
        </div>
      </div>
      <div class="stats-actions">
        <button class="stats-btn" @click="refreshData">
          <span class="btn-icon">&#8635;</span> 刷新数据
        </button>
        <button class="stats-btn" @click="exportData">
          <span class="btn-icon">&#8595;</span> 导出结果
        </button>
      </div>
    </aside>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { get } from '@/api'
import OverviewPanel from './OverviewPanel.vue'
import TeacherPanel from './TeacherPanel.vue'
import TeacherLoadPanel from './TeacherLoadPanel.vue'
import ClassroomPanel from './ClassroomPanel.vue'
import PatrolPanel from './PatrolPanel.vue'
import ClassPanel from './ClassPanel.vue'
import CoursePanel from './CoursePanel.vue'

const versions = ref([])
const currentVersionId = ref(null)
const currentPanel = ref('overview')

const panels = [
  {
    id: 'overview',
    title: '总览矩阵',
    desc: '考试安排全景视图',
    icon: '<svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm8-2h8v8h-8v-8zm2 2v4h4v-4h-4z"/></svg>'
  },
  {
    id: 'teachers',
    title: '监考教师',
    desc: '教师监考甘特图',
    icon: '<svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>'
  },
  {
    id: 'teacher-load',
    title: '教师负荷',
    desc: '监考场次分布',
    icon: '<svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M5 9.2h3V19H5V9.2zM10.6 5h2.8v14h-2.8V5zm5.6 8H19v6h-2.8v-6z"/></svg>'
  },
  {
    id: 'classrooms',
    title: '教室使用',
    desc: '教室安排情况',
    icon: '<svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3zm5 15h-2v-6H9v6H7v-7.81l5-4.5 5 4.5V18z"/></svg>'
  },
  {
    id: 'patrol',
    title: '流动监考',
    desc: '巡考安排视图',
    icon: '<svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M19.5 12c.93 0 1.78.28 2.5.76V8c0-1.1-.9-2-2-2h-6.29l-1.06-1.06 1.41-1.41-.71-.71-3.53 3.53.71.71 1.41-1.41L13 6.71V6h-2v2H9V4H7v2H5.5c-.28 0-.5.22-.5.5v11c0 .28.22.5.5.5h14c.28 0 .5-.22.5-.5v-4c0-.28-.22-.5-.5-.5h-2.5c0-.28-.22-.5-.5-.5h-.5z"/></svg>'
  },
  {
    id: 'classes',
    title: '班级安排',
    desc: '班级考试时间轴',
    icon: '<svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M12 5.5A3.5 3.5 0 0 1 15.5 9a3.5 3.5 0 0 1-3.5 3.5A3.5 3.5 0 0 1 8.5 9 3.5 3.5 0 0 1 12 5.5M5 8c.56 0 1.08.15 1.53.42l-1.06 1.06A1.5 1.5 0 0 0 4 10.5 1.5 1.5 0 0 0 5.5 12 1.5 1.5 0 0 0 7 10.5V10H9v.5c0 .28-.22.5-.5.5A1.5 1.5 0 0 1 7 9c0-.83.67-1.5 1.5-1.5H10V7H7V5c0-.83.67-1.5 1.5-1.5S10 4.17 10 5v.5H9.5A1.5 1.5 0 0 0 8 7.5c0 .28.22.5.5.5H9v-.5zM19 8c.56 0 1.08.15 1.53.42l-1.06 1.06A1.5 1.5 0 0 0 18 10.5 1.5 1.5 0 0 0 19.5 12 1.5 1.5 0 0 0 21 10.5V10h2v.5c0 .28-.22.5-.5.5A1.5 1.5 0 0 1 21 9c0-.83.67-1.5 1.5-1.5H24V7h-3V5c0-.83.67-1.5 1.5-1.5S24 4.17 24 5v.5h-1.5A1.5 1.5 0 0 0 21 7.5c0 .28.22.5.5.5H22v-.5z"/></svg>'
  },
  {
    id: 'courses',
    title: '课程详情',
    desc: '课程考试信息',
    icon: '<svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/></svg>'
  }
]

const stats = ref({
  totalExams: 0,
  totalTeachers: 0,
  totalClassrooms: 0,
  totalClasses: 0,
  totalCourses: 0,
  totalPatrols: 0
})

const selectedVersionName = computed(() => {
  if (!Array.isArray(versions.value)) return '-'
  const v = versions.value.find(v => v.id === currentVersionId.value)
  return v ? v.name : '-'
})

async function loadVersions() {
  try {
    const res = await get('/scheduler/versions')
    // API 返回: { data: { total, items: [{id, version_no, status, description, created_at}] } }
    const items = res.data?.items || []
    versions.value = items.map(v => ({
      id: v.id,
      name: v.version_no || `版本 ${v.id}`,
      status: v.status,
      description: v.description,
      createdAt: v.created_at
    }))
    if (versions.value.length > 0) {
      currentVersionId.value = versions.value[0].id
    }
  } catch (e) {
    console.error('加载版本失败:', e)
  }
}

async function loadStats() {
  try {
    const [overview, teachers, classrooms, classes, courses] = await Promise.all([
      get('/exams/overview/matrix'),
      get('/exams/teachers/gantt'),
      get('/exams/classrooms/matrix'),
      get('/classes/'),
      get('/courses/')
    ])

    // overview 返回: { data: { matrix: { "周一": { "T1": [exams...] } } } }
    // 统计考试总数
    let totalExams = 0
    const matrix = overview.data?.matrix || {}
    for (const day of Object.values(matrix)) {
      if (typeof day === 'object') {
        for (const slot of Object.values(day)) {
          if (Array.isArray(slot)) {
            totalExams += slot.length
          }
        }
      }
    }
    stats.value.totalExams = totalExams

    // teachers 返回: { data: { teachers: [...] } }
    stats.value.totalTeachers = teachers.data?.teachers?.length || 0

    // classrooms 返回: { data: { matrix: { "教室名": { "时段键": [exams] } } } }
    const roomMatrix = classrooms.data?.matrix || {}
    stats.value.totalClassrooms = Object.keys(roomMatrix).length

    // classes 返回: { data: { total, items: [...] } }
    stats.value.totalClasses = classes.data?.total || 0

    // courses 返回: { data: { total, items: [...] } }
    stats.value.totalCourses = courses.data?.total || 0

    // 流动监考统计：从 teachers 中提取 patrol 类型
    let totalPatrols = 0
    const teacherList = teachers.data?.teachers || []
    for (const t of teacherList) {
      totalPatrols += (t.events || []).filter(e => e.role === 'patrol').length
    }
    stats.value.totalPatrols = totalPatrols
  } catch (e) {
    console.error('加载统计数据失败:', e)
  }
}

function onVersionChange() {
  // 各子面板通过 props 响应变化
}

function refreshData() {
  loadStats()
}

function exportData() {
  console.log('导出数据')
}

onMounted(() => {
  loadVersions()
  loadStats()
})
</script>

<style scoped>
/* ============================================================
   CSS Variables - 深色主题（参考 base-data-three-column.html）
   ============================================================ */
.results-container {
  --bg-start: #0a0e27;
  --bg-end: #1a1f3a;
  --card-bg: #111827;
  --card-border: #1f2937;
  --accent: #1677ff;
  --accent-hover: #4096ff;
  --accent-light: rgba(22, 119, 255, 0.15);
  --text-primary: #ffffff;
  --text-secondary: #9ca3af;
  --text-muted: #6b7280;
  --success: #10b981;
  --warning: #f59e0b;
  --danger: #ef4444;
  --shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  --radius: 8px;
  
  display: flex;
  height: 100%;
  background: linear-gradient(160deg, var(--bg-start) 0%, var(--bg-end) 100%);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

/* ============================================================
   左侧导航栏
   ============================================================ */
.nav-sidebar {
  width: 260px;
  background: var(--card-bg);
  border-right: 1px solid var(--card-border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.sidebar-header {
  padding: 20px;
  border-bottom: 1px solid var(--card-border);
}

.sidebar-header h2 {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--text-primary);
}

.version-select select {
  width: 100%;
  padding: 8px 12px;
  background: var(--bg-start);
  border: 1px solid var(--card-border);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 0.85rem;
  cursor: pointer;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.version-select select:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-light);
}

.nav-cards {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.nav-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  margin-bottom: 8px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.nav-card:hover {
  background: var(--accent-light);
  border-color: var(--card-border);
}

.nav-card.active {
  background: var(--accent-light);
  border-color: var(--accent);
  position: relative;
}

.nav-card.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 60%;
  background: var(--accent);
  border-radius: 0 2px 2px 0;
  box-shadow: 0 0 10px var(--accent);
}

.nav-card-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-start);
  border-radius: 8px;
  color: var(--text-secondary);
  flex-shrink: 0;
  transition: all 0.3s;
}

.nav-card:hover .nav-card-icon,
.nav-card.active .nav-card-icon {
  color: var(--accent);
  background: rgba(22, 119, 255, 0.2);
}

.nav-card-content {
  flex: 1;
  min-width: 0;
}

.nav-card-title {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.nav-card-desc {
  font-size: 0.75rem;
  color: var(--text-muted);
}

/* ============================================================
   中间主视图
   ============================================================ */
.main-view {
  flex: 1;
  overflow: hidden;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

/* ============================================================
   右侧统计面板
   ============================================================ */
.stats-sidebar {
  width: 280px;
  background: var(--card-bg);
  border-left: 1px solid var(--card-border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.stats-header {
  padding: 20px;
  border-bottom: 1px solid var(--card-border);
}

.stats-header h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.stats-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.stats-card {
  padding: 14px;
  margin-bottom: 12px;
  background: var(--bg-start);
  border: 1px solid var(--card-border);
  border-radius: var(--radius);
  transition: all 0.2s;
}

.stats-card:hover {
  border-color: var(--accent);
}

.stats-card.highlight {
  border-color: var(--accent);
  background: var(--accent-light);
}

.stats-card.highlight .stats-value {
  color: var(--accent);
}

.stats-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stats-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
}

.stats-actions {
  padding: 16px;
  border-top: 1px solid var(--card-border);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stats-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  background: transparent;
  border: 1px solid var(--accent);
  border-radius: 6px;
  color: var(--accent);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.stats-btn:hover {
  background: var(--accent);
  color: white;
  box-shadow: 0 0 12px rgba(22, 119, 255, 0.4);
}

.btn-icon {
  font-size: 1rem;
}

/* ============================================================
   响应式
   ============================================================ */
@media (max-width: 1200px) {
  .stats-sidebar {
    width: 240px;
  }
}

@media (max-width: 992px) {
  .nav-sidebar {
    width: 220px;
  }
  .stats-sidebar {
    width: 200px;
  }
}
</style>
