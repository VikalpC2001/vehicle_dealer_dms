import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft, Mail, Phone, MapPin, Building, CheckCircle, Ban, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/common/StatusBadge'
import { ConfirmModal } from '@/components/modals/ConfirmModal'
import { userService } from '@/services/userService'
import { mockPaymentHistory } from '@/data/mockData'
import { getInitials, formatDate, formatCurrency, cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'

function getSubscriptionProgress(start, end) {
  if (!start || !end) return 0
  const total = new Date(end) - new Date(start)
  const elapsed = Date.now() - new Date(start)
  return Math.min(100, Math.max(0, (elapsed / total) * 100))
}

function getRemainingDays(end) {
  if (!end) return 0
  return Math.max(0, Math.ceil((new Date(end) - Date.now()) / 86400000))
}

const subStatusColors = {
  active: 'text-success',
  expiring: 'text-warning',
  expired: 'text-destructive',
}

export default function UserDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirmAction, setConfirmAction] = useState(null)

  const { data: user, isLoading } = useQuery({
    queryKey: ['user', id],
    queryFn: () => userService.getById(id),
  })

  const statusMutation = useMutation({
    mutationFn: (status) => userService.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', id] })
      toast({ title: 'Success', description: 'User status updated.', variant: 'success' })
      setConfirmAction(null)
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!user) return <div className="text-center py-12">User not found</div>

  const remainingDays = getRemainingDays(user.subscriptionEnd)
  const progress = getSubscriptionProgress(user.subscriptionStart, user.subscriptionEnd)

  const handleConfirm = () => {
    if (!confirmAction) return
    statusMutation.mutate(confirmAction.status)
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate('/users')} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Back to Users
      </Button>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="gradient-bg text-white text-2xl">{getInitials(user.name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-bold">{user.name}</h1>
                  <Badge variant="secondary" className="capitalize">{user.role}</Badge>
                  <StatusBadge status={user.status} />
                </div>
                <p className="text-muted-foreground mt-1">{user.company}</p>
                <p className="text-sm text-muted-foreground mt-1">Joined {formatDate(user.registrationDate)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {user.status === 'pending' && (
                  <>
                    <Button onClick={() => setConfirmAction({ status: 'active', label: 'Approve' })}>
                      <CheckCircle className="mr-2 h-4 w-4" /> Approve
                    </Button>
                    <Button variant="destructive" onClick={() => setConfirmAction({ status: 'rejected', label: 'Reject' })}>
                      Reject
                    </Button>
                  </>
                )}
                {user.status === 'active' && (
                  <Button variant="outline" onClick={() => setConfirmAction({ status: 'suspended', label: 'Suspend' })}>
                    <Ban className="mr-2 h-4 w-4" /> Suspend
                  </Button>
                )}
                {user.status === 'suspended' && (
                  <Button onClick={() => setConfirmAction({ status: 'active', label: 'Activate' })}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Activate
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Personal Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {[
              { icon: Mail, label: 'Email', value: user.email },
              { icon: Phone, label: 'Phone', value: user.phone },
              { icon: MapPin, label: 'Address', value: `${user.address}, ${user.city}, ${user.state}` },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-3">
                <Icon className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-sm font-medium">{value}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Business Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {[
              { icon: Building, label: 'Company', value: user.company },
              { label: 'GST Number', value: user.gst },
              { label: 'License Number', value: user.license },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-3">
                {Icon && <Icon className="h-4 w-4 text-muted-foreground mt-0.5" />}
                <div className={!Icon ? 'ml-7' : ''}>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-sm font-medium">{value}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Subscription</CardTitle>
            <span className={cn('text-sm font-semibold capitalize', subStatusColors[user.subscriptionStatus])}>
              {user.subscriptionStatus}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Current Plan</p>
              <p className="text-lg font-bold">{user.plan}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Start Date</p>
              <p className="text-sm font-medium">{user.subscriptionStart ? formatDate(user.subscriptionStart) : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Expiry Date</p>
              <p className="text-sm font-medium">{user.subscriptionEnd ? formatDate(user.subscriptionEnd) : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Remaining Days</p>
              <p className="text-lg font-bold">{remainingDays}</p>
            </div>
          </div>

          {user.subscriptionStart && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subscription Progress</span>
                <span className="font-medium">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          <Separator />

          <div>
            <h4 className="text-sm font-bold mb-3">Payment History</h4>
            <div className="space-y-2">
              {mockPaymentHistory.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium">{payment.plan} Plan</p>
                    <p className="text-xs text-muted-foreground">{formatDate(payment.date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{formatCurrency(payment.amount)}</p>
                    <Badge variant="success" className="text-xs">{payment.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Button variant="outline" onClick={() => setConfirmAction({ status: 'active', label: 'Renew Subscription' })}>
            <RefreshCw className="mr-2 h-4 w-4" /> Renew Subscription
          </Button>
        </CardContent>
      </Card>

      <ConfirmModal
        open={!!confirmAction}
        onOpenChange={() => setConfirmAction(null)}
        title={confirmAction?.label || 'Confirm Action'}
        description={`Are you sure you want to ${confirmAction?.label?.toLowerCase()} ${user.name}?`}
        confirmLabel={confirmAction?.label || 'Confirm'}
        onConfirm={handleConfirm}
        loading={statusMutation.isPending}
      />
    </div>
  )
}
