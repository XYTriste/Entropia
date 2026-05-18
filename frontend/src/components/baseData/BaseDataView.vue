<template>
  <div class="base-data-view">
    <div class="page-header">
      <div>
        <h2 class="page-title">基础数据管理</h2>
        <p class="page-desc">管理教师、教室、课程、班级、时段、学生、专业等基础数据</p>
      </div>
    </div>

    <el-tabs v-model="activeTab" class="data-tabs">
      <!-- 教师 -->
      <el-tab-pane label="教师" name="teachers">
        <CrudTab entity="teachers" :columns="teacherColumns" :formFields="teacherFormFields" :rules="teacherRules" />
      </el-tab-pane>

      <!-- 教室 -->
      <el-tab-pane label="教室" name="classrooms">
        <CrudTab entity="classrooms" :columns="classroomColumns" :formFields="classroomFormFields" :rules="classroomRules" />
      </el-tab-pane>

      <!-- 课程 -->
      <el-tab-pane label="课程" name="courses">
        <CrudTab entity="courses" :columns="courseColumns" :formFields="courseFormFields" :rules="courseRules" />
      </el-tab-pane>

      <!-- 班级 -->
      <el-tab-pane label="班级" name="classes">
        <CrudTab entity="classes" :columns="classColumns" :formFields="classFormFields" :rules="classRules" />
      </el-tab-pane>

      <!-- 时段 -->
      <el-tab-pane label="时段" name="time-slots">
        <CrudTab entity="time-slots" :columns="slotColumns" :formFields="slotFormFields" :rules="slotRules" />
      </el-tab-pane>

      <!-- 学生 -->
      <el-tab-pane label="学生" name="students">
        <CrudTab entity="students" :columns="studentColumns" :formFields="studentFormFields" />
      </el-tab-pane>

      <!-- 专业 -->
      <el-tab-pane label="专业" name="majors">
        <CrudTab entity="majors" :columns="majorColumns" :formFields="majorFormFields" :rules="majorRules" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script>
import CrudTab from '@/components/common/CrudTab.vue'

