import api from '@/services/api'

/** Unwraps the `{ data: { ... } }` API envelope. */
function unwrap(response) {
  return response?.data?.data ?? response?.data ?? response
}

/**
 * Optional `dealerId` targets a dealer the caller manages (an agent working a placeholder/managed
 * dealer). Sent as a query param on every call and, for writes, also in the body — the backend reads
 * whichever it expects (`resolveManagedDealerId`); a dealer caller omits it (token-scoped).
 */
export const processExpenseService = {
  /** GET /process-expenses?processId= — a process's expenses, oldest first. */
  async getByProcess(processId, dealerId) {
    const { data } = await api.get('/process-expenses', {
      params: { processId, ...(dealerId ? { dealerId } : {}) },
    })
    const result = unwrap(data)
    return Array.isArray(result) ? result : []
  },

  /** POST /process-expenses — { processId, label, amount, category? }. */
  async create(payload, dealerId) {
    const body = dealerId ? { ...payload, dealerId } : payload
    const { data } = await api.post('/process-expenses', body, dealerId ? { params: { dealerId } } : undefined)
    return unwrap(data)
  },

  /** PATCH /process-expenses/:id — { label, amount, category? }. */
  async update(id, payload, dealerId) {
    const body = dealerId ? { ...payload, dealerId } : payload
    const { data } = await api.patch(`/process-expenses/${id}`, body, dealerId ? { params: { dealerId } } : undefined)
    return unwrap(data)
  },

  /** DELETE /process-expenses/:id. */
  async remove(id, dealerId) {
    const { data } = await api.delete(`/process-expenses/${id}`, dealerId ? { params: { dealerId } } : undefined)
    return unwrap(data)
  },
}
