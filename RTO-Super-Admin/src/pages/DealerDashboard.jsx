import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Car, Tags, Tag, CalendarDays, Plus, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TagChip } from '@/components/vehicle-process/TagChip'
import { vehicleProcessService, getProcessId } from '@/services/vehicleProcessService'
import { formatDate } from '@/lib/utils'

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

  const stats = useMemo(() => {
    const tagged = processes.filter((p) => (p.tags ?? []).length > 0).length
    const now = new Date()
    const thisMonth = processes.filter((p) => {
      if (!p.processDate) return false
      const d = new Date(p.processDate)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length
    return [
      { icon: Car, label: 'Total Processes', value: total },
      { icon: Tags, label: 'Tagged', value: tagged },
      // Base "Untagged" on the server total so Tagged + Untagged == Total. (Both `tagged` and the
      // month count are derived from the first 100 rows — see the wide-page fetch above — so for
      // >100 processes this split is approximate until a dedicated stats endpoint exists.)
      { icon: Tag, label: 'Untagged', value: Math.max(0, total - tagged) },
      { icon: CalendarDays, label: 'Added This Month', value: thisMonth },
    ]
  }, [processes, total])

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
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{reg}</p>
                        {proc.processDate && (
                          <p className="text-xs text-muted-foreground">{formatDate(proc.processDate)}</p>
                        )}
                      </div>
                      {(proc.tags ?? []).length > 0 ? (
                        <div className="flex max-w-[55%] flex-wrap justify-end gap-1">
                          {proc.tags.map((t) => (
                            <TagChip key={t.tagId} name={t.tagName} colour={t.colour} />
                          ))}
                        </div>
                      ) : (
                        <span className="shrink-0 text-xs text-muted-foreground">No tags</span>
                      )}
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
