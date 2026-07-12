import { Navigate } from 'react-router-dom'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { VerifyOtpForm } from '@/components/forms/VerifyOtpForm'
import { useAuth } from '@/context/AuthContext'
import { usePasswordReset } from '@/context/PasswordResetContext'

export default function VerifyOtp() {
  const { isAuthenticated } = useAuth()
  const { email } = usePasswordReset()

  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  if (!email) return <Navigate to="/forgot-password" replace />

  return (
    <AuthLayout>
      <VerifyOtpForm />
    </AuthLayout>
  )
}
