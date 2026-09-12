/**
 * Returns the numeric app error `code` from an API error envelope (e.g. 4031, 4091), or null.
 */
export function getErrorCode(error) {
  return error?.response?.data?.code ?? null
}

/**
 * Extracts a human-readable message from API error envelopes.
 */
export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  const data = error?.response?.data
  if (!data) return error?.message || fallback

  if (typeof data === 'string') return data
  if (data.message) return data.message
  if (data.error) return typeof data.error === 'string' ? data.error : data.error.message

  const fieldErrors = parseValidationErrors(error)
  const firstFieldError = Object.values(fieldErrors)[0]
  if (firstFieldError) return firstFieldError

  if (Array.isArray(data.errors) && data.errors.length) return data.errors[0]

  return fallback
}

/**
 * Maps API validation errors (422) to form field keys.
 * e.g. "body.email" → "email"
 */
export function parseValidationErrors(error) {
  const errors = error?.response?.data?.errors
  if (!errors || typeof errors !== 'object') return {}

  const result = {}
  for (const [key, messages] of Object.entries(errors)) {
    const field = key.replace(/^body\./, '')
    result[field] = Array.isArray(messages) ? messages[0] : messages
  }
  return result
}
