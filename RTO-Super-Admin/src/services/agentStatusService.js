import api from '@/services/api'

function unwrap(response) {
  return response?.data?.data ?? response?.data ?? response
}

export const agentStatusService = {
  /**
   * GET /agent-statuses — the agent's custom statuses (from the JWT agent),
   * ordered by statusRank. Returns [{ statusId, statusName, colour, statusRank }].
   */
  async getAll() {
    const { data } = await api.get('/agent-statuses')
    const result = unwrap(data)
    return Array.isArray(result) ? result : []
  },

  /**
   * POST /agent-statuses — full sync of the agent's statuses. Items with statusId
   * are updated, items without are created, and existing rows missing from the array
   * are deleted. Array order sets statusRank. Each item: { statusId?, statusName, colour }.
   */
  async sync(statusData) {
    const { data } = await api.post('/agent-statuses', { statusData })
    const result = unwrap(data)
    return Array.isArray(result) ? result : []
  },

  /** PUT /agent-statuses/order — reorder by statusRank. items: [{ statusId, statusRank }]. */
  async updateOrder(items) {
    const { data } = await api.put('/agent-statuses/order', { items })
    const result = unwrap(data)
    return Array.isArray(result) ? result : []
  },
}
