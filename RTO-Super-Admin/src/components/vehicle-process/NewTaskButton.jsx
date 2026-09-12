import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TaskFormDialog } from './TaskFormDialog'
import { processTaskService } from '@/services/processTaskService'
import { dealerUserService } from '@/services/dealerUserService'
import { useCapabilities } from '@/hooks/useCapabilities'
import { getErrorMessage } from '@/lib/authErrors'
import { toast } from '@/hooks/use-toast'

/**
 * "New Task" button + dialog with a VEHICLE PICKER — lets a dealer create a task from anywhere (the
 * task board, the vehicle list), not just inside a specific process. Hidden for users without the
 * `tasks.manage` capability. Invalidates the task queries so the board/list refresh.
 *
 * @param {object} props
 * @param {string} [props.variant] - Button variant (default 'outline').
 */
export function NewTaskButton({ variant = 'outline' }) {
  const queryClient = useQueryClient()
  const { can } = useCapabilities()
  const [open, setOpen] = useState(false)

  // The vehicle picker searches server-side (ProcessSearchSelect), so no need to pre-load processes.
  const { data: dealerUsers = [] } = useQuery({
    queryKey: ['dealer-users'],
    queryFn: () => dealerUserService.getAll(),
    enabled: open,
  })
  const users = (dealerUsers ?? []).map((d) => d.user).filter(Boolean)

  const createMutation = useMutation({
    mutationFn: (values) => processTaskService.create(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['process-tasks'] })
      toast({ title: 'Task created', variant: 'success' })
      setOpen(false)
    },
    onError: (err) =>
      toast({ title: 'Could not create task', description: getErrorMessage(err), variant: 'destructive' }),
  })

  if (!can('tasks.manage')) return null

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" /> New Task
      </Button>
      <TaskFormDialog
        open={open}
        onOpenChange={setOpen}
        title="New Task"
        users={users}
        vehiclePicker
        onSubmit={(values) => createMutation.mutateAsync(values)}
        loading={createMutation.isPending}
        submitLabel="Create Task"
      />
    </>
  )
}
