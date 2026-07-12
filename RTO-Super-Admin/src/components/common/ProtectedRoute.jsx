import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { homeForRole } from '@/lib/constants'

/**
 * Guards a route group. Always requires authentication; optionally restricts to
 * specific roles, redirecting other roles to their own home.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {string[]} [props.allowedRoles] - e.g. ['dealer'] or ['super_admin'].
 */
export function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, user } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to={homeForRole(user?.role)} replace />
  }

  return children
}
