import apiClient from './index.js'

export default {
  // 获取教师列表
  async list(params = {}) {
    const res = await apiClient.get('/teachers', { params })
    return res.data || { items: [], total: 0 }
  },
  
  // 获取单个教师
  async get(id) {
    return await apiClient.get(`/teachers/${id}`)
  },
  
  // 创建教师
  async create(data) {
    return await apiClient.post('/teachers', data)
  },
  
  // 更新教师
  async update(id, data) {
    return await apiClient.put(`/teachers/${id}`, data)
  },
  
  // 删除教师
  async delete(id) {
    return await apiClient.delete(`/teachers/${id}`)
  }
}
