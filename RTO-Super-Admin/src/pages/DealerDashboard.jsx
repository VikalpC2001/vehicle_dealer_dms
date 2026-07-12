import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Car, Clock, Loader2, CheckCircle2, Plus, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { vehicleProcessService, getProcessId } from '@/services/vehicleProcessService'
import { formatDate } from '@/lib/utils'

function countByStatus(processes, match) {
  return processes.filter((p) => (p.status ?? '').trim().toLowerCase() === match).length
}

function StatTile({ icon: Icon, label, value, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
    >
      <Card>
        <CardContent className="flex items-center gap-4 p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-bg">
            <Icon className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export default function DealerDashboard() {
  const navigate = useNavigate()

  // Pull a wide page to derive status counts client-side (no dedicated stats endpoint yet).
  const { data, isLoading } = useQuery({
    queryKey: ['vehicle-processes', 'dashboard'],
    queryFn: () => vehicleProcessService.getAll({ page: 1, limit: 100 }),
  })

  const processes = useMemo(() => data?.processes ?? [], [data])
  const total = data?.total ?? 0

  const stats = useMemo(
    () => [
      { icon: Car, label: 'Total Processes', value: total },
      { icon: Clock, label: 'Pending', value: countByStatus(processes, 'pending') },
      { icon: Loader2, label: 'In Progress', value: countByStatus(processes, 'in progress') },
      { icon: CheckCircle2, label: 'Complete', value: countByStatus(processes, 'complete') },
    ],
    [processes, total]
  )

  const recent = processes.slice(0, 5)

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of your vehicle processes</p>
        </div>
        <Button onClick={() => navigate('/dealer/processes/new')}>
          <Plus className="mr-2 h-4 w-4" /> New Process
        </Button>
      </motion.div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <StatTile key={stat.label} index={index} {...stat} />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Recent Processes</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/dealer/processes')}>
              View all
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : recent.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No processes yet. Create your first one to get started.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {recent.map((proc) => {
                  const id = getProcessId(proc)
                  const reg = proc?.vehicle?.registrationNumber ?? proc?.registrationNumber ?? 'Vehicle process'
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => id && navigate(`/dealer/processes/${id}`)}
                      className="flex w-full items-center justify-between py-3 text-left transition-colors hover:bg-muted/40"
                    >
                      <div>
                        <p className="text-sm font-semibold">{reg}</p>
                        {proc.processDate && (
                          <p className="text-xs text-muted-foreground">{formatDate(proc.processDate)}</p>
                        )}
                      </div>
                      <Badge variant="secondary">{proc.status ?? 'Pending'}</Badge>
                    </button>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Analytics</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <BarChart3 className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              Trends &amp; charts are coming soon.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
