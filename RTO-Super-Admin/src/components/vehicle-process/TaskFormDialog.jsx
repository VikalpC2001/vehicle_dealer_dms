import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
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
import { parseValidationErrors } from '@/lib/authErrors'

/** Standard task statuses offered in the UI (the backend stores a free string). */
export const TASK_STATUSES = ['To-Do', 'In Progress', 'Done']

const UNASSIGNED = '__unassigned__'

export const taskSchema = z.object({
  taskName: z.string().min(1, 'Task name is required').max(512),
  taskDate: z.string().min(1, 'Date is required'),
  assignUserId: z.string().optional().or(z.literal('')),
  status: z.string().min(1),
})

export const defaultTaskValues = {
  taskName: '',
  taskDate: '',
  assignUserId: '',
  status: 'To-Do',
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
    defaultValues: { ...defaultTaskValues, ...defaultValues },
  })

  useEffect(() => {
    reset({ ...defaultTaskValues, ...defaultValues })
  }, [defaultValues, reset, open])

  const assignUserId = watch('assignUserId')
  const status = watch('status')

  const handleFormSubmit = async (values) => {
    try {
      await onSubmit({
        ...values,
        assignUserId: values.assignUserId || null,
      })
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
          <div className="space-y-2">
            <Label htmlFor="taskName">Task</Label>
            <Input id="taskName" placeholder="Make insurance" {...register('taskName')} />
            {errors.taskName && <p className="text-sm text-destructive">{errors.taskName.message}</p>}
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
                  {TASK_STATUSES.map((s) => (
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
