<template>
  <div class="base-data-github">
    <!-- 主内容区 -->
    <div class="main-container">
      <!-- 左侧导航 -->
      <aside class="sidebar-nav">
        <div class="nav-card">
          <div class="nav-card-header">
            <div class="nav-card-title">
              <i class="fa-solid fa-database"></i>
              基础数据
            </div>
          </div>
          <div class="nav-list">
            <div
              v-for="item in navItems"
              :key="item.key"
              class="nav-list-item"
              :class="{ active: currentType === item.key }"
              @click="switchType(item.key)"
            >
              <span>{{ item.label }}</span>
              <span class="nav-count">{{ getItemCount(item.key) }}</span>
            </div>
          </div>
        </div>
      </aside>

      <!-- 中间主内容 -->
      <main class="main-content">
        <!-- 页面标题栏 -->
        <div class="content-header">
          <div class="header-left">
            <h2 class="content-title">{{ currentNavItem?.label }}</h2>
            <span class="content-count">{{ tableData.length }} 条记录</span>
          </div>
          <div class="header-actions">
            <button class="btn btn-primary" @click="handleAdd">
              <i class="fa-solid fa-plus"></i>
              新增
            </button>
            <button class="btn btn-outline" @click="refreshData" :disabled="loading">
              <i class="fa-solid fa-rotate" :class="{ spinning: loading }"></i>
              刷新
            </button>
          </div>
        </div>

        <!-- 工具栏 -->
        <div class="toolbar">
          <div class="toolbar-left">
            <div class="search-box">
              <i class="fa-solid fa-search"></i>
              <input
                type="text"
                v-model="searchKeyword"
                :placeholder="'搜索' + currentNavItem?.label + '...'"
                @input="handleSearch"
              />
            </div>
          </div>
          <div class="toolbar-right">
            <span class="selected-info" v-if="selectedCount > 0">
              已选择 {{ selectedCount }} 项
            </span>
          </div>
        </div>

        <!-- 数据表格 -->
        <div class="table-container">
          <table class="data-table" id="mainTable">
            <thead id="tableHead">
              <tr>
                <th :style="{ width: '40px', textAlign: 'center' }">
                  <input type="checkbox" @change="toggleSelectAll" :checked="isAllSelected">
                </th>
                <th v-for="(col, idx) in currentHeaders" :key="idx"
                    :style="{ width: col.width === 'auto' ? undefined : col.width, textAlign: col.align || 'center' }">
                  {{ col.label }}
                </th>
              </tr>
            </thead>
            <tbody id="tableBody">
              <tr v-if="loading">
                <td :colspan="currentHeaders.length + 1" class="loading-cell">
                  <i class="fa-solid fa-spinner fa-spin"></i> 加载中...
                </td>
              </tr>
              <tr v-else-if="filteredData.length === 0">
                <td :colspan="currentHeaders.length + 1" class="empty-cell">
                  暂无数据
                </td>
              </tr>
              <tr v-for="item in paginatedData" :key="item.id"
                  :class="{ selected: selectedIds.includes(item.id) }"
                  @click="toggleSelect(item.id)">
                <td :style="{ width: '40px', textAlign: 'center' }">
                  <input type="checkbox" :checked="selectedIds.includes(item.id)"
                         @click.stop @change="toggleSelect(item.id)">
                </td>
                <td v-for="(col, idx) in currentHeaders" :key="idx"
                    :style="{ width: col.width === 'auto' ? undefined : col.width, textAlign: col.align || 'center' }"
                    v-html="renderCell(item, col, idx)">
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 分页 -->
        <div class="pagination-container">
          <div class="pagination-info">
            显示 {{ (currentPage - 1) * pageSize + 1 }}-{{ Math.min(currentPage * pageSize, filteredData.length) }}
            共 {{ filteredData.length }} 条
          </div>
          <div class="pagination">
            <button class="page-btn" :disabled="currentPage === 1" @click="currentPage--">
              <i class="fa-solid fa-chevron-left"></i>
            </button>
            <button
              v-for="page in visiblePages"
              :key="page"
              class="page-btn"
              :class="{ active: page === currentPage, ellipsis: page === '...' }"
              :disabled="page === '...'"
              @click="page !== '...' && (currentPage = page)"
            >
              {{ page }}
            </button>
            <button class="page-btn" :disabled="currentPage === totalPages" @click="currentPage++">
              <i class="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        </div>
      </main>

      <!-- 右侧统计栏 -->
      <aside class="sidebar-stats">
        <div class="stats-card">
          <div class="stats-header">
            <i class="fa-solid fa-chart-simple"></i>
            统计信息
          </div>
          <div class="stats-body">
            <div class="stat-item">
              <div class="stat-label">总记录数</div>
              <div class="stat-value">{{ tableData.length }}</div>
            </div>
            <div class="stat-item" v-if="currentType === 'teachers'">
              <div class="stat-label">已排监考</div>
              <div class="stat-value">{{ totalScheduled }}</div>
            </div>
            <div class="stat-item" v-if="currentType === 'classrooms'">
              <div class="stat-label">总容量</div>
              <div class="stat-value">{{ totalCapacity }}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">已选记录</div>
              <div class="stat-value">{{ selectedCount }}</div>
            </div>
          </div>
        </div>
      </aside>
    </div>

    <!-- 教师监考详情模态框 -->
    <div class="modal-overlay" v-if="showScheduleModal" @click="closeScheduleModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <div class="modal-title" id="modalTitle">{{ currentTeacherName }} - 监考安排</div>
          <button class="modal-close" @click="closeScheduleModal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="modal-info-card">
            <div class="modal-info-name" id="modalTeacherName">{{ currentTeacherName }}</div>
            <div class="modal-info-stats">
              <div class="modal-stat-item">固定监考: <span class="modal-stat-tag blue" id="modalFixedCount">{{ teacherScheduleInfo.fixed }}场</span></div>
              <div class="modal-stat-item">流动监考: <span class="modal-stat-tag yellow" id="modalPatrolCount">{{ teacherScheduleInfo.patrol }}场</span></div>
              <div class="modal-stat-item">场次: <span class="modal-stat-ratio" id="modalRatio">{{ teacherScheduleInfo.fixed }} / {{ currentTeacherMaxExams }}</span></div>
            </div>
          </div>

          <!-- 固定监考 -->
          <div class="modal-section-header">
            <i class="fa-solid fa-user-check"></i> 固定监考
          </div>
          <div class="modal-table-wrap" v-if="teacherScheduleInfo.list?.length">
            <table class="modal-table">
              <thead>
                <tr>
                  <th>日期</th>
                  <th>时段</th>
                  <th>课程</th>
                  <th>类型</th>
                  <th>AB卷</th>
                  <th>教室</th>
                  <th>人数</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(exam, idx) in teacherScheduleInfo.list" :key="idx">
                  <td>{{ exam.day }}</td>
                  <td>{{ exam.slot }}</td>
                  <td>{{ exam.course }}</td>
                  <td><span class="badge" :class="exam.type === '公共课' ? 'badge-blue' : 'badge-green'">{{ exam.type }}</span></td>
                  <td><span class="badge" :class="exam.ab === 'B' ? 'badge-yellow' : 'badge-gray'">{{ exam.ab }}</span></td>
                  <td>{{ exam.room }}</td>
                  <td>{{ exam.count }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="modal-empty" v-else>
            <i class="fa-solid fa-inbox"></i>
            <p>暂无固定监考安排</p>
          </div>

          <!-- 流动监考 -->
          <div class="modal-section-header" style="margin-top: 20px;">
            <i class="fa-solid fa-shoe-prints"></i> 流动监考
          </div>
          <div class="modal-table-wrap" v-if="teacherScheduleInfo.patrolList?.length">
            <table class="modal-table">
              <thead>
                <tr>
                  <th>日期</th>
                  <th>时段</th>
                  <th>课程</th>
                  <th>类型</th>
                  <th>AB卷</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(exam, idx) in teacherScheduleInfo.patrolList" :key="idx">
                  <td>{{ exam.day }}</td>
                  <td>{{ exam.slot }}</td>
                  <td>{{ exam.course }}</td>
                  <td><span class="badge" :class="exam.type === '公共课' ? 'badge-blue' : 'badge-green'">{{ exam.type }}</span></td>
                  <td><span class="badge" :class="exam.ab === 'B' ? 'badge-yellow' : 'badge-gray'">{{ exam.ab }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="modal-empty" v-else>
            <i class="fa-solid fa-inbox"></i>
            <p>暂无流动监考安排</p>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="closeScheduleModal">取消</button>
        </div>
      </div>
    </div>

    <!-- 编辑对话框 -->
    <div class="modal-overlay" v-if="showEditDialog" @click="closeEditDialog">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <div class="modal-title">{{ isEditing ? '编辑' : '新增' }} {{ currentNavItem?.label }}</div>
          <button class="modal-close" @click="closeEditDialog">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group" v-for="field in currentFormFields" :key="field.key">
            <label>{{ field.label }}</label>
            <input
              v-if="field.type === 'input'"
              type="text"
              v-model="editForm[field.key]"
              :placeholder="field.placeholder || '请输入'"
            />
            <input
              v-else-if="field.type === 'number'"
              type="number"
              v-model.number="editForm[field.key]"
              :min="field.min || 0"
              :max="field.max"
            />
            <select v-else-if="field.type === 'select'" v-model="editForm[field.key]">
              <option value="">请选择</option>
              <option v-for="opt in field.options" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
            <label class="checkbox-label" v-else-if="field.type === 'checkbox'">
              <input type="checkbox" v-model="editForm[field.key]" />
              {{ field.checkboxLabel }}
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="closeEditDialog">取消</button>
          <button class="btn btn-primary" @click="saveForm">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { API_MAP, getMajors, getClasses, getTimeSlots, getTeacherExams } from '@/api/index.js'
import { ElMessage, ElMessageBox } from 'element-plus'

/* ================================================================
 * 关联数据缓存（用于映射外键）
 * ================================================================ */
const majorsCache = ref([])
const classesCache = ref([])
const timeSlotsCache = ref([])

async function loadRelationData() {
  try {
    // 获取专业列表
    const majorsRes = await getMajors({ limit: 1000 })
    majorsCache.value = majorsRes?.data?.items || majorsRes?.items || []

    // 获取班级列表
    const classesRes = await getClasses({ limit: 1000 })
    classesCache.value = classesRes?.data?.items || classesRes?.items || []

    // 获取时段列表
    const timeSlotsRes = await getTimeSlots({ limit: 100 })
    timeSlotsCache.value = timeSlotsRes?.data?.items || timeSlotsRes?.items || []
  } catch (e) {
    console.error('获取关联数据失败:', e)
  }
}

function getMajorName(majorId) {
  if (!majorId) return '--'
  // 统一转换为字符串比较
  const major = majorsCache.value.find(m => String(m.id) === String(majorId))
  return major?.name || `--`
}

function getClassName(classId) {
  if (!classId) return '--'
  // 统一转换为字符串比较
  const cls = classesCache.value.find(c => String(c.id) === String(classId))
  return cls?.name || `--`
}

function getSlotTime(slotId) {
  if (!slotId) return '--'
  // 统一转换为字符串比较，避免类型不匹配（如 "9" vs 9）
  const slot = timeSlotsCache.value.find(s => String(s.id) === String(slotId))
  if (!slot) return `--`
  // 返回完整格式：周三 08:30-10:10
  return `${slot.day_name} ${slot.start_time}-${slot.end_time}`
}

/* ================================================================
 * 表格配置 - 列宽均匀分布
 * ================================================================ */
const tableHeaders = {
  teachers: [
    { label: 'ID', width: '60px', align: 'center' },
    { label: '姓名', width: '80px', align: 'center' },
    { label: '类型', width: '80px', align: 'center' },
    { label: '最大场次', width: '90px', align: 'center' },
    { label: '当前场次', width: '90px', align: 'center' },
    { label: '启用', width: '60px', align: 'center' },
    { label: '操作', width: '100px', align: 'center' }
  ],
  classrooms: [
    { label: 'ID', width: '60px', align: 'center' },
    { label: '名称', width: '80px', align: 'center' },
    { label: '容量', width: '70px', align: 'center' },
    { label: '类型', width: '70px', align: 'center' },
    { label: '楼栋', width: '100px', align: 'center' },
    { label: '楼层', width: '60px', align: 'center' },
    { label: '启用', width: '60px', align: 'center' },
    { label: '操作', width: '80px', align: 'center' }
  ],
  courses: [
    { label: 'ID', width: '60px', align: 'center' },
    { label: '课程名称', width: 'auto', align: 'center' },
    { label: '类型', width: '80px', align: 'center' },
    { label: 'AB卷', width: '60px', align: 'center' },
    { label: '分配时间', width: '140px', align: 'center' },
    { label: '关联班级', width: '90px', align: 'center' },
    { label: '启用', width: '60px', align: 'center' },
    { label: '操作', width: '80px', align: 'center' }
  ],
  classes: [
    { label: 'ID', width: '60px', align: 'center' },
    { label: '班级名称', width: '140px', align: 'center' },
    { label: '专业', width: '140px', align: 'center' },
    { label: '年级', width: '70px', align: 'center' },
    { label: '人数', width: '60px', align: 'center' },
    { label: '操作', width: '80px', align: 'center' }
  ],
  students: [
    { label: 'ID', width: '60px', align: 'center' },
    { label: '学号', width: '120px', align: 'center' },
    { label: '姓名', width: '80px', align: 'center' },
    { label: '班级', width: '120px', align: 'center' },
    { label: '年级', width: '70px', align: 'center' },
    { label: '操作', width: '80px', align: 'center' }
  ],
  majors: [
    { label: 'ID', width: '60px', align: 'center' },
    { label: '专业名称', width: '180px', align: 'center' },
    { label: '操作', width: '80px', align: 'center' }
  ],
  'time-slots': [
    { label: 'ID', width: '60px', align: 'center' },
    { label: '星期', width: '70px', align: 'center' },
    { label: '时段', width: '70px', align: 'center' },
    { label: '开始时间', width: '90px', align: 'center' },
    { label: '结束时间', width: '90px', align: 'center' },
    { label: '连续', width: '60px', align: 'center' },
    { label: '操作', width: '80px', align: 'center' }
  ]
}

/* ================================================================
 * 表单配置
 * ================================================================ */
const formFields = {
  teachers: [
    { key: 'name', label: '姓名', type: 'input', placeholder: '请输入姓名' },
    { key: 'teacher_type', label: '类型', type: 'select', options: [
      { label: '专任', value: 'full_time' },
      { label: '兼职', value: 'part_time' }
    ]},
    { key: 'max_slots', label: '最大场次', type: 'number', min: 0 }
  ],
  classrooms: [
    { key: 'name', label: '名称', type: 'input', placeholder: '如 5-201' },
    { key: 'capacity', label: '容量', type: 'number', min: 0 },
    { key: 'type', label: '类型', type: 'select', options: [
      { label: '普通', value: 'regular' },
      { label: '阶梯', value: 'tiered' }
    ]},
    { key: 'building', label: '楼栋', type: 'input', placeholder: '如 博学楼A' },
    { key: 'floor', label: '楼层', type: 'number', min: 0 }
  ],
  courses: [
    { key: 'name', label: '课程名称', type: 'input', placeholder: '请输入课程名称' },
    { key: 'course_type', label: '类型', type: 'select', options: [
      { label: '公共课', value: 'public' },
      { label: '专业课', value: 'professional' }
    ]},
    { key: 'needs_ab', label: 'AB卷', type: 'checkbox', checkboxLabel: '需要AB卷' }
  ],
  classes: [
    { key: 'name', label: '班级名称', type: 'input', placeholder: '如 计算机221班' },
    { key: 'major_name', label: '专业', type: 'input', placeholder: '请输入专业名称' },
    { key: 'grade', label: '年级', type: 'number', placeholder: '如 2022' },
    { key: 'student_count', label: '人数', type: 'number', min: 0 }
  ],
  students: [
    { key: 'student_no', label: '学号', type: 'input', placeholder: '请输入学号' },
    { key: 'name', label: '姓名', type: 'input', placeholder: '请输入姓名' },
    { key: 'class_name', label: '班级', type: 'input', placeholder: '请输入班级' },
    { key: 'grade', label: '年级', type: 'number', placeholder: '如 2022' }
  ],
  majors: [
    { key: 'name', label: '专业名称', type: 'input', placeholder: '请输入专业名称' }
  ],
  'time-slots': [
    { key: 'day_of_week', label: '星期', type: 'select', options: [
      { label: '周一', value: 1 },
      { label: '周二', value: 2 },
      { label: '周三', value: 3 },
      { label: '周四', value: 4 },
      { label: '周五', value: 5 }
    ]},
    { key: 'slot_code', label: '时段', type: 'select', options: [
      { label: 'T1', value: 'T1' },
      { label: 'T2', value: 'T2' },
      { label: 'T3', value: 'T3' },
      { label: 'T4', value: 'T4' }
    ]},
    { key: 'start_time', label: '开始时间', type: 'input', placeholder: '如 08:00' },
    { key: 'end_time', label: '结束时间', type: 'input', placeholder: '如 09:40' }
  ]
}

/* ================================================================
 * 导航配置
 * ================================================================ */
const navItems = [
  { key: 'teachers', label: '教师', icon: 'fa-chalkboard-user' },
  { key: 'classrooms', label: '教室', icon: 'fa-school' },
  { key: 'courses', label: '课程', icon: 'fa-book' },
  { key: 'classes', label: '班级', icon: 'fa-users' },
  { key: 'students', label: '学生', icon: 'fa-user-graduate' },
  { key: 'majors', label: '专业', icon: 'fa-graduation-cap' },
  { key: 'time-slots', label: '时段', icon: 'fa-clock' }
]

/* ================================================================
 * 教师监考详情模拟数据
 * ================================================================ */
const teacherSchedules = {
  1: {
    fixed: 4, patrol: 2, max: 6,
    list: [
      { day: '周一', slot: 'T2 10:20-12:00', course: 'XXX新时代中国特色社会主义思想概论', type: '公共课', ab: 'B', room: '5-206', count: 23 },
      { day: '周一', slot: 'T3 14:00-15:40', course: 'C语言程序设计', type: '专业课', ab: '--', room: '5-307', count: 26 },
      { day: '周二', slot: 'T4 15:50-17:30', course: '高等数学1/2', type: '公共课', ab: 'B', room: '5-209', count: 26 },
      { day: '周三', slot: 'T4 15:50-17:30', course: '思想道德与法治1/2', type: '公共课', ab: 'B', room: '5-212', count: 25 }
    ],
    patrolList: [
      { day: '周四', slot: 'T1 08:30-10:10', course: '大学英语1/2', type: '公共课', ab: '--' },
      { day: '周五', slot: 'T3 14:00-15:40', course: '体育与健康1/2', type: '公共课', ab: '--' }
    ]
  }
}

/* ================================================================
 * 状态
 * ================================================================ */
const currentType = ref('teachers')
const tableData = ref([])
const loading = ref(false)
const searchKeyword = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const selectedIds = ref([])
const showScheduleModal = ref(false)
const showEditDialog = ref(false)
const isEditing = ref(false)
const editForm = ref({})
const currentTeacherId = ref(null)
const currentTeacherName = ref('')
const currentTeacherMaxExams = ref(0)

// 每个栏目的数据量缓存
const itemCounts = ref({
  teachers: 0,
  classrooms: 0,
  courses: 0,
  classes: 0,
  students: 0,
  majors: 0,
  'time-slots': 0
})

/* ================================================================
 * 计算属性
 * ================================================================ */
const currentHeaders = computed(() => tableHeaders[currentType.value] || [])
const currentFormFields = computed(() => formFields[currentType.value] || [])
const currentNavItem = computed(() => navItems.find(item => item.key === currentType.value))

const filteredData = computed(() => {
  if (!searchKeyword.value) return tableData.value
  const keyword = searchKeyword.value.toLowerCase()
  return tableData.value.filter(item => {
    return Object.values(item).some(v =>
      String(v).toLowerCase().includes(keyword)
    )
  })
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredData.value.length / pageSize.value)))

const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredData.value.slice(start, start + pageSize.value)
})

