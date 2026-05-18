<template>
  <div class="scheduler-view">
    <!-- ========== HEADER ========== -->
    <header class="header">
      <div class="header-left">
        <el-icon :size="20" class="header-icon"><Cpu /></el-icon>
        <h1 class="header-title">智 能 排 考 引 擎</h1>
      </div>
      <div class="header-right">
        <span class="header-tag">OR-Tools CP-SAT</span>
      </div>
    </header>

    <!-- ========== MAIN CONTENT ========== -->
    <section class="main-content">
      <!-- Left: Config Panel -->
      <aside class="config-panel">
        <!-- 排考配置卡片 -->
        <div class="panel-card">
          <div class="panel-title">
            <el-icon><Setting /></el-icon>
            排考配置
          </div>
          <div class="panel-body">
            <!-- 排考策略 -->
            <div class="form-group">
              <label class="form-label">排考策略</label>
              <el-select v-model="config.strategy" placeholder="选择策略" class="full-width">
                <el-option value="full" label="全部课程" />
                <el-option value="public_only" label="仅公共课" />
                <el-option value="major_only" label="仅专业课" />
              </el-select>
            </div>

            <!-- 每教室固定监考人数 -->
            <div class="form-group">
              <label class="form-label">每教室固定监考人数</label>
              <el-radio-group v-model="config.fixedTeachersPerRoom" size="small">
                <el-radio-button :value="1">1人</el-radio-button>
                <el-radio-button :value="2">2人</el-radio-button>
              </el-radio-group>
            </div>

            <!-- 最大求解时间 -->
            <div class="form-group">
              <label class="form-label">最大求解时间（秒）</label>
              <el-input-number
                v-model="config.maxSolveTime"
                :min="30"
                :max="3600"
                :step="30"
                controls-position="right"
                class="full-width"
              />
              <div class="form-hint">建议 120～300 秒</div>
            </div>

            <!-- 流动监考分组规则 -->
            <div class="form-group">
              <label class="form-label">流动监考分组规则</label>
              <div class="patrol-rules">
                <div class="rule-item blue">
                  <span class="rule-dot"></span>
                  <span class="rule-text">分组A：5-2xx教室 + 理东二</span>
                </div>
                <div class="rule-item orange">
                  <span class="rule-dot"></span>
                  <span class="rule-text">分组B：5-3xx教室</span>
                </div>
                <div class="rule-hint">每上午/下午各 {{ config.patrolTeacherCount }} 名流动监考</div>
              </div>
            </div>

            <!-- 教师分配约束 -->
            <div class="form-group">
              <label class="form-label">教师分配约束</label>
              <div class="constraints">
                <div class="constraint-item">
                  <span class="constraint-text">最大监考天数</span>
                  <el-switch v-model="config.enableMaxDaysConstraint" />
                </div>
                <div class="constraint-hint">教师监考天数不超过总排考天数-1</div>
                <div class="constraint-item">
                  <span class="constraint-text">日期连续性</span>
                  <el-switch v-model="config.enableDayContinuityConstraint" />
                </div>
                <div class="constraint-hint">监考日期尽量连续，避免跳天</div>
              </div>
            </div>

            <!-- 按钮组 -->
            <div class="btn-group">
              <el-button class="btn-save" @click="saveConfig" :loading="saving">
                <el-icon><DocumentChecked /></el-icon>
                保存配置
              </el-button>
              <el-button
                type="primary"
                class="btn-start"
                @click="startScheduler"
                :loading="running"
                :disabled="running"
              >
                <el-icon><VideoPlay /></el-icon>
                {{ running ? '排考中...' : '开始自动排考' }}
              </el-button>
            </div>
          </div>
        </div>

        <!-- 进度卡片 -->
        <div class="panel-card progress-card" v-show="running || progressMsgs.length > 0">
          <div class="panel-title">
            <el-icon><Timer /></el-icon>
            排考进度
          </div>
          <div class="panel-body">
            <!-- 进度条 -->
            <div class="progress-wrap">
              <div class="progress-header">
                <span class="progress-label">{{ progressLabel }}</span>
                <span class="progress-percent">{{ progressPercent }}%</span>
              </div>
              <el-progress
                :percentage="progressPercent"
                :stroke-width="8"
                :show-text="false"
                :color="progressColor"
              />
            </div>

            <!-- 日志区域 -->
            <div class="log-area" ref="logArea">
              <div
                v-for="(msg, idx) in progressMsgs"
                :key="idx"
                :class="['log-line', msg.type]"
              >
                <el-icon v-if="msg.type === 'error'" color="#ff5252"><CircleCloseFilled /></el-icon>
                <el-icon v-else-if="msg.type === 'done'" color="#00e676"><CircleCheckFilled /></el-icon>
                <el-icon v-else-if="msg.type === 'success'" color="#00e676"><SuccessFilled /></el-icon>
                <el-icon v-else color="#4fc3f7"><InfoFilled /></el-icon>
                <span class="log-text">{{ msg.text }}</span>
              </div>
            </div>

            <!-- 停止按钮 -->
            <div class="btn-stop" v-if="running">
              <el-button type="danger" @click="stopScheduler" plain>
                <el-icon><VideoPause /></el-icon>
                停止排考
              </el-button>
            </div>
          </div>
        </div>
      </aside>

      <!-- Right: Course Selection -->
      <main class="course-panel">
        <!-- 课程选择卡片 -->
        <div class="panel-card">
          <div class="panel-title">
            <el-icon><List /></el-icon>
            选择排考课程
            <div class="panel-actions">
              <el-input
                v-model="courseFilter"
                placeholder="过滤课程..."
                :prefix-icon="Search"
                clearable
                class="filter-input"
              />
              <el-button-group>
                <el-button size="small" @click="selectAllCourses(true)">
                  <el-icon><Select /></el-icon>
                  全选
                </el-button>
                <el-button size="small" @click="selectAllCourses(false)">
                  <el-icon><Close /></el-icon>
                  取消
                </el-button>
              </el-button-group>
            </div>
          </div>
          <div class="panel-body-full">
            <el-table
              :data="filteredCourses"
              ref="courseTableRef"
              @selection-change="handleSelectionChange"
              stripe
              border
            >
              <el-table-column type="selection" width="50" align="center" />
              <el-table-column prop="course_name" label="课程名称" min-width="180" />
              <el-table-column prop="course_type" label="类型" width="90" align="center">
                <template #default="{ row }">
                  <el-tag :type="row.course_type === 'public' ? 'primary' : 'success'" size="small">
                    {{ row.course_type === 'public' ? '公共课' : '专业课' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="student_count" label="选课人数" width="100" align="center" />
              <el-table-column prop="exam_form" label="考试形式" width="100" align="center">
                <template #default="{ row }">
                  <span>{{ row.needs_ab ? 'AB卷' : '常规' }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="status" label="状态" width="90" align="center">
                <template #default="{ row }">
                  <el-tag :type="row.scheduled ? 'success' : 'info'" size="small">
                    {{ row.scheduled ? '已安排' : '未安排' }}
                  </el-tag>
                </template>
              </el-table-column>
            </el-table>

            <!-- 统计信息 -->
            <div class="course-stats">
              <span class="stat-item">
                <el-icon><Finished /></el-icon>
                已选 {{ selectedCourses.length }} 门课程
              </span>
              <span class="stat-item">
                <el-icon><User /></el-icon>
                共 {{ filteredCourses.length }} 门课程
              </span>
            </div>
          </div>
        </div>

        <!-- 结果卡片 -->
        <div class="panel-card result-card" v-if="resultData">
          <div class="panel-title">
            <el-icon><CircleCheck /></el-icon>
            排考结果
            <span class="result-badge" v-if="resultData.success">
              <el-icon><SuccessFilled /></el-icon>
              成功
            </span>
            <span class="result-badge error" v-else>
              <el-icon><WarningFilled /></el-icon>
              失败
            </span>
          </div>
          <div class="panel-body-full">
            <!-- 结果概览 -->
            <div class="result-overview">
              <div class="result-stat blue">
                <span class="stat-value">{{ resultData.exams_scheduled || 0 }}</span>
                <span class="stat-label">已安排考试</span>
              </div>
              <div class="result-stat green">
                <span class="stat-value">{{ resultData.version_no || '--' }}</span>
                <span class="stat-label">版本号</span>
              </div>
              <div class="result-stat orange">
                <span class="stat-value">{{ resultData.solve_time || '0s' }}</span>
                <span class="stat-label">求解耗时</span>
              </div>
              <div class="result-stat red">
                <span class="stat-value">{{ resultData.violations?.length || 0 }}</span>
                <span class="stat-label">冲突数</span>
              </div>
            </div>

            <!-- 结果表格 -->
            <el-table
              v-if="resultData.exams?.length"
              :data="resultData.exams"
              stripe
              border
            >
              <el-table-column prop="course_name" label="课程" min-width="150" />
              <el-table-column prop="day_name" label="星期" width="80" align="center" />
              <el-table-column prop="slot_code" label="时段" width="70" align="center" />
              <el-table-column prop="time_range" label="时间" width="130" align="center" />
              <el-table-column prop="classroom_name" label="教室" width="90" align="center" />
              <el-table-column prop="teacher_name" label="监考教师" min-width="120" />
              <el-table-column prop="student_count" label="人数" width="70" align="center" />
            </el-table>

            <!-- 操作按钮 -->
            <div class="result-actions">
              <el-button type="primary" @click="viewResults">
                <el-icon><View /></el-icon>
                查看详细结果
              </el-button>
              <el-button @click="applyVersion" v-if="resultData.version_id">
                <el-icon><Check /></el-icon>
                应用此版本
              </el-button>
            </div>
          </div>
        </div>
      </main>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Cpu,
  Setting,
  Timer,
  List,
  VideoPlay,
  VideoPause,
  CircleCheckFilled,
  CircleCloseFilled,
  SuccessFilled,
  WarningFilled,
  InfoFilled,
  DocumentChecked,
  Search,
  Select,
  Close,
  Finished,
  User,
  CircleCheck,
  View,
  Check,
} from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import api from '@/api/index.js'

const router = useRouter()

// ========== CONFIG ==========
const config = ref({
  strategy: 'full',
  fixedTeachersPerRoom: 2,
  maxSolveTime: 300,
  patrolTeacherCount: 2,
  enableMaxDaysConstraint: true,
  enableDayContinuityConstraint: true,
})

const saving = ref(false)

// ========== PROGRESS ==========
const running = ref(false)
const progressMsgs = ref([])
const progressLabel = ref('准备中...')
const progressPercent = ref(0)
const logArea = ref(null)

const progressColor = computed(() => {
  if (progressPercent.value >= 100) return '#00e676'
  if (progressPercent.value >= 50) return '#4fc3f7'
  return '#7c4dff'
})

function addProgressMsg(type, text) {
  progressMsgs.value.push({ type, text })
  nextTick(() => {
    if (logArea.value) {
      logArea.value.scrollTop = logArea.value.scrollHeight
    }
  })
}

// ========== COURSES ==========
const courseFilter = ref('')
const courseTableRef = ref(null)
const courses = ref([])
const selectedCourses = ref([])

const filteredCourses = computed(() => {
  if (!courseFilter.value) return courses.value
  const filter = courseFilter.value.toLowerCase()
  return courses.value.filter(c =>
    c.course_name?.toLowerCase().includes(filter)
  )
})

function handleSelectionChange(selection) {
  selectedCourses.value = selection
}

function selectAllCourses(select) {
  if (!courseTableRef.value) return
  if (select) {
    filteredCourses.value.forEach(course => {
      courseTableRef.value.toggleRowSelection(course, true)
    })
  } else {
    courseTableRef.value.clearSelection()
  }
}

// ========== RESULT ==========
const resultData = ref(null)

// ========== API ==========
async function loadConfig() {
  try {
    const res = await api.get('/scheduler/config')
    if (res.data) {
      config.value.fixedTeachersPerRoom = res.data.fixed_teachers_per_room || 2
      config.value.patrolTeacherCount = res.data.patrol_teacher_count_per_slot_pair || 2
      config.value.enableMaxDaysConstraint = res.data.enable_max_days_constraint ?? true
      config.value.enableDayContinuityConstraint = res.data.enable_day_continuity_constraint ?? true
    }
  } catch (e) {
    console.warn('加载配置失败:', e)
  }
}

async function loadCourses() {
  try {
    const res = await api.get('/courses/')
    const items = res.data?.items || []
    // 适配字段名：API返回的是 name, course_type
    courses.value = items.map(c => ({
      id: c.id,
      course_name: c.name,
      course_type: c.course_type,
      student_count: c.student_count || 0,
      needs_ab: c.needs_ab || false,
      scheduled: c.schedule_status === 'scheduled',
    }))
  } catch (e) {
    console.error('加载课程失败:', e)
    ElMessage.error('加载课程列表失败')
  }
}

async function saveConfig() {
  saving.value = true
  try {
    await api.put('/scheduler/config', {
      fixed_teachers_per_room: config.value.fixedTeachersPerRoom,
      patrol_teacher_count_per_slot_pair: config.value.patrolTeacherCount,
      enable_max_days_constraint: config.value.enableMaxDaysConstraint,
      enable_day_continuity_constraint: config.value.enableDayContinuityConstraint,
    })
    ElMessage.success('配置已保存')
  } catch (e) {
    ElMessage.error('保存配置失败')
  } finally {
    saving.value = false
  }
}

async function startScheduler() {
  if (selectedCourses.value.length === 0) {
    ElMessage.warning('请先选择要排考的课程')
    return
  }

  running.value = true
  progressMsgs.value = []
  resultData.value = null
  progressPercent.value = 0
  progressLabel.value = '正在初始化...'
  addProgressMsg('info', '开始排考初始化...')

  try {
    // 保存配置
    await saveConfig()

    addProgressMsg('info', '正在加载排考数据...')
    progressLabel.value = '加载数据...'
    progressPercent.value = 10

    const courseIds = selectedCourses.value.map(c => c.id)
    addProgressMsg('info', `已选择 ${courseIds.length} 门课程，开始求解...`)
    progressLabel.value = '求解中...'
    progressPercent.value = 20

    const response = await fetch('/api/scheduler/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        course_ids: courseIds,
        strategy: config.value.strategy,
      }),
    })

    progressPercent.value = 90
    progressLabel.value = '处理结果...'
    addProgressMsg('info', '正在处理排考结果...')

    const result = await response.json()

    if (result.code === 0 && result.data) {
      const job = result.data
      if (job.status === 'completed' || job.status === 'completed_with_violations') {
        progressLabel.value = '排考完成'
        progressPercent.value = 100
        addProgressMsg('done', '排考完成！')
        if (job.result) {
          resultData.value = job.result
          addProgressMsg('success', `已安排 ${job.result.exams_scheduled} 场考试`)
          addProgressMsg('info', `求解耗时: ${job.result.solve_time}`)
          if (job.result.violations?.length > 0) {
            addProgressMsg('error', `存在 ${job.result.violations.length} 个冲突`)
          }
        }
        ElMessage.success('排考完成！')
      } else if (job.status === 'failed') {
        addProgressMsg('error', job.error || '排考失败')
        ElMessage.error(job.error || '排考失败')
      } else {
        addProgressMsg('info', `任务状态: ${job.status}`)
      }
    } else {
      addProgressMsg('error', result.message || '排考请求失败')
      ElMessage.error(result.message || '排考请求失败')
    }
  } catch (e) {
    addProgressMsg('error', `排考失败: ${e.message}`)
    ElMessage.error(`排考失败: ${e.message}`)
  } finally {
    running.value = false
  }
}

