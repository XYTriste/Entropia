<template>
  <div class="base-data-view">
    <div class="page-header">
      <h2 class="page-title">基础数据管理</h2>
      <p class="page-desc">管理教师、教室、课程、班级、时段、学生、专业等基础数据</p>
    </div>

    <el-tabs v-model="activeTab" class="data-tabs">
      <!-- 教师 -->
      <el-tab-pane label="教师" name="teachers" :lazy="true">
        <CrudTab entity="teachers" :columns="TEACHER_COLUMNS" :formFields="TEACHER_FIELDS" :rules="TEACHER_RULES" />
      </el-tab-pane>

      <!-- 教室 -->
      <el-tab-pane label="教室" name="classrooms" :lazy="true">
        <CrudTab entity="classrooms" :columns="CLASSROOM_COLUMNS" :formFields="CLASSROOM_FIELDS" :rules="CLASSROOM_RULES" />
      </el-tab-pane>

      <!-- 课程 -->
      <el-tab-pane label="课程" name="courses" :lazy="true">
        <CrudTab entity="courses" :columns="COURSE_COLUMNS" :formFields="COURSE_FIELDS" :rules="COURSE_RULES" />
      </el-tab-pane>

      <!-- 班级 -->
      <el-tab-pane label="班级" name="classes" :lazy="true">
        <CrudTab entity="classes" :columns="CLASS_COLUMNS" :formFields="CLASS_FIELDS" :rules="CLASS_RULES" />
      </el-tab-pane>

      <!-- 时段 -->
      <el-tab-pane label="时段" name="time-slots" :lazy="true">
        <CrudTab entity="time-slots" :columns="SLOT_COLUMNS" :formFields="SLOT_FIELDS" :rules="SLOT_RULES" />
      </el-tab-pane>

      <!-- 学生 -->
      <el-tab-pane label="学生" name="students" :lazy="true">
        <CrudTab entity="students" :columns="STUDENT_COLUMNS" :formFields="STUDENT_FIELDS" />
      </el-tab-pane>

      <!-- 专业 -->
      <el-tab-pane label="专业" name="majors" :lazy="true">
        <CrudTab entity="majors" :columns="MAJOR_COLUMNS" :formFields="MAJOR_FIELDS" :rules="MAJOR_RULES" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const activeTab = ref('teachers')

// -------- 教师 -------
const TEACHER_COLUMNS = [
  { prop: 'id', label: 'ID', width: 60 },
  { prop: 'name', label: '姓名' },
  { prop: 'teacher_type', label: '类型' },
  { prop: 'max_slots', label: '最大场次', width: 90 },
]
const TEACHER_FIELDS = [
  { prop: 'name', label: '姓名', component: 'el-input' },
  { prop: 'teacher_type', label: '类型', component: 'el-select', options: [{ label: '专任教师', value: 'full_time' }, { label: '兼任教师', value: 'part_time' }] },
  { prop: 'max_slots', label: '最大场次', component: 'el-input-number', min: 0, max: 20 },
]
const TEACHER_RULES = {
  name: [{ required: true, message: '请输入教师姓名', trigger: 'blur' }],
}

// -------- 教室 -------
const CLASSROOM_COLUMNS = [
  { prop: 'id', label: 'ID', width: 60 },
  { prop: 'name', label: '教室名称' },
  { prop: 'capacity', label: '容量', width: 80 },
  { prop: 'room_type', label: '类型' },
]
const CLASSROOM_FIELDS = [
  { prop: 'name', label: '教室名称', component: 'el-input' },
  { prop: 'capacity', label: '容量', component: 'el-input-number', min: 1, max: 200 },
  { prop: 'room_type', label: '类型', component: 'el-select', options: [{ label: '普通教室', value: 'normal' }, { label: '多媒体教室', value: 'multimedia' }, { label: '实验室', value: 'lab' }] },
]
const CLASSROOM_RULES = {
  name: [{ required: true, message: '请输入教室名称', trigger: 'blur' }],
  capacity: [{ required: true, message: '请输入容量', trigger: 'blur' }],
}

// -------- 课程 -------
const COURSE_COLUMNS = [
  { prop: 'id', label: 'ID', width: 60 },
  { prop: 'name', label: '课程名称' },
  { prop: 'course_type', label: '课程类型' },
  { prop: 'student_count', label: '人数', width: 80 },
  { prop: 'needs_ab', label: 'AB卷', width: 70, formatter: (r) => r.needs_ab ? '是' : '否' },
]
const COURSE_FIELDS = [
  { prop: 'name', label: '课程名称', component: 'el-input' },
  { prop: 'course_type', label: '课程类型', component: 'el-select', options: [{ label: '公共课', value: 'public' }, { label: '专业课', value: 'major' }] },
  { prop: 'student_count', label: '人数', component: 'el-input-number', min: 1 },
  { prop: 'needs_ab', label: '需要AB卷', component: 'el-switch' },
]
const COURSE_RULES = {
  name: [{ required: true, message: '请输入课程名称', trigger: 'blur' }],
}

