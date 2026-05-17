<template>
  <div class="dashboard-view">
    <!-- 页面标题 + 快捷操作 -->
    <div class="page-header">
      <h2 class="page-title">仪表盘</h2>
      <div class="header-actions">
        <el-button type="primary" @click="handleQuickSchedule">
          <el-icon><MagicStick /></el-icon>
          一键排考
        </el-button>
        <el-button type="success" @click="handleExportExcel">
          <el-icon><DocumentAdd /></el-icon>
          导出 Excel
        </el-button>
      </div>
    </div>

    <!-- AI 聊天面板 -->
    <el-card class="chat-panel mb-4" :body-style="{ padding: 0 }">
      <template #header>
        <div class="chat-header" @click="chatExpanded = !chatExpanded">
          <div class="chat-header-left">
            <el-icon :size="18"><ChatDotRound /></el-icon>
            <span class="font-semibold text-sm">排考小助手</span>
          </div>
          <div class="chat-header-right">
            <span class="text-xs text-blue-100">{{ chatExpanded ? '点击折叠' : '点击展开' }}</span>
            <el-icon :size="12" :class="{ 'is-rotate': chatExpanded }">
              <ArrowDown />
            </el-icon>
          </div>
        </div>
      </template>

      <div v-show="chatExpanded" class="chat-body">
        <!-- 消息区 -->
        <div class="chat-messages" ref="messageContainer">
          <!-- 欢迎语 -->
          <div v-if="messages.length === 0" class="chat-welcome">
            <div class="welcome-bubble">
              <div class="flex items-start gap-2">
                <el-icon :size="16" class="text-blue-500 mt-0.5"><ChatDotRound /></el-icon>
                <div>
                  <div class="text-sm text-gray-700 mb-2">你好！我是排考小助手，可以帮你查询考场信息。</div>
                  <div class="text-xs text-gray-400 mb-1">你可以这样问我：</div>
                  <div class="space-y-1">
                    <div
                      v-for="prompt in quickPrompts"
                      :key="prompt"
                      class="quick-prompt"
                      @click="sendQuickPrompt(prompt)"
                    >
                      <el-icon :size="12"><Search /></el-icon>
                      {{ prompt }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 消息列表 -->
          <div
            v-for="(msg, idx) in messages"
            :key="idx"
            :class="['chat-message', msg.role]"
          >
            <div class="message-bubble" :class="msg.role">
              <div v-if="msg.role === 'assistant'" class="flex items-start gap-2">
                <el-icon :size="16" class="text-blue-500 mt-0.5"><ChatDotRound /></el-icon>
                <!-- tool_result 类型：渲染 HTML 表格 -->
                <div
                  v-if="msg.type === 'tool_result'"
                  class="text-sm text-gray-700 tool-result"
                  v-html="msg.html"
                ></div>
                <!-- 普通文本 -->
                <div v-else class="text-sm text-gray-700 whitespace-pre-wrap">{{ msg.content }}</div>
              </div>
              <div v-else class="text-sm text-white text-right whitespace-pre-wrap">{{ msg.content }}</div>
            </div>
          </div>

          <!-- 正在输入指示器 -->
          <div v-if="chatLoading" class="chat-message assistant">
            <div class="message-bubble assistant">
              <div class="flex items-center gap-2">
                <el-icon :size="16" class="text-blue-500"><ChatDotRound /></el-icon>
                <div class="typing-indicator">
                  <span></span><span></span><span></span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 输入区 -->
        <div class="chat-input-area">
          <el-input
            v-model="chatInput"
            placeholder="输入问题，例如：查询周一上午的空闲教室..."
            @keyup.enter="sendMessage"
            :disabled="chatLoading"
            clearable
          >
            <template #append>
              <el-button
                :disabled="chatLoading || !chatInput.trim()"
                @click="sendMessage"
                type="primary"
                :icon="Promotion"
              >
                发送
              </el-button>
            </template>
          </el-input>
        </div>
      </div>
    </el-card>

    <!-- 统计概览（可折叠） -->
    <el-card class="mb-4 overview-card" :body-style="{ padding: 0 }">
      <template #header>
        <div class="section-header" @click="overviewExpanded = !overviewExpanded">
          <div class="flex items-center gap-2 text-white">
            <el-icon :size="16"><DataAnalysis /></el-icon>
            <span class="font-semibold text-sm">统计概览</span>
          </div>
          <el-icon :size="12" class="text-white" :class="{ 'is-rotate': overviewExpanded }">
            <ArrowDown />
          </el-icon>
        </div>
      </template>

      <div v-show="overviewExpanded" class="p-4">
        <div class="stats-grid">
          <div class="stat-card" v-for="stat in statsConfig" :key="stat.key">
            <div class="stat-icon" :style="{ background: stat.bgColor }">
              <el-icon :size="24" :color="stat.iconColor"><component :is="stat.icon" /></el-icon>
            </div>
            <div>
              <div class="stat-value">{{ stats[stat.key] ?? '--' }}</div>
              <div class="stat-label">{{ stat.label }}</div>
            </div>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 快捷操作卡片 -->
    <el-card class="mb-4" :body-style="{ padding: '16px' }">
      <template #header>
        <span class="font-semibold text-sm text-gray-700">快捷操作</span>
      </template>
      <div class="quick-actions">
        <el-button
          v-for="action in quickActions"
          :key="action.label"
          :type="action.type"
          @click="action.handler"
          size="large"
        >
          <el-icon><component :is="action.icon" /></el-icon>
          {{ action.label }}
        </el-button>
      </div>
    </el-card>

    <!-- 最近活动（占位） -->
    <el-card :body-style="{ padding: '16px' }">
      <template #header>
        <span class="font-semibold text-sm text-gray-700">最近活动</span>
      </template>
      <div class="empty-state">
        <el-icon :size="48" class="text-gray-300"><List /></el-icon>
        <p class="text-gray-400 text-sm mt-2">暂无活动记录</p>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import {
  MagicStick,
  DocumentAdd,
  ChatDotRound,
  ArrowDown,
  DataAnalysis,
  Search,
  Promotion,
  List,
  User,
  OfficeBuilding,
  Reading,
  Document,
  TrendCharts,
  Edit,
  Upload,
  VideoPlay,
} from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import api from '@/api/index.js'

const router = useRouter()
const messageContainer = ref(null)

// ------- 折叠状态 -------
const chatExpanded = ref(false)
const overviewExpanded = ref(true)

// ------- 统计卡片 -------
const stats = ref({
  teacherCount: 0,
  classroomCount: 0,
  courseCount: 0,
  studentCount: 0,
  examCount: 0,
  versionCount: 0,
})

const statsConfig = [
  { key: 'teacherCount',   label: '教师总数',   icon: User,           bgColor: '#DBEAFE', iconColor: '#3B82F6' },
  { key: 'classroomCount', label: '教室总数',   icon: OfficeBuilding, bgColor: '#D1FAE5', iconColor: '#10B981' },
  { key: 'courseCount',    label: '课程总数',   icon: Reading,        bgColor: '#FEF3C7', iconColor: '#F59E0B' },
  { key: 'studentCount',   label: '学生总数',   icon: Document,       bgColor: '#DBEAFE', iconColor: '#3B82F6' },
  { key: 'examCount',     label: '已排考试',   icon: TrendCharts,    bgColor: '#FEE2E2', iconColor: '#EF4444' },
  { key: 'versionCount',  label: '排考版本',   icon: List,           bgColor: '#E0E7FF', iconColor: '#6366F1' },
]

async function loadStats() {
  try {
    const [teachers, classrooms, courses, students, versions, exams] = await Promise.all([
      api.get('/teachers/', { params: { page: 1, page_size: 1 } }).catch(() => ({})),
      api.get('/classrooms/', { params: { page: 1, page_size: 1 } }).catch(() => ({})),
      api.get('/courses/', { params: { page: 1, page_size: 1 } }).catch(() => ({})),
      api.get('/students/', { params: { page: 1, page_size: 1 } }).catch(() => ({})),
      api.get('/scheduler/versions', { params: { page: 1, page_size: 1 } }).catch(() => ({})),
      api.get('/exams/', { params: { page: 1, page_size: 1 } }).catch(() => ({})),
    ])
    stats.value = {
      teacherCount:  teachers.total ?? 0,
      classroomCount: classrooms.total ?? 0,
      courseCount:    courses.total ?? 0,
      studentCount:   students.total ?? 0,
      versionCount:   versions.total ?? 0,
      examCount:      exams.total ?? 0,
    }
  } catch (e) {
    console.error('加载统计失败:', e)
  }
}

// ------- 快捷操作 -------
const quickActions = [
  { label: '开始排考',   type: 'primary',   icon: VideoPlay,   handler: () => router.push('/scheduler') },
  { label: '查看结果',   type: 'success',   icon: TrendCharts, handler: () => router.push('/results') },
  { label: '手动微调',   type: 'warning',   icon: Edit,        handler: () => router.push('/adjustments') },
  { label: '导入数据',   type: 'info',      icon: Upload,      handler: () => router.push('/import-export') },
  { label: '基础数据',   type: '',          icon: OfficeBuilding, handler: () => router.push('/base-data') },
]

// ------- 聊天功能 -------
const chatInput = ref('')
const chatLoading = ref(false)
const messages = ref([])

const quickPrompts = [
  '查询所有教室状态',
  '周一上午有哪些教室空闲？',
  '5-320教室排了什么考试？',
]

function sendQuickPrompt(prompt) {
  chatInput.value = prompt
  sendMessage()
}

async function sendMessage() {
  const input = chatInput.value.trim()
  if (!input || chatLoading.value) return

  messages.value.push({ role: 'user', content: input })
  chatInput.value = ''
  chatLoading.value = true

  await nextTick()
  scrollToBottom()

  try {
    const response = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'default',
        messages: [{ role: 'user', content: input }],
      }),
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let assistantText = ''

    messages.value.push({ role: 'assistant', type: 'text', content: '' })

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue

        const data = trimmed.slice(5).trim()
        if (!data || data === '[DONE]') continue

        try {
          const parsed = JSON.parse(data)

          if (parsed.type === 'done') {
            break
          } else if (parsed.type === 'error') {
            throw new Error(parsed.content)
          } else if (parsed.type === 'tool_result') {
            const html = renderToolResult(parsed.tool, parsed.data)
            messages.value.push({
              role: 'assistant',
              type: 'tool_result',
              tool: parsed.tool,
              html,
            })
          } else if (parsed.type === 'text') {
            assistantText += parsed.content
            updateLastTextMessage(assistantText)
          }
        } catch (e) {
          if (e.message && !e.message.includes('JSON')) throw e
        }
      }

      await nextTick()
      scrollToBottom()
    }

    // 处理残留 buffer
    if (buffer.trim().startsWith('data:')) {
      const data = buffer.trim().slice(5).trim()
      if (data && data !== '[DONE]') {
        try {
          const parsed = JSON.parse(data)
          if (parsed.type === 'text') {
            assistantText += parsed.content
            updateLastTextMessage(assistantText)
          }
        } catch (e) { /* ignore */ }
      }
    }
  } catch (e) {
    messages.value.push({ role: 'assistant', type: 'text', content: `⚠️ 请求失败：${e.message}` })
  } finally {
    chatLoading.value = false
    await nextTick()
    scrollToBottom()
  }
}

