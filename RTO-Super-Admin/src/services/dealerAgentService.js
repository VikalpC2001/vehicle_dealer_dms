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
   * GET /dealer-agents/search?q= — agents the dealer could grant (min 2 chars,
   * excludes already-active grants). Returns compact agent summaries.
   * @param {string} q
   * @returns {Promise<object[]>}
   */
  async search(q) {
    const { data } = await api.get('/dealer-agents/search', { params: { q } })
    const result = unwrap(data)
    return Array.isArray(result) ? result : []
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

  /**
   * GET /dealer-agents/switch-preview?oldAgentId= — the old agent's OPEN assignments + ledger
   * balance, shown before confirming a switch.
   * @param {string} oldAgentId
   * @returns {Promise<{ agentId, openAssignmentCount, openAssignments, balance, hasBalance }>}
   */
  async switchPreview(oldAgentId) {
    const { data } = await api.get('/dealer-agents/switch-preview', { params: { oldAgentId } })
    return unwrap(data)
  },

  /**
   * POST /dealer-agents/switch — atomically switch off an agent (optionally onto a replacement),
   * settling or keeping the ledger and completing the old agent's open work.
   * @param {{ oldAgentId: string, newAgentId?: string, settleDecision: 'SETTLE'|'KEEP', settleAmount?: number }} payload
   * @returns {Promise<{ oldGrant, newGrant, completedCount, settledEntry }>}
   */
  async switch(payload) {
    const { data } = await api.post('/dealer-agents/switch', payload)
    return unwrap(data)
  },
}
