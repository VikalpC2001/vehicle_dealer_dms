import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { CreditCard, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { StatusBadge } from '@/components/common/StatusBadge'
import { userService } from '@/services/userService'
import { formatDate, cn } from '@/lib/utils'

function getRemainingDays(end) {
  if (!end) return 0
  return Math.max(0, Math.ceil((new Date(end) - Date.now()) / 86400000))
}

function getProgress(start, end) {
  if (!start || !end) return 0
  const total = new Date(end) - new Date(start)
  const elapsed = Date.now() - new Date(start)
  return Math.min(100, Math.max(0, (elapsed / total) * 100))
}

const statusIcons = {
  active: CheckCircle,
  expiring: AlertTriangle,
  expired: XCircle,
}

export default function Subscriptions() {
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users', 'subscriptions'],
    queryFn: () => userService.getAll(),
  })

  const subscribed = users.filter((u) => u.subscriptionStart)
  const stats = {
    active: subscribed.filter((u) => u.subscriptionStatus === 'active').length,
    expiring: subscribed.filter((u) => u.subscriptionStatus === 'expiring').length,
    expired: subscribed.filter((u) => u.subscriptionStatus === 'expired').length,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Subscriptions</h1>
        <p className="text-muted-foreground mt-1">Monitor and manage user subscription plans</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Active', count: stats.active, color: 'text-success', icon: CheckCircle },
          { label: 'Expiring Soon', count: stats.expiring, color: 'text-warning', icon: AlertTriangle },
          { label: 'Expired', count: stats.expired, color: 'text-destructive', icon: XCircle },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card>
              <CardContent className="flex items-center gap-4 p-6">
                <stat.icon className={cn('h-8 w-8', stat.color)} />
                <div>
                  <p className="text-2xl font-bold">{stat.count}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">Loading subscriptions...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {subscribed.map((user, i) => {
            const Icon = statusIcons[user.subscriptionStatus] || CreditCard
            const remaining = getRemainingDays(user.subscriptionEnd)
            const progress = getProgress(user.subscriptionStart, user.subscriptionEnd)

            return (
              <motion.div key={user.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{user.name}</CardTitle>
                      <StatusBadge status={user.subscriptionStatus} />
                    </div>
                    <p className="text-sm text-muted-foreground">{user.company} · {user.plan} Plan</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Start</p>
                        <p className="font-medium">{formatDate(user.subscriptionStart)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Expiry</p>
                        <p className="font-medium">{formatDate(user.subscriptionEnd)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Days Left</p>
                        <p className="font-bold">{remaining}</p>
                      </div>
                    </div>
                    <Progress value={progress} />
                    <div className="flex items-center gap-2">
                      <Icon className={cn('h-4 w-4', user.subscriptionStatus === 'active' ? 'text-success' : user.subscriptionStatus === 'expiring' ? 'text-warning' : 'text-destructive')} />
                      <Badge variant="secondary" className="capitalize">{user.role}</Badge>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
