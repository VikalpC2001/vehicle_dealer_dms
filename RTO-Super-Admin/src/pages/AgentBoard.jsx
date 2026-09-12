import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common/EmptyState'
import { AgentTaskBoard } from '@/components/vehicle-process/AgentTaskBoard'
import { processAssignmentService } from '@/services/processAssignmentService'
import { vehicleProcessService } from '@/services/vehicleProcessService'
import { agentStatusService } from '@/services/agentStatusService'
import { getErrorMessage } from '@/lib/authErrors'
import { toast } from '@/hooks/use-toast'

/** Maps a dealer-assigned assignment row to a unified board card. */
function assignmentToCard(a) {
  return {
    kind: 'assigned',
    key: `a:${a.assignmentId}`,
    id: a.assignmentId,
    agentStatusId: a.agentStatus?.statusId ?? a.agentStatusId ?? null,
    vehicleReg: a.process?.vehicle?.registrationNumber,
    dealerName: a.process?.dealer?.firmName ?? a.process?.dealer?.dealerName,
    serviceName: a.service?.serviceName ?? a.service?.shortName,
    tags: a.process?.tags ?? [],
    linkTo: `/agent/assignments/${a.assignmentId}`,
  }
}

/** Maps an agent-created (placeholder) process row to a unified board card. */
function ownProcessToCard(p) {
  return {
    kind: 'own',
    key: `p:${p.processId}`,
    id: p.processId,
    agentStatusId: p.agentStatus?.statusId ?? p.agentStatusId ?? null,
    vehicleReg: p.vehicle?.registrationNumber,
    dealerName: p.dealer?.firmName,
    tags: p.tags ?? [],
    linkTo: p.dealer?.dealerId
      ? `/agent/dealers/${p.dealer.dealerId}/vehicles/${p.processId}`
      : null,
  }
}

export default function AgentBoard() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: assignments = [], isLoading: loadingA } = useQuery({
    queryKey: ['agent-assignments'],
    queryFn: () => processAssignmentService.listForAgent(),
  })

  const { data: ownProcesses = [], isLoading: loadingP } = useQuery({
    queryKey: ['agent-board-processes'],
    queryFn: () => vehicleProcessService.listForAgentBoard(),
  })

  const { data: statuses = [], isLoading: loadingS } = useQuery({
    queryKey: ['agent-statuses'],
    queryFn: () => agentStatusService.getAll(),
  })

  const moveMutation = useMutation({
    mutationFn: ({ card, statusId }) =>
      card.kind === 'assigned'
        ? processAssignmentService.updateAgentStatus(card.id, statusId)
        : vehicleProcessService.updateAgentStatus(card.id, statusId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-assignments'] })
      queryClient.invalidateQueries({ queryKey: ['agent-board-processes'] })
      toast({ title: 'Status updated', variant: 'success' })
    },
    onError: (err) =>
      toast({ title: 'Could not move card', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const cards = [...assignments.map(assignmentToCard), ...ownProcesses.map(ownProcessToCard)]
  const isLoading = loadingA || loadingP || loadingS

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold">Task Board</h1>
        <p className="text-muted-foreground mt-1">
          All your work in one place — drag a card between columns to change its status.
          <span className="ml-1 inline-flex items-center gap-1 align-middle">
            <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Assigned</span>
            = from a dealer,
            <span className="rounded-full border border-warning/20 bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">Own</span>
            = you created.
          </span>
        </p>
      </motion.div>

      {isLoading ? (
        <div className="flex gap-4 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-80 w-72 shrink-0 rounded-xl" />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <EmptyState
          title="Nothing on your board yet"
          description="Dealer-assigned work and processes you create for your own dealers will show up here."
        />
      ) : (
        <AgentTaskBoard
          cards={cards}
          statuses={statuses}
          onMove={(card, statusId) => moveMutation.mutate({ card, statusId })}
          onCardClick={(card) =>
            card.linkTo && navigate(card.linkTo, { state: { dealerName: card.dealerName } })
          }
        />
      )}
    </div>
  )
}
