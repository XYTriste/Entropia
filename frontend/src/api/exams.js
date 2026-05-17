import apiClient from './index.js'

export default {
  async list(params = {}) {
    const res = await apiClient.get('/exams', { params })
    return res.data || { items: [], total: 0 }
  },
  
  async get(id) {
    return await apiClient.get(`/exams/${id}`)
  },
  
  async create(data) {
    return await apiClient.post('/exams', data)
  },
  
  async update(id, data) {
    return await apiClient.put(`/exams/${id}`, data)
  },
  
  async delete(id) {
    return await apiClient.delete(`/exams/${id}`)
  },
  
  // 获取排考概览
  async getOverview() {
    return await apiClient.get('/exams/overview')
  }
}
