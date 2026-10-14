import api from '@/services/api'
import { TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY, OTP_PURPOSE } from '@/lib/constants'
import { getErrorMessage } from '@/lib/authErrors'
import { isAccessPausedError } from '@/lib/accessPaused'

function getStorage(rememberMe) {
  return rememberMe ? localStorage : sessionStorage
}

function getTokenStorage() {
  if (localStorage.getItem(TOKEN_KEY)) return localStorage
  if (sessionStorage.getItem(TOKEN_KEY)) return sessionStorage
  return null
}

function unwrapData(response) {
  return response?.data?.data ?? response?.data ?? response
}

/**
 * Normalizes login API response across common backend shapes.
 */
function normalizeAuthResponse(data) {
  const payload = data?.data ?? data

  const token =
    payload?.token ??
    payload?.accessToken ??
    payload?.access_token ??
    payload?.jwt

  const refreshToken = payload?.refreshToken ?? payload?.refresh_token

  // Normalize to a stable shape and derive the app role. The backend `user` uses
  // `userId`/`userName`/`emailId` and carries `dealerId`/`agentId` (its workspace link)
  // and `isSuperAdmin` (a real User column, also on the JWT). Super-admin is granted
  // ONLY by `isSuperAdmin` — never by the mere absence of a dealer/agent link, so an
  // agent or unlinked user is not shown the admin UI and then bounced by 403s. The
  // JWT's own `role` is legacy (ADMIN|USER) and is not used for gating.
  const raw = payload?.user ?? payload?.admin ?? payload?.profile ?? payload
  const hasUser = raw?.userId || raw?.id || raw?.emailId || raw?.email
  const dealerId = raw?.dealerId ?? null
  const agentId = raw?.agentId ?? null
  const isSuperAdmin = raw?.isSuperAdmin === true

  const user = hasUser
    ? {
        id: raw.userId ?? raw.id ?? null,
        name: raw.userName ?? raw.name ?? raw.fullName ?? (raw.emailId ?? raw.email)?.split('@')[0],
        email: raw.emailId ?? raw.email ?? null,
        dealerId,
        agentId,
        isSuperAdmin,
        // Self-registration approval gate of the linked firm (super-admin/unlinked → treated approved).
        approvalStatus: raw.approvalStatus ?? 'APPROVED',
        approvalReason: raw.approvalReason ?? null,
        // super-admin (flag) → dealer (link) → agent (link) → 'none' (no workspace).
        role: isSuperAdmin ? 'super_admin' : dealerId ? 'dealer' : agentId ? 'agent' : 'none',
      }
    : null

  return { token, refreshToken, user }
}

