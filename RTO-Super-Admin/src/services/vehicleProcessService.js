import api from '@/services/api'

function unwrap(response) {
  return response?.data?.data ?? response?.data ?? response
}

/**
 * Parses the paginated list envelope `{ data: { data: [...], meta } }`, preserving
 * `meta` (total/page/totalPages) which the generic list normalizer drops for this shape.
 */
function normalizeListResponse(body) {
  const inner = body?.data ?? body
  const items = Array.isArray(inner) ? inner : inner?.data ?? inner?.items ?? []
  const meta = inner?.meta ?? {}
  const limit = meta.limit ?? items.length ?? 10
  const total = meta.total ?? items.length
  return {
    processes: items,
    page: meta.page ?? 1,
    limit,
    total,
    totalPages: meta.totalPages ?? Math.max(1, Math.ceil(total / (limit || 1))),
  }
}

/** Resolves a process id across possible key shapes. */
export function getProcessId(process) {
  return process?.processId ?? process?.id ?? process?._id
}

/**
 * A process's ACTIVE (non-cancelled) persons. Cancelled buyers are kept on the process for history
 * (see the change-buyer flow) but must not gate prices — only the live seller/buyer do.
 */
function activePersons(process) {
  return (process?.persons ?? []).filter((p) => p.status !== 'CANCELLED')
}

/**
 * True when a value is a real recorded money amount to send. `null`/`''` mean "not set / clear"
 * (→ omitted → the backend full-replace nulls it); a stored `0` is a real amount (e.g. a free
 * transfer) and must be carried forward, so `0` counts as money.
 */
function isMoney(value) {
  if (value == null || value === '') return false
  const n = Number(value)
  return Number.isFinite(n) && n >= 0
}

/**
 * Builds a PATCH /vehicle-processes/:id body for a status- and/or price-only change. Persons are
 * managed exclusively through the /persons endpoints (incl. change-buyer, which keeps CANCELLED
 * buyers on the process), so this body deliberately OMITS `persons` — the backend leaves persons
 * untouched when they're absent. Re-sending them would resurface a CANCELLED buyer as a 2nd buyer
 * (→ "At most one buyer per process" 422). We still carry prices forward because the backend nulls
 * any omitted price.
 *
 * A price is included only when its live counterparty is present — `purchasePrice` needs an active
 * SELLER and `salePrice` an active BUYER, so an orphan price (e.g. no buyer yet) is dropped. Prices
 * come back from the API as strings (Prisma Decimal), hence the `Number()` coercion.
 *
 * @param {object} process current process — must include persons[], vehicleId, status, processDate, prices
 * @param {{status?: string, purchasePrice?: string|number, salePrice?: string|number}} [overrides]
 *   Presence of a price key overrides the stored value (`''` clears it); absence preserves it.
 */
export function buildProcessPatch(process, overrides = {}) {
  const persons = activePersons(process)
  const hasSeller = persons.some((p) => p.personType === 'SELLER')
  const hasBuyer = persons.some((p) => p.personType === 'BUYER')
  const purchase = 'purchasePrice' in overrides ? overrides.purchasePrice : process?.purchasePrice
  const sale = 'salePrice' in overrides ? overrides.salePrice : process?.salePrice
  const patch = {
    vehicleId: process?.vehicleId,
    status: overrides.status ?? process?.status,
    processDate: process?.processDate,
  }
  if (hasSeller && isMoney(purchase)) patch.purchasePrice = Number(purchase)
  if (hasBuyer && isMoney(sale)) patch.salePrice = Number(sale)
  return patch
}

