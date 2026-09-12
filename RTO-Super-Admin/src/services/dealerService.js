import api from '@/services/api'
import { normalizePaginatedResponse } from '@/lib/pagination'

function unwrap(response) {
  return response?.data?.data ?? response?.data ?? response
}

function normalizeListResponse(data) {
  const normalized = normalizePaginatedResponse(data, 'dealers', 10)
  return {
    dealers: normalized.items,
    page: normalized.page,
    limit: normalized.limit,
    total: normalized.total,
    totalPages: normalized.totalPages,
  }
}

export function getDealerId(dealer) {
  return dealer?.id ?? dealer?._id ?? dealer?.dealerId
}

export const dealerService = {
  async getAll({ page = 1, limit = 10 } = {}) {
    const { data } = await api.get('/dealers', { params: { page, limit } })
    return normalizeListResponse(data)
  },

  async getById(id) {
    const { data } = await api.get(`/dealers/${id}`)
    return unwrap(data)
  },

  async create(payload) {
    const { data } = await api.post('/dealers', payload)
    return unwrap(data)
  },

  async update(id, payload) {
    const { data } = await api.patch(`/dealers/${id}`, payload)
    return unwrap(data)
  },

  async delete(id) {
    const { data } = await api.delete(`/dealers/${id}`)
    return unwrap(data)
  },

  /**
   * PATCH /dealers/:id/agent-slots — super-admin sets a dealer's active-agent limit.
   * @param {string} id
   * @param {{ maxAgents?: number, deltaSlots?: number }} payload
   */
  async raiseAgentSlots(id, payload) {
    const { data } = await api.patch(`/dealers/${id}/agent-slots`, payload)
    return unwrap(data) // { dealerId, maxAgents, used }
  },

  /** PATCH /dealers/:id/subscription — super-admin toggles the dealer's subscription. */
  async setSubscription(id, isSubscribe) {
    const { data } = await api.patch(`/dealers/${id}/subscription`, { isSubscribe })
    return unwrap(data) // { id, isSubscribe }
  },
}
