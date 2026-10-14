/**
 * Canvas-based image helpers for client-side image handling: producing a cropped File from a crop
 * region, stacking two images into one vertical collage, and converting any raster image to WebP.
 *
 * Output is WebP (.webp) — smaller than JPEG at equivalent quality — so every user-selected image is
 * converted on the client before it is previewed or uploaded. WebP is accepted by the backend for
 * both storage and the AI/OCR endpoints. Safeguards: the longest edge is capped (large phone photos
 * exceed the browser's max canvas area, which would encode blank/null — notably iOS/Safari at
 * ~16.7 MP); a transparent source is flattened onto white (so it never becomes black in the JPEG
 * fallback); if a browser can't encode WebP we fall back to JPEG, and if encoding fails entirely we
 * fall back to the original bytes so an upload is never blocked or corrupted. PDFs/non-images are
 * never touched.
 */

const WEBP_QUALITY = 0.9
const JPEG_QUALITY = 0.92
// Cap the longest edge so a full-resolution photo (modern phones shoot 12–200 MP) never exceeds the
// browser's maximum canvas area (~16.7 MP on iOS/Safari), which makes toBlob return a blank or null
// blob. 3000px keeps ample detail for document OCR while keeping the encoded file small.
const MAX_EDGE = 3000

function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

/** Strips the extension from a filename so we can append the one matching the actual encoded type. */
function stripExt(name) {
  return (name || 'image').replace(/\.[^./\\]+$/, '')
}

/** Scales (w, h) down so the longest edge is at most `maxEdge`; never scales up. */
function fitWithin(width, height, maxEdge = MAX_EDGE) {
  const longest = Math.max(width, height)
  if (longest <= maxEdge) return { width, height }
  const scale = maxEdge / longest
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/**
 * Encodes a <canvas> to a File — WebP when the browser supports it, otherwise JPEG. The output
 * filename's extension is set to match the actual encoded MIME type so the upload's
 * extension-vs-MIME re-validation always passes. Resolves to `null` if the canvas cannot be encoded
 * at all (e.g. it exceeds the browser's max canvas area), so callers can fall back rather than
 * building a corrupt file from a null blob.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {string} fileName - Base name; its extension is replaced to match the encoded type.
 * @returns {Promise<File|null>}
 */
function canvasToImageFile(canvas, fileName) {
  const base = stripExt(fileName)
  return new Promise((resolve) => {
    canvas.toBlob(
      (webpBlob) => {
        // Per the spec a canvas that can't encode the requested type falls back to PNG, so confirm
        // we actually got a non-empty WebP before trusting it; otherwise re-encode as JPEG.
        if (webpBlob && webpBlob.type === 'image/webp' && webpBlob.size > 0) {
          resolve(new File([webpBlob], `${base}.webp`, { type: 'image/webp' }))
          return
        }
        canvas.toBlob(
          (jpgBlob) => {
            // A null/empty blob here means the canvas couldn't be encoded at all — signal the caller
            // to fall back instead of constructing a corrupt File from a null BlobPart.
            resolve(
              jpgBlob && jpgBlob.size > 0
                ? new File([jpgBlob], `${base}.jpg`, { type: 'image/jpeg' })
                : null
            )
          },
          'image/jpeg',
          JPEG_QUALITY
        )
      },
      'image/webp',
      WEBP_QUALITY
    )
  })
}

/**
 * Produces a cropped WebP File from a loaded <img> element and a pixel crop
 * (as given by react-image-crop, relative to the displayed image). Falls back to JPEG if the browser
 * can't encode WebP, and resolves to `null` if the region can't be encoded at all.
 *
 * @param {HTMLImageElement} image - The displayed <img> element.
 * @param {{ x:number, y:number, width:number, height:number }} pixelCrop
 * @param {string} [fileName]
 * @returns {Promise<File|null>}
 */
export async function getCroppedFile(image, pixelCrop, fileName = 'image.webp') {
  const scaleX = image.naturalWidth / image.width
  const scaleY = image.naturalHeight / image.height
  const cropW = Math.max(1, Math.round(pixelCrop.width * scaleX))
  const cropH = Math.max(1, Math.round(pixelCrop.height * scaleY))
  const { width, height } = fitWithin(cropW, cropH)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  // White backdrop so a transparent source never flattens to black in the JPEG fallback.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(
    image,
    pixelCrop.x * scaleX,
    pixelCrop.y * scaleY,
    pixelCrop.width * scaleX,
    pixelCrop.height * scaleY,
    0,
    0,
    width,
    height
  )
  return canvasToImageFile(canvas, fileName)
}

