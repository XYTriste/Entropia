/**
 * 考试排考系统 - 前端主逻辑
 * 技术栈: ES6+, Tailwind CSS, Font Awesome, Fetch API
 * 所有代码原生实现，无前端框架依赖
 */

const API_BASE = '/api';

// ==========================================
// 全局应用对象
// ==========================================
const App = {
  // 当前页面状态
  currentPage: 'dashboard',
  currentBaseDataType: 'teachers',
  currentResultView: 'overview',

  // 缓存数据
  cache: {
    teachers: null,
    classrooms: null,
    courses: null,
    classes: null,
    students: null,
    timeSlots: null,
    examOverview: null,
    versions: null,
    auditLogs: null,
  },

  // 分页状态
  pagination: {
    teachers: { page: 1, pageSize: 20, total: 0, search: '' },
    classrooms: { page: 1, pageSize: 20, total: 0, search: '' },
    courses: { page: 1, pageSize: 20, total: 0, search: '' },
    classes: { page: 1, pageSize: 20, total: 0, search: '' },
    students: { page: 1, pageSize: 20, total: 0, search: '' },
    majors: { page: 1, pageSize: 20, total: 0, search: '' },
    timeSlots: { page: 1, pageSize: 20, total: 0, search: '' },
    adjustments: { page: 1, pageSize: 20, total: 0, search: '' },
    auditLogs: { page: 1, pageSize: 20, total: 0 },
  },

  fieldDefs: {
    teachers: [
      { key: 'name', label: '姓名', required: true },
      { key: 'teacher_type', label: '类型', type: 'select', options: [{v:'full_time',t:'专任'},{v:'part_time',t:'兼职'}], required: true },
      { key: 'max_slots', label: '最大监考场次', type: 'number', required: true },
      { key: 'is_active', label: '是否启用', type: 'select', options: [{v:'true',t:'是'},{v:'false',t:'否'}] },
    ],
    classrooms: [
      { key: 'name', label: '教室名称', required: true },
      { key: 'capacity', label: '容量', type: 'number', required: true },
      { key: 'room_type', label: '类型', type: 'select', options: [{v:'regular',t:'普通教室'},{v:'lecture',t:'阶梯教室'}], required: true },
      { key: 'building', label: '楼栋' },
      { key: 'floor', label: '楼层', type: 'number' },
      { key: 'is_active', label: '是否启用', type: 'select', options: [{v:'true',t:'是'},{v:'false',t:'否'}] },
    ],
    courses: [
      { key: 'name', label: '课程名称', required: true },
      { key: 'course_type', label: '课程类型', type: 'select', options: [{v:'public',t:'公共课'},{v:'major',t:'专业课'}], required: true },
      { key: 'needs_ab', label: '是否需要AB卷', type: 'select', options: [{v:'true',t:'是'},{v:'false',t:'否'}], required: true },
      { key: 'dept_assigned_date', label: '公共课已分配日期(1-5)', type: 'number' },
      { key: 'dept_assigned_time_slot_id', label: '公共课已分配时段ID', type: 'number' },
      { key: 'is_active', label: '是否启用', type: 'select', options: [{v:'true',t:'是'},{v:'false',t:'否'}] },
    ],
    classes: [
      { key: 'name', label: '班级名称', required: true },
      { key: 'major_id', label: '专业ID', type: 'number', required: true },
      { key: 'grade', label: '年级(1-4)', type: 'number', required: true },
      { key: 'student_count', label: '学生人数', type: 'number' },
    ],
    students: [
      { key: 'student_no', label: '学号', required: true },
      { key: 'name', label: '姓名', required: true },
      { key: 'class_name', label: '班级名称', required: true },
      { key: 'grade', label: '年级(1-4)', type: 'number', required: true },
    ],
    majors: [
      { key: 'name', label: '专业名称', required: true },
    ],
    timeSlots: [
      { key: 'day_of_week', label: '星期', type: 'select', options: [{v:1,t:'一'},{v:2,t:'二'},{v:3,t:'三'},{v:4,t:'四'},{v:5,t:'五'}], required: true },
      { key: 'slot_code', label: '时段编码(T1-T4)', required: true },
      { key: 'start_time', label: '开始时间', required: true },
      { key: 'end_time', label: '结束时间', required: true },
      { key: 'is_continuous', label: '是否连续', type: 'select', options: [{v:'true',t:'是'},{v:'false',t:'否'}] },
    ],
  },

  // 排考状态
  scheduler: {
    jobId: null,
    status: null,
    courses: [],
    selectedCourses: new Set(),
  },

  // 批量选择状态
  selectedIds: [],

  // ==========================================
  // API 请求封装
  // ==========================================
  api: {
    async request(url, options = {}) {
      const defaultOptions = {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      };
      if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData) && !(options.body instanceof URLSearchParams)) {
        defaultOptions.body = JSON.stringify(options.body);
      } else {
        defaultOptions.body = options.body;
        if (options.body instanceof FormData) {
          delete defaultOptions.headers['Content-Type'];
        }
      }
      try {
        const response = await fetch(url, { ...defaultOptions, ...options, body: defaultOptions.body });
      if (!response.ok) {
        let errorData;
        try { errorData = await response.json(); } catch { errorData = null; }
        let message = `HTTP ${response.status}: ${response.statusText}`;
        if (errorData) {
          if (errorData.detail) {
            if (Array.isArray(errorData.detail)) {
              // FastAPI Pydantic 验证错误：[{loc, msg, type}, ...]
              message = errorData.detail.map(d => {
                const loc = (d.loc || []).join('.');
                return `${loc}: ${d.msg || d.message || JSON.stringify(d)}`;
              }).join('; ');
            } else if (typeof errorData.detail === 'string') {
              message = errorData.detail;
            } else if (typeof errorData.detail === 'object') {
              message = JSON.stringify(errorData.detail);
            } else {
              message = String(errorData.detail);
            }
          } else if (errorData.message) {
            message = errorData.message;
          }
        }
        throw new Error(message);
      }
        if (response.status === 204) return null;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return await response.json();
        }
        return await response.text();
      } catch (error) {
        console.error('API Error:', error);
        App.utils.showToast(error.message || '网络请求失败', 'error');
        throw error;
      }
    },

    async get(url) { return this.request(`${API_BASE}${url}`); },
    async getList(url) {
      const res = await this.request(`${API_BASE}${url}`);
      if (res && res.data && Array.isArray(res.data.items)) return res.data.items;
      if (res && Array.isArray(res.data)) return res.data;
      return [];
    },
    async post(url, data) { return this.request(`${API_BASE}${url}`, { method: 'POST', body: data }); },
    async put(url, data) { return this.request(`${API_BASE}${url}`, { method: 'PUT', body: data }); },
    async delete(url) { return this.request(`${API_BASE}${url}`, { method: 'DELETE' }); },
    async patch(url, data) { return this.request(`${API_BASE}${url}`, { method: 'PATCH', body: data }); },
  },

  // ==========================================
  // 工具函数
  // ==========================================
  utils: {
    formatDate(dateStr) {
      if (!dateStr) return '--';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },
    formatDateTime(dateStr) {
      if (!dateStr) return '--';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    },
    formatTime(timeStr) {
      if (!timeStr) return '--';
      return timeStr.substring(0, 5);
    },
    escapeHtml(str) {
      if (typeof str !== 'string') return str;
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    },
    debounce(fn, delay = 300) {
      let timer;
      return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
      };
    },
    // Toast 通知
    showToast(message, type = 'info', duration = 3000) {
      const container = document.getElementById('toastContainer');
      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      const icons = { success: 'check-circle', error: 'exclamation-circle', warning: 'exclamation-triangle', info: 'info-circle' };
      toast.innerHTML = `<i class="fas fa-${icons[type] || 'info-circle'}"></i><span>${this.escapeHtml(message)}</span>`;
      container.appendChild(toast);
      setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, duration + 300);
    },
    // Modal 弹窗
    showModal(title, contentHtml, onConfirm = null, confirmText = '确认', cancelText = '取消', confirmClass = 'btn-primary') {
      const container = document.getElementById('modalContainer');
      container.innerHTML = `
        <div class="modal-overlay" id="activeModalOverlay" onclick="if(event.target===this)App.utils.hideModal()">
          <div class="modal-content">
            <div class="card-header">
              <h3 class="font-semibold text-gray-800">${this.escapeHtml(title)}</h3>
              <button class="text-gray-400 hover:text-gray-600" onclick="App.utils.hideModal()">
                <i class="fas fa-times"></i>
              </button>
            </div>
            <div class="card-body">${contentHtml}</div>
            <div class="card-body border-t border-gray-200 flex justify-end gap-2" style="padding: 12px 20px;">
              <button class="btn btn-secondary btn-sm" onclick="App.utils.hideModal()">${cancelText}</button>
              ${onConfirm ? `<button class="btn ${confirmClass} btn-sm" id="modalConfirmBtn">${confirmText}</button>` : ''}
            </div>
          </div>
        </div>`;
      if (onConfirm) {
        document.getElementById('modalConfirmBtn').addEventListener('click', async () => {
          const btn = document.getElementById('modalConfirmBtn');
          if (btn && btn.disabled) return;
          const result = await onConfirm();
          if (result !== false) App.utils.hideModal();
        });
      }
    },
    hideModal() {
      document.getElementById('modalContainer').innerHTML = '';
    },
    // 生成课程时段下拉框 HTML（用于 courses 的 dept_assigned_time_slot_id 字段）
    renderCourseSlotSelect(fieldKey, currentValue) {
      const dayNames = ['', '周一', '周二', '周三', '周四', '周五'];
      const slots = App.cache.timeSlots || [];
      const courses = App.cache.courses || [];
      // 找出已被公共课占用的时段
      const occupied = {};
      courses.forEach(c => {
        if (c.course_type === 'public' && c.dept_assigned_time_slot_id) {
          occupied[c.dept_assigned_time_slot_id] = c.name;
        }
      });
      let html = `<select class="form-select" id="form_${fieldKey}"><option value="">--请选择时段--</option>`;
      slots.forEach(ts => {
        const dayName = dayNames[ts.day_of_week] || '';
        const label = `${dayName} ${ts.slot_code} (${ts.start_time}-${ts.end_time})`;
        const occName = occupied[ts.id];
        const isOcc = !!occName;
        const disabled = isOcc ? 'disabled' : '';
        const style = isOcc ? 'style="color:#dc2626;background:#fee2e2;"' : '';
        const occText = isOcc ? ` [已被${occName}占用]` : '';
        const selected = String(ts.id) === String(currentValue) ? 'selected' : '';
        html += `<option value="${ts.id}" ${disabled} ${style} ${selected}>${label}${occText}</option>`;
      });
      html += '</select>';
      if (Object.keys(occupied).length > 0) {
        html += `<div class="text-xs text-gray-500 mt-1"><i class="fas fa-info-circle text-info mr-1"></i>红色选项表示已被其他公共课占用，AB卷课程会同时占用两个连续时段</div>`;
      }
      return html;
    },
    // 检查课程时段冲突
    checkCourseTimeSlotConflict(slotId, excludeCourseId) {
      if (!slotId) return [];
      const courses = App.cache.courses || [];
      const conflicts = [];
      courses.forEach(c => {
        if (c.course_type === 'public' && c.dept_assigned_time_slot_id == slotId) {
          if (excludeCourseId && c.id === excludeCourseId) return;
          conflicts.push(c.name);
        }
      });
      return conflicts;
    },
    // 下载文件
    downloadBlob(blob, filename) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    // 通用表格渲染
    renderTable(tableId, columns, rows, emptyText = '暂无数据') {
      const table = document.getElementById(tableId);
      const thead = table.querySelector('thead');
      const tbody = table.querySelector('tbody');
      // Build header
      thead.innerHTML = '<tr>' + columns.map(c => {
        const headerHtml = c.header && String(c.header).includes('<') ? c.header : this.escapeHtml(c.header);
        return `<th style="${c.width ? `width:${c.width};` : ''}${c.minWidth ? `min-width:${c.minWidth};` : ''}">${headerHtml}</th>`;
      }).join('') + '</tr>';
      // Build body
      if (!rows || rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${columns.length}" class="text-center text-gray-400 py-8">${this.escapeHtml(emptyText)}</td></tr>`;
        return;
      }
      tbody.innerHTML = rows.map((row, idx) => '<tr>' + columns.map(c => `<td>${typeof c.render === 'function' ? c.render(row, idx) : this.escapeHtml(row[c.key] || '--')}</td>`).join('') + '</tr>').join('');
    },
    // 分页组件
    renderPagination(containerId, paginationInfoId, page, pageSize, total, onPageChange) {
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const container = document.getElementById(containerId);
      const infoEl = document.getElementById(paginationInfoId);
      if (infoEl) {
        const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
        const end = Math.min(page * pageSize, total);
        infoEl.textContent = `显示 ${start}-${end} 条，共 ${total} 条`;
      }
      if (!container) return;
      let html = '';
      html += `<button ${page <= 1 ? 'disabled' : ''} onclick="${onPageChange}(${page - 1})"><i class="fas fa-chevron-left"></i></button>`;
      const maxVisible = 7;
      let startPage = Math.max(1, page - Math.floor(maxVisible / 2));
      let endPage = Math.min(totalPages, startPage + maxVisible - 1);
      if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);
      if (startPage > 1) html += `<button onclick="${onPageChange}(1)">1</button>${startPage > 2 ? '<span class="px-1 text-gray-400">...</span>' : ''}`;
      for (let i = startPage; i <= endPage; i++) html += `<button class="${i === page ? 'active' : ''}" onclick="${onPageChange}(${i})">${i}</button>`;
      if (endPage < totalPages) html += `${endPage < totalPages - 1 ? '<span class="px-1 text-gray-400">...</span>' : ''}<button onclick="${onPageChange}(${totalPages})">${totalPages}</button>`;
      html += `<button ${page >= totalPages ? 'disabled' : ''} onclick="${onPageChange}(${page + 1})"><i class="fas fa-chevron-right"></i></button>`;
      container.innerHTML = html;
    },
    // 课程类型标签
    courseTypeBadge(type) {
      const map = { public: '公共课', major: '专业课', elective: '选修课' };
      const cls = { public: 'badge-info', major: 'badge-success', elective: 'badge-gray' };
      return `<span class="badge ${cls[type] || 'badge-gray'}">${map[type] || type}</span>`;
    },
    // 操作类型标签
    operationTypeBadge(type) {
      const map = { CREATE: '创建', UPDATE: '修改', DELETE: '删除', SCHEDULE: '排考', ADJUST: '微调', TRANSFER: '调剂', IMPORT: '导入', EXPORT: '导出' };
      const cls = { CREATE: 'badge-success', UPDATE: 'badge-info', DELETE: 'badge-danger', SCHEDULE: 'badge-warning', ADJUST: 'badge-info', TRANSFER: 'badge-warning', IMPORT: 'badge-success', EXPORT: 'badge-info' };
      return `<span class="badge ${cls[type] || 'badge-gray'}">${map[type] || type}</span>`;
    },
  },

  // ==========================================
  // 导航管理
  // ==========================================
  nav: {
    to(pageName) {
      App.currentPage = pageName;
      // Update nav tabs
      document.querySelectorAll('#mainNav .nav-tab').forEach(t => t.classList.toggle('active', t.dataset.page === pageName));
      // Show/hide page sections
      document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
      const target = document.getElementById(`page-${pageName}`);
      if (target) target.classList.add('active');
      // Render page content
      if (App.pages[pageName]) App.pages[pageName]();
    },
  },

  // ==========================================
  // 页面渲染函数
  // ==========================================
  pages: {
    // ---- 仪表盘 ----
    async dashboard() {
      try {
        // Fetch summary data in parallel
        const [teachers, classrooms, courses, students, versions, examsRes] = await Promise.all([
          App.api.getList('/teachers/').catch(() => []),
          App.api.getList('/classrooms/').catch(() => []),
          App.api.getList('/courses/').catch(() => []),
          App.api.getList('/students/').catch(() => []),
          App.api.getList('/scheduler/versions').catch(() => []),
          App.api.request(`${API_BASE}/exams/`).catch(() => null),
        ]);
        // Cache data
        App.cache.teachers = teachers;
        App.cache.classrooms = classrooms;
        App.cache.courses = courses;
        App.cache.students = students;
        App.cache.versions = versions;

        // Update stats
        const scheduledCount = (examsRes && examsRes.data && examsRes.data.total) || 0;
        const hasPublishedVersion = versions && versions.some(v => v.status === 'published');
        document.getElementById('statTeachers').textContent = teachers.length || 0;
        document.getElementById('statClassrooms').textContent = classrooms.length || 0;
        document.getElementById('statCourses').textContent = courses.length || 0;
        document.getElementById('statStudents').textContent = students.length || 0;
        document.getElementById('statScheduled').textContent = scheduledCount;
        document.getElementById('statPending').textContent = hasPublishedVersion ? 0 : (courses.length || 0);
        const latestVersion = versions && versions.length > 0 ? versions[0].version_no || versions[0].id : '--';
        document.getElementById('statVersion').textContent = latestVersion;
        document.getElementById('currentVersion').textContent = latestVersion;

        // Load recent activity
        await App.pages.loadRecentActivity();
      } catch (e) {
        console.error('Dashboard error:', e);
        App.utils.showToast('加载仪表盘数据失败', 'error');
      }
    },

    async loadRecentActivity() {
      try {
        const logs = await App.api.getList('/audit-logs/');
        const container = document.getElementById('recentActivity');
        if (logs && logs.length > 0) {
          const recent = logs.slice(0, 10);
          const typeIcons = { CREATE: 'plus-circle', UPDATE: 'edit', DELETE: 'trash', SCHEDULE: 'magic', ADJUST: 'sliders-h', TRANSFER: 'exchange-alt', IMPORT: 'file-import', EXPORT: 'file-export' };
          container.innerHTML = `<div class="space-y-2">${recent.map(log => `
            <div class="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-all">
              <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
                <i class="fas fa-${typeIcons[log.operation_type] || 'circle'} text-xs"></i>
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm text-gray-800 truncate">${App.utils.escapeHtml(log.operation_type_display || log.operation_type)} - ${App.utils.escapeHtml(log.entity_name || log.entity_type || '')}</div>
                <div class="text-xs text-gray-500">${App.utils.escapeHtml(log.operator_name || '系统')} · ${App.utils.formatDateTime(log.created_at)}</div>
              </div>
              <span class="badge ${log.operation_type === 'DELETE' ? 'badge-danger' : log.operation_type === 'CREATE' ? 'badge-success' : 'badge-info'} flex-shrink-0">${App.utils.escapeHtml(log.reason || '')}</span>
            </div>
          `).join('')}</div>`;
          return;
        }
        // Fallback: use scheduler versions as activity log
        const versions = App.cache.versions || await App.api.getList('/scheduler/versions').catch(() => []);
        if (versions && versions.length > 0) {
          const recent = versions.slice(0, 10);
          const statusMap = { published: '已发布', draft: '草稿', archived: '已归档' };
          const statusBadge = { published: 'badge-success', draft: 'badge-warning', archived: 'badge-gray' };
          container.innerHTML = `<div class="space-y-2">${recent.map(v => `
            <div class="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-all">
              <div class="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 flex-shrink-0">
                <i class="fas fa-code-branch text-xs"></i>
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm text-gray-800 truncate">排考版本 ${App.utils.escapeHtml(v.version_no || 'V' + v.id)} - ${App.utils.escapeHtml(v.description || '')}</div>
                <div class="text-xs text-gray-500">系统 · ${App.utils.formatDateTime(v.created_at)}</div>
              </div>
              <span class="badge ${statusBadge[v.status] || 'badge-info'} flex-shrink-0">${statusMap[v.status] || v.status}</span>
            </div>
          `).join('')}</div>`;
          return;
        }
        container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>暂无操作记录</p></div>';
      } catch {
        document.getElementById('recentActivity').innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>暂无操作记录</p></div>';
      }
    },

    // ---- 基础数据 ----
    async baseData() {
      await App.pages.renderBaseDataTable();
    },

    async renderBaseDataTable() {
      const type = App.currentBaseDataType;
      const pg = App.pagination[type];
      if (!pg) return;

      // Define columns and fetch data based on type
      let columns = [];
      let data = [];

      try {
        switch (type) {
          case 'teachers':
            columns = [
              { header: 'ID', key: 'id', width: '60px' },
              { header: '姓名', key: 'name' },
              { header: '类型', key: 'teacher_type', render: (r) => `<span class="badge ${r.teacher_type === 'full_time' ? 'badge-info' : 'badge-warning'}">${r.teacher_type === 'full_time' ? '专任' : '兼职'}</span>` },
              { header: '最大场次', key: 'max_slots', width: '80px' },
              { header: '当前场次', key: 'current_slots', width: '80px' },
              { header: '关联监考', key: 'current_slots', width: '100px', render: (r) => `<button class="btn btn-info btn-xs" onclick="App.handlers.viewTeacherExams(${r.id}, '${App.utils.escapeHtml(r.name)}')"><i class="fas fa-user-clock"></i> ${r.current_slots || 0}场</button>` },
              { header: '启用', key: 'is_active', render: (r) => `<span class="badge ${r.is_active !== false ? 'badge-success' : 'badge-danger'}">${r.is_active !== false ? '是' : '否'}</span>` },
              { header: '操作', render: (r) => `<div class="flex gap-1"><button class="btn btn-primary btn-xs" onclick="App.handlers.editItem('${type}', ${r.id})"><i class="fas fa-edit"></i></button><button class="btn btn-danger btn-xs" onclick="App.handlers.deleteItem('${type}', ${r.id})"><i class="fas fa-trash"></i></button></div>`, width: '90px' },
            ];
            data = await App.api.getList('/teachers/');
            break;
          case 'classrooms':
            columns = [
              { header: 'ID', key: 'id', width: '60px' },
              { header: '名称', key: 'name' },
              { header: '容量', key: 'capacity', width: '80px' },
              { header: '类型', key: 'room_type', render: (r) => `<span class="badge badge-info">${App.utils.escapeHtml(r.room_type === 'regular' ? '普通' : '阶梯')}</span>` },
              { header: '楼栋', key: 'building' },
              { header: '楼层', key: 'floor', width: '60px' },
              { header: '启用', key: 'is_active', render: (r) => `<span class="badge ${r.is_active !== false ? 'badge-success' : 'badge-danger'}">${r.is_active !== false ? '是' : '否'}</span>` },
              { header: '操作', render: (r) => `<div class="flex gap-1"><button class="btn btn-primary btn-xs" onclick="App.handlers.editItem('${type}', ${r.id})"><i class="fas fa-edit"></i></button><button class="btn btn-danger btn-xs" onclick="App.handlers.deleteItem('${type}', ${r.id})"><i class="fas fa-trash"></i></button></div>`, width: '90px' },
            ];
            data = await App.api.getList('/classrooms/');
            break;
          case 'courses':
            // 预加载时段数据用于友好显示
            if (!App.cache.timeSlots || App.cache.timeSlots.length === 0) {
              try { App.cache.timeSlots = await App.api.getList('/time-slots/'); } catch(e) {}
            }
            const dayNames = ['', '周一', '周二', '周三', '周四', '周五'];
            const tsMap = {};
            (App.cache.timeSlots || []).forEach(ts => { tsMap[ts.id] = ts; });
            columns = [
              { header: 'ID', key: 'id', width: '60px' },
              { header: '课程名称', key: 'name' },
              { header: '类型', key: 'course_type', render: (r) => `<span class="badge ${r.course_type === 'public' ? 'badge-info' : 'badge-warning'}">${r.course_type === 'public' ? '公共课' : '专业课'}</span>` },
              { header: 'AB卷', key: 'needs_ab', render: (r) => `<span class="badge ${r.needs_ab ? 'badge-warning' : 'badge-gray'}">${r.needs_ab ? '是' : '否'}</span>` },
              { header: '分配日期', key: 'dept_assigned_date', width: '80px', render: (r) => r.dept_assigned_date ? (dayNames[r.dept_assigned_date] || r.dept_assigned_date) : '--' },
              { header: '分配时段', key: 'dept_assigned_time_slot_id', width: '160px', render: (r) => {
                const ts = tsMap[r.dept_assigned_time_slot_id];
                if (ts) {
                  const dayName = dayNames[ts.day_of_week] || '';
                  return `${dayName} ${ts.slot_code} ${ts.start_time}-${ts.end_time}`;
                }
                return r.dept_assigned_time_slot_id || '--';
              }},
              { header: '关联班级', key: 'linked_class_count', width: '100px', render: (r) => {
                const count = r.linked_class_count || (r.linked_classes ? r.linked_classes.length : 0);
                return `<button class="btn btn-info btn-xs" onclick="App.handlers.viewCourseClasses(${r.id}, '${App.utils.escapeHtml(r.name)}')"><i class="fas fa-users"></i> ${count || 0}个班</button>`;
              }},
              { header: '启用', key: 'is_active', render: (r) => `<span class="badge ${r.is_active !== false ? 'badge-success' : 'badge-danger'}">${r.is_active !== false ? '是' : '否'}</span>` },
              { header: '操作', render: (r) => `<div class="flex gap-1"><button class="btn btn-primary btn-xs" onclick="App.handlers.editItem('${type}', ${r.id})"><i class="fas fa-edit"></i></button><button class="btn btn-danger btn-xs" onclick="App.handlers.deleteItem('${type}', ${r.id})"><i class="fas fa-trash"></i></button></div>`, width: '90px' },
            ];
            data = await App.api.getList('/courses/');
            break;
          case 'classes':
            columns = [
              { header: 'ID', key: 'id', width: '60px' },
              { header: '班级名称', key: 'name' },
              { header: '专业', key: 'major_name', render: (r) => App.utils.escapeHtml(r.major_name || '--') },
              { header: '年级', key: 'grade', width: '80px', render: (r) => r.grade ? `${r.grade}级` : '--' },
              { header: '人数', key: 'student_count', width: '60px' },
              { header: '操作', render: (r) => `<div class="flex gap-1"><button class="btn btn-primary btn-xs" onclick="App.handlers.editItem('${type}', ${r.id})"><i class="fas fa-edit"></i></button><button class="btn btn-danger btn-xs" onclick="App.handlers.deleteItem('${type}', ${r.id})"><i class="fas fa-trash"></i></button></div>`, width: '90px' },
            ];
            data = await App.api.getList('/classes/');
            break;
          case 'students':
            columns = [
              { header: 'ID', key: 'id', width: '60px' },
              { header: '学号', key: 'student_no' },
              { header: '姓名', key: 'name' },
              { header: '班级', key: 'class_name', render: (r) => App.utils.escapeHtml(r.class_name || '--') },
              { header: '年级', key: 'grade', width: '60px', render: (r) => r.grade ? `${r.grade}级` : '--' },
              { header: '操作', render: (r) => `<div class="flex gap-1"><button class="btn btn-primary btn-xs" onclick="App.handlers.editItem('${type}', ${r.id})"><i class="fas fa-edit"></i></button><button class="btn btn-danger btn-xs" onclick="App.handlers.deleteItem('${type}', ${r.id})"><i class="fas fa-trash"></i></button></div>`, width: '90px' },
            ];
            data = await App.api.getList('/students/');
            break;
          case 'majors':
            columns = [
              { header: 'ID', key: 'id', width: '60px' },
              { header: '专业名称', key: 'name' },
              { header: '操作', render: (r) => `<div class="flex gap-1"><button class="btn btn-primary btn-xs" onclick="App.handlers.editItem('${type}', ${r.id})"><i class="fas fa-edit"></i></button><button class="btn btn-danger btn-xs" onclick="App.handlers.deleteItem('${type}', ${r.id})"><i class="fas fa-trash"></i></button></div>`, width: '90px' },
            ];
            data = await App.api.getList('/majors/');
            break;
          case 'timeSlots':
            columns = [
              { header: 'ID', key: 'id', width: '60px' },
              { header: '星期', key: 'day_of_week', render: (r) => ['一', '二', '三', '四', '五'][r.day_of_week - 1] || r.day_of_week, width: '60px' },
              { header: '时段', key: 'slot_code', width: '80px' },
              { header: '开始时间', key: 'start_time' },
              { header: '结束时间', key: 'end_time' },
              { header: '连续', key: 'is_continuous', render: (r) => `<span class="badge ${r.is_continuous !== false ? 'badge-success' : 'badge-danger'}">${r.is_continuous !== false ? '是' : '否'}</span>` },
              { header: '操作', render: (r) => `<div class="flex gap-1"><button class="btn btn-primary btn-xs" onclick="App.handlers.editItem('${type}', ${r.id})"><i class="fas fa-edit"></i></button><button class="btn btn-danger btn-xs" onclick="App.handlers.deleteItem('${type}', ${r.id})"><i class="fas fa-trash"></i></button></div>`, width: '90px' },
            ];
            data = await App.api.getList('/time-slots/');
            break;
        }
      } catch (e) {
        App.utils.showToast(`加载${type}数据失败`, 'error');
        return;
      }

      // Cache
      App.cache[type] = data;

      // Filter
      const search = (pg.search || '').toLowerCase();
      if (search) {
        data = data.filter(row => Object.values(row).some(v => String(v).toLowerCase().includes(search)));
      }

      // Client-side pagination
      pg.total = data.length;
      const totalPages = Math.max(1, Math.ceil(data.length / pg.pageSize));
      if (pg.page > totalPages) pg.page = 1;
      const start = (pg.page - 1) * pg.pageSize;
      const pageData = data.slice(start, start + pg.pageSize);

      // Add selection column
      columns.unshift({
        header: '<input type="checkbox" class="form-checkbox" id="selectAllCheckbox" onclick="App.handlers.toggleSelectAllRows(this.checked)">',
        render: (r) => `<input type="checkbox" class="form-checkbox row-checkbox" value="${r.id}" ${App.selectedIds.includes(r.id) ? 'checked' : ''} onchange="App.handlers.handleRowSelect(this)">`,
        width: '40px'
      });

      App.utils.renderTable('baseDataTable', columns, pageData);
      App.utils.renderPagination('baseDataPagination', 'baseDataPaginationInfo', pg.page, pg.pageSize, pg.total, `App.handlers.goToBaseDataPage`);
    },

    // ---- 自动排考 ----
    async scheduler() {
      // Load courses list for selection
      try {
        const courses = await App.api.getList('/courses/');
        App.cache.courses = courses;
        App.scheduler.courses = courses;
        App.renderSchedulerCourseList(courses);
      } catch {
        document.getElementById('schedulerCourseList').innerHTML = '<tr><td colspan="6" class="text-center text-gray-400 py-8">加载课程列表失败</td></tr>';
      }
      // Load schedule config
      try {
        const configRes = await App.api.get('/scheduler/config');
        const cfg = configRes.data || {};
        const fixedCount = cfg.fixed_teachers_per_room || 2;
        const radio = document.querySelector(`input[name="fixedTeachersPerRoom"][value="${fixedCount}"]`);
        if (radio) radio.checked = true;
        const maxDaysEl = document.getElementById('enableMaxDaysConstraint');
        const continuityEl = document.getElementById('enableDayContinuityConstraint');
        if (maxDaysEl) maxDaysEl.checked = cfg.enable_max_days_constraint !== false;
        if (continuityEl) continuityEl.checked = cfg.enable_day_continuity_constraint !== false;
      } catch { /* ignore */ }
    },

    // ---- 排考结果 ----
    async results() {
      // Load versions for version selector
      try {
        const versions = await App.api.getList('/scheduler/versions');
        App.cache.versions = versions;
        const select = document.getElementById('resultVersionSelect');
        select.innerHTML = '<option value="">最新版本</option>' +
          (versions || []).map(v => `<option value="${v.id}">${App.utils.escapeHtml(v.version_name || v.version_number || 'V' + v.id)}</option>`).join('');
      } catch { /* ignore */ }
      // Load current view
      await App.handlers.switchResultView(App.currentResultView);
    },

    // ---- 手动微调 ----
    async adjustments() {
      await App.pages.loadAdjustmentsTable();
    },

    async loadAdjustmentsTable() {
      try {
        const response = await App.api.get('/exams/?limit=1000');
        App.cache.examOverview = response;
        let items = response.data?.items || [];

        // 每个 exam_classroom 展开为一行，支持精确微调
        let rows = [];
        for (const e of items) {
          const dayName = e.time_slot?.day_name || '';
          const dayOrderMap = { '周一': 1, '周二': 2, '周三': 3, '周四': 4, '周五': 5, '周六': 6, '周日': 7 };
          const dayOfWeek = e.time_slot?.day_of_week ?? dayOrderMap[dayName] ?? 99;
          const slotCode = e.time_slot?.slot_code || '';
          const slotOrder = { T1: 1, T2: 2, T3: 3, T4: 4, T5: 5 };
          const slotIdx = slotOrder[slotCode] ?? 99;
          for (const ec of (e.classrooms || [])) {
            const fixedTeachers = (e.teachers || []).filter(t => t.role === 'fixed' && t.classroom_id === ec.classroom_id);
            const patrolTeachers = (e.teachers || []).filter(t => t.role === 'patrol');
            rows.push({
              exam_id: e.id,
              course_id: e.course_id,
              course_name: e.course_name || '',
              course_type: e.course_type || '',
              day_name: dayName,
              day_of_week: dayOfWeek,
              slot_code: slotCode,
              slot_order: slotIdx,
              time_slot_id: e.time_slot?.id ?? null,
              classroom_id: ec.classroom_id,
              classroom_name: ec.classroom_name || '',
              capacity: ec.capacity || 0,
              total_students: ec.total_students || 0,
              classes: ec.classes || [],
              fixed_teachers: fixedTeachers,
              patrol_teachers: patrolTeachers,
              exam_label: e.exam_label || '',
            });
          }
        }

        // 按时间排序（先按星期，再按时段）
        rows.sort((a, b) => {
          if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
          return (a.slot_order || 99) - (b.slot_order || 99);
        });

        const pg = App.pagination.adjustments;

        // Filter
        const searchInput = document.getElementById('adjustmentSearch');
        const typeFilter = document.getElementById('adjustmentFilterType');
        const search = searchInput ? searchInput.value.toLowerCase() : '';
        const fType = typeFilter ? typeFilter.value : '';

        let filtered = rows;
        if (search) {
          filtered = filtered.filter(r =>
            r.course_name.toLowerCase().includes(search) ||
            r.classroom_name.toLowerCase().includes(search) ||
            (r.fixed_teachers || []).some(t => (t.teacher_name || '').toLowerCase().includes(search))
          );
        }
        if (fType) {
          filtered = filtered.filter(r => r.course_type === fType);
        }

        pg.total = filtered.length;
        const start = (pg.page - 1) * pg.pageSize;
        const pageData = filtered.slice(start, start + pg.pageSize);

        const columns = [
          { header: '', render: (r) => `<input type="checkbox" class="form-checkbox" value="${r.exam_id}-${r.classroom_id}">`, width: '40px' },
          { header: '日期', key: 'day_name' },
          { header: '时段', key: 'slot_code' },
          { header: '课程', key: 'course_name' },
          { header: '类型', key: 'course_type', render: (r) => App.utils.courseTypeBadge(r.course_type) },
          { header: '教室', key: 'classroom_name', render: (r) => App.utils.escapeHtml(r.classroom_name) },
          { header: '人数', key: 'total_students', render: (r) => `${r.total_students}/${r.capacity}` },
          { header: '班级', render: (r) => (r.classes || []).map(c => App.utils.escapeHtml(c.class_name)).join(', ') || '--' },
          { header: '固定监考', render: (r) => (r.fixed_teachers || []).map(t => App.utils.escapeHtml(t.teacher_name)).join(', ') || '--' },
          { header: '流动监考', render: (r) => (r.patrol_teachers || []).map(t => App.utils.escapeHtml(t.teacher_name)).join(', ') || '--' },
          { header: '操作', render: (r) => `
            <div class="flex gap-1 flex-wrap">
              <button class="btn btn-warning btn-xs" onclick="App.handlers.openExamAdjustModal(${r.exam_id}, ${r.classroom_id}, '${App.utils.escapeHtml(r.classroom_name)}')"><i class="fas fa-exchange-alt"></i> 调整安排</button>
              <button class="btn btn-primary btn-xs" onclick="App.handlers.openChangeTeacherModal(${r.exam_id}, ${r.classroom_id}, '${App.utils.escapeHtml(r.classroom_name)}')"><i class="fas fa-user"></i> 换教师</button>
            </div>
          `, minWidth: '200px' },
        ];
        App.utils.renderTable('adjustmentTable', columns, pageData);
        App.utils.renderPagination('adjustmentPagination', 'adjustmentPaginationInfo', pg.page, pg.pageSize, pg.total, 'App.handlers.goToAdjustmentPage');
      } catch (err) {
        console.error('加载排考数据失败:', err);
        document.getElementById('adjustmentTableBody').innerHTML = '<tr><td colspan="11" class="text-center text-gray-400 py-8">加载排考数据失败，请先执行自动排考</td></tr>';
      }
    },

    // ---- 教师调剂 ----
    async transfer() {
      await App.pages.loadTeacherSelects();
    },

    async loadTeacherSelects() {
      try {
        const teachers = await App.api.getList('/teachers/');
        App.cache.teachers = teachers;
        const options = teachers.map(t => `<option value="${t.id}">${App.utils.escapeHtml(t.name)} (${t.current_slots || 0}场/${t.max_slots || 0}场)</option>`).join('');
        document.getElementById('teacherASelect').innerHTML = '<option value="">--请选择--</option>' + options;
        document.getElementById('teacherBSelect').innerHTML = '<option value="">--请选择--</option>' + options;
      } catch {
        App.utils.showToast('加载教师列表失败', 'error');
      }
    },

    // ---- 导入导出 ----
    async importExport() {
      // Static page, no dynamic load needed
    },

    // ---- 审计日志 ----
    async auditLogs() {
      await App.pages.loadAuditLogsTable();
    },

    async loadAuditLogsTable() {
      try {
        const pg = App.pagination.auditLogs;
        const params = new URLSearchParams();
        params.set('page', pg.page);
        params.set('page_size', pg.pageSize);
        const opType = document.getElementById('auditOperationType');
        if (opType && opType.value) params.set('operation_type', opType.value);
        const dateFrom = document.getElementById('auditDateFrom');
        if (dateFrom && dateFrom.value) params.set('date_from', dateFrom.value);
        const dateTo = document.getElementById('auditDateTo');
        if (dateTo && dateTo.value) params.set('date_to', dateTo.value);
        const search = document.getElementById('auditSearch');
        if (search && search.value) params.set('search', search.value);

        const data = await App.api.get(`/audit-logs/?${params.toString()}`);
        const payload = data.data || {};
        const logs = payload.items || [];
        const total = payload.total || logs.length;

        const columns = [
          { header: 'ID', key: 'id', width: '80px' },
          { header: '时间', key: 'created_at', render: (r) => App.utils.formatDateTime(r.created_at) },
          { header: '操作人', key: 'operator_name' },
          { header: '操作类型', key: 'operation_type', render: (r) => App.utils.operationTypeBadge(r.operation_type) },
          { header: '实体', key: 'entity_name', render: (r) => `<div class="text-xs">${App.utils.escapeHtml(r.entity_type || '')}: ${App.utils.escapeHtml(r.entity_name || '')}</div>` },
          { header: '变更前', key: 'before_value', render: (r) => `<div class="text-xs text-gray-600 max-w-xs truncate">${App.utils.escapeHtml(JSON.stringify(r.before_value || {}).substring(0, 100))}</div>` },
          { header: '变更后', key: 'after_value', render: (r) => `<div class="text-xs text-gray-600 max-w-xs truncate">${App.utils.escapeHtml(JSON.stringify(r.after_value || {}).substring(0, 100))}</div>` },
          { header: '原因', key: 'reason', render: (r) => `<div class="text-xs">${App.utils.escapeHtml(r.reason || '--')}</div>` },
        ];
        App.utils.renderTable('auditLogTable', columns, logs);
        App.utils.renderPagination('auditPagination', 'auditPaginationInfo', pg.page, pg.pageSize, total, 'App.handlers.goToAuditPage');
      } catch {
        document.getElementById('auditLogTableBody').innerHTML = '<tr><td colspan="8" class="text-center text-gray-400 py-8">加载审计日志失败</td></tr>';
      }
    },
  },

  // ==========================================
  // 辅助渲染函数
  // ==========================================
  renderSchedulerCourseList(courses) {
    const tbody = document.getElementById('schedulerCourseList');
    if (!courses || courses.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-400 py-8">暂无课程数据</td></tr>';
      return;
    }
    const statusMap = {
      scheduled: { text: '已排', cls: 'badge-success' },
      partial: { text: '部分未排', cls: 'badge-warning' },
      unscheduled: { text: '未排', cls: 'badge-gray' },
    };
    tbody.innerHTML = courses.map(c => {
      const st = statusMap[c.schedule_status] || statusMap.unscheduled;
      return `
      <tr>
        <td><input type="checkbox" class="form-checkbox course-checkbox" value="${c.id}" ${App.scheduler.selectedCourses.has(String(c.id)) ? 'checked' : ''}></td>
        <td>${App.utils.escapeHtml(c.name || c.course_name || '')}</td>
        <td>${App.utils.courseTypeBadge(c.course_type)}</td>
        <td><div class="text-sm">${c.student_count !== undefined ? c.student_count + '人' : '--'}</div>${c.needs_ab ? `<div class="text-xs text-gray-500">A: ${c.a_student_count || 0} / B: ${c.b_student_count || 0}</div>` : ''}</td>
        <td>${App.utils.escapeHtml(c.exam_form || '笔试')}</td>
        <td><button class="badge ${st.cls} cursor-pointer" style="border:none;" onclick="App.handlers.viewCourseScheduleStatus(${c.id}, '${App.utils.escapeHtml(c.name || c.course_name || '').replace(/'/g, '\\\'')}', '${c.schedule_status || 'unscheduled'}')">${st.text}</button></td>
      </tr>
    `;
    }).join('');
    // Bind checkbox events
    tbody.querySelectorAll('.course-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        if (e.target.checked) App.scheduler.selectedCourses.add(e.target.value);
        else App.scheduler.selectedCourses.delete(e.target.value);
      });
    });
  },

  // ==========================================
  // 事件处理函数
  // ==========================================
  handlers: {
    // --- Navigation ---
    goToBaseDataPage(page) { App.pagination[App.currentBaseDataType].page = page; App.pages.renderBaseDataTable(); },
    goToAdjustmentPage(page) { App.pagination.adjustments.page = page; App.pages.loadAdjustmentsTable(); },
    goToAuditPage(page) { App.pagination.auditLogs.page = page; App.pages.loadAuditLogsTable(); },

    // --- Base Data ---
    searchBaseData() {
      const input = document.getElementById('baseDataSearch');
      App.pagination[App.currentBaseDataType].search = input ? input.value : '';
      App.pagination[App.currentBaseDataType].page = 1;
      App.pages.renderBaseDataTable();
    },
    changePageSize() {
      const select = document.getElementById('baseDataPageSize');
      App.pagination[App.currentBaseDataType].pageSize = parseInt(select.value);
      App.pagination[App.currentBaseDataType].page = 1;
      App.pages.renderBaseDataTable();
    },
    async openAddModal() {
      const type = App.currentBaseDataType;
      const fields = App.fieldDefs[type] || [];
      // 预加载 timeSlots（课程管理需要）
      if (type === 'courses' && (!App.cache.timeSlots || App.cache.timeSlots.length === 0)) {
        try { App.cache.timeSlots = await App.api.getList('/time-slots/'); } catch(e) {}
      }
      const formHtml = fields.map(f => {
        // 课程管理的时段字段使用下拉框
        if (type === 'courses' && f.key === 'dept_assigned_time_slot_id') {
          return `
            <div class="form-group">
              <label class="form-label">${App.utils.escapeHtml(f.label)}</label>
              ${App.utils.renderCourseSlotSelect(f.key, '')}
            </div>
          `;
        }
        return `
          <div class="form-group">
            <label class="form-label">${App.utils.escapeHtml(f.label)}${f.required ? ' <span class="text-danger">*</span>' : ''}</label>
            ${f.type === 'select'
              ? `<select class="form-select" id="form_${f.key}">${f.options.map(o => `<option value="${o.v}">${App.utils.escapeHtml(o.t)}</option>`).join('')}</select>`
              : `<input type="${f.type || 'text'}" class="form-input" id="form_${f.key}" ${f.required ? 'required' : ''}>`}
          </div>
        `;
      }).join('');
      App.utils.showModal('新增' + App.currentBaseDataType, formHtml, () => App.handlers.submitAddItem(type, fields), '保存');
    },
    async submitAddItem(type, fields) {
      const data = {};
      for (const f of fields) {
        const el = document.getElementById(`form_${f.key}`);
        let val = el ? el.value : '';
        if (f.type === 'number' && val) val = Number(val);
        if (f.required && !val) { App.utils.showToast(`${f.label}不能为空`, 'warning'); return; }
        data[f.key] = val;
      }
      // 课程时段冲突校验
      if (type === 'courses' && data.course_type === 'public' && data.dept_assigned_time_slot_id) {
        const conflicts = App.utils.checkCourseTimeSlotConflict(data.dept_assigned_time_slot_id);
        if (conflicts.length > 0) {
          App.utils.showToast(`时段冲突：该时段已被 ${conflicts.join('、')} 占用，请重新选择`, 'error');
          return;
        }
      }
      const urlMap = { teachers: '/teachers/', classrooms: '/classrooms/', courses: '/courses/', classes: '/classes/', students: '/students/', majors: '/majors/', timeSlots: '/time-slots/' };
      try {
        await App.api.post(urlMap[type], data);
        App.utils.showToast('添加成功', 'success');
        App.pages.renderBaseDataTable();
      } catch (e) {
        App.utils.showToast(e.message || '添加失败', 'error');
      }
    },
    async editItem(type, id) {
      const itemData = (App.cache[type] || []).find(item => item.id === id);
      if (!itemData) { App.utils.showToast('数据不存在', 'warning'); return; }
      const fields = App.fieldDefs[type] || [];
      // 预加载 timeSlots（课程管理需要）
      if (type === 'courses' && (!App.cache.timeSlots || App.cache.timeSlots.length === 0)) {
        try { App.cache.timeSlots = await App.api.getList('/time-slots/'); } catch(e) {}
      }
      const formHtml = fields.map(f => {
        let currentVal = itemData[f.key];
        if (currentVal === undefined || currentVal === null) currentVal = '';
        const valStr = String(currentVal);
        // 课程管理的时段字段使用下拉框
        if (type === 'courses' && f.key === 'dept_assigned_time_slot_id') {
          return `
            <div class="form-group">
              <label class="form-label">${App.utils.escapeHtml(f.label)}</label>
              ${App.utils.renderCourseSlotSelect(f.key, valStr)}
            </div>
          `;
        }
        return `
          <div class="form-group">
            <label class="form-label">${App.utils.escapeHtml(f.label)}${f.required ? ' <span class="text-danger">*</span>' : ''}</label>
            ${f.type === 'select'
              ? `<select class="form-select" id="form_${f.key}">${f.options.map(o => `<option value="${o.v}" ${String(o.v) === valStr ? 'selected' : ''}>${App.utils.escapeHtml(o.t)}</option>`).join('')}</select>`
              : `<input type="${f.type || 'text'}" class="form-input" id="form_${f.key}" value="${App.utils.escapeHtml(valStr)}" ${f.required ? 'required' : ''}>`}
          </div>
        `;
      }).join('');
      App.utils.showModal('编辑' + type, formHtml, () => App.handlers.submitEditItem(type, id, fields), '保存');
    },
    async submitEditItem(type, id, fields) {
      const data = {};
      for (const f of fields) {
        const el = document.getElementById(`form_${f.key}`);
        let val = el ? el.value : '';
        if (f.type === 'number') {
          val = val ? Number(val) : null;
        }
        if (f.required && (val === '' || val === null)) {
          App.utils.showToast(`${f.label}不能为空`, 'warning');
          return;
        }
        data[f.key] = val;
      }
      // 课程时段冲突校验
      if (type === 'courses' && data.course_type === 'public' && data.dept_assigned_time_slot_id) {
        const conflicts = App.utils.checkCourseTimeSlotConflict(data.dept_assigned_time_slot_id, id);
        if (conflicts.length > 0) {
          App.utils.showToast(`时段冲突：该时段已被 ${conflicts.join('、')} 占用，请重新选择`, 'error');
          return;
        }
      }
      const urlMap = { teachers: '/teachers/', classrooms: '/classrooms/', courses: '/courses/', classes: '/classes/', students: '/students/', majors: '/majors/', timeSlots: '/time-slots/' };
      try {
        await App.api.put(`${urlMap[type]}${id}`, data);
        App.utils.showToast('更新成功', 'success');
        App.pages.renderBaseDataTable();
      } catch (e) {
        App.utils.showToast(e.message || '更新失败', 'error');
      }
    },
    async deleteItem(type, id) {
      const urlMap = { teachers: '/teachers/', classrooms: '/classrooms/', courses: '/courses/', classes: '/classes/', students: '/students/', majors: '/majors/', timeSlots: '/time-slots/' };
      App.utils.showModal('确认删除', '确定要删除这条记录吗？此操作不可撤销。', async () => {
        try {
          await App.api.delete(`${urlMap[type]}${id}`);
          App.utils.showToast('删除成功', 'success');
          App.pages.renderBaseDataTable();
        } catch (e) {
          App.utils.showToast(e.message || '删除失败', 'error');
        }
      }, '删除', '取消', 'btn-danger');
    },
    async viewCourseClasses(courseId, courseName) {
      try {
        const res = await App.api.get(`/courses/${courseId}/classes`);
        const classes = (res.data && res.data.classes) ? res.data.classes : [];
        // 按专业排序（major_id 升序），同专业按班级名称升序
        classes.sort((a, b) => {
          const ma = a.major_id || 0;
          const mb = b.major_id || 0;
          if (ma !== mb) return ma - mb;
          return (a.class_name || '').localeCompare(b.class_name || '', 'zh-CN');
        });
        let html = '';
        if (classes.length === 0) {
          html = '<div class="empty-state"><i class="fas fa-users"></i><p>该课程暂无关联班级</p></div>';
        } else {
          // 按专业分组显示
          let currentMajor = null;
          html = '<div class="space-y-3">';
          classes.forEach(c => {
            const majorName = c.major_name || '未分配专业';
            if (majorName !== currentMajor) {
              if (currentMajor !== null) html += '</div></div></div>';
              currentMajor = majorName;
              html += `<div class="card"><div class="card-header" style="padding:10px 16px;background:#F9FAFB;"><h4 class="text-sm font-semibold text-gray-700"><i class="fas fa-graduation-cap text-primary mr-2"></i>${App.utils.escapeHtml(majorName)}</h4></div><div class="card-body" style="padding:12px 16px;"><div class="grid grid-cols-3 gap-2">`;
            }
            html += `<div class="flex items-center gap-2 p-2 bg-gray-50 rounded text-sm text-gray-700"><i class="fas fa-user-graduate text-gray-400"></i><span>${App.utils.escapeHtml(c.class_name || '--')}</span><span class="text-xs text-gray-400">(${c.grade}级)</span></div>`;
          });
          if (currentMajor !== null) html += '</div></div></div>';
          html += '</div>';
        }
        App.utils.showModal(`${App.utils.escapeHtml(courseName)} - 关联班级（共${classes.length}个班）`, html, null);
      } catch (e) {
        App.utils.showToast('加载班级列表失败', 'error');
      }
    },
    viewCourseScheduleStatus(courseId, courseName, scheduleStatus) {
      const allCourses = App.scheduler.courses || App.cache.courses || [];
      const course = allCourses.find(c => String(c.id) === String(courseId));
      if (!course) {
        App.utils.showToast('课程数据未加载，请刷新页面', 'warning');
        return;
      }
      const scheduled = course.scheduled_classes || [];
      const unscheduled = course.unscheduled_classes || [];
      const statusText = { scheduled: '已排', partial: '部分未排', unscheduled: '未排' }[scheduleStatus] || '未排';

      let html = '<div class="space-y-4">';
      html += `<div class="text-sm text-gray-500">排考状态：<span class="badge ${scheduleStatus === 'scheduled' ? 'badge-success' : scheduleStatus === 'partial' ? 'badge-warning' : 'badge-gray'}">${statusText}</span></div>`;

      if (scheduled.length > 0) {
        html += '<div><div class="text-sm font-semibold text-gray-700 mb-2"><i class="fas fa-check-circle text-success mr-1"></i>已排班级（' + scheduled.length + '个）</div><div class="grid grid-cols-3 gap-2">';
        scheduled.forEach(c => {
          html += `<div class="flex items-center gap-2 p-2 bg-green-50 rounded text-sm text-gray-700"><i class="fas fa-user-graduate text-green-500"></i><span>${App.utils.escapeHtml(c.class_name || '--')}</span><span class="text-xs text-gray-400">(${c.grade}级)</span></div>`;
        });
        html += '</div></div>';
      }

      if (unscheduled.length > 0) {
        html += '<div><div class="text-sm font-semibold text-gray-700 mb-2"><i class="fas fa-times-circle text-danger mr-1"></i>未排班级（' + unscheduled.length + '个）</div><div class="grid grid-cols-3 gap-2">';
        unscheduled.forEach(c => {
          html += `<div class="flex items-center gap-2 p-2 bg-gray-50 rounded text-sm text-gray-700"><i class="fas fa-user-graduate text-gray-400"></i><span>${App.utils.escapeHtml(c.class_name || '--')}</span><span class="text-xs text-gray-400">(${c.grade}级)</span></div>`;
        });
        html += '</div></div>';
      }

      if (scheduled.length === 0 && unscheduled.length === 0) {
        html += '<div class="empty-state py-4"><p>该课程暂无关联班级</p></div>';
      }

      html += '</div>';
      App.utils.showModal(`${App.utils.escapeHtml(courseName)} - 排考状态详情`, html, null);
    },
    showExamDetailModal(e) {
      try {
        const labelText = e.exam_label ? ` <span class="badge badge-gray">${e.exam_label}</span>` : '';

        // 按教室名索引固定监考教师（兼容旧数据：classroom_name 可能为空）
        const fixedTeacherByRoom = {};
        const allFixedTeachers = [];
        if (e.teachers) {
          for (const t of e.teachers) {
            if (t.role === 'fixed') {
              allFixedTeachers.push(t.teacher_name);
              if (t.classroom_name) {
                fixedTeacherByRoom[t.classroom_name] = t.teacher_name;
              }
            }
          }
        }

        // 教室详情表格
        let classroomsHtml = '';
        if (e.classrooms && e.classrooms.length > 0) {
          classroomsHtml = '<table class="data-table text-xs" style="margin-bottom: 12px;"><thead><tr><th>教室</th><th>考试人次</th><th>涉考班级</th><th>监考老师</th></tr></thead><tbody>';
          for (const cr of e.classrooms) {
            const classesText = (cr.classes || []).map(c => `${App.utils.escapeHtml(c.class_name)}(${c.student_count}人)`).join('、') || '--';
            let teacherName = fixedTeacherByRoom[cr.classroom_name];
            if (!teacherName && allFixedTeachers.length === 1) {
              teacherName = allFixedTeachers[0];
            }
            if (!teacherName && allFixedTeachers.length > 0) {
              teacherName = allFixedTeachers.join('、');
            }
            if (!teacherName) teacherName = '--';
            classroomsHtml += `<tr>
              <td>${App.utils.escapeHtml(cr.classroom_name)}</td>
              <td>${cr.total_students}人</td>
              <td>${classesText}</td>
              <td>${App.utils.escapeHtml(teacherName)}</td>
            </tr>`;
          }
          classroomsHtml += '</tbody></table>';
        } else {
          classroomsHtml = '<p class="text-sm text-gray-400 mb-3">暂无教室安排</p>';
        }

        // 流动监考
        let teachersHtml = '';
        if (e.teachers && e.teachers.length > 0) {
          const patrol = e.teachers.filter(t => t.role === 'patrol');
          if (patrol.length > 0) {
            teachersHtml += '<div class="mb-2"><span class="text-xs font-semibold text-gray-600">流动监考：</span>';
            teachersHtml += patrol.map(t => {
              const group = t.patrol_group_name ? ` (${App.utils.escapeHtml(t.patrol_group_name)})` : '';
              return `<span class="text-xs px-2 py-1 rounded bg-orange-50 text-orange-700 mr-1">${App.utils.escapeHtml(t.teacher_name)}${group}</span>`;
            }).join('');
            teachersHtml += '</div>';
          }
        } else {
          teachersHtml = '<p class="text-sm text-gray-400 mb-3">暂无教师安排</p>';
        }

        const totalText = e.total_students ? `<span class="text-xs text-gray-500 ml-2">共 ${e.total_students} 人次</span>` : '';

        const html = `
          <div class="mb-3 flex items-center gap-2">
            <span class="text-sm font-semibold text-gray-700">${App.utils.escapeHtml(e.course_name)}${labelText}</span>
            ${totalText}
          </div>
          <div class="mb-2 text-xs font-semibold text-gray-600">教室安排</div>
          ${classroomsHtml}
          <div class="mb-2 text-xs font-semibold text-gray-600">监考教师</div>
          ${teachersHtml}
        `;

        App.utils.showModal(`${App.utils.escapeHtml(e.course_name)} - 考试详情`, html, null, '确定');
      } catch (err) {
        App.utils.showToast('解析考试数据失败', 'error');
      }
    },
    async viewTeacherExams(teacherId, teacherName) {
      try {
        const data = await App.api.get(`/teachers/${teacherId}/exams`);
        const d = data.data || {};
        const fixedExams = d.fixed_exams || [];
        const patrolExams = d.patrol_exams || [];

        let html = `<div class="mb-4 p-3 bg-gray-50 rounded-lg text-sm">
          <div class="font-semibold text-gray-800 mb-2">${App.utils.escapeHtml(d.teacher_name || teacherName || '')}</div>
          <div class="grid grid-cols-3 gap-2">
            <div><span class="text-gray-500">固定监考:</span> <span class="badge badge-info">${d.fixed_count || 0}场</span></div>
            <div><span class="text-gray-500">流动监考:</span> <span class="badge badge-warning">${d.patrol_count || 0}场</span></div>
            <div><span class="text-gray-500">场次:</span> ${d.current_slots || 0} / ${d.max_slots || 0}</div>
          </div>
        </div>`;

        if (fixedExams.length > 0) {
          html += '<div class="mb-3 rounded-lg border border-blue-200 overflow-hidden"><div class="px-3 py-2 bg-blue-50 border-b border-blue-200"><h5 class="text-sm font-semibold text-blue-800"><i class="fas fa-user-tie mr-1"></i>固定监考</h5></div><div class="p-2">';
          html += '<table class="data-table"><thead><tr><th>日期</th><th>时段</th><th>课程</th><th>类型</th><th>AB卷</th><th>分配教室</th><th>总人数</th></tr></thead><tbody>';
          for (const e of fixedExams) {
            const total = e.assigned_student_count || 0;
            html += `<tr>
              <td>${App.utils.escapeHtml(e.day_name || '--')}</td>
              <td>${App.utils.escapeHtml(e.slot_code || '--')} ${App.utils.escapeHtml(e.time_range || '')}</td>
              <td style="max-width: 160px; word-break: break-all; white-space: normal;">${App.utils.escapeHtml(e.course_name || '')}</td>
              <td>${App.utils.courseTypeBadge(e.course_type)}</td>
              <td>${e.exam_label ? `<span class="badge badge-gray">${e.exam_label}</span>` : '--'}</td>
              <td>${App.utils.escapeHtml(e.assigned_classroom || '--')}</td>
              <td>${total || '--'}</td>
            </tr>`;
          }
          html += '</tbody></table></div></div>';
        }

        if (patrolExams.length > 0) {
          html += '<div class="mb-3 rounded-lg border border-amber-200 overflow-hidden"><div class="px-3 py-2 bg-amber-50 border-b border-amber-200"><h5 class="text-sm font-semibold text-amber-800"><i class="fas fa-walking mr-1"></i>流动监考</h5></div><div class="p-2">';
          html += '<table class="data-table"><thead><tr><th>日期</th><th>时段</th><th>课程</th><th>类型</th><th>AB卷</th></tr></thead><tbody>';
          for (const e of patrolExams) {
            html += `<tr>
              <td>${App.utils.escapeHtml(e.day_name || '--')}</td>
              <td>${App.utils.escapeHtml(e.slot_code || '--')} ${App.utils.escapeHtml(e.time_range || '')}</td>
              <td style="max-width: 160px; word-break: break-all; white-space: normal;">${App.utils.escapeHtml(e.course_name || '')}</td>
              <td>${App.utils.courseTypeBadge(e.course_type)}</td>
              <td>${e.exam_label ? `<span class="badge badge-gray">${e.exam_label}</span>` : '--'}</td>
            </tr>`;
          }
          html += '</tbody></table></div></div>';
        }

        if (fixedExams.length === 0 && patrolExams.length === 0) {
          html += '<div class="empty-state py-6"><i class="fas fa-inbox"></i><p>该教师暂无监考安排</p></div>';
        }

        App.utils.showModal(`${App.utils.escapeHtml(d.teacher_name || teacherName || '')} - 监考安排`, html, null);
      } catch (e) {
        App.utils.showToast('加载监考安排失败', 'error');
      }
    },
    toggleSelectAllRows(checked) {
      const checkboxes = document.querySelectorAll('#baseDataTable tbody .row-checkbox');
      checkboxes.forEach(cb => {
        cb.checked = checked;
        const id = parseInt(cb.value);
        if (checked) {
          if (!App.selectedIds.includes(id)) App.selectedIds.push(id);
        } else {
          App.selectedIds = App.selectedIds.filter(sid => sid !== id);
        }
      });
      App.handlers.updateBatchDeleteUI();
    },
    handleRowSelect(checkbox) {
      const id = parseInt(checkbox.value);
      if (checkbox.checked) {
        if (!App.selectedIds.includes(id)) App.selectedIds.push(id);
      } else {
        App.selectedIds = App.selectedIds.filter(sid => sid !== id);
        const selectAll = document.getElementById('selectAllCheckbox');
        if (selectAll) selectAll.checked = false;
      }
      App.handlers.updateBatchDeleteUI();
    },
    updateBatchDeleteUI() {
      const btn = document.getElementById('btnBatchDelete');
      const countSpan = document.getElementById('batchDeleteCount');
      if (btn) btn.disabled = App.selectedIds.length === 0;
      if (countSpan) countSpan.textContent = App.selectedIds.length;
    },
    batchDelete() {
      if (App.selectedIds.length === 0) return;
      App.utils.showModal('确认删除', `确定要删除选中的 ${App.selectedIds.length} 条数据吗？此操作不可撤销。`, async () => {
        const entityMap = {
          'teachers': 'teachers',
          'classrooms': 'classrooms',
          'students': 'students',
          'courses': 'courses',
          'classes': 'classes',
          'timeSlots': 'time-slots',
        };
        const entity = entityMap[App.currentBaseDataType];
        if (!entity) {
          App.utils.showToast('当前类型不支持批量删除', 'error');
          return;
        }
        try {
          const res = await App.api.post(`/import-export/batch-delete/${entity}`, { ids: App.selectedIds });
          if (res.code === 0) {
            App.utils.showToast(`成功删除 ${res.data.deleted_count} 条数据`, 'success');
            App.selectedIds = [];
            App.handlers.updateBatchDeleteUI();
            App.pages.renderBaseDataTable();
          } else {
            App.utils.showToast(res.message || '删除失败', 'error');
          }
        } catch (e) {
          App.utils.showToast(e.message || '删除失败', 'error');
        }
      }, '删除', '取消', 'btn-danger');
    },
    goToImportPage() {
      App.nav.to('importExport');
    },

    // --- Scheduler ---
    selectAllCourses(select) {
      const checkboxes = document.querySelectorAll('#schedulerCourseList .course-checkbox');
      checkboxes.forEach(cb => {
        cb.checked = select;
        if (select) App.scheduler.selectedCourses.add(cb.value);
        else App.scheduler.selectedCourses.delete(cb.value);
      });
      document.getElementById('courseSelectAll').checked = select;
    },
    toggleSelectAll() {
      const all = document.getElementById('courseSelectAll').checked;
      App.handlers.selectAllCourses(all);
    },
    filterCourseList() {
      const input = document.getElementById('courseFilterInput');
      const filter = input.value.toLowerCase();
      const filtered = App.scheduler.courses.filter(c => (c.name || c.course_name || '').toLowerCase().includes(filter));
      App.renderSchedulerCourseList(filtered);
    },
    async saveScheduleConfig() {
      const fixedTeachers = document.querySelector('input[name="fixedTeachersPerRoom"]:checked')?.value || '2';
      const enableMaxDays = document.getElementById('enableMaxDaysConstraint')?.checked ?? true;
      const enableContinuity = document.getElementById('enableDayContinuityConstraint')?.checked ?? true;
      try {
        await App.api.put('/scheduler/config', {
          fixed_teachers_per_room: parseInt(fixedTeachers),
          patrol_teacher_count_per_slot_pair: 2,
          patrol_group_rules: [
            { group_name: '5-2及理东二', patterns: ['5-2*', '理东二'] },
            { group_name: '5-3', patterns: ['5-3*'] },
          ],
          classroom_priority_rules: [
            { priority: 1, patterns: ['5-2*'] },
            { priority: 2, patterns: ['5-3*'] },
          ],
          enable_max_days_constraint: enableMaxDays,
          enable_day_continuity_constraint: enableContinuity,
        });
        App.utils.showToast('排考配置已保存', 'success');
      } catch (e) {
        App.utils.showToast(e.message || '保存配置失败', 'error');
      }
    },
    async startScheduler() {
      const strategy = document.getElementById('schedulerStrategy').value;
      const timeout = parseInt(document.getElementById('schedulerTimeout').value) || 300;
      const courseIds = Array.from(App.scheduler.selectedCourses);
      if (courseIds.length === 0) { App.utils.showToast('请至少选择一门课程', 'warning'); return; }

      document.getElementById('schedulerProgressPanel').style.display = 'block';
      document.getElementById('schedulerResultPanel').style.display = 'none';
      document.getElementById('schedulerLogs').innerHTML = '';
      document.getElementById('btnStartScheduler').disabled = true;
      document.getElementById('btnStartScheduler').innerHTML = '<span class="spinner mr-2"></span>排考中...';

      try {
        const result = await App.api.post('/scheduler/run', { courses: courseIds, strategy, timeout });
        const jobId = result.data ? result.data.job_id : result.job_id;
        App.scheduler.jobId = jobId;
        App.handlers.pollSchedulerStatus(jobId);
      } catch (e) {
        App.utils.showToast('启动排考失败: ' + e.message, 'error');
        document.getElementById('btnStartScheduler').disabled = false;
        document.getElementById('btnStartScheduler').innerHTML = '<i class="fas fa-play"></i> 开始自动排考';
      }
    },
    async pollSchedulerStatus(jobId) {
      const maxAttempts = 600;
      let attempts = 0;
      App.scheduler.pollInterval = setInterval(async () => {
        attempts++;
        if (attempts > maxAttempts) { clearInterval(App.scheduler.pollInterval); App.scheduler.pollInterval = null; App.utils.showToast('排考超时', 'error'); return; }
        try {
          const res = await App.api.get(`/scheduler/status/${jobId}`);
          const status = res.data || res;
          const progress = status.progress || 0;
          const stage = status.stage || '';
          const logs = status.logs || [];

          document.getElementById('progressBarFill').style.width = progress + '%';
          document.getElementById('progressPercent').textContent = Math.round(progress) + '%';
          document.getElementById('progressLabel').textContent = stage;
          const logContainer = document.getElementById('schedulerLogs');
          logContainer.innerHTML = logs.map(l => `<div style="margin-bottom:2px;">${App.utils.escapeHtml(l)}</div>`).join('');
          logContainer.scrollTop = logContainer.scrollHeight;

          if (status.status === 'completed') {
            clearInterval(App.scheduler.pollInterval);
            App.scheduler.pollInterval = null;
            App.handlers.onSchedulerComplete(status);
          } else if (status.status === 'failed') {
            clearInterval(App.scheduler.pollInterval);
            App.scheduler.pollInterval = null;
            App.handlers.onSchedulerFailed(status);
          }
        } catch { /* ignore poll errors */ }
      }, 1000);
    },
    stopScheduler() {
      if (App.scheduler.pollInterval) {
        clearInterval(App.scheduler.pollInterval);
        App.scheduler.pollInterval = null;
      }
      document.getElementById('btnStartScheduler').disabled = false;
      document.getElementById('btnStartScheduler').innerHTML = '<i class="fas fa-play"></i> 开始自动排考';
      document.getElementById('schedulerProgressPanel').style.display = 'none';
      App.utils.showToast('已停止排考', 'warning');
    },
    onSchedulerComplete(status) {
      const result = status.result || {};
      document.getElementById('btnStartScheduler').disabled = false;
      document.getElementById('btnStartScheduler').innerHTML = '<i class="fas fa-play"></i> 开始自动排考';
      document.getElementById('schedulerResultPanel').style.display = 'block';
      document.getElementById('schedulerResultBody').innerHTML = `
        <div class="flex items-center gap-2 mb-3"><i class="fas fa-check-circle text-success text-xl"></i><span class="font-semibold text-gray-800">排考成功</span></div>
        <div class="text-sm text-gray-600 mb-2">求解耗时: ${result.solve_time || '--'}</div>
        <div class="text-sm text-gray-600 mb-3">排考版本: ${App.utils.escapeHtml(result.version_no || '')}</div>
        <button class="btn btn-primary" onclick="App.handlers.applyScheduleResult(${result.version_id || 0})">
          <i class="fas fa-check"></i> 应用此排考结果
        </button>
        <button class="btn btn-success ml-2" onclick="App.handlers.exportExcel()">
          <i class="fas fa-file-excel"></i> 导出Excel
        </button>
      `;
      App.utils.showToast('自动排考完成', 'success');
      // 刷新课程列表以更新排考状态
      App.api.getList('/courses/').then(courses => {
        App.scheduler.courses = courses;
        App.cache.courses = courses;
        App.renderSchedulerCourseList(courses);
      }).catch(() => {});
    },
    onSchedulerFailed(status) {
      const result = status.result || {};
      document.getElementById('btnStartScheduler').disabled = false;
      document.getElementById('btnStartScheduler').innerHTML = '<i class="fas fa-play"></i> 开始自动排考';
      document.getElementById('schedulerResultPanel').style.display = 'block';
      document.getElementById('schedulerResultBody').innerHTML = `
        <div class="flex items-center gap-2 mb-3"><i class="fas fa-exclamation-circle text-danger text-xl"></i><span class="font-semibold text-gray-800">排考失败</span></div>
        <div class="text-sm text-danger mb-2">${App.utils.escapeHtml(status.error || result.error || '未知错误')}</div>
        ${result.violations && result.violations.length ? `<div class="text-sm text-gray-600"><strong>冲突分析:</strong><ul class="list-disc ml-4 mt-1">${result.violations.map(c => `<li>${App.utils.escapeHtml(c)}</li>`).join('')}</ul></div>` : ''}
      `;
      App.utils.showToast('自动排考失败', 'error');
    },
    async applyScheduleResult(versionId) {
      try {
        await App.api.post(`/scheduler/apply/${versionId}`);
        App.utils.showToast('排考结果已应用', 'success');
        // 刷新课程列表以更新排考状态
        const courses = await App.api.getList('/courses/');
        App.scheduler.courses = courses;
        App.cache.courses = courses;
        App.renderSchedulerCourseList(courses);
      } catch (e) {
        App.utils.showToast(e.message || '应用失败', 'error');
      }
    },

    // --- Results Views ---
    async switchResultView(view) {
      App.currentResultView = view;
      document.querySelectorAll('#resultsSubTabs .sub-tab').forEach(t => t.classList.toggle('active', t.dataset.view === view));
      document.querySelectorAll('.results-view').forEach(v => v.style.display = 'none');
      document.getElementById(`results-${view}`).style.display = 'block';

      switch (view) {
        case 'overview': await App.handlers.loadOverviewMatrix(); break;
        case 'teacher': await App.handlers.loadTeacherGantt(); break;
        case 'teacher-load': await App.handlers.loadTeacherLoad(); break;
        case 'classroom': await App.handlers.loadClassroomMatrix(); break;
        case 'patrol': await App.handlers.loadPatrolMatrix(); break;
        case 'class': await App.handlers.loadClassView(); break;
        case 'course': await App.handlers.loadCourseView(); break;
      }
    },
    async loadOverviewMatrix() {
      try {
        const data = await App.api.get('/exams/overview/matrix');
        const matrix = data.data?.matrix || {};
        const days = ['周一', '周二', '周三', '周四', '周五'];
        const slots = ['T1', 'T2', 'T3', 'T4'];
        const slotTimeMap = { T1: '08:30-10:10', T2: '10:20-12:00', T3: '14:00-15:40', T4: '15:50-17:30' };

        // 临时存储考试数据，避免在 HTML 属性中内联 JSON
        const examDataStore = [];
        let examIdx = 0;

        let html = '<div class="matrix-grid" style="grid-template-columns: 120px repeat(5, 1fr);">';
        html += '<div class="matrix-header">时段 \\ 日期</div>';
        for (const d of days) html += `<div class="matrix-header">${d}</div>`;

        for (const slot of slots) {
          html += `<div class="matrix-header" style="font-size: 11px; line-height: 1.3; display: flex; align-items: center; justify-content: center; flex-direction: column;"><span>${slotTimeMap[slot]}</span><span>(${slot})</span></div>`;
          for (const day of days) {
            const dayData = matrix[day] || {};
            const slotExams = dayData[slot] || [];
            if (slotExams.length === 0) {
              html += '<div class="matrix-cell text-gray-300 text-center" style="display: flex; align-items: center; justify-content: center;"><i class="fas fa-minus-circle"></i></div>';
            } else {
              html += '<div class="matrix-cell" style="display: flex; flex-direction: column; gap: 4px; padding: 6px;">' + slotExams.map(e => {
                const colorClass = e.exam_label ? 'bg-purple-50 text-purple-700 border-purple-200' : e.course_type === 'public' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-green-50 text-green-700 border-blue-200';
                const idx = examIdx++;
                examDataStore[idx] = e;
                return `<div class="rounded border text-xs ${colorClass} cursor-pointer hover:opacity-80 app-exam-block" data-exam-idx="${idx}" style="flex: 1; display: flex; align-items: center; justify-content: center; min-height: 0; overflow: hidden;">
                  <div class="font-semibold truncate" style="width: 100%; text-align: center; padding: 0 4px;">${App.utils.escapeHtml(e.course_name || '')}${e.exam_label ? ` <span class="badge badge-gray">${e.exam_label}</span>` : ''}</div>
                </div>`;
              }).join('') + '</div>';
            }
          }
        }
        html += '</div>';
        document.getElementById('overviewMatrixContainer').innerHTML = html;

        // 绑定点击事件
        document.querySelectorAll('.app-exam-block').forEach(el => {
          el.addEventListener('click', () => {
            const idx = parseInt(el.dataset.examIdx, 10);
            const examData = examDataStore[idx];
            if (examData) App.handlers.showExamDetailModal(examData);
          });
        });
      } catch {
        document.getElementById('overviewMatrixContainer').innerHTML = '<div class="empty-state"><i class="fas fa-table"></i><p>暂无排考数据</p></div>';
      }
    },
    async loadTeacherGantt() {
      try {
        const select = document.getElementById('teacherGanttSelect');
        // 首次加载或刷新时填充下拉框
        if (!select.dataset.loaded) {
          const teacherList = await App.api.getList('/teachers/');
          const currentVal = select.value;
          select.innerHTML = '<option value="">--请选择教师--</option>' +
            teacherList.map(t => `<option value="${t.id}">${App.utils.escapeHtml(t.name)}</option>`).join('');
          select.value = currentVal;
          select.dataset.loaded = 'true';
        }

        const selectedTeacherId = select.value;
        if (!selectedTeacherId) {
          document.getElementById('teacherGanttContainer').innerHTML = '<div class="empty-state"><i class="fas fa-user-clock"></i><p>请选择教师查看监考安排</p></div>';
          return;
        }

        const data = await App.api.get('/exams/teachers/gantt');
        const allTeachers = data.data?.teachers || [];
        const selectedTeacher = allTeachers.find(t => String(t.teacher_id) === String(selectedTeacherId));

        if (!selectedTeacher) {
          document.getElementById('teacherGanttContainer').innerHTML = '<div class="empty-state"><i class="fas fa-user-clock"></i><p>该教师暂无监考安排</p></div>';
          return;
        }

        const days = ['周一', '周二', '周三', '周四', '周五'];
        const slotDefs = [
          { code: 'T1', time: '08:30-10:10' },
          { code: 'T2', time: '10:20-12:00' },
          { code: 'T3', time: '14:00-15:40' },
          { code: 'T4', time: '15:50-17:30' },
        ];

        // 统计单日场次
        const dayCount = {};
        (selectedTeacher.events || []).forEach(e => { dayCount[e.day_name || e.day_of_week] = (dayCount[e.day_name || e.day_of_week] || 0) + 1; });
        const hasOverload = Object.values(dayCount).some(c => c > 2);
        const totalEvents = (selectedTeacher.events || []).length;
        const fixedCount = (selectedTeacher.events || []).filter(e => e.role === 'fixed').length;
        const patrolCount = (selectedTeacher.events || []).filter(e => e.role === 'patrol' || e.role === 'roaming').length;

        // 单元格样式：允许内容撑开，完整显示4行信息
        const cellStyle = 'min-height: 90px; padding: 8px 6px; display: flex; align-items: center; justify-content: center; text-align: center;';

        let html = '<div style="min-width: 700px;">';
        // 教师信息行
        html += `<div class="p-3 bg-gray-50 border-b border-gray-200 flex items-center gap-4 text-sm mb-2 rounded-t-lg">
          <div class="font-semibold text-gray-800 text-base">${App.utils.escapeHtml(selectedTeacher.teacher_name || '')}</div>
          <div><span class="text-gray-500">总场次:</span> <span class="badge badge-info">${totalEvents}</span></div>
          <div><span class="text-gray-500">固定:</span> <span class="badge badge-primary">${fixedCount}</span></div>
          <div><span class="text-gray-500">流动:</span> <span class="badge badge-warning">${patrolCount}</span></div>
          ${hasOverload ? '<div class="badge badge-danger"><i class="fas fa-exclamation-triangle"></i> 单日超2场</div>' : ''}
        </div>`;

        // 表格头部：横排周一到周五
        html += '<div style="display: flex; border-bottom: 2px solid #E5E7EB; background: #F9FAFB; font-weight: 600; font-size: 13px; color: #374151;">';
        html += '<div style="width: 120px; padding: 10px 12px; border-right: 1px solid #E5E7EB; display: flex; align-items: center;">时段</div>';
        for (const day of days) {
          html += `<div style="flex: 1; padding: 10px; text-align: center; border-right: 1px solid #E5E7EB;">${day}</div>`;
        }
        html += '</div>';

        // 每行：一个时段（纵排）
        for (const slot of slotDefs) {
          html += '<div style="display: flex; border-bottom: 1px solid #F3F4F6;">';
          // 左侧时段标签
          html += `<div style="width: 120px; padding: 10px 12px; border-right: 1px solid #E5E7EB; display: flex; flex-direction: column; justify-content: center; background: #FAFBFC;">
            <div style="font-weight: 600; font-size: 13px; color: #374151;">${slot.code}</div>
            <div style="font-size: 11px; color: #9CA3AF;">${slot.time}</div>
          </div>`;
          // 每天对应的单元格
          for (const day of days) {
            const event = (selectedTeacher.events || []).find(e => e.day_name === day && e.slot_code === slot.code);
            let bg = '#FFFFFF';
            let color = '';
            if (event) {
              bg = event.role === 'patrol' || event.role === 'roaming' ? '#FFF7ED' : '#EFF6FF';
              color = event.role === 'patrol' || event.role === 'roaming' ? '#9A3412' : '#1E40AF';
            }
            html += `<div style="flex: 1; border-right: 1px solid #F3F4F6; ${cellStyle} background: ${bg};">`;
            if (event) {
              const roomText = event.role === 'patrol' || event.role === 'roaming'
                ? (event.classrooms || []).slice(0, 3).join('、') + ((event.classrooms || []).length > 3 ? '…' : '')
                : (event.assigned_classroom || (event.classrooms || [])[0] || '--');
              const classText = (event.class_names || []).join('、') || '--';
              html += `<div style="width: 100%; color: ${color}; font-size: 11px; line-height: 1.4;">
                <div style="font-weight: 600; font-size: 12px; margin-bottom: 2px;">${App.utils.escapeHtml(event.course_name || '')}</div>
                ${event.exam_label ? `<div style="margin-bottom: 2px;"><span class="badge badge-gray" style="font-size: 10px; padding: 1px 4px;">${event.exam_label}</span></div>` : ''}
                <div style="font-size: 10px; opacity: 0.85; margin-bottom: 1px;"><i class="fas fa-door-open" style="margin-right:2px;"></i>${App.utils.escapeHtml(roomText)}</div>
                <div style="font-size: 10px; opacity: 0.85;"><i class="fas fa-users" style="margin-right:2px;"></i>${App.utils.escapeHtml(classText)}</div>
              </div>`;
            }
            html += '</div>';
          }
          html += '</div>';
        }
        html += '</div>';
        document.getElementById('teacherGanttContainer').innerHTML = html;
      } catch {
        document.getElementById('teacherGanttContainer').innerHTML = '<div class="empty-state"><i class="fas fa-user-clock"></i><p>加载教师监考数据失败</p></div>';
      }
    },
    async loadTeacherLoad() {
      try {
        const container = document.getElementById('teacherLoadContainer');
        const summaryEl = document.getElementById('teacherLoadSummary');

        // 并行获取：已安排教师数据 + 全部教师列表（含上限）
        const [ganttRes, teacherListRes] = await Promise.all([
          App.api.get('/exams/teachers/gantt'),
          App.api.getList('/teachers/?limit=1000&is_active=true'),
        ]);

        const ganttTeachers = ganttRes.data?.teachers || [];
        const allTeachers = teacherListRes || [];

        // 以全部教师为基准构建统计
        const statsMap = {};
        for (const t of allTeachers) {
          statsMap[t.id] = {
            id: t.id,
            name: t.name,
            max_slots: t.max_slots || 0,
            total: 0,
            fixed: 0,
            patrol: 0,
          };
        }

        // 填入实际监考数据
        for (const gt of ganttTeachers) {
          const id = gt.teacher_id;
          if (!statsMap[id]) {
            statsMap[id] = { id, name: gt.teacher_name, max_slots: 999, total: 0, fixed: 0, patrol: 0 };
          }
          const events = gt.events || [];
          statsMap[id].total = events.length;
          statsMap[id].fixed = events.filter(e => e.role === 'fixed').length;
          statsMap[id].patrol = events.filter(e => e.role === 'patrol' || e.role === 'roaming').length;
        }

        // 按总场次降序
        const stats = Object.values(statsMap).sort((a, b) => b.total - a.total);

        // 摘要统计
        const totalTeachers = stats.length;
        const totalEvents = stats.reduce((s, t) => s + t.total, 0);
        const avgLoad = totalTeachers > 0 ? (totalEvents / totalTeachers).toFixed(1) : '0.0';
        const overloadCount = stats.filter(t => t.max_slots > 0 && t.total > t.max_slots).length;
        const zeroCount = stats.filter(t => t.total === 0).length;
        const maxLoad = stats.length > 0 ? stats[0].total : 0;

        // 渲染统计卡片
        summaryEl.innerHTML = `
          <div class="flex-1 bg-white border border-gray-200 rounded-lg p-3 text-center shadow-sm">
            <div class="text-2xl font-bold text-gray-800">${totalTeachers}</div>
            <div class="text-xs text-gray-500 mt-1">教师总数</div>
          </div>
          <div class="flex-1 bg-white border border-gray-200 rounded-lg p-3 text-center shadow-sm">
            <div class="text-2xl font-bold text-blue-600">${avgLoad}</div>
            <div class="text-xs text-gray-500 mt-1">平均场次</div>
          </div>
          <div class="flex-1 bg-white border border-gray-200 rounded-lg p-3 text-center shadow-sm">
            <div class="text-2xl font-bold text-orange-600">${maxLoad}</div>
            <div class="text-xs text-gray-500 mt-1">最高场次</div>
          </div>
          <div class="flex-1 bg-white border ${overloadCount > 0 ? 'border-red-300 bg-red-50' : 'border-gray-200'} rounded-lg p-3 text-center shadow-sm">
            <div class="text-2xl font-bold ${overloadCount > 0 ? 'text-red-600' : 'text-gray-800'}">${overloadCount}</div>
            <div class="text-xs text-gray-500 mt-1">超负荷人数</div>
          </div>
          <div class="flex-1 bg-white border border-gray-200 rounded-lg p-3 text-center shadow-sm">
            <div class="text-2xl font-bold text-gray-400">${zeroCount}</div>
            <div class="text-xs text-gray-500 mt-1">零安排人数</div>
          </div>
        `;

        if (stats.length === 0) {
          container.innerHTML = '<div class="empty-state"><i class="fas fa-chart-bar"></i><p>暂无排考数据</p></div>';
          return;
        }

        // 柱状图
        const maxBarHeight = 280;
        const maxVal = Math.max(maxLoad, ...stats.map(t => t.max_slots).filter(m => m > 0), 1);

        let html = '<div style="display: flex; align-items: flex-end; gap: 10px; min-width: max-content; padding: 10px 10px 50px 30px; height: 380px; position: relative;">';

        // 背景网格线
        for (let i = 0; i <= 5; i++) {
          const y = (i / 5) * maxBarHeight;
          const val = Math.round((1 - i / 5) * maxVal);
          html += `<div style="position: absolute; left: 30px; right: 10px; bottom: ${50 + y}px; border-top: 1px ${i === 0 ? 'solid #E5E7EB' : 'dashed #F3F4F6'}; z-index: 0; pointer-events: none;">
            <span style="position: absolute; left: -26px; top: -8px; font-size: 10px; color: #9CA3AF; width: 22px; text-align: right;">${val}</span>
          </div>`;
        }

        for (const t of stats) {
          const isOverload = t.max_slots > 0 && t.total > t.max_slots;
          const fixedH = Math.max((t.fixed / maxVal) * maxBarHeight, t.fixed > 0 ? 2 : 0);
          const patrolH = Math.max((t.patrol / maxVal) * maxBarHeight, t.patrol > 0 ? 2 : 0);
          const barH = Math.max((t.total / maxVal) * maxBarHeight, 2);
          const maxLineH = t.max_slots > 0 ? (t.max_slots / maxVal) * maxBarHeight : 0;

          html += `<div style="display: flex; flex-direction: column; align-items: center; width: 52px; position: relative; z-index: 1; flex-shrink: 0;">
            <div style="font-size: 11px; font-weight: 600; color: ${isOverload ? '#DC2626' : '#374151'}; margin-bottom: 4px;">${t.total}</div>
            <div style="width: 40px; background: ${isOverload ? '#FEE2E2' : '#F3F4F6'}; border-radius: 4px 4px 0 0; position: relative; overflow: visible; height: ${barH}px; display: flex; flex-direction: column; justify-content: flex-end; border: 1px solid ${isOverload ? '#FECACA' : 'transparent'};">
              ${t.fixed > 0 ? `<div style="width: 100%; background: #3B82F6; height: ${fixedH}px; border-radius: 4px 4px 0 0; min-height: 2px;" title="固定监考 ${t.fixed}场"></div>` : ''}
              ${t.patrol > 0 ? `<div style="width: 100%; background: #F97316; height: ${patrolH}px; min-height: 2px;" title="流动监考 ${t.patrol}场"></div>` : ''}
              ${maxLineH > 0 ? `<div style="position: absolute; left: -3px; right: -3px; bottom: ${maxLineH}px; border-top: 2px dashed #EF4444; z-index: 2;" title="上限 ${t.max_slots}场"></div>` : ''}
            </div>
            <div style="margin-top: 6px; font-size: 10px; color: #6B7280; text-align: center; width: 52px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${App.utils.escapeHtml(t.name)}（上限${t.max_slots}）">${App.utils.escapeHtml(t.name)}</div>
            ${isOverload ? '<div style="font-size: 9px; color: #DC2626; margin-top: 1px;"><i class="fas fa-exclamation-triangle"></i></div>' : '<div style="height: 14px;"></div>'}
          </div>`;
        }

        html += '</div>';
        container.innerHTML = html;
      } catch (err) {
        console.error(err);
        document.getElementById('teacherLoadContainer').innerHTML = '<div class="empty-state"><i class="fas fa-chart-bar"></i><p>加载教师负荷数据失败</p></div>';
      }
    },

    async loadClassroomMatrix() {
      try {
        const data = await App.api.get('/exams/classrooms/matrix');
        const matrix = data.data?.matrix || {};
        const days = ['周一', '周二', '周三', '周四', '周五'];
        const slots = ['T1', 'T2', 'T3', 'T4'];
        const slotKeys = [];
        for (const d of days) for (const s of slots) slotKeys.push(`${d}-${s}`);

        let html = '<div style="min-width: 800px;">';
        html += '<div class="gantt-row" style="background: #F9FAFB; font-weight: 600; font-size: 12px; color: #6B7280;">';
        html += '<div class="gantt-label" style="width: 120px;">教室</div>';
        for (const sk of slotKeys) html += `<div class="gantt-slot" style="text-align: center; padding: 8px; font-size: 11px;">${App.utils.escapeHtml(sk)}</div>`;
        html += '</div>';
        for (const [roomName, roomData] of Object.entries(matrix)) {
          html += '<div class="gantt-row">';
          html += `<div class="gantt-label" style="width: 120px; font-size: 11px;">${App.utils.escapeHtml(roomName)}</div>`;
          for (const sk of slotKeys) {
            const exams = roomData[sk] || [];
            if (exams.length > 0) {
              const e = exams[0];
              const total = e.total_students || 0;
              html += `<div class="gantt-slot" style="background: #86EFAC; font-size: 10px; display: flex; align-items: center; justify-content: center; text-align: center; line-height: 1.2;">${App.utils.escapeHtml(e.course_name || '')}<br><small>${total}人 ${e.exam_label ? e.exam_label : ''}</small></div>`;
            } else {
              html += '<div class="gantt-slot"></div>';
            }
          }
          html += '</div>';
        }
        html += '</div>';
        document.getElementById('classroomMatrixContainer').innerHTML = html;
      } catch {
        document.getElementById('classroomMatrixContainer').innerHTML = '<div class="empty-state"><i class="fas fa-door-open"></i><p>暂无排考数据</p></div>';
      }
    },
    async loadPatrolMatrix() {
      try {
        const data = await App.api.get('/exams/patrol/matrix');
        const matrix = data.data?.matrix || {};
        const groupColors = data.data?.group_colors || {};
        const days = ['周一', '周二', '周三', '周四', '周五'];
        const slotPairs = [
          { name: '上午', code: 'T1', time: '08:30-12:00' },
          { name: '下午', code: 'T3', time: '14:00-17:30' },
        ];

        // 生成图例
        const groupNameMap = {
          "5-2及理东二": "流动监考5-2和理东二",
          "5-3": "流动监考5-3"
        };
        let legendHtml = '<span class="text-sm text-gray-600 font-medium">区域分组：</span>';
        if (Object.keys(groupColors).length === 0) {
          legendHtml += '<span class="text-sm text-gray-400">未配置分组</span>';
        } else {
          for (const [name, color] of Object.entries(groupColors)) {
            const displayName = groupNameMap[name] || name;
            legendHtml += `<span class="text-sm px-2 py-1 rounded mr-2" style="background:${color}; color:#374151;">${App.utils.escapeHtml(displayName)}</span>`;
          }
        }
        document.getElementById('patrolLegend').innerHTML = legendHtml;

        // 矩阵布局：横轴=日期，纵轴=时段对（上午/下午）
        let html = '<div class="matrix-grid" style="grid-template-columns: 120px repeat(5, 1fr);">';
        html += '<div class="matrix-header">时段 \\ 日期</div>';
        for (const d of days) html += `<div class="matrix-header">${d}</div>`;

        for (const sp of slotPairs) {
          html += `<div class="matrix-header" style="font-size: 11px; line-height: 1.3; display: flex; align-items: center; justify-content: center; flex-direction: column;"><span>${sp.time}</span><span>(${sp.name})</span></div>`;
          for (const day of days) {
            const patrolList = (matrix[day] || {})[sp.code] || [];
            if (patrolList.length === 0) {
              html += '<div class="matrix-cell text-gray-300 text-center" style="display: flex; align-items: center; justify-content: center;"><i class="fas fa-minus-circle"></i></div>';
            } else {
              html += '<div class="matrix-cell" style="display: flex; flex-direction: column; gap: 4px; padding: 6px;">';
              for (const p of patrolList) {
                const displayGroupName = groupNameMap[p.patrol_group_name] || p.patrol_group_name;
                const bg = p.patrol_group_name ? (groupColors[p.patrol_group_name] || '#F3F4F6') : '#F3F4F6';
                const groupLabel = p.patrol_group_name ? `<span class="text-xs text-gray-500 ml-1">(${App.utils.escapeHtml(displayGroupName)})</span>` : '';
                html += `<div class="rounded border text-xs" style="background:${bg}; border-color:#E5E7EB; flex:1; display:flex; align-items:center; justify-content:center; min-height:0; overflow:hidden;">
                  <div class="font-semibold truncate" style="width:100%; text-align:center; padding:0 4px; color:#374151;">${App.utils.escapeHtml(p.teacher_name)}${groupLabel}</div>
                </div>`;
              }
              html += '</div>';
            }
          }
        }
        html += '</div>';
        document.getElementById('patrolMatrixContainer').innerHTML = html;
      } catch {
        document.getElementById('patrolMatrixContainer').innerHTML = '<div class="empty-state"><i class="fas fa-walking"></i><p>暂无排考数据</p></div>';
      }
    },
    async loadClassView() {
      try {
        const classes = await App.api.getList('/classes/');
        const select = document.getElementById('classScheduleSelect');
        select.innerHTML = '<option value="">--请选择班级--</option>' + classes.map(c => `<option value="${c.id}">${App.utils.escapeHtml(c.name)}</option>`).join('');
      } catch {
        document.getElementById('classScheduleSelect').innerHTML = '<option value="">加载失败</option>';
      }
    },
    async loadClassSchedule() {
      const classId = document.getElementById('classScheduleSelect').value;
      if (!classId) return;
      try {
        const data = await App.api.get(`/exams/classes/${classId}/schedule`);
        const exams = data.data?.exams || [];
        const days = ['周一', '周二', '周三', '周四', '周五'];
        const slots = ['T1', 'T2', 'T3', 'T4'];
        const slotTimeMap = { T1: '08:30-10:10', T2: '10:20-12:00', T3: '14:00-15:40', T4: '15:50-17:30' };

        // 构建矩阵数据映射: day_name -> slot_code -> exam
        const matrix = {};
        for (const day of days) matrix[day] = { T1: null, T2: null, T3: null, T4: null };
        for (const e of exams) {
          if (e.day_name && e.slot_code && matrix[e.day_name]) {
            matrix[e.day_name][e.slot_code] = e;
          }
        }

        let html = '<div class="matrix-grid" style="grid-template-columns: 120px repeat(5, 1fr);">';
        html += '<div class="matrix-header">时段 \\ 日期</div>';
        for (const d of days) html += `<div class="matrix-header">${d}</div>`;

        for (const slot of slots) {
          html += `<div class="matrix-header" style="font-size: 11px; line-height: 1.3; display: flex; align-items: center; justify-content: center; flex-direction: column;"><span>${slotTimeMap[slot]}</span><span>(${slot})</span></div>`;
          for (const day of days) {
            const exam = matrix[day][slot];
            if (!exam) {
              html += '<div class="matrix-cell text-gray-300 text-center" style="display: flex; align-items: center; justify-content: center;"><i class="fas fa-minus-circle"></i></div>';
            } else {
              const colorClass = exam.exam_label ? 'bg-purple-50 text-purple-700 border-purple-200' : exam.course_type === 'public' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-green-50 text-green-700 border-green-200';
              const classroomLabel = exam.classroom_name ? `教室: ${App.utils.escapeHtml(exam.classroom_name)}` : '';
              const teacherLabel = exam.teacher_names && exam.teacher_names.length ? `教师: ${exam.teacher_names.map(App.utils.escapeHtml).join('、')}` : '';
              html += `<div class="matrix-cell" style="display: flex; flex-direction: column; gap: 4px; padding: 6px;">
                <div class="rounded border text-xs ${colorClass}" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 0; overflow: hidden; gap: 2px; padding: 4px 0;">
                  <div class="font-semibold truncate" style="width: 100%; text-align: center; padding: 0 4px;">${App.utils.escapeHtml(exam.course_name || '')}${exam.exam_label ? ` <span class="badge badge-gray">${exam.exam_label}</span>` : ''}</div>
                  ${classroomLabel ? `<div class="truncate" style="width: 100%; text-align: center; padding: 0 4px; font-size: 10px; color: #6b7280;">${classroomLabel}</div>` : ''}
                  ${teacherLabel ? `<div class="truncate" style="width: 100%; text-align: center; padding: 0 4px; font-size: 10px; color: #6b7280;">${teacherLabel}</div>` : ''}
                </div>
              </div>`;
            }
          }
        }
        html += '</div>';
        document.getElementById('classScheduleContainer').innerHTML = html;
      } catch (e) {
        console.error(e);
        document.getElementById('classScheduleContainer').innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>加载班级排考数据失败</p></div>';
      }
    },
    async loadCourseView() {
      try {
        const courses = await App.api.getList('/courses/');
        const select = document.getElementById('courseDetailSelect');
        select.innerHTML = '<option value="">--请选择课程--</option>' + courses.map(c => `<option value="${c.id}">${App.utils.escapeHtml(c.name || c.course_name || '')}</option>`).join('');
      } catch {
        document.getElementById('courseDetailSelect').innerHTML = '<option value="">加载失败</option>';
      }
    },
    async loadCourseDetail() {
      const courseId = document.getElementById('courseDetailSelect').value;
      if (!courseId) return;
      try {
        const data = await App.api.get(`/exams/courses/${courseId}/detail`);
        const detail = data.data || {};
        const exams = detail.exams || [];
        const abAnalysis = detail.ab_analysis;

        let html = '<div class="card mb-4">';
        html += '<div class="card-header"><h4 class="font-semibold">课程信息</h4></div>';
        html += `<div class="card-body"><div class="grid grid-cols-4 gap-4 text-sm">
          <div><span class="text-gray-500">课程名称:</span> <strong>${App.utils.escapeHtml(detail.course_name || '')}</strong></div>
          <div><span class="text-gray-500">课程类型:</span> ${App.utils.courseTypeBadge(detail.course_type)}</div>
          <div><span class="text-gray-500">AB卷:</span> <span class="badge ${detail.needs_ab ? 'badge-warning' : 'badge-gray'}">${detail.needs_ab ? '是' : '否'}</span></div>
          <div><span class="text-gray-500">考试场次:</span> ${exams.length}</div>
        </div></div></div>`;

        if (abAnalysis) {
          const isBalanced = abAnalysis.balance === '均衡';
          html += `<div class="card ${isBalanced ? '' : 'border-warning'} mb-4">`;
          html += `<div class="card-header"><h4 class="font-semibold">AB卷分卷情况 ${isBalanced ? '<span class="badge badge-success"><i class="fas fa-check"></i> 均衡</span>' : '<span class="badge badge-warning"><i class="fas fa-exclamation-triangle"></i> 不均衡</span>'}</h4></div>`;
          html += '<div class="card-body">';
          html += `<div class="grid grid-cols-3 gap-4 text-sm mb-2 p-3 bg-gray-50 rounded">
            <div><span class="text-gray-500">A卷:</span> ${abAnalysis.a_student_count || 0}人 (${App.utils.escapeHtml(abAnalysis.a_time_slot || '')})</div>
            <div><span class="text-gray-500">B卷:</span> ${abAnalysis.b_student_count || 0}人 (${App.utils.escapeHtml(abAnalysis.b_time_slot || '')})</div>
            <div><span class="text-gray-500">均衡度:</span> ${App.utils.escapeHtml(abAnalysis.balance || '')}</div>
          </div>`;
          html += '</div></div>';
        }

        if (exams.length > 0) {
          html += '<div class="card mb-4">';
          html += '<div class="card-header"><h4 class="font-semibold">考试安排</h4></div>';
          html += '<div class="card-body p-0"><table class="data-table"><thead><tr><th>场次</th><th>时段</th><th>教室</th><th>班级分配</th><th>监考教师</th></tr></thead><tbody>';
          for (let ei = 0; ei < exams.length; ei++) {
            const exam = exams[ei];
            const ts = exam.time_slot || {};
            const timeLabel = `${App.utils.escapeHtml(ts.day_name || '')} ${App.utils.escapeHtml(ts.time_range || '')}(${App.utils.escapeHtml(ts.slot_code || '')})`;
            const classrooms = exam.classrooms || [];
            const fixedTeachers = exam.fixed_teachers || [];

            let roomHtml = '', classHtml = '', teacherHtml = '';
            classrooms.forEach((c, idx) => {
              const isLast = idx === classrooms.length - 1;
              const mb = isLast ? '' : 'margin-bottom:5px;';
              const bg = idx % 2 === 0 ? '#f9fafb' : '#ffffff';
              const boxStyle = `border:1px solid #e5e7eb;border-radius:4px;padding:6px 8px;font-size:13px;${mb}background:${bg};`;
              const hoverAttrs = `data-room-idx="${idx}" data-bg="${bg}" onmouseenter="App.handlers.highlightRoom(${ei}, ${idx}, true)" onmouseleave="App.handlers.highlightRoom(${ei}, ${idx}, false)"`;

              roomHtml += `<div style="${boxStyle}" ${hoverAttrs}>${App.utils.escapeHtml(c.classroom_name || '')} <span style="color:#6b7280;">(${c.total_students || 0}人)</span></div>`;

              const clsList = (c.classes || []).map(a => `${App.utils.escapeHtml(a.class_name || '')} <span style="color:#6b7280;">(${a.student_count || 0}人)</span>`).join('<br>');
              classHtml += `<div style="${boxStyle}" ${hoverAttrs}>${clsList || '--'}</div>`;

              const roomTeachers = fixedTeachers.filter(t => t.classroom_id === c.classroom_id);
              const tList = roomTeachers.map(t => App.utils.escapeHtml(t.teacher_name || '')).join('<br>');
              teacherHtml += `<div style="${boxStyle}" ${hoverAttrs}>${tList || '--'}</div>`;
            });

            html += `<tr data-exam-idx="${ei}">
              <td>${App.utils.escapeHtml(exam.exam_label || '--')}</td>
              <td>${timeLabel}</td>
              <td>${roomHtml || '--'}</td>
              <td>${classHtml || '--'}</td>
              <td>${teacherHtml || '--'}</td>
            </tr>`;
          }
          html += '</tbody></table></div></div>';
        }

        document.getElementById('courseDetailContainer').innerHTML = html;
      } catch {
        document.getElementById('courseDetailContainer').innerHTML = '<div class="card mb-4"><div class="card-body empty-state"><i class="fas fa-book"></i><p>加载课程详情失败</p></div></div>';
      }
    },
    switchVersion() {
      const versionId = document.getElementById('resultVersionSelect').value;
      App.utils.showToast('切换版本: ' + (versionId || '最新'), 'info');
    },

    // --- Adjustments ---
    filterAdjustments() { App.pagination.adjustments.page = 1; App.pages.loadAdjustmentsTable(); },

    // ---- 合并的考试安排调整 Modal ----
    openExamAdjustModal(examId, classroomId, classroomName) {
      const cache = App.cache.examOverview;
      const items = cache?.data?.items || [];
      const exam = items.find(e => String(e.id) === String(examId));
      const currentTimeSlotId = exam?.time_slot?.id ?? null;
      const currentTimeSlotLabel = exam?.time_slot ? `${exam.time_slot.day_name || ''} ${exam.time_slot.slot_code || ''}` : '';

      // 构建占用映射：slotId -> Set<classroomId>，classroomId -> Set<slotId>
      // 注意：排除当前考试自身
      const slotOccupiedRooms = {}; // 该时段已被占用的教室集合
      const roomOccupiedSlots = {}; // 该教室已被占用的时段集合
      for (const e of items) {
        const tsId = e.time_slot?.id;
        if (!tsId) continue;
        for (const ec of (e.classrooms || [])) {
          const crId = ec.classroom_id;
          // 排除当前考试
          if (String(e.id) === String(examId)) continue;
          if (!slotOccupiedRooms[tsId]) slotOccupiedRooms[tsId] = new Set();
          slotOccupiedRooms[tsId].add(crId);
          if (!roomOccupiedSlots[crId]) roomOccupiedSlots[crId] = new Set();
          roomOccupiedSlots[crId].add(tsId);
        }
      }

      // 判断当前时段是否占用当前教室（调时段时该时段不可选）
      const currentSlotHasClassroom = currentTimeSlotId != null && classroomId != null
        && slotOccupiedRooms[currentTimeSlotId]?.has(String(classroomId));

      // 预加载全部时段和教室
      let allSlots = [];
      let allRooms = [];

      const renderSlotOptions = (selectedSlotId) => {
        const dayLabels = ['一','二','三','四','五','六','日'];
        return allSlots.map(s => {
          const isCurrent = currentTimeSlotId != null && s.id === currentTimeSlotId;
          const occByClassroom = classroomId != null && roomOccupiedSlots[classroomId]?.has(s.id);
          const isUnavailable = isCurrent || !!occByClassroom;
          const label = `周${dayLabels[s.day_of_week-1]||'?'} ${s.slot_code} (${App.utils.formatTime(s.start_time)}-${App.utils.formatTime(s.end_time)})`;
          const disabled = isUnavailable ? ' disabled' : '';
          const style = isUnavailable ? ' style="color:#dc2626;background:#fee2e2;"' : '';
          const hint = isCurrent ? ' [当前时段]' : (occByClassroom ? ` [${App.utils.escapeHtml(classroomName||'')}已被占用]` : '');
          const selected = !isUnavailable && selectedSlotId != null && s.id === selectedSlotId ? ' selected' : '';
          return `<option value="${s.id}"${disabled}${style}${selected}>${label}${hint}</option>`;
        }).join('');
      };

      // 基于动态选中的教室渲染时段选项（用于用户中途切换教室后刷新时段可用性）
      const renderSlotOptionsWithRoom = (selectedRoomId) => {
        const dayLabels = ['一','二','三','四','五','六','日'];
        return allSlots.map(s => {
          const isCurrent = currentTimeSlotId != null && s.id === currentTimeSlotId;
          const occByRoom = selectedRoomId != null && roomOccupiedSlots[selectedRoomId]?.has(s.id);
          const isUnavailable = isCurrent || !!occByRoom;
          const label = `周${dayLabels[s.day_of_week-1]||'?'} ${s.slot_code} (${App.utils.formatTime(s.start_time)}-${App.utils.formatTime(s.end_time)})`;
          const disabled = isUnavailable ? ' disabled' : '';
          const style = isUnavailable ? ' style="color:#dc2626;background:#fee2e2;"' : '';
          const hint = isCurrent ? ' [当前时段]' : (occByRoom ? ` [该教室已被占用]` : '');
          return `<option value="${s.id}"${disabled}${style}>${label}${hint}</option>`;
        }).join('');
      };

      const renderRoomOptions = (selectedSlotId) => {
        return allRooms.map(r => {
          const isUnavailable = selectedSlotId != null && slotOccupiedRooms[selectedSlotId]?.has(r.id);
          const label = `${App.utils.escapeHtml(r.name || r.room_number || '')} (${r.building || ''} 容量:${r.capacity || 0})`;
          const disabled = isUnavailable ? ' disabled' : '';
          const style = isUnavailable ? ' style="color:#dc2626;background:#fee2e2;"' : '';
          const hint = isUnavailable ? ' [已被占用-不可选]' : '';
          return `<option value="${r.id}"${disabled}${style} data-capacity="${r.capacity || 0}">${label}${hint}</option>`;
        }).join('');
      };

      const validateAndUpdateConfirmBtn = () => {
        const selSlot = document.getElementById('adjustSlotSelect');
        const selRoom = document.getElementById('adjustRoomSelect');
        if (!selSlot || !selRoom) return;
        const slotId = parseInt(selSlot.value);
        const roomId = parseInt(selRoom.value);
        const btn = document.getElementById('modalConfirmBtn');
        if (!btn) return;
        const slotUnavailable = selSlot.selectedOptions[0]?.disabled;
        const roomUnavailable = selRoom.selectedOptions[0]?.disabled;
        const valid = !isNaN(slotId) && !isNaN(roomId) && !slotUnavailable && !roomUnavailable;
        btn.disabled = !valid;
        btn.style.opacity = valid ? '' : '0.5';
      };

      App.utils.showModal('调整考试安排', `
        <div class="mb-3 p-2 bg-blue-50 rounded text-sm">
          <div class="text-gray-600 mb-1"><i class="fas fa-info-circle text-blue-400 mr-1"></i>当前安排</div>
          <div class="font-semibold">${App.utils.escapeHtml(exam?.course_name || '')}</div>
          <div class="text-gray-500">时段: ${App.utils.escapeHtml(currentTimeSlotLabel)} &nbsp;|&nbsp; 教室: ${App.utils.escapeHtml(classroomName || '')}</div>
        </div>
        <div class="form-group">
          <label class="form-label">
            <i class="fas fa-clock text-warning mr-1"></i>选择时段
            <span class="text-xs text-gray-400 font-normal ml-1">(红色为不可用时段)</span>
          </label>
          <select class="form-select" id="adjustSlotSelect"><option value="">--请选择时段--</option></select>
        </div>
        <div class="form-group">
          <label class="form-label">
            <i class="fas fa-door-open text-info mr-1"></i>选择教室
            <span class="text-xs text-gray-400 font-normal ml-1">(红色为已被占用)</span>
          </label>
          <select class="form-select" id="adjustRoomSelect"><option value="">--请选择教室--</option></select>
        </div>
        <div id="adjustCapacityInfo" class="text-sm text-gray-500 mb-2"></div>
        <div class="form-group">
          <label class="form-label">调整原因（必填）</label>
          <input class="form-input" id="adjustReason" placeholder="请输入调整原因" />
        </div>
      `, () => App.handlers.submitExamAdjust(examId, classroomId, 'confirm'), '确认调整');

      // 异步加载时段和教室数据，然后渲染
      Promise.all([
        App.api.getList('/time-slots/'),
        App.api.getList('/classrooms/'),
      ]).then(([slots, rooms]) => {
        allSlots = slots || [];
        allRooms = rooms || [];
        const selSlot = document.getElementById('adjustSlotSelect');
        const selRoom = document.getElementById('adjustRoomSelect');
        if (selSlot) {
          selSlot.innerHTML = '<option value="">--请选择时段--</option>' + renderSlotOptions(currentTimeSlotId);
        }
        if (selRoom) {
          selRoom.innerHTML = '<option value="">--请选择教室--</option>' + renderRoomOptions(currentTimeSlotId);
        }
      }).catch(() => {});

      // 时段变化 → 刷新教室可用性
      setTimeout(() => {
        const selSlot = document.getElementById('adjustSlotSelect');
        const selRoom = document.getElementById('adjustRoomSelect');
        const capInfo = document.getElementById('adjustCapacityInfo');
        if (selSlot) {
          selSlot.addEventListener('change', () => {
            const slotId = parseInt(selSlot.value);
            // 时段变化 → 刷新教室可用性
            if (selRoom) selRoom.innerHTML = '<option value="">--请选择教室--</option>' + renderRoomOptions(slotId || currentTimeSlotId);
            validateAndUpdateConfirmBtn();
          });
        }
        if (selRoom) {
          selRoom.addEventListener('change', () => {
            const opt = selRoom.selectedOptions[0];
            if (capInfo) capInfo.textContent = opt && !opt.disabled ? `教室容量: ${opt.dataset.capacity || '--'} 人` : '';
            // 教室变化 → 刷新时段可用性（基于当前选中的教室）
            const selRoomId = selRoom.value ? parseInt(selRoom.value) : null;
            if (selSlot) selSlot.innerHTML = '<option value="">--请选择时段--</option>' + renderSlotOptionsWithRoom(selRoomId);
            // 教室变化后，教室下拉需要基于当前时段或默认时段重新计算
            if (selRoom) {
              const currentSlotId = selSlot && selSlot.value ? parseInt(selSlot.value) : currentTimeSlotId;
              selRoom.innerHTML = '<option value="">--请选择教室--</option>' + renderRoomOptions(currentSlotId);
            }
            validateAndUpdateConfirmBtn();
          });
        }
        // 初始验证
        validateAndUpdateConfirmBtn();
      }, 100);
    },
    async submitExamAdjust(examId, oldClassroomId, action) {
      const slotId = document.getElementById('adjustSlotSelect').value;
      const newClassroomId = document.getElementById('adjustRoomSelect').value;
      const reason = document.getElementById('adjustReason').value.trim();
      if (!slotId) { App.utils.showToast('请选择时段', 'warning'); return; }
      if (!newClassroomId) { App.utils.showToast('请选择教室', 'warning'); return; }
      if (!reason) { App.utils.showToast('请输入调整原因', 'warning'); return; }

      const slotOpt = document.getElementById('adjustSlotSelect').selectedOptions[0];
      const roomOpt = document.getElementById('adjustRoomSelect').selectedOptions[0];
      if (slotOpt?.disabled || roomOpt?.disabled) {
        App.utils.showToast('请勿选择已被占用的时段或教室', 'error');
        return;
      }

      try {
        // 1. 调时段（如果时段变了）
        const cache = App.cache.examOverview;
        const items = cache?.data?.items || [];
        const exam = items.find(e => String(e.id) === String(examId));
        const currentTsId = exam?.time_slot?.id ?? null;
        const newTsId = parseInt(slotId);
        if (currentTsId !== newTsId) {
          await App.api.post('/adjustments/move-exam-time', {
            exam_id: parseInt(examId),
            new_time_slot_id: newTsId,
            reason: `[调安排] ${reason}`,
          });
        }
        // 2. 换教室（如果教室变了）
        if (String(newClassroomId) !== String(oldClassroomId)) {
          await App.api.post('/adjustments/change-classroom', {
            exam_id: parseInt(examId),
            old_classroom_id: parseInt(oldClassroomId),
            new_classroom_id: parseInt(newClassroomId),
            reason: `[调安排] ${reason}`,
          });
        }
        App.utils.showToast('考试安排调整成功', 'success');
        App.pages.loadAdjustmentsTable();
      } catch (e) { App.utils.showToast(e.message || '调整失败', 'error'); }
    },
    openChangeTeacherModal(examId, classroomId, classroomName) {
      // 动态获取当前分配，渲染到 Modal
      const renderModal = (fixedTeachers, patrolTeachers) => {
        const allTeachers = [
          ...fixedTeachers.map(t => ({ ...t, display_role: 'fixed', display_room: classroomName })),
          ...patrolTeachers.map(t => ({ ...t, display_role: '流动监考', display_room: '全场' })),
        ];
        const teacherOptions = allTeachers.length > 0
          ? allTeachers.map(t => `<option value="${t.teacher_id}:${t.role}">${App.utils.escapeHtml(t.teacher_name)} (${t.display_role}${t.display_room !== '全场' ? '·'+t.display_room : ''})</option>`).join('')
          : '<option value="">暂无分配教师</option>';
        App.utils.showModal('更换监考教师', `
          <div class="form-group">
            <label class="form-label">当前教师（选择要替换的）</label>
            <select class="form-select" id="oldTeacherSelect">${teacherOptions}</select>
          </div>
          <div class="form-group">
            <label class="form-label">选择新教师</label>
            <select class="form-select" id="changeTeacherSelect"><option value="">--请选择教师--</option></select>
          </div>
          <div class="form-group mt-2">
            <label class="form-label">调整原因（必填）</label>
            <input class="form-input" id="changeTeacherReason" placeholder="请输入调整原因" />
          </div>
        `, () => App.handlers.submitChangeTeacher(examId, fixedTeachers, patrolTeachers), '确认更换');
        App.handlers.loadTeacherOptions('changeTeacherSelect');
      };

      // 从缓存中找这场考试的教师分配
      const cache = App.cache.examOverview;
      const items = cache?.data?.items || [];
      const exam = items.find(e => String(e.id) === String(examId));
      const fixedTeachers = exam ? (exam.teachers || []).filter(t => t.role === 'fixed' && String(t.classroom_id) === String(classroomId)) : [];
      const patrolTeachers = exam ? (exam.teachers || []).filter(t => t.role === 'patrol') : [];
      renderModal(fixedTeachers, patrolTeachers);
    },
    async loadTeacherOptions(selectId) {
      try {
        const teachers = await App.api.getList('/teachers/');
        const select = document.getElementById(selectId);
        if (!select) return;
        select.innerHTML = '<option value="">--请选择教师--</option>' + teachers.map(t => `<option value="${t.id}">${App.utils.escapeHtml(t.name)} (当前${t.current_slots || 0}场/最多${t.max_slots || 0}场)</option>`).join('');
      } catch { /* ignore */ }
    },
    async submitChangeTeacher(examId, fixedTeachers, patrolTeachers) {
      const oldSelect = document.getElementById('oldTeacherSelect').value;
      const newTeacherId = document.getElementById('changeTeacherSelect').value;
      const reason = document.getElementById('changeTeacherReason').value.trim();
      if (!oldSelect) { App.utils.showToast('请选择要替换的教师', 'warning'); return; }
      if (!newTeacherId) { App.utils.showToast('请选择新教师', 'warning'); return; }
      if (!reason) { App.utils.showToast('请输入调整原因', 'warning'); return; }
      const parts = oldSelect.split(':');
      const oldTeacherId = parseInt(parts[0]);
      const role = parts[1] || 'fixed';
      if (isNaN(oldTeacherId)) { App.utils.showToast('原教师ID无效，请重新选择', 'error'); return; }
      try {
        await App.api.post('/adjustments/change-teacher', {
          exam_id: examId,
          old_teacher_id: oldTeacherId,
          new_teacher_id: parseInt(newTeacherId),
          role: role,
          reason: reason,
        });
        App.utils.showToast('教师更换成功', 'success');
        App.pages.loadAdjustmentsTable();
      } catch (e) { App.utils.showToast(e.message || '更换失败', 'error'); }
    },

    // --- Teacher Transfer ---
    async loadTeacherAAssignments() {
      const teacherId = document.getElementById('teacherASelect').value;
      if (!teacherId) { document.getElementById('teacherAList').innerHTML = '<div class="empty-state py-4"><p>请选择教师A</p></div>'; return; }
      await App.handlers.loadTeacherAssignments(teacherId, 'teacherAList', 'teacherACount', 'transferSlotA');
    },
    async loadTeacherBAssignments() {
      const teacherId = document.getElementById('teacherBSelect').value;
      if (!teacherId) { document.getElementById('teacherBList').innerHTML = '<div class="empty-state py-4"><p>请选择教师B</p></div>'; return; }
      await App.handlers.loadTeacherAssignments(teacherId, 'teacherBList', 'teacherBCount', 'transferSlotB');
    },
    async loadTeacherAssignments(teacherId, listId, countId, selectId) {
      try {
        const data = await App.api.get(`/teachers/${teacherId}/exams`);
        const payload = data.data || {};
        const fixedExams = payload.fixed_exams || [];
        const patrolExams = payload.patrol_exams || [];
        // 标记类型以便列表展示
        fixedExams.forEach(e => e.role = 'fixed');
        patrolExams.forEach(e => e.role = 'patrol');
        const allExams = [...fixedExams, ...patrolExams];
        allExams.sort((a, b) => ((a.day_of_week || 0) - (b.day_of_week || 0)) || ((a.slot_code || '').localeCompare(b.slot_code || '')));

        document.getElementById(countId).textContent = allExams.length + '场';

        const listEl = document.getElementById(listId);
        if (allExams.length === 0) { listEl.innerHTML = '<div class="empty-state py-4"><p>暂无监考场次</p></div>'; }
        else {
          listEl.innerHTML = allExams.map(a => {
            const roomText = a.assigned_classroom || (a.classrooms || []).map(c => c.classroom_name).join(', ') || '--';
            const roleBadge = a.role === 'fixed'
              ? '<span class="badge badge-info text-xs">固定</span>'
              : '<span class="badge badge-warning text-xs">流动</span>';
            return `
            <div class="p-3 border-b border-gray-100 hover:bg-gray-50 text-sm">
              <div class="font-medium text-gray-800">${App.utils.escapeHtml(a.course_name || '')} ${roleBadge}</div>
              <div class="text-xs text-gray-500 mt-1"><i class="fas fa-calendar"></i> ${App.utils.escapeHtml(a.day_name || '')} ${App.utils.escapeHtml(a.slot_code || '')} (${App.utils.escapeHtml(a.time_range || '')})</div>
              <div class="text-xs text-gray-500"><i class="fas fa-door-open"></i> ${App.utils.escapeHtml(roomText)}</div>
            </div>
          `;
          }).join('');
        }
        // Populate select
        const select = document.getElementById(selectId);
        if (select) {
          select.innerHTML = allExams.length === 0 ? '<option value="">无场次</option>' :
            allExams.map(a => `<option value="${a.exam_id}">${App.utils.escapeHtml(a.course_name || '')} - ${App.utils.escapeHtml(a.day_name || '')}${App.utils.escapeHtml(a.slot_code || '')}</option>`).join('');
        }
      } catch { /* ignore */ }
    },
    onTransferTypeChange() {
      const type = document.getElementById('transferType').value;
      const bGroup = document.getElementById('transferSlotBGroup');
      bGroup.style.display = (type === 'swap' || type === 'transfer') ? 'block' : 'none';
    },
    async executeTransfer() {
      const type = document.getElementById('transferType').value;
      const teacherAId = Number(document.getElementById('teacherASelect').value);
      const teacherBId = Number(document.getElementById('teacherBSelect').value);
      const slotA = Number(document.getElementById('transferSlotA').value);
      const slotB = Number(document.getElementById('transferSlotB').value);
      const reasonRaw = document.getElementById('transferReason').value;
      const reason = reasonRaw && reasonRaw.trim() ? reasonRaw.trim() : '教师调剂';

      if (!type) { App.utils.showToast('请选择调剂类型', 'warning'); return; }
      if (!teacherAId) { App.utils.showToast('请选择教师A', 'warning'); return; }

      try {
        if (type === 'swap') {
          if (!teacherBId || !slotA || !slotB) { App.utils.showToast('请完善交换信息', 'warning'); return; }
          await App.api.post('/adjustments/teacher-swap', { teacher_a_id: teacherAId, teacher_b_id: teacherBId, exam_a_id: slotA, exam_b_id: slotB, reason });
        } else if (type === 'transfer') {
          if (!teacherBId || !slotA) { App.utils.showToast('请完善转移信息', 'warning'); return; }
          await App.api.post('/adjustments/teacher-transfer', { exam_id: slotA, from_teacher_id: teacherAId, to_teacher_id: teacherBId, role: 'fixed', reason });
        } else if (type === 'batch-transfer') {
          if (!teacherBId) { App.utils.showToast('请选择教师B', 'warning'); return; }
          await App.api.post('/adjustments/teacher-batch-transfer', { from_teacher_id: teacherAId, to_teacher_id: teacherBId, reason });
        }
        App.utils.showToast('调剂操作成功', 'success');
        App.handlers.loadTeacherAAssignments();
        App.handlers.loadTeacherBAssignments();
      } catch (e) { App.utils.showToast(e.message || '调剂失败', 'error'); }
    },
    highlightRoom(examIdx, roomIdx, enter) {
      const row = document.querySelector(`tr[data-exam-idx="${examIdx}"]`);
      if (!row) return;
      const blocks = row.querySelectorAll(`[data-room-idx="${roomIdx}"]`);
      blocks.forEach(b => {
        if (enter) {
          b.style.backgroundColor = '#dbeafe';
          b.style.borderColor = '#3b82f6';
          b.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.15)';
        } else {
          b.style.backgroundColor = b.dataset.bg;
          b.style.borderColor = '#e5e7eb';
          b.style.boxShadow = 'none';
        }
      });
    },
    async undoLastTransfer() {
      try {
        await App.api.post('/adjustments/undo-last');
        App.utils.showToast('撤销成功', 'success');
      } catch (e) { App.utils.showToast(e.message || '撤销失败', 'error'); }
    },

    // --- Import / Export ---
    downloadTemplate(entity) {
      if (entity === 'all-in-one') {
        const url = `${API_BASE}/import-export/templates/all-in-one`;
        const a = document.createElement('a');
        a.href = url;
        a.download = 'all_in_one_template.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }
      const url = `${API_BASE}/import-export/templates/${entity}`;
      const a = document.createElement('a');
      a.href = url;
      a.download = `${entity}_template.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    },
    async clearAllData() {
      App.utils.showModal('⚠️ 确认清除全部数据', `
        <div class="space-y-2 text-sm">
          <p class="text-red-600 font-semibold">此操作将删除所有基础数据（专业、教师、教室、班级、课程、学生、排考记录等），且无法撤销！</p>
          <p>保留数据：<span class="font-medium">考试时段、审计日志</span></p>
          <p class="text-gray-500">如需重新导入完整数据，建议先清除旧数据再导入。</p>
        </div>
      `, async () => {
        try {
          const res = await App.api.post('/import-export/clear-data', { confirm: true, preserve_audit_logs: true });
          App.utils.showToast('数据清除完成', 'success');
          const cleared = res.data?.cleared || {};
          const preserved = res.data?.preserved || [];
          let html = '<div class="space-y-2 text-sm">';
          html += '<div><span class="font-semibold">已清除：</span></div>';
          html += '<div class="grid grid-cols-2 gap-1 text-xs">';
          for (const [k, v] of Object.entries(cleared)) {
            html += `<div class="px-2 py-1 rounded ${v.includes('失败') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}">${k}: ${v}</div>`;
          }
          html += '</div>';
          html += `<div class="mt-2"><span class="font-semibold">已保留：</span> ${preserved.join('、')}</div>`;
          html += '</div>';
          App.utils.showModal('清除结果', html, null, '确定');
        } catch (e) {
          App.utils.showToast(e.message || '清除失败', 'error');
        }
      }, '确认清除', '取消');
    },
    async initTimeSlots() {
      App.utils.showModal('确认重置时段', '确定要清空并重新初始化20个标准考试时段吗？这会删除所有自定义时段，且如果有课程引用了现有时段将无法重置。', async () => {
        try {
          const res = await App.api.post('/import-export/init-time-slots');
          App.utils.showToast(res.message, 'success');
          const data = res.data || {};
          const slots = data.slots || [];
          let info = '已初始化时段:\n';
          for (const s of slots) {
            info += `ID=${s.id}: 周${['一','二','三','四','五'][s.day_of_week-1]} ${s.slot_code} (${s.start_time}-${s.end_time})\n`;
          }
          App.utils.showModal('时段初始化完成', `<pre class="text-xs bg-gray-50 p-3 rounded overflow-auto" style="max-height: 300px;">${App.utils.escapeHtml(info)}</pre>`, null, '确定');
        } catch (e) {
          App.utils.showToast(e.message || '重置失败', 'error');
        }
      }, '确定重置', '取消');
    },
    handleFileUpload(event) {
      const file = event.target.files[0];
      if (!file) return;
      document.getElementById('uploadFileName').textContent = file.name;
      document.getElementById('uploadFileSize').textContent = (file.size / 1024).toFixed(1) + ' KB';
      document.getElementById('uploadPreview').style.display = 'block';
      document.getElementById('importResultPanel').style.display = 'none';
    },
    clearUpload() {
      document.getElementById('importFileInput').value = '';
      document.getElementById('uploadPreview').style.display = 'none';
      document.getElementById('importResultPanel').style.display = 'none';
    },
    async confirmImport() {
      const fileInput = document.getElementById('importFileInput');
      const importType = document.getElementById('importTypeSelect').value;
      if (!fileInput.files[0]) { App.utils.showToast('请选择文件', 'warning'); return; }
      const formData = new FormData();
      formData.append('file', fileInput.files[0]);
      try {
        if (importType === 'all-in-one') {
          const result = await App.api.post('/import-export/import-excel-all', formData);
          App.handlers.showAllInOneImportResult(result);
          if (result.data && result.data.success) {
            App.utils.showToast('全量导入成功', 'success');
          } else {
            App.utils.showToast('全量导入完成，部分数据有错误', 'warning');
          }
        } else {
          const result = await App.api.post(`/import-export/import-excel/${importType}`, formData);
          App.handlers.showImportResult(result);
          if (result.success) {
            App.utils.showToast(`成功导入 ${result.success_count} 条数据`, 'success');
          } else {
            App.utils.showToast(`导入完成，${result.error_count} 条错误`, 'warning');
          }
        }
      } catch (e) {
        App.utils.showToast(e.message || '导入失败', 'error');
      }
    },
    showImportResult(result) {
      const panel = document.getElementById('importResultPanel');
      const successAlert = document.getElementById('importSuccessAlert');
      const errorAlert = document.getElementById('importErrorAlert');
      const errorTable = document.getElementById('importErrorTable');
      const warningTable = document.getElementById('importWarningTable');

      panel.style.display = 'block';

      if (result.success) {
        successAlert.style.display = 'block';
        successAlert.querySelector('span').textContent = `导入成功: ${result.success_count} 条`;
        errorAlert.style.display = 'none';
      } else {
        successAlert.style.display = 'none';
        errorAlert.style.display = 'block';
        errorAlert.querySelector('span').textContent = `导入失败: ${result.error_count} 条错误`;
      }

      if (result.errors && result.errors.length) {
        errorTable.style.display = 'block';
        const tbody = errorTable.querySelector('tbody');
        tbody.innerHTML = result.errors.map(err => `<tr><td style="color:red;">${App.utils.escapeHtml(String(err))}</td></tr>`).join('');
      } else {
        errorTable.style.display = 'none';
      }

      if (result.warnings && result.warnings.length) {
        warningTable.style.display = 'block';
        const tbody = warningTable.querySelector('tbody');
        tbody.innerHTML = result.warnings.map(w => `<tr><td style="color:orange;">${App.utils.escapeHtml(String(w))}</td></tr>`).join('');
      } else {
        warningTable.style.display = 'none';
      }
    },
    showAllInOneImportResult(result) {
      const panel = document.getElementById('importResultPanel');
      const successAlert = document.getElementById('importSuccessAlert');
      const errorAlert = document.getElementById('importErrorAlert');
      const errorTable = document.getElementById('importErrorTable');
      const warningTable = document.getElementById('importWarningTable');

      panel.style.display = 'block';

      const data = result.data || {};
      const sheets = data.sheets || [];
      const overallSuccess = data.success;

      if (overallSuccess) {
        successAlert.style.display = 'block';
        successAlert.querySelector('span').textContent = data.overall_summary || '全量导入成功';
        errorAlert.style.display = 'none';
      } else {
        successAlert.style.display = 'none';
        errorAlert.style.display = 'block';
        errorAlert.querySelector('span').textContent = data.overall_summary || '全量导入部分失败';
      }

      // 汇总所有Sheet的错误
      let allErrors = [];
      let allWarnings = [];
      for (const sheet of sheets) {
        if (sheet.errors && sheet.errors.length) {
          sheet.errors.forEach(e => allErrors.push(`[${sheet.label}] ${e}`));
        }
        if (sheet.warnings && sheet.warnings.length) {
          sheet.warnings.forEach(w => allWarnings.push(`[${sheet.label}] ${w}`));
        }
      }

      if (allErrors.length) {
        errorTable.style.display = 'block';
        const tbody = errorTable.querySelector('tbody');
        tbody.innerHTML = allErrors.map(err => `<tr><td style="color:red;">${App.utils.escapeHtml(String(err))}</td></tr>`).join('');
      } else {
        errorTable.style.display = 'none';
      }

      if (allWarnings.length) {
        warningTable.style.display = 'block';
        const tbody = warningTable.querySelector('tbody');
        tbody.innerHTML = allWarnings.map(w => `<tr><td style="color:orange;">${App.utils.escapeHtml(String(w))}</td></tr>`).join('');
      } else {
        warningTable.style.display = 'none';
      }
    },
    async exportExcel() {
      try {
        const response = await fetch(`${API_BASE}/import-export/export/excel`);
        if (!response.ok) throw new Error('Export failed');
        const blob = await response.blob();
        App.utils.downloadBlob(blob, `排考结果_${App.utils.formatDate(new Date())}.xlsx`);
        App.utils.showToast('Excel导出成功', 'success');
      } catch { App.utils.showToast('Excel导出失败', 'error'); }
    },
    async exportJSON() {
      try {
        const response = await fetch(`${API_BASE}/import-export/export/json`);
        if (!response.ok) throw new Error('Export failed');
        const blob = await response.blob();
        App.utils.downloadBlob(blob, `排考结果_${App.utils.formatDate(new Date())}.json`);
        App.utils.showToast('JSON导出成功', 'success');
      } catch { App.utils.showToast('JSON导出失败', 'error'); }
    },
    async exportSQL() {
      try {
        const response = await fetch(`${API_BASE}/import-export/export/sql`);
        if (!response.ok) throw new Error('Export failed');
        const blob = await response.blob();
        App.utils.downloadBlob(blob, `排考结果_${App.utils.formatDate(new Date())}.sql`);
        App.utils.showToast('SQL导出成功', 'success');
      } catch { App.utils.showToast('SQL导出失败', 'error'); }
    },

    // --- Audit Logs ---
    async loadAuditLogs() { await App.pages.loadAuditLogsTable(); },
    resetAuditFilters() {
      document.getElementById('auditOperationType').value = '';
      document.getElementById('auditDateFrom').value = '';
      document.getElementById('auditDateTo').value = '';
      document.getElementById('auditSearch').value = '';
      App.pagination.auditLogs.page = 1;
      App.pages.loadAuditLogsTable();
    },
  },

  // ==========================================
  // 初始化
  // ==========================================
  init() {
    // Navigation click handlers
    document.querySelectorAll('#mainNav .nav-tab').forEach(tab => {
      tab.addEventListener('click', () => App.nav.to(tab.dataset.page));
    });
    // Base data sub-tabs
    document.querySelectorAll('#baseDataSubTabs .sub-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        App.currentBaseDataType = tab.dataset.type;
        App.selectedIds = [];
        App.handlers.updateBatchDeleteUI();
        document.querySelectorAll('#baseDataSubTabs .sub-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        App.pagination[App.currentBaseDataType].page = 1;
        App.pages.renderBaseDataTable();
      });
    });
    // Results sub-tabs
    document.querySelectorAll('#resultsSubTabs .sub-tab').forEach(tab => {
      tab.addEventListener('click', () => App.handlers.switchResultView(tab.dataset.view));
    });
    // Upload zone drag & drop
    const uploadZone = document.getElementById('uploadZone');
    if (uploadZone) {
      uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('dragover'); });
      uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
      uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
          const input = document.getElementById('importFileInput');
          const dt = new DataTransfer();
          dt.items.add(files[0]);
          input.files = dt.files;
          App.handlers.handleFileUpload({ target: input });
        }
      });
    }
    // Initial page render
    App.nav.to('dashboard');
    App.utils.showToast('考试排考系统已加载', 'success');
  },
};

// Launch
document.addEventListener('DOMContentLoaded', () => App.init());
