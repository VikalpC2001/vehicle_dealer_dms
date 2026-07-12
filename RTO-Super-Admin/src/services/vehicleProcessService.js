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

/** Maps a process's persons to the PATCH body shape (the backend replaces ALL persons). */
function mapPersons(process) {
  return (process?.persons ?? []).map((p) => ({
    personName: p.personName,
    mobileNumber: p.mobileNumber,
    personType: p.personType,
    address: p.address ?? null,
  }))
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
 * Builds a full PATCH /vehicle-processes/:id body. The backend PATCH REPLACES all persons
 * AND nulls any omitted price, so we always re-send persons and must carry prices forward
 * (otherwise a simple status change would wipe the purchase/sale prices → lost history).
 *
 * A price is included only when its counterparty person is present — the backend enforces
 * `purchasePrice` needs a SELLER and `salePrice` needs a BUYER, so sending an orphan price
 * (e.g. after the buyer was removed) would 422. Prices come back from the API as strings
 * (Prisma Decimal), hence the `Number()` coercion.
 *
 * @param {object} process current process — must include persons[], vehicleId, status, processDate, prices
 * @param {{status?: string, purchasePrice?: string|number, salePrice?: string|number}} [overrides]
 *   Presence of a price key overrides the stored value (`''` clears it); absence preserves it.
 */
export function buildProcessPatch(process, overrides = {}) {
  const persons = mapPersons(process)
  const hasSeller = persons.some((p) => p.personType === 'SELLER')
  const hasBuyer = persons.some((p) => p.personType === 'BUYER')
  const purchase = 'purchasePrice' in overrides ? overrides.purchasePrice : process?.purchasePrice
  const sale = 'salePrice' in overrides ? overrides.salePrice : process?.salePrice
  const patch = {
    vehicleId: process?.vehicleId,
    status: overrides.status ?? process?.status,
    processDate: process?.processDate,
    persons,
  }
  if (hasSeller && isMoney(purchase)) patch.purchasePrice = Number(purchase)
  if (hasBuyer && isMoney(sale)) patch.salePrice = Number(sale)
  return patch
}

/**
 * Builds a PATCH body that changes the status while preserving persons AND prices.
 * (The backend replaces persons and nulls omitted prices, so both must be re-sent.)
 */
export function buildStatusPatch(process, newStatus) {
  return buildProcessPatch(process, { status: newStatus })
}

export const vehicleProcessService = {
  /** GET /vehicle-processes — paginated list (each item includes persons[]). */
  async getAll({ page = 1, limit = 10 } = {}) {
    const { data } = await api.get('/vehicle-processes', { params: { page, limit } })
    return normalizeListResponse(data)
  },

  /** GET /vehicle-processes/:id — single process with persons[]. */
  async getById(id) {
    const { data } = await api.get(`/vehicle-processes/${id}`)
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

  /** DELETE /vehicle-processes/:id — cascades persons, tasks, photos, references. */
  async remove(id) {
    const { data } = await api.delete(`/vehicle-processes/${id}`)
    return unwrap(data)
  },

  /**
   * Changes a process status while preserving its persons. Fetches the process first
   * (for its persons) when they aren't already in hand.
   * @throws Error when the process has no persons (the backend PATCH requires ≥1).
   */
  async updateStatus(id, newStatus) {
    const proc = await this.getById(id)
    const patch = buildStatusPatch(proc, newStatus)
    if (!patch.persons.length) {
      throw new Error('Add a seller or buyer to this process before changing its status.')
    }
    return this.update(id, patch)
  },

  /**
   * Like updateStatus but uses a process object that already includes persons
   * (e.g. a list/board row), avoiding an extra fetch.
   * @throws Error when the process has no persons.
   */
  async updateStatusFromProcess(process, newStatus) {
    const patch = buildStatusPatch(process, newStatus)
    if (!patch.persons.length) {
      throw new Error('Add a seller or buyer to this process before changing its status.')
    }
    return this.update(getProcessId(process), patch)
  },

  /**
   * Sets/clears the purchase and/or sale price on a process, preserving its persons and
   * status. Fetches the process first (for its persons/status) since the backend PATCH is a
   * full replace. Pass `''` to clear a price. A price is only applied when its counterparty
   * exists (purchase↔seller, sale↔buyer) — enforced by `buildProcessPatch`.
   * @throws Error when the process has no persons (the backend PATCH requires ≥1).
   */
  async updateDeal(id, { purchasePrice, salePrice }) {
    const proc = await this.getById(id)
    const patch = buildProcessPatch(proc, { purchasePrice, salePrice })
    if (!patch.persons.length) {
      throw new Error('Add a seller or buyer before recording prices.')
    }
    return this.update(id, patch)
  },
}
