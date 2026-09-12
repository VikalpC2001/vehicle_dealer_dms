import api from '@/services/api'

function unwrap(response) {
  return response?.data?.data ?? response?.data ?? response
}

/** Resolves a document/upload category id across possible key shapes. */
export function getUploadCategoryId(cat) {
  return cat?.categoryId ?? cat?.id ?? cat?._id
}

/**
 * Master document-category catalog (`UploadCategory`). GET is available to any authenticated user
 * (dealers/agents read the catalog); create/update/delete are super-admin only. `processApi` (the
 * OCR extraction endpoint) is managed here on the master and inherited by dealers/agents.
 */
export const uploadCategoryService = {
  /**
   * GET /upload-categories — the GLOBAL master catalog (unpaginated), ordered by orderRank.
   * Returns [{ categoryId, categoryName, orderRank, bothSide, processApi }].
   */
  async getAll() {
    const { data } = await api.get('/upload-categories')
    const result = unwrap(data)
    return Array.isArray(result) ? result : []
  },

  /** POST /upload-categories — { categoryName, bothSide, processApi? }. Super-admin only. */
  async create(payload) {
    const { data } = await api.post('/upload-categories', payload)
    return unwrap(data)
  },

  /** PATCH /upload-categories/:id — { categoryName, bothSide, processApi? }. Super-admin only. */
  async update(id, payload) {
    const { data } = await api.patch(`/upload-categories/${id}`, payload)
    return unwrap(data)
  },

  /** DELETE /upload-categories/:id — super-admin only. */
  async remove(id) {
    const { data } = await api.delete(`/upload-categories/${id}`)
    return unwrap(data)
  },
}
