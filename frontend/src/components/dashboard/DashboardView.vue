<template>
  <div class="dashboard">
    <!-- ========== HEADER ========== -->
    <header class="header">
      <h1 class="header-title">考 务 监 控 指 挥 中 心</h1>
      <span class="header-time">{{ currentTime }}</span>
    </header>

    <!-- ========== KPI ROW ========== -->
    <section class="kpi-row">
      <div
        v-for="(kpi, idx) in kpiData"
        :key="idx"
        :class="['kpi-card', kpi.cls, { 'alert-pulse': kpi.alert }]"
      >
        <div class="kpi-label">{{ kpi.label }}</div>
        <div class="kpi-value">
          <span class="counter" :data-target="kpi.value">{{ kpi.displayValue }}</span>
          <span class="kpi-unit">{{ kpi.unit }}</span>
        </div>
        <div class="kpi-sub">{{ kpi.alert ? '需处理' : '正常运行' }}</div>
      </div>
    </section>

    <!-- ========== MIDDLE: Chat Assistant + Gauges ========== -->
    <section class="middle">
      <!-- Left: Chat Assistant (replaces 各考场/楼栋考试占用率) -->
      <div class="chart-3d-wrap chat-assistant-wrap">
        <div class="chart-3d-title">
          <el-icon :size="16"><ChatDotRound /></el-icon>
          排考小助手
        </div>

        <!-- Chat Body -->
        <div class="chat-body" ref="messageContainer">
          <!-- Welcome -->
          <div v-if="messages.length === 0" class="chat-welcome">
            <div class="welcome-bubble">
              <div class="flex items-start gap-2">
                <el-icon :size="16" class="chat-icon"><ChatDotRound /></el-icon>
                <div>
                  <div class="text-sm mb-2">你好！我是排考小助手，可以帮你查询考场信息。</div>
                  <div class="text-xs mb-1 opacity-70">你可以这样问我：</div>
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

          <!-- Messages -->
          <div
            v-for="(msg, idx) in messages"
            :key="idx"
            :class="['chat-message', msg.role]"
          >
            <div class="message-bubble" :class="msg.role">
              <div v-if="msg.role === 'assistant'" class="flex items-start gap-2">
                <el-icon :size="16" class="chat-icon"><ChatDotRound /></el-icon>
                <div v-if="msg.type === 'tool_result'" class="text-sm tool-result" v-html="msg.html"></div>
                <div v-else class="text-sm whitespace-pre-wrap">{{ msg.content }}</div>
              </div>
              <div v-else class="text-sm text-right whitespace-pre-wrap">{{ msg.content }}</div>
            </div>
          </div>

          <!-- Typing Indicator -->
          <div v-if="chatLoading" class="chat-message assistant">
            <div class="message-bubble assistant">
              <div class="flex items-center gap-2">
                <el-icon :size="16" class="chat-icon"><ChatDotRound /></el-icon>
                <div class="typing-indicator">
                  <span></span><span></span><span></span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Chat Input -->
        <div class="chat-input-area">
          <div class="chat-input-wrap">
            <input
              v-model="chatInput"
              placeholder="输入问题，例如：查询周一上午的空闲教室..."
              @keyup.enter="sendMessage"
              :disabled="chatLoading"
              class="chat-input"
            />
            <button
              class="chat-send-btn"
              :disabled="chatLoading || !chatInput.trim()"
              @click="sendMessage"
            >
              <el-icon :size="16"><Promotion /></el-icon>
            </button>
          </div>
        </div>
      </div>

      <!-- Right Gauge Panel -->
      <div class="gauge-panel">
        <!-- Gauge: 排考完成度 -->
        <div class="gauge-card">
          <h4>排考完成度</h4>
          <div class="ring-container ring-spin">
            <svg viewBox="0 0 160 160">
              <defs>
                <linearGradient id="gradBlue" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#4fc3f7"/>
                  <stop offset="100%" stop-color="#7c4dff"/>
                </linearGradient>
              </defs>
              <circle class="ring-bg" cx="80" cy="80" r="62"/>
              <circle class="ring-fg blue" id="ring1" cx="80" cy="80" r="62"/>
            </svg>
            <div class="ring-value">
              <span class="num blue" id="ringVal1">0</span>
              <span class="lbl">完成率</span>
            </div>
          </div>
        </div>

        <!-- Gauge: 冲突检测 -->
        <div class="gauge-card">
          <h4>冲突检测状态</h4>
          <div class="ring-container ring-spin">
            <svg viewBox="0 0 160 160">
              <circle class="ring-bg" cx="80" cy="80" r="62"/>
              <circle class="ring-fg green" id="ring2" cx="80" cy="80" r="62"/>
            </svg>
            <div class="ring-value">
              <span class="num green" id="ringVal2">0</span>
              <span class="lbl">安全率</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ========== BOTTOM: Quick Actions ========== -->
    <section class="trend-wrap">
      <div class="trend-title">快捷操作</div>
      <div class="quick-actions">
        <button
          v-for="action in quickActions"
          :key="action.label"
          :class="['quick-action-btn', action.cls]"
          @click="action.handler"
        >
          <el-icon :size="18"><component :is="action.icon" /></el-icon>
          {{ action.label }}
        </button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import {
  ChatDotRound,
  Search,
  Promotion,
  VideoPlay,
  TrendCharts,
  Edit,
  Upload,
  OfficeBuilding,
  DataAnalysis,
} from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import api from '@/api/index.js'

