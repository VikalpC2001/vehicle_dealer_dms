import { Navigate } from 'react-router-dom'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { ForgotPasswordForm } from '@/components/forms/ForgotPasswordForm'
import { useAuth } from '@/context/AuthContext'

export default function ForgotPassword() {
  const { isAuthenticated } = useAuth()
  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  return (
    <AuthLayout>
      <ForgotPasswordForm />
    </AuthLayout>
  )
}
