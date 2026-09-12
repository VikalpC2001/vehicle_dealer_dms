import { useEffect, useState, useCallback } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Shield, Loader2, Clock, XCircle, RefreshCw, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useAuth } from '@/context/AuthContext'
import { homeForRole, APP_NAME } from '@/lib/constants'
import { toast } from '@/hooks/use-toast'

/**
 * Landing screen for a signed-in dealer/agent whose self-registration isn't APPROVED yet. Shows a
 * pending state (auto-polls `/auth/me` for approval, then routes to their dashboard) or a rejected
 * state with the super-admin's reason. Super-admins never see this (routed home).
 */
export default function PendingApproval() {
  const { user, refreshUser, logout } = useAuth()
  const navigate = useNavigate()
  const [checking, setChecking] = useState(false)

  const status = user?.approvalStatus

  const check = useCallback(
    async (manual) => {
      setChecking(true)
      try {
        const updated = await refreshUser()
        if (updated?.approvalStatus === 'APPROVED') {
          toast({ title: "You're approved!", description: 'Taking you to your dashboard…', variant: 'success' })
          navigate(homeForRole(updated.role), { replace: true })
        } else if (manual) {
          toast({
            title: updated?.approvalStatus === 'REJECTED' ? 'Registration declined' : 'Still pending',
            description:
              updated?.approvalStatus === 'REJECTED'
                ? updated?.approvalReason || 'Your registration was declined.'
                : 'Your account is still awaiting approval.',
          })
        }
      } catch {
        // ignore transient errors; the next poll retries
      } finally {
        setChecking(false)
      }
    },
    [refreshUser, navigate],
  )

  // Poll for approval every 20s while pending.
  useEffect(() => {
    if (status !== 'PENDING') return undefined
    const id = setInterval(() => check(false), 20000)
    return () => clearInterval(id)
  }, [status, check])

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  // Super-admins (or an already-approved user) shouldn't be here.
  if (user && user.role !== 'dealer' && user.role !== 'agent') {
    return <Navigate to={homeForRole(user.role)} replace />
  }
  if (status === 'APPROVED') {
    return <Navigate to={homeForRole(user?.role)} replace />
  }

  const rejected = status === 'REJECTED'

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center">
        <div className="inline-flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-bg">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold">{APP_NAME}</span>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Card className="border-0 shadow-xl">
          <CardHeader className="text-center">
            <div
              className={`mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full ${
                rejected ? 'bg-destructive/10' : 'bg-warning/10'
              }`}
            >
              {rejected ? (
                <XCircle className="h-7 w-7 text-destructive" />
              ) : (
                <Clock className="h-7 w-7 text-warning" />
              )}
            </div>
            <CardTitle className="text-2xl">
              {rejected ? 'Registration declined' : 'Approval pending'}
            </CardTitle>
            <CardDescription>
              {rejected
                ? 'Unfortunately your registration was not approved.'
                : `Hi ${user?.name || 'there'}, your account is awaiting review by our team.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {rejected ? (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm">
                <p className="font-medium text-destructive">Reason</p>
                <p className="mt-1 text-muted-foreground">
                  {user?.approvalReason || 'No reason was provided. Please contact support for details.'}
                </p>
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground">
                You&apos;ll get an email as soon as you&apos;re approved. You can also check now.
              </p>
            )}

            {!rejected && (
              <Button className="w-full" onClick={() => check(true)} disabled={checking}>
                {checking ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking…</>
                ) : (
                  <><RefreshCw className="mr-2 h-4 w-4" /> Check approval status</>
                )}
              </Button>
            )}

            <Button variant="outline" className="w-full" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
