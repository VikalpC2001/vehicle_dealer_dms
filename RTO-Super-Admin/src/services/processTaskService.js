import api from '@/services/api'

function unwrap(response) {
  return response?.data?.data ?? response?.data ?? response
}

export const processTaskService = {
  /** GET /process-tasks?processId= — tasks for a process, ordered by date. */
  async getByProcess(processId) {
    const { data } = await api.get('/process-tasks', { params: { processId } })
    const result = unwrap(data)
    return Array.isArray(result) ? result : []
  },

  /** POST /process-tasks — { processId, taskName, taskDate, assignUserId?, status? }. */
  async create(payload) {
    const { data } = await api.post('/process-tasks', payload)
    return unwrap(data)
  },

  /** PATCH /process-tasks/:id — { taskName, taskDate, assignUserId?, status? }. */
  async update(id, payload) {
    const { data } = await api.patch(`/process-tasks/${id}`, payload)
    return unwrap(data)
  },

  /** DELETE /process-tasks/:id. */
  async remove(id) {
    const { data } = await api.delete(`/process-tasks/${id}`)
    return unwrap(data)
  },
}
