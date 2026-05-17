<template>
  <div class="base-data-view">
    <h2 class="page-title">基础数据管理</h2>

    <el-tabs v-model="activeTab" class="data-tabs">
      <!-- 教师 -->
      <el-tab-pane label="教师" name="teachers">
        <CrudTab entity="teachers" :columns="teacherColumns" :formFields="teacherFormFields" />
      </el-tab-pane>

      <!-- 教室 -->
      <el-tab-pane label="教室" name="classrooms">
        <CrudTab entity="classrooms" :columns="classroomColumns" :formFields="classroomFormFields" />
      </el-tab-pane>

      <!-- 课程 -->
      <el-tab-pane label="课程" name="courses">
        <CrudTab entity="courses" :columns="courseColumns" :formFields="courseFormFields" />
      </el-tab-pane>

      <!-- 班级 -->
      <el-tab-pane label="班级" name="classes">
        <CrudTab entity="classes" :columns="classColumns" :formFields="classFormFields" />
      </el-tab-pane>

      <!-- 时段 -->
      <el-tab-pane label="时段" name="time-slots">
        <CrudTab entity="time-slots" :columns="slotColumns" :formFields="slotFormFields" />
      </el-tab-pane>

      <!-- 学生 -->
      <el-tab-pane label="学生" name="students">
        <CrudTab entity="students" :columns="studentColumns" :formFields="studentFormFields" />
      </el-tab-pane>

      <!-- 专业 -->
      <el-tab-pane label="专业" name="majors">
        <CrudTab entity="majors" :columns="majorColumns" :formFields="majorFormFields" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import CrudTab from '@/components/common/CrudTab.vue'

const activeTab = ref('teachers')

// ------- 教师 -------
const teacherColumns = [
  { key: 'id', label: 'ID', width: 80 },
  { key: 'name', label: '姓名' },
  { key: 'teacher_type', label: '类型', width: 100, slot: 'teacher_type' },
  { key: 'max_slots', label: '最大场次', width: 110 },
  { key: 'current_slots', label: '已排场次', width: 110 },
]
const teacherFormFields = [
  { key: 'name', label: '姓名', type: 'input', placeholder: '请输入姓名' },
  {
    key: 'teacher_type', label: '类型', type: 'select', placeholder: '请选择类型',
    options: [
      { label: '专任', value: 'full_time' },
      { label: '兼职', value: 'part_time' },
    ],
  },
  { key: 'max_slots', label: '最大场次', type: 'number', min: 0, max: 20 },
]

// ------- 教室 -------
const classroomColumns = [
  { key: 'id', label: 'ID', width: 80 },
  { key: 'name', label: '名称' },
  { key: 'type', label: '类型', width: 100, slot: 'classroom_type' },
  { key: 'capacity', label: '容量', width: 90 },
  { key: 'building', label: '楼宇', width: 120 },
  { key: 'floor', label: '楼层', width: 80 },
]
const classroomFormFields = [
  { key: 'name', label: '名称', type: 'input', placeholder: '如 5-201' },
  {
    key: 'type', label: '类型', type: 'select', placeholder: '请选择类型',
    options: [
      { label: 'Lecture', value: 'Lecture' },
      { label: 'Lab', value: 'Lab' },
    ],
  },
  { key: 'capacity', label: '容量', type: 'number', min: 0 },
  { key: 'building', label: '楼宇', type: 'input', placeholder: '如 5号楼' },
  { key: 'floor', label: '楼层', type: 'number', min: 0 },
]

// ------- 课程 -------
const courseColumns = [
  { key: 'id', label: 'ID', width: 80 },
  { key: 'name', label: '课程名称' },
  { key: 'is_public', label: '公共课', width: 90, slot: 'is_public' },
  { key: 'has_ab_split', label: 'AB卷', width: 90, slot: 'has_ab_split' },
]
const courseFormFields = [
  { key: 'name', label: '课程名称', type: 'input', placeholder: '请输入课程名称' },
  { key: 'is_public', label: '公共课', type: 'checkbox', checkboxLabel: '是公共课' },
  { key: 'has_ab_split', label: 'AB卷', type: 'checkbox', checkboxLabel: '需要AB卷' },
]

// ------- 班级 -------
const classColumns = [
  { key: 'id', label: 'ID', width: 80 },
  { key: 'name', label: '班级名称' },
  { key: 'grade', label: '年级', width: 100 },
  { key: 'student_count', label: '人数', width: 90 },
  { key: 'major_name', label: '专业', width: 150, slot: 'major_name' },
]
const classFormFields = [
  { key: 'name', label: '班级名称', type: 'input', placeholder: '如 25数媒1' },
  { key: 'grade', label: '年级', type: 'input', placeholder: '如 2025' },
  { key: 'student_count', label: '人数', type: 'number', min: 0 },
  { key: 'major_id', label: '专业', type: 'select', placeholder: '请选择专业', options: [] },
  // 注意：专业选项需要动态加载，暂留空，后续补充加载逻辑
]

// ------- 时段 -------
const slotColumns = [
  { key: 'id', label: 'ID', width: 80 },
  { key: 'day_name', label: '星期', width: 100 },
  { key: 'slot_code', label: '时段代码', width: 120 },
  { key: 'start_time', label: '开始时间', width: 100 },
  { key: 'end_time', label: '结束时间', width: 100 },
]
const slotFormFields = [
  {
    key: 'day_of_week', label: '星期', type: 'select', placeholder: '请选择',
    options: [
      { label: '星期一', value: 1 },
      { label: '星期二', value: 2 },
      { label: '星期三', value: 3 },
      { label: '星期四', value: 4 },
      { label: '星期五', value: 5 },
    ],
  },
  {
    key: 'slot_code', label: '时段代码', type: 'select', placeholder: '请选择',
    options: [
      { label: '上午第一节 (T1)', value: 'T1' },
      { label: '上午第二节 (T2)', value: 'T2' },
      { label: '下午第一节 (T3)', value: 'T3' },
      { label: '下午第二节 (T4)', value: 'T4' },
    ],
  },
  { key: 'start_time', label: '开始时间', type: 'input', placeholder: '如 08:00' },
  { key: 'end_time', label: '结束时间', type: 'input', placeholder: '如 09:40' },
]

// ------- 学生（只读，通常不通过界面前增删）-------
const studentColumns = [
  { key: 'id', label: 'ID', width: 80 },
  { key: 'name', label: '姓名' },
  { key: 'class_name', label: '班级', width: 150 },
]
const studentFormFields = []

// ------- 专业 -------
const majorColumns = [
  { key: 'id', label: 'ID', width: 80 },
  { key: 'name', label: '专业名称' },
]
const majorFormFields = [
  { key: 'name', label: '专业名称', type: 'input', placeholder: '请输入专业名称' },
]
</script>

<style scoped>
.base-data-view {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}
.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1F2937;
  margin-bottom: 16px;
}
.data-tabs {
  background: white;
  border-radius: 8px;
  padding: 16px;
}
</style>