const visiblePages = computed(() => {
  const pages = []
  const total = totalPages.value
  const current = currentPage.value

  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i)
  } else {
    pages.push(1)
    if (current > 3) pages.push('...')
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
      pages.push(i)
    }
    if (current < total - 2) pages.push('...')
    pages.push(total)
  }
  return pages
})

const isAllSelected = computed(() => {
  return paginatedData.value.length > 0 && paginatedData.value.every(item => selectedIds.value.includes(item.id))
})

const selectedCount = computed(() => selectedIds.value.length)

const totalScheduled = computed(() => {
  return tableData.value.reduce((sum, t) => sum + (t.current_slots || t.scheduled || 0), 0)
})

const totalCapacity = computed(() => {
  return tableData.value.reduce((sum, c) => sum + (c.capacity || 0), 0)
})

const teacherScheduleInfo = computed(() => {
  return teacherSchedules[currentTeacherId.value] || { fixed: 0, patrol: 0, max: 0, list: [], patrolList: [] }
})

/* ================================================================
 * 方法
 * ================================================================ */
function switchType(type) {
  currentType.value = type
  currentPage.value = 1
  searchKeyword.value = ''
  selectedIds.value = []
  fetchData()
}

function getItemCount(type) {
  return itemCounts.value[type] || 0
}

