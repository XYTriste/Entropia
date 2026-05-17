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
      const res = await api.get(`/${entityPath}/`, {
        params: {
          ...filters.value,
          page: pagination.value.page,
          page_size: pagination.value.page_size,
        },
      })
      data.value = res.items || res.data || []
      pagination.value.total = res.total || 0
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
