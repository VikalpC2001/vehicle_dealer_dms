import axios from 'axios'
import { TOKEN_KEY, REFRESH_TOKEN_KEY } from '@/lib/constants'
import {
  ACCESS_PAUSED_CODE,
  isAccessPausedError,
  isAccessPausedPending,
  announceAccessPaused,
  forceAccessPausedSignOut,
} from '@/lib/accessPaused'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://192.168.0.119:4002/api/v1'

const AUTH_PUBLIC_PATHS = [
  '/auth/login',
  '/auth/forgot-password',
  '/auth/verify-otp',
  '/auth/reset-password',
  '/auth/resend-otp',
  // Public agent-onboarding: prefill + accept an invitation without a session.
  '/agent-invitations/accept',
]

function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY)
}

function getStoredRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY) || sessionStorage.getItem(REFRESH_TOKEN_KEY)
}

function getTokenStorage() {
  if (localStorage.getItem(TOKEN_KEY)) return localStorage
  if (sessionStorage.getItem(TOKEN_KEY)) return sessionStorage
  return localStorage
}

function isAuthPublicPath(url) {
  return AUTH_PUBLIC_PATHS.some((path) => url?.includes(path))
}

// A failed `responseType: 'blob'` request (the export download) carries its JSON error envelope as
// a Blob, which hides the app `code` — read it back so a paused export is recognised too.
async function isAccessPausedBlobError(error) {
  const body = error?.response?.data
  if (error?.response?.status !== 403 || !(body instanceof Blob)) return false
  try {
    return JSON.parse(await body.text())?.code === ACCESS_PAUSED_CODE
  } catch {
    return false
  }
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

api.interceptors.request.use(
  (config) => {
    // The "Access paused" popup is waiting for OK: the page stays on screen behind it but its
    // session is gone, so a request could only fail — and its 401 would hard-redirect to /login
    // before the user has confirmed.
    if (isAccessPausedPending() && !isAuthPublicPath(config.url)) {
      return Promise.reject(new axios.CanceledError('Access paused'))
    }
    if (!config.headers.Authorization) {
      const token = getStoredToken()
      if (token) config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // The caller's firm was paused by the super admin (403/4022): wipe the session and raise the
    // "Access paused" popup. Checked before the public-path return so a paused login is caught too —
    // but a refused sign-in only raises the popup: it says nothing about the session stored here.
    if (isAccessPausedError(error) || (await isAccessPausedBlobError(error))) {
      const message = error.response.data?.message
      if (isAuthPublicPath(originalRequest?.url)) announceAccessPaused(message)
      else forceAccessPausedSignOut(message)
      return Promise.reject(error)
    }

    if (isAuthPublicPath(originalRequest?.url)) {
      return Promise.reject(error)
    }

    // A request that was already in flight when the pause landed: leave the redirect to the popup.
    if (error.response?.status === 401 && isAccessPausedPending()) {
      return Promise.reject(error)
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      const refreshToken = getStoredRefreshToken()
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken })
          const payload = data?.data ?? data
          const newToken = payload?.token ?? payload?.accessToken ?? payload?.access_token
          const newRefreshToken = payload?.refreshToken ?? payload?.refresh_token

          const storage = getTokenStorage()
          if (newToken) storage.setItem(TOKEN_KEY, newToken)
          if (newRefreshToken) storage.setItem(REFRESH_TOKEN_KEY, newRefreshToken)

          originalRequest.headers.Authorization = `Bearer ${newToken}`
          return api(originalRequest)
        } catch (refreshError) {
          // The refresh itself was refused because the firm is paused: sign out with the popup
          // instead of a silent hard redirect.
          if (isAccessPausedError(refreshError)) {
            forceAccessPausedSignOut(refreshError.response.data?.message)
            return Promise.reject(refreshError)
          }
          localStorage.removeItem(TOKEN_KEY)
          localStorage.removeItem(REFRESH_TOKEN_KEY)
          sessionStorage.removeItem(TOKEN_KEY)
          sessionStorage.removeItem(REFRESH_TOKEN_KEY)
          window.location.href = '/login'
        }
      } else {
        localStorage.removeItem(TOKEN_KEY)
        sessionStorage.removeItem(TOKEN_KEY)
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
