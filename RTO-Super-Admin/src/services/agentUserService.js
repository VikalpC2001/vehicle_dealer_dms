import api from '@/services/api'

function unwrap(response) {
  return response?.data?.data ?? response?.data ?? response
}

export const agentUserService = {
  /**
   * GET /agent-wise-users — users linked to the agent (the agent's staff).
   * Returns [{ awuId, userId, agentId, user: { userId, userName, emailId, mobileNo } }].
   */
  async getAll() {
    const { data } = await api.get('/agent-wise-users')
    const result = unwrap(data)
    return Array.isArray(result) ? result : []
  },

  /**
   * POST /agent-wise-users/with-user — create a brand-new verified user and link
   * them to the agent in one call. Body: { userName, emailId, mobileNo, password }.
   * Returns the created link including its awuId.
   */
  async createUser(payload) {
    const { data } = await api.post('/agent-wise-users/with-user', payload)
    return unwrap(data)
  },

  /** DELETE /agent-wise-users/:id — unlink a user from the agent (by awuId). */
  async remove(awuId) {
    const { data } = await api.delete(`/agent-wise-users/${awuId}`)
    return unwrap(data)
  },
}
