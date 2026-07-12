/**
 * Shared pagination constants and API response normalization.
 */

export const PAGE_SIZE = {
  client: 8,
  crud: 10,
  location: 50,
}

/**
 * Normalizes paginated list responses from various API shapes.
 *
 * @param {unknown} data - Raw API response
 * @param {string} [listKey='items'] - Primary array key in payload
 * @param {number} [defaultLimit=10] - Fallback page size
 * @returns {{ items: unknown[], page: number, limit: number, total: number, totalPages: number }}
 */
export function normalizePaginatedResponse(data, listKey = 'items', defaultLimit = 10) {
  const payload = data?.data?.data ?? data?.data ?? data

  if (Array.isArray(payload)) {
    return {
      items: payload,
      page: 1,
      limit: payload.length,
      total: payload.length,
      totalPages: 1,
    }
  }

  const items =
    payload?.[listKey] ??
    payload?.items ??
    payload?.results ??
    payload?.dealers ??
    payload?.cities ??
    payload?.states ??
    (Array.isArray(payload?.data) ? payload.data : [])

  const page = payload?.page ?? payload?.currentPage ?? 1
  const limit = payload?.limit ?? payload?.perPage ?? defaultLimit
  const total = payload?.total ?? payload?.totalCount ?? payload?.count ?? items.length
  const totalPages = payload?.totalPages ?? Math.max(1, Math.ceil(total / limit))

  return { items, page, limit, total, totalPages }
}

/**
 * Returns the visible row range for pagination summary text.
 *
 * @param {number} page - 1-based page index
 * @param {number} pageSize
 * @param {number} total
 * @returns {{ start: number, end: number }}
 */
export function getShowingRange(page, pageSize, total) {
  if (total === 0) return { start: 0, end: 0 }
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)
  return { start, end }
}

/**
 * Builds standardized pagination summary text.
 *
 * @param {{ page: number, pageSize: number, total: number, itemLabel?: string, isFetching?: boolean }} options
 * @returns {string}
 */
export function getPaginationSummary({ page, pageSize, total, itemLabel = 'items', isFetching = false }) {
  const { start, end } = getShowingRange(page, pageSize, total)
  const base = `Showing ${start}–${end} of ${total} ${itemLabel}`
  return isFetching ? `${base} · Updating...` : base
}
