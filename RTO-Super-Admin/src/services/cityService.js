import api from '@/services/api'
import { normalizePaginatedResponse } from '@/lib/pagination'

function unwrap(response) {
  return response?.data?.data ?? response?.data ?? response
}

function normalizeListResponse(data) {
  return normalizePaginatedResponse(data, 'cities', 50)
}

export function getCityId(city) {
  return city?.id ?? city?._id ?? city?.cityId
}

export const cityService = {
  async getAll({ page = 1, limit = 50, stateId } = {}) {
    const params = { page, limit }
    if (stateId) params.stateId = stateId
    const { data } = await api.get('/cities', { params })
    return normalizeListResponse(data)
  },

  async create(payload) {
    const { data } = await api.post('/cities', payload)
    return unwrap(data)
  },

  async update(id, payload) {
    const { data } = await api.patch(`/cities/${id}`, payload)
    return unwrap(data)
  },

  async delete(id) {
    const { data } = await api.delete(`/cities/${id}`)
    return unwrap(data)
  },
}