// -------- 班级 -------
const CLASS_COLUMNS = [
  { prop: 'id', label: 'ID', width: 60 },
  { prop: 'name', label: '班级名称' },
  { prop: 'major', label: '专业' },
  { prop: 'grade', label: '年级', width: 70 },
  { prop: 'student_count', label: '人数', width: 80 },
]
const CLASS_FIELDS = [
  { prop: 'name', label: '班级名称', component: 'el-input' },
  { prop: 'major', label: '专业', component: 'el-input' },
  { prop: 'grade', label: '年级', component: 'el-input' },
  { prop: 'student_count', label: '人数', component: 'el-input-number', min: 1 },
]
const CLASS_RULES = {
  name: [{ required: true, message: '请输入班级名称', trigger: 'blur' }],
}

// -------- 时段 -------
const SLOT_COLUMNS = [
  { prop: 'id', label: 'ID', width: 60 },
  { prop: 'day_name', label: '星期' },
  { prop: 'slot_code', label: '时段代码', width: 90 },
  { prop: 'start_time', label: '开始时间', width: 100 },
  { prop: 'end_time', label: '结束时间', width: 100 },
]
const SLOT_FIELDS = [
  { prop: 'day_name', label: '星期', component: 'el-select', options: [{ label: '周一', value: '周一' }, { label: '周二', value: '周二' }, { label: '周三', value: '周三' }, { label: '周四', value: '周四' }, { label: '周五', value: '周五' }] },
  { prop: 'slot_code', label: '时段代码', component: 'el-input' },
  { prop: 'start_time', label: '开始时间', component: 'el-input' },
  { prop: 'end_time', label: '结束时间', component: 'el-input' },
]
const SLOT_RULES = {
  day_name: [{ required: true, message: '请选择星期', trigger: 'change' }],
  slot_code: [{ required: true, message: '请输入时段代码', trigger: 'blur' }],
}

// -------- 学生 -------
const STUDENT_COLUMNS = [
  { prop: 'id', label: 'ID', width: 60 },
  { prop: 'name', label: '姓名' },
  { prop: 'student_id', label: '学号' },
  { prop: 'class_name', label: '班级' },
]
const STUDENT_FIELDS = [
  { prop: 'name', label: '姓名', component: 'el-input' },
  { prop: 'student_id', label: '学号', component: 'el-input' },
  { prop: 'class_id', label: '班级', component: 'el-select', entity: 'classes' },
]

// -------- 专业 -------
const MAJOR_COLUMNS = [
  { prop: 'id', label: 'ID', width: 60 },
  { prop: 'name', label: '专业名称' },
]
const MAJOR_FIELDS = [
  { prop: 'name', label: '专业名称', component: 'el-input' },
]
const MAJOR_RULES = {
  name: [{ required: true, message: '请输入专业名称', trigger: 'blur' }],
}

/* 唯一需要响应式的状态 */

</script>

<style scoped>
.base-data-view {
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

  padding: 32px;
  max-width: 1400px;
  margin: 0 auto;
  min-height: calc(100vh - 64px);
  background: var(--bg-start);
  position: relative;
  overflow: hidden;
}

/* 扫光特效 - 绿色 */
.base-data-view::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -60%;
  width: 200%;
  height: 200%;
  background: linear-gradient(
    115deg,
    transparent 30%,
    rgba(0, 230, 118, 0.07) 45%,
    rgba(0, 230, 118, 0.12) 50%,
    rgba(0, 230, 118, 0.07) 55%,
    transparent 70%
  );
  transform: rotate(25deg);
  animation: sweepLight 6s infinite linear;
  pointer-events: none;
  z-index: 0;
}

/* 网格纹理背景 */
.base-data-view::after {
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

.page-header {
  position: relative;
  z-index: 2;
  margin-bottom: 24px;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: -0.5px;
}

.page-desc {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 4px 0 0 0;
}

.data-tabs {
  background: var(--card-bg);
  border-radius: var(--radius);
  padding: 24px;
  min-height: 500px;
  border: 1px solid var(--card-border);
  position: relative;
  z-index: 2;
}

.data-tabs :deep(.el-tabs__header) {
  margin-bottom: 24px;
}

.data-tabs :deep(.el-tab-pane) {
  outline: none;
}

/* Element Plus 深色适配 */
.data-tabs :deep(.el-tabs__item) {
  color: var(--text-secondary);
}
.data-tabs :deep(.el-tabs__item.is-active) {
  color: var(--accent);
}
.data-tabs :deep(.el-tabs__active-bar) {
  background-color: var(--accent);
}
.data-tabs :deep(.el-tabs__nav-wrap::after) {
  background-color: var(--card-border);
}
</style>
