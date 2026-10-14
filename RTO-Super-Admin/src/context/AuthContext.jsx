import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { authService } from '@/services/authService'
import {
  forceAccessPausedSignOut,
  readAccessPausedNotice,
  clearAccessPausedNotice,
  subscribeAccessPaused,
} from '@/lib/accessPaused'

const AuthContext = createContext(null)

// How often a signed-in dealer/agent tab re-checks that its firm's access is still on.
const ACCESS_HEARTBEAT_MS = 20000

// The "Access paused" notice left by a forced sign-out survives a reload — unless a live session
// has since replaced it (e.g. access was resumed and the user signed in again from another tab).
function readInitialPausedNotice() {
  if (authService.getCurrentUser() && authService.isAuthenticated()) {
    clearAccessPausedNotice()
    return null
  }
  return readAccessPausedNotice()
}

export function AuthProvider({ children }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState(() => authService.getCurrentUser())
  const [loading, setLoading] = useState(false)
  // `{ message }` while the "Access paused" popup must be shown (the firm was paused), else null.
  const [pausedNotice, setPausedNotice] = useState(readInitialPausedNotice)
  // True between a forced sign-out and the user's OK on the popup: the stored session is already
  // wiped, but the page they were on stays on screen behind the popup until they confirm.
  const [sessionHeld, setSessionHeld] = useState(false)
  // Whether this tab was showing a signed-in session at its last render. The paused handler needs
  // it because storage is already wiped by the time it runs (and the stored profile is shared by
  // every tab, so a tab sitting on /login can hold a `user` without ever having had a session).
  const wasAuthenticatedRef = useRef(false)

  const clearPausedNotice = useCallback(() => {
    clearAccessPausedNotice()
    setPausedNotice(null)
    setSessionHeld(false)
  }, [])

  // The user confirmed the popup (OK). A held session ends here: the paused user and every cached
  // response are dropped, so their data is neither left on screen nor served to the next login.
  // The in-memory user is re-read from storage rather than kept — normally that is "nobody", but
  // another tab may have signed someone in meanwhile. The caller then navigates to /login.
  const dismissPausedNotice = useCallback(() => {
    const wasHeld = sessionHeld
    clearPausedNotice()
    if (wasHeld || !authService.isAuthenticated()) {
      setUser(authService.isAuthenticated() ? authService.getCurrentUser() : null)
      queryClient.clear()
    }
  }, [clearPausedNotice, queryClient, sessionHeld])

  const login = useCallback(async (credentials) => {
    setLoading(true)
    try {
      const result = await authService.login(credentials)
      clearPausedNotice()
      setUser(result.user)
      return result
    } finally {
      setLoading(false)
    }
  }, [clearPausedNotice])

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
    clearPausedNotice()
    setUser(result.user)
    return result
  }, [clearPausedNotice])

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

  // Only dealer/agent users belong to a firm the super admin can pause.
  const isFirmUser = user?.role === 'dealer' || user?.role === 'agent'

  // Forced sign-out: the API answered 403/4022 because the user's firm was paused. The interceptor
  // has already wiped the stored session; raise the popup and HOLD the current page behind it —
  // the user is only dropped and sent to /login when they click OK (`dismissPausedNotice`).
  // A refused sign-in (`signedOut: false`) only raises the popup — this tab's session is untouched.
  useEffect(() => {
    return subscribeAccessPaused({
      onPaused: (notice, { signedOut }) => {
        if (signedOut) {
          // Hold only a page that was really signed in; a tab with just a stale profile (no
          // session of its own) simply drops it and stays where it is.
          if (wasAuthenticatedRef.current) setSessionHeld(true)
          else setUser(null)
        }
        setPausedNotice((current) => current ?? notice)
      },
      // Another tab was signed out. Follow it only if this tab was on that same (shared
      // "remember me") session — a tab that still holds its own tokens is a separate session.
      onPausedElsewhere: (notice) => {
        if (!isFirmUser || authService.isAuthenticated()) return
        forceAccessPausedSignOut(notice.message, { broadcast: false })
      },
    })
  }, [isFirmUser])

  // Heartbeat: a pause is only noticed when a request comes back 403/4022, so an idle dealer/agent
  // tab pings GET /auth/me (skipped while hidden, re-checked as soon as the tab is visible again).
  // The response interceptor does the actual sign-out — the result is deliberately ignored here.
  useEffect(() => {
    if (!isFirmUser) return undefined
    const beat = () => {
      if (document.hidden || !authService.isAuthenticated()) return
      authService.getMe().catch(() => {})
    }
    const intervalId = setInterval(beat, ACCESS_HEARTBEAT_MS)
    document.addEventListener('visibilitychange', beat)
    return () => {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', beat)
    }
  }, [isFirmUser])

  // A held session still counts as signed in for routing, so the route guards don't redirect to
  // /login before the user has confirmed the popup.
  const isAuthenticated = !!user && (authService.isAuthenticated() || sessionHeld)

  useEffect(() => {
    wasAuthenticatedRef.current = isAuthenticated
  })

  return (
    <AuthContext.Provider
      value={{
        user, loading, login, register, applySession, refreshUser, logout, isAuthenticated,
        pausedNotice, dismissPausedNotice,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
