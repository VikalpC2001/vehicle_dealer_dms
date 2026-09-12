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

  // A self-registered dealer/agent whose firm isn't APPROVED can't enter any role-gated area — they
  // see the pending/rejected screen instead. (The pending screen itself has no `allowedRoles`, so
  // it's exempt from this check and there is no redirect loop.)
  if (
    allowedRoles &&
    (user?.role === 'dealer' || user?.role === 'agent') &&
    user?.approvalStatus &&
    user.approvalStatus !== 'APPROVED'
  ) {
    return <Navigate to="/pending-approval" replace />
  }

  return children
}
