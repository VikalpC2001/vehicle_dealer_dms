import api from '@/services/api'
import { normalizePaginatedResponse } from '@/lib/pagination'

function unwrap(response) {
  return response?.data?.data ?? response?.data ?? response
}

function normalizeListResponse(data) {
  const normalized = normalizePaginatedResponse(data, 'agents', 10)
  return {
    agents: normalized.items,
    page: normalized.page,
    limit: normalized.limit,
    total: normalized.total,
    totalPages: normalized.totalPages,
  }
}

/** Resolves an agent's primary id across the shapes the API may return. */
export function getAgentId(agent) {
  return agent?.agentId ?? agent?.id ?? agent?._id
}

/**
 * Super-admin agent directory. Agents are RTO service providers that dealers can
 * grant access to and assign vehicle processes to.
 */
export const agentService = {
  /**
   * GET /agents?page=&limit= — paginated agent list (super-admin).
   * @param {{ page?: number, limit?: number }} [params]
   * @returns {Promise<{ agents: object[], page: number, limit: number, total: number, totalPages: number }>}
   */
  async getAll({ page = 1, limit = 10 } = {}) {
    const { data } = await api.get('/agents', { params: { page, limit } })
    return normalizeListResponse(data)
  },

  /**
   * GET /agents?limit=100 — flat list of agents for dropdowns.
   * @returns {Promise<object[]>}
   */
  async listAll() {
    const { data } = await api.get('/agents', { params: { page: 1, limit: 100 } })
    return normalizePaginatedResponse(data, 'agents', 100).items
  },

  /** GET /agents/:id — a single agent. */
  async getById(id) {
    const { data } = await api.get(`/agents/${id}`)
    return unwrap(data)
  },

  /** GET /agents/me — the caller agent's own profile. */
  async getMe() {
    const { data } = await api.get('/agents/me')
    return unwrap(data)
  },

  /** PATCH /agents/me — the agent edits their own profile (isSubscribe is preserved server-side). */
  async updateMe(payload) {
    const { data } = await api.patch('/agents/me', payload)
    return unwrap(data)
  },

  /** POST /agents — create an agent. */
  async create(payload) {
    const { data } = await api.post('/agents', payload)
    return unwrap(data)
  },

  /** PATCH /agents/:id — update an agent. */
  async update(id, payload) {
    const { data } = await api.patch(`/agents/${id}`, payload)
    return unwrap(data)
  },

  /** PATCH /agents/:id/subscription — super-admin toggles the agent's subscription. */
  async setSubscription(id, isSubscribe) {
    const { data } = await api.patch(`/agents/${id}/subscription`, { isSubscribe })
    return unwrap(data)
  },

  /** PATCH /agents/:id/access — super-admin pauses (`false`) or resumes (`true`) the agent's access. */
  async setAccess(id, isActive) {
    const { data } = await api.patch(`/agents/${id}/access`, { isActive })
    return unwrap(data) // { id, isActive }
  },

  /** DELETE /agents/:id — remove an agent. */
  async remove(id) {
    const { data } = await api.delete(`/agents/${id}`)
    return unwrap(data)
  },

  /**
   * POST /agents/with-user — create the agent's owner/login user.
   * Body: { agentId, userName, emailId, mobileNo, password }.
   */
  async createUser(payload) {
    const { data } = await api.post('/agents/with-user', payload)
    return unwrap(data)
  },
}
