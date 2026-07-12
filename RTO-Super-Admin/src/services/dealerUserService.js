import api from '@/services/api'

function unwrap(response) {
  return response?.data?.data ?? response?.data ?? response
}

export const dealerUserService = {
  /**
   * GET /dealer-wise-users — users linked to the dealer (for task assignee dropdown).
   * Returns [{ dwuId, userId, dealerId, user: { userId, userName, emailId, mobileNo } }].
   */
  async getAll() {
    const { data } = await api.get('/dealer-wise-users')
    const result = unwrap(data)
    return Array.isArray(result) ? result : []
  },

  /**
   * POST /dealer-wise-users/with-user — create a brand-new verified user and link
   * them to the dealer in one call. Body: { userName, emailId, mobileNo, password }.
   */
  async createUser(payload) {
    const { data } = await api.post('/dealer-wise-users/with-user', payload)
    return unwrap(data)
  },

  /** DELETE /dealer-wise-users/:id — unlink a user from the dealer (by dwuId). */
  async remove(dwuId) {
    const { data } = await api.delete(`/dealer-wise-users/${dwuId}`)
    return unwrap(data)
  },
}
