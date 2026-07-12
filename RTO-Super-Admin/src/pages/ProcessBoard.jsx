import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Plus, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common/EmptyState'
import { ProcessKanbanBoard } from '@/components/vehicle-process/ProcessKanbanBoard'
import { vehicleProcessService, getProcessId } from '@/services/vehicleProcessService'
import { dealerStatusService } from '@/services/dealerStatusService'
import { getErrorMessage } from '@/lib/authErrors'
import { toast } from '@/hooks/use-toast'

const BOARD_LIMIT = 100

export default function ProcessBoard() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['vehicle-processes', 'board', BOARD_LIMIT],
    queryFn: () => vehicleProcessService.getAll({ page: 1, limit: BOARD_LIMIT }),
  })

  const { data: statuses = [] } = useQuery({
    queryKey: ['dealer-statuses'],
    queryFn: () => dealerStatusService.getAll(),
  })

  const processes = data?.processes ?? []
  const total = data?.total ?? 0

  const moveMutation = useMutation({
    mutationFn: ({ process, status }) => vehicleProcessService.updateStatusFromProcess(process, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-processes'] })
      toast({ title: 'Status updated', variant: 'success' })
    },
    onError: (err) => toast({ title: 'Could not change status', description: getErrorMessage(err), variant: 'destructive' }),
  })

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold">Status Board</h1>
          <p className="text-muted-foreground mt-1">Drag a process between columns to change its status</p>
        </div>
        <Button onClick={() => navigate('/dealer/processes/new')}>
          <Plus className="mr-2 h-4 w-4" /> New Process
        </Button>
      </motion.div>

      {isLoading ? (
        <div className="flex gap-4 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-80 w-72 shrink-0 rounded-xl" />
          ))}
        </div>
      ) : processes.length === 0 ? (
        <EmptyState title="No processes yet" description="Create your first process to see it on the board." />
      ) : (
        <>
          {total > BOARD_LIMIT && (
            <div className="flex items-center gap-2 rounded-lg border border-warning/20 bg-warning/10 p-3 text-sm text-muted-foreground">
              <Info className="h-4 w-4 shrink-0 text-warning" />
              Showing the most recent {BOARD_LIMIT} of {total} processes. Use the list view to find older ones.
            </div>
          )}
          <ProcessKanbanBoard
            processes={processes}
            statuses={statuses}
            onMove={(process, status) => moveMutation.mutate({ process, status })}
            onCardClick={(process) => navigate(`/dealer/processes/${getProcessId(process)}`)}
          />
        </>
      )}
    </div>
  )
}
