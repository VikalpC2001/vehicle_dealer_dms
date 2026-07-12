import api from '@/services/api'

function unwrap(response) {
  return response?.data?.data ?? response?.data ?? response
}

export const dealerReferenceService = {
  /**
   * GET /dealer-references/ddl — references for a dropdown (no pagination), sorted by name.
   * dealerId is taken from the JWT. Returns [{ referenceId, referenceName, referenceNumber }].
   */
  async getDdl() {
    const { data } = await api.get('/dealer-references/ddl')
    const payload = unwrap(data)
    return Array.isArray(payload) ? payload : []
  },

  /** GET /dealer-references — paginated; returns the rows array (settings list). */
  async getAll({ page = 1, limit = 100 } = {}) {
    const { data } = await api.get('/dealer-references', { params: { page, limit } })
    const inner = data?.data ?? data
    return Array.isArray(inner) ? inner : inner?.data ?? []
  },

  /** POST /dealer-references — { referenceName, referenceNumber }. */
  async create(payload) {
    const { data } = await api.post('/dealer-references', payload)
    return unwrap(data)
  },

  /** PATCH /dealer-references/:id — { referenceName, referenceNumber }. */
  async update(id, payload) {
    const { data } = await api.patch(`/dealer-references/${id}`, payload)
    return unwrap(data)
  },

  /** DELETE /dealer-references/:id. */
  async remove(id) {
    const { data } = await api.delete(`/dealer-references/${id}`)
    return unwrap(data)
  },
}
