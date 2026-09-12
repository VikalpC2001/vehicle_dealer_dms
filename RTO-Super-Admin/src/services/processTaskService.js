import api from '@/services/api'

function unwrap(response) {
  return response?.data?.data ?? response?.data ?? response
}

/**
 * Parses the paginated list envelope `{ data: { data: [...], meta } }`, preserving `meta`
 * (total/page/totalPages) which the generic list normalizer drops for this shape (mirrors
 * vehicleProcessService). Returns both `items` and `processes` aliases for the list array.
 */
function normalizeHistoryResponse(body) {
  const inner = body?.data ?? body
  const items = Array.isArray(inner) ? inner : inner?.data ?? inner?.items ?? []
  const meta = inner?.meta ?? {}
  const limit = meta.limit ?? items.length ?? 10
  const total = meta.total ?? items.length
  return {
    items,
    processes: items,
    page: meta.page ?? 1,
    limit,
    total,
    totalPages: meta.totalPages ?? Math.max(1, Math.ceil(total / (limit || 1))),
  }
}

/**
 * Optional `dealerId` targets a dealer the caller manages (an agent working a placeholder/managed
 * dealer). Sent as a query param on every call and, for writes, also in the body — the backend reads
 * whichever it expects (`resolveManagedDealerId`); a dealer caller omits it (token-scoped).
 */
export const processTaskService = {
  /** GET /process-tasks?processId= — tasks for a process, ordered by date. */
  async getByProcess(processId, dealerId) {
    const { data } = await api.get('/process-tasks', {
      params: { processId, ...(dealerId ? { dealerId } : {}) },
    })
    const result = unwrap(data)
    return Array.isArray(result) ? result : []
  },

  /**
   * GET /process-tasks/board — dealer-wide task board across all vehicle processes. Returns open
   * tasks plus tasks completed within the last 15 days. Falsy filters are omitted.
   * @param {{ status?: string, assignUserId?: string, mine?: boolean }} [filters]
   * @param {string} [dealerId] target dealer for a managing caller (agent/admin); a dealer omits it.
   * @returns {Promise<Array>} [{ processTaskId, taskName, taskDate, status, completedAt,
   *   assignUserId, assignUserName, processId, vehicleRegistrationNumber, tags }].
   */
  async getBoard({ status, assignUserId, mine } = {}, dealerId) {
    const { data } = await api.get('/process-tasks/board', {
      params: {
        ...(status ? { status } : {}),
        ...(assignUserId ? { assignUserId } : {}),
        ...(mine ? { mine: true } : {}),
        ...(dealerId ? { dealerId } : {}),
      },
    })
    const result = unwrap(data)
    return Array.isArray(result) ? result : []
  },

  /**
   * GET /process-tasks/history — dealer-wide completed-task history across all vehicle processes,
   * all-time, paginated, newest completion first. Falsy filters are omitted. Employees without
   * `tasks.viewAll` are scoped to their own completed tasks server-side.
   * @param {{ assignUserId?: string, mine?: boolean, page?: number, limit?: number }} [filters]
   * @param {string} [dealerId] target dealer for a managing caller (agent/super-admin); a dealer omits it.
   * @returns {Promise<{ items: Array, processes: Array, page: number, limit: number, total: number, totalPages: number }>}
   *   each item uses the board card shape ({ processTaskId, taskName, taskDate, status, completedAt,
   *   assignUserId, assignUserName, processId, vehicleRegistrationNumber, tags }).
   */
  async getHistory({ assignUserId, mine, page, limit } = {}, dealerId) {
    const { data } = await api.get('/process-tasks/history', {
      params: {
        ...(assignUserId ? { assignUserId } : {}),
        ...(mine ? { mine: true } : {}),
        ...(page ? { page } : {}),
        ...(limit ? { limit } : {}),
        ...(dealerId ? { dealerId } : {}),
      },
    })
    return normalizeHistoryResponse(data)
  },

  /** POST /process-tasks — { processId, taskName, taskDate, assignUserId?, status? }. */
  async create(payload, dealerId) {
    const body = dealerId ? { ...payload, dealerId } : payload
    const { data } = await api.post('/process-tasks', body, dealerId ? { params: { dealerId } } : undefined)
    return unwrap(data)
  },

  /** PATCH /process-tasks/:id — { taskName, taskDate, assignUserId?, status? }. */
  async update(id, payload, dealerId) {
    const body = dealerId ? { ...payload, dealerId } : payload
    const { data } = await api.patch(`/process-tasks/${id}`, body, dealerId ? { params: { dealerId } } : undefined)
    return unwrap(data)
  },

  /** DELETE /process-tasks/:id. */
  async remove(id, dealerId) {
    const { data } = await api.delete(`/process-tasks/${id}`, dealerId ? { params: { dealerId } } : undefined)
    return unwrap(data)
  },
}