export const authService = {
  async login({ email, password, rememberMe = false }) {
    const { data } = await api.post('/auth/login', { email, password })
    const { token, refreshToken, user } = normalizeAuthResponse(data)

    if (!token) {
      throw new Error('Invalid response from server. No token received.')
    }

    const storage = getStorage(rememberMe)
    storage.setItem(TOKEN_KEY, token)
    if (refreshToken) storage.setItem(REFRESH_TOKEN_KEY, refreshToken)

    // Fall back to a no-access profile if the server omitted `user`: without the
    // `isSuperAdmin` flag we cannot grant the admin UI, so route to /no-access.
    const userProfile = user ?? {
      email,
      name: email.split('@')[0],
      dealerId: null,
      agentId: null,
      isSuperAdmin: false,
      role: 'none',
    }
    localStorage.setItem(USER_KEY, JSON.stringify(userProfile))

    return { user: userProfile, token, refreshToken }
  },

  async register(formData) {
    const { data } = await api.post('/auth/register', formData)
    return data
  },

  /** GET /auth/me — current user with a fresh (DB-read) approval state. Allowed while pending. */
  async getMe() {
    const { data } = await api.get('/auth/me')
    const { user } = normalizeAuthResponse(data)
    return user
  },

  /**
   * Re-reads approval state (and, once APPROVED, rotates the access token so app routes unlock).
   * Updates the stored user. Returns the fresh user (or null if the session is gone).
   */
  async refreshApproval() {
    const me = await this.getMe()
    if (!me) return null
    if (me.approvalStatus === 'APPROVED') {
      const refreshToken = getTokenStorage()?.getItem(REFRESH_TOKEN_KEY)
      if (refreshToken) {
        try {
          const { data } = await api.post('/auth/refresh', { refreshToken })
          const payload = data?.data ?? data
          const storage = getTokenStorage() ?? localStorage
          if (payload?.token) storage.setItem(TOKEN_KEY, payload.token)
          if (payload?.refreshToken) storage.setItem(REFRESH_TOKEN_KEY, payload.refreshToken)
        } catch (err) {
          // Paused in the meantime: the interceptor has already wiped the session — don't re-store the user.
          if (isAccessPausedError(err)) throw err
          // otherwise keep the current token; app routes will retry via the 401 interceptor
        }
      }
    }
    localStorage.setItem(USER_KEY, JSON.stringify(me))
    return me
  },

  /**
   * Hydrates a session from an already-issued token bundle (e.g. the response of agent-invitation
   * acceptance, which logs the new agent straight in). Mirrors `login`'s storage side effects but
   * skips the /auth/login call. Returns the normalized `{ user, token, refreshToken }`.
   *
   * @param {object} data - The raw API response body carrying `{ token, refreshToken, user }`.
   * @param {{ rememberMe?: boolean }} [opts]
   */
  setSession(data, { rememberMe = true } = {}) {
    const { token, refreshToken, user } = normalizeAuthResponse(data)
    if (!token) {
      throw new Error('Invalid response from server. No token received.')
    }
    const storage = getStorage(rememberMe)
    storage.setItem(TOKEN_KEY, token)
    if (refreshToken) storage.setItem(REFRESH_TOKEN_KEY, refreshToken)

    const userProfile = user ?? {
      name: null,
      email: null,
      dealerId: null,
      agentId: null,
      isSuperAdmin: false,
      role: 'none',
    }
    localStorage.setItem(USER_KEY, JSON.stringify(userProfile))
    return { user: userProfile, token, refreshToken }
  },

  async forgotPassword(email) {
    const { data } = await api.post('/auth/forgot-password', { email })
    return {
      message: data?.message ?? 'If an account exists for this email, a reset code has been sent.',
      data: unwrapData(data),
    }
  },

  async verifyOtp({ email, otp, purpose = OTP_PURPOSE.PASSWORD_RESET }) {
    const { data } = await api.post('/auth/verify-otp', { email, otp, purpose })
    const payload = unwrapData(data)
    const resetToken = payload?.resetToken

    if (!resetToken) {
      throw new Error('Invalid response from server. No reset token received.')
    }

    return {
      message: data?.message ?? 'Code verified.',
      resetToken,
    }
  },

  async resendOtp({ email, purpose = OTP_PURPOSE.PASSWORD_RESET }) {
    const { data } = await api.post('/auth/resend-otp', { email, purpose })
    return {
      message: data?.message ?? 'If applicable, a code has been sent to your email.',
    }
  },

  async resetPassword(password, resetToken) {
    const { data } = await api.post(
      '/auth/reset-password',
      { password },
      { headers: { Authorization: `Bearer ${resetToken}` } }
    )
    return {
      message: data?.message ?? 'Password has been reset. You can log in with your new password.',
    }
  },

  async logout() {
    try {
      await api.post('/auth/logout')
    } catch {
      // Proceed with local cleanup even if logout API fails
    }

    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(REFRESH_TOKEN_KEY)
  },

  getCurrentUser() {
    const stored = localStorage.getItem(USER_KEY)
    if (stored) {
      try {
        const user = JSON.parse(stored)
        // Backfill role for sessions stored before role-gating existed, so the
        // route guards resolve a role instead of looping. Sessions predating the
        // `isSuperAdmin` flag with no dealer/agent link resolve to 'none' → they
        // must re-login to obtain a token/flag that unlocks the admin UI anyway.
        if (user && !user.role) {
          user.role = user.isSuperAdmin
            ? 'super_admin'
            : user.dealerId
              ? 'dealer'
              : user.agentId
                ? 'agent'
                : 'none'
        }
        return user
      } catch {
        return null
      }
    }
    return null
  },

  isAuthenticated() {
    return !!(localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY))
  },

  getTokenStorage,
  getErrorMessage,
}
