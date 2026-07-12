import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { VehicleProcessWizard } from '@/components/vehicle-process/VehicleProcessWizard'
import { vehicleProcessService, getProcessId } from '@/services/vehicleProcessService'
import { getErrorMessage } from '@/lib/authErrors'
import { toast } from '@/hooks/use-toast'

export default function CreateVehicleProcess() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: (payload) => vehicleProcessService.start(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-processes'] })
      toast({
        title: 'Process created',
        description: 'The vehicle process has been created successfully.',
        variant: 'success',
      })
      const id = getProcessId(data?.process ?? data)
      navigate(id ? `/dealer/processes/${id}` : '/dealer/processes')
    },
    onError: (err) => {
      toast({ title: 'Could not create process', description: getErrorMessage(err), variant: 'destructive' })
    },
  })

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => navigate('/dealer/processes')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to processes
        </Button>
        <h1 className="text-3xl font-bold">New Vehicle Process</h1>
        <p className="text-muted-foreground mt-1">
          Upload the documents, verify the auto-filled details, and create the process.
        </p>
      </motion.div>

      <Card>
        <CardContent className="p-6">
          <VehicleProcessWizard
            onSubmit={(payload) => createMutation.mutateAsync(payload)}
            submitting={createMutation.isPending}
            onCancel={() => navigate('/dealer/processes')}
          />
        </CardContent>
      </Card>
    </div>
  )
}
