import api from '@/services/api'

function unwrap(response) {
  return response?.data?.data ?? response?.data ?? response
}

function asArray(value) {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.data)) return value.data
  return []
}

/**
 * Placeholder dealers — local stand-ins an agent creates for dealers who haven't
 * subscribed yet. A placeholder can later be connected to a real subscribed dealer
 * so the agent's records merge with the dealer's once they join.
 */
export const placeholderDealerService = {
  /**
   * GET /placeholder-dealers — the calling agent's placeholder dealers. Returns
   * [{ dealerId, firmName, dealerName, connectedDealerId, connectedDealer: {...}|null }].
   */
  async getAll() {
    const { data } = await api.get('/placeholder-dealers')
    return asArray(unwrap(data))
  },

  /** POST /placeholder-dealers — create a placeholder. Body: { firmName, dealerName?, displayName? }. */
  async create(payload) {
    const { data } = await api.post('/placeholder-dealers', payload)
    return unwrap(data)
  },

  /** PATCH /placeholder-dealers/:id — rename a placeholder. Body: { firmName?, dealerName?, displayName? }. */
  async update(id, payload) {
    const { data } = await api.patch(`/placeholder-dealers/${id}`, payload)
    return unwrap(data)
  },

  /** DELETE /placeholder-dealers/:id — remove a placeholder (blocked if it has processes). */
  async remove(id) {
    const { data } = await api.delete(`/placeholder-dealers/${id}`)
    return unwrap(data)
  },

  /** POST /placeholder-dealers/:id/connect — link to a real subscribed dealer. Body: { realDealerId }. */
  async connect(id, realDealerId) {
    const { data } = await api.post(`/placeholder-dealers/${id}/connect`, { realDealerId })
    return unwrap(data)
  },

  /** POST /placeholder-dealers/:id/disconnect — unlink from its real dealer. */
  async disconnect(id) {
    const { data } = await api.post(`/placeholder-dealers/${id}/disconnect`)
    return unwrap(data)
  },
}
