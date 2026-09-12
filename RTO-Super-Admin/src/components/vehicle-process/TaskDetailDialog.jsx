import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Car, CheckCircle2, ExternalLink, ListTodo } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TaskCommentsPanel } from '@/components/vehicle-process/TaskCommentsPanel'
import { TagChip } from '@/components/vehicle-process/TagChip'
import { processTaskService } from '@/services/processTaskService'
import { cn, formatDate } from '@/lib/utils'

/** A single label/value cell in the ticket detail grid. */
function Detail({ label, children }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="truncate text-sm font-medium">{children}</div>
    </div>
  )
}

/**
 * Task ticket — a shadcn Dialog that opens from a board card or a history row. The main pane shows
 * the task's key details (vehicle, status, assignee, dates) with a shortcut to the parent vehicle
 * process, and hosts the shared per-task comment thread. A right-hand side panel lists ALL tasks on
 * the same vehicle (regardless of the board's filters); clicking one switches the ticket to it.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {object|null} props.task a task DTO ({ processTaskId, taskName, taskDate, status, completedAt,
 *   assignUserId, assignUserName, processId, vehicleRegistrationNumber, tags }); null when closed.
 * @param {Array<{userId,userName,emailId}>} [props.users] assignee directory, to name sibling tasks.
 * @param {(task: object) => void} [props.onSelectTask] switch the ticket to a sibling task.
 * @param {string} [props.dealerId] target dealer for a managing caller (agent/super-admin).
 */
export function TaskDetailDialog({
  open,
  onOpenChange,
  task,
  users = [],
  onSelectTask,
  dealerId,
}) {
  const navigate = useNavigate()

  // All tasks on this vehicle/process — independent of the board's assignee/status filters.
  const { data: siblings = [] } = useQuery({
    queryKey: ['process-tasks', 'by-process', task?.processId, dealerId],
    queryFn: () => processTaskService.getByProcess(task.processId, dealerId),
    enabled: open && !!task?.processId,
  })

  if (!task) return null

  const usersById = new Map(users.map((u) => [u.userId, u.userName || u.emailId]))

  const openVehicle = () => {
    onOpenChange?.(false)
    navigate(`/dealer/processes/${task.processId}`)
  }

  const selectSibling = (s) => {
    if (s.processTaskId === task.processTaskId) return
    // Siblings share the same vehicle & process, so carry those fields (incl. the vehicle's tags)
    // onto the board-shaped task and resolve the assignee name from the directory.
    onSelectTask?.({
      ...s,
      vehicleRegistrationNumber: task.vehicleRegistrationNumber,
      tags: task.tags,
      assignUserName: usersById.get(s.assignUserId) ?? null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl md:max-w-4xl md:flex-row">
        {/* Main pane: details + comments */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <DialogHeader className="shrink-0 space-y-4 border-b border-border p-6 pb-4 text-left">
            <div className="space-y-1.5 pr-8">
              <DialogTitle className="text-xl">{task.taskName}</DialogTitle>
              <DialogDescription className="sr-only">Task details and comments</DialogDescription>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              <Detail label="Vehicle">{task.vehicleRegistrationNumber || '—'}</Detail>
              <Detail label="Status">
                <Badge variant="outline" className="font-medium">{task.status || '—'}</Badge>
              </Detail>
              <Detail label="Assignee">{task.assignUserName || 'Unassigned'}</Detail>
              <Detail label="Due">{task.taskDate ? formatDate(task.taskDate) : '—'}</Detail>
              <Detail label="Completed">{task.completedAt ? formatDate(task.completedAt) : '—'}</Detail>
            </div>

            {Array.isArray(task.tags) && task.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {task.tags.map((t) => (
                  <TagChip key={t.tagId} name={t.tagName} colour={t.colour} />
                ))}
              </div>
            )}

            <div>
              <Button variant="outline" size="sm" onClick={openVehicle}>
                <Car className="mr-2 h-4 w-4" />
                Open vehicle
                <ExternalLink className="ml-2 h-3.5 w-3.5" />
              </Button>
            </div>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <TaskCommentsPanel
              key={task.processTaskId}
              taskId={task.processTaskId}
              dealerId={dealerId}
              fill
              className="h-full border-0 shadow-none"
            />
          </div>
        </div>

        {/* Side panel: all tasks on this vehicle */}
        <aside className="flex max-h-56 shrink-0 flex-col overflow-hidden border-t border-border md:max-h-none md:w-72 md:border-l md:border-t-0">
          <div className="shrink-0 border-b border-border px-4 py-3 pr-8">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <ListTodo className="h-4 w-4 text-muted-foreground" />
              Tasks on this vehicle
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {(task.vehicleRegistrationNumber || '—') + ' · ' + siblings.length}
            </p>
          </div>
          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">
            {siblings.map((s) => {
              const active = s.processTaskId === task.processTaskId
              const assignee = usersById.get(s.assignUserId)
              return (
                <button
                  key={s.processTaskId}
                  type="button"
                  disabled={active}
                  onClick={() => selectSibling(s)}
                  className={cn(
                    'w-full rounded-lg border p-2.5 text-left transition-colors',
                    active
                      ? 'border-primary bg-primary/5'
                      : 'cursor-pointer border-border bg-card hover:bg-muted/50'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm font-medium">{s.taskName}</p>
                    {s.completedAt && <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <Badge variant="outline" className="text-[10px]">{s.status || '—'}</Badge>
                    {s.taskDate && (
                      <span className="shrink-0 text-[11px] text-muted-foreground">{formatDate(s.taskDate)}</span>
                    )}
                  </div>
                  {assignee && <p className="mt-1 truncate text-[11px] text-muted-foreground">{assignee}</p>}
                </button>
              )
            })}
            {siblings.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">No other tasks on this vehicle.</p>
            )}
          </div>
        </aside>
      </DialogContent>
    </Dialog>
  )
}
