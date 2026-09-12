import api from '@/services/api'
import { normalizePaginatedResponse } from '@/lib/pagination'

function unwrap(response) {
  return response?.data?.data ?? response?.data ?? response
}

function normalizeListResponse(data) {
  const normalized = normalizePaginatedResponse(data, 'registrations', 10)
  return {
    registrations: normalized.items,
    page: normalized.page,
    limit: normalized.limit,
    total: normalized.total,
    totalPages: normalized.totalPages,
  }
}

/**
 * Self-registration (dealer/agent) + super-admin approval. `selfRegister`, `verifyOtp`, and
 * `resendOtp` are PUBLIC; `getAll`/`approve`/`reject` require a super-admin session.
 */
export const registrationService = {
  // --- PUBLIC ---------------------------------------------------------------

  /**
   * POST /registrations — create a PENDING dealer/agent account (email unverified) + email an OTP.
   * @param {object} payload - { registerAs: 'DEALER'|'AGENT', applicantName, firmName, emailId, mobileNo, password, ... }
   * @returns {Promise<{ emailId: string, registerAs: 'dealer'|'agent' }>}
   */
  async selfRegister(payload) {
    const { data } = await api.post('/registrations', payload)
    return unwrap(data)
  },

  /**
   * POST /auth/verify-otp (signup) — verify the emailed OTP. Returns the RAW response body so the
   * caller can hydrate the session via `applySession(...)` (auto sign-in, possibly still PENDING).
   */
  async verifyOtp(email, otp) {
    const { data } = await api.post('/auth/verify-otp', {
      email,
      otp,
      purpose: 'SIGNUP_EMAIL_VERIFICATION',
    })
    return data
  },

  /** POST /auth/resend-otp (signup) — re-send the verification code. */
  async resendOtp(email) {
    const { data } = await api.post('/auth/resend-otp', { email, purpose: 'SIGNUP_EMAIL_VERIFICATION' })
    return data
  },

  // --- SUPER-ADMIN ----------------------------------------------------------

  /** GET /registrations — paginated requests (default PENDING+REJECTED); optional { status }. */
  async getAll({ page = 1, limit = 10, status } = {}) {
    const params = { page, limit }
    if (status) params.status = status
    const { data } = await api.get('/registrations', { params })
    return normalizeListResponse(data)
  },

  /** POST /registrations/:kind/:id/approve — unlock access (dealer also subscribed). */
  async approve(kind, id) {
    const { data } = await api.post(`/registrations/${kind}/${id}/approve`)
    return unwrap(data)
  },

  /** POST /registrations/:kind/:id/reject — block access with an optional reason (emailed). */
  async reject(kind, id, reason) {
    const { data } = await api.post(`/registrations/${kind}/${id}/reject`, reason ? { reason } : {})
    return unwrap(data)
  },
}
