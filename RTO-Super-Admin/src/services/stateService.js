import api from '@/services/api'
import { normalizePaginatedResponse } from '@/lib/pagination'

function unwrap(response) {
  return response?.data?.data ?? response?.data ?? response
}

function normalizeListResponse(data, listKey) {
  return normalizePaginatedResponse(data, listKey, 50)
}

export function getStateId(state) {
  return state?.id ?? state?._id ?? state?.stateId
}

export const stateService = {
  async getAll({ page = 1, limit = 50 } = {}) {
    const { data } = await api.get('/states', { params: { page, limit } })
    return normalizeListResponse(data, 'states')
  },

  async getDdl() {
    const { data } = await api.get('/states/ddl')
    const payload = unwrap(data)
    const list = Array.isArray(payload) ? payload : payload?.states ?? payload?.items ?? []
    return list.map((s) => ({
      id: getStateId(s),
      stateName: s.stateName ?? s.name ?? s.label ?? '',
    }))
  },

  async create(payload) {
    const { data } = await api.post('/states', payload)
    return unwrap(data)
  },

  async update(id, payload) {
    const { data } = await api.patch(`/states/${id}`, payload)
    return unwrap(data)
  },

  async delete(id) {
    const { data } = await api.delete(`/states/${id}`)
    return unwrap(data)
  },
}
