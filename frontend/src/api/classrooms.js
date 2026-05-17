import apiClient from './index.js'

export default {
  async list(params = {}) {
    const res = await apiClient.get('/classrooms', { params })
    return res.data || { items: [], total: 0 }
  },
  
  async get(id) {
    return await apiClient.get(`/classrooms/${id}`)
  },
  
  async create(data) {
    return await apiClient.post('/classrooms', data)
  },
  
  async update(id, data) {
    return await apiClient.put(`/classrooms/${id}`, data)
  },
  
  async delete(id) {
    return await apiClient.delete(`/classrooms/${id}`)
  }
}