/** 更新最后一条 text 类型助手消息 */
function updateLastTextMessage(text) {
  for (let i = messages.value.length - 1; i >= 0; i--) {
    if (messages.value[i].role === 'assistant' && messages.value[i].type !== 'tool_result') {
      messages.value[i].content = text
      break
    }
  }
}

// ------- HTML 转义工具 -------
function escapeHtml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// ------- tool_result 渲染 -------
function renderToolResult(toolName, data) {
  if (toolName === 'query_classrooms') {
    return renderClassroomTable(data)
  } else if (toolName === 'query_teacher_assignments') {
    return renderTeacherAssignments(data)
  } else {
    return `<pre class="text-xs">${escapeHtml(JSON.stringify(data, null, 2))}</pre>`
  }
}

/** 渲染教室查询结果 */
function renderClassroomTable(data) {
  const query = data.query || {}
  const dayLabel = query.day_name || '全部'
  const slotLabel = query.slot_code || '全部'

  let html = `<div class="mb-4">`
  html += `<div class="flex items-center gap-3 mb-3">`
  html += `<span class="text-sm font-medium text-gray-600">${dayLabel} ${slotLabel}</span>`
  html += `</div>`
  html += `<div class="flex flex-wrap gap-2">`
  html += `<span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700">`
  html += `<i class="fas fa-building mr-1"></i> 总 ${data.total_classrooms || 0} 间`
  html += `</span>`
  html += `<span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-50 text-red-700">`
  html += `<i class="fas fa-lock mr-1"></i> 已占用 ${data.occupied_count || 0} 间`
  html += `</span>`
  html += `<span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-50 text-green-700">`
  html += `<i class="fas fa-check-circle mr-1"></i> 空闲 ${data.free_count || 0} 间`
  html += `</span>`
  html += `</div></div>`

  // 已占用教室表格
  if (data.occupied && data.occupied.length > 0) {
    html += `<div class="mb-5">`
    html += `<div class="text-sm font-semibold text-red-700 mb-2 flex items-center gap-1"><i class="fas fa-lock"></i> 已占用教室</div>`
    html += `<div class="overflow-x-auto rounded-lg border border-red-200">`
    html += `<table class="w-full text-sm" style="min-width:900px;">`
    html += `<thead><tr class="bg-red-50 text-red-700">`
    html += `<th class="px-4 py-2 text-left font-semibold">教室</th>`
    html += `<th class="px-4 py-2 text-center font-semibold" style="width:90px;">类型</th>`
    html += `<th class="px-4 py-2 text-left font-semibold">考试科目</th>`
    html += `<th class="px-4 py-2 text-left font-semibold" style="width:170px;">考试时间</th>`
    html += `<th class="px-4 py-2 text-left font-semibold">涉考班级</th>`
    html += `<th class="px-4 py-2 text-center font-semibold" style="width:80px;">人数</th>`
    html += `<th class="px-4 py-2 text-left font-semibold">固定监考</th>`
    html += `<th class="px-4 py-2 text-left font-semibold">流动监考</th>`
    html += `</tr></thead><tbody>`

    for (const c of data.occupied) {
      const courseText = (c.exams || []).map(e => {
        let s = escapeHtml(e.course || '')
        if (e.exam_label) {
          const cls = e.exam_label === 'A' ? 'text-blue-600' : 'text-orange-600'
          s += ` <span class="font-medium ${cls}">(${e.exam_label})</span>`
        }
        return s
      }).join('<br>')

      const timeText = (c.exams || []).map(e => escapeHtml(e.time_str || '')).join('<br>')
      const classesText = (c.exams || []).map(e => {
        if (!e.classes) return ''
        return e.classes.map(cls => escapeHtml(cls)).join(', ')
      }).join('<br>')
      const studentsText = (c.exams || []).map(e => (e.students || 0) + '人').join('<br>')
      const fixedTeacherText = (c.exams || []).map(e => {
        if (!e.fixed_teachers) return ''
        return e.fixed_teachers.map(t => escapeHtml(t)).join(', ')
      }).join('<br>')
      const patrolTeacherText = (c.exams || []).map(e => {
        if (!e.patrol_teachers) return ''
        return e.patrol_teachers.map(t => escapeHtml(t)).join(', ')
      }).join('<br>')

      html += `<tr class="border-t border-red-100 hover:bg-red-50/50">`
      html += `<td class="px-4 py-2.5 font-medium text-gray-800">${escapeHtml(c.name || '')}</td>`
      html += `<td class="px-4 py-2.5 text-center"><span class="inline-block px-2 py-0.5 rounded text-xs font-medium ${c.type === 'Lecture' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}">${escapeHtml(c.type || '')}</span></td>`
      html += `<td class="px-4 py-2.5 text-gray-700 text-sm">${courseText}</td>`
      html += `<td class="px-4 py-2.5 text-sm text-gray-600">${timeText}</td>`
      html += `<td class="px-4 py-2.5 text-sm text-gray-600">${classesText}</td>`
      html += `<td class="px-4 py-2.5 text-center text-gray-500 text-sm">${studentsText}</td>`
      html += `<td class="px-4 py-2.5 text-sm text-gray-800">${fixedTeacherText}</td>`
      html += `<td class="px-4 py-2.5 text-sm text-gray-800">${patrolTeacherText}</td>`
      html += `</tr>`
    }

    html += `</tbody></table></div></div>`
  }

  // 空闲教室表格
  if (data.free && data.free.length > 0) {
    html += `<div class="mb-3">`
    html += `<div class="text-sm font-semibold text-green-700 mb-2 flex items-center gap-1"><i class="fas fa-check-circle"></i> 空闲教室</div>`
    html += `<div class="overflow-x-auto rounded-lg border border-green-200">`
    html += `<table class="w-full text-sm" style="min-width:400px;">`
    html += `<thead><tr class="bg-green-50 text-green-700">`
    html += `<th class="px-4 py-2 text-left font-semibold">教室</th>`
    html += `<th class="px-4 py-2 text-center font-semibold" style="width:90px;">类型</th>`
    html += `</tr></thead><tbody>`

    for (const c of data.free) {
      html += `<tr class="border-t border-green-100 hover:bg-green-50/50">`
      html += `<td class="px-4 py-2.5 font-medium text-gray-800">${escapeHtml(c.name || '')}</td>`
      html += `<td class="px-4 py-2.5 text-center"><span class="inline-block px-2 py-0.5 rounded text-xs font-medium ${c.type === 'Lecture' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}">${escapeHtml(c.type || '')}</span></td>`
      html += `</tr>`
    }

    html += `</tbody></table></div></div>`
  }

  if ((!data.occupied || data.occupied.length === 0) && (!data.free || data.free.length === 0)) {
    html += '<div class="text-sm text-gray-400 py-6 text-center"><i class="fas fa-inbox text-2xl mb-2"></i><p>暂无教室数据</p></div>'
  }

  return html
}

