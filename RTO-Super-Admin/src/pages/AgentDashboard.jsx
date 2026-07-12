import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ClipboardList, ListChecks, Building2, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { processAssignmentService } from '@/services/processAssignmentService'

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

function dealerNameOf(row) {
  return row?.process?.dealer?.firmName ?? 'Unknown'
}

function statusNameOf(row) {
  return row?.agentStatus?.statusName ?? 'Unassigned'
}

export default function AgentDashboard() {
  const navigate = useNavigate()

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['agent-assignments'],
    queryFn: () => processAssignmentService.listForAgent(),
  })

  const total = assignments.length

  const byStatus = useMemo(() => {
    const map = new Map()
    for (const row of assignments) {
      const name = statusNameOf(row)
      const colour = row?.agentStatus?.colour ?? null
      const existing = map.get(name) ?? { name, colour, count: 0 }
      existing.count += 1
      map.set(name, existing)
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count)
  }, [assignments])

  const byDealer = useMemo(() => {
    const map = new Map()
    for (const row of assignments) {
      const name = dealerNameOf(row)
      map.set(name, (map.get(name) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [assignments])

  const stats = [
    { icon: ClipboardList, label: 'Total Assignments', value: total },
    { icon: ListChecks, label: 'Status Buckets', value: byStatus.length },
    { icon: Building2, label: 'Source Dealers', value: byDealer.length },
  ]

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of the RTO work assigned to you</p>
        </div>
        <Button onClick={() => navigate('/agent/assignments')}>
          View assignments <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </motion.div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat, index) => (
            <StatTile key={stat.label} index={index} {...stat} />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By Status</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            ) : byStatus.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No assignments yet. Work assigned to you will appear here.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {byStatus.map((bucket) => (
                  <div key={bucket.name} className="flex items-center justify-between py-3">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {bucket.colour && (
                        <span
                          className="h-2.5 w-2.5 rounded-full border border-border"
                          style={{ backgroundColor: bucket.colour }}
                        />
                      )}
                      {bucket.name}
                    </span>
                    <Badge variant="secondary">{bucket.count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">By Source Dealer</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            ) : byDealer.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No source dealers yet.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {byDealer.map((dealer) => (
                  <div key={dealer.name} className="flex items-center justify-between py-3">
                    <span className="truncate text-sm font-medium">{dealer.name}</span>
                    <Badge variant="secondary">{dealer.count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
