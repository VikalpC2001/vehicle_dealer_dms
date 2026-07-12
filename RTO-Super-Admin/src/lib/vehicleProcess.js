/**
 * Pure helpers for the dealer "create vehicle process" wizard: image constraints,
 * OCR field mapping, date parsing, and assembly of the `/vehicle-processes/start` payload.
 * No React or network code here so it stays easy to reason about and reuse.
 */

/** Allowed image MIME types for the backend upload + AI endpoints. */
export const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp']

/** Max upload size enforced by the backend (`PUT /upload/file/:key`). */
export const MAX_UPLOAD_MB = 5

/** Friendly messages for AI/OCR backend error codes (OCR failures are non-fatal). */
export const AI_ERROR_MESSAGES = {
  4002: 'No image was provided for analysis.',
  4004: 'The uploaded file is not a valid image.',
  4005: 'Please analyze one image at a time.',
  4290: 'OCR is busy right now (rate limit). Please enter the details manually.',
  5020: 'Could not read the document automatically. Please enter the details manually.',
  5021: 'Could not read the document automatically. Please enter the details manually.',
}

/**
 * Identifies the Registration Certificate (RC) document category so OCR can be
 * auto-triggered on it. Matches loosely by name since per-dealer category names vary.
 *
 * @param {{ categoryName?: string }} category
 * @returns {boolean}
 */
export function isRcCategory(category) {
  const name = (category?.categoryName ?? '').toLowerCase()
  return /\b(rc|registration\s*cert|registration\s*certificate)\b/.test(name)
}

/**
 * Identifies an owner ID-proof document category (Aadhaar, PAN, DL, etc.) for the
 * secondary `analyze-id-proof` OCR pass.
 *
 * @param {{ categoryName?: string }} category
 * @returns {boolean}
 */
export function isIdProofCategory(category) {
  const name = (category?.categoryName ?? '').toLowerCase()
  return /\b(id|aadhaar|aadhar|pan|licen[cs]e|owner\s*id|voter|passport)\b/.test(name)
}

/**
 * Identifies a buyer ID-proof document category (so its OCR fills the BUYER, not the
 * seller). Matches a category whose name mentions "buyer".
 *
 * @param {{ categoryName?: string }} category
 * @returns {boolean}
 */
export function isBuyerIdCategory(category) {
  const name = (category?.categoryName ?? '').toLowerCase()
  return /\bbuyer\b/.test(name)
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

/**
 * Parses an OCR date (e.g. "09-Feb-2012" or "2012-02-09") into a `YYYY-MM-DD` string
 * for a date input / the API. Returns `null` when it cannot be parsed confidently.
 *
 * @param {string|null|undefined} value
 * @returns {string|null}
 */
export function parseOcrDate(value) {
  if (!value || typeof value !== 'string') return null
  const raw = value.trim()
  if (!raw) return null

  // Already ISO-ish: YYYY-MM-DD
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) {
    const [, y, m, d] = iso
    return toIsoDate(Number(y), Number(m) - 1, Number(d))
  }

  // dd-MMM-yyyy or dd/MMM/yyyy (e.g. 09-Feb-2012)
  const named = raw.match(/^(\d{1,2})[-/\s]([A-Za-z]{3,})[-/\s](\d{4})$/)
  if (named) {
    const [, d, monthName, y] = named
    const monthIndex = MONTHS.indexOf(monthName.slice(0, 3).toLowerCase())
    if (monthIndex >= 0) return toIsoDate(Number(y), monthIndex, Number(d))
  }

  // dd-mm-yyyy or dd/mm/yyyy
  const numeric = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (numeric) {
    const [, d, m, y] = numeric
    return toIsoDate(Number(y), Number(m) - 1, Number(d))
  }

  return null
}

function toIsoDate(year, monthIndex, day) {
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(monthIndex) ||
    !Number.isFinite(day) ||
    monthIndex < 0 ||
    monthIndex > 11 ||
    day < 1 ||
    day > 31
  ) {
    return null
  }
  const mm = String(monthIndex + 1).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

/**
 * Composes a single address string from OCR address parts (the start payload's
 * person `address` is one field, while OCR splits city/state/pincode).
 *
 * @param {{ address?: string, city?: string, state?: string, pincode?: string }} parts
 * @returns {string}
 */
export function composeAddress(parts = {}) {
  const { address, city, state, pincode } = parts
  const line = [address, city, state].map((s) => (s ?? '').trim()).filter(Boolean).join(', ')
  const pin = (pincode ?? '').trim()
  return [line, pin].filter(Boolean).join(' - ')
}

/**
 * Maps the RC OCR response (`/ai/analyze-image`) onto the verify-form field shape.
 * Only includes fields the OCR actually returned (callers should not clobber edits).
 *
 * @param {{ vehicleInfo?: object, ownerInfo?: object }} data
 * @returns {object}
 */
export function mapRcOcrToForm(data = {}) {
  const v = data.vehicleInfo ?? {}
  const o = data.ownerInfo ?? {}
  return {
    registrationNumber: clean(v.vehicleNo),
    chassisNumber: clean(v.chassisNo),
    engineNumber: clean(v.engineNo),
    vehicleType: clean(v.vehicleType),
    make: clean(v.make),
    model: clean(v.model),
    registrationDate: parseOcrDate(v.registrationDate) ?? '',
    manufactureMonth: toMonthValue(v.manufactureMonth),
    manufactureYear: toYearValue(v.manufactureYear),
    sellerName: clean(o.fullName),
    sellerAddress: composeAddress(o),
  }
}

