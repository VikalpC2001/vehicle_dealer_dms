import api from '@/services/api'

function unwrap(response) {
  return response?.data?.data ?? response?.data ?? response
}

export const uploadCategoryService = {
  /**
   * GET /upload-categories — the GLOBAL master catalog of document categories a dealer
   * can link to. Returns [{ categoryId, categoryName, orderRank, bothSide }].
   */
  async getAll() {
    const { data } = await api.get('/upload-categories')
    const result = unwrap(data)
    return Array.isArray(result) ? result : []
  },
}