function handleSearch() {
  currentPage.value = 1
}

function toggleSelect(id) {
  const idx = selectedIds.value.indexOf(id)
  if (idx > -1) {
    selectedIds.value.splice(idx, 1)
  } else {
    selectedIds.value.push(id)
  }
}

function toggleSelectAll(checked) {
  if (checked) {
    paginatedData.value.forEach(item => {
      if (!selectedIds.value.includes(item.id)) {
        selectedIds.value.push(item.id)
      }
    })
  } else {
    paginatedData.value.forEach(item => {
      const idx = selectedIds.value.indexOf(item.id)
      if (idx > -1) selectedIds.value.splice(idx, 1)
    })
  }
}

async function showSchedule(id, name, scheduled) {
  currentTeacherId.value = id
  currentTeacherName.value = name
  const teacher = tableData.value.find(t => t.id === id)
  currentTeacherMaxExams.value = teacher?.max_slots || teacher?.maxExams || 0

  // 从后端获取监考详情
  try {
    const res = await getTeacherExams(id)
    const data = res?.data || res

    // 处理固定监考
    const fixedExams = (data.fixed_exams || []).map(exam => ({
      day: exam.day_name || '--',
      slot: exam.time_range || '--',
      course: exam.course_name || '--',
      type: exam.course_type === 'public' ? '公共课' : '专业课',
      ab: exam.exam_label || '--',
      room: exam.assigned_classroom || '--',
      count: exam.assigned_student_count || 0
    }))

    // 处理流动监考
    const patrolExams = (data.patrol_exams || []).map(exam => ({
      day: exam.day_name || '--',
      slot: exam.time_range || '--',
      course: exam.course_name || '--',
      type: exam.course_type === 'public' ? '公共课' : '专业课',
      ab: exam.exam_label || '--'
    }))

    teacherSchedules[id] = {
      fixed: data.fixed_count || 0,
      patrol: data.patrol_count || 0,
      max: data.max_slots || 0,
      list: fixedExams,
      patrolList: patrolExams
    }
  } catch (e) {
    console.error('获取监考详情失败:', e)
    teacherSchedules[id] = { fixed: 0, patrol: 0, max: 0, list: [], patrolList: [] }
  }

  showScheduleModal.value = true
  document.body.style.overflow = 'hidden'
}