export const vehicleProcessService = {
  /**
   * GET /vehicle-processes — paginated list (each item includes persons[]).
   * Dealers use their token dealer; an **agent** passes `dealerId` for a dealer they manage
   * (an owned placeholder or a granted/connected real dealer); a super-admin may pass one to narrow.
   * Optional `search` filters server-side by vehicle registration number and any person's name.
   * Optional `tagId` filters server-side to processes carrying that tag (keeps pagination correct).
   */
  async getAll({ page = 1, limit = 10, dealerId, search, tagId, status, dateFrom, dateTo } = {}) {
    const params = { page, limit }
    if (dealerId) params.dealerId = dealerId
    if (search) params.search = search
    if (tagId) params.tagId = tagId
    if (status) params.status = status
    if (dateFrom) params.dateFrom = dateFrom
    if (dateTo) params.dateTo = dateTo
    const { data } = await api.get('/vehicle-processes', { params })
    return normalizeListResponse(data)
  },

  /**
   * GET /vehicle-processes/export — download an Excel/PDF export of the dealer's processes over a
   * `processDate` range (the current month when no range is given), including only the selected
   * sections. Returns the file as a Blob plus the server-suggested filename and the `X-Export-*`
   * counters. `sections` is an array of keys (vehicle|persons|deal|amount|documents|vehicleImages);
   * dealers omit `dealerId` (scoped to their token dealer).
   */
  async exportProcesses({ format, dateFrom, dateTo, dateField, statuses, sections, dealerId } = {}) {
    const params = { format }
    if (dateFrom) params.dateFrom = dateFrom
    if (dateTo) params.dateTo = dateTo
    if (dateField === 'soldDate') params.dateField = 'soldDate'
    // Send only a strict subset (0 or all 4 = every status, which the backend treats as no filter).
    if (statuses?.length && statuses.length < 4) params.statuses = statuses.join(',')
    if (sections?.length) params.sections = sections.join(',')
    if (dealerId) params.dealerId = dealerId
    const response = await api.get('/vehicle-processes/export', {
      params,
      responseType: 'blob',
      timeout: 180000, // image-embedding exports can take a while; generous headroom over the 15s default
    })
    const disposition = response.headers['content-disposition'] || ''
    const match = /filename="?([^"]+)"?/.exec(disposition)
    const ext = format === 'excel' ? 'xlsx' : 'pdf'
    return {
      blob: response.data,
      filename: match?.[1] || `vehicle-processes.${ext}`,
      count: Number(response.headers['x-export-count'] ?? 0),
      truncated: response.headers['x-export-truncated'] === 'true',
    }
  },

  /** GET /vehicle-processes/:id — single process with persons[]. */
  async getById(id) {
    const { data } = await api.get(`/vehicle-processes/${id}`)
    return unwrap(data)
  },

  /**
   * GET /vehicle-processes/agent-board — the caller agent's own (agent-created / placeholder-dealer)
   * processes for the agent board. Each carries `agentStatus`, `vehicle`, and `dealer`. Non-agent
   * callers get an empty list. Pairs with `processAssignmentService.listForAgent()` on the board.
   */
  async listForAgentBoard() {
    const { data } = await api.get('/vehicle-processes/agent-board')
    const result = unwrap(data)
    return Array.isArray(result) ? result : []
  },

  /**
   * PATCH /vehicle-processes/:id/agent-status — move an agent-created process into one of the
   * owning agent's kanban columns (agent board). Updates the agent-kanban position only, not the
   * dealer-facing status string.
   */
  async updateAgentStatus(processId, agentStatusId) {
    const { data } = await api.patch(`/vehicle-processes/${processId}/agent-status`, { agentStatusId })
    return unwrap(data)
  },

  /**
   * PATCH /vehicle-processes/:id/receipt — agent attaches/replaces the RTO receipt (PDF/image).
   * `imageName` is the flat upload fileKey; the server moves it into the process folder. Agent-only.
   */
  async setReceipt(processId, imageName) {
    const { data } = await api.patch(`/vehicle-processes/${processId}/receipt`, { imageName })
    return unwrap(data)
  },

  /** DELETE /vehicle-processes/:id/receipt — agent removes the RTO receipt. Agent-only. */
  async clearReceipt(processId) {
    const { data } = await api.delete(`/vehicle-processes/${processId}/receipt`)
    return unwrap(data)
  },

  /**
   * PATCH /vehicle-processes/:id/tracking — agent sets/clears the RC-book tracking number
   * (blank clears). Agent-only; the dealer reads it to track the RC book.
   */
  async setTrackingNumber(processId, trackingNumber) {
    const { data } = await api.patch(`/vehicle-processes/${processId}/tracking`, { trackingNumber })
    return unwrap(data)
  },

  /**
   * PUT /vehicle-processes/:id/tags — replace the process's Finder-style tag set with `tagIds`
   * (the full desired set of dealer-tag ids; pass [] to clear). Returns the process's updated tags
   * array `[{ tagId, tagName, colour }]` (callers typically ignore it and refetch). An agent passes
   * `dealerId` for a dealer they manage; a dealer caller omits it (token-scoped).
   */
  async setTags(processId, tagIds, dealerId) {
    const body = dealerId ? { tagIds, dealerId } : { tagIds }
    const { data } = await api.put(`/vehicle-processes/${processId}/tags`, body, dealerId ? { params: { dealerId } } : undefined)
    return unwrap(data)
  },

  /**
   * PATCH /vehicle-processes/:id/status — set the fixed lifecycle status ('SOLD'|'COMPLETE'|'SCRAP')
   * or `null` to reopen. Reopening is rejected (409) if another open process exists for the vehicle.
   */
  async updateStatus(id, status, dealerId) {
    const body = dealerId ? { status, dealerId } : { status }
    const { data } = await api.patch(`/vehicle-processes/${id}/status`, body, dealerId ? { params: { dealerId } } : undefined)
    return unwrap(data)
  },

  /** PATCH /vehicle-processes/:id/sold-date — edit the recorded sold date (ISO string) of a sold process. */
  async updateSoldDate(id, soldDate, dealerId) {
    const body = dealerId ? { soldDate, dealerId } : { soldDate }
    const { data } = await api.patch(`/vehicle-processes/${id}/sold-date`, body, dealerId ? { params: { dealerId } } : undefined)
    return unwrap(data)
  },

  /** GET /vehicle-processes/:id/details — vehicle, owner, buyer, references, photos with URLs. */
  async getDetails(id) {
    const { data } = await api.get(`/vehicle-processes/${id}/details`)
    return unwrap(data)
  },

  /**
   * POST /vehicle-processes/start — upserts the vehicle by registrationNumber and
   * creates the process (+ persons, uploadPhotos, processReferences) in one transaction.
   * dealerId is taken from the JWT.
   */
  async start(payload) {
    const { data } = await api.post('/vehicle-processes/start', payload)
    return unwrap(data)
  },

  /** PATCH /vehicle-processes/:id — full update (vehicleId, status, processDate, persons). */
  async update(id, payload) {
    const { data } = await api.patch(`/vehicle-processes/${id}`, payload)
    return unwrap(data)
  },

  /**
   * DELETE /vehicle-processes/:id — SOFT delete: moves the process to the recycle bin (sets
   * `deletedAt`). It disappears from every active read but its children stay intact and it can be
   * restored for 7 days (then it is auto-purged). Restore via `restore()`, hard-delete via
   * `permanentDelete()`, and list the bin via `getBin()` / `getAgentBin()`.
   */
  async remove(id) {
    const { data } = await api.delete(`/vehicle-processes/${id}`)
    return unwrap(data)
  },

  /**
   * GET /vehicle-processes/bin — the recycle bin (soft-deleted processes) for the caller's scope,
   * paginated, newest deletion first. A dealer sees their own bin (token-scoped); an agent/super-admin
   * passes `dealerId` for a dealer they manage. Each item is
   * `{ processId, registrationNumber, ownerName, deletedAt, purgeAt, daysLeft }`.
   */
  async getBin({ page = 1, limit = 10, dealerId } = {}) {
    const params = { page, limit }
    if (dealerId) params.dealerId = dealerId
    const { data } = await api.get('/vehicle-processes/bin', { params })
    return normalizeListResponse(data)
  },

  /**
   * GET /vehicle-processes/agent-bin — the caller agent's own recycle bin across all placeholder
   * dealers they own, paginated, newest deletion first. Non-agent callers get an empty list. Same item
   * shape as `getBin()`.
   */
  async getAgentBin({ page = 1, limit = 10 } = {}) {
    const { data } = await api.get('/vehicle-processes/agent-bin', { params: { page, limit } })
    return normalizeListResponse(data)
  },

  /**
   * POST /vehicle-processes/:id/restore — restore a soft-deleted process from the bin (clears
   * `deletedAt`); its children reappear intact. Scoped by the process itself, so no dealerId needed.
   */
  async restore(id) {
    const { data } = await api.post(`/vehicle-processes/${id}/restore`)
    return unwrap(data)
  },

  /**
   * DELETE /vehicle-processes/:id/permanent — permanently hard-delete a process and cascade all its
   * children immediately (whether active or already binned). Irreversible. Scoped by the process.
   */
  async permanentDelete(id) {
    const { data } = await api.delete(`/vehicle-processes/${id}/permanent`)
    return unwrap(data)
  },

  /**
   * POST /vehicle-processes/bin/restore — bulk-restore soft-deleted processes from the bin. Body
   * `{ processIds }`; returns `{ count }` (number restored). The many-row analog of `restore()`.
   */
  async bulkRestore(processIds) {
    const { data } = await api.post('/vehicle-processes/bin/restore', { processIds })
    return unwrap(data)
  },

  /**
   * POST /vehicle-processes/bin/permanent-delete — bulk hard-delete processes (and cascade their
   * children) from the bin. Irreversible. Body `{ processIds }`; returns `{ count }` (number deleted).
   */
  async bulkPermanentDelete(processIds) {
    const { data } = await api.post('/vehicle-processes/bin/permanent-delete', { processIds })
    return unwrap(data)
  },

  /**
   * Sets/clears the purchase and/or sale price on a process, preserving its status. Fetches the
   * process first (for its status + live counterparties) since the backend PATCH nulls omitted
   * prices. Pass `''` to clear a price. A price is only applied when its live counterparty exists
   * (purchase↔seller, sale↔buyer) — enforced by `buildProcessPatch`. Persons are not sent.
   */
  async updateDeal(id, { purchasePrice, salePrice }) {
    const proc = await this.getById(id)
    return this.update(id, buildProcessPatch(proc, { purchasePrice, salePrice }))
  },
}
