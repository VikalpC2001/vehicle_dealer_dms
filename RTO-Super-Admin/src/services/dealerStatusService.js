import api from '@/services/api'

function unwrap(response) {
  return response?.data?.data ?? response?.data ?? response
}

export const dealerStatusService = {
  /**
   * GET /dealer-statuses — the dealer's custom statuses (from the JWT dealer),
   * ordered by statusRank. Returns [{ statusId, statusName, colour, statusRank }].
   */
  async getAll() {
    const { data } = await api.get('/dealer-statuses')
    const result = unwrap(data)
    return Array.isArray(result) ? result : []
  },

  /**
   * POST /dealer-statuses — full sync of the dealer's statuses. Items with statusId
   * are updated, items without are created, and existing rows missing from the array
   * are deleted. Array order sets statusRank. Each item: { statusId?, statusName, colour }.
   */
  async sync(statusData) {
    const { data } = await api.post('/dealer-statuses', { statusData })
    const result = unwrap(data)
    return Array.isArray(result) ? result : []
  },

  /** PUT /dealer-statuses/order — reorder by statusRank. items: [{ statusId, statusRank }]. */
  async updateOrder(items) {
    const { data } = await api.put('/dealer-statuses/order', { items })
    const result = unwrap(data)
    return Array.isArray(result) ? result : []
  },
}
