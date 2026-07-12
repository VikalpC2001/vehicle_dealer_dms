import api from '@/services/api'

function unwrap(response) {
  return response?.data?.data ?? response?.data ?? response
}

/**
 * Dealer ↔ agent grants (dealer JWT). A grant lets the dealer assign vehicle
 * processes to that agent. The cap info reports how many agents the dealer may grant.
 */
export const dealerAgentService = {
  /**
   * GET /dealer-agents — the dealer's active agent grants plus cap usage.
   * @returns {Promise<{ items: object[], capInfo: { maxAgents: number, used: number, overCap: boolean } | null }>}
   */
  async getAll() {
    const { data } = await api.get('/dealer-agents')
    const result = unwrap(data) ?? {}
    return {
      items: Array.isArray(result.items) ? result.items : [],
      capInfo: result.capInfo ?? null,
    }
  },

  /**
   * POST /dealer-agents — grant the dealer access to an agent.
   * @param {string} agentId
   * @returns {Promise<{ grant: object, capInfo: object }>}
   */
  async grant(agentId) {
    const { data } = await api.post('/dealer-agents', { agentId })
    return unwrap(data)
  },

  /** DELETE /dealer-agents/:id — revoke a grant by dealerAgentId. */
  async revoke(dealerAgentId) {
    const { data } = await api.delete(`/dealer-agents/${dealerAgentId}`)
    return unwrap(data)
  },
}