function closeScheduleModal() {
  showScheduleModal.value = false
  document.body.style.overflow = ''
}

function handleAdd() {
  isEditing.value = false
  editForm.value = {}
  showEditDialog.value = true
}

function handleEdit(item) {
  isEditing.value = true
  editForm.value = { ...item }
  showEditDialog.value = true
}

function closeEditDialog() {
  showEditDialog.value = false
}

async function saveForm() {
  try {
    const api = API_MAP[currentType.value]
    if (!api) return

    if (isEditing.value) {
      await api.update(editForm.value.id, editForm.value)
      ElMessage.success('更新成功')
    } else {
      await api.create(editForm.value)
      ElMessage.success('创建成功')
    }

    closeEditDialog()
    fetchData()
  } catch (e) {
    ElMessage.error('保存失败')
  }
}

async function handleDelete(item) {
  try {
    await ElMessageBox.confirm('确定要删除该记录吗？此操作不可恢复。', '确认删除', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    const api = API_MAP[currentType.value]
    if (api) {
      await api.remove(item.id)
      ElMessage.success('删除成功')
      fetchData()
    }
  } catch {
    // 用户取消
  }
}

async function fetchData() {
  loading.value = true
  try {
    const api = API_MAP[currentType.value]
    if (!api) {
      tableData.value = []
      return
    }

    const res = await api.list({ limit: 1000 })

    // 兼容多种返回格式
    let items = []
    if (Array.isArray(res)) {
      items = res
    } else if (res?.data?.items) {
      items = res.data.items
    } else if (res?.items) {
      items = res.items
    } else if (res?.data) {
      items = Array.isArray(res.data) ? res.data : []
    }

    tableData.value = items

    // 更新当前栏目数据量缓存
    itemCounts.value[currentType.value] = items.length
  } catch (e) {
    console.error('获取数据失败:', e)
    tableData.value = []
  } finally {
    loading.value = false
  }
}

function refreshData() {
  fetchData()
}

function renderCell(item, col, idx) {
  const label = col.label

  // 操作列
  if (label === '操作') {
    if (currentType.value === 'teachers') {
      return `<span class="icon-cell" onclick="window.showTeacherSchedule(${item.id}, '${item.name}', ${item.current_slots || 0})"><i class="fa-solid fa-clipboard-list"></i> ${item.current_slots || 0}</span>
              <button class="btn btn-outline btn-sm" onclick="window.handleRowEdit(${item.id})">编辑</button>`
    }
    return `<button class="btn btn-outline btn-sm" onclick="window.handleRowEdit(${item.id})">编辑</button>`
  }

  // 教师当前场次（可点击）
  if (currentType.value === 'teachers' && label === '当前场次') {
    const scheduled = item.current_slots || 0
    return `<span class="icon-cell" onclick="window.showTeacherSchedule(${item.id}, '${item.name}', ${scheduled})"><i class="fa-solid fa-clipboard-list"></i> ${scheduled}</span>`
  }

  // 教师最大场次
  if (currentType.value === 'teachers' && label === '最大场次') {
    return item.max_slots ?? '--'
  }

  // 类型标签
  if (label === '类型') {
    if (currentType.value === 'teachers') {
      const isFullTime = item.teacher_type === 'full_time'
      return `<span style="padding:2px 8px;background:${isFullTime ? 'rgba(82,196,26,0.12)' : 'rgba(250,173,20,0.12)'};color:${isFullTime ? '#52c41a' : '#faad14'};border-radius:3px;font-size:0.786rem;">${isFullTime ? '专任' : '兼职'}</span>`
    }
    if (currentType.value === 'classrooms') {
      const isRegular = item.room_type === 'regular'
      return `<span style="padding:2px 8px;background:${isRegular ? 'rgba(82,196,26,0.12)' : 'rgba(22,104,220,0.12)'};color:${isRegular ? '#52c41a' : '#4ea6ff'};border-radius:3px;font-size:0.786rem;">${isRegular ? '普通' : '阶梯'}</span>`
    }
    if (currentType.value === 'courses') {
      const isPublic = item.course_type === 'public'
      return `<span style="padding:2px 8px;background:${isPublic ? 'rgba(22,104,220,0.12)' : 'rgba(82,196,26,0.12)'};color:${isPublic ? '#4ea6ff' : '#52c41a'};border-radius:3px;font-size:0.786rem;">${isPublic ? '公共课' : '专业课'}</span>`
    }
  }

  // 启用状态
  if (label === '启用') {
    const isEnabled = item.is_active !== false
    return `<span style="padding:2px 8px;background:${isEnabled ? 'rgba(82,196,26,0.12)' : 'rgba(255,77,79,0.12)'};color:${isEnabled ? '#52c41a' : '#ff4d4f'};border-radius:3px;font-size:0.786rem;">${isEnabled ? '是' : '否'}</span>`
  }

  // AB卷
  if (label === 'AB卷') {
    const needsAb = item.needs_ab === true
    return `<span style="padding:2px 8px;background:${needsAb ? 'rgba(250,173,20,0.12)' : 'rgba(255,255,255,0.06)'};color:${needsAb ? '#faad14' : '#8c8c8c'};border-radius:3px;font-size:0.786rem;">${needsAb ? '是' : '否'}</span>`
  }

  // 时段标签
  if (label === '时段' && currentType.value === 'time-slots') {
    return `<span style="padding:2px 8px;background:rgba(22,104,220,0.12);color:#4ea6ff;border-radius:3px;font-size:0.786rem;">${item.slot_code || '--'}</span>`
  }

  // 星期显示
  if (label === '星期' && currentType.value === 'time-slots') {
    const dayNames = ['', '周一', '周二', '周三', '周四', '周五']
    return dayNames[item.day_of_week] || '--'
  }

  // 分配时间（合并日期和时段，显示完整的"周X xx:xx-xx:xx"）
  if (label === '分配时间') {
    const slots = item.scheduled_time_slots
    if (!slots || slots.length === 0) return '--'
    const first = slots[0]
    // 完整格式：周三 08:30-10:10
    const display = `${first.day_name} ${first.start_time}-${first.end_time}`
    if (slots.length > 1) {
      return `${display} <span style="color:#faad14;font-size:0.786rem;">+${slots.length - 1}</span>`
    }
    return display
  }

  // 关联班级
  if (label === '关联班级') {
    const count = item.linked_class_count || (item.classes ? item.classes.length : 0)
    return `<span class="icon-cell" style="cursor:default;"><i class="fa-solid fa-users"></i> ${count || 0}个班</span>`
  }

  // 年级显示
  if (label === '年级') {
    const gradeNames = { 1: '大一', 2: '大二', 3: '大三', 4: '大四' }
    return item.grade ? (gradeNames[item.grade] || `${item.grade}级`) : '--'
  }

  // 专业（班级表）
  if (label === '专业' && currentType.value === 'classes') {
    return getMajorName(item.major_id)
  }

  // 班级（学生表）
  if (label === '班级' && currentType.value === 'students') {
    return getClassName(item.class_id)
  }

  // 连续字段
  if (label === '连续') {
    const isContinuous = item.is_continuous === true
    return `<span style="padding:2px 8px;background:${isContinuous ? 'rgba(82,196,26,0.12)' : 'rgba(255,77,79,0.12)'};color:${isContinuous ? '#52c41a' : '#ff4d4f'};border-radius:3px;font-size:0.786rem;">${isContinuous ? '是' : '否'}</span>`
  }

  // 楼层
  if (label === '楼层') {
    return `${item.floor ?? 0}层`
  }

  // 容量
  if (label === '容量') {
    return item.capacity ?? '--'
  }

  // 人数
  if (label === '人数') {
    return item.student_count ?? '--'
  }

  // 根据字段名直接映射
  const fieldMap = {
    'ID': 'id',
    '姓名': 'name',
    '名称': 'name',
    '课程名称': 'name',
    '班级名称': 'name',
    '专业名称': 'name',
    '学号': 'student_no',
    '开始时间': 'start_time',
    '结束时间': 'end_time'
  }

  const fieldKey = fieldMap[label]
  if (fieldKey && item[fieldKey] !== undefined) {
    return item[fieldKey]
  }

  // 默认显示
  return '-'
}

/* ================================================================
 * 生命周期
 * ================================================================ */
onMounted(() => {
  // 挂载全局方法供 onclick 调用
  window.showTeacherSchedule = showSchedule
  window.handleRowEdit = (id) => {
    const item = tableData.value.find(t => t.id === id)
    if (item) handleEdit(item)
  }
  window.handleRowDelete = (id) => {
    const item = tableData.value.find(t => t.id === id)
    if (item) handleDelete(item)
  }

  // 加载关联数据
  loadRelationData()
  fetchData()
})

// 监听类型变化，获取统计数据
watch(currentType, () => {
  // 更新导航数量
}, { immediate: true })
</script>

<style scoped>
/* ================================================================
   CSS Variables - 深色主题（与仪表盘一致）
   ================================================================ */
.base-data-github {
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
  --color-primary: #4fc3f7;
  --color-primary-hover: #7c4dff;
  --color-success: #00e676;
  --color-warning: #ffd740;
  --color-error: #ff5252;
  --radius: 8px;
  --radius-lg: 12px;
  --shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

/* ================================================================
   主容器布局
   ================================================================ */
.base-data-github {
  min-height: calc(100vh - 64px);
  background: linear-gradient(160deg, #0a0e27 0%, #1a1f3a 100%);
  color: #e0e0e0;
  font-family: var(--font);
  padding: 24px;
  position: relative;
}

/* 网格背景 */
.base-data-github::before {
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

.main-container {
  display: flex;
  gap: 24px;
  max-width: 1600px;
  margin: 0 auto;
  position: relative;
  z-index: 1;
}

/* ================================================================
   左侧导航
   ================================================================ */
.sidebar-nav {
  width: 200px;
  flex-shrink: 0;
}

.nav-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.nav-card-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: rgba(255,255,255,0.03);
}

.nav-card-title {
  font-size: 0.857rem;
  font-weight: 600;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 8px;
}

.nav-list {
  padding: 8px;
}

.nav-list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: var(--radius);
  cursor: pointer;
  transition: all 0.15s;
  font-size: 0.857rem;
  color: var(--text-dim);
}

.nav-list-item:hover {
  background: rgba(79,195,247,0.1);
  color: var(--accent);
}

.nav-list-item.active {
  background: rgba(79,195,247,0.2);
  color: var(--accent);
}

.nav-count {
  font-size: 0.75rem;
  background: rgba(255,255,255,0.05);
  padding: 2px 6px;
  border-radius: 10px;
  color: var(--text-dim);
}

/* ================================================================
   主内容区
   ================================================================ */
.main-content {
  flex: 1;
  min-width: 0;
}

.content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.content-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  color: var(--text);
}

.content-count {
  font-size: 0.857rem;
  color: var(--text-dim);
  background: rgba(255,255,255,0.05);
  padding: 4px 10px;
  border-radius: 12px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

/* ================================================================
   按钮样式
   ================================================================ */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: var(--radius);
  font-size: 0.857rem;
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid transparent;
}

.btn-primary {
  background: linear-gradient(135deg, var(--accent), var(--accent2));
  color: white;
  border-color: transparent;
}

.btn-primary:hover {
  opacity: 0.85;
}

.btn-outline {
  background: transparent;
  color: var(--text-dim);
  border-color: var(--border);
}

.btn-outline:hover {
  color: var(--text);
  border-color: var(--accent);
}

.btn-outline:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-sm {
  padding: 3px 10px;
  font-size: 0.786rem;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ================================================================
   工具栏
   ================================================================ */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  gap: 16px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 6px 12px;
  transition: border-color 0.15s;
}

.search-box:focus-within {
  border-color: var(--accent);
}

.search-box i {
  color: var(--text-dim);
}

.search-box input {
  background: transparent;
  border: none;
  outline: none;
  color: var(--text);
  font-size: 0.857rem;
  width: 200px;
}

.search-box input::placeholder {
  color: var(--text-dim);
}

.selected-info {
  font-size: 0.857rem;
  color: var(--accent);
}

/* ================================================================
   表格
   ================================================================ */
.table-container {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.857rem;
  table-layout: fixed;
}

.data-table th,
.data-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.data-table th {
  background: rgba(255,255,255,0.03);
  color: var(--text-dim);
  font-weight: 500;
  font-size: 0.786rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.data-table td {
  color: var(--text);
}

.data-table tbody tr {
  transition: background 0.15s;
  cursor: pointer;
}

.data-table tbody tr:hover {
  background: rgba(79,195,247,0.1);
}

.data-table tbody tr.selected {
  background: rgba(79,195,247,0.2);
}

.data-table tbody tr:last-child td {
  border-bottom: none;
}

.loading-cell,
.empty-cell {
  text-align: center;
  padding: 40px !important;
  color: var(--text-dim);
}

.checkbox {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--accent);
}

/* ================================================================
   图标单元格
   ================================================================ */
.icon-cell {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  color: var(--text);
  padding: 2px 6px;
  border-radius: 4px;
  transition: all 0.15s;
}

.icon-cell i {
  color: var(--accent);
  font-size: 0.857rem;
}

.icon-cell:hover {
  background: rgba(79,195,247,0.15);
}

.icon-cell:hover i {
  color: var(--accent);
}

/* ================================================================
   分页
   ================================================================ */
.pagination-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
  padding: 12px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}

