import api from '@/services/api'

function unwrap(response) {
  return response?.data?.data ?? response?.data ?? response
}

/**
 * Optional `dealerId` targets a dealer the caller manages (an agent working a placeholder/managed
 * dealer). It is sent as a query param on every call and, for writes, also in the body — the backend
 * reads whichever it expects (`resolveManagedDealerId`); a dealer caller omits it (token-scoped).
 */
export const personService = {
  /** GET /persons?processId= — buyer/seller rows for a process, ordered by createdAt. */
  async getByProcess(processId, dealerId) {
    const { data } = await api.get('/persons', {
      params: { processId, ...(dealerId ? { dealerId } : {}) },
    })
    const result = unwrap(data)
    return Array.isArray(result) ? result : []
  },

  /** POST /persons — { processId, personName, mobileNumber, personType, address?, idImageName? }.
   * `idImageName` (a flat upload key) is stored as the person's ID photo and linked to them. */
  async create(payload, dealerId) {
    const body = dealerId ? { ...payload, dealerId } : payload
    const { data } = await api.post('/persons', body, dealerId ? { params: { dealerId } } : undefined)
    return unwrap(data)
  },

  /** PATCH /persons/:id — { personName, mobileNumber, personType, address?, idImageName? }.
   * A new `idImageName` replaces the person's linked ID photo. */
  async update(id, payload, dealerId) {
    const body = dealerId ? { ...payload, dealerId } : payload
    const { data } = await api.patch(`/persons/${id}`, body, dealerId ? { params: { dealerId } } : undefined)
    return unwrap(data)
  },

  /** DELETE /persons/:id. */
  async remove(id, dealerId) {
    const { data } = await api.delete(`/persons/${id}`, dealerId ? { params: { dealerId } } : undefined)
    return unwrap(data)
  },

  /**
   * POST /persons/change-buyer — cancel the current active buyer (kept for history with their ID)
   * and add a new one. `payload` = { processId, personName, mobileNumber, address?, buyerIdImageName? }.
   */
  async changeBuyer(payload, dealerId) {
    const body = dealerId ? { ...payload, dealerId } : payload
    const { data } = await api.post('/persons/change-buyer', body, dealerId ? { params: { dealerId } } : undefined)
    return unwrap(data)
  },
}