export default {
  name: 'BaseDataView',
  components: { CrudTab },
  data() {
    return {
      activeTab: 'teachers',
      
      // 教师
      teacherColumns: [
        { key: 'id', label: 'ID', width: 80 },
        { key: 'name', label: '姓名' },
        { key: 'teacher_type', label: '类型', width: 100, slot: 'teacher_type' },
        { key: 'max_slots', label: '最大场次', width: 110 },
        { key: 'current_slots', label: '已排场次', width: 110 },
      ],
      teacherFormFields: [
        { key: 'name', label: '姓名', type: 'input', placeholder: '请输入姓名' },
        {
          key: 'teacher_type', label: '类型', type: 'select', placeholder: '请选择类型',
          options: [
            { label: '专任', value: 'full_time' },
            { label: '兼职', value: 'part_time' },
          ],
        },
        { key: 'max_slots', label: '最大场次', type: 'number', min: 0, max: 20 },
      ],
      teacherRules: {
        name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
        max_slots: [{ required: true, message: '请输入最大场次', trigger: 'blur' }],
      },

      // 教室
      classroomColumns: [
        { key: 'id', label: 'ID', width: 80 },
        { key: 'name', label: '名称' },
        { key: 'type', label: '类型', width: 100, slot: 'classroom_type' },
        { key: 'capacity', label: '容量', width: 90 },
        { key: 'building', label: '楼宇', width: 120 },
        { key: 'floor', label: '楼层', width: 80 },
      ],
      classroomFormFields: [
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
      ],
      classroomRules: {
        name: [{ required: true, message: '请输入教室名称', trigger: 'blur' }],
        capacity: [{ required: true, message: '请输入容量', trigger: 'blur' }],
      },

      // 课程
      courseColumns: [
        { key: 'id', label: 'ID', width: 80 },
        { key: 'name', label: '课程名称' },
        { key: 'is_public', label: '公共课', width: 90, slot: 'is_public' },
        { key: 'has_ab_split', label: 'AB卷', width: 90, slot: 'has_ab_split' },
      ],
      courseFormFields: [
        { key: 'name', label: '课程名称', type: 'input', placeholder: '请输入课程名称' },
        { key: 'is_public', label: '公共课', type: 'checkbox', checkboxLabel: '是公共课' },
        { key: 'has_ab_split', label: 'AB卷', type: 'checkbox', checkboxLabel: '需要AB卷' },
      ],
      courseRules: {
        name: [{ required: true, message: '请输入课程名称', trigger: 'blur' }],
      },

      // 班级
      classColumns: [
        { key: 'id', label: 'ID', width: 80 },
        { key: 'name', label: '班级名称' },
        { key: 'grade', label: '年级', width: 100 },
        { key: 'student_count', label: '人数', width: 90 },
        { key: 'major_name', label: '专业', width: 150, slot: 'major_name' },
      ],
      classFormFields: [
        { key: 'name', label: '班级名称', type: 'input', placeholder: '如 25数媒1' },
        { key: 'grade', label: '年级', type: 'input', placeholder: '如 2025' },
        { key: 'student_count', label: '人数', type: 'number', min: 0 },
        { key: 'major_id', label: '专业', type: 'select', placeholder: '请选择专业', options: [] },
      ],
      classRules: {
        name: [{ required: true, message: '请输入班级名称', trigger: 'blur' }],
        student_count: [{ required: true, message: '请输入人数', trigger: 'blur' }],
      },

      // 时段
      slotColumns: [
        { key: 'id', label: 'ID', width: 80 },
        { key: 'day_name', label: '星期', width: 100 },
        { key: 'slot_code', label: '时段代码', width: 120 },
        { key: 'start_time', label: '开始时间', width: 100 },
        { key: 'end_time', label: '结束时间', width: 100 },
      ],
      slotFormFields: [
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
      ],
      slotRules: {
        day_of_week: [{ required: true, message: '请选择星期', trigger: 'change' }],
        slot_code: [{ required: true, message: '请选择时段代码', trigger: 'change' }],
        start_time: [{ required: true, message: '请输入开始时间', trigger: 'blur' }],
        end_time: [{ required: true, message: '请输入结束时间', trigger: 'blur' }],
      },

      // 学生（只读）
      studentColumns: [
        { key: 'id', label: 'ID', width: 80 },
        { key: 'name', label: '姓名' },
        { key: 'class_name', label: '班级', width: 150 },
      ],
      studentFormFields: [],

      // 专业
      majorColumns: [
        { key: 'id', label: 'ID', width: 80 },
        { key: 'name', label: '专业名称' },
      ],
      majorFormFields: [
        { key: 'name', label: '专业名称', type: 'input', placeholder: '请输入专业名称' },
      ],
      majorRules: {
        name: [{ required: true, message: '请输入专业名称', trigger: 'blur' }],
      },
    }
  },
}
</script>

<style scoped>
.base-data-view {
  padding: var(--space-xl, 32px);
  max-width: 1400px;
  margin: 0 auto;
  min-height: calc(100vh - 64px);
  background: var(--color-bg-page, #F0F2F5);
}

.page-header {
  margin-bottom: var(--space-lg, 24px);
}

.page-title {
  font-size: var(--font-size-xxl, 24px);
  font-weight: 700;
  color: var(--color-text-primary, rgba(0,0,0,0.88));
  margin: 0;
  letter-spacing: -0.5px;
}

.page-desc {
  font-size: var(--font-size-md, 14px);
  color: var(--color-text-tertiary, rgba(0,0,0,0.45));
  margin: 4px 0 0 0;
}

.data-tabs {
  background: var(--color-bg-container, #FFFFFF);
  border-radius: var(--radius-md, 12px);
  box-shadow: var(--shadow-sm);
  padding: var(--space-lg, 24px);
  min-height: 500px;
}

/* 给 el-tabs 内部一点样式覆盖 */
.data-tabs :deep(.el-tabs__header) {
  margin-bottom: var(--space-lg, 24px);
}

.data-tabs :deep(.el-tab-pane) {
  outline: none;
}
</style>
