import axios from 'axios'
import { TOKEN_KEY, REFRESH_TOKEN_KEY } from '@/lib/constants'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://192.168.0.119:4002/api/v1'

const AUTH_PUBLIC_PATHS = [
  '/auth/login',
  '/auth/forgot-password',
  '/auth/verify-otp',
  '/auth/reset-password',
  '/auth/resend-otp',
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

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

api.interceptors.request.use(
  (config) => {
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

    if (isAuthPublicPath(originalRequest?.url)) {
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
        } catch {
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