/** Coerces an OCR manufacture-month value (number, "6", or "Jun"/"June") to "1".."12" or "". */
function toMonthValue(value) {
  if (value == null || value === '') return ''
  const n = Number(value)
  if (Number.isInteger(n) && n >= 1 && n <= 12) return String(n)
  const idx = MONTHS.indexOf(String(value).trim().slice(0, 3).toLowerCase())
  return idx >= 0 ? String(idx + 1) : ''
}

/** Coerces an OCR manufacture-year value to a 4-digit year string or "". */
function toYearValue(value) {
  if (value == null || value === '') return ''
  const n = Number(String(value).trim())
  return Number.isInteger(n) && n >= 1900 && n <= 3000 ? String(n) : ''
}

/**
 * Maps the ID-proof OCR response (`/ai/analyze-id-proof`) onto owner fields.
 *
 * @param {object} data
 * @returns {{ sellerName: string, sellerAddress: string }}
 */
export function mapIdOcrToForm(data = {}) {
  return {
    sellerName: clean(data.fullName),
    sellerAddress: composeAddress(data),
  }
}

/** Maps an ID-proof OCR result to generic person fields (name + composed address). */
export function mapIdProofToPerson(data = {}) {
  return {
    name: clean(data.fullName),
    address: composeAddress(data),
  }
}

function clean(value) {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Builds the `POST /vehicle-processes/start` request body from the verify-form
 * values and the uploaded photo slots. `dealerId` is omitted (taken from the JWT).
 *
 * @param {object} values - Verify-form values (vehicle + seller + reference).
 * @param {Array<{ category: string, fileKey: string|null, status: string }>} uploadedPhotos
 * @returns {object}
 */
export function assembleStartPayload(values, uploadedPhotos = []) {
  const v = values ?? {}
  const payload = {
    registrationNumber: (v.registrationNumber ?? '').trim(),
  }

  // Optional vehicle fields — omit when empty so the upsert comparison stays clean.
  assignIfPresent(payload, 'chassisNumber', v.chassisNumber)
  assignIfPresent(payload, 'engineNumber', v.engineNumber)
  assignIfPresent(payload, 'vehicleType', v.vehicleType)
  assignIfPresent(payload, 'make', v.make)
  assignIfPresent(payload, 'model', v.model)
  payload.registrationDate = v.registrationDate ? v.registrationDate : null
  if (v.manufactureMonth) payload.manufactureMonth = Number(v.manufactureMonth)
  if (v.manufactureYear) payload.manufactureYear = Number(v.manufactureYear)

  // Persons — seller and optional buyer. A person needs BOTH a name and a mobile
  // (the backend requires both), so only complete persons are sent.
  const persons = []
  const sellerName = (v.sellerName ?? '').trim()
  const sellerMobile = (v.sellerMobile ?? '').trim()
  if (sellerName && sellerMobile) {
    persons.push({
      personName: sellerName,
      mobileNumber: sellerMobile,
      personType: 'SELLER',
      address: (v.sellerAddress ?? '').trim() || null,
    })
    // The purchase price pairs with the SELLER; the backend rejects it without one.
    if (isMoney(v.purchasePrice)) payload.purchasePrice = Number(v.purchasePrice)
  }
  const buyerName = (v.buyerName ?? '').trim()
  const buyerMobile = (v.buyerMobile ?? '').trim()
  if (v.addBuyer && buyerName && buyerMobile) {
    persons.push({
      personName: buyerName,
      mobileNumber: buyerMobile,
      personType: 'BUYER',
      address: (v.buyerAddress ?? '').trim() || null,
    })
    // The sale price pairs with the BUYER; the backend rejects it without one.
    if (isMoney(v.salePrice)) payload.salePrice = Number(v.salePrice)
  }
  payload.persons = persons

  // Uploaded document photos — imageName is the storage fileKey, not the URL.
  payload.uploadPhotos = uploadedPhotos
    .filter((slot) => slot.status === 'uploaded' && slot.fileKey)
    .map((slot) => ({ category: slot.category, imageName: slot.fileKey }))

  // Optional seller reference.
  payload.processReferences = v.sellerReferenceId
    ? [{ referenceId: v.sellerReferenceId, referenceType: 'SELL' }]
    : []

  return payload
}

function assignIfPresent(target, key, value) {
  const v = typeof value === 'string' ? value.trim() : value
  if (v !== undefined && v !== null && v !== '') target[key] = v
}

/** True when `value` is a non-empty string that parses to a finite number. */
function isMoney(value) {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  return trimmed !== '' && Number.isFinite(Number(trimmed))
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

/**
 * Makes an uploaded-file URL load through the same origin in proxied dev. The backend
 * returns absolute URLs (e.g. http://<lan-ip>:4002/uploads/<key>) which aren't always
 * reachable cross-origin from the browser; when the app talks to the API via a relative
 * base (Vite proxy), rewrite to the same-origin path so <img>/fetch go through the proxy.
 * In production (absolute API base) the URL is returned unchanged.
 *
 * @param {string} url
 * @returns {string}
 */
export function toAppImageUrl(url) {
  if (!url || !API_BASE.startsWith('/')) return url
  try {
    const u = new URL(url)
    return u.pathname + u.search
  } catch {
    return url
  }
}
