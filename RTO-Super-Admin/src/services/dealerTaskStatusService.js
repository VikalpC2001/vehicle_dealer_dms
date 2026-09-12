import api from '@/services/api'

function unwrap(response) {
  return response?.data?.data ?? response?.data ?? response
}

/**
 * Per-dealer task-board columns (Jira-like task statuses) — the columns on the /dealer/board task
 * board. An optional `dealerId` targets a dealer the caller manages (an agent working a
 * placeholder/managed dealer); a dealer caller omits it (token-scoped) and the backend resolves the
 * dealer from the JWT.
 */
export const dealerTaskStatusService = {
  /**
   * GET /dealer-task-statuses (or /dealer-task-statuses/:dealerId when scoped to a managed dealer) —
   * the dealer's task-board columns, ordered by statusRank.
   * Returns [{ statusId, dealerId, statusName, colour, statusRank, isDone }].
   */
  async getAll(dealerId) {
    const url = dealerId ? `/dealer-task-statuses/${dealerId}` : '/dealer-task-statuses'
    const { data } = await api.get(url)
    const result = unwrap(data)
    return Array.isArray(result) ? result : []
  },

  /**
   * POST /dealer-task-statuses — full sync of the dealer's task statuses. Items with statusId are
   * updated, items without are created, and existing rows missing from the array are deleted. Array
   * order sets statusRank. Each item: { statusId?, statusName, colour, isDone }.
   */
  async sync(statusData, dealerId) {
    const body = dealerId ? { statusData, dealerId } : { statusData }
    const { data } = await api.post('/dealer-task-statuses', body)
    const result = unwrap(data)
    return Array.isArray(result) ? result : []
  },

  /** PUT /dealer-task-statuses/order — reorder by statusRank. items: [{ statusId, statusRank }]. */
  async updateOrder(items, dealerId) {
    const body = dealerId ? { items, dealerId } : { items }
    const { data } = await api.put('/dealer-task-statuses/order', body)
    const result = unwrap(data)
    return Array.isArray(result) ? result : []
  },
}
