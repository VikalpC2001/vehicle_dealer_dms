import { createContext, useContext, useState, useCallback } from 'react'

const PasswordResetContext = createContext(null)

/**
 * Holds email + resetToken in memory only (never persisted).
 * Cleared after successful reset or on provider unmount.
 */
export function PasswordResetProvider({ children }) {
  const [email, setEmail] = useState('')
  const [resetToken, setResetToken] = useState(null)

  const clearResetFlow = useCallback(() => {
    setEmail('')
    setResetToken(null)
  }, [])

  return (
    <PasswordResetContext.Provider
      value={{ email, setEmail, resetToken, setResetToken, clearResetFlow }}
    >
      {children}
    </PasswordResetContext.Provider>
  )
}

export function usePasswordReset() {
  const context = useContext(PasswordResetContext)
  if (!context) throw new Error('usePasswordReset must be used within PasswordResetProvider')
  return context
}
