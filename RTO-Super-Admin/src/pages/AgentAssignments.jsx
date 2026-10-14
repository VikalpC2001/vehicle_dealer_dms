import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Building2, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common/EmptyState'
import { AgentStatusPill } from '@/components/vehicle-process/AgentStatusPill'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { processAssignmentService } from '@/services/processAssignmentService'

const ALL_DEALERS = '__all__'

function dealerNameOf(row) {
  return row?.process?.dealer?.firmName ?? 'Unknown'
}

function registrationOf(row) {
  return row?.process?.vehicle?.registrationNumber ?? '—'
}

function serviceLabelOf(row) {
  return row?.service?.shortName ?? row?.service?.serviceName ?? '—'
}

export default function AgentAssignments() {
  const navigate = useNavigate()
  const [dealerFilter, setDealerFilter] = useState(ALL_DEALERS)

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['agent-assignments'],
    queryFn: () => processAssignmentService.listForAgent(),
  })

  const dealerOptions = useMemo(() => {
    const names = new Set(assignments.map(dealerNameOf))
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [assignments])

  const visible = useMemo(() => {
    if (dealerFilter === ALL_DEALERS) return assignments
    return assignments.filter((row) => dealerNameOf(row) === dealerFilter)
  }, [assignments, dealerFilter])

  const groups = useMemo(() => {
    const map = new Map()
    for (const row of visible) {
      const name = dealerNameOf(row)
      if (!map.has(name)) map.set(name, [])
      map.get(name).push(row)
    }
    return Array.from(map.entries())
      .map(([name, rows]) => ({ name, rows }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [visible])

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold">Assignments</h1>
          <p className="text-muted-foreground mt-1">RTO work assigned to you, grouped by source dealer</p>
        </div>
        <Select value={dealerFilter} onValueChange={setDealerFilter}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="All dealers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_DEALERS}>All dealers</SelectItem>
            {dealerOptions.map((name) => (
              <SelectItem key={name} value={name}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </motion.div>

      {isLoading ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          title="No assignments yet"
          description="Work assigned to you by dealers will show up here."
        />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <Card key={group.name}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  {group.name}
                </CardTitle>
                <Badge variant="secondary">{group.rows.length}</Badge>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-border">
                  {group.rows.map((row) => (
                    <button
                      key={row.assignmentId}
                      type="button"
                      onClick={() => navigate(`/agent/assignments/${row.assignmentId}`)}
                      className="flex w-full items-center justify-between gap-3 py-3 text-left transition-colors hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{registrationOf(row)}</p>
                        <p className="text-xs text-muted-foreground">{serviceLabelOf(row)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {row.agentStatus ? (
                          <AgentStatusPill status={row.agentStatus} />
                        ) : (
                          <Badge variant="secondary">Unassigned</Badge>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
