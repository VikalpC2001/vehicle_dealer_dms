import api from '@/services/api'

function unwrap(response) {
  return response?.data?.data ?? response?.data ?? response
}

/**
 * Shared, per-process comment thread. Anchored on `processId`, so the same thread is visible to the
 * dealer owner and the agent (assigned or managing) — agent comments appear on the dealer's assigned
 * process and vice-versa. Backed by `/vehicle-processes/:id/comments`.
 */
export const commentsService = {
  /** GET /vehicle-processes/:id/comments — the thread (oldest first). */
  async list(processId) {
    const { data } = await api.get(`/vehicle-processes/${processId}/comments`)
    const result = unwrap(data)
    return Array.isArray(result) ? result : []
  },

  /** POST /vehicle-processes/:id/comments — add a comment. `authorRole` is derived server-side. */
  async create(processId, body) {
    const { data } = await api.post(`/vehicle-processes/${processId}/comments`, { body })
    return unwrap(data)
  },

  /** PATCH /vehicle-processes/:id/comments/:commentId — edit your own comment. */
  async update(processId, commentId, body) {
    const { data } = await api.patch(`/vehicle-processes/${processId}/comments/${commentId}`, { body })
    return unwrap(data)
  },

  /** DELETE /vehicle-processes/:id/comments/:commentId — delete your own comment (super-admin: any). */
  async remove(processId, commentId) {
    const { data } = await api.delete(`/vehicle-processes/${processId}/comments/${commentId}`)
    return unwrap(data)
  },
}