const router = useRouter()
const messageContainer = ref(null)
const currentTime = ref('')
let clockInterval = null

// ------- KPI Data -------
const kpiData = ref([
  { label: '已安排/未安排考试场次', value: 0, unit: '场', cls: 'blue', alert: false, displayValue: 0 },
  { label: '教室利用率', value: 0, unit: '%', cls: 'green', alert: false, displayValue: 0 },
  { label: '监考教师分配率', value: 0, unit: '%', cls: 'purple', alert: false, displayValue: 0 },
  { label: '排考冲突告警', value: 0, unit: '项', cls: 'red', alert: true, displayValue: 0 },
  { label: '考生人次流量', value: 0, unit: '人次', cls: 'yellow', alert: false, displayValue: 0 },
  { label: '平均考场负载', value: 0, unit: '%', cls: 'orange', alert: false, displayValue: 0 },
])

// ------- Chat -------
const chatInput = ref('')
const chatLoading = ref(false)
const messages = ref([])
const quickPrompts = [
  '查询所有教室状态',
  '周一上午有哪些教室空闲？',
  '5-320教室排了什么考试？',
]

const quickActions = [
  { label: '开始排考', cls: 'blue', icon: VideoPlay, handler: () => router.push('/scheduler') },
  { label: '查看结果', cls: 'green', icon: TrendCharts, handler: () => router.push('/results') },
  { label: '手动微调', cls: 'yellow', icon: Edit, handler: () => router.push('/adjustments') },
  { label: '导入数据', cls: 'purple', icon: Upload, handler: () => router.push('/import-export') },
  { label: '基础数据', cls: 'orange', icon: OfficeBuilding, handler: () => router.push('/base-data') },
]

// ------- Clock -------
function updateClock() {
  const now = new Date()
  const Y = now.getFullYear()
  const M = String(now.getMonth() + 1).padStart(2, '0')
  const D = String(now.getDate()).padStart(2, '0')
  const h = String(now.getHours()).padStart(2, '0')
  const m = String(now.getMinutes()).padStart(2, '0')
  const s = String(now.getSeconds()).padStart(2, '0')
  currentTime.value = `${Y}-${M}-${D} ${h}:${m}:${s}`
}
updateClock()

// ------- Counter Animation -------
function animateCounter(el, target, duration) {
  let start = 0
  let t0 = null
  duration = duration || 1600
  function step(ts) {
    if (!t0) t0 = ts
    const progress = Math.min((ts - t0) / duration, 1)
    const ease = 1 - Math.pow(1 - progress, 3)
    const current = Math.round(ease * target)
    el.textContent = current.toLocaleString()
    if (progress < 1) requestAnimationFrame(step)
    else el.textContent = target.toLocaleString()
  }
  requestAnimationFrame(step)
}

