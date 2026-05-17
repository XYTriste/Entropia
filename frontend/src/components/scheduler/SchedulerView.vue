<template>
  <div class="scheduler-view">
    <h2 class="page-title">智能排考</h2>

    <!-- 排考配置 -->
    <el-card class="mb-4">
      <template #header>
        <span class="font-semibold">排考配置</span>
      </template>
      <el-form :model="config" label-width="130px">
        <el-form-item label="最大求解时间（秒）">
          <el-input-number v-model="config.maxSolveTime" :min="60" :max="600" />
          <span class="ml-2 text-sm text-gray-500">建议 120～300 秒</span>
        </el-form-item>
        <el-form-item>
          <el-checkbox v-model="config.saveAsVersion">保存为新版本</el-checkbox>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="primary" :loading="running" @click="runScheduler">
          开始排考
        </el-button>
      </template>
    </el-card>

    <!-- 排考进度 -->
    <el-card v-if="running || progress.length" class="mb-4">
      <template #header>
        <span class="font-semibold">排考进度</span>
      </template>
      <div class="progress-box">
        <div v-for="(msg, idx) in progress" :key="idx" class="progress-line">
          <el-icon v-if="msg.type === 'error'" color="#EF4444"><CircleCloseFilled /></el-icon>
          <el-icon v-else-if="msg.type === 'done'" color="#10B981"><CircleCheckFilled /></el-icon>
          <el-icon v-else color="#3B82F6"><InfoFilled /></el-icon>
          <span :class="msg.type === 'error' ? 'text-red-600' : ''">{{ msg.text }}</span>
        </div>
      </div>
    </el-card>

    <!-- 排考结果 -->
    <el-card v-if="results.length" class="mb-4">
      <template #header>
        <span class="font-semibold">排考结果</span>
      </template>
      <el-table :data="results" stripe border max-height="500px">
        <el-table-column prop="exam_id" label="考试ID" width="90" />
        <el-table-column prop="course_name" label="课程" />
        <el-table-column prop="day_name" label="星期" width="90" />
        <el-table-column prop="slot_code" label="时段" width="80" />
        <el-table-column prop="time_str" label="时间" width="140" />
        <el-table-column prop="classroom" label="教室" width="100" />
        <el-table-column prop="teacher_name" label="监考教师" width="120" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  InfoFilled,
  CircleCloseFilled,
  CircleCheckFilled,
} from '@element-plus/icons-vue'

const running = ref(false)
const progress = ref([])
const results = ref([])

const config = ref({
  maxSolveTime: 300,
  saveAsVersion: true,
})

async function runScheduler() {
  running.value = true
  progress.value = []
  results.value = []

  try {
    const response = await fetch('/api/scheduler/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        max_solve_time: config.value.maxSolveTime,
        save_as_version: config.value.saveAsVersion,
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.detail || `HTTP ${response.status}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

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
            progress.value.push({ type: 'done', text: parsed.message || '排考完成！' })
            ElMessage.success(parsed.message || '排考完成！')
            return
          } else if (parsed.type === 'error') {
            progress.value.push({ type: 'error', text: parsed.message || '排考失败' })
            ElMessage.error(parsed.message || '排考失败')
            return
          } else {
            progress.value.push({ type: 'info', text: parsed.message || parsed.content || '' })
          }
        } catch {
          // ignore parse errors
        }
      }
    }
  } catch (e) {
    progress.value.push({ type: 'error', text: e.message })
    ElMessage.error(`排考失败：${e.message}`)
  } finally {
    running.value = false
  }
}
</script>

<style scoped>
.scheduler-view {
  padding: 20px;
  max-width: 1200px;
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
.progress-box {
  max-height: 400px;
  overflow-y: auto;
  padding: 12px;
  background: #F9FAFB;
  border-radius: 8px;
}
.progress-line {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 4px 0;
  font-size: 14px;
  line-height: 1.6;
}
.ml-2 {
  margin-left: 8px;
}
</style>
