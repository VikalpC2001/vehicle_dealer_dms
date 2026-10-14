import axios from 'axios'
import api from '@/services/api'
import { toWebpFile } from '@/lib/image'
import { DOCUMENT_MIME_TYPES, MAX_UPLOAD_MB } from '@/lib/vehicleProcess'

function unwrap(response) {
  return response?.data?.data ?? response?.data ?? response
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

/**
 * If the app uses a relative API base (dev proxy), rewrite an absolute upload URL to
 * its same-origin path so the PUT is proxied (no CORS). Otherwise return it unchanged.
 */
function toProxyTarget(uploadUrl) {
  if (!API_BASE_URL.startsWith('/')) return uploadUrl
  try {
    const url = new URL(uploadUrl)
    return url.pathname + url.search
  } catch {
    return uploadUrl
  }
}

const EXT_BY_MIME = {
  'image/png': ['png'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/webp': ['webp'],
  'application/pdf': ['pdf'],
}

/**
 * Client-side validation matching the backend's upload constraints, so bad files
 * never hit the network. Accepts images and PDFs. Returns `{ ok }` or `{ ok: false, error }`.
 *
 * @param {File} file
 */
export function validateImageFile(file) {
  if (!file) return { ok: false, error: 'No file selected.' }
  if (!DOCUMENT_MIME_TYPES.includes(file.type)) {
    return { ok: false, error: 'Only PNG, JPEG, WEBP, or PDF files are allowed.' }
  }
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    return { ok: false, error: `File is too large (max ${MAX_UPLOAD_MB} MB).` }
  }
  const ext = file.name.split('.').pop()?.toLowerCase()
  const allowed = EXT_BY_MIME[file.type] ?? []
  if (!ext || !allowed.includes(ext)) {
    return { ok: false, error: 'File extension does not match its type.' }
  }
  return { ok: true }
}

export const uploadService = {
  /**
   * POST /upload/generate — get a signed-style upload URL + fileKey for an image.
   * Goes through the app axios instance (it is a normal /api/v1 JSON call).
   */
  async generate({ fileName, contentType }) {
    const { data } = await api.post('/upload/generate', { fileName, contentType })
    return unwrap(data) // { uploadUrl, fileKey, publicUrl }
  },

  /**
   * PUT the raw image bytes to the uploadUrl returned by generate().
   * Uses a bare axios call (NOT the app instance) so there is no Bearer header and
   * no JSON transform — the File is sent as raw binary with its real MIME type.
   *
   * When the app talks to the API via a relative base (the dev proxy), the absolute
   * uploadUrl (often a LAN IP) is rewritten to its same-origin path so the PUT goes
   * through the Vite proxy and avoids CORS. In production (absolute API base) the
   * uploadUrl is used as-is.
   *
   * @param {string} uploadUrl - URL from generate().
   * @param {File} file
   */
  async putFile(uploadUrl, file) {
    const target = toProxyTarget(uploadUrl)
    const { data } = await axios.put(target, file, {
      headers: { 'Content-Type': file.type },
      transformRequest: [(body) => body],
    })
    return data?.data ?? data // { publicUrl }
  },

  /**
   * Convenience: (convert image → WebP) → validate → generate → PUT. Returns { fileKey, publicUrl }.
   * Throws on validation failure or network error (callers surface per-file state).
   *
   * Every raster image is converted to WebP on the client here — the single chokepoint all upload
   * screens funnel through — so nothing is stored as PNG/JPEG regardless of where the upload started.
   * PDFs (and already-WebP files) pass through untouched; a conversion failure falls back to the
   * original bytes so an upload is never blocked.
   *
   * @param {File} file
   */
  async uploadImage(file) {
    const prepared = await toWebpFile(file)
    const check = validateImageFile(prepared)
    if (!check.ok) throw new Error(check.error)
    const { uploadUrl, fileKey, publicUrl } = await this.generate({
      fileName: prepared.name,
      contentType: prepared.type,
    })
    await this.putFile(uploadUrl, prepared)
    return { fileKey, publicUrl }
  },
}