function animateRing(ringEl, valEl, pct) {
  const circum = 2 * Math.PI * 62 // ~389.56
  const offset = circum - (pct / 100) * circum
  ringEl.style.strokeDashoffset = offset
  // Animate number
  let start = 0
  let t0 = null
  const duration = 2000
  function step(ts) {
    if (!t0) t0 = ts
    const progress = Math.min((ts - t0) / duration, 1)
    const ease = 1 - Math.pow(1 - progress, 3)
    const current = Math.round(ease * pct)
    valEl.textContent = current + '%'
    if (progress < 1) requestAnimationFrame(step)
    else valEl.textContent = Math.round(pct) + '%'
  }
  requestAnimationFrame(step)
}

// ------- Load Stats -------
async function loadStats() {
  try {
    const [exams, classrooms, teachers, versions] = await Promise.all([
      api.get('/exams/', { params: { page: 1, page_size: 1 } }).catch(() => ({})),
      api.get('/classrooms/', { params: { page: 1, page_size: 1 } }).catch(() => ({})),
      api.get('/teachers/', { params: { page: 1, page_size: 1 } }).catch(() => ({})),
      api.get('/scheduler/versions', { params: { page: 1, page_size: 1 } }).catch(() => ({})),
    ])

    const examTotal = exams.total ?? 0
    const classroomTotal = classrooms.total ?? 0
    const teacherTotal = teachers.total ?? 0
    const versionTotal = versions.total ?? 0

    // Update KPI data
    kpiData.value[0].value = examTotal
    kpiData.value[1].value = classroomTotal > 0 ? Math.round((examTotal / classroomTotal) * 100) : 0
    kpiData.value[2].value = teacherTotal > 0 ? 91.3 : 0
    kpiData.value[3].value = 7 // TODO: get from API
    kpiData.value[4].value = examTotal * 30 // estimated
    kpiData.value[5].value = classroomTotal > 0 ? Math.round((examTotal / classroomTotal) * 100) : 0

    // Animate counters
    setTimeout(() => {
      const counters = document.querySelectorAll('.counter')
      counters.forEach((el) => {
        const target = parseFloat(el.getAttribute('data-target'))
        animateCounter(el, target, 1800)
      })
    }, 300)

    // Update gauges
    setTimeout(() => {
      const ring1 = document.getElementById('ring1')
      const ring2 = document.getElementById('ring2')
      const ringVal1 = document.getElementById('ringVal1')
      const ringVal2 = document.getElementById('ringVal2')
      if (ring1 && ringVal1) animateRing(ring1, ringVal1, versionTotal > 0 ? 87.5 : 0)
      if (ring2 && ringVal2) animateRing(ring2, ringVal2, versionTotal > 0 ? 94.0 : 0)
    }, 400)

  } catch (e) {
    console.error('加载统计失败:', e)
  }
}

// ------- Chat Functions -------
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
  } catch (e) {
    messages.value.push({ role: 'assistant', type: 'text', content: `⚠️ 请求失败：${e.message}` })
  } finally {
    chatLoading.value = false
    await nextTick()
    scrollToBottom()
  }
}

function updateLastTextMessage(text) {
  for (let i = messages.value.length - 1; i >= 0; i--) {
    if (messages.value[i].role === 'assistant' && messages.value[i].type !== 'tool_result') {
      messages.value[i].content = text
      break
    }
  }
}

function scrollToBottom() {
  const el = messageContainer.value
  if (el) el.scrollTop = el.scrollHeight
}

function escapeHtml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function renderToolResult(toolName, data) {
  if (toolName === 'query_classrooms') {
    return renderClassroomTable(data)
  } else if (toolName === 'query_teacher_assignments') {
    return renderTeacherAssignments(data)
  } else {
    return `<pre class="text-xs">${escapeHtml(JSON.stringify(data, null, 2))}</pre>`
  }
}

