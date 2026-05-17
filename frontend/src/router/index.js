import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/components/dashboard/DashboardView.vue'),
    meta: { title: '仪表盘' }
  },
  {
    path: '/base-data',
    name: 'BaseData',
    component: () => import('@/components/baseData/BaseDataView.vue'),
    meta: { title: '基础数据' }
  },
  {
    path: '/scheduler',
    name: 'Scheduler',
    component: () => import('@/components/scheduler/SchedulerView.vue'),
    meta: { title: '排考引擎' }
  },
  {
    path: '/results',
    name: 'Results',
    component: () => import('@/components/results/ResultsView.vue'),
    meta: { title: '排考结果' }
  },
  {
    path: '/adjustments',
    name: 'Adjustments',
    component: () => import('@/components/adjustments/AdjustmentsView.vue'),
    meta: { title: '手动微调' }
  },
  {
    path: '/transfer',
    name: 'Transfer',
    component: () => import('@/components/transfer/TransferView.vue'),
    meta: { title: '教师调剂' }
  },
  {
    path: '/import-export',
    name: 'ImportExport',
    component: () => import('@/components/importExport/ImportExportView.vue'),
    meta: { title: '导入导出' }
  },
  {
    path: '/audit-logs',
    name: 'AuditLogs',
    component: () => import('@/components/auditLogs/AuditLogsView.vue'),
    meta: { title: '审计日志' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫 - 设置页面标题
router.beforeEach((to, from, next) => {
  if (to.meta.title) {
    document.title = `${to.meta.title} - 考试排考系统`
  }
  next()
})

export default router
