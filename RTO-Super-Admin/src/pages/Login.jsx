import { Navigate } from 'react-router-dom'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { LoginForm } from '@/components/forms/LoginForm'
import { useAuth } from '@/context/AuthContext'
import { homeForRole } from '@/lib/constants'

export default function Login() {
  const { isAuthenticated, user } = useAuth()
  if (isAuthenticated) return <Navigate to={homeForRole(user?.role)} replace />

  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  )
}
