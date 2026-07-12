import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Activity } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { SearchInput } from '@/components/common/SearchInput'
import { EmptyState } from '@/components/common/EmptyState'
import { TableToolbarSearch } from '@/components/tables/TableToolbar'
import { TableLoadingSkeleton } from '@/components/tables/TableLoadingSkeleton'
import { dashboardService } from '@/services/dashboardService'
import { formatDateTime } from '@/lib/utils'
import { useState } from 'react'
import { useDebounce } from '@/hooks/useDebounce'

export default function ActivityLogs() {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['activity-logs'],
    queryFn: () => dashboardService.getActivityLogs(),
  })

  const filtered = logs.filter((log) => {
    if (!debouncedSearch) return true
    const q = debouncedSearch.toLowerCase()
    return log.action.toLowerCase().includes(q) || log.user.toLowerCase().includes(q) || log.admin.toLowerCase().includes(q)
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Activity Logs</h1>
          <p className="text-muted-foreground mt-1">Track all admin actions and system events</p>
        </div>
        <TableToolbarSearch className="w-full md:w-72">
          <SearchInput value={search} onChange={setSearch} placeholder="Search logs..." />
        </TableToolbarSearch>
      </div>

      {isLoading ? (
        <TableLoadingSkeleton rows={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No activity logs found"
          description={debouncedSearch ? 'Try a different search term.' : 'Activity will appear here as actions are logged.'}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((log, i) => (
            <motion.div key={log.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <Card>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <Activity className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{log.action}</p>
                    <p className="text-xs text-muted-foreground">User: {log.user} · Admin: {log.admin}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(log.date)}</span>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
