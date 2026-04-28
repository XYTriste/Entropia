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
          try { errorData = await response.json(); } catch { errorData = { detail: response.statusText }; }
          throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
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
          await onConfirm();
          App.utils.hideModal();
        });
      }
    },
    hideModal() {
      document.getElementById('modalContainer').innerHTML = '';
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
        const [teachers, classrooms, courses, students, versions] = await Promise.all([
          App.api.getList('/teachers/').catch(() => []),
          App.api.getList('/classrooms/').catch(() => []),
          App.api.getList('/courses/').catch(() => []),
          App.api.getList('/students/').catch(() => []),
          App.api.getList('/scheduler/versions').catch(() => []),
        ]);
        // Cache data
        App.cache.teachers = teachers;
        App.cache.classrooms = classrooms;
        App.cache.courses = courses;
        App.cache.students = students;
        App.cache.versions = versions;

        // Update stats
        const scheduledCount = courses.filter(c => c.is_scheduled || c.exam_count > 0).length;
        document.getElementById('statTeachers').textContent = teachers.length || 0;
        document.getElementById('statClassrooms').textContent = classrooms.length || 0;
        document.getElementById('statCourses').textContent = courses.length || 0;
        document.getElementById('statStudents').textContent = students.length || 0;
        document.getElementById('statScheduled').textContent = scheduledCount;
        document.getElementById('statPending').textContent = (courses.length || 0) - scheduledCount;
        const latestVersion = versions && versions.length > 0 ? versions[0].version_number || versions[0].id : '--';
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
        if (!logs || logs.length === 0) {
          container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>暂无操作记录</p></div>';
          return;
        }
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
            columns = [
              { header: 'ID', key: 'id', width: '60px' },
              { header: '课程名称', key: 'name' },
              { header: '类型', key: 'course_type', render: (r) => `<span class="badge ${r.course_type === 'public' ? 'badge-info' : 'badge-warning'}">${r.course_type === 'public' ? '公共课' : '专业课'}</span>` },
              { header: 'AB卷', key: 'needs_ab', render: (r) => `<span class="badge ${r.needs_ab ? 'badge-warning' : 'badge-gray'}">${r.needs_ab ? '是' : '否'}</span>` },
              { header: '分配日期', key: 'dept_assigned_date', width: '80px', render: (r) => r.dept_assigned_date || '--' },
              { header: '分配时段', key: 'dept_assigned_time_slot_id', width: '80px', render: (r) => r.dept_assigned_time_slot_id || '--' },
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
        const overview = await App.api.get('/exams/overview/matrix');
        App.cache.examOverview = overview;
        const exams = overview.data?.exams || overview.data?.matrix || [];
        const pg = App.pagination.adjustments;

        // Filter
        const searchInput = document.getElementById('adjustmentSearch');
        const typeFilter = document.getElementById('adjustmentFilterType');
        const search = searchInput ? searchInput.value.toLowerCase() : '';
        const fType = typeFilter ? typeFilter.value : '';

        let filtered = exams;
        if (search) {
          filtered = filtered.filter(e =>
            (e.course_name || '').toLowerCase().includes(search) ||
            (e.teacher_name || '').toLowerCase().includes(search) ||
            (e.classroom_name || '').toLowerCase().includes(search)
          );
        }
        if (fType) {
          filtered = filtered.filter(e => e.course_type === fType);
        }

        pg.total = filtered.length;
        const start = (pg.page - 1) * pg.pageSize;
        const pageData = filtered.slice(start, start + pg.pageSize);

        const columns = [
          { header: '', render: (r) => `<input type="checkbox" class="form-checkbox" value="${r.id}">`, width: '40px' },
          { header: '日期', key: 'exam_date', render: (r) => App.utils.formatDate(r.exam_date) },
          { header: '时段', key: 'time_slot' },
          { header: '课程', key: 'course_name' },
          { header: '类型', key: 'course_type', render: (r) => App.utils.courseTypeBadge(r.course_type) },
          { header: '教室', key: 'classroom_name' },
          { header: '固定监考', key: 'fixed_teachers' },
          { header: '流动监考', key: 'roaming_teachers' },
          { header: '状态', render: (r) => `<span class="badge badge-success">已排</span>` },
          { header: '操作', render: (r) => `
            <div class="flex gap-1">
              <button class="btn btn-warning btn-xs" onclick="App.handlers.openMoveTimeModal(${r.id})"><i class="fas fa-clock"></i> 调时段</button>
              <button class="btn btn-info btn-xs" onclick="App.handlers.openChangeClassroomModal(${r.id})"><i class="fas fa-door-open"></i> 换教室</button>
              <button class="btn btn-primary btn-xs" onclick="App.handlers.openChangeTeacherModal(${r.id})"><i class="fas fa-user"></i> 换教师</button>
            </div>
          `, minWidth: '260px' },
        ];
        App.utils.renderTable('adjustmentTable', columns, pageData);
        App.utils.renderPagination('adjustmentPagination', 'adjustmentPaginationInfo', pg.page, pg.pageSize, pg.total, 'App.handlers.goToAdjustmentPage');
      } catch {
        document.getElementById('adjustmentTableBody').innerHTML = '<tr><td colspan="10" class="text-center text-gray-400 py-8">加载排考数据失败，请先执行自动排考</td></tr>';
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
        const options = teachers.map(t => `<option value="${t.id}">${App.utils.escapeHtml(t.name)} (${App.utils.escapeHtml(t.teacher_id || '')})</option>`).join('');
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
    tbody.innerHTML = courses.map(c => `
      <tr>
        <td><input type="checkbox" class="form-checkbox course-checkbox" value="${c.id}" ${App.scheduler.selectedCourses.has(String(c.id)) ? 'checked' : ''}></td>
        <td>${App.utils.escapeHtml(c.name || c.course_name || '')}</td>
        <td>${App.utils.courseTypeBadge(c.course_type)}</td>
        <td>${c.student_count || '--'}</td>
        <td>${App.utils.escapeHtml(c.exam_form || '笔试')}</td>
        <td>${c.is_scheduled ? '<span class="badge badge-success">已排</span>' : '<span class="badge badge-gray">未排</span>'}</td>
      </tr>
    `).join('');
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
    openAddModal() {
      const type = App.currentBaseDataType;
      const fields = App.fieldDefs[type] || [];
      const formHtml = fields.map(f => `
        <div class="form-group">
          <label class="form-label">${App.utils.escapeHtml(f.label)}${f.required ? ' <span class="text-danger">*</span>' : ''}</label>
          ${f.type === 'select'
            ? `<select class="form-select" id="form_${f.key}">${f.options.map(o => `<option value="${o.v}">${App.utils.escapeHtml(o.t)}</option>`).join('')}</select>`
            : `<input type="${f.type || 'text'}" class="form-input" id="form_${f.key}" ${f.required ? 'required' : ''}>`}
        </div>
      `).join('');
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
      const urlMap = { teachers: '/teachers/', classrooms: '/classrooms/', courses: '/courses/', classes: '/classes/', students: '/students/', majors: '/majors/', timeSlots: '/time-slots/' };
      try {
        await App.api.post(urlMap[type], data);
        App.utils.showToast('添加成功', 'success');
        App.pages.renderBaseDataTable();
      } catch (e) {
        App.utils.showToast(e.message || '添加失败', 'error');
      }
    },
    editItem(type, id) {
      const itemData = (App.cache[type] || []).find(item => item.id === id);
      if (!itemData) { App.utils.showToast('数据不存在', 'warning'); return; }
      const fields = App.fieldDefs[type] || [];
      const formHtml = fields.map(f => {
        let currentVal = itemData[f.key];
        if (currentVal === undefined || currentVal === null) currentVal = '';
        const valStr = String(currentVal);
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
        case 'classroom': await App.handlers.loadClassroomMatrix(); break;
        case 'class': await App.handlers.loadClassView(); break;
        case 'course': await App.handlers.loadCourseView(); break;
      }
    },
    async loadOverviewMatrix() {
      try {
        const data = await App.api.get('/exams/overview/matrix');
        const exams = data.data?.exams || data.data?.matrix || [];
        const timeSlots = data.time_slots || [{day:1,slots:[1,2,3,4]},{day:2,slots:[1,2,3,4]},{day:3,slots:[1,2,3,4]},{day:4,slots:[1,2,3,4]},{day:5,slots:[1,2,3,4]}];
        const days = ['周一', '周二', '周三', '周四', '周五'];

        let html = '<div class="matrix-grid" style="grid-template-columns: 80px repeat(4, 1fr);">';
        html += '<div class="matrix-header">日期 \\ 时段</div>';
        for (let s = 1; s <= 4; s++) html += `<div class="matrix-header">第${s}场</div>`;

        for (const day of timeSlots) {
          html += `<div class="matrix-header">${days[day.day - 1] || '周' + day.day}</div>`;
          for (const slot of day.slots || [1,2,3,4]) {
            const slotExams = exams.filter(e => e.day === day.day && e.time_slot === slot);
            if (slotExams.length === 0) {
              html += '<div class="matrix-cell text-gray-300 text-center"><i class="fas fa-minus-circle"></i></div>';
            } else {
              html += '<div class="matrix-cell">' + slotExams.map(e => {
                const colorClass = e.course_type === 'public' ? 'bg-blue-50 text-blue-700 border-blue-200' : e.course_type === 'major' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-purple-50 text-purple-700 border-purple-200';
                return `<div class="mb-1 px-2 py-1 rounded border text-xs ${colorClass}" title="${App.utils.escapeHtml(e.classroom_name || '')} - ${App.utils.escapeHtml((e.fixed_teachers || []).join(', '))}">
                  <div class="font-semibold truncate">${App.utils.escapeHtml(e.course_name || e.name || '')}</div>
                  <div class="text-xs opacity-75"><i class="fas fa-door-open"></i> ${App.utils.escapeHtml(e.classroom_name || '')}</div>
                  <div class="text-xs opacity-75"><i class="fas fa-user"></i> ${App.utils.escapeHtml((e.fixed_teachers || []).join(', '))}</div>
                </div>`;
              }).join('') + '</div>';
            }
          }
        }
        html += '</div>';
        document.getElementById('overviewMatrixContainer').innerHTML = html;
      } catch {
        document.getElementById('overviewMatrixContainer').innerHTML = '<div class="empty-state"><i class="fas fa-table"></i><p>暂无排考数据</p></div>';
      }
    },
    async loadTeacherGantt() {
      try {
        const data = await App.api.get('/exams/teachers/gantt');
        const teachers = data.teachers || [];
        const slots = data.time_slots || ['周一-1', '周一-2', '周一-3', '周一-4', '周二-1', '周二-2', '周二-3', '周二-4', '周三-1', '周三-2', '周三-3', '周三-4', '周四-1', '周四-2', '周四-3', '周四-4', '周五-1', '周五-2', '周五-3', '周五-4'];

        let html = '<div style="min-width: 900px;">';
        // Header
        html += '<div class="gantt-row" style="background: #F9FAFB; font-weight: 600; font-size: 12px; color: #6B7280;">';
        html += '<div class="gantt-label">教师</div>';
        html += '<div class="gantt-timeline">';
        for (const s of slots) html += `<div class="gantt-slot" style="text-align: center; padding: 8px;">${App.utils.escapeHtml(s)}</div>`;
        html += '</div></div>';
        // Teacher rows
        for (const t of teachers) {
          const dayCount = (t.assignments || []).reduce((acc, a) => { acc[a.day] = (acc[a.day] || 0) + 1; return acc; }, {});
          const hasOverload = Object.values(dayCount).some(c => c > 2);
          html += `<div class="gantt-row ${hasOverload ? 'bg-red-50' : ''}">`;
          html += `<div class="gantt-label ${hasOverload ? 'text-danger' : ''}">${App.utils.escapeHtml(t.name || '')} ${hasOverload ? '<i class="fas fa-exclamation-triangle text-danger"></i>' : ''}</div>`;
          html += '<div class="gantt-timeline">';
          for (let i = 0; i < slots.length; i++) {
            const assignment = (t.assignments || []).find(a => a.slot_index === i);
            let bgColor = '';
            if (assignment) {
              bgColor = assignment.is_roaming ? 'background: #FB923C;' : 'background: #3B82F6;';
            }
            html += `<div class="gantt-slot" style="${bgColor}${bgColor ? ' color: white; display: flex; align-items: center; justify-content: center; font-size: 11px;' : ''}">${assignment ? App.utils.escapeHtml(assignment.course_name || '') : ''}</div>`;
          }
          html += '</div></div>';
        }
        html += '</div>';
        document.getElementById('teacherGanttContainer').innerHTML = html;
      } catch {
        document.getElementById('teacherGanttContainer').innerHTML = '<div class="empty-state"><i class="fas fa-user-clock"></i><p>暂无排考数据</p></div>';
      }
    },
    async loadClassroomMatrix() {
      try {
        const data = await App.api.get('/exams/classrooms/matrix');
        const rooms = data.classrooms || [];
        const days = ['周一', '周二', '周三', '周四', '周五'];

        let html = '<div style="min-width: 800px;">';
        html += '<div class="gantt-row" style="background: #F9FAFB; font-weight: 600; font-size: 12px; color: #6B7280;">';
        html += '<div class="gantt-label" style="width: 120px;">教室 (容量)</div>';
        for (let d = 1; d <= 5; d++) for (let s = 1; s <= 4; s++) html += `<div class="gantt-slot" style="text-align: center; padding: 8px; font-size: 11px;">${days[d-1]}-${s}</div>`;
        html += '</div>';
        for (const room of rooms) {
          html += '<div class="gantt-row">';
          html += `<div class="gantt-label" style="width: 120px; font-size: 11px;">${App.utils.escapeHtml(room.name || room.room_number || '')} (${room.capacity || 0}人)</div>`;
          for (let d = 1; d <= 5; d++) {
            for (let s = 1; s <= 4; s++) {
              const exam = (room.exams || []).find(e => e.day === d && e.time_slot === s);
              if (exam) {
                const ratio = exam.student_count / (room.capacity || 100);
                const color = ratio > 0.9 ? 'background: #FCA5A5;' : ratio > 0.7 ? 'background: #FDE68A;' : 'background: #86EFAC;';
                html += `<div class="gantt-slot" style="${color} font-size: 10px; display: flex; align-items: center; justify-content: center; text-align: center; line-height: 1.2;">${App.utils.escapeHtml(exam.course_name || '')}<br><small>${exam.student_count || 0}人</small></div>`;
              } else {
                html += '<div class="gantt-slot"></div>';
              }
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
        const schedule = data.data?.schedule || data.data?.exams || [];
        const columns = [
          { header: '日期', key: 'exam_date', render: (r) => App.utils.formatDate(r.exam_date || r.date) },
          { header: '时段', key: 'time_slot' },
          { header: '课程', key: 'course_name' },
          { header: '教室', key: 'classroom_name' },
          { header: '类型', key: 'course_type', render: (r) => App.utils.courseTypeBadge(r.course_type) },
          { header: '监考教师', key: 'teacher_name' },
        ];
        App.utils.renderTable('classScheduleContainer', columns, schedule);
        // Re-wrap in card-body for consistent styling
        const container = document.getElementById('classScheduleContainer');
        if (container.querySelector('table')) {
          container.className = 'card-body p-0';
        }
      } catch {
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
        const detail = data.data?.detail || data.data || data;
        const abPapers = detail.ab_papers || [];
        const isUnbalanced = abPapers.some(a => Math.abs((a.a_count || 0) - (a.b_count || 0)) > 5);

        let html = '<div class="card mb-4">';
        html += '<div class="card-header"><h4 class="font-semibold">课程信息</h4></div>';
        html += `<div class="card-body"><div class="grid grid-cols-4 gap-4 text-sm">
          <div><span class="text-gray-500">课程名称:</span> <strong>${App.utils.escapeHtml(detail.name || detail.course_name || '')}</strong></div>
          <div><span class="text-gray-500">课程代码:</span> ${App.utils.escapeHtml(detail.course_code || '')}</div>
          <div><span class="text-gray-500">课程类型:</span> ${App.utils.courseTypeBadge(detail.course_type)}</div>
          <div><span class="text-gray-500">总人数:</span> ${detail.student_count || 0}</div>
        </div></div></div>`;

        if (abPapers.length > 0) {
          html += `<div class="card ${isUnbalanced ? 'border-warning' : ''}">`;
          html += `<div class="card-header"><h4 class="font-semibold">AB卷分卷情况 ${isUnbalanced ? '<span class="badge badge-warning"><i class="fas fa-exclamation-triangle"></i> 不均衡</span>' : '<span class="badge badge-success"><i class="fas fa-check"></i> 均衡</span>'}</h4></div>`;
          html += '<div class="card-body">';
          for (const ab of abPapers) {
            html += `<div class="grid grid-cols-4 gap-4 text-sm mb-2 p-3 bg-gray-50 rounded">
              <div><span class="text-gray-500">教室:</span> ${App.utils.escapeHtml(ab.classroom_name || '')}</div>
              <div><span class="text-gray-500">A卷人数:</span> ${ab.a_count || 0}</div>
              <div><span class="text-gray-500">B卷人数:</span> ${ab.b_count || 0}</div>
              <div><span class="text-gray-500">均衡度:</span> ${ab.balance_ratio || '100%'}</div>
            </div>`;
          }
          html += '</div></div>';
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

    openMoveTimeModal(examId) {
      App.utils.showModal('调整考试时段', `
        <div class="form-group">
          <label class="form-label">选择新时段</label>
          <select class="form-select" id="moveTimeSlotSelect"><option value="">加载中...</option></select>
        </div>
        <div id="moveTimeValidation"></div>
      `, () => App.handlers.submitMoveTime(examId), '确认调整');
      App.handlers.loadTimeSlotOptions('moveTimeSlotSelect');
    },
    async loadTimeSlotOptions(selectId) {
      try {
        const slots = await App.api.getList('/time-slots/');
        const select = document.getElementById(selectId);
        select.innerHTML = '<option value="">--请选择时段--</option>' + slots.map(s => `<option value="${s.id}">周${['一','二','三','四','五','六','日'][s.day_of_week-1]} 第${s.slot_number}场 (${App.utils.formatTime(s.start_time)}-${App.utils.formatTime(s.end_time)})</option>`).join('');
      } catch { /* ignore */ }
    },
    async submitMoveTime(examId) {
      const slotId = document.getElementById('moveTimeSlotSelect').value;
      if (!slotId) { App.utils.showToast('请选择新时段', 'warning'); return; }
      try {
        await App.api.post('/adjustments/move-exam-time', { exam_id: examId, time_slot_id: slotId });
        App.utils.showToast('时段调整成功', 'success');
        App.pages.loadAdjustmentsTable();
      } catch (e) { App.utils.showToast(e.message || '调整失败', 'error'); }
    },
    openChangeClassroomModal(examId) {
      App.utils.showModal('更换教室', `
        <div class="form-group">
          <label class="form-label">选择新教室</label>
          <select class="form-select" id="changeClassroomSelect"><option value="">加载中...</option></select>
        </div>
        <div id="classroomCapacityInfo" class="text-sm text-gray-500 mt-2"></div>
      `, () => App.handlers.submitChangeClassroom(examId), '确认更换');
      App.handlers.loadClassroomOptions();
    },
    async loadClassroomOptions() {
      try {
        const rooms = await App.api.getList('/classrooms/');
        const select = document.getElementById('changeClassroomSelect');
        select.innerHTML = '<option value="">--请选择教室--</option>' + rooms.map(r => `<option value="${r.id}" data-capacity="${r.capacity}">${App.utils.escapeHtml(r.room_number)} - ${App.utils.escapeHtml(r.building)} (容量:${r.capacity})</option>`).join('');
        select.addEventListener('change', (e) => {
          const opt = e.target.selectedOptions[0];
          document.getElementById('classroomCapacityInfo').textContent = opt ? `教室容量: ${opt.dataset.capacity || '--'} 人` : '';
        });
      } catch { /* ignore */ }
    },
    async submitChangeClassroom(examId) {
      const roomId = document.getElementById('changeClassroomSelect').value;
      if (!roomId) { App.utils.showToast('请选择新教室', 'warning'); return; }
      try {
        await App.api.post('/adjustments/change-classroom', { exam_id: examId, classroom_id: roomId });
        App.utils.showToast('教室更换成功', 'success');
        App.pages.loadAdjustmentsTable();
      } catch (e) { App.utils.showToast(e.message || '更换失败', 'error'); }
    },
    openChangeTeacherModal(examId) {
      App.utils.showModal('更换监考教师', `
        <div class="form-group">
          <label class="form-label">选择新教师</label>
          <select class="form-select" id="changeTeacherSelect"><option value="">加载中...</option></select>
        </div>
        <div class="form-group">
          <label class="form-label">调剂类型</label>
          <select class="form-select" id="changeTeacherType">
            <option value="fixed">固定监考</option>
            <option value="roaming">流动监考</option>
          </select>
        </div>
      `, () => App.handlers.submitChangeTeacher(examId), '确认更换');
      App.handlers.loadTeacherOptions();
    },
    async loadTeacherOptions() {
      try {
        const teachers = await App.api.getList('/teachers/');
        const select = document.getElementById('changeTeacherSelect');
        select.innerHTML = '<option value="">--请选择教师--</option>' + teachers.map(t => `<option value="${t.id}">${App.utils.escapeHtml(t.name)} (${App.utils.escapeHtml(t.teacher_id || '')})</option>`).join('');
      } catch { /* ignore */ }
    },
    async submitChangeTeacher(examId) {
      const teacherId = document.getElementById('changeTeacherSelect').value;
      const teacherType = document.getElementById('changeTeacherType').value;
      if (!teacherId) { App.utils.showToast('请选择新教师', 'warning'); return; }
      try {
        await App.api.post('/adjustments/change-teacher', { exam_id: examId, teacher_id: teacherId, teacher_type: teacherType });
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
        const data = await App.api.get('/exams/teachers/gantt');
        const teacher = (data.teachers || []).find(t => t.id == teacherId);
        const assignments = teacher ? (teacher.assignments || []) : [];
        document.getElementById(countId).textContent = assignments.length + '场';

        const listEl = document.getElementById(listId);
        if (assignments.length === 0) { listEl.innerHTML = '<div class="empty-state py-4"><p>暂无监考场次</p></div>'; }
        else {
          listEl.innerHTML = assignments.map(a => `
            <div class="p-3 border-b border-gray-100 hover:bg-gray-50 text-sm">
              <div class="font-medium text-gray-800">${App.utils.escapeHtml(a.course_name || '')}</div>
              <div class="text-xs text-gray-500 mt-1"><i class="fas fa-calendar"></i> 周${['一','二','三','四','五','六','日'][a.day-1]} 第${a.time_slot}场</div>
              <div class="text-xs text-gray-500"><i class="fas fa-door-open"></i> ${App.utils.escapeHtml(a.classroom_name || '')}</div>
            </div>
          `).join('');
        }
        // Populate select
        const select = document.getElementById(selectId);
        if (select) {
          select.innerHTML = assignments.length === 0 ? '<option value="">无场次</option>' :
            assignments.map(a => `<option value="${a.id}">${App.utils.escapeHtml(a.course_name || '')} - 周${['一','二','三','四','五','六','日'][a.day-1]}第${a.time_slot}场</option>`).join('');
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
      const teacherAId = document.getElementById('teacherASelect').value;
      const teacherBId = document.getElementById('teacherBSelect').value;
      const slotA = document.getElementById('transferSlotA').value;
      const slotB = document.getElementById('transferSlotB').value;
      const reason = document.getElementById('transferReason').value;

      if (!type) { App.utils.showToast('请选择调剂类型', 'warning'); return; }
      if (!teacherAId) { App.utils.showToast('请选择教师A', 'warning'); return; }

      try {
        if (type === 'swap') {
          if (!teacherBId || !slotA || !slotB) { App.utils.showToast('请完善交换信息', 'warning'); return; }
          await App.api.post('/adjustments/teacher-swap', { teacher_a_id: teacherAId, teacher_b_id: teacherBId, exam_a_id: slotA, exam_b_id: slotB, reason });
        } else if (type === 'transfer') {
          if (!teacherBId || !slotA) { App.utils.showToast('请完善转移信息', 'warning'); return; }
          await App.api.post('/adjustments/teacher-transfer', { exam_id: slotA, from_teacher_id: teacherAId, to_teacher_id: teacherBId, reason });
        } else if (type === 'batch-transfer') {
          if (!teacherBId) { App.utils.showToast('请选择教师B', 'warning'); return; }
          await App.api.post('/adjustments/teacher-batch-transfer', { from_teacher_id: teacherAId, to_teacher_id: teacherBId, reason });
        }
        App.utils.showToast('调剂操作成功', 'success');
        App.handlers.loadTeacherAAssignments();
        App.handlers.loadTeacherBAssignments();
      } catch (e) { App.utils.showToast(e.message || '调剂失败', 'error'); }
    },
    async undoLastTransfer() {
      try {
        await App.api.post('/adjustments/undo-last');
        App.utils.showToast('撤销成功', 'success');
      } catch (e) { App.utils.showToast(e.message || '撤销失败', 'error'); }
    },

    // --- Import / Export ---
    downloadTemplate(entity) {
      const url = `${API_BASE}/import-export/templates/${entity}`;
      const a = document.createElement('a');
      a.href = url;
      a.download = `${entity}_template.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
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
        const result = await App.api.post(`/import-export/import-excel/${importType}`, formData);
        App.handlers.showImportResult(result);
        if (result.success) {
          App.utils.showToast(`成功导入 ${result.success_count} 条数据`, 'success');
        } else {
          App.utils.showToast(`导入完成，${result.error_count} 条错误`, 'warning');
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