function stopScheduler() {
  // 后端是同步执行，无法真正停止
  running.value = false
  addProgressMsg('error', '排考任务无法停止')
  ElMessage.warning('排考任务无法停止，请等待完成')
}

function viewResults() {
  router.push('/results')
}

async function applyVersion() {
  if (!resultData.value?.version_id) return
  try {
    await api.post(`/scheduler/apply/${resultData.value.version_id}`)
    ElMessage.success('版本已应用')
  } catch (e) {
    ElMessage.error('应用版本失败')
  }
}

// ========== LIFECYCLE ==========
onMounted(() => {
  loadConfig()
  loadCourses()
})
</script>

<style scoped>
.scheduler-view {
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
  overflow: hidden;
}

.scheduler-view::before {
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

/* 扫光特效 */
.scheduler-view::after {
  content: '';
  position: absolute;
  top: -50%;
  left: -60%;
  width: 200%;
  height: 200%;
  background: linear-gradient(
    115deg,
    transparent 30%,
    rgba(124, 77, 255, 0.07) 45%,
    rgba(124, 77, 255, 0.12) 50%,
    rgba(124, 77, 255, 0.07) 55%,
    transparent 70%
  );
  transform: rotate(25deg);
  animation: sweepLight 6s infinite linear;
  pointer-events: none;
  z-index: 0;
}

@keyframes sweepLight {
  0% { transform: rotate(25deg) translateX(-30%) translateY(-30%); }
  100% { transform: rotate(25deg) translateX(30%) translateY(30%); }
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
.header-icon {
  color: var(--accent);
}
.header-title {
  font-size: 1.4rem;
  font-weight: 700;
  letter-spacing: 4px;
  background: linear-gradient(90deg, #4fc3f7, #7c4dff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.header-tag {
  font-size: 0.75rem;
  padding: 4px 12px;
  background: rgba(124, 77, 255, 0.2);
  border: 1px solid rgba(124, 77, 255, 0.4);
  border-radius: 20px;
  color: #7c4dff;
}

/* Main Content */
.main-content {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 20px;
  position: relative;
  z-index: 1;
}

/* Panel Card */
.panel-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
}
.panel-title {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  font-size: 0.95rem;
  font-weight: 600;
  background: rgba(79,195,247,0.05);
  border-bottom: 1px solid var(--border);
  color: var(--accent);
}
.panel-body {
  padding: 18px;
}
.panel-body-full {
  padding: 0;
}

/* Config Panel */
.config-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Form Groups */
.form-group {
  margin-bottom: 16px;
}
.form-group:last-child {
  margin-bottom: 0;
}
.form-label {
  display: block;
  font-size: 0.8rem;
  color: var(--text-dim);
  margin-bottom: 8px;
  letter-spacing: 0.5px;
}
.form-hint {
  font-size: 0.75rem;
  color: var(--text-dim);
  margin-top: 4px;
}
.full-width {
  width: 100%;
}

/* Patrol Rules */
.patrol-rules {
  background: rgba(79,195,247,0.05);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
}
.rule-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 0.8rem;
}
.rule-item:last-child {
  margin-bottom: 0;
}
.rule-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.rule-item.blue .rule-dot { background: #4fc3f7; }
.rule-item.orange .rule-dot { background: #ff9100; }
.rule-hint {
  font-size: 0.7rem;
  color: var(--text-dim);
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--border);
}

/* Constraints */
.constraints {
  background: rgba(124,77,255,0.05);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
}
.constraint-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.constraint-text {
  font-size: 0.85rem;
  color: var(--text);
}
.constraint-hint {
  font-size: 0.7rem;
  color: var(--text-dim);
  padding-left: 4px;
  margin-bottom: 8px;
}

/* Button Group */
.btn-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 20px;
}
.btn-save {
  width: 100%;
  justify-content: center;
  background: rgba(100,140,255,0.1);
  border-color: rgba(100,140,255,0.3);
  color: var(--text);
}
.btn-save:hover {
  background: rgba(100,140,255,0.2);
  border-color: rgba(100,140,255,0.5);
}
.btn-start {
  width: 100%;
  justify-content: center;
  background: linear-gradient(135deg, #4fc3f7, #7c4dff);
  border: none;
  font-weight: 600;
  padding: 12px 20px;
}
.btn-start:hover {
  opacity: 0.9;
}

/* Progress Card */
.progress-card {
  margin-top: 0;
}
.progress-wrap {
  margin-bottom: 12px;
}
.progress-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 0.8rem;
}
.progress-label {
  color: var(--text-dim);
}
.progress-percent {
  color: var(--accent);
  font-weight: 600;
}

/* Log Area */
.log-area {
  background: rgba(10,14,39,0.6);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px;
  max-height: 180px;
  overflow-y: auto;
  font-size: 0.8rem;
  font-family: 'Consolas', 'Monaco', monospace;
}
.log-line {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 3px 0;
  color: var(--text-dim);
}
.log-line.done { color: var(--green); }
.log-line.error { color: var(--red); }
.log-line.success { color: var(--green); }
.log-text {
  flex: 1;
  word-break: break-all;
}
.btn-stop {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

/* Course Panel */
.course-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.course-panel > .panel-card:first-child {
  flex: 1;
}
.panel-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}
.filter-input {
  width: 180px;
}

/* Course Stats */
.course-stats {
  display: flex;
  gap: 20px;
  padding: 12px 18px;
  background: rgba(79,195,247,0.05);
  border-top: 1px solid var(--border);
  font-size: 0.8rem;
  color: var(--text-dim);
}
.stat-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Result Card */
.result-card {
  border-color: rgba(0,230,118,0.3);
}
.result-card .panel-title {
  color: var(--green);
  background: rgba(0,230,118,0.05);
}
.result-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 10px;
  padding: 2px 10px;
  background: rgba(0,230,118,0.2);
  border-radius: 12px;
  font-size: 0.75rem;
  color: var(--green);
}
.result-badge.error {
  background: rgba(255,82,82,0.2);
  color: var(--red);
}

