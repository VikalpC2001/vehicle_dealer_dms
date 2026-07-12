import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Store, UserCheck, CreditCard, Clock, Plus, FileText, Users, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { StatCard } from '@/components/dashboard/StatCard'
import { DealerGrowthChart } from '@/components/charts/DealerGrowthChart'
import { AgentGrowthChart } from '@/components/charts/AgentGrowthChart'
import { RevenueChart } from '@/components/charts/RevenueChart'
import { RegistrationChart } from '@/components/charts/RegistrationChart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { dashboardService } from '@/services/dashboardService'
import { useAuth } from '@/context/AuthContext'
import { formatDateTime } from '@/lib/utils'

const quickActions = [
  { label: 'Manage Users', icon: Users, path: '/users', color: 'gradient-bg' },
  { label: 'View Requests', icon: FileText, path: '/requests', color: 'bg-success' },
  { label: 'Subscriptions', icon: CreditCard, path: '/subscriptions', color: 'bg-warning' },
  { label: 'Settings', icon: Settings, path: '/settings', color: 'bg-accent' },
]

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const now = new Date()

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => dashboardService.getStats(),
  })

  const { data: dealerGrowth } = useQuery({
    queryKey: ['dashboard', 'dealer-growth'],
    queryFn: () => dashboardService.getDealerGrowth(),
  })

  const { data: agentGrowth } = useQuery({
    queryKey: ['dashboard', 'agent-growth'],
    queryFn: () => dashboardService.getAgentGrowth(),
  })

  const { data: revenue } = useQuery({
    queryKey: ['dashboard', 'revenue'],
    queryFn: () => dashboardService.getRevenue(),
  })

  const { data: registrations } = useQuery({
    queryKey: ['dashboard', 'registrations'],
    queryFn: () => dashboardService.getRegistrations(),
  })

  const { data: activityLogs } = useQuery({
    queryKey: ['dashboard', 'activity'],
    queryFn: () => dashboardService.getActivityLogs(),
  })

  const kpiCards = stats ? [
    { title: 'Total Dealers', value: stats.totalDealers.count, growth: stats.totalDealers.growth, icon: Store },
    { title: 'Total Agents', value: stats.totalAgents.count, growth: stats.totalAgents.growth, icon: UserCheck },
    { title: 'Active Subscriptions', value: stats.activeSubscriptions.count, growth: stats.activeSubscriptions.growth, icon: CreditCard },
    { title: 'Pending Requests', value: stats.pendingRequests.count, growth: stats.pendingRequests.growth, icon: Clock },
  ] : []

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Welcome Back, {user?.name}</h1>
          <p className="mt-1 text-muted-foreground">{formatDateTime(now)}</p>
        </div>
        <Button onClick={() => navigate('/users')}>
          <Plus className="mr-2 h-4 w-4" /> Quick Action
        </Button>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
        {statsLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)
          : kpiCards.map((card, i) => <StatCard key={card.title} {...card} index={i} />)
        }
      </div>

      <div>
        <h2 className="text-lg font-bold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickActions.map((action, i) => (
            <motion.button
              key={action.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ scale: 1.02 }}
              onClick={() => navigate(action.path)}
              className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-md cursor-pointer"
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${action.color} text-white`}>
                <action.icon className="h-6 w-6" />
              </div>
              <span className="text-sm font-medium">{action.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {dealerGrowth && <DealerGrowthChart data={dealerGrowth} />}
        {agentGrowth && <AgentGrowthChart data={agentGrowth} />}
        {revenue && <RevenueChart data={revenue} />}
        {registrations && <RegistrationChart data={registrations} />}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {activityLogs?.slice(0, 5).map((log, i) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between py-2 border-b border-border last:border-0"
              >
                <div>
                  <p className="text-sm font-medium">{log.action}</p>
                  <p className="text-xs text-muted-foreground">{log.user} · by {log.admin}</p>
                </div>
                <span className="text-xs text-muted-foreground">{formatDateTime(log.date)}</span>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
