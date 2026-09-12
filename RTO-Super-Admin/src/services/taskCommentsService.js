import api from '@/services/api'

function unwrap(response) {
  return response?.data?.data ?? response?.data ?? response
}

/**
 * Shared, per-task comment thread. Anchored on `processTaskId`, so the same thread is visible to the
 * dealer's team (owner + employees) and the managing/assigned agent — the per-task equivalent of the
 * process comment thread. Backed by `/process-tasks/:id/comments`.
 *
 * An optional `dealerId` targets a dealer the caller manages (an agent working a placeholder/managed
 * dealer, or a super-admin). It is threaded as a query param on every call; a dealer caller omits it
 * (token-scoped).
 */
export const taskCommentsService = {
  /** GET /process-tasks/:id/comments — the thread (oldest first). */
  async list(taskId, dealerId) {
    const { data } = await api.get(
      `/process-tasks/${taskId}/comments`,
      dealerId ? { params: { dealerId } } : undefined,
    )
    const result = unwrap(data)
    return Array.isArray(result) ? result : []
  },

  /** POST /process-tasks/:id/comments — add a comment. `authorRole` is derived server-side. */
  async create(taskId, body, dealerId) {
    const { data } = await api.post(
      `/process-tasks/${taskId}/comments`,
      { body },
      dealerId ? { params: { dealerId } } : undefined,
    )
    return unwrap(data)
  },

  /** PATCH /process-tasks/:id/comments/:commentId — edit your own comment. */
  async update(taskId, commentId, body, dealerId) {
    const { data } = await api.patch(
      `/process-tasks/${taskId}/comments/${commentId}`,
      { body },
      dealerId ? { params: { dealerId } } : undefined,
    )
    return unwrap(data)
  },

  /** DELETE /process-tasks/:id/comments/:commentId — delete your own comment (super-admin: any). */
  async remove(taskId, commentId, dealerId) {
    const { data } = await api.delete(
      `/process-tasks/${taskId}/comments/${commentId}`,
      dealerId ? { params: { dealerId } } : undefined,
    )
    return unwrap(data)
  },
}