/* Result Overview */
.result-overview {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--border);
}
.result-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px;
  background: rgba(255,255,255,0.03);
  border-radius: 10px;
  border: 1px solid var(--border);
}
.result-stat.blue .stat-value { color: var(--accent); }
.result-stat.green .stat-value { color: var(--green); }
.result-stat.orange .stat-value { color: var(--orange); }
.result-stat.red .stat-value { color: var(--red); }
.stat-value {
  font-size: 1.4rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.stat-label {
  font-size: 0.7rem;
  color: var(--text-dim);
  margin-top: 4px;
}

/* Result Actions */
.result-actions {
  display: flex;
  gap: 12px;
  padding: 14px 18px;
  border-top: 1px solid var(--border);
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: rgba(255,255,255,0.05);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb {
  background: rgba(100,140,255,0.3);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(100,140,255,0.5);
}

/* Element Plus Dark Override */
:deep(.el-table) {
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
  --el-table-header-bg-color: rgba(79,195,247,0.1);
  --el-table-row-hover-bg-color: rgba(79,195,247,0.08);
  --el-table-row-stripe-bg-color: rgba(79,195,247,0.04);
  --el-table-border-color: rgba(100,140,255,0.15);
  --el-table-text-color: var(--text);
  --el-table-header-text-color: var(--text);
  --el-fill-color-lighter: rgba(79,195,247,0.04);
}
:deep(.el-table__body tr td) {
  background: transparent !important;
  color: var(--text) !important;
  border-color: rgba(100,140,255,0.15) !important;
}
:deep(.el-table--striped .el-table__body tr.el-table__row--striped td) {
  background: rgba(79,195,247,0.04) !important;
}
:deep(.el-table__body tr:hover > td) {
  background: rgba(79,195,247,0.08) !important;
}
:deep(.el-table th.el-table__cell) {
  background: rgba(79,195,247,0.1) !important;
  color: var(--text) !important;
  border-color: rgba(100,140,255,0.15) !important;
}
:deep(.el-table__empty-text) {
  color: var(--text-dim);
}

:deep(.el-input__wrapper) {
  background: rgba(255,255,255,0.08);
  border-color: var(--border);
  box-shadow: none;
}
:deep(.el-input__inner) {
  color: var(--text);
}
:deep(.el-input-number .el-input__wrapper) {
  background: rgba(255,255,255,0.08);
}
:deep(.el-select .el-input__wrapper) {
  background: rgba(255,255,255,0.08);
}
:deep(.el-radio-button__inner) {
  background: rgba(255,255,255,0.08);
  border-color: var(--border);
  color: var(--text);
}
:deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  background: linear-gradient(135deg, #4fc3f7, #7c4dff);
  border-color: transparent;
  color: #fff;
}
:deep(.el-progress-bar__outer) {
  background: rgba(255,255,255,0.1);
}
:deep(.el-tag) {
  border-color: var(--border);
}
:deep(.el-button) {
  border-color: var(--border);
  color: var(--text);
}
:deep(.el-button--primary) {
  background: linear-gradient(135deg, #4fc3f7, #7c4dff);
  border: none;
}
</style>
