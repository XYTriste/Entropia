import axios from 'axios'

const apiClient = axios.create({
  baseURL: '/api',
  timeout: 300000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器
apiClient.interceptors.request.use(
  config => {
    return config
  },
  error => {
    return Promise.reject(error)
  }
)

// 响应拦截器 — 直接返回 response.data，统一处理错误
apiClient.interceptors.response.use(
  response => {
    return response.data
  },
  error => {
    const message = error.response?.data?.detail || error.message || '请求失败'
    console.error('API Error:', message)
    return Promise.reject(error)
  }
)

export default apiClient

/* ================================================================
 * 具名 API 函数 — 基础数据 CRUD
 * 由 useCrud 统一调用，便于后续在此处加缓存/重试/日志等逻辑
 * ================================================================ */

/* ---------- 教师 ---------- */
export function getTeachers(params) { return apiClient.get('/teachers/', { params }) }
export function createTeacher(data) { return apiClient.post('/teachers/', data) }
export function updateTeacher(id, data) { return apiClient.put(`/teachers/${id}`, data) }
export function deleteTeacher(id) { return apiClient.delete(`/teachers/${id}`) }

/* ---------- 教室 ---------- */
export function getClassrooms(params) { return apiClient.get('/classrooms/', { params }) }
export function createClassroom(data) { return apiClient.post('/classrooms/', data) }
export function updateClassroom(id, data) { return apiClient.put(`/classrooms/${id}`, data) }
export function deleteClassroom(id) { return apiClient.delete(`/classrooms/${id}`) }

/* ---------- 课程 ---------- */
export function getCourses(params) { return apiClient.get('/courses/', { params }) }
export function createCourse(data) { return apiClient.post('/courses/', data) }
export function updateCourse(id, data) { return apiClient.put(`/courses/${id}`, data) }
export function deleteCourse(id) { return apiClient.delete(`/courses/${id}`) }

/* ---------- 班级 ---------- */
export function getClasses(params) { return apiClient.get('/classes/', { params }) }
export function createClass(data) { return apiClient.post('/classes/', data) }
export function updateClass(id, data) { return apiClient.put(`/classes/${id}`, data) }
export function deleteClass(id) { return apiClient.delete(`/classes/${id}`) }

/* ---------- 时段 ---------- */
export function getTimeSlots(params) { return apiClient.get('/time-slots/', { params }) }
export function createTimeSlot(data) { return apiClient.post('/time-slots/', data) }
export function updateTimeSlot(id, data) { return apiClient.put(`/time-slots/${id}`, data) }
export function deleteTimeSlot(id) { return apiClient.delete(`/time-slots/${id}`) }

/* ---------- 学生 ---------- */
export function getStudents(params) { return apiClient.get('/students/', { params }) }
export function createStudent(data) { return apiClient.post('/students/', data) }
export function updateStudent(id, data) { return apiClient.put(`/students/${id}`, data) }
export function deleteStudent(id) { return apiClient.delete(`/students/${id}`) }

/* ---------- 专业 ---------- */
export function getMajors(params) { return apiClient.get('/majors/', { params }) }
export function createMajor(data) { return apiClient.post('/majors/', data) }
export function updateMajor(id, data) { return apiClient.put(`/majors/${id}`, data) }
export function deleteMajor(id) { return apiClient.delete(`/majors/${id}`) }

/**
 * 实体名称到 API 函数集的映射
 * useCrud 通过 entityPath 查找对应函数，避免字符串拼接 URL
 */
export const API_MAP = {
  teachers:    { list: getTeachers,    create: createTeacher,    update: updateTeacher,    remove: deleteTeacher },
  classrooms:  { list: getClassrooms,  create: createClassroom,  update: updateClassroom,  remove: deleteClassroom },
  courses:     { list: getCourses,     create: createCourse,     update: updateCourse,     remove: deleteCourse },
  classes:     { list: getClasses,     create: createClass,      update: updateClass,      remove: deleteClass },
  'time-slots':{ list: getTimeSlots,   create: createTimeSlot,   update: updateTimeSlot,   remove: deleteTimeSlot },
  students:    { list: getStudents,    create: createStudent,    update: updateStudent,    remove: deleteStudent },
  majors:      { list: getMajors,      create: createMajor,      update: updateMajor,      remove: deleteMajor },
}
