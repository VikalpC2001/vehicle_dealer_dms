import api from '@/services/api'
import { normalizePaginatedResponse } from '@/lib/pagination'

function unwrap(response) {
  return response?.data?.data ?? response?.data ?? response
}

/**
 * Dealer↔agent khata (ledger). The backend scopes by the caller's token (dealer vs agent), so the
 * SAME methods serve both personas. `counterpartyId` is the agent's id (dealer caller) or the
 * dealer's id (agent caller) — the page derives it from the account row + the logged-in role.
 */
export const khataService = {
  /** GET /khata/accounts — the caller's accounts (one per counterparty) with balances. */
  async getAccounts({ page = 1, limit = 50 } = {}) {
    const { data } = await api.get('/khata/accounts', { params: { page, limit } })
    const n = normalizePaginatedResponse(data, 'accounts', 50)
    return { accounts: n.items, page: n.page, limit: n.limit, total: n.total, totalPages: n.totalPages }
  },

  /** GET /khata/accounts/:counterpartyId/statement — { account, entries, meta }. */
  async getStatement(counterpartyId, { page = 1, limit = 100 } = {}) {
    const { data } = await api.get(`/khata/accounts/${counterpartyId}/statement`, {
      params: { page, limit },
    })
    return unwrap(data)
  },

  /** POST /khata/entries — post a credit/debit entry. Returns { account, entry }. */
  async postEntry({ counterpartyId, direction, amount, description, assignmentId }) {
    const { data } = await api.post('/khata/entries', {
      counterpartyId,
      direction,
      amount,
      description,
      assignmentId,
    })
    return unwrap(data)
  },

  /** POST /khata/entries/:id/reverse — reverse an entry (posts a counter-entry). */
  async reverseEntry(ledgerEntryId) {
    const { data } = await api.post(`/khata/entries/${ledgerEntryId}/reverse`)
    return unwrap(data)
  },

  /** POST /khata/accounts/:counterpartyId/settle — balancing entry (optional partial `amount`). */
  async settle(counterpartyId, amount) {
    const { data } = await api.post(
      `/khata/accounts/${counterpartyId}/settle`,
      amount != null ? { amount } : {},
    )
    return unwrap(data)
  },
}
