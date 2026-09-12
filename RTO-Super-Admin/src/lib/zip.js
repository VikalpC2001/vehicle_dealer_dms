import JSZip from 'jszip'
import { toAppImageUrl } from '@/lib/vehicleProcess'

/** Strips filesystem-illegal characters (keeps spaces). */
function safe(name) {
  return String(name ?? '').trim().replace(/[\\/:*?"<>|]+/g, '-') || 'untitled'
}

function todayStr() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function extOf(name, fallback) {
  const m = /\.([a-z0-9]+)$/i.exec(name ?? '')
  return m ? m[1] : fallback
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Fetches a stored file (same-origin via toAppImageUrl, so no CORS/auth) and saves it to disk with
 * the given filename. Used to let a dealer download an RTO receipt (PDF/image) reliably even when the
 * file is served from a different origin (where a plain `download` link would only open it).
 *
 * @param {string} url - The file URL (photoUrl).
 * @param {string} filename - Suggested download filename.
 */
export async function downloadFileFromUrl(url, filename) {
  const res = await fetch(toAppImageUrl(url))
  if (!res.ok) throw new Error(`Failed to download the file (HTTP ${res.status}).`)
  const blob = await res.blob()
  downloadBlob(blob, filename)
}

/**
 * Downloads all of a process's images as a ZIP. Structure:
 *   <registrationNumber>_<YYYY-MM-DD>/<category>/<files>
 * Images are fetched same-origin (via toAppImageUrl) so no CORS/auth is needed.
 *
 * @param {{ registrationNumber?: string }} vehicle
 * @param {Array<{ category?: string, imageName?: string, photoUrl?: string }>} photos
 */
export async function exportProcessImagesZip(vehicle, photos) {
  const list = (photos ?? []).filter((p) => p.photoUrl)
  if (!list.length) throw new Error('No images to export.')

  const root = `${safe(vehicle?.registrationNumber || 'vehicle')}_${todayStr()}`
  const zip = new JSZip()
  const rootFolder = zip.folder(root)
  const perCategory = {}

  for (const photo of list) {
    const res = await fetch(toAppImageUrl(photo.photoUrl))
    if (!res.ok) throw new Error(`Failed to download an image (HTTP ${res.status}).`)
    const blob = await res.blob()
    const category = safe(photo.category || 'Other')
    perCategory[category] = (perCategory[category] ?? 0) + 1
    const ext = extOf(photo.imageName, (blob.type.split('/')[1] || 'jpg'))
    rootFolder.folder(category).file(`${category}-${perCategory[category]}.${ext}`, blob)
  }

  const out = await zip.generateAsync({ type: 'blob' })
  downloadBlob(out, `${root}.zip`)
}
