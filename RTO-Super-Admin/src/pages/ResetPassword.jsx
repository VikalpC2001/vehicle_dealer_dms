import { Navigate } from 'react-router-dom'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { ResetPasswordForm } from '@/components/forms/ResetPasswordForm'
import { useAuth } from '@/context/AuthContext'
import { usePasswordReset } from '@/context/PasswordResetContext'

export default function ResetPassword() {
  const { isAuthenticated } = useAuth()
  const { email, resetToken } = usePasswordReset()

  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  if (!email) return <Navigate to="/forgot-password" replace />
  if (!resetToken) return <Navigate to="/forgot-password/verify-otp" replace />

  return (
    <AuthLayout>
      <ResetPasswordForm />
    </AuthLayout>
  )
}