/**
 * Combines two images into a single WebP with `front` stacked above `back`
 * (both scaled to a common width). Used for two-sided documents (e.g. RC).
 *
 * @param {File} frontFile
 * @param {File} backFile
 * @param {string} [fileName]
 * @returns {Promise<File|null>}
 */
export async function collageVertical(frontFile, backFile, fileName = 'document.webp') {
  const frontUrl = URL.createObjectURL(frontFile)
  const backUrl = URL.createObjectURL(backFile)
  try {
    const [front, back] = await Promise.all([loadImageFromUrl(frontUrl), loadImageFromUrl(backUrl)])
    const targetW = Math.min(1600, Math.max(front.naturalWidth, back.naturalWidth))
    const frontH = Math.round(front.naturalHeight * (targetW / front.naturalWidth))
    const backH = Math.round(back.naturalHeight * (targetW / back.naturalWidth))
    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = frontH + backH
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(front, 0, 0, targetW, frontH)
    ctx.drawImage(back, 0, frontH, targetW, backH)
    return canvasToImageFile(canvas, fileName)
  } finally {
    URL.revokeObjectURL(frontUrl)
    URL.revokeObjectURL(backUrl)
  }
}

/**
 * Converts a raster-image File to WebP on the client. Passes through non-images (e.g. PDF) and files
 * that are already WebP untouched. Downscales oversized images first (see MAX_EDGE). Never grows or
 * corrupts an upload: if encoding fails, or the WebP would be LARGER than the source (re-encoding an
 * already-compressed small image can grow it), the original file is returned unchanged. Use this at
 * any upload path that does NOT already go through the cropper/collage (which emit WebP on their own).
 *
 * @param {File} file
 * @returns {Promise<File>}
 */
export async function toWebpFile(file) {
  if (!file || typeof file.type !== 'string' || !file.type.startsWith('image/')) return file
  if (file.type === 'image/webp') return file
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImageFromUrl(url)
    const natW = img.naturalWidth || img.width
    const natH = img.naturalHeight || img.height
    if (!natW || !natH) return file
    const { width, height } = fitWithin(natW, natH)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(img, 0, 0, width, height)
    const out = await canvasToImageFile(canvas, file.name || 'image')
    if (!out) return file
    // Keep the smaller of the two so conversion can never turn a valid upload into one that trips the
    // size limit; downscaled large photos are always smaller, so this normally keeps the WebP.
    return out.size < file.size ? out : file
  } catch {
    return file
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Returns a smaller copy of an image for the AI vision call — a downscaled WebP (longest edge
 * `maxEdge`). Fewer pixels = fewer image tokens at Gemini = lower cost, with little accuracy loss for
 * document photos. Use ONLY for the AI call; the full-resolution image is still what gets uploaded.
 * Non-images (PDF) and images already within `maxEdge` are returned unchanged; any failure falls back
 * to the original file.
 *
 * @param {File} file
 * @param {number} [maxEdge]
 * @returns {Promise<File>}
 */
export async function downscaleImage(file, maxEdge = 2000) {
  if (!file || typeof file.type !== 'string' || !file.type.startsWith('image/')) return file
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImageFromUrl(url)
    const w = img.naturalWidth || img.width
    const h = img.naturalHeight || img.height
    if (!w || !h) return file
    if (Math.max(w, h) <= maxEdge && file.type === 'image/webp') return file
    const { width, height } = fitWithin(w, h, maxEdge)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(img, 0, 0, width, height)
    const out = await canvasToImageFile(canvas, file.name || 'ocr')
    return out || file
  } catch {
    return file
  } finally {
    URL.revokeObjectURL(url)
  }
}
