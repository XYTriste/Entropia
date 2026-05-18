import { ref, shallowRef } from 'vue'
import { API_MAP } from '@/api/index.js'

/**
 * 通用 CRUD 组合式函数
 * @param {string} entityPath - API 实体名，如 'teachers'
 */
export function useCrud(entityPath) {
  /* shallowRef：表格数据只读，不需要深层响应式。
   * el-table 内部状态独立维护，外层只需知道引用变化即可重渲染。
   * 避免 Vue 对每一行数据的每个属性做 Proxy 包装。 */
  const data = shallowRef([])
  const loading = ref(false)
  const pagination = ref({ page: 1, page_size: 20, total: 0 })
  const filters = ref({})
  const dialogVisible = ref(false)
  const form = ref({})
  const isEditing = ref(false)

  // 根据实体名获取对应的 API 函数集
  const api = API_MAP[entityPath]
  if (!api) {
    console.error(`[useCrud] 未知实体: ${entityPath}`)
  }

  async function fetchData() {
    if (!api) return
    loading.value = true
    try {
      const skip = (pagination.value.page - 1) * pagination.value.page_size
      const limit = pagination.value.page_size

      const res = await api.list({
        ...filters.value,
        skip: skip,
        limit: limit,
      })

      // 兼容多种后端返回格式
      let items = []
      let total = 0

      if (res && res.code === 0 && res.data) {
        if (Array.isArray(res.data)) {
          items = res.data
          total = res.data.length
        } else if (res.data.items) {
          items = res.data.items
          total = res.data.total || res.data.items.length
        }
      } else if (Array.isArray(res)) {
        items = res
        total = res.length
      } else if (res && Array.isArray(res.items)) {
        items = res.items
        total = res.total || res.items.length
      } else if (res && Array.isArray(res.data)) {
        items = res.data
        total = res.data.total || res.data.length
      } else {
        console.warn('[useCrud] 未知响应格式:', res)
      }

      data.value = items
      pagination.value.total = total
    } catch (error) {
      console.error('[useCrud] 请求失败:', error)
      throw error
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
    if (!api) return
    try {
      if (isEditing.value) {
        await api.update(form.value.id, form.value)
      } else {
        await api.create(form.value)
      }
      dialogVisible.value = false
      fetchData()
    } catch (e) {
      console.error('保存失败:', e)
    }
  }

  async function deleteItem(id) {
    if (!api) return
    try {
      await api.remove(id)
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
