import api from '@/services/api'

function unwrap(response) {
  return response?.data?.data ?? response?.data ?? response
}

/**
 * Per-dealer predefined job/task catalog (e.g. "PUC", "Insurance", "Name transfer") picked when
 * creating a task. An optional `dealerId` targets a dealer the caller manages (an agent working a
 * placeholder/managed dealer): it is sent as a query param on every call and, for writes, also in
 * the body — the backend reads whichever it expects; a dealer caller omits it (token-scoped).
 */
export const taskTemplateService = {
  /**
   * GET /dealer-task-templates — the dealer's full job catalog as a flat array, ordered by
   * templateName. The endpoint is paginated ({ data, meta }) and capped at 100/page server-side, so
   * this pages through and concatenates rather than requesting one oversized page.
   * Returns [{ templateId, dealerId, templateName }].
   */
  async getAll(dealerId) {
    const base = dealerId ? { dealerId } : {}
    const all = []
    let page = 1
    for (;;) {
      const { data } = await api.get('/dealer-task-templates', { params: { page, limit: 100, ...base } })
      const inner = unwrap(data)
      const items = Array.isArray(inner) ? inner : inner?.data
      if (Array.isArray(items)) all.push(...items)
      const totalPages = inner?.meta?.totalPages ?? 1
      if (page >= totalPages) break
      page += 1
    }
    return all
  },

  /** POST /dealer-task-templates — { templateName }. */
  async create(payload, dealerId) {
    const body = dealerId ? { ...payload, dealerId } : payload
    const { data } = await api.post('/dealer-task-templates', body, dealerId ? { params: { dealerId } } : undefined)
    return unwrap(data)
  },

  /** PATCH /dealer-task-templates/:id — { templateName }. */
  async update(id, payload, dealerId) {
    const body = dealerId ? { ...payload, dealerId } : payload
    const { data } = await api.patch(`/dealer-task-templates/${id}`, body, dealerId ? { params: { dealerId } } : undefined)
    return unwrap(data)
  },

  /** DELETE /dealer-task-templates/:id. */
  async remove(id, dealerId) {
    const { data } = await api.delete(`/dealer-task-templates/${id}`, dealerId ? { params: { dealerId } } : undefined)
    return unwrap(data)
  },
}
