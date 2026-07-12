/**
 * Canvas-based image helpers for the create-process upload step: producing a cropped
 * JPEG File from a crop region, and stacking two images into one vertical collage.
 * Output is always JPEG (.jpg) so it matches the backend's extension/MIME check.
 */

const JPEG_QUALITY = 0.92

function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

function canvasToFile(canvas, fileName) {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(new File([blob], fileName, { type: 'image/jpeg' })),
      'image/jpeg',
      JPEG_QUALITY
    )
  })
}

/**
 * Produces a cropped JPEG File from a loaded <img> element and a pixel crop
 * (as given by react-image-crop, relative to the displayed image).
 *
 * @param {HTMLImageElement} image - The displayed <img> element.
 * @param {{ x:number, y:number, width:number, height:number }} pixelCrop
 * @param {string} [fileName]
 * @returns {Promise<File>}
 */
export async function getCroppedFile(image, pixelCrop, fileName = 'image.jpg') {
  const scaleX = image.naturalWidth / image.width
  const scaleY = image.naturalHeight / image.height
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(pixelCrop.width * scaleX))
  canvas.height = Math.max(1, Math.round(pixelCrop.height * scaleY))
  const ctx = canvas.getContext('2d')
  ctx.drawImage(
    image,
    pixelCrop.x * scaleX,
    pixelCrop.y * scaleY,
    pixelCrop.width * scaleX,
    pixelCrop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height
  )
  return canvasToFile(canvas, fileName)
}

/**
 * Combines two images into a single JPEG with `front` stacked above `back`
 * (both scaled to a common width). Used for two-sided documents (e.g. RC).
 *
 * @param {File} frontFile
 * @param {File} backFile
 * @param {string} [fileName]
 * @returns {Promise<File>}
 */
export async function collageVertical(frontFile, backFile, fileName = 'document.jpg') {
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
    return canvasToFile(canvas, fileName)
  } finally {
    URL.revokeObjectURL(frontUrl)
    URL.revokeObjectURL(backUrl)
  }
}
