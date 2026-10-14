import axios from 'axios'
import { AI_ERROR_MESSAGES } from '@/lib/vehicleProcess'

// Resolve the same API base the app uses, but call AI endpoints with a BARE axios
// instance: they are multipart/form-data and auth:none, so the app's JSON +
// Bearer interceptors must not apply.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://192.168.0.119:4002/api/v1'

// Cap OCR calls so a stalled Gemini request can't hang the scan overlay forever — on timeout the
// request rejects and the caller falls back to manual entry.
const OCR_TIMEOUT_MS = 45000

/** Maps a backend AI error to a friendly, user-facing message. OCR errors are non-fatal. */
export function getAiErrorMessage(error) {
  const code = error?.response?.data?.code
  if (code && AI_ERROR_MESSAGES[code]) return AI_ERROR_MESSAGES[code]
  return 'Could not read the document automatically. Please enter the details manually.'
}

async function postImage(path, file) {
  const formData = new FormData()
  formData.append('image', file)
  const { data } = await axios.post(`${API_BASE_URL}${path}`, formData, { timeout: OCR_TIMEOUT_MS })
  // AI responses are { success, data: {...} }.
  return data?.data ?? data
}

/**
 * Resolves a category's configured `processApi` to a callable URL: a full http(s) URL
 * is used as-is; otherwise it's treated as a path appended to the API base
 * (e.g. "ai/analyze-id-proof" -> "/api/v1/ai/analyze-id-proof", which the dev proxy forwards).
 */
function resolveProcessApiUrl(processApi) {
  const value = String(processApi ?? '').trim()
  if (/^https?:\/\//i.test(value)) return value
  const path = value.startsWith('/') ? value : `/${value}`
  return `${API_BASE_URL}${path}`
}

export const aiService = {
  /**
   * POST /ai/analyze-image — extract vehicle + owner fields from a Registration Certificate image.
   * Backend sends the image directly to Gemini vision. Returns { vehicleInfo, ownerInfo }.
   *
   * @param {File} file
   */
  async analyzeImage(file) {
    return postImage('/ai/analyze-image', file)
  },

  /**
   * POST /ai/analyze-id-proof — extract name/address from an owner ID image. Backend sends the image
   * directly to Gemini vision. Returns { fullName, address, city, state, pincode }.
   *
   * @param {File} file
   */
  async analyzeIdProof(file) {
    return postImage('/ai/analyze-id-proof', file)
  },

  /**
   * Extract details by POSTing the image to a category's configured `processApi`.
   * Expects the same JSON shape as the ID reader ({ fullName, address, city, state, pincode }).
   *
   * @param {string} processApi - Full URL or path (resolved against the API base).
   * @param {File} file
   */
  async extractViaProcessApi(processApi, file) {
    const formData = new FormData()
    formData.append('image', file)
    const { data } = await axios.post(resolveProcessApiUrl(processApi), formData, { timeout: OCR_TIMEOUT_MS })
    return data?.data ?? data
  },
}
