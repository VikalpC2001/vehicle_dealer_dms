import api from '@/services/api'

function unwrap(response) {
  return response?.data?.data ?? response?.data ?? response
}

export const dealerWiseUploadCategoryService = {
  /**
   * GET /dealer-wise-upload-categories/view-in-step — the ordered document checklist
   * for the dealer's create-process wizard. dealerId is taken from the JWT.
   * Returns the `uploadCategory` array: [{ dwucId, categoryId, categoryName, orderRank,
   * isRequired, processApi, isProcess, isViewInStep, bothSide }].
   */
  async getViewInStep() {
    const { data } = await api.get('/dealer-wise-upload-categories/view-in-step')
    const payload = unwrap(data)
    return payload?.uploadCategory ?? []
  },

  /** GET /dealer-wise-upload-categories — full per-dealer list (config screens). */
  async getAll() {
    const { data } = await api.get('/dealer-wise-upload-categories')
    const payload = unwrap(data)
    return payload?.uploadCategory ?? []
  },

  /**
   * POST /dealer-wise-upload-categories — link a global category to the dealer.
   * Body: { uploadCategoryId, isRequired, isProcess, isViewInStep, processApi? }.
   */
  async create(payload) {
    const { data } = await api.post('/dealer-wise-upload-categories', payload)
    return unwrap(data)
  },

  /** PATCH /dealer-wise-upload-categories/:id — full replace of the link's flags. */
  async update(id, payload) {
    const { data } = await api.patch(`/dealer-wise-upload-categories/${id}`, payload)
    return unwrap(data)
  },

  /** DELETE /dealer-wise-upload-categories/:id (by dwucId). */
  async remove(id) {
    const { data } = await api.delete(`/dealer-wise-upload-categories/${id}`)
    return unwrap(data)
  },

  /** PUT /dealer-wise-upload-categories/order — items: [{ dwucId, orderRank }]. */
  async updateOrder(items) {
    const { data } = await api.put('/dealer-wise-upload-categories/order', { items })
    const payload = unwrap(data)
    return payload?.uploadCategory ?? []
  },
}