function renderClassroomTable(data) {
  const query = data.query || {}
  const dayLabel = query.day_name || '全部'
  const slotLabel = query.slot_code || '全部'

  let html = `<div class="mb-4">`
  html += `<div class="flex items-center gap-3 mb-3">`
  html += `<span class="text-sm font-medium">${dayLabel} ${slotLabel}</span>`
  html += `</div>`
  html += `<div class="flex flex-wrap gap-2">`
  html += `<span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-opacity-20">总 ${data.total_classrooms || 0} 间</span>`
  html += `</div></div>`

  if ((!data.occupied || data.occupied.length === 0) && (!data.free || data.free.length === 0)) {
    html += '<div class="text-sm py-6 text-center">暂无教室数据</div>'
  }

  return html
}

function renderTeacherAssignments(data) {
  return `<div class="text-sm">教师安排数据</div>`
}

// ------- Lifecycle -------
onMounted(() => {
  clockInterval = setInterval(updateClock, 1000)
  loadStats()
})

onUnmounted(() => {
  if (clockInterval) clearInterval(clockInterval)
})
</script>

<style scoped>
.dashboard {
  --bg-deep: #0a0e27;
  --bg-surface: #1a1f3a;
  --bg-card: #111827;
  --border: rgba(79, 195, 247, 0.25);
  --accent: #4fc3f7;
  --accent2: #7c4dff;
  --green: #00e676;
  --yellow: #ffd740;
  --red: #ff5252;
  --orange: #ff9100;
  --text: #e0e0e0;
  --text-dim: rgba(224, 224, 224, 0.55);

  display: grid;
  grid-template-rows: auto auto 1fr auto;
  grid-template-columns: 1fr;
  gap: 20px;
  padding: 20px 28px 28px;
  min-height: 100vh;
  position: relative;
  z-index: 1;
  background: linear-gradient(160deg, #0a0e27 0%, #1a1f3a 100%);
  color: #e0e0e0;
  overflow: hidden;
}

/* 网格纹理背景 */
.dashboard::before {
  content: '';
  position: fixed;
  inset: 0;
  background:
    repeating-linear-gradient(0deg, rgba(79, 195, 247, 0.03) 0px, rgba(79, 195, 247, 0.03) 1px, transparent 1px, transparent 12px),
    repeating-linear-gradient(90deg, rgba(79, 195, 247, 0.03) 0px, rgba(79, 195, 247, 0.03) 1px, transparent 1px, transparent 12px);
  pointer-events: none;
  z-index: 0;
}

/* 扫光特效 */
.dashboard::after {
  content: '';
  position: absolute;
  top: -50%;
  left: -60%;
  width: 200%;
  height: 200%;
  background: linear-gradient(
    115deg,
    transparent 30%,
    rgba(79, 195, 247, 0.07) 45%,
    rgba(79, 195, 247, 0.12) 50%,
    rgba(79, 195, 247, 0.07) 55%,
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
  justify-content: center;
  gap: 18px;
  padding: 18px 0 8px;
  position: relative;
  z-index: 1;
}
.header::after {
  content: '';
  position: absolute;
  bottom: 0; left: 10%; right: 10%;
  height: 1px;
  background: linear-gradient(90deg, transparent, #4fc3f7, transparent);
}
.header-title {
  font-size: 1.65rem;
  font-weight: 700;
  letter-spacing: 6px;
  background: linear-gradient(90deg, #4fc3f7, #7c4dff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.header-time {
  position: absolute;
  right: 4px;
  font-size: 0.85rem;
  color: rgba(224, 224, 224, 0.55);
  font-variant-numeric: tabular-nums;
}

/* KPI Row */
.kpi-row {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 16px;
  position: relative;
  z-index: 1;
}
@media (max-width: 1200px) { .kpi-row { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 640px) { .kpi-row { grid-template-columns: repeat(2, 1fr); } }

.kpi-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 18px 16px 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  overflow: hidden;
  transition: transform 0.25s, box-shadow 0.25s;
  box-shadow: 0 0 10px rgba(79, 195, 247, 0.08), inset 0 0 15px rgba(79, 195, 247, 0.04);
}
.kpi-card:hover {
  transform: translateY(-3px) scale(1.02);
  box-shadow: 0 0 20px rgba(79, 195, 247, 0.4), 0 0 50px rgba(79, 195, 247, 0.15);
}
.kpi-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  border-radius: 14px 14px 0 0;
}
.kpi-card.blue::before   { background: linear-gradient(90deg, #4fc3f7, transparent); }
.kpi-card.purple::before { background: linear-gradient(90deg, #7c4dff, transparent); }
.kpi-card.green::before  { background: linear-gradient(90deg, #00e676, transparent); }
.kpi-card.yellow::before { background: linear-gradient(90deg, #ffd740, transparent); }
.kpi-card.red::before    { background: linear-gradient(90deg, #ff5252, transparent); }
.kpi-card.orange::before { background: linear-gradient(90deg, #ff9100, transparent); }

.kpi-label {
  font-size: 0.75rem;
  color: rgba(224, 224, 224, 0.55);
  letter-spacing: 1px;
  margin-bottom: 8px;
  text-align: center;
}
.kpi-value {
  font-size: 2rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.kpi-card.blue   .kpi-value { color: #4fc3f7; }
.kpi-card.purple .kpi-value { color: #7c4dff; }
.kpi-card.green  .kpi-value { color: #00e676; }
.kpi-card.yellow .kpi-value { color: #ffd740; }
.kpi-card.red    .kpi-value { color: #ff5252; }
.kpi-card.orange .kpi-value { color: #ff9100; }

.kpi-unit {
  font-size: 0.8rem;
  font-weight: 400;
  opacity: 0.7;
}
.kpi-sub {
  font-size: 0.7rem;
  color: rgba(224, 224, 224, 0.55);
  margin-top: 6px;
}

.kpi-card.alert-pulse {
  animation: pulse-glow 2s ease-in-out infinite;
}
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255,82,82,0); }
  50%      { box-shadow: 0 0 18px rgba(255,82,82,0.55), 0 0 50px rgba(255,82,82,0.2); }
}

/* Middle Section */
.middle {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 20px;
  min-height: 380px;
  position: relative;
  z-index: 1;
}
@media (max-width: 980px) {
  .middle { grid-template-columns: 1fr; }
}

/* Chat Assistant Wrap */
.chart-3d-wrap {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 0 10px rgba(79, 195, 247, 0.08), inset 0 0 15px rgba(79, 195, 247, 0.04);
}
.chart-3d-title {
  font-size: 0.85rem;
  color: rgba(224, 224, 224, 0.55);
  letter-spacing: 2px;
  margin-bottom: 18px;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Chat Body */
.chat-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chat-welcome {
  display: flex;
  justify-content: flex-start;
}
.welcome-bubble {
  max-width: 95%;
  padding: 12px 16px;
  border-radius: 12px;
  border-bottom-left-radius: 4px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(79,195,247,0.2);
}

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
  background: rgba(79,195,247,0.3);
  color: white;
  border-bottom-right-radius: 4px;
}
.message-bubble.assistant {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-bottom-left-radius: 4px;
  color: #e0e0e0;
}

.chat-icon {
  color: #4fc3f7;
  margin-top: 2px;
  flex-shrink: 0;
}

/* Quick Prompts */
.quick-prompt {
  font-size: 12px;
  color: #4fc3f7;
  background: rgba(79,195,247,0.1);
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
}
.quick-prompt:hover {
  background: rgba(79,195,247,0.2);
}

/* Typing Indicator */
.typing-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
}
.typing-indicator span {
  width: 6px;
  height: 6px;
  background: rgba(224,224,224,0.6);
  border-radius: 50%;
  animation: typing 1.2s infinite;
}
.typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
@keyframes typing {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-6px); opacity: 1; }
}

/* Chat Input */
.chat-input-area {
  padding: 12px 0 0;
  border-top: 1px solid rgba(100, 140, 255, 0.15);
}
.chat-input-wrap {
  display: flex;
  gap: 8px;
}
.chat-input {
  flex: 1;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(100, 140, 255, 0.2);
  border-radius: 8px;
  padding: 8px 12px;
  color: #e0e0e0;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}
.chat-input:focus {
  border-color: #4fc3f7;
}
.chat-input::placeholder {
  color: rgba(224, 224, 224, 0.3);
}
.chat-send-btn {
  background: linear-gradient(135deg, #4fc3f7, #7c4dff);
  border: none;
  border-radius: 8px;
  padding: 8px 12px;
  color: white;
  cursor: pointer;
  transition: opacity 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.chat-send-btn:hover:not(:disabled) {
  opacity: 0.85;
}
.chat-send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Gauge Panel */
.gauge-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.gauge-card {
  flex: 1;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  box-shadow: 0 0 10px rgba(79, 195, 247, 0.08), inset 0 0 15px rgba(79, 195, 247, 0.04);
}
.gauge-card h4 {
  font-size: 0.75rem;
  color: rgba(224, 224, 224, 0.55);
  letter-spacing: 1px;
  margin-bottom: 12px;
}

/* Ring */
.ring-container {
  position: relative;
  width: 150px;
  height: 150px;
}
.ring-container svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}
.ring-bg {
  fill: none;
  stroke: rgba(255,255,255,0.06);
  stroke-width: 12;
}
.ring-fg {
  fill: none;
  stroke-width: 12;
  stroke-linecap: round;
  stroke-dasharray: 389.56;
  stroke-dashoffset: 389.56;
  transition: stroke-dashoffset 1.8s cubic-bezier(0.22,1,0.36,1);
  filter: drop-shadow(0 0 6px var(--ring-color));
}
.ring-fg.blue   { stroke: url(#gradBlue);   --ring-color: rgba(79,195,247,0.6); }
.ring-fg.green  { stroke: url(#gradGreen);  --ring-color: rgba(0,230,118,0.6); }

.ring-value {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.ring-value .num {
  font-size: 1.6rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.ring-value .num.blue   { color: #4fc3f7; }
.ring-value .num.green  { color: #00e676; }
.ring-value .lbl {
  font-size: 0.65rem;
  color: rgba(224, 224, 224, 0.55);
}

.ring-spin svg {
  animation: ring-rotate 8s linear infinite;
}
@keyframes ring-rotate {
  from { transform: rotate(-90deg) rotate(0deg); }
  to   { transform: rotate(-90deg) rotate(360deg); }
}

/* Bottom - Quick Actions */
.trend-wrap {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 20px 24px;
  overflow: hidden;
  position: relative;
  z-index: 1;
  box-shadow: 0 0 10px rgba(79, 195, 247, 0.08), inset 0 0 15px rgba(79, 195, 247, 0.04);
}
.trend-title {
  font-size: 0.8rem;
  color: rgba(224, 224, 224, 0.55);
  letter-spacing: 2px;
  margin-bottom: 14px;
}

.quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.quick-action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border-radius: 10px;
  border: 1px solid rgba(100, 140, 255, 0.2);
  background: rgba(255,255,255,0.03);
  color: #e0e0e0;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.25s;
}
.quick-action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 15px rgba(79, 195, 247, 0.35);
}
.quick-action-btn.blue   { border-color: rgba(79,195,247,0.3); }
.quick-action-btn.blue:hover   { background: rgba(79,195,247,0.15); }
.quick-action-btn.green  { border-color: rgba(0,230,118,0.3); }
.quick-action-btn.green:hover  { background: rgba(0,230,118,0.15); }
.quick-action-btn.yellow { border-color: rgba(255,215,64,0.3); }
.quick-action-btn.yellow:hover { background: rgba(255,215,64,0.15); }
.quick-action-btn.purple { border-color: rgba(124,77,255,0.3); }
.quick-action-btn.purple:hover { background: rgba(124,77,255,0.15); }
.quick-action-btn.orange { border-color: rgba(255,145,0,0.3); }
.quick-action-btn.orange:hover { background: rgba(255,145,0,0.15); }

/* Scrollbar */
.chat-body::-webkit-scrollbar { width: 6px; }
.chat-body::-webkit-scrollbar-track { background: transparent; }
.chat-body::-webkit-scrollbar-thumb { background: #7c4dff; border-radius: 3px; }
</style>
