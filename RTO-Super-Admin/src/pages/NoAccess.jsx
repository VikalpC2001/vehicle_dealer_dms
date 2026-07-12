import { useNavigate } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'

/**
 * Terminal page for an authenticated user who is neither the platform admin nor
 * linked to a dealer/agent workspace (role 'none'). Kept outside every role-gated
 * route group so `homeForRole('none')` lands here without a redirect loop.
 */
export default function NoAccess() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="glass-card w-full max-w-md rounded-xl border border-border p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-warning/10">
          <ShieldAlert className="h-6 w-6 text-warning" />
        </div>
        <h1 className="text-xl font-semibold">No workspace access</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {user?.email ? (
            <>
              <span className="font-medium text-foreground">{user.email}</span> is signed in, but
              this account isn&apos;t linked to a dealer or agent workspace and isn&apos;t a platform
              admin.
            </>
          ) : (
            "This account isn't linked to a workspace yet."
          )}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Ask your administrator to link your account, or sign in with a different one.
        </p>
        <Button className="mt-6 w-full" onClick={handleSignOut}>
          Sign out
        </Button>
      </div>
    </div>
  )
}