/** 渲染教师监考安排 */
function renderTeacherAssignments(data) {
  if (!data.found) {
    return `<div class="text-sm text-gray-400 py-6 text-center"><i class="fas fa-user-slash text-2xl mb-2"></i><p>${escapeHtml(data.message || '未找到教师')}</p></div>`
  }

  const query = data.query || {}
  const dayLabel = query.day_name || '全部'

  const teachers = data.teachers || [{
    teacher: data.teacher,
    assignments: data.assignments,
    patrol_slots: data.patrol_slots,
    total_assignments: data.total_assignments,
  }]

  let html = `<div class="mb-4">`

  if (teachers.length > 1) {
    const totalTeachers = teachers.length
    const teachersWithAssignments = teachers.filter(t =>
      (t.assignments && t.assignments.length > 0) || (t.patrol_slots && t.patrol_slots.length > 0)
    ).length
    html += `<div class="flex items-center gap-3 mb-3">`
    html += `<span class="text-sm font-medium text-gray-600">共找到 ${totalTeachers} 位教师，${teachersWithAssignments} 位有监考安排（${dayLabel}）</span>`
    html += `</div>`
  }

  for (let i = 0; i < teachers.length; i++) {
    const tData = teachers[i]
    const teacher = tData.teacher || {}
    const assignments = tData.assignments || []
    const patrolSlots = tData.patrol_slots || []
    const hasAssignments = assignments.length > 0 || patrolSlots.length > 0

    if (i > 0) {
      html += `<hr class="my-4 border-gray-200">`
    }

    // 教师信息卡片
    html += `<div class="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-100">`
    html += `<div class="flex flex-wrap gap-4 text-sm">`
    html += `<span class="inline-flex items-center gap-1 text-gray-600"><i class="fas fa-user"></i> ${escapeHtml(teacher.name || '')}</span>`
    html += `<span class="inline-flex items-center gap-1 text-gray-600"><i class="fas fa-tag"></i> ${teacher.teacher_type === 'full_time' ? '专任' : '兼职'}</span>`
    html += `<span class="inline-flex items-center gap-1 text-gray-600"><i class="fas fa-clipboard-check"></i> 已排 ${teacher.current_slots || 0}/${teacher.max_slots || 0} 场</span>`
    html += `</div></div>`

    // 考试监考安排表格
    if (assignments.length > 0) {
      html += `<div class="mb-4">`
      html += `<div class="text-sm font-semibold text-blue-700 mb-2 flex items-center gap-1"><i class="fas fa-chalkboard-teacher"></i> 考试监考安排</div>`
      html += `<div class="overflow-x-auto rounded-lg border border-blue-200">`
      html += `<table class="w-full text-sm">`
      html += `<thead><tr class="bg-blue-50 text-blue-700">`
      html += `<th class="px-4 py-2 text-left font-semibold">考试课程</th>`
      html += `<th class="px-4 py-2 text-left font-semibold">时间</th>`
      html += `<th class="px-4 py-2 text-center font-semibold">角色</th>`
      html += `<th class="px-4 py-2 text-left font-semibold">教室</th>`
      html += `<th class="px-4 py-2 text-left font-semibold">涉考班级</th>`
      html += `<th class="px-4 py-2 text-center font-semibold">人数</th>`
      html += `<th class="px-4 py-2 text-left font-semibold">流动分组</th>`
      html += `</tr></thead><tbody>`

      for (const a of assignments) {
        const examLabel = a.exam_label ? `<span class="font-medium ${a.exam_label === 'A' ? 'text-blue-600' : 'text-orange-600'}">(${a.exam_label})</span>` : ''
        const classNames = (a.class_names || []).map(n => escapeHtml(n)).join('、')
        html += `<tr class="border-t border-blue-100 hover:bg-blue-50/50">`
        html += `<td class="px-4 py-2.5 font-medium text-gray-800">${escapeHtml(a.course_name || '')} ${examLabel}</td>`
        html += `<td class="px-4 py-2.5 text-gray-600">${escapeHtml(a.day_name || '')} ${escapeHtml(a.time_str || '')}</td>`
        html += `<td class="px-4 py-2.5 text-center"><span class="inline-block px-2 py-0.5 rounded text-xs font-medium ${a.role === '固定监考' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}">${a.role || ''}</span></td>`
        html += `<td class="px-4 py-2.5 text-gray-600">${a.classroom ? escapeHtml(a.classroom) : '<span class="text-gray-400">-</span>'}</td>`
        html += `<td class="px-4 py-2.5 text-gray-600">${classNames || '<span class="text-gray-400">-</span>'}</td>`
        html += `<td class="px-4 py-2.5 text-center text-gray-600">${a.total_students ? a.total_students : '<span class="text-gray-400">-</span>'}</td>`
        html += `<td class="px-4 py-2.5 text-gray-600">${a.patrol_group ? escapeHtml(a.patrol_group) : '<span class="text-gray-400">-</span>'}</td>`
        html += `</tr>`
      }

      html += `</tbody></table></div></div>`
    }

    // 流动监考时段
    if (patrolSlots.length > 0) {
      html += `<div class="mb-3">`
      html += `<div class="text-sm font-semibold text-orange-700 mb-2 flex items-center gap-1"><i class="fas fa-walking"></i> 流动监考时段</div>`
      html += `<div class="flex flex-wrap gap-2">`
      for (const p of patrolSlots) {
        html += `<span class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-orange-50 text-orange-700 border border-orange-200">`
        html += `<i class="fas fa-clock"></i> ${escapeHtml(p.day_name || '')} ${escapeHtml(p.time_str || '')}`
        html += `</span>`
      }
      html += `</div></div>`
    }

    if (!hasAssignments) {
      html += '<div class="text-sm text-gray-400 py-4 text-center"><i class="fas fa-inbox text-xl mb-2"></i><p>暂无监考安排</p></div>'
    }
  }

  html += `</div>`
  return html
}

