import api from '@/services/api'

function unwrap(response) {
  return response?.data?.data ?? response?.data ?? response
}

/**
 * Per-dealer Finder-style tags — colored labels the dealer defines in Settings and applies
 * (MULTIPLE) to a vehicle process. These replace the old "process status" surfacing in the vehicle
 * list. Mirrors taskTemplateService's optional `dealerId` handling: it targets a dealer the caller
 * manages (an agent working a placeholder/managed dealer) and is sent as a query param on every call
 * and, for writes, also in the body — the backend reads whichever it expects; a dealer caller omits
 * it (token-scoped) and the backend resolves the dealer from the JWT.
 */
export const dealerTagService = {
  /**
   * GET /dealer-tags — the dealer's tags as a flat array.
   * Returns [{ tagId, tagName, colour, createdAt }].
   */
  async getAll(dealerId) {
    const { data } = await api.get('/dealer-tags', dealerId ? { params: { dealerId } } : undefined)
    const result = unwrap(data)
    return Array.isArray(result) ? result : []
  },

  /** POST /dealer-tags — { tagName, colour }. */
  async create(payload, dealerId) {
    const body = dealerId ? { ...payload, dealerId } : payload
    const { data } = await api.post('/dealer-tags', body, dealerId ? { params: { dealerId } } : undefined)
    return unwrap(data)
  },

  /** PATCH /dealer-tags/:id — { tagName?, colour? }. */
  async update(id, payload, dealerId) {
    const body = dealerId ? { ...payload, dealerId } : payload
    const { data } = await api.patch(`/dealer-tags/${id}`, body, dealerId ? { params: { dealerId } } : undefined)
    return unwrap(data)
  },

  /** DELETE /dealer-tags/:id. */
  async remove(id, dealerId) {
    const { data } = await api.delete(`/dealer-tags/${id}`, dealerId ? { params: { dealerId } } : undefined)
    return unwrap(data)
  },
}
