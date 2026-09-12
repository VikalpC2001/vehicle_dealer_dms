import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { VehicleProcessWizard } from '@/components/vehicle-process/VehicleProcessWizard'
import { vehicleProcessService } from '@/services/vehicleProcessService'
import { getErrorMessage } from '@/lib/authErrors'
import { toast } from '@/hooks/use-toast'

/**
 * Agent create-process flow for a managed dealer. Reuses the dealer `VehicleProcessWizard`, but
 * injects the selected `dealerId` into the start payload (managed-dealer scope) so the process is
 * created on that dealer — a placeholder the agent owns, or a connected/granted real dealer.
 */
export default function AgentCreateVehicleProcess() {
  const { dealerId } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const dealerName = state?.dealerName ?? 'Dealer'
  const backTo = `/agent/dealers/${dealerId}/vehicles`

  const createMutation = useMutation({
    mutationFn: (payload) => vehicleProcessService.start({ ...payload, dealerId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-processes', 'agent', dealerId] })
      // The new process is also an "Own" card on the agent Task Board — refresh that list too.
      queryClient.invalidateQueries({ queryKey: ['agent-board-processes'] })
      toast({ title: 'Process created', description: 'The vehicle process has been created.', variant: 'success' })
      navigate(backTo, { state: { dealerName } })
    },
    onError: (err) =>
      toast({ title: 'Could not create process', description: getErrorMessage(err), variant: 'destructive' }),
  })

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => navigate(backTo, { state: { dealerName } })}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to {dealerName} vehicles
        </Button>
        <h1 className="text-3xl font-bold">New Vehicle Process — {dealerName}</h1>
        <p className="text-muted-foreground mt-1">
          Upload the documents, verify the auto-filled details, and create the process for this dealer.
        </p>
      </motion.div>

      <Card>
        <CardContent className="p-6">
          <VehicleProcessWizard
            categorySource="agent"
            onSubmit={(payload) => createMutation.mutateAsync(payload)}
            submitting={createMutation.isPending}
            onCancel={() => navigate(backTo, { state: { dealerName } })}
          />
        </CardContent>
      </Card>
    </div>
  )
}
