import api from '@/services/api'

function unwrap(response) {
  return response?.data?.data ?? response?.data ?? response
}

/**
 * Dealer→agent invitations. Dealer-authenticated methods create/list/resend/cancel invitations;
 * the `accept*` methods are PUBLIC (no session) and back the agent-onboarding page.
 */
export const agentInvitationService = {
  /**
   * POST /agent-invitations — invite a brand-new agent by email (dealer JWT).
   * @param {{ agentName: string, emailId: string, mobileNo?: string }} payload
   * @returns {Promise<object>} the created invitation
   */
  async create(payload) {
    const { data } = await api.post('/agent-invitations', payload)
    return unwrap(data)
  },

  /**
   * GET /agent-invitations — the dealer's pending invitations.
   * @returns {Promise<object[]>}
   */
  async list() {
    const { data } = await api.get('/agent-invitations')
    const result = unwrap(data)
    return Array.isArray(result) ? result : (result?.items ?? [])
  },

  /** POST /agent-invitations/:id/resend — re-send the invitation email. */
  async resend(id) {
    const { data } = await api.post(`/agent-invitations/${id}/resend`)
    return unwrap(data)
  },

  /** DELETE /agent-invitations/:id — cancel a pending invitation. */
  async cancel(id) {
    const { data } = await api.delete(`/agent-invitations/${id}`)
    return unwrap(data)
  },

  /**
   * GET /agent-invitations/accept/:token — PUBLIC. Validates the token and returns the prefill
   * (invited name/email/mobile + inviting dealer name). Throws on invalid/expired/used tokens.
   * @param {string} token
   * @returns {Promise<{ agentName: string, emailId: string, mobileNo: string|null, dealerName: string }>}
   */
  async getAcceptPrefill(token) {
    const { data } = await api.get(`/agent-invitations/accept/${token}`)
    return unwrap(data)
  },

  /**
   * POST /agent-invitations/accept/:token — PUBLIC. Creates the agent account + login and
   * (cap permitting) auto-grants it to the inviting dealer. Returns a token bundle for auto-login.
   * @param {string} token
   * @param {object} payload - firm/contact details + password
   * @returns {Promise<{ token: string, refreshToken?: string, user: object, granted: boolean }>}
   */
  async accept(token, payload) {
    const { data } = await api.post(`/agent-invitations/accept/${token}`, payload)
    return unwrap(data)
  },
}