.pagination-info {
  font-size: 0.857rem;
  color: var(--text-dim);
}

.pagination {
  display: flex;
  align-items: center;
  gap: 4px;
}

.page-btn {
  min-width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: transparent;
  color: var(--text-dim);
  font-size: 0.857rem;
  cursor: pointer;
  transition: all 0.15s;
}

.page-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}

.page-btn.active {
  background: linear-gradient(135deg, var(--accent), var(--accent2));
  border-color: transparent;
  color: white;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-btn.ellipsis {
  border: none;
  cursor: default;
}

/* ================================================================
   右侧统计栏
   ================================================================ */
.sidebar-stats {
  width: 200px;
  flex-shrink: 0;
}

.stats-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  position: sticky;
  top: 24px;
}

.stats-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: rgba(255,255,255,0.03);
  font-size: 0.857rem;
  font-weight: 600;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 8px;
}

.stats-body {
  padding: 16px;
}

.stat-item {
  margin-bottom: 16px;
}

.stat-item:last-child {
  margin-bottom: 0;
}

.stat-label {
  font-size: 0.786rem;
  color: var(--text-dim);
  margin-bottom: 4px;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--accent);
}

/* ================================================================
   模态框
   ================================================================ */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal-content {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  width: 90%;
  max-width: 800px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  background: rgba(255,255,255,0.03);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}

