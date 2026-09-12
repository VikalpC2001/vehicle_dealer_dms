import { createContext, useContext, useState, useCallback } from 'react'
import { authService } from '@/services/authService'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => authService.getCurrentUser())
  const [loading, setLoading] = useState(false)

  const login = useCallback(async (credentials) => {
    setLoading(true)
    try {
      const result = await authService.login(credentials)
      setUser(result.user)
      return result
    } finally {
      setLoading(false)
    }
  }, [])

  const register = useCallback(async (data) => {
    setLoading(true)
    try {
      return await authService.register(data)
    } finally {
      setLoading(false)
    }
  }, [])

  // Hydrate auth state from a token bundle obtained outside the login flow (agent onboarding).
  const applySession = useCallback((data) => {
    const result = authService.setSession(data)
    setUser(result.user)
    return result
  }, [])

  // Re-read the linked firm's approval state (used by the pending-approval screen). Once APPROVED
  // the access token is rotated so app routes unlock. Returns the fresh user.
  const refreshUser = useCallback(async () => {
    const updated = await authService.refreshApproval()
    if (updated) setUser(updated)
    return updated
  }, [])

  const logout = useCallback(async () => {
    await authService.logout()
    setUser(null)
  }, [])

  const isAuthenticated = !!user && authService.isAuthenticated()

  return (
    <AuthContext.Provider value={{ user, loading, login, register, applySession, refreshUser, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
