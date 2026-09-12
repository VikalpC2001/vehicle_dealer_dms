import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { CheckCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DataTable } from '@/components/tables/DataTable'
import { TaskDetailDialog } from '@/components/vehicle-process/TaskDetailDialog'
import { processTaskService } from '@/services/processTaskService'
import { dealerUserService } from '@/services/dealerUserService'
import { useCapabilities } from '@/hooks/useCapabilities'
import { PAGE_SIZE } from '@/lib/pagination'
import { formatDate } from '@/lib/utils'

const HISTORY_PAGE_SIZE = PAGE_SIZE.crud
const ALL = '__all__'

export default function TaskHistory() {
  const { can, isLoading: capsLoading } = useCapabilities()

  const [page, setPage] = useState(1)
  const [assignee, setAssignee] = useState(ALL)
  const [mine, setMine] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)

  // Land employees on their own completed tasks: default "My tasks" ON when the user lacks
  // `tasks.viewAll` (once capabilities have loaded). Applied once so it never fights a manual toggle.
  const defaultScopeApplied = useRef(false)
  useEffect(() => {
    if (defaultScopeApplied.current || capsLoading) return
    defaultScopeApplied.current = true
    setMine(!can('tasks.viewAll'))
  }, [capsLoading, can])

  // `mine` overrides the assignee filter (matches the backend contract).
  const filters = {
    assignUserId: mine || assignee === ALL ? undefined : assignee,
    mine: mine || undefined,
  }

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['task-history', page, HISTORY_PAGE_SIZE, filters],
    queryFn: () => processTaskService.getHistory({ ...filters, page, limit: HISTORY_PAGE_SIZE }),
  })

  const tasks = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1

  const { data: dealerUsers = [] } = useQuery({
    queryKey: ['dealer-users'],
    queryFn: () => dealerUserService.getAll(),
  })

  const users = useMemo(
    () => dealerUsers.map((d) => d.user).filter(Boolean),
    [dealerUsers]
  )

  const changeAssignee = (value) => {
    setAssignee(value)
    setPage(1)
  }

  const changeMine = (value) => {
    setMine(value)
    setPage(1)
  }

  const columns = useMemo(
    () => [
      {
        key: 'taskName',
        label: 'Task',
        render: (row) => <span className="font-semibold">{row.taskName}</span>,
      },
      { key: 'vehicleRegistrationNumber', label: 'Vehicle' },
      {
        key: 'status',
        label: 'Status',
        render: (row) => <Badge variant="outline">{row.status || '—'}</Badge>,
      },
      {
        key: 'assignUserName',
        label: 'Assignee',
        render: (row) => row.assignUserName || '—',
      },
      {
        key: 'completedAt',
        label: 'Completed',
        render: (row) => (row.completedAt ? formatDate(row.completedAt) : '—'),
      },
    ],
    []
  )

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold">Task History</h1>
          <p className="text-muted-foreground mt-1">Completed tasks across all your vehicle processes</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={assignee} onValueChange={changeAssignee} disabled={mine}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All assignees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All assignees</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.userId} value={u.userId}>
                  {u.userName || u.emailId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <Switch checked={mine} onCheckedChange={changeMine} aria-label="My tasks" />
            My tasks
          </label>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-bg">
              <CheckCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold">{total}</p>
              <p className="text-sm text-muted-foreground">Completed Tasks</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <DataTable
        mode="server"
        columns={columns}
        data={tasks}
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={HISTORY_PAGE_SIZE}
        onPageChange={setPage}
        isLoading={isLoading}
        isFetching={isFetching}
        itemLabel="tasks"
        emptyTitle="No completed tasks"
        emptyDescription="Completed tasks will appear here once your team marks tasks done."
        showExport={false}
        selectable={false}
        onRowClick={setSelectedTask}
        getRowId={(row) => row.processTaskId}
      />

      <TaskDetailDialog
        open={!!selectedTask}
        onOpenChange={(open) => !open && setSelectedTask(null)}
        task={selectedTask}
        users={users}
        onSelectTask={setSelectedTask}
      />
    </div>
  )
}
