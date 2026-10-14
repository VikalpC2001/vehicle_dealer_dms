/**
 * Print + native-share helpers for stored document files (Documents tab). This is a normal browser SPA,
 * so `window.print()`, hidden-iframe printing, `navigator.share` and object URLs work. `shareDocument`
 * attaches the REAL file via the native share sheet (mobile + HTTPS); when that is unavailable the caller
 * falls back to `ShareDialog` (WhatsApp / email LINK share).
 *
 * File access uses `toAppImageUrl`, which rewrites to a same-origin path only under the Vite dev proxy;
 * in production it returns the stored (absolute) URL, so the blob `fetch` below is cross-origin and
 * relies on the file host sending permissive CORS (the backend `/uploads` route does today). Image
 * display via `<img>` needs no CORS, so a tile can render while a print/share fetch fails on a
 * misconfigured host — the caller then shows the link fallback.
 */
import { toAppImageUrl, isPdfUrl } from '@/lib/vehicleProcess'
import { extOf } from '@/lib/zip'

/** Fetches a stored file as a Blob. Cross-origin in production (see module note); relies on file-host CORS. */
async function fetchBlob(photoUrl) {
  const res = await fetch(toAppImageUrl(photoUrl))
  if (!res.ok) throw new Error(`Failed to load the file (HTTP ${res.status}).`)
  return res.blob()
}

/** Builds a friendly share filename from the document title, falling back to the storage key. */
function buildFilename({ imageName, blobType, title }) {
  const ext = extOf(imageName, (blobType && blobType.split('/')[1]) || 'jpg')
  const base = String(title || imageName || 'document')
    .replace(/\.[^.]+$/, '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-') || 'document'
  return `${base}.${ext}`
}

/** Prints an image by loading it into a hidden iframe and calling that iframe's `print()`. */
function printImageViaIframe(objectUrl) {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
    document.body.appendChild(iframe)

    let done = false
    const cleanup = () => {
      if (done) return
      done = true
      try { URL.revokeObjectURL(objectUrl) } catch { /* noop */ }
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
    }

    try {
      const doc = iframe.contentWindow.document
      doc.open()
      doc.write(
        '<!doctype html><html><head><meta charset="utf-8">' +
          '<style>@page{margin:0}html,body{margin:0;padding:0}img{width:100%;display:block}</style>' +
          '</head><body><img alt=""></body></html>'
      )
      doc.close()

      const img = doc.querySelector('img')
      img.onload = () => {
        try {
          iframe.contentWindow.focus()
          iframe.contentWindow.onafterprint = cleanup
          iframe.contentWindow.print()
          // Safety net in case `afterprint` never fires (e.g. some browsers).
          setTimeout(cleanup, 60000)
          resolve()
        } catch {
          cleanup()
          reject(new Error('Could not open the print dialog.'))
        }
      }
      img.onerror = () => {
        cleanup()
        reject(new Error('Could not load the image for printing.'))
      }
      img.src = objectUrl
    } catch {
      cleanup()
      reject(new Error('Could not prepare the document for printing.'))
    }
  })
}

/**
 * Prints a stored document. PDFs open in a new tab (the browser's PDF viewer prints them); images render
 * into a hidden iframe that is printed then cleaned up. Rethrows a friendly Error so the caller can toast.
 *
 * The PDF tab is opened SYNCHRONOUSLY from the served URL — no blob fetch first — so it runs inside the
 * click's user-activation window and is not blocked as a programmatic popup (a fetch-then-open would be).
 *
 * @param {{ photoUrl: string }} params
 */
export async function printDocument({ photoUrl }) {
  // PDFs by URL: open the file directly, in-gesture, so the popup isn't blocked and no cross-origin
  // blob fetch is needed. Cannot call win.print() across origins, so the user prints from the viewer.
  if (isPdfUrl(photoUrl)) {
    const win = window.open(toAppImageUrl(photoUrl), '_blank', 'noopener,noreferrer')
    if (!win) throw new Error('Please allow pop-ups to print this document.')
    return
  }

  let objectUrl
  try {
    const blob = await fetchBlob(photoUrl)

    // A PDF whose URL lacks a .pdf extension (detected only by MIME). Open it the same way; this open is
    // post-fetch so it may be popup-blocked on strict browsers — the common .pdf case is handled above.
    if (blob.type === 'application/pdf') {
      objectUrl = URL.createObjectURL(blob)
      const win = window.open(objectUrl, '_blank')
      if (!win) throw new Error('Please allow pop-ups to print this document.')
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000)
      return
    }

    objectUrl = URL.createObjectURL(blob)
    await printImageViaIframe(objectUrl)
  } catch (err) {
    if (objectUrl) {
      try { URL.revokeObjectURL(objectUrl) } catch { /* noop */ }
    }
    throw new Error(err?.message || 'Could not print the document.', { cause: err })
  }
}

/**
 * Shares the ACTUAL document file via the native share sheet (so the recipient gets the image/PDF as an
 * attachment, e.g. in WhatsApp or Mail). This needs a SECURE context + platform file-share support
 * (mobile Chrome/Safari over HTTPS). Returns `{ unsupported: true }` whenever that is missing (insecure
 * http/LAN origin, desktop, blocked fetch) so the caller can fall back to `ShareDialog` (link share), and
 * `{ cancelled: true }` when the user dismisses the sheet.
 *
 * @param {{ photoUrl: string, imageName?: string, title?: string }} params
 * @returns {Promise<{ shared?: boolean, cancelled?: boolean, unsupported?: boolean }>}
 */
export async function shareDocument({ photoUrl, imageName, title }) {
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.share !== 'function' ||
    typeof navigator.canShare !== 'function'
  ) {
    return { unsupported: true }
  }

  let file
  try {
    const blob = await fetchBlob(photoUrl)
    file = new File([blob], buildFilename({ imageName, blobType: blob.type, title }), {
      type: blob.type || 'application/octet-stream',
    })
  } catch {
    return { unsupported: true } // couldn't fetch the bytes → let the caller offer the link fallback
  }

  if (!navigator.canShare({ files: [file] })) {
    return { unsupported: true } // platform can't share files (most desktops) → link fallback
  }

  try {
    await navigator.share({ files: [file], title: title || file.name })
    return { shared: true }
  } catch (err) {
    if (err?.name === 'AbortError') return { cancelled: true }
    return { unsupported: true } // share threw for another reason → fall back to the link modal
  }
}
