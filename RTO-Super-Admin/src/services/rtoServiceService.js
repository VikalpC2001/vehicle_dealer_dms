import api from '@/services/api'
import { normalizePaginatedResponse } from '@/lib/pagination'

/**
 * RTO services catalog (name transfer, etc.) — picked when a dealer assigns a
 * vehicle process to an agent.
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
}
