import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, User as UserIcon, CalendarDays } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ConfirmModal } from '@/components/modals/ConfirmModal'
import { TaskFormDialog, TASK_STATUSES } from './TaskFormDialog'
import { processTaskService } from '@/services/processTaskService'
import { dealerTaskStatusService } from '@/services/dealerTaskStatusService'
import { dealerUserService } from '@/services/dealerUserService'
import { getErrorMessage } from '@/lib/authErrors'
import { formatDate } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'

function getTaskId(task) {
  return task?.processTaskId ?? task?.id
}

/** Builds the PATCH body for a task, overriding only the given fields. */
function taskPatch(task, overrides) {
  return {
    taskName: task.taskName,
    taskDate: task.taskDate,
    assignUserId: task.assignUserId ?? null,
    status: task.status ?? 'To-Do',
    ...overrides,
  }
}

/**
 * Lists and manages tasks for a process (create/assign/status/edit/delete).
 *
 * @param {object} props
 * @param {string} props.processId
 * @param {string} [props.dealerId] - Managed dealer scope when an agent edits a placeholder's process.
 */
export function TasksPanel({ processId, dealerId }) {
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [editTask, setEditTask] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['process-tasks', processId],
    queryFn: () => processTaskService.getByProcess(processId, dealerId),
    enabled: Boolean(processId),
  })

  // Assignee list is the dealer's own users (dealer-scoped, token-based). It has no meaning for an
  // agent working a placeholder dealer (which has no login users), so skip it in agent mode — tasks
  // can still be created/edited unassigned.
  const { data: dealerUsers = [] } = useQuery({
    queryKey: ['dealer-wise-users'],
    queryFn: () => dealerUserService.getAll(),
    enabled: !dealerId,
  })

  // The dealer's task-board columns drive the status list; fall back to the standard trio.
  const { data: taskStatuses = [] } = useQuery({
    queryKey: ['dealer-task-statuses', dealerId],
    queryFn: () => dealerTaskStatusService.getAll(dealerId),
  })
  const statusNames = useMemo(() => {
    const names = taskStatuses.map((s) => s.statusName).filter(Boolean)
    return names.length ? names : TASK_STATUSES
  }, [taskStatuses])

  const users = useMemo(() => dealerUsers.map((d) => d.user).filter(Boolean), [dealerUsers])
  const userNameById = useMemo(() => {
    const map = {}
    users.forEach((u) => {
      map[u.userId] = u.userName
    })
    return map
  }, [users])

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['process-tasks', processId] })

  const createMutation = useMutation({
    mutationFn: (values) => processTaskService.create({ ...values, processId }, dealerId),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Task added', variant: 'success' })
      setAddOpen(false)
    },
    onError: (err) => toast({ title: 'Failed to add task', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }) => processTaskService.update(id, values, dealerId),
    onSuccess: () => {
      invalidate()
      setEditTask(null)
    },
    onError: (err) => toast({ title: 'Failed to update task', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => processTaskService.remove(id, dealerId),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Task deleted', variant: 'success' })
      setDeleteTarget(null)
    },
    onError: (err) => toast({ title: 'Failed to delete task', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const changeStatus = (task, status) =>
    updateMutation.mutate({ id: getTaskId(task), values: taskPatch(task, { status }) })

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Tasks</CardTitle>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Add Task
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks yet. Add one like "Make insurance".</p>
        ) : (
          <div className="divide-y divide-border">
            {tasks.map((task) => (
              <div key={getTaskId(task)} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{task.taskName}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {task.taskDate && (
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" /> {formatDate(task.taskDate)}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <UserIcon className="h-3.5 w-3.5" />
                      {task.assignUserId ? userNameById[task.assignUserId] ?? 'Assigned' : 'Unassigned'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Select value={task.status ?? 'To-Do'} onValueChange={(v) => changeStatus(task, v)}>
                    <SelectTrigger className="h-8 w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(task.status && !statusNames.includes(task.status)
                        ? [task.status, ...statusNames]
                        : statusNames
                      ).map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" onClick={() => setEditTask(task)} aria-label="Edit task">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(task)} aria-label="Delete task">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <TaskFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add Task"
        users={users}
        dealerId={dealerId}
        onSubmit={(values) => createMutation.mutateAsync(values)}
        loading={createMutation.isPending}
        submitLabel="Add Task"
      />

      <TaskFormDialog
        open={Boolean(editTask)}
        onOpenChange={(open) => !open && setEditTask(null)}
        title="Edit Task"
        users={users}
        dealerId={dealerId}
        defaultValues={
          editTask
            ? {
                taskName: editTask.taskName,
                taskDate: editTask.taskDate ? String(editTask.taskDate).slice(0, 10) : '',
                assignUserId: editTask.assignUserId ?? '',
                status: editTask.status ?? 'To-Do',
              }
            : undefined
        }
        onSubmit={(values) => updateMutation.mutateAsync({ id: getTaskId(editTask), values })}
        loading={updateMutation.isPending}
        submitLabel="Save Changes"
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete task"
        description={`Delete "${deleteTarget?.taskName ?? 'this task'}"?`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteMutation.mutate(getTaskId(deleteTarget))}
        loading={deleteMutation.isPending}
      />
    </Card>
  )
}