.modal-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text);
}

.modal-close {
  background: transparent;
  border: none;
  color: var(--text-dim);
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  transition: color 0.15s;
}

.modal-close:hover {
  color: var(--text);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.modal-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  background: rgba(255,255,255,0.03);
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
}

/* ================================================================
   模态框内容样式
   ================================================================ */
.modal-info-card {
  background: rgba(255,255,255,0.03);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  margin-bottom: 20px;
}

.modal-info-name {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 12px;
}

.modal-info-stats {
  display: flex;
  gap: 20px;
}

.modal-stat-item {
  font-size: 0.857rem;
  color: var(--text-dim);
}

.modal-stat-tag {
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 0.786rem;
  margin-left: 4px;
}

.modal-stat-tag.blue {
  background: rgba(79,195,247,0.15);
  color: var(--accent);
}

.modal-stat-tag.yellow {
  background: rgba(250, 173, 20, 0.15);
  color: var(--yellow);
}

.modal-stat-ratio {
  color: var(--text);
  font-weight: 500;
  margin-left: 4px;
}

.modal-section-header {
  font-size: 0.857rem;
  font-weight: 600;
  color: var(--text-dim);
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.modal-table-wrap {
  overflow-x: auto;
}

.modal-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.857rem;
}

.modal-table th,
.modal-table td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid var(--border);
}