function scrollToBottom() {
  const el = messageContainer.value
  if (el) el.scrollTop = el.scrollHeight
}

// ------- 快捷按钮处理 -------
function handleQuickSchedule() {
  router.push('/scheduler')
}

async function handleExportExcel() {
  try {
    const res = await fetch('/api/export/excel')
    if (!res.ok) throw new Error('导出失败')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '排考结果.xlsx'
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch (e) {
    ElMessage.error(`导出失败：${e.message}`)
  }
}

// ------- 生命周期 -------
onMounted(() => {
  loadStats()
})
</script>

<style scoped>
.dashboard-view {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

/* 页面标题栏 */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}
.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1F2937;
}
.header-actions {
  display: flex;
  gap: 12px;
}

/* 聊天面板 */
.chat-panel {
  border: 1px solid #BFDBFE;
  background: linear-gradient(to bottom, #EFF6FF, white);
}
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: linear-gradient(135deg, #3B82F6, #6366F1);
  color: white;
  cursor: pointer;
  user-select: none;
}
.chat-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.chat-header-right {
  display: flex;
  align-items: center;
  gap: 6px;
}
.is-rotate {
  transform: rotate(180deg);
  transition: transform 0.2s;
}

.chat-body {
  display: flex;
  flex-direction: column;
  height: 400px;
}
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: #F9FAFB;
}

