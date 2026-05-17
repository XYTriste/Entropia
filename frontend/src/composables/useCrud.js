import { ref } from 'vue'
import api from '@/api/index.js'

/**
 * 通用 CRUD 组合式函数
 * @param {string} entityPath - API 路径前缀，如 'teachers'
 */
export function useCrud(entityPath) {
  const data = ref([])
  const loading = ref(false)
  const pagination = ref({ page: 1, page_size: 20, total: 0 })
  const filters = ref({})
  const dialogVisible = ref(false)
  const form = ref({})
  const isEditing = ref(false)

  async function fetchData() {
    loading.value = true
    try {
      // 后端使用 skip/limit 分页，前端使用 page/page_size
      const skip = (pagination.value.page - 1) * pagination.value.page_size
      const limit = pagination.value.page_size

      const res = await api.get(`/${entityPath}/`, {
        params: {
          ...filters.value,
          skip: skip,
          limit: limit,
        },
      })

      // 兼容多种后端返回格式
      // 格式1: { code: 0, message: 'success', data: { items: [...], total: 100 } }
      // 格式2: { items: [...], total: 100 }
      // 格式3: [...] 直接返回数组
      // 格式4: { data: [...], total: 100 }

      let items = []
      let total = 0

      if (res && res.code === 0 && res.data) {
        // 格式1: 标准包装格式 { code, message, data }
        if (Array.isArray(res.data)) {
          items = res.data
          total = res.data.length
        } else if (res.data.items) {
          items = res.data.items
          total = res.data.total || res.data.items.length
        }
      } else if (Array.isArray(res)) {
        // 格式3: 直接返回数组
        items = res
        total = res.length
      } else if (res && Array.isArray(res.items)) {
        // 格式2: { items: [...], total: 100 }
        items = res.items
        total = res.total || res.items.length
      } else if (res && Array.isArray(res.data)) {
        // 格式4: { data: [...], total: 100 }
        items = res.data
        total = res.data.total || res.data.length
      } else {
        console.warn('[useCrud] 未知响应格式:', res)
      }

      data.value = items
      pagination.value.total = total
    } catch (error) {
      console.error('[useCrud] 请求失败:', error)
      data.value = []
      pagination.value.total = 0
    } finally {
      loading.value = false
    }
  }

  function openDialog(item = null) {
    isEditing.value = !!item
    form.value = item ? { ...item } : {}
    dialogVisible.value = true
  }

  async function save() {
    try {
      if (isEditing.value) {
        await api.put(`/${entityPath}/${form.value.id}`, form.value)
      } else {
        await api.post(`/${entityPath}/`, form.value)
      }
      dialogVisible.value = false
      fetchData()
    } catch (e) {
      console.error('保存失败:', e)
    }
  }

  async function deleteItem(id) {
    try {
      await api.delete(`/${entityPath}/${id}`)
      fetchData()
    } catch (e) {
      console.error('删除失败:', e)
    }
  }

  return {
    data,
    loading,
    pagination,
    filters,
    dialogVisible,
    form,
    isEditing,
    fetchData,
    openDialog,
    save,
    deleteItem,
  }
}
