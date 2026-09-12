import api from '@/services/api'

function unwrap(response) {
  return response?.data?.data ?? response?.data ?? response
}

/**
 * Agent-wise upload categories — the agent's own "which documents to collect" configuration
 * (mirror of dealerWiseUploadCategoryService). `agentId` is taken from the JWT.
 */
export const agentWiseUploadCategoryService = {
  /**
   * GET /agent-wise-upload-categories/view-in-step — the ordered document checklist for the agent's
   * create-process wizard. Returns the `uploadCategory` array: [{ awucId, categoryId, categoryName,
   * orderRank, isRequired, processApi, isProcess, isViewInStep, bothSide }].
   */
  async getViewInStep() {
    const { data } = await api.get('/agent-wise-upload-categories/view-in-step')
    const payload = unwrap(data)
    return payload?.uploadCategory ?? []
  },

  /** GET /agent-wise-upload-categories — full per-agent list (config screen). */
  async getAll() {
    const { data } = await api.get('/agent-wise-upload-categories')
    const payload = unwrap(data)
    return payload?.uploadCategory ?? []
  },

  /**
   * POST /agent-wise-upload-categories — link a global category to the agent.
   * Body: { uploadCategoryId, isRequired, isProcess, isViewInStep, processApi? }.
   */
  async create(payload) {
    const { data } = await api.post('/agent-wise-upload-categories', payload)
    return unwrap(data)
  },

  /** PATCH /agent-wise-upload-categories/:id — full replace of the link's flags. */
  async update(id, payload) {
    const { data } = await api.patch(`/agent-wise-upload-categories/${id}`, payload)
    return unwrap(data)
  },

  /** DELETE /agent-wise-upload-categories/:id (by awucId). */
  async remove(id) {
    const { data } = await api.delete(`/agent-wise-upload-categories/${id}`)
    return unwrap(data)
  },

  /** PUT /agent-wise-upload-categories/order — items: [{ awucId, orderRank }]. */
  async updateOrder(items) {
    const { data } = await api.put('/agent-wise-upload-categories/order', { items })
    const payload = unwrap(data)
    return payload?.uploadCategory ?? []
  },
}