/* 欢迎气泡 */
.chat-welcome {
  display: flex;
  justify-content: flex-start;
}
.welcome-bubble {
  max-width: 95%;
  padding: 12px 16px;
  border-radius: 12px;
  border-bottom-left-radius: 4px;
  background: white;
  border: 1px solid #DBEAFE;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}

/* 消息气泡 */
.chat-message {
  display: flex;
}
.chat-message.user {
  justify-content: flex-end;
}
.chat-message.assistant {
  justify-content: flex-start;
}
.message-bubble {
  max-width: 80%;
  padding: 10px 14px;
  border-radius: 12px;
  word-break: break-word;
}
.message-bubble.user {
  background: #3B82F6;
  color: white;
  border-bottom-right-radius: 4px;
}
.message-bubble.assistant {
  background: white;
  border: 1px solid #E5E7EB;
  border-bottom-left-radius: 4px;
}

/* tool_result 表格样式 */
.tool-result {
  width: 100%;
  overflow-x: auto;
}
.tool-result table {
  width: 100%;
  border-collapse: collapse;
}
.tool-result th, .tool-result td {
  padding: 8px 12px;
  text-align: left;
  font-size: 13px;
}
.tool-result th {
  font-weight: 600;
}

/* 打字指示器 */
.typing-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
}
.typing-indicator span {
  width: 6px;
  height: 6px;
  background: #9CA3AF;
  border-radius: 50%;
  animation: typing 1.2s infinite;
}
.typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
@keyframes typing {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-6px); opacity: 1; }
}

/* 快捷提示词 */
.quick-prompt {
  font-size: 12px;
  color: #2563EB;
  background: #EFF6FF;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
  display: flex;
  align-items: center;
  gap: 4px;
}
.quick-prompt:hover {
  background: #DBEAFE;
}

/* 输入区 */
.chat-input-area {
  padding: 12px;
  border-top: 1px solid #E5E7EB;
  background: white;
}

/* 统计概览区头 */
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: linear-gradient(135deg, #3B82F6, #6366F1);
  cursor: pointer;
  user-select: none;
}

/* 统计卡片网格 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
}
.stat-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  background: white;
  border: 1px solid #E5E7EB;
  border-radius: 10px;
  transition: box-shadow 0.2s, transform 0.2s;
}
.stat-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  transform: translateY(-1px);
}
.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1F2937;
  line-height: 1.2;
}
.stat-label {
  font-size: 0.8rem;
  color: #6B7280;
  margin-top: 2px;
}

/* 快捷操作 */
.quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 0;
  color: #9CA3AF;
}

/* 通用间距 */
.mb-4 {
  margin-bottom: 16px;
}
</style>
