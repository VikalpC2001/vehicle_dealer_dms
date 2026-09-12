import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmptyState } from '@/components/common/EmptyState'
import { TaskKanbanBoard } from '@/components/vehicle-process/TaskKanbanBoard'
import { NewTaskButton } from '@/components/vehicle-process/NewTaskButton'
import { TaskDetailDialog } from '@/components/vehicle-process/TaskDetailDialog'
import { processTaskService } from '@/services/processTaskService'
import { dealerTaskStatusService } from '@/services/dealerTaskStatusService'
import { dealerUserService } from '@/services/dealerUserService'
import { useCapabilities } from '@/hooks/useCapabilities'
import { getErrorMessage } from '@/lib/authErrors'
import { toast } from '@/hooks/use-toast'

const ALL = '__all__'

export default function TaskBoard() {
  const queryClient = useQueryClient()
  const { can, isLoading: capsLoading } = useCapabilities()

  const [assignee, setAssignee] = useState(ALL)
  const [mine, setMine] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)

  // Land employees on their own tasks: default "My tasks" ON when the user lacks `tasks.viewAll`
  // (once capabilities have loaded), OFF when they can see everyone's. Applied once so it never
  // fights the user's manual toggle.
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
  const boardKey = ['process-tasks', 'board', filters]

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: boardKey,
    queryFn: () => processTaskService.getBoard(filters),
  })

  const { data: taskStatuses = [], isLoading: statusesLoading } = useQuery({
    queryKey: ['dealer-task-statuses'],
    queryFn: () => dealerTaskStatusService.getAll(),
  })

  const { data: dealerUsers = [] } = useQuery({
    queryKey: ['dealer-users'],
    queryFn: () => dealerUserService.getAll(),
  })

  const users = useMemo(
    () => dealerUsers.map((d) => d.user).filter(Boolean),
    [dealerUsers]
  )

  const moveMutation = useMutation({
    mutationFn: ({ card, statusName }) =>
      processTaskService.update(card.processTaskId, {
        taskName: card.taskName,
        taskDate: String(card.taskDate).slice(0, 10),
        assignUserId: card.assignUserId || null,
        status: statusName,
      }),
    onMutate: async ({ card, statusName, isDone }) => {
      await queryClient.cancelQueries({ queryKey: boardKey })
      const previous = queryClient.getQueryData(boardKey)
      queryClient.setQueryData(boardKey, (old) =>
        Array.isArray(old)
          ? old.map((t) =>
              t.processTaskId === card.processTaskId
                ? {
                    ...t,
                    status: statusName,
                    completedAt: isDone ? (t.completedAt ?? new Date().toISOString()) : null,
                  }
                : t
            )
          : old
      )
      return { previous }
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(boardKey, ctx.previous)
      toast({ title: 'Could not move task', description: getErrorMessage(err), variant: 'destructive' })
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['process-tasks', 'board'] }),
  })

  const handleMove = (card, statusName) => {
    const target = taskStatuses.find((s) => s.statusName.toLowerCase() === statusName.toLowerCase())
    moveMutation.mutate({ card, statusName, isDone: !!target?.isDone })
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold">Task Board</h1>
          <p className="text-muted-foreground mt-1">Drag a task between columns to change its status</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={assignee} onValueChange={setAssignee} disabled={mine}>
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
            <Switch checked={mine} onCheckedChange={setMine} aria-label="My tasks" />
            My tasks
          </label>

          <NewTaskButton />
        </div>
      </motion.div>

      {isLoading || statusesLoading ? (
        <div className="flex gap-4 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-80 w-72 shrink-0 rounded-xl" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState
          title="No tasks found"
          description="No tasks match the current filters. Create tasks from a vehicle process to see them here."
        />
      ) : (
        <TaskKanbanBoard
          tasks={tasks}
          statuses={taskStatuses}
          onMove={handleMove}
          onCardClick={setSelectedTask}
        />
      )}

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
