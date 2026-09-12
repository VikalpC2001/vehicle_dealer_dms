import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TaskNameAutocomplete } from './TaskNameAutocomplete'
import { ProcessSearchSelect } from './ProcessSearchSelect'
import { dealerTaskStatusService } from '@/services/dealerTaskStatusService'
import { taskTemplateService } from '@/services/taskTemplateService'
import { parseValidationErrors } from '@/lib/authErrors'

/** Standard task statuses offered in the UI (the backend stores a free string). */
export const TASK_STATUSES = ['To-Do', 'In Progress', 'Done']

const UNASSIGNED = '__unassigned__'

export const taskSchema = z.object({
  taskName: z.string().min(1, 'Task name is required').max(512),
  taskDate: z.string().min(1, 'Date is required'),
  assignUserId: z.string().optional().or(z.literal('')),
  status: z.string().min(1),
  // Only used in "picker" mode (creating a task from the board / vehicle list, where the process
  // isn't already in context). Ignored in the per-process usage.
  processId: z.string().optional().or(z.literal('')),
})

export const defaultTaskValues = {
  taskName: '',
  taskDate: '',
  assignUserId: '',
  status: 'To-Do',
  processId: '',
}

/** Local (not UTC) YYYY-MM-DD for the native date input — avoids an off-by-one near midnight. */
function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Add/edit a process task. Submits `{ taskName, taskDate, assignUserId|null, status }`.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {string} props.title
 * @param {object} [props.defaultValues]
 * @param {Array<{userId,userName,emailId}>} [props.users] - Assignee options.
 * @param {string} [props.dealerId] - Managed dealer scope; drives the task-status + job-template lists.
 * @param {boolean} [props.vehiclePicker] - When true, shows a server-searchable "Vehicle" picker (for
 *   creating a task from the board / vehicle list) and includes `processId` in the submit.
 * @param {(values: object) => Promise<void>} props.onSubmit
 * @param {boolean} [props.loading]
 * @param {string} [props.submitLabel]
 */
export function TaskFormDialog({
  open,
  onOpenChange,
  title,
  defaultValues,
  users = [],
  dealerId,
  vehiclePicker = false,
  onSubmit,
  loading,
  submitLabel = 'Save',
}) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(taskSchema),
    defaultValues: { ...defaultTaskValues, taskDate: todayISO(), ...defaultValues },
  })

  useEffect(() => {
    // Prefill today's date for a new task; keep the existing date when editing.
    const merged = { ...defaultTaskValues, ...defaultValues }
    reset({ ...merged, taskDate: merged.taskDate || todayISO() })
  }, [defaultValues, reset, open])

  const assignUserId = watch('assignUserId')
  const status = watch('status')
  const processId = watch('processId')
  const taskName = watch('taskName')
  const showVehiclePicker = vehiclePicker

  // The dealer's task-board columns drive the status options (ProcessTask.status is a free string
  // matched by name). Fall back to the standard trio when the dealer has none configured yet.
  const { data: taskStatuses = [] } = useQuery({
    queryKey: ['dealer-task-statuses', dealerId],
    queryFn: () => dealerTaskStatusService.getAll(dealerId),
  })

  // For a NEW task, snap the default status to the dealer's first configured column once it loads.
  // Editing keeps the task's own status (early return); with no catalog it stays the 'To-Do' fallback.
  useEffect(() => {
    if (defaultValues?.status) return
    const names = taskStatuses.map((s) => s.statusName).filter(Boolean)
    if (names.length && !names.includes(status)) setValue('status', names[0])
  }, [taskStatuses, defaultValues, status, setValue])

  const statusOptions = useMemo(() => {
    const names = taskStatuses.map((s) => s.statusName).filter(Boolean)
    const base = names.length ? names : TASK_STATUSES
    // Keep the current value selectable even if it's a legacy/custom status not in the list.
    return status && !base.includes(status) ? [status, ...base] : base
  }, [taskStatuses, status])

  // The dealer's job templates become autocomplete suggestions for the Task field.
  const { data: templates = [] } = useQuery({
    queryKey: ['task-templates', dealerId],
    queryFn: () => taskTemplateService.getAll(dealerId),
  })

  const handleFormSubmit = async (values) => {
    if (showVehiclePicker && !values.processId) {
      setError('processId', { message: 'Select a vehicle' })
      return
    }
    // Strip the internal picker field; only include processId when the picker is in use.
    const { processId: pickedProcessId, ...rest } = values
    const payload = { ...rest, assignUserId: rest.assignUserId || null }
    if (showVehiclePicker) payload.processId = pickedProcessId
    try {
      await onSubmit(payload)
    } catch (err) {
      const fieldErrors = parseValidationErrors(err)
      Object.entries(fieldErrors).forEach(([field, message]) => setError(field, { message }))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>e.g. "Make insurance", "Make PUC".</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          {showVehiclePicker && (
            <div className="space-y-2">
              <Label htmlFor="processId">Vehicle</Label>
              <ProcessSearchSelect
                id="processId"
                value={processId || ''}
                onChange={(v) => setValue('processId', v, { shouldValidate: true })}
                dealerId={dealerId}
              />
              {errors.processId && <p className="text-sm text-destructive">{errors.processId.message}</p>}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="taskName">Task</Label>
            <TaskNameAutocomplete
              id="taskName"
              value={taskName}
              onChange={(v) => setValue('taskName', v, { shouldValidate: true })}
              suggestions={templates.map((t) => t.templateName).filter(Boolean)}
              placeholder="Type a task — e.g. Make PUC"
            />
            {errors.taskName && <p className="text-sm text-destructive">{errors.taskName.message}</p>}
            {templates.length > 0 && (
              <p className="text-xs text-muted-foreground">Start typing to pick a saved job, or enter a custom task.</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="taskDate">Due date</Label>
              <Input id="taskDate" type="date" {...register('taskDate')} />
              {errors.taskDate && <p className="text-sm text-destructive">{errors.taskDate.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(v) => setValue('status', v)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assignUserId">Assign to</Label>
            <Select
              value={assignUserId || UNASSIGNED}
              onValueChange={(v) => setValue('assignUserId', v === UNASSIGNED ? '' : v)}
            >
              <SelectTrigger id="assignUserId">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.userId} value={u.userId}>
                    {u.userName} ({u.emailId})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : submitLabel}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
