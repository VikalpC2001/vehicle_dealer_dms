import api from '@/services/api'

/** Unwraps the `{ data: { ... } }` API envelope. */
function unwrap(response) {
  return response?.data?.data ?? response?.data ?? response
}

export const processExpenseService = {
  /** GET /process-expenses?processId= — a process's expenses, oldest first. */
  async getByProcess(processId) {
    const { data } = await api.get('/process-expenses', { params: { processId } })
    const result = unwrap(data)
    return Array.isArray(result) ? result : []
  },

  /** POST /process-expenses — { processId, label, amount, category? }. */
  async create(payload) {
    const { data } = await api.post('/process-expenses', payload)
    return unwrap(data)
  },

  /** PATCH /process-expenses/:id — { label, amount, category? }. */
  async update(id, payload) {
    const { data } = await api.patch(`/process-expenses/${id}`, payload)
    return unwrap(data)
  },

  /** DELETE /process-expenses/:id. */
  async remove(id) {
    const { data } = await api.delete(`/process-expenses/${id}`)
    return unwrap(data)
  },
}