.modal-table th {
  background: rgba(255,255,255,0.03);
  color: var(--text-dim);
  font-weight: 500;
  font-size: 0.786rem;
}

.badge {
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 0.786rem;
}

.badge-blue {
  background: rgba(79,195,247,0.15);
  color: var(--accent);
}

.badge-green {
  background: rgba(0,230,118,0.15);
  color: var(--green);
}

.badge-yellow {
  background: rgba(250, 173, 20, 0.15);
  color: var(--yellow);
}

.badge-gray {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-dim);
}

.modal-empty {
  text-align: center;
  padding: 40px;
  color: var(--text-dim);
}

.modal-empty i {
  font-size: 2rem;
  margin-bottom: 8px;
}

/* ================================================================
   表单
   ================================================================ */
.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 0.857rem;
  color: var(--text-dim);
  margin-bottom: 6px;
}

.form-group input[type="text"],
.form-group input[type="number"],
.form-group select {
  width: 100%;
  padding: 8px 12px;
  background: rgba(255,255,255,0.08);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 0.857rem;
  transition: border-color 0.15s;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23e0e0e0' d='M6 8L2 4h8z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 32px;
}

.form-group select option {
  background: #1a1f3a;
  color: var(--text);
  padding: 8px;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--accent);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.checkbox-label input {
  width: 16px;
  height: 16px;
  accent-color: var(--accent);
}
</style>
