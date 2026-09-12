import api from '@/services/api'
import { normalizePaginatedResponse } from '@/lib/pagination'

function unwrap(response) {
  return response?.data?.data ?? response?.data ?? response
}

/** Resolves an RTO service id across possible key shapes. */
export function getRtoServiceId(service) {
  return service?.serviceId ?? service?.id ?? service?._id
}

/**
 * RTO services catalog (name transfer, insurance, etc.). Read by any authenticated user (the dealer's
 * assign-agent picker); create/update/delete are super-admin only (the RTO Services admin page).
 */
export const rtoServiceService = {
  /**
   * GET /rto-services?page=1&limit=100 — flat list of RTO services for dropdowns.
   * @returns {Promise<object[]>}
   */
  async listAll() {
    const { data } = await api.get('/rto-services', { params: { page: 1, limit: 100 } })
    return normalizePaginatedResponse(data, 'rtoServices', 100).items
  },

  /** GET /rto-services — paginated list for the admin table. */
  async getAll({ page = 1, limit = 20 } = {}) {
    const { data } = await api.get('/rto-services', { params: { page, limit } })
    return normalizePaginatedResponse(data, 'rtoServices', limit)
  },

  /** POST /rto-services — { serviceName, shortName }. Super-admin only. */
  async create(payload) {
    const { data } = await api.post('/rto-services', payload)
    return unwrap(data)
  },

  /** PATCH /rto-services/:id — { serviceName, shortName }. Super-admin only. */
  async update(id, payload) {
    const { data } = await api.patch(`/rto-services/${id}`, payload)
    return unwrap(data)
  },

  /** DELETE /rto-services/:id — super-admin only (blocked if the service is in use). */
  async delete(id) {
    const { data } = await api.delete(`/rto-services/${id}`)
    return unwrap(data)
  },
}
