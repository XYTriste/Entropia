import apiClient from './index.js'

export default {
  async list(params = {}) {
    const res = await apiClient.get('/courses', { params })
    return res.data || { items: [], total: 0 }
  },
  
  async get(id) {
    return await apiClient.get(`/courses/${id}`)
  },
  
  async create(data) {
    return await apiClient.post('/courses', data)
  },
  
  async update(id, data) {
    return await apiClient.put(`/courses/${id}`, data)
  },
  
  async delete(id) {
    return await apiClient.delete(`/courses/${id}`)
  }
}
